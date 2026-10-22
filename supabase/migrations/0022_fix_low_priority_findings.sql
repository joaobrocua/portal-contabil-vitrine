-- =============================================================
-- 0022_fix_low_priority_findings.sql
-- Corrige um lote de achados de menor prioridade da auditoria:
--  1. Sócio removido apagava em cascata o histórico de IR dele.
--  2. RLS de documentos enviados pelo cliente não travava o status.
--  3. Empresa podia ser inativada por qualquer staff (agora só admin).
--  4. Honorário mensal visível pra qualquer staff (agora só admin,
--     via view separada — RLS de linha não filtra coluna).
--  5. REVOKE EXECUTE explícito nas funções SECURITY DEFINER.
-- =============================================================

-- ---------- 1. Sócio: não apaga mais o histórico de IR ao ser removido ----------
-- Era "on delete cascade" — remover um sócio detonava toda a fiscal.
-- declaracoes_ir dele (IRPF), que é dado com obrigação de guarda. Troca pra
-- "restrict": o banco recusa a exclusão do sócio enquanto existir
-- declaração vinculada (a action dá a mensagem amigável — ver actions.ts).
alter table public.declaracoes_ir
  drop constraint if exists declaracoes_ir_socio_id_fkey;
alter table public.declaracoes_ir
  add constraint declaracoes_ir_socio_id_fkey
  foreign key (socio_id) references public.socios(id) on delete restrict;

-- ---------- 2. RLS: cliente não pode forjar status ao enviar documento ----------
-- A action já força status='pendente' pro cliente, mas a RLS em si não
-- travava isso — um cliente chamando o Supabase direto (fora da action)
-- podia inserir já como 'aprovado'/'entregue'.
drop policy if exists documentos_cliente_insert on public.documentos;
create policy documentos_cliente_insert on public.documentos for insert
  with check (
    origem = 'cliente'
    and public.empresa_visivel(empresa_id)
    and enviado_por = auth.uid()
    and status = 'pendente'
  );

-- ---------- 3. Inativar/reativar empresa: só admin ----------
-- Antes: qualquer staff (fiscal, pessoal, atendimento...) podia inativar
-- uma empresa inteira. Ação de impacto alto — restringe a admin. Não dá
-- pra fazer isso só com RLS de UPDATE (a mesma policy empresas_staff_write
-- cobre edição normal de cadastro, que continua liberada pra staff) —
-- precisa de um trigger que olhe especificamente se o campo `ativo` mudou.
create or replace function public.empresa_ativo_so_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ativo is distinct from old.ativo and not public.is_admin() then
    raise exception 'Apenas administradores podem ativar/inativar uma empresa';
  end if;
  return new;
end $$;

drop trigger if exists trg_empresa_ativo_so_admin on public.empresas;
create trigger trg_empresa_ativo_so_admin before update on public.empresas
  for each row execute function public.empresa_ativo_so_admin();

-- ---------- 4. Honorário mensal: só admin vê ----------
-- RLS filtra LINHA, não coluna — pra esconder só uma coluna de quem não é
-- admin (mesmo tendo select liberado na linha via empresa_visivel), zera o
-- valor na leitura através de uma view. É a mesma linha de defesa que a
-- RLS de linha já usa (funciona mesmo se alguém consultar o Supabase
-- direto pelo browser, não só pela tela) — só que por coluna.
-- security_invoker=true: sem isso, a RLS da tabela base (empresa_visivel)
-- roda com o dono da view, não com quem está consultando — abriria uma
-- view que ignora a RLS de linha (pior do que o problema que estamos
-- corrigindo). Com security_invoker, a RLS de baixo continua valendo pra
-- quem consulta a view, exatamente como consultar a tabela direto.
create or replace view public.empresas_com_honorario
  with (security_invoker = true) as
select
  e.id, e.razao_social, e.nome_fantasia, e.cnpj, e.inscricao_estadual,
  e.inscricao_municipal, e.cnae_principal, e.regime_tributario, e.situacao,
  e.data_abertura, e.email, e.telefone, e.cep, e.logradouro, e.numero,
  e.complemento, e.bairro, e.municipio, e.uf, e.responsavel_id,
  e.departamentos_responsaveis, e.observacoes, e.ativo, e.created_at,
  e.updated_at,
  case when public.is_admin() then e.honorario_mensal else null end
    as honorario_mensal
from public.empresas e;

comment on view public.empresas_com_honorario is
  'Como public.empresas, mas honorario_mensal só vem preenchido pra admin '
  '— quem não é admin recebe null mesmo tendo select na linha. Use esta '
  'view (não empresas.honorario_mensal direto) em qualquer tela que '
  'mostra o honorário. Ao adicionar coluna em empresas, adicionar aqui '
  'também.';

grant select on public.empresas_com_honorario to authenticated;

-- ---------- 5. REVOKE EXECUTE explícito nas funções SECURITY DEFINER ----------
-- O anon recebe EXECUTE por DOIS caminhos, e é preciso fechar os dois:
--  a) PUBLIC — o Postgres concede EXECUTE a PUBLIC em toda função nova, e
--     todo role (inclusive anon) herda de PUBLIC;
--  b) direto — o Supabase configura "alter default privileges in schema
--     public" que concede EXECUTE a anon/authenticated/service_role.
-- Testado ao vivo: revogar só de um dos dois deixa has_function_privilege(
-- 'anon', ...) em true. (Uma versão anterior desta migration revogava só de
-- anon; parecia funcionar no banco de teste porque uma tentativa anterior
-- já tinha revogado de PUBLIC ali — numa instalação nova não teria efeito.)
-- authenticated continua com o grant direto (b) e recebe grant explícito
-- abaixo por garantia. Nenhuma dessas funções faz sentido pra chamada
-- anônima (todas leem auth.uid(), nulo sem sessão); as de escrita em
-- massa já checam o papel internamente — isto é reforço de superfície.
revoke execute on function public.current_papel() from public, anon;
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_papel(papel[]) from public, anon;
revoke execute on function public.empresa_visivel(uuid) from public, anon;
revoke execute on function public.gerar_obrigacoes(date) from public, anon;
revoke execute on function public.abrir_folhas(date) from public, anon;
revoke execute on function public.abrir_fechamentos(date) from public, anon;
revoke execute on function public.gerar_declaracoes_ir(ir_tipo, int, date) from public, anon;

grant execute on function public.current_papel() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_papel(papel[]) to authenticated;
grant execute on function public.empresa_visivel(uuid) to authenticated;
grant execute on function public.gerar_obrigacoes(date) to authenticated;
grant execute on function public.abrir_folhas(date) to authenticated;
grant execute on function public.abrir_fechamentos(date) to authenticated;
grant execute on function public.gerar_declaracoes_ir(ir_tipo, int, date) to authenticated;
-- handle_new_user() é chamada só pelo trigger on_auth_user_created (roda
-- como o dono do trigger, não via chamada direta de role nenhum) — não
-- precisa de revoke.
