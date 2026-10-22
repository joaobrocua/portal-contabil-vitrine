-- =============================================================
-- 0013_societario.sql — Módulo Societário (V2)
-- Abertura, alteração contratual e encerramento de empresa, por
-- checklist de etapas junto à Junta Comercial / Receita Federal.
-- =============================================================

do $$ begin
  create type processo_societario_tipo as enum (
    'abertura','alteracao_contratual','encerramento','outro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type processo_societario_status as enum (
    'solicitado','em_andamento','aguardando_orgao','aguardando_cliente',
    'concluido','cancelado'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.processos_societarios (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  tipo           processo_societario_tipo not null,
  status         processo_societario_status not null default 'solicitado',
  descricao      text,
  protocolo      text,
  responsavel_id uuid references public.profiles(id) on delete set null,
  solicitado_por uuid references public.profiles(id) on delete set null,
  concluido_em   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists processos_societarios_empresa_idx
  on public.processos_societarios (empresa_id);
create index if not exists processos_societarios_status_idx
  on public.processos_societarios (status);

drop trigger if exists trg_processos_societarios_touch on public.processos_societarios;
create trigger trg_processos_societarios_touch before update on public.processos_societarios
  for each row execute function public.touch_updated_at();

-- concluido_em automático, desfazendo se o status voltar atrás
create or replace function public.processo_societario_marca_conclusao()
returns trigger language plpgsql as $$
begin
  if new.status = 'concluido'
     and (old.status is null or old.status is distinct from 'concluido') then
    new.concluido_em = now();
  elsif new.status <> 'concluido' then
    new.concluido_em = null;
  end if;
  return new;
end $$;

drop trigger if exists trg_processo_societario_conclusao on public.processos_societarios;
create trigger trg_processo_societario_conclusao before insert or update on public.processos_societarios
  for each row execute function public.processo_societario_marca_conclusao();

create table if not exists public.processo_societario_itens (
  id           uuid primary key default gen_random_uuid(),
  processo_id  uuid not null references public.processos_societarios(id) on delete cascade,
  descricao    text not null,
  feito        boolean not null default false,
  ordem        int not null default 0,
  feito_em     timestamptz,
  feito_por    uuid references public.profiles(id) on delete set null
);
create index if not exists processo_societario_itens_processo_idx
  on public.processo_societario_itens (processo_id);

-- =============================================================
-- RLS — restrita a admin + societário desde o início
-- =============================================================
alter table public.processos_societarios      enable row level security;
alter table public.processo_societario_itens  enable row level security;

drop policy if exists processos_societarios_select on public.processos_societarios;
create policy processos_societarios_select on public.processos_societarios for select
  using (public.is_papel('admin', 'societario'));
drop policy if exists processos_societarios_write on public.processos_societarios;
create policy processos_societarios_write on public.processos_societarios for all
  using (public.is_papel('admin', 'societario'))
  with check (public.is_papel('admin', 'societario'));

drop policy if exists processo_societario_itens_select on public.processo_societario_itens;
create policy processo_societario_itens_select on public.processo_societario_itens for select
  using (public.is_papel('admin', 'societario'));
drop policy if exists processo_societario_itens_write on public.processo_societario_itens;
create policy processo_societario_itens_write on public.processo_societario_itens for all
  using (public.is_papel('admin', 'societario'))
  with check (public.is_papel('admin', 'societario'));
