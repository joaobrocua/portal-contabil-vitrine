-- =============================================================
-- 0031_acesso_por_departamento.sql
-- Documentos do Pessoal, histórico por departamento e tarefas do cliente
-- =============================================================
-- Auditoria de 2026-10: qualquer funcionário (até o atendimento) lia e
-- baixava holerites e demais documentos do Pessoal, o histórico mostrava a
-- todos o que acontecia em outros departamentos, e o cliente lia pela API
-- TODAS as tarefas da própria empresa, inclusive anotações internas.
-- Regras definidas pelo dono do sistema:
--
--  1. DOCUMENTOS: só os do departamento PESSOAL ficam restritos (admin +
--     papel pessoal). Os demais departamentos continuam abertos a todo o
--     staff. O cliente continua vendo os documentos da PRÓPRIA empresa.
--     Os arquivos no Storage seguem a mesma regra (a tabela documentos é a
--     fonte única) e o staff deixa de apagar arquivo direto pela API: só o
--     dono do arquivo e o admin (a exclusão pelo sistema roda no servidor).
--  2. HISTÓRICO: cada papel vê os registros do seu departamento. Admin vê
--     tudo; usuários, configuração e modelos de tarefa só admin. REGRA:
--     um tipo novo de histórico (coluna entidade) precisa ser acrescentado
--     em historico_entidades_visiveis(); sem isso ele fica visível só ao admin.
--  3. TAREFAS: o cliente só enxerga as tarefas "aguardando_cliente" da sua
--     empresa (e o checklist/documentos dessas tarefas).
--
-- Idempotente: cada policy é precedida de drop policy if exists.

-- Cada arquivo pertence a UM documento. Índice ÚNICO (e não só de busca): a
-- policy de leitura do Storage libera o arquivo para quem enxerga o registro
-- que aponta para ele; sem unicidade, quem pudesse registrar um documento
-- "aberto" (ex.: do Fiscal) apontando para o caminho de um arquivo do Pessoal
-- ganharia acesso a ele. (Testado: era possível.)
drop index if exists public.documentos_storage_path_idx;
create unique index if not exists documentos_storage_path_uidx
  on public.documentos (storage_path);

-- O arquivo de um documento fica SEMPRE na pasta da própria empresa (o Zod já
-- exige isto na action; aqui o banco também, para quem registra pela API).
-- NOT VALID: vale para o que for gravado daqui para frente, sem varrer o
-- que já existe.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'documentos_caminho_da_empresa'
      and conrelid = 'public.documentos'::regclass
  ) then
    alter table public.documentos
      add constraint documentos_caminho_da_empresa
      check (storage_path like empresa_id::text || '/%') not valid;
  end if;
end $$;

-- Usuário ativo? As policies "de dono do arquivo" (Storage) precisam disto:
-- quem foi desativado mantém o JWT até expirar e não pode continuar lendo ou
-- apagando o que enviou.
create or replace function public.sou_ativo()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select ativo from public.profiles where id = auth.uid()), false)
$$;

-- Este arquivo já pertence a algum documento? (security definer: precisa
-- enxergar também os documentos que a RLS esconderia de quem pergunta.)
create or replace function public.arquivo_tem_documento(p_caminho text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.documentos where storage_path = p_caminho)
$$;

revoke all on function public.sou_ativo() from public, anon;
revoke all on function public.arquivo_tem_documento(text) from public, anon;
grant execute on function public.sou_ativo() to authenticated, service_role;
grant execute on function public.arquivo_tem_documento(text) to authenticated, service_role;

-- ---------- 1. DOCUMENTOS ----------
-- "is distinct from": documento sem departamento não pode sumir para o staff.
drop policy if exists documentos_select on public.documentos;
create policy documentos_select on public.documentos
  for select to authenticated
  using (
    (
      (select public.is_staff())
      and (departamento is distinct from 'pessoal'
           or (select public.is_papel('admin', 'pessoal')))
    )
    or empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])
  );

-- Era uma policy FOR ALL (qualquer staff, qualquer departamento). Agora a
-- mesma regra vale para gravar, e usando/with check iguais impedem
-- "reclassificar" um documento para dentro ou para fora do Pessoal.
drop policy if exists documentos_staff_write on public.documentos;
drop policy if exists documentos_staff_insert on public.documentos;
drop policy if exists documentos_staff_update on public.documentos;
drop policy if exists documentos_staff_delete on public.documentos;
create policy documentos_staff_insert on public.documentos
  for insert to authenticated
  with check (
    (select public.is_staff())
    and (departamento is distinct from 'pessoal'
         or (select public.is_papel('admin', 'pessoal')))
  );
create policy documentos_staff_update on public.documentos
  for update to authenticated
  using (
    (select public.is_staff())
    and (departamento is distinct from 'pessoal'
         or (select public.is_papel('admin', 'pessoal')))
  )
  with check (
    (select public.is_staff())
    and (departamento is distinct from 'pessoal'
         or (select public.is_papel('admin', 'pessoal')))
  );
