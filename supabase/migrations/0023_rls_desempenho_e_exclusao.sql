-- =============================================================
-- 0023_rls_desempenho_e_exclusao.sql
--  1. Excluir empresa: só admin. Antes, empresas_staff_write era FOR ALL
--     pra qualquer staff — incluía DELETE, e apagar uma empresa apaga em
--     cascata obrigações, folhas, funcionários, IR, fechamentos, sócios,
--     contatos e documentos (12 tabelas). A tela nunca teve esse botão,
--     mas a API aceitava de qualquer colaborador (inclusive atendimento).
--  2. Histórico: o autor gravado precisa ser o próprio usuário logado
--     (antes dava pra gravar auditoria em nome de outra pessoa chamando a
--     API direto). registrarHistorico() já grava assim — nada muda no app.
--  3. Desempenho: toda policy passa a chamar as funções de papel dentro de
--     `(select ...)`. Sem isso o Postgres reavalia is_staff()/is_papel()
--     LINHA A LINHA (uma consulta em profiles por linha); com isso vira um
--     InitPlan avaliado uma vez por consulta. Medido com 44 mil
--     obrigações: 358 ms -> 8 ms. Semântica idêntica — mesmas regras, só
--     muda quantas vezes são avaliadas. Nas policies de SELECT que eram só
--     `empresa_visivel(x)`, o `(select is_staff()) or` na frente é o mesmo
--     teste que empresa_visivel já faz por dentro, só que avaliado 1 vez.
--  4. Desempenho do lado do cliente: empresa_visivel(x) por linha roda
--     uma subconsulta em contatos pra CADA linha — medido com 44 mil
--     obrigações, um cliente levava 6,4 s pra listar as dele. Troca por
--     `x = any(empresas_visiveis_ids())`, que monta a lista de empresas do
--     usuário uma vez só: 11 ms, mesmo resultado (4.409 linhas nos dois).
--     empresa_visivel() continua existindo (Storage e código usam).
-- =============================================================

-- Empresas em que o usuário logado é contato (vazio pra quem não é
-- cliente). Mesma regra de empresa_visivel(), sem a parte de staff — as
-- policies testam `(select is_staff())` separado. security definer porque
-- contatos/profiles têm RLS própria; só devolve dados do próprio usuário.
create or replace function public.empresas_visiveis_ids()
returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(c.empresa_id), '{}')
  from public.contatos c
  join public.profiles p on p.id = c.profile_id
  where c.profile_id = auth.uid() and p.ativo
$$;
revoke execute on function public.empresas_visiveis_ids() from public, anon;
grant execute on function public.empresas_visiveis_ids() to authenticated;

-- ---------- catalogos ----------
drop policy if exists catalogos_admin on public.catalogos;
create policy catalogos_admin on public.catalogos for all
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists catalogos_read on public.catalogos;
create policy catalogos_read on public.catalogos for select
  using ((select auth.uid()) is not null);

-- ---------- escritorio_config ----------
drop policy if exists config_admin on public.escritorio_config;
create policy config_admin on public.escritorio_config for all
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists config_read on public.escritorio_config;
create policy config_read on public.escritorio_config for select
  using ((select auth.uid()) is not null);

-- ---------- profiles ----------
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = (select auth.uid()) or (select public.is_staff()));
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------- historico (item 2) ----------
drop policy if exists historico_insert on public.historico;
create policy historico_insert on public.historico for insert
  with check ((select public.is_staff()) and autor_id = (select auth.uid()));
drop policy if exists historico_read on public.historico;
create policy historico_read on public.historico for select
  using ((select public.is_staff()));

-- ---------- empresas (item 1) ----------
drop policy if exists empresas_select on public.empresas;
create policy empresas_select on public.empresas for select
  using ((select public.is_staff()) or id = any ((select public.empresas_visiveis_ids())::uuid[]));
drop policy if exists empresas_staff_write on public.empresas;
drop policy if exists empresas_staff_insert on public.empresas;
create policy empresas_staff_insert on public.empresas for insert
  with check ((select public.is_staff()));
drop policy if exists empresas_staff_update on public.empresas;
create policy empresas_staff_update on public.empresas for update
  using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists empresas_admin_delete on public.empresas;
create policy empresas_admin_delete on public.empresas for delete
  using ((select public.is_admin()));

-- ---------- socios / contatos ----------
drop policy if exists socios_select on public.socios;
create policy socios_select on public.socios for select
  using ((select public.is_staff()) or empresa_id = any ((select public.empresas_visiveis_ids())::uuid[]));
