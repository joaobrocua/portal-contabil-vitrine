-- =============================================================
-- 0002_empresas.sql — Módulo Clientes & Empresas
-- =============================================================

do $$ begin
  create type regime_tributario as enum
    ('simples_nacional','lucro_presumido','lucro_real','mei','imune_isenta');
exception when duplicate_object then null; end $$;

do $$ begin
  create type situacao_empresa as enum
    ('ativa','suspensa','baixada','em_abertura','distrato');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_contato as enum
    ('socio','financeiro','rh','responsavel_legal','contador_interno','outro');
exception when duplicate_object then null; end $$;

-- ---------- empresas ----------
create table if not exists public.empresas (
  id                        uuid primary key default gen_random_uuid(),
  razao_social              text not null,
  nome_fantasia             text,
  cnpj                      text not null unique,
  inscricao_estadual        text,
  inscricao_municipal       text,
  cnae_principal            text,
  regime_tributario         regime_tributario not null default 'simples_nacional',
  situacao                  situacao_empresa  not null default 'ativa',
  data_abertura             date,
  email                     text,
  telefone                  text,
  cep                       text,
  logradouro                text,
  numero                    text,
  complemento               text,
  bairro                    text,
  municipio                 text,
  uf                        text,
  responsavel_id            uuid references public.profiles(id) on delete set null,
  departamentos_responsaveis departamento[] not null default '{}',
  honorario_mensal          numeric(12,2),
  observacoes               text,
  ativo                     boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint empresas_cnpj_len check (char_length(cnpj) = 14)
);
create index if not exists empresas_razao_idx on public.empresas (razao_social);
create index if not exists empresas_ativo_idx on public.empresas (ativo);

drop trigger if exists trg_empresas_touch on public.empresas;
create trigger trg_empresas_touch before update on public.empresas
  for each row execute function public.touch_updated_at();

-- ---------- sócios ----------
create table if not exists public.socios (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  nome          text not null,
  cpf           text not null,
  participacao  numeric(5,2),
  administrador boolean not null default false,
  created_at    timestamptz not null default now(),
  constraint socios_cpf_len check (char_length(cpf) = 11)
);
create index if not exists socios_empresa_idx on public.socios (empresa_id);

-- ---------- contatos ----------
create table if not exists public.contatos (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  nome                text not null,
  cpf                 text,
  telefone            text,
  email               text,
  cargo               text,
  tipo                tipo_contato not null default 'outro',
  recebe_comunicacoes boolean not null default true,
  profile_id          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists contatos_empresa_idx on public.contatos (empresa_id);
create index if not exists contatos_profile_idx on public.contatos (profile_id);

-- ---------- helper: empresa visível para o usuário atual ----------
create or replace function public.empresa_visivel(p_empresa uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff()
    or exists (
      select 1 from public.contatos c
      where c.empresa_id = p_empresa and c.profile_id = auth.uid()
    )
$$;

-- =============================================================
-- RLS
-- =============================================================
alter table public.empresas enable row level security;
alter table public.socios   enable row level security;
alter table public.contatos enable row level security;

-- empresas
drop policy if exists empresas_select on public.empresas;
create policy empresas_select on public.empresas for select
  using (public.empresa_visivel(id));
drop policy if exists empresas_staff_write on public.empresas;
create policy empresas_staff_write on public.empresas for all
  using (public.is_staff()) with check (public.is_staff());

-- socios
drop policy if exists socios_select on public.socios;
create policy socios_select on public.socios for select
  using (public.empresa_visivel(empresa_id));
drop policy if exists socios_staff_write on public.socios;
create policy socios_staff_write on public.socios for all
  using (public.is_staff()) with check (public.is_staff());

-- contatos
drop policy if exists contatos_select on public.contatos;
create policy contatos_select on public.contatos for select
  using (public.empresa_visivel(empresa_id));
drop policy if exists contatos_staff_write on public.contatos;
create policy contatos_staff_write on public.contatos for all
  using (public.is_staff()) with check (public.is_staff());
