-- =============================================================
-- 0008_fix_pessoal_rls.sql — Corrige exposição de dados de RH
-- =============================================================
-- As policies de select criadas em 0007_pessoal.sql usavam
-- empresa_visivel(), a mesma função que libera dados para o
-- papel "cliente". Isso permitia que um contato-cliente lesse,
-- via API, CPF e salário dos funcionários da própria empresa —
-- dado que nenhuma tela do portal expõe, mas que a RLS não
-- bloqueava. Restringe a leitura de funcionarios/eventos_dp/
-- evento_dp_itens/folhas à equipe interna (is_staff()).

drop policy if exists funcionarios_select on public.funcionarios;
create policy funcionarios_select on public.funcionarios for select
  using (public.is_staff());

drop policy if exists eventos_dp_select on public.eventos_dp;
create policy eventos_dp_select on public.eventos_dp for select
  using (public.is_staff());

drop policy if exists evento_dp_itens_select on public.evento_dp_itens;
create policy evento_dp_itens_select on public.evento_dp_itens for select
  using (public.is_staff());

drop policy if exists folhas_select on public.folhas;
create policy folhas_select on public.folhas for select
  using (public.is_staff());