drop policy if exists socios_staff_write on public.socios;
create policy socios_staff_write on public.socios for all
  using ((select public.is_staff())) with check ((select public.is_staff()));

drop policy if exists contatos_select on public.contatos;
create policy contatos_select on public.contatos for select
  using ((select public.is_staff()) or empresa_id = any ((select public.empresas_visiveis_ids())::uuid[]));
drop policy if exists contatos_staff_write on public.contatos;
create policy contatos_staff_write on public.contatos for all
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- ---------- tarefas ----------
drop policy if exists tarefas_select on public.tarefas;
create policy tarefas_select on public.tarefas for select
  using ((select public.is_staff())
         or (empresa_id is not null and empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])));
drop policy if exists tarefas_staff_write on public.tarefas;
create policy tarefas_staff_write on public.tarefas for all
  using ((select public.is_staff())) with check ((select public.is_staff()));

drop policy if exists tarefa_itens_select on public.tarefa_itens;
create policy tarefa_itens_select on public.tarefa_itens for select
  using ((select public.is_staff()) or exists (
    select 1 from public.tarefas t
    where t.id = tarefa_itens.tarefa_id
      and t.empresa_id is not null and t.empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])));
drop policy if exists tarefa_itens_staff_write on public.tarefa_itens;
create policy tarefa_itens_staff_write on public.tarefa_itens for all
  using ((select public.is_staff())) with check ((select public.is_staff()));

drop policy if exists tarefa_docs_select on public.tarefa_documentos;
create policy tarefa_docs_select on public.tarefa_documentos for select
  using ((select public.is_staff()) or exists (
    select 1 from public.tarefas t
    where t.id = tarefa_documentos.tarefa_id
      and t.empresa_id is not null and t.empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])));
drop policy if exists tarefa_docs_staff_write on public.tarefa_documentos;
create policy tarefa_docs_staff_write on public.tarefa_documentos for all
  using ((select public.is_staff())) with check ((select public.is_staff()));

drop policy if exists templates_admin on public.tarefa_templates;
create policy templates_admin on public.tarefa_templates for all
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists templates_read on public.tarefa_templates;
create policy templates_read on public.tarefa_templates for select
  using ((select public.is_staff()));

-- ---------- documentos ----------
drop policy if exists documentos_select on public.documentos;
create policy documentos_select on public.documentos for select
  using ((select public.is_staff()) or empresa_id = any ((select public.empresas_visiveis_ids())::uuid[]));
drop policy if exists documentos_staff_write on public.documentos;
create policy documentos_staff_write on public.documentos for all
  using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists documentos_cliente_insert on public.documentos;
create policy documentos_cliente_insert on public.documentos for insert
  with check (
    origem = 'cliente'
    and empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])
    and enviado_por = (select auth.uid())
    and status = 'pendente'
  );

drop policy if exists doc_acessos_select on public.documento_acessos;
create policy doc_acessos_select on public.documento_acessos for select
  using ((select public.is_staff()));
drop policy if exists doc_acessos_insert on public.documento_acessos;
create policy doc_acessos_insert on public.documento_acessos for insert
  with check (
    (select auth.uid()) is not null
    and profile_id = (select auth.uid())
    and exists (
      select 1 from public.documentos d
      where d.id = documento_acessos.documento_id
        and d.empresa_id = any ((select public.empresas_visiveis_ids())::uuid[]))
  );

-- ---------- agenda ----------
drop policy if exists eventos_select on public.eventos_agenda;
create policy eventos_select on public.eventos_agenda for select
  using ((select public.is_staff())
         or (empresa_id is not null and empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])));
drop policy if exists eventos_staff_write on public.eventos_agenda;
create policy eventos_staff_write on public.eventos_agenda for all
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- ---------- fiscal ----------
drop policy if exists obrigacoes_select on public.obrigacoes;
create policy obrigacoes_select on public.obrigacoes for select
  using ((select public.is_staff()) or empresa_id = any ((select public.empresas_visiveis_ids())::uuid[]));
drop policy if exists obrigacoes_staff_write on public.obrigacoes;
create policy obrigacoes_staff_write on public.obrigacoes for all
  using ((select public.is_papel('admin', 'fiscal')))
  with check ((select public.is_papel('admin', 'fiscal')));

drop policy if exists recorrencias_select on public.obrigacao_recorrencias;
create policy recorrencias_select on public.obrigacao_recorrencias for select
  using ((select public.is_papel('admin', 'fiscal')));
