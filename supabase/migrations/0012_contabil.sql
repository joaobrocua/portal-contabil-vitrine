-- =============================================================
-- 0012_contabil.sql — Módulo Contábil (V2)
-- Fechamento por empresa × competência: conciliação, escrituração,
-- balancete, DRE, entrega ao cliente.
-- =============================================================

do $$ begin
  create type fechamento_status as enum (
    'aberto','em_andamento','revisao','fechado','entregue'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.fechamentos_contabeis (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  competencia    date not null,
  status         fechamento_status not null default 'aberto',
  responsavel_id uuid references public.profiles(id) on delete set null,
  observacao     text,
  fechado_em     timestamptz,
  entregue_em    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint fechamentos_competencia_dia1
    check (extract(day from competencia) = 1),
  unique (empresa_id, competencia)
);
create index if not exists fechamentos_competencia_idx
  on public.fechamentos_contabeis (competencia);
create index if not exists fechamentos_empresa_idx
  on public.fechamentos_contabeis (empresa_id);
create index if not exists fechamentos_status_idx
  on public.fechamentos_contabeis (status);

drop trigger if exists trg_fechamentos_touch on public.fechamentos_contabeis;
create trigger trg_fechamentos_touch before update on public.fechamentos_contabeis
  for each row execute function public.touch_updated_at();

-- fechado_em / entregue_em automáticos, desfazendo se o status voltar atrás
create or replace function public.fechamento_marca_datas()
returns trigger language plpgsql as $$
begin
  if new.status in ('fechado', 'entregue')
     and (old.status is null or old.status not in ('fechado', 'entregue'))
     and new.fechado_em is null then
    new.fechado_em = now();
  elsif new.status not in ('fechado', 'entregue') then
    new.fechado_em = null;
  end if;

  if new.status = 'entregue'
     and (old.status is null or old.status is distinct from 'entregue') then
    new.entregue_em = now();
  elsif new.status <> 'entregue' then
    new.entregue_em = null;
  end if;

  return new;
end $$;

drop trigger if exists trg_fechamento_datas on public.fechamentos_contabeis;
create trigger trg_fechamento_datas before insert or update on public.fechamentos_contabeis
  for each row execute function public.fechamento_marca_datas();

create table if not exists public.fechamento_itens (
  id             uuid primary key default gen_random_uuid(),
  fechamento_id  uuid not null references public.fechamentos_contabeis(id) on delete cascade,
  descricao      text not null,
  feito          boolean not null default false,
  ordem          int not null default 0,
  feito_em       timestamptz,
  feito_por      uuid references public.profiles(id) on delete set null
);
create index if not exists fechamento_itens_fechamento_idx
  on public.fechamento_itens (fechamento_id);

-- =============================================================
-- Abertura em lote do fechamento da competência
-- =============================================================
-- Não abre para MEI — regime não exige escrituração contábil formal.
create or replace function public.abrir_fechamentos(p_competencia date)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  v_id uuid;
  r record;
begin
  if not public.is_papel('admin', 'contabil') then
    raise exception 'Apenas o departamento contábil pode abrir fechamentos';
  end if;

  for r in
    select id from public.empresas
    where ativo and regime_tributario <> 'mei'
  loop
    v_id := null;
    insert into public.fechamentos_contabeis (empresa_id, competencia, status)
    values (r.id, date_trunc('month', p_competencia)::date, 'aberto')
    on conflict (empresa_id, competencia) do nothing
    returning id into v_id;

    if v_id is not null then
      insert into public.fechamento_itens (fechamento_id, descricao, ordem) values
        (v_id, 'Lançamentos contábeis', 1),
        (v_id, 'Conciliação bancária', 2),
        (v_id, 'Apuração de resultado', 3),
        (v_id, 'Balancete gerado', 4),
        (v_id, 'DRE gerado', 5),
        (v_id, 'Fechamento entregue ao cliente', 6);
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end $$;

-- =============================================================
-- RLS — restrita a admin + contábil desde o início (sem is_staff())
-- =============================================================
alter table public.fechamentos_contabeis enable row level security;
alter table public.fechamento_itens      enable row level security;

drop policy if exists fechamentos_select on public.fechamentos_contabeis;
create policy fechamentos_select on public.fechamentos_contabeis for select
  using (public.is_papel('admin', 'contabil'));
drop policy if exists fechamentos_write on public.fechamentos_contabeis;
create policy fechamentos_write on public.fechamentos_contabeis for all
  using (public.is_papel('admin', 'contabil'))
  with check (public.is_papel('admin', 'contabil'));

drop policy if exists fechamento_itens_select on public.fechamento_itens;
create policy fechamento_itens_select on public.fechamento_itens for select
  using (public.is_papel('admin', 'contabil'));
drop policy if exists fechamento_itens_write on public.fechamento_itens;
create policy fechamento_itens_write on public.fechamento_itens for all
  using (public.is_papel('admin', 'contabil'))
  with check (public.is_papel('admin', 'contabil'));
