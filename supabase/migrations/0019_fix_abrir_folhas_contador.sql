-- =============================================================
-- 0019_fix_abrir_folhas_contador.sql
-- abrir_folhas() contava errado: o "if found" ficava FORA do bloco
-- "if v_qtd > 0", então quando uma empresa não tinha funcionário (insert
-- pulado), FOUND ainda refletia o último comando executado — o
-- "select count(*) into v_qtd", que sempre acha 1 linha (count sempre
-- retorna algo) — contando a empresa como "folha aberta" mesmo sem
-- nenhuma folha ter sido criada. Move o "if found" pra dentro do bloco,
-- logo após o insert, igual ao padrão usado em gerar_obrigacoes.
-- =============================================================

create or replace function public.abrir_folhas(p_competencia date)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  r record;
  v_qtd int;
begin
  if not public.is_papel('admin', 'pessoal') then
    raise exception 'Apenas o departamento pessoal pode abrir folhas';
  end if;

  for r in select id from public.empresas where ativo loop
    select count(*) into v_qtd
      from public.funcionarios
     where empresa_id = r.id and status in ('ativo','afastado','ferias');

    if v_qtd > 0 then
      insert into public.folhas (empresa_id, competencia, status, qtd_funcionarios)
      values (r.id, date_trunc('month', p_competencia)::date, 'aberta', v_qtd)
      on conflict (empresa_id, competencia) do nothing;
      if found then v_count := v_count + 1; end if;
    end if;
  end loop;

  return v_count;
end $$;
