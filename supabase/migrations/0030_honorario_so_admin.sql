-- =============================================================
-- 0030_honorario_so_admin.sql — honorário mensal só para admin, NO BANCO
-- =============================================================
-- A 0022 escondeu o honorário atrás de uma view (empresas_com_honorario),
-- mas a coluna continuava em public.empresas: qualquer staff lia (e
-- ALTERAVA) o valor de todas as empresas, e o cliente lia o da própria
-- empresa, consultando a tabela direto pela API — a tela escondia, o banco
-- entregava. (Confirmado por teste com um usuário de cada papel.)
--
-- RLS filtra linha, não coluna. Em vez de brigar com privilégio por coluna
-- (que quebraria `select *` e a view security_invoker), o valor sai da
-- tabela de empresas e vai para uma tabela própria, com RLS só de admin:
--
--   public.empresa_honorarios (empresa_id, valor)  → só admin lê/grava
--   public.empresas_com_honorario (view)           → como antes: a coluna
--     honorario_mensal vem do join; não-admin não enxerga a linha em
--     empresa_honorarios (RLS do invoker) e recebe null.
--
-- Idempotente. Os valores já cadastrados são copiados antes de a coluna
-- ser removida.

create table if not exists public.empresa_honorarios (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  valor      numeric(12,2) not null check (valor >= 0),
  updated_at timestamptz not null default now()
);

alter table public.empresa_honorarios enable row level security;

drop policy if exists honorarios_admin on public.empresa_honorarios;
create policy honorarios_admin on public.empresa_honorarios
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists trg_honorarios_touch on public.empresa_honorarios;
create trigger trg_honorarios_touch
  before update on public.empresa_honorarios
  for each row execute function public.touch_updated_at();

-- Copia o que existe (só enquanto a coluna antiga ainda existir).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'empresas'
      and column_name = 'honorario_mensal'
  ) then
    insert into public.empresa_honorarios (empresa_id, valor)
    select id, honorario_mensal from public.empresas
    where honorario_mensal is not null and honorario_mensal >= 0
    on conflict (empresa_id) do nothing;
  end if;
end $$;

-- A view depende da coluna: refaz a view, depois remove a coluna.
drop view if exists public.empresas_com_honorario;

alter table public.empresas drop column if exists honorario_mensal;

create view public.empresas_com_honorario
  with (security_invoker = true) as
select
  e.id, e.razao_social, e.nome_fantasia, e.cnpj, e.inscricao_estadual,
  e.inscricao_municipal, e.cnae_principal, e.regime_tributario, e.situacao,
  e.data_abertura, e.email, e.telefone, e.cep, e.logradouro, e.numero,
  e.complemento, e.bairro, e.municipio, e.uf, e.responsavel_id,
  e.departamentos_responsaveis, e.observacoes, e.ativo, e.created_at,
  e.updated_at,
  h.valor as honorario_mensal
from public.empresas e
left join public.empresa_honorarios h on h.empresa_id = e.id;

comment on view public.empresas_com_honorario is
  'Como public.empresas, mais honorario_mensal vindo de empresa_honorarios. '
  'Com security_invoker, a RLS de empresa_honorarios (só admin) vale para '
  'quem consulta: quem não é admin recebe null. Ao adicionar coluna em '
  'empresas, adicionar aqui também.';

revoke all on public.empresas_com_honorario from anon;
grant select on public.empresas_com_honorario to authenticated;
revoke all on public.empresa_honorarios from anon;
