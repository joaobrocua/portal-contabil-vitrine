-- =============================================================
-- 0009_rls_departamento.sql — Segrega Fiscal e Pessoal por papel
-- =============================================================
-- Hoje, se a conta de um colaborador de QUALQUER departamento for
-- comprometida, o invasor consegue ler e até escrever em dados de
-- Pessoal (CPF, salário) e Fiscal via chamada direta à API — porque
-- as policies usavam is_staff(), que não diferencia entre papéis
-- internos. Isso é mais permissivo do que as próprias telas do
-- portal, que já restringem essas rotas a admin + o papel do
-- departamento (ver requireRole("admin","pessoal") /
-- requireRole("admin","fiscal") nas actions/páginas).
--
-- Esta migration alinha a RLS ao que a aplicação já assume:
-- só admin e o papel do próprio departamento acessam os dados
-- daquele departamento. `obrigacoes_select` continua liberado
-- também para o cliente da empresa (empresa_visivel) — isso é
-- proposital, é a única dessas tabelas com uma tela pensada para
-- o cliente acompanhar suas obrigações.

create or replace function public.is_papel(variadic p_papeis papel[])
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select papel from public.profiles where id = auth.uid()) = any(p_papeis),
    false)
$$;

-- ---------- pessoal: leitura e escrita restritas a admin + pessoal ----------
drop policy if exists funcionarios_select on public.funcionarios;
create policy funcionarios_select on public.funcionarios for select
  using (public.is_papel('admin', 'pessoal'));
drop policy if exists funcionarios_staff_write on public.funcionarios;
create policy funcionarios_staff_write on public.funcionarios for all
  using (public.is_papel('admin', 'pessoal'))
  with check (public.is_papel('admin', 'pessoal'));

drop policy if exists eventos_dp_select on public.eventos_dp;
create policy eventos_dp_select on public.eventos_dp for select
  using (public.is_papel('admin', 'pessoal'));
drop policy if exists eventos_dp_staff_write on public.eventos_dp;
create policy eventos_dp_staff_write on public.eventos_dp for all
  using (public.is_papel('admin', 'pessoal'))
  with check (public.is_papel('admin', 'pessoal'));

drop policy if exists evento_dp_itens_select on public.evento_dp_itens;
create policy evento_dp_itens_select on public.evento_dp_itens for select
  using (public.is_papel('admin', 'pessoal'));
drop policy if exists evento_dp_itens_staff_write on public.evento_dp_itens;
create policy evento_dp_itens_staff_write on public.evento_dp_itens for all
  using (public.is_papel('admin', 'pessoal'))
  with check (public.is_papel('admin', 'pessoal'));

drop policy if exists folhas_select on public.folhas;
create policy folhas_select on public.folhas for select
  using (public.is_papel('admin', 'pessoal'));
drop policy if exists folhas_staff_write on public.folhas;
create policy folhas_staff_write on public.folhas for all
  using (public.is_papel('admin', 'pessoal'))
  with check (public.is_papel('admin', 'pessoal'));

-- ---------- fiscal: escrita restrita a admin + fiscal ----------
-- (leitura de obrigações continua liberada pro cliente da empresa)
drop policy if exists obrigacoes_staff_write on public.obrigacoes;
create policy obrigacoes_staff_write on public.obrigacoes for all
  using (public.is_papel('admin', 'fiscal'))
  with check (public.is_papel('admin', 'fiscal'));

drop policy if exists recorrencias_select on public.obrigacao_recorrencias;
create policy recorrencias_select on public.obrigacao_recorrencias for select
  using (public.is_papel('admin', 'fiscal'));
drop policy if exists recorrencias_staff_write on public.obrigacao_recorrencias;
create policy recorrencias_staff_write on public.obrigacao_recorrencias for all
  using (public.is_papel('admin', 'fiscal'))
  with check (public.is_papel('admin', 'fiscal'));
