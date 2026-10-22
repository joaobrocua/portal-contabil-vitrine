-- =============================================================
-- 0018_fix_abrir_folhas_bug.sql
-- abrir_folhas() nunca funcionava: o INSERT declarava 4 colunas
-- (empresa_id, competencia, status, qtd_funcionarios) mas só passava 3
-- valores — faltava r.id (a empresa do loop) para empresa_id, que é
-- not null sem default. Toda chamada falhava com "INSERT has more
-- target columns than expressions".
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
    end if;
    if found then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end $$;
