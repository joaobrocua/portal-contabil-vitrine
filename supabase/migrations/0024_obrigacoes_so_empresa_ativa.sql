-- =============================================================
-- 0024_obrigacoes_so_empresa_ativa.sql
-- gerar_obrigacoes() só olhava se a RECORRÊNCIA estava ativa — empresa
-- inativada (cliente que saiu do escritório) continuava recebendo
-- obrigações novas todo mês. As outras gerações em lote já ignoravam
-- empresa inativa (abrir_folhas, abrir_fechamentos, gerar_declaracoes_ir);
-- esta alinha a fiscal com elas. Obrigações que já existiam não são
-- tocadas — o histórico e o que estiver em aberto continuam lá.
-- Idêntica à versão de 0017, exceto o `join ... e.ativo` no loop.
-- =============================================================
create or replace function public.gerar_obrigacoes(p_competencia date)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  r record;
  v_comp date := date_trunc('month', p_competencia)::date;
  v_mes int := extract(month from v_comp)::int;
  v_base date;        -- 1º dia do mês de vencimento
  v_last_day int;
  v_venc date;
  v_elegivel boolean;
begin
  if not public.is_papel('admin', 'fiscal') then
    raise exception 'Apenas o departamento fiscal pode gerar obrigações';
  end if;

  for r in
    select rec.* from public.obrigacao_recorrencias rec
    join public.empresas e on e.id = rec.empresa_id and e.ativo
    where rec.ativo
  loop
    v_elegivel := case r.periodicidade
      when 'mensal' then true
      when 'trimestral' then (v_mes % 3) = 0     -- mar/jun/set/dez
      when 'anual' then v_mes = 1                 -- competência de janeiro
      else false
    end;
    if not v_elegivel then continue; end if;

    v_base := (v_comp + make_interval(months => r.meses_apos))::date;
    v_last_day := extract(day from (v_base + interval '1 month' - interval '1 day'))::int;
    v_venc := v_base + (least(r.dia_vencimento, v_last_day) - 1);

    insert into public.obrigacoes
      (empresa_id, competencia, tipo, descricao, vencimento,
       status, responsavel_id, recorrencia_id)
    values
      (r.empresa_id, v_comp, r.tipo, r.descricao, v_venc,
       'pendente', r.responsavel_id, r.id)
    on conflict (empresa_id, competencia, tipo) do nothing;

    if found then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end $$;
