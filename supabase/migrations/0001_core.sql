-- =============================================================
-- 0001_core.sql — Núcleo: perfis, config, catálogos, histórico
-- Sistema de gestão contábil
-- =============================================================

create extension if not exists "pgcrypto";

-- ---------- Enums de domínio ----------
do $$ begin
  create type papel as enum
    ('admin','fiscal','pessoal','contabil','societario','atendimento','cliente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type departamento as enum
    ('fiscal','pessoal','contabil','societario','ir','atendimento','geral');
exception when duplicate_object then null; end $$;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  nome         text not null default '',
  email        text not null default '',
  papel        papel not null default 'cliente',
  departamento departamento,
  telefone     text,
  ativo        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------- config do escritório (linha única) ----------
create table if not exists public.escritorio_config (
  id         smallint primary key default 1,
  nome       text not null default 'Escritório de Contabilidade',
  cnpj       text,
  telefone   text,
  email      text,
  endereco   text,
  logo_path  text,
  updated_at timestamptz not null default now(),
  constraint escritorio_config_singleton check (id = 1)
);
insert into public.escritorio_config (id) values (1) on conflict do nothing;

-- ---------- catálogos configuráveis ----------
create table if not exists public.catalogos (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null,
  valor      text not null,
  rotulo     text not null,
  ordem      int  not null default 0,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tipo, valor)
);

-- ---------- histórico / auditoria ----------
create table if not exists public.historico (
  id          uuid primary key default gen_random_uuid(),
  entidade    text not null,
  entidade_id uuid,
  acao        text not null,
  campo       text,
  de          text,
  para        text,
  descricao   text not null default '',
  autor_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists historico_entidade_idx
  on public.historico (entidade, entidade_id, created_at desc);

-- ---------- helpers de autorização ----------
create or replace function public.current_papel()
returns papel
language sql stable security definer set search_path = public as $$
  select papel from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select papel from public.profiles where id = auth.uid()) <> 'cliente'
    and (select ativo from public.profiles where id = auth.uid()),
    false)
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select papel from public.profiles where id = auth.uid()) = 'admin', false)
$$;

-- ---------- updated_at automático ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------- criação automática de profile ao criar auth user ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, email, papel, departamento)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'papel')::papel, 'cliente'),
    (new.raw_user_meta_data->>'departamento')::departamento
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- RLS
-- =============================================================
alter table public.profiles          enable row level security;
alter table public.escritorio_config enable row level security;
alter table public.catalogos         enable row level security;
alter table public.historico         enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- escritorio_config
drop policy if exists config_read on public.escritorio_config;
create policy config_read on public.escritorio_config for select
  using (auth.uid() is not null);
drop policy if exists config_admin on public.escritorio_config;
create policy config_admin on public.escritorio_config for all
  using (public.is_admin()) with check (public.is_admin());

-- catalogos
drop policy if exists catalogos_read on public.catalogos;
create policy catalogos_read on public.catalogos for select
  using (auth.uid() is not null);
drop policy if exists catalogos_admin on public.catalogos;
create policy catalogos_admin on public.catalogos for all
  using (public.is_admin()) with check (public.is_admin());

-- historico
drop policy if exists historico_read on public.historico;
create policy historico_read on public.historico for select
  using (public.is_staff());
drop policy if exists historico_insert on public.historico;
create policy historico_insert on public.historico for insert
  with check (public.is_staff());

-- ---------- catálogos iniciais ----------
insert into public.catalogos (tipo, valor, rotulo, ordem) values
  ('tipo_documento','nota_fiscal','Nota fiscal',1),
  ('tipo_documento','guia','Guia / DARF',2),
  ('tipo_documento','extrato','Extrato bancário',3),
  ('tipo_documento','holerite','Holerite',4),
  ('tipo_documento','contrato','Contrato',5),
  ('tipo_documento','balancete','Balancete',6),
  ('tipo_documento','relatorio','Relatório',7),
  ('tipo_documento','outro','Outro',99),
  ('tipo_tarefa','apuracao','Apuração de imposto',1),
  ('tipo_tarefa','folha','Folha de pagamento',2),
  ('tipo_tarefa','obrigacao_acessoria','Obrigação acessória',3),
  ('tipo_tarefa','fechamento','Fechamento contábil',4),
  ('tipo_tarefa','processo_societario','Processo societário',5),
  ('tipo_tarefa','atendimento','Atendimento ao cliente',6),
  ('tipo_tarefa','interna','Tarefa interna',7)
on conflict (tipo, valor) do nothing;
