-- =============================================================
-- 0017_fix_medium_findings.sql
-- Duas correções da auditoria de segurança:
--
-- 1) gerar_obrigacoes/abrir_folhas ainda usavam is_staff() (herdado de
--    antes da segregação por departamento). Qualquer papel de equipe
--    (ex. societário, atendimento) conseguia gerar obrigações fiscais
--    ou abrir folha de pagamento de todas as empresas. Alinha com o
--    padrão já usado em abrir_fechamentos/gerar_declaracoes_ir.
--
-- 2) doc_acessos_insert (trilha de acesso a documentos, LGPD) só exigia
--    "estar autenticado" — qualquer usuário conseguia forjar registros
--    de acesso (documento_id de outra empresa, profile_id de outra
--    pessoa). Passa a exigir profile_id = auth.uid() e que o documento
--    referenciado seja visível ao autor da ação.
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

  for r in select * from public.obrigacao_recorrencias where ativo loop
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
      values (date_trunc('month', p_competencia)::date, 'aberta', v_qtd)
      on conflict (empresa_id, competencia) do nothing;
    end if;
    if found then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end $$;

drop policy if exists doc_acessos_insert on public.documento_acessos;
create policy doc_acessos_insert on public.documento_acessos for insert
  with check (
    auth.uid() is not null
    and profile_id = auth.uid()
    and exists (
      select 1 from public.documentos d
      where d.id = documento_id and public.empresa_visivel(d.empresa_id)
    )
  );
