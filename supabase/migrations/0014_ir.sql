-- =============================================================
-- 0014_ir.sql — Módulo Imposto de Renda (V2)
-- Campanhas de IRPF/IRPJ/ITR por exercício, com controle por
-- cliente (empresa) ou, no caso de IRPF, por sócio.
-- =============================================================

do $$ begin
  create type ir_tipo as enum ('irpf', 'irpj', 'itr');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ir_status as enum (
    'pendente','documentos_recebidos','em_elaboracao','entregue',
    'retificacao','dispensada'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.declaracoes_ir (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  -- só preenchido para IRPF: o sócio ao qual a declaração pertence.
  -- IRPJ/ITR são da empresa em si (socio_id nulo).
  socio_id          uuid references public.socios(id) on delete cascade,
  tipo              ir_tipo not null,
  ano_exercicio     int not null check (ano_exercicio between 2000 and 2100),
  status            ir_status not null default 'pendente',
  prazo             date,
  valor_a_pagar     numeric(14,2),
  valor_a_restituir numeric(14,2),
  recibo            text,
  responsavel_id    uuid references public.profiles(id) on delete set null,
  observacao        text,
  entregue_em       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists declaracoes_ir_empresa_idx on public.declaracoes_ir (empresa_id);
create index if not exists declaracoes_ir_ano_idx on public.declaracoes_ir (ano_exercicio, tipo);
create index if not exists declaracoes_ir_status_idx on public.declaracoes_ir (status);

-- unicidade: uma declaração de IRPJ/ITR por empresa/ano; uma de IRPF por
-- sócio/ano. Índice parcial porque socio_id nulo não colide entre si.
create unique index if not exists declaracoes_ir_pj_uk
  on public.declaracoes_ir (empresa_id, tipo, ano_exercicio)
  where socio_id is null;
create unique index if not exists declaracoes_ir_pf_uk
  on public.declaracoes_ir (socio_id, tipo, ano_exercicio)
  where socio_id is not null;

drop trigger if exists trg_declaracoes_ir_touch on public.declaracoes_ir;
create trigger trg_declaracoes_ir_touch before update on public.declaracoes_ir
  for each row execute function public.touch_updated_at();

-- entregue_em automático, desfazendo se o status voltar atrás
create or replace function public.declaracao_ir_marca_entrega()
returns trigger language plpgsql as $$
begin
  if new.status = 'entregue'
     and (old.status is null or old.status is distinct from 'entregue') then
    new.entregue_em = now();
  elsif new.status <> 'entregue' then
    new.entregue_em = null;
  end if;
  return new;
end $$;

drop trigger if exists trg_declaracao_ir_entrega on public.declaracoes_ir;
create trigger trg_declaracao_ir_entrega before insert or update on public.declaracoes_ir
  for each row execute function public.declaracao_ir_marca_entrega();

-- =============================================================
-- Geração em lote da campanha do ano
-- =============================================================
-- IRPJ/ITR: uma declaração por empresa ativa.
-- IRPF: uma declaração por sócio de empresa ativa.
-- Simplificação: não distingue empresa rural pra ITR nem regime pra
-- IRPJ — o escritório decide, na tela, quais completar de fato.
create or replace function public.gerar_declaracoes_ir(
  p_tipo ir_tipo, p_ano int, p_prazo date default null
)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  r record;
begin
  if not public.is_papel('admin', 'fiscal', 'contabil') then
    raise exception 'Apenas Fiscal/Contábil pode gerar declarações de IR';
  end if;

  if p_tipo = 'irpf' then
    for r in
      select s.id as socio_id, s.empresa_id
      from public.socios s
      join public.empresas e on e.id = s.empresa_id and e.ativo
    loop
      insert into public.declaracoes_ir (empresa_id, socio_id, tipo, ano_exercicio, prazo)
      values (r.empresa_id, r.socio_id, p_tipo, p_ano, p_prazo)
      on conflict (socio_id, tipo, ano_exercicio) where socio_id is not null do nothing;
      if found then v_count := v_count + 1; end if;
    end loop;
  else
    for r in select id from public.empresas where ativo loop
      insert into public.declaracoes_ir (empresa_id, socio_id, tipo, ano_exercicio, prazo)
      values (r.id, null, p_tipo, p_ano, p_prazo)
      on conflict (empresa_id, tipo, ano_exercicio) where socio_id is null do nothing;
      if found then v_count := v_count + 1; end if;
    end loop;
  end if;

  return v_count;
end $$;

-- =============================================================
-- RLS — Fiscal e Contábil compartilham este módulo
-- =============================================================
alter table public.declaracoes_ir enable row level security;

drop policy if exists declaracoes_ir_select on public.declaracoes_ir;
create policy declaracoes_ir_select on public.declaracoes_ir for select
  using (public.is_papel('admin', 'fiscal', 'contabil'));
drop policy if exists declaracoes_ir_write on public.declaracoes_ir;
create policy declaracoes_ir_write on public.declaracoes_ir for all
  using (public.is_papel('admin', 'fiscal', 'contabil'))
  with check (public.is_papel('admin', 'fiscal', 'contabil'));