drop policy if exists recorrencias_staff_write on public.obrigacao_recorrencias;
create policy recorrencias_staff_write on public.obrigacao_recorrencias for all
  using ((select public.is_papel('admin', 'fiscal')))
  with check ((select public.is_papel('admin', 'fiscal')));

-- ---------- pessoal ----------
drop policy if exists funcionarios_select on public.funcionarios;
create policy funcionarios_select on public.funcionarios for select
  using ((select public.is_papel('admin', 'pessoal')));
drop policy if exists funcionarios_staff_write on public.funcionarios;
create policy funcionarios_staff_write on public.funcionarios for all
  using ((select public.is_papel('admin', 'pessoal')))
  with check ((select public.is_papel('admin', 'pessoal')));

drop policy if exists eventos_dp_select on public.eventos_dp;
create policy eventos_dp_select on public.eventos_dp for select
  using ((select public.is_papel('admin', 'pessoal')));
drop policy if exists eventos_dp_staff_write on public.eventos_dp;
create policy eventos_dp_staff_write on public.eventos_dp for all
  using ((select public.is_papel('admin', 'pessoal')))
  with check ((select public.is_papel('admin', 'pessoal')));

drop policy if exists evento_dp_itens_select on public.evento_dp_itens;
create policy evento_dp_itens_select on public.evento_dp_itens for select
  using ((select public.is_papel('admin', 'pessoal')));
drop policy if exists evento_dp_itens_staff_write on public.evento_dp_itens;
create policy evento_dp_itens_staff_write on public.evento_dp_itens for all
  using ((select public.is_papel('admin', 'pessoal')))
  with check ((select public.is_papel('admin', 'pessoal')));

drop policy if exists folhas_select on public.folhas;
create policy folhas_select on public.folhas for select
  using ((select public.is_papel('admin', 'pessoal')));
drop policy if exists folhas_staff_write on public.folhas;
create policy folhas_staff_write on public.folhas for all
  using ((select public.is_papel('admin', 'pessoal')))
  with check ((select public.is_papel('admin', 'pessoal')));

-- ---------- contábil ----------
drop policy if exists fechamentos_select on public.fechamentos_contabeis;
create policy fechamentos_select on public.fechamentos_contabeis for select
  using ((select public.is_papel('admin', 'contabil')));
drop policy if exists fechamentos_write on public.fechamentos_contabeis;
create policy fechamentos_write on public.fechamentos_contabeis for all
  using ((select public.is_papel('admin', 'contabil')))
  with check ((select public.is_papel('admin', 'contabil')));

drop policy if exists fechamento_itens_select on public.fechamento_itens;
create policy fechamento_itens_select on public.fechamento_itens for select
  using ((select public.is_papel('admin', 'contabil')));
drop policy if exists fechamento_itens_write on public.fechamento_itens;
create policy fechamento_itens_write on public.fechamento_itens for all
  using ((select public.is_papel('admin', 'contabil')))
  with check ((select public.is_papel('admin', 'contabil')));

-- ---------- societário ----------
drop policy if exists processos_societarios_select on public.processos_societarios;
create policy processos_societarios_select on public.processos_societarios for select
  using ((select public.is_papel('admin', 'societario')));
drop policy if exists processos_societarios_write on public.processos_societarios;
create policy processos_societarios_write on public.processos_societarios for all
  using ((select public.is_papel('admin', 'societario')))
  with check ((select public.is_papel('admin', 'societario')));

drop policy if exists processo_societario_itens_select on public.processo_societario_itens;
create policy processo_societario_itens_select on public.processo_societario_itens for select
  using ((select public.is_papel('admin', 'societario')));
drop policy if exists processo_societario_itens_write on public.processo_societario_itens;
create policy processo_societario_itens_write on public.processo_societario_itens for all
  using ((select public.is_papel('admin', 'societario')))
  with check ((select public.is_papel('admin', 'societario')));

-- ---------- IR ----------
drop policy if exists declaracoes_ir_select on public.declaracoes_ir;
create policy declaracoes_ir_select on public.declaracoes_ir for select
  using ((select public.is_papel('admin', 'fiscal', 'contabil')));
drop policy if exists declaracoes_ir_write on public.declaracoes_ir;
create policy declaracoes_ir_write on public.declaracoes_ir for all
  using ((select public.is_papel('admin', 'fiscal', 'contabil')))
  with check ((select public.is_papel('admin', 'fiscal', 'contabil')));
