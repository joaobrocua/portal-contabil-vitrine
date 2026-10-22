-- =============================================================
-- 0006_fiscal.sql — Módulo Fiscal (V2)
-- Obrigações por empresa × competência + recorrências + geração
-- =============================================================

do $$ begin
  create type obrigacao_tipo as enum (
    'das','das_mei','fgts','inss_gps',
    'darf_irpj','darf_csll','darf_pis','darf_cofins','darf_irrf',
    'iss','icms','difal',
    'dctfweb','efd_contribuicoes','efd_icms_ipi','efd_reinf',
    'sped_ecd','sped_ecf','defis','dirf','rais','outro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type obrigacao_status as enum (
    'pendente','em_andamento','gerada','disponivel','entregue','paga','dispensada'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type periodicidade as enum ('mensal','trimestral','anual');
exception when duplicate_object then null; end $$;

-- ---------- recorrências (config do que cada empresa deve entregar) ----------
create table if not exists public.obrigacao_recorrencias (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  tipo           obrigacao_tipo not null,
  descricao      text,
  periodicidade  periodicidade not null default 'mensal',
  dia_vencimento int not null default 20 check (dia_vencimento between 1 and 31),
  meses_apos     int not null default 1 check (meses_apos between 0 and 3),
  responsavel_id uuid references public.profiles(id) on delete set null,
  ativo          boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (empresa_id, tipo)
);
create index if not exists recorrencias_empresa_idx
  on public.obrigacao_recorrencias (empresa_id);

-- ---------- obrigações ----------
create table if not exists public.obrigacoes (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  competencia    date not null,
  tipo           obrigacao_tipo not null,
  descricao      text,
  vencimento     date not null,
  valor          numeric(14,2),
  status         obrigacao_status not null default 'pendente',
  responsavel_id uuid references public.profiles(id) on delete set null,
  guia_path      text,
  comprovante_path text,
  data_entrega   date,
  observacao     text,
  recorrencia_id uuid references public.obrigacao_recorrencias(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint obrigacoes_competencia_dia1
    check (extract(day from competencia) = 1),
  unique (empresa_id, competencia, tipo)
);
create index if not exists obrigacoes_competencia_idx on public.obrigacoes (competencia);
create index if not exists obrigacoes_empresa_idx on public.obrigacoes (empresa_id);
create index if not exists obrigacoes_status_idx on public.obrigacoes (status);
create index if not exists obrigacoes_vencimento_idx on public.obrigacoes (vencimento);

drop trigger if exists trg_obrigacoes_touch on public.obrigacoes;
create trigger trg_obrigacoes_touch before update on public.obrigacoes
  for each row execute function public.touch_updated_at();

-- data_entrega automática ao marcar entregue/paga
create or replace function public.obrigacao_marca_entrega()
returns trigger language plpgsql as $$
begin
  if new.status in ('entregue','paga')
     and (old.status is null or old.status not in ('entregue','paga'))
     and new.data_entrega is null then
    new.data_entrega = current_date;
  end if;
  return new;
end $$;

drop trigger if exists trg_obrigacao_entrega on public.obrigacoes;
create trigger trg_obrigacao_entrega before insert or update on public.obrigacoes
  for each row execute function public.obrigacao_marca_entrega();

-- =============================================================
-- Geração de obrigações da competência a partir das recorrências
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
  if not public.is_staff() then
    raise exception 'Apenas a equipe pode gerar obrigações';
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

-- =============================================================
-- RLS
-- =============================================================
alter table public.obrigacoes             enable row level security;
alter table public.obrigacao_recorrencias enable row level security;

drop policy if exists obrigacoes_select on public.obrigacoes;
create policy obrigacoes_select on public.obrigacoes for select
  using (public.empresa_visivel(empresa_id));
drop policy if exists obrigacoes_staff_write on public.obrigacoes;
create policy obrigacoes_staff_write on public.obrigacoes for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists recorrencias_select on public.obrigacao_recorrencias;
create policy recorrencias_select on public.obrigacao_recorrencias for select
  using (public.is_staff());
drop policy if exists recorrencias_staff_write on public.obrigacao_recorrencias;
create policy recorrencias_staff_write on public.obrigacao_recorrencias for all
  using (public.is_staff()) with check (public.is_staff());