create policy documentos_staff_delete on public.documentos
  for delete to authenticated
  using (
    (select public.is_staff())
    and (departamento is distinct from 'pessoal'
         or (select public.is_papel('admin', 'pessoal')))
  );
-- documentos_cliente_insert (cliente envia na própria empresa) não muda.

-- Trilha de acessos (LGPD): acompanha a visibilidade do documento. Linhas de
-- documento já excluído (documento_id nulo) só o admin vê.
drop policy if exists doc_acessos_select on public.documento_acessos;
create policy doc_acessos_select on public.documento_acessos
  for select to authenticated
  using (
    (select public.is_admin())
    or (
      (select public.is_staff())
      and documento_id is not null
      and exists (
        select 1 from public.documentos d where d.id = documento_acessos.documento_id
      )
    )
  );

-- ---------- 2. STORAGE (bucket documentos) ----------
-- Leitura: admin; o próprio dono do arquivo (precisa conferir o upload antes
-- de existir o registro em documentos); ou quem enxerga o registro do
-- documento — a subconsulta roda sob a RLS de documentos, então herda a regra
-- do Pessoal e a do cliente (própria empresa). Arquivo órfão: só dono/admin.
drop policy if exists "documentos storage read" on storage.objects;
create policy "documentos storage read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documentos'
    and (
      (select public.is_admin())
      or (owner_id = (select auth.uid())::text and (select public.sou_ativo()))
      or exists (
        select 1 from public.documentos d where d.storage_path = storage.objects.name
      )
    )
  );

-- Era FOR ALL para qualquer staff: lia, sobrescrevia e apagava qualquer
-- arquivo do bucket. Agora: staff só ENVIA. Apagar é do admin ou do DONO do
-- arquivo, e o dono só enquanto o arquivo ainda não pertence a nenhum
-- documento (é o que o sistema faz para limpar um envio recusado; depois de
-- registrado, nem o cliente que enviou apaga pela API). A exclusão de
-- documento pelo sistema remove o arquivo no servidor.
drop policy if exists "documentos storage staff write" on storage.objects;
drop policy if exists "documentos storage staff insert" on storage.objects;
create policy "documentos storage staff insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos' and (select public.is_staff()));

drop policy if exists "documentos storage owner delete" on storage.objects;
create policy "documentos storage owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documentos'
    and (
      (select public.is_admin())
      or (
        owner_id = (select auth.uid())::text
        and (select public.sou_ativo())
        and not public.arquivo_tem_documento(storage.objects.name)
      )
    )
  );
-- "documentos storage cliente upload" (cliente envia para a própria pasta) não muda.

-- ---------- 3. HISTÓRICO por departamento ----------
create or replace function public.historico_entidades_visiveis()
returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case p.papel
      when 'fiscal'      then array['empresa','tarefa','obrigacao','fiscal','declaracao_ir']
      when 'contabil'    then array['empresa','tarefa','fechamento','declaracao_ir']
      when 'pessoal'     then array['empresa','tarefa','funcionario','evento_dp','folha']
      when 'societario'  then array['empresa','tarefa','processo_societario']
      when 'atendimento' then array['empresa','tarefa']
      else '{}'::text[]            -- cliente; admin é tratado por is_admin() na policy
    end
    from public.profiles p where p.id = auth.uid() and p.ativo
  ), '{}'::text[])
$$;
revoke all on function public.historico_entidades_visiveis() from public, anon;
grant execute on function public.historico_entidades_visiveis() to authenticated, service_role;

drop policy if exists historico_read on public.historico;
create policy historico_read on public.historico
  for select to authenticated
  using (
    (select public.is_admin())
    or (
      (select public.is_staff())
      and (
        entidade = any ((select public.historico_entidades_visiveis())::text[])
        -- registro sobre documento: só para quem enxerga o documento
        or (entidade = 'documento'
            and exists (select 1 from public.documentos d where d.id = historico.entidade_id))
      )
    )
  );
-- usuario, config, tarefa_modelo e qualquer tipo não listado: só admin.

-- ---------- 4. TAREFAS: o cliente só vê "aguardando_cliente" ----------
drop policy if exists tarefas_select on public.tarefas;
create policy tarefas_select on public.tarefas
  for select to authenticated
  using (
    (select public.is_staff())
    or (
      status = 'aguardando_cliente'
      and empresa_id is not null
      and empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])
    )
  );

drop policy if exists tarefa_itens_select on public.tarefa_itens;
create policy tarefa_itens_select on public.tarefa_itens
  for select to authenticated
  using (
    (select public.is_staff())
    or exists (
      select 1 from public.tarefas t
      where t.id = tarefa_itens.tarefa_id
        and t.status = 'aguardando_cliente'
        and t.empresa_id is not null
        and t.empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])
    )
  );

drop policy if exists tarefa_docs_select on public.tarefa_documentos;
create policy tarefa_docs_select on public.tarefa_documentos
  for select to authenticated
  using (
    (select public.is_staff())
    or exists (
      select 1 from public.tarefas t
      where t.id = tarefa_documentos.tarefa_id
        and t.status = 'aguardando_cliente'
        and t.empresa_id is not null
        and t.empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])
    )
  );
