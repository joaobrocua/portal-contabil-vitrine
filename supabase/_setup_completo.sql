-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0001_core.sql <<<<<<<<<<<<<<<<<<<<
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


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0002_empresas.sql <<<<<<<<<<<<<<<<<<<<
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


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0003_tarefas.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0003_tarefas.sql — Módulo Tarefas & Processos (motor central)
-- =============================================================

do $$ begin
  create type tarefa_status as enum
    ('nao_iniciada','em_andamento','aguardando_cliente','em_revisao',
     'concluida','atrasada','cancelada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prioridade as enum ('baixa','normal','alta','urgente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tarefa_origem as enum
    ('manual','recorrente','obrigacao','solicitacao','processo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recorrencia as enum ('nenhuma','mensal','trimestral','anual');
exception when duplicate_object then null; end $$;

-- ---------- templates de tarefa ----------
create table if not exists public.tarefa_templates (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  departamento  departamento not null default 'geral',
  titulo_padrao text not null,
  descricao     text,
  itens_padrao  jsonb not null default '[]'::jsonb,
  recorrencia   recorrencia not null default 'nenhuma',
  dia_prazo     int,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------- tarefas ----------
create table if not exists public.tarefas (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  descricao     text,
  empresa_id    uuid references public.empresas(id) on delete set null,
  departamento  departamento not null default 'geral',
  responsavel_id uuid references public.profiles(id) on delete set null,
  criado_por    uuid references public.profiles(id) on delete set null,
  competencia   date,
  prazo         date,
  status        tarefa_status not null default 'nao_iniciada',
  prioridade    prioridade not null default 'normal',
  origem        tarefa_origem not null default 'manual',
  template_id   uuid references public.tarefa_templates(id) on delete set null,
  concluida_em  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint tarefas_competencia_dia1
    check (competencia is null or extract(day from competencia) = 1)
);
create index if not exists tarefas_status_idx      on public.tarefas (status);
create index if not exists tarefas_empresa_idx     on public.tarefas (empresa_id);
create index if not exists tarefas_responsavel_idx on public.tarefas (responsavel_id);
create index if not exists tarefas_prazo_idx       on public.tarefas (prazo);
create index if not exists tarefas_departamento_idx on public.tarefas (departamento);

drop trigger if exists trg_tarefas_touch on public.tarefas;
create trigger trg_tarefas_touch before update on public.tarefas
  for each row execute function public.touch_updated_at();

-- marca concluida_em quando entra em 'concluida'
create or replace function public.tarefa_marca_conclusao()
returns trigger language plpgsql as $$
begin
  if new.status = 'concluida'
     and (old.status is null or old.status is distinct from 'concluida') then
    new.concluida_em = now();
  elsif new.status <> 'concluida' then
    new.concluida_em = null;
  end if;
  return new;
end $$;

drop trigger if exists trg_tarefa_conclusao on public.tarefas;
create trigger trg_tarefa_conclusao before insert or update on public.tarefas
  for each row execute function public.tarefa_marca_conclusao();

-- ---------- itens / checklist ----------
create table if not exists public.tarefa_itens (
  id         uuid primary key default gen_random_uuid(),
  tarefa_id  uuid not null references public.tarefas(id) on delete cascade,
  descricao  text not null,
  feito      boolean not null default false,
  ordem      int not null default 0,
  feito_em   timestamptz,
  feito_por  uuid references public.profiles(id) on delete set null
);
create index if not exists tarefa_itens_tarefa_idx on public.tarefa_itens (tarefa_id, ordem);

-- ---------- vínculo tarefa <-> documento ----------
create table if not exists public.tarefa_documentos (
  tarefa_id    uuid not null references public.tarefas(id) on delete cascade,
  documento_id uuid not null,
  created_at   timestamptz not null default now(),
  primary key (tarefa_id, documento_id)
);

-- =============================================================
-- RLS
-- =============================================================
alter table public.tarefas          enable row level security;
alter table public.tarefa_itens     enable row level security;
alter table public.tarefa_documentos enable row level security;
alter table public.tarefa_templates enable row level security;

-- tarefas: staff total; cliente lê as da própria empresa
drop policy if exists tarefas_select on public.tarefas;
create policy tarefas_select on public.tarefas for select
  using (
    public.is_staff()
    or (empresa_id is not null and public.empresa_visivel(empresa_id))
  );
drop policy if exists tarefas_staff_write on public.tarefas;
create policy tarefas_staff_write on public.tarefas for all
  using (public.is_staff()) with check (public.is_staff());

-- itens seguem a tarefa
drop policy if exists tarefa_itens_select on public.tarefa_itens;
create policy tarefa_itens_select on public.tarefa_itens for select
  using (exists (
    select 1 from public.tarefas t
    where t.id = tarefa_id
      and (public.is_staff() or (t.empresa_id is not null and public.empresa_visivel(t.empresa_id)))
  ));
drop policy if exists tarefa_itens_staff_write on public.tarefa_itens;
create policy tarefa_itens_staff_write on public.tarefa_itens for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists tarefa_docs_select on public.tarefa_documentos;
create policy tarefa_docs_select on public.tarefa_documentos for select
  using (public.is_staff() or exists (
    select 1 from public.tarefas t
    where t.id = tarefa_id and t.empresa_id is not null
      and public.empresa_visivel(t.empresa_id)
  ));
drop policy if exists tarefa_docs_staff_write on public.tarefa_documentos;
create policy tarefa_docs_staff_write on public.tarefa_documentos for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists templates_read on public.tarefa_templates;
create policy templates_read on public.tarefa_templates for select
  using (public.is_staff());
drop policy if exists templates_admin on public.tarefa_templates;
create policy templates_admin on public.tarefa_templates for all
  using (public.is_admin()) with check (public.is_admin());


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0004_documentos.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0004_documentos.sql — Módulo Central de Documentos
-- =============================================================

do $$ begin
  create type documento_origem as enum ('cliente','escritorio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type documento_status as enum
    ('pendente','recebido','aprovado','rejeitado','correcao');
exception when duplicate_object then null; end $$;

create table if not exists public.documentos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  departamento  departamento not null default 'geral',
  categoria     text not null default 'outro',
  competencia   date,
  titulo        text not null,
  descricao     text,
  storage_path  text not null,
  tamanho_bytes bigint,
  mime          text,
  origem        documento_origem not null default 'escritorio',
  status        documento_status not null default 'recebido',
  enviado_por   uuid references public.profiles(id) on delete set null,
  revisado_por  uuid references public.profiles(id) on delete set null,
  revisado_em   timestamptz,
  observacao    text,
  created_at    timestamptz not null default now()
);
create index if not exists documentos_empresa_idx on public.documentos (empresa_id);
create index if not exists documentos_dep_idx on public.documentos (empresa_id, departamento);
create index if not exists documentos_comp_idx on public.documentos (competencia);

-- trilha de acesso (LGPD)
create table if not exists public.documento_acessos (
  id           uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos(id) on delete cascade,
  profile_id   uuid references public.profiles(id) on delete set null,
  acao         text not null check (acao in ('upload','download','visualizou','excluiu')),
  created_at   timestamptz not null default now()
);
create index if not exists doc_acessos_doc_idx on public.documento_acessos (documento_id, created_at desc);

-- =============================================================
-- RLS
-- =============================================================
alter table public.documentos        enable row level security;
alter table public.documento_acessos enable row level security;

drop policy if exists documentos_select on public.documentos;
create policy documentos_select on public.documentos for select
  using (public.empresa_visivel(empresa_id));

-- staff: tudo
drop policy if exists documentos_staff_write on public.documentos;
create policy documentos_staff_write on public.documentos for all
  using (public.is_staff()) with check (public.is_staff());

-- cliente: pode enviar documentos da própria empresa (origem cliente)
drop policy if exists documentos_cliente_insert on public.documentos;
create policy documentos_cliente_insert on public.documentos for insert
  with check (
    origem = 'cliente'
    and public.empresa_visivel(empresa_id)
    and enviado_por = auth.uid()
  );

drop policy if exists doc_acessos_select on public.documento_acessos;
create policy doc_acessos_select on public.documento_acessos for select
  using (public.is_staff());
drop policy if exists doc_acessos_insert on public.documento_acessos;
create policy doc_acessos_insert on public.documento_acessos for insert
  with check (auth.uid() is not null);

-- =============================================================
-- Storage: bucket privado 'documentos'
-- =============================================================
insert into storage.buckets (id, name, public)
values ('documentos','documentos', false)
on conflict (id) do nothing;

-- Caminho dos arquivos: documentos/<empresa_id>/<arquivo>
drop policy if exists "documentos storage read" on storage.objects;
create policy "documentos storage read" on storage.objects for select
  using (
    bucket_id = 'documentos'
    and public.empresa_visivel((split_part(name, '/', 1))::uuid)
  );

drop policy if exists "documentos storage staff write" on storage.objects;
create policy "documentos storage staff write" on storage.objects for all
  using (bucket_id = 'documentos' and public.is_staff())
  with check (bucket_id = 'documentos' and public.is_staff());

drop policy if exists "documentos storage cliente upload" on storage.objects;
create policy "documentos storage cliente upload" on storage.objects for insert
  with check (
    bucket_id = 'documentos'
    and public.empresa_visivel((split_part(name, '/', 1))::uuid)
  );


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0005_agenda.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0005_agenda.sql — Módulo Agenda & Prazos
-- =============================================================

do $$ begin
  create type evento_tipo as enum
    ('prazo','reuniao','lembrete','obrigacao','outro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type evento_origem as enum ('manual','tarefa','obrigacao');
exception when duplicate_object then null; end $$;

create table if not exists public.eventos_agenda (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  descricao     text,
  data          date not null,
  hora          time,
  tipo          evento_tipo not null default 'lembrete',
  departamento  departamento,
  empresa_id    uuid references public.empresas(id) on delete cascade,
  responsavel_id uuid references public.profiles(id) on delete set null,
  origem        evento_origem not null default 'manual',
  ref_id        uuid,
  concluido     boolean not null default false,
  criado_por    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists eventos_data_idx on public.eventos_agenda (data);
create index if not exists eventos_dep_idx  on public.eventos_agenda (departamento);

alter table public.eventos_agenda enable row level security;

drop policy if exists eventos_select on public.eventos_agenda;
create policy eventos_select on public.eventos_agenda for select
  using (
    public.is_staff()
    or (empresa_id is not null and public.empresa_visivel(empresa_id))
  );
drop policy if exists eventos_staff_write on public.eventos_agenda;
create policy eventos_staff_write on public.eventos_agenda for all
  using (public.is_staff()) with check (public.is_staff());


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0006_fiscal.sql <<<<<<<<<<<<<<<<<<<<
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


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0007_pessoal.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0007_pessoal.sql — Módulo Departamento Pessoal (V2)
-- Funcionários, processos (admissão/demissão/férias/...) e controle de folha
-- =============================================================

do $$ begin
  create type tipo_contrato as enum
    ('clt','estagio','aprendiz','temporario','domestico');
exception when duplicate_object then null; end $$;

do $$ begin
  create type funcionario_status as enum
    ('ativo','afastado','ferias','desligado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type evento_dp_tipo as enum (
    'admissao','demissao','ferias','retorno_ferias',
    'afastamento','retorno_afastamento','decimo_terceiro',
    'rescisao','alteracao_salarial','outro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type evento_dp_status as enum
    ('solicitado','em_andamento','aguardando_cliente','concluido','cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type folha_status as enum
    ('aberta','em_processamento','revisao','fechada','transmitida');
exception when duplicate_object then null; end $$;

-- ---------- funcionários ----------
create table if not exists public.funcionarios (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  nome           text not null,
  cpf            text,
  cargo          text,
  tipo_contrato  tipo_contrato not null default 'clt',
  data_admissao  date,
  data_demissao  date,
  salario        numeric(12,2),
  status         funcionario_status not null default 'ativo',
  observacoes    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint funcionarios_cpf_len check (cpf is null or char_length(cpf) = 11)
);
create index if not exists funcionarios_empresa_idx on public.funcionarios (empresa_id);
create index if not exists funcionarios_status_idx on public.funcionarios (status);

drop trigger if exists trg_funcionarios_touch on public.funcionarios;
create trigger trg_funcionarios_touch before update on public.funcionarios
  for each row execute function public.touch_updated_at();

-- ---------- processos de DP (admissão, demissão, férias...) ----------
create table if not exists public.eventos_dp (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  funcionario_id  uuid references public.funcionarios(id) on delete set null,
  tipo            evento_dp_tipo not null,
  competencia     date,
  data_referencia date,
  status          evento_dp_status not null default 'solicitado',
  detalhe         text,
  responsavel_id  uuid references public.profiles(id) on delete set null,
  solicitado_por  uuid references public.profiles(id) on delete set null,
  concluido_em    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint eventos_dp_competencia_dia1
    check (competencia is null or extract(day from competencia) = 1)
);
create index if not exists eventos_dp_empresa_idx on public.eventos_dp (empresa_id);
create index if not exists eventos_dp_funcionario_idx on public.eventos_dp (funcionario_id);
create index if not exists eventos_dp_status_idx on public.eventos_dp (status);

drop trigger if exists trg_eventos_dp_touch on public.eventos_dp;
create trigger trg_eventos_dp_touch before update on public.eventos_dp
  for each row execute function public.touch_updated_at();

create or replace function public.evento_dp_marca_conclusao()
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

drop trigger if exists trg_evento_dp_conclusao on public.eventos_dp;
create trigger trg_evento_dp_conclusao before insert or update on public.eventos_dp
  for each row execute function public.evento_dp_marca_conclusao();

-- checklist do processo
create table if not exists public.evento_dp_itens (
  id         uuid primary key default gen_random_uuid(),
  evento_id  uuid not null references public.eventos_dp(id) on delete cascade,
  descricao  text not null,
  feito      boolean not null default false,
  ordem      int not null default 0,
  feito_em   timestamptz,
  feito_por  uuid references public.profiles(id) on delete set null
);
create index if not exists evento_dp_itens_evento_idx
  on public.evento_dp_itens (evento_id, ordem);

-- ---------- controle de folha ----------
create table if not exists public.folhas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  competencia     date not null,
  status          folha_status not null default 'aberta',
  qtd_funcionarios int,
  observacao      text,
  fechada_em      timestamptz,
  fechada_por     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint folhas_competencia_dia1 check (extract(day from competencia) = 1),
  unique (empresa_id, competencia)
);
create index if not exists folhas_competencia_idx on public.folhas (competencia);

drop trigger if exists trg_folhas_touch on public.folhas;
create trigger trg_folhas_touch before update on public.folhas
  for each row execute function public.touch_updated_at();

create or replace function public.folha_marca_fechamento()
returns trigger language plpgsql as $$
begin
  if new.status in ('fechada','transmitida')
     and (old.status is null or old.status not in ('fechada','transmitida'))
     and new.fechada_em is null then
    new.fechada_em = now();
  end if;
  return new;
end $$;

drop trigger if exists trg_folha_fechamento on public.folhas;
create trigger trg_folha_fechamento before insert or update on public.folhas
  for each row execute function public.folha_marca_fechamento();

-- ---------- abrir folhas da competência para todas as empresas ativas ----------
create or replace function public.abrir_folhas(p_competencia date)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  r record;
  v_qtd int;
begin
  if not public.is_staff() then
    raise exception 'Apenas a equipe pode abrir folhas';
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

-- =============================================================
-- RLS
-- =============================================================
alter table public.funcionarios     enable row level security;
alter table public.eventos_dp       enable row level security;
alter table public.evento_dp_itens  enable row level security;
alter table public.folhas           enable row level security;

drop policy if exists funcionarios_select on public.funcionarios;
create policy funcionarios_select on public.funcionarios for select
  using (public.empresa_visivel(empresa_id));
drop policy if exists funcionarios_staff_write on public.funcionarios;
create policy funcionarios_staff_write on public.funcionarios for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists eventos_dp_select on public.eventos_dp;
create policy eventos_dp_select on public.eventos_dp for select
  using (public.empresa_visivel(empresa_id));
drop policy if exists eventos_dp_staff_write on public.eventos_dp;
create policy eventos_dp_staff_write on public.eventos_dp for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists evento_dp_itens_select on public.evento_dp_itens;
create policy evento_dp_itens_select on public.evento_dp_itens for select
  using (exists (
    select 1 from public.eventos_dp e
    where e.id = evento_id and public.empresa_visivel(e.empresa_id)
  ));
drop policy if exists evento_dp_itens_staff_write on public.evento_dp_itens;
create policy evento_dp_itens_staff_write on public.evento_dp_itens for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists folhas_select on public.folhas;
create policy folhas_select on public.folhas for select
  using (public.empresa_visivel(empresa_id));
drop policy if exists folhas_staff_write on public.folhas;
create policy folhas_staff_write on public.folhas for all
  using (public.is_staff()) with check (public.is_staff());

-- ---------- catálogo: checklists padrão por tipo de processo ----------
insert into public.catalogos (tipo, valor, rotulo, ordem) values
  ('evento_dp_checklist_admissao', 'documentos', 'Documentos recebidos', 1),
  ('evento_dp_checklist_admissao', 'cadastro', 'Cadastro realizado', 2),
  ('evento_dp_checklist_admissao', 'contrato', 'Contrato gerado', 3),
  ('evento_dp_checklist_admissao', 'assinatura', 'Assinaturas coletadas', 4),
  ('evento_dp_checklist_admissao', 'esocial', 'Envio ao eSocial', 5),
  ('evento_dp_checklist_admissao', 'concluido', 'Processo concluído', 6),
  ('evento_dp_checklist_demissao', 'aviso', 'Aviso prévio / comunicado', 1),
  ('evento_dp_checklist_demissao', 'calculo', 'Cálculo da rescisão', 2),
  ('evento_dp_checklist_demissao', 'homologacao', 'Homologação / assinatura', 3),
  ('evento_dp_checklist_demissao', 'esocial', 'Envio ao eSocial', 4),
  ('evento_dp_checklist_demissao', 'pagamento', 'Pagamento das verbas', 5)
on conflict (tipo, valor) do nothing;


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0008_fix_pessoal_rls.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0008_fix_pessoal_rls.sql — Corrige exposição de dados de RH
-- =============================================================
-- As policies de select criadas em 0007_pessoal.sql usavam
-- empresa_visivel(), a mesma função que libera dados para o
-- papel "cliente". Isso permitia que um contato-cliente lesse,
-- via API, CPF e salário dos funcionários da própria empresa —
-- dado que nenhuma tela do portal expõe, mas que a RLS não
-- bloqueava. Restringe a leitura de funcionarios/eventos_dp/
-- evento_dp_itens/folhas à equipe interna (is_staff()).

drop policy if exists funcionarios_select on public.funcionarios;
create policy funcionarios_select on public.funcionarios for select
  using (public.is_staff());

drop policy if exists eventos_dp_select on public.eventos_dp;
create policy eventos_dp_select on public.eventos_dp for select
  using (public.is_staff());

drop policy if exists evento_dp_itens_select on public.evento_dp_itens;
create policy evento_dp_itens_select on public.evento_dp_itens for select
  using (public.is_staff());

drop policy if exists folhas_select on public.folhas;
create policy folhas_select on public.folhas for select
  using (public.is_staff());


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0009_rls_departamento.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0009_rls_departamento.sql — Segrega Fiscal e Pessoal por papel
-- =============================================================
-- Hoje, se a conta de um colaborador de QUALQUER departamento for
-- comprometida, o invasor consegue ler e até escrever em dados de
-- Pessoal (CPF, salário) e Fiscal via chamada direta à API — porque
-- as policies usavam is_staff(), que não diferencia entre papéis
-- internos. Isso é mais permissivo do que as próprias telas do
-- portal, que já restringem essas rotas a admin + o papel do
-- departamento (ver requireRole("admin","pessoal") /
-- requireRole("admin","fiscal") nas actions/páginas).
--
-- Esta migration alinha a RLS ao que a aplicação já assume:
-- só admin e o papel do próprio departamento acessam os dados
-- daquele departamento. `obrigacoes_select` continua liberado
-- também para o cliente da empresa (empresa_visivel) — isso é
-- proposital, é a única dessas tabelas com uma tela pensada para
-- o cliente acompanhar suas obrigações.

create or replace function public.is_papel(variadic p_papeis papel[])
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select papel from public.profiles where id = auth.uid()) = any(p_papeis),
    false)
$$;

-- ---------- pessoal: leitura e escrita restritas a admin + pessoal ----------
drop policy if exists funcionarios_select on public.funcionarios;
create policy funcionarios_select on public.funcionarios for select
  using (public.is_papel('admin', 'pessoal'));
drop policy if exists funcionarios_staff_write on public.funcionarios;
create policy funcionarios_staff_write on public.funcionarios for all
  using (public.is_papel('admin', 'pessoal'))
  with check (public.is_papel('admin', 'pessoal'));

drop policy if exists eventos_dp_select on public.eventos_dp;
create policy eventos_dp_select on public.eventos_dp for select
  using (public.is_papel('admin', 'pessoal'));
drop policy if exists eventos_dp_staff_write on public.eventos_dp;
create policy eventos_dp_staff_write on public.eventos_dp for all
  using (public.is_papel('admin', 'pessoal'))
  with check (public.is_papel('admin', 'pessoal'));

drop policy if exists evento_dp_itens_select on public.evento_dp_itens;
create policy evento_dp_itens_select on public.evento_dp_itens for select
  using (public.is_papel('admin', 'pessoal'));
drop policy if exists evento_dp_itens_staff_write on public.evento_dp_itens;
create policy evento_dp_itens_staff_write on public.evento_dp_itens for all
  using (public.is_papel('admin', 'pessoal'))
  with check (public.is_papel('admin', 'pessoal'));

drop policy if exists folhas_select on public.folhas;
create policy folhas_select on public.folhas for select
  using (public.is_papel('admin', 'pessoal'));
drop policy if exists folhas_staff_write on public.folhas;
create policy folhas_staff_write on public.folhas for all
  using (public.is_papel('admin', 'pessoal'))
  with check (public.is_papel('admin', 'pessoal'));

-- ---------- fiscal: escrita restrita a admin + fiscal ----------
-- (leitura de obrigações continua liberada pro cliente da empresa)
drop policy if exists obrigacoes_staff_write on public.obrigacoes;
create policy obrigacoes_staff_write on public.obrigacoes for all
  using (public.is_papel('admin', 'fiscal'))
  with check (public.is_papel('admin', 'fiscal'));

drop policy if exists recorrencias_select on public.obrigacao_recorrencias;
create policy recorrencias_select on public.obrigacao_recorrencias for select
  using (public.is_papel('admin', 'fiscal'));
drop policy if exists recorrencias_staff_write on public.obrigacao_recorrencias;
create policy recorrencias_staff_write on public.obrigacao_recorrencias for all
  using (public.is_papel('admin', 'fiscal'))
  with check (public.is_papel('admin', 'fiscal'));


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0010_upload_seguro.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0010_upload_seguro.sql — Restringe tipo e tamanho no bucket
-- =============================================================
-- Antes, o bucket 'documentos' aceitava qualquer arquivo de
-- qualquer tamanho — a validação de 25 MB e de tipo existia só
-- no formulário do navegador, então dava pra contornar chamando
-- a API de Storage direto. Agora o próprio bucket rejeita, no
-- servidor, qualquer upload fora da lista de tipos ou acima do
-- limite — a mesma lista usada em MIME_PERMITIDOS
-- (src/modules/documentos/schema.ts).

update storage.buckets
set file_size_limit = 26214400, -- 25 MB
    allowed_mime_types = array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/xml',
      'text/xml'
    ]
where id = 'documentos';


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0011_paginacao.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0011_paginacao.sql — Agregação de documentos no banco
-- =============================================================
-- empresasComDocumentos() buscava a tabela 'documentos' inteira
-- (todas as empresas, toda a história) só para somar total e
-- pendentes por empresa em JavaScript. Essa é a consulta que mais
-- cresce no sistema — cada nota, guia, holerite e contrato
-- enviado é uma linha. Substituído por uma view agregada, que o
-- Postgres já resolve com um group by (index scan), sem trazer os
-- documentos em si pela rede.
--
-- security_invoker garante que a view respeita a RLS de
-- 'documentos' como o usuário que consulta, não como quem criou
-- a view — sem isso, um select na view furaria a RLS.

create or replace view public.documentos_contagem_por_empresa
with (security_invoker = true) as
select
  empresa_id,
  count(*)::int as total,
  count(*) filter (where status in ('pendente', 'correcao'))::int as pendentes
from public.documentos
group by empresa_id;

grant select on public.documentos_contagem_por_empresa to authenticated;


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0012_contabil.sql <<<<<<<<<<<<<<<<<<<<
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


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0013_societario.sql <<<<<<<<<<<<<<<<<<<<
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


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0014_ir.sql <<<<<<<<<<<<<<<<<<<<
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


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0015_rate_limit.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0015_rate_limit.sql — Registro de eventos p/ limite de tentativas
-- =============================================================
-- Tabela genérica de contagem, usada pra bloquear força-bruta de
-- login e conter uso anormal de ações administrativas sensíveis.
-- Não é dado de negócio nem precisa ser lido pela aplicação — RLS
-- fica ativa sem nenhuma policy, então só a service role (usada
-- só no servidor, nunca no navegador) consegue ler ou escrever.

create table if not exists public.eventos_seguranca (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null,
  chave      text not null,
  ip         text,
  sucesso    boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists eventos_seguranca_tipo_chave_idx
  on public.eventos_seguranca (tipo, chave, created_at desc);
create index if not exists eventos_seguranca_tipo_ip_idx
  on public.eventos_seguranca (tipo, ip, created_at desc)
  where ip is not null;

alter table public.eventos_seguranca enable row level security;
-- (sem policies de propósito — bloqueia anon/authenticated por completo)



-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0016_fix_profiles_self_escalation.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0016_fix_profiles_self_escalation.sql
-- Corrige escalonamento de privilégio: a policy `profiles_self_update`
-- (0001_core.sql) só restringe QUAL linha pode ser alterada
-- (id = auth.uid()), não QUAIS colunas — RLS no Postgres é por linha,
-- não por coluna. Isso permitia qualquer usuário autenticado, incluindo
-- papel 'cliente', promover a si mesmo a 'admin' direto pelo client
-- (supabase.from('profiles').update({ papel: 'admin' })...), já que
-- essa policy é permissiva e é OR-combinada com `profiles_admin_write`.
--
-- Trigger, não policy, porque RLS não faz checagem por coluna.
-- =============================================================

create or replace function public.protect_profile_privilege_columns()
returns trigger
language plpgsql
set search_path = public as $$
begin
  -- auth.uid() nulo = sessão sem JWT de usuário (service_role da API
  -- admin, ou conexão direta via psql/Studio para bootstrap do primeiro
  -- admin) — não passa pela RLS mesmo, então não há o que proteger aqui.
  -- auth.uid() presente + is_admin() = admin de verdade alterando
  -- (o próprio ou outro usuário) via profiles_admin_write — permitido.
  -- Só bloqueia quando é um usuário autenticado não-admin tentando
  -- mudar as próprias colunas privilegiadas via profiles_self_update.
  if auth.uid() is not null and not public.is_admin() then
    if new.papel is distinct from old.papel
       or new.ativo is distinct from old.ativo
       or new.departamento is distinct from old.departamento
    then
      raise exception
        'Apenas administradores podem alterar papel, ativo ou departamento.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_privilege on public.profiles;
create trigger trg_profiles_protect_privilege
  before update on public.profiles
  for each row
  execute function public.protect_profile_privilege_columns();

-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0017_fix_medium_findings.sql <<<<<<<<<<<<<<<<<<<<
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

-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0018_fix_abrir_folhas_bug.sql <<<<<<<<<<<<<<<<<<<<
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

-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0019_fix_abrir_folhas_contador.sql <<<<<<<<<<<<<<<<<<<<
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

-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0020_fix_signup_e_usuario_inativo.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0020_fix_signup_e_usuario_inativo.sql
--
-- 1) handle_new_user copiava `papel`/`departamento` de raw_user_meta_data
--    — dado controlado por quem se cadastra. Com o cadastro público do
--    GoTrue aberto, qualquer pessoa fazia signup com
--    data: { papel: "admin" } e virava admin. Agora todo usuário novo nasce
--    como 'cliente' sem departamento; o papel real é gravado depois pela
--    action criarUsuario (service role) ou por um admin.
--
-- 2) is_admin()/is_papel() e o ramo "cliente" de empresa_visivel() não
--    olhavam `ativo`. Um usuário desativado seguia com acesso via API até o
--    JWT expirar (e um admin desativado conseguia se reativar). is_staff()
--    já conferia `ativo`; agora todos conferem.
-- =============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, email, papel, departamento)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    'cliente',
    null
  )
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select papel = 'admin' and ativo from public.profiles where id = auth.uid()),
    false)
$$;

create or replace function public.is_papel(variadic p_papeis papel[])
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select papel = any(p_papeis) and ativo from public.profiles where id = auth.uid()),
    false)
$$;

create or replace function public.empresa_visivel(p_empresa uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff()
    or exists (
      select 1
        from public.contatos c
        join public.profiles p on p.id = c.profile_id
       where c.empresa_id = p_empresa
         and c.profile_id = auth.uid()
         and p.ativo
    )
$$;

-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0021_fix_timezone.sql <<<<<<<<<<<<<<<<<<<<
-- Fuso do banco: America/Cuiaba (escritório fica em Rondonópolis/MT).
--
-- Sem isto, o Postgres usa UTC por padrão (é o default da imagem Docker do
-- Supabase self-hosted, e também do Supabase Cloud) pra tudo que depende do
-- "agora"/"hoje" da sessão: current_date, now()::date, CURRENT_TIMESTAMP.
-- Isso já causava um bug real: o trigger que grava a data de entrega de uma
-- obrigação (obrigacao_marca_entrega, em 0006_fiscal.sql) usa
-- `current_date` — de noite em Cuiabá (a partir de ~20h, UTC-4), o UTC já
-- virou o dia seguinte, então a data de entrega gravada ficava um dia à
-- frente da data real em que o trabalho foi feito.
--
-- `ALTER DATABASE ... SET timezone` fica gravado no catálogo do banco
-- (pg_db_role_setting) e vale pra toda sessão nova a partir daqui — não
-- depende de configurar variável de ambiente no container nem de reiniciar
-- nada manualmente.
alter database postgres set timezone to 'America/Cuiaba';

-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0022_fix_low_priority_findings.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0022_fix_low_priority_findings.sql
-- Corrige um lote de achados de menor prioridade da auditoria:
--  1. Sócio removido apagava em cascata o histórico de IR dele.
--  2. RLS de documentos enviados pelo cliente não travava o status.
--  3. Empresa podia ser inativada por qualquer staff (agora só admin).
--  4. Honorário mensal visível pra qualquer staff (agora só admin,
--     via view separada — RLS de linha não filtra coluna).
--  5. REVOKE EXECUTE explícito nas funções SECURITY DEFINER.
-- =============================================================

-- ---------- 1. Sócio: não apaga mais o histórico de IR ao ser removido ----------
-- Era "on delete cascade" — remover um sócio detonava toda a fiscal.
-- declaracoes_ir dele (IRPF), que é dado com obrigação de guarda. Troca pra
-- "restrict": o banco recusa a exclusão do sócio enquanto existir
-- declaração vinculada (a action dá a mensagem amigável — ver actions.ts).
alter table public.declaracoes_ir
  drop constraint if exists declaracoes_ir_socio_id_fkey;
alter table public.declaracoes_ir
  add constraint declaracoes_ir_socio_id_fkey
  foreign key (socio_id) references public.socios(id) on delete restrict;

-- ---------- 2. RLS: cliente não pode forjar status ao enviar documento ----------
-- A action já força status='pendente' pro cliente, mas a RLS em si não
-- travava isso — um cliente chamando o Supabase direto (fora da action)
-- podia inserir já como 'aprovado'/'entregue'.
drop policy if exists documentos_cliente_insert on public.documentos;
create policy documentos_cliente_insert on public.documentos for insert
  with check (
    origem = 'cliente'
    and public.empresa_visivel(empresa_id)
    and enviado_por = auth.uid()
    and status = 'pendente'
  );

-- ---------- 3. Inativar/reativar empresa: só admin ----------
-- Antes: qualquer staff (fiscal, pessoal, atendimento...) podia inativar
-- uma empresa inteira. Ação de impacto alto — restringe a admin. Não dá
-- pra fazer isso só com RLS de UPDATE (a mesma policy empresas_staff_write
-- cobre edição normal de cadastro, que continua liberada pra staff) —
-- precisa de um trigger que olhe especificamente se o campo `ativo` mudou.
create or replace function public.empresa_ativo_so_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ativo is distinct from old.ativo and not public.is_admin() then
    raise exception 'Apenas administradores podem ativar/inativar uma empresa';
  end if;
  return new;
end $$;

drop trigger if exists trg_empresa_ativo_so_admin on public.empresas;
create trigger trg_empresa_ativo_so_admin before update on public.empresas
  for each row execute function public.empresa_ativo_so_admin();

-- ---------- 4. Honorário mensal: só admin vê ----------
-- RLS filtra LINHA, não coluna — pra esconder só uma coluna de quem não é
-- admin (mesmo tendo select liberado na linha via empresa_visivel), zera o
-- valor na leitura através de uma view. É a mesma linha de defesa que a
-- RLS de linha já usa (funciona mesmo se alguém consultar o Supabase
-- direto pelo browser, não só pela tela) — só que por coluna.
-- security_invoker=true: sem isso, a RLS da tabela base (empresa_visivel)
-- roda com o dono da view, não com quem está consultando — abriria uma
-- view que ignora a RLS de linha (pior do que o problema que estamos
-- corrigindo). Com security_invoker, a RLS de baixo continua valendo pra
-- quem consulta a view, exatamente como consultar a tabela direto.
create or replace view public.empresas_com_honorario
  with (security_invoker = true) as
select
  e.id, e.razao_social, e.nome_fantasia, e.cnpj, e.inscricao_estadual,
  e.inscricao_municipal, e.cnae_principal, e.regime_tributario, e.situacao,
  e.data_abertura, e.email, e.telefone, e.cep, e.logradouro, e.numero,
  e.complemento, e.bairro, e.municipio, e.uf, e.responsavel_id,
  e.departamentos_responsaveis, e.observacoes, e.ativo, e.created_at,
  e.updated_at,
  case when public.is_admin() then e.honorario_mensal else null end
    as honorario_mensal
from public.empresas e;

comment on view public.empresas_com_honorario is
  'Como public.empresas, mas honorario_mensal só vem preenchido pra admin '
  '— quem não é admin recebe null mesmo tendo select na linha. Use esta '
  'view (não empresas.honorario_mensal direto) em qualquer tela que '
  'mostra o honorário. Ao adicionar coluna em empresas, adicionar aqui '
  'também.';

grant select on public.empresas_com_honorario to authenticated;

-- ---------- 5. REVOKE EXECUTE explícito nas funções SECURITY DEFINER ----------
-- O anon recebe EXECUTE por DOIS caminhos, e é preciso fechar os dois:
--  a) PUBLIC — o Postgres concede EXECUTE a PUBLIC em toda função nova, e
--     todo role (inclusive anon) herda de PUBLIC;
--  b) direto — o Supabase configura "alter default privileges in schema
--     public" que concede EXECUTE a anon/authenticated/service_role.
-- Testado ao vivo: revogar só de um dos dois deixa has_function_privilege(
-- 'anon', ...) em true. (Uma versão anterior desta migration revogava só de
-- anon; parecia funcionar no banco de teste porque uma tentativa anterior
-- já tinha revogado de PUBLIC ali — numa instalação nova não teria efeito.)
-- authenticated continua com o grant direto (b) e recebe grant explícito
-- abaixo por garantia. Nenhuma dessas funções faz sentido pra chamada
-- anônima (todas leem auth.uid(), nulo sem sessão); as de escrita em
-- massa já checam o papel internamente — isto é reforço de superfície.
revoke execute on function public.current_papel() from public, anon;
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_papel(papel[]) from public, anon;
revoke execute on function public.empresa_visivel(uuid) from public, anon;
revoke execute on function public.gerar_obrigacoes(date) from public, anon;
revoke execute on function public.abrir_folhas(date) from public, anon;
revoke execute on function public.abrir_fechamentos(date) from public, anon;
revoke execute on function public.gerar_declaracoes_ir(ir_tipo, int, date) from public, anon;

grant execute on function public.current_papel() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_papel(papel[]) to authenticated;
grant execute on function public.empresa_visivel(uuid) to authenticated;
grant execute on function public.gerar_obrigacoes(date) to authenticated;
grant execute on function public.abrir_folhas(date) to authenticated;
grant execute on function public.abrir_fechamentos(date) to authenticated;
grant execute on function public.gerar_declaracoes_ir(ir_tipo, int, date) to authenticated;
-- handle_new_user() é chamada só pelo trigger on_auth_user_created (roda
-- como o dono do trigger, não via chamada direta de role nenhum) — não
-- precisa de revoke.

-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0023_rls_desempenho_e_exclusao.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0023_rls_desempenho_e_exclusao.sql
--  1. Excluir empresa: só admin. Antes, empresas_staff_write era FOR ALL
--     pra qualquer staff — incluía DELETE, e apagar uma empresa apaga em
--     cascata obrigações, folhas, funcionários, IR, fechamentos, sócios,
--     contatos e documentos (12 tabelas). A tela nunca teve esse botão,
--     mas a API aceitava de qualquer colaborador (inclusive atendimento).
--  2. Histórico: o autor gravado precisa ser o próprio usuário logado
--     (antes dava pra gravar auditoria em nome de outra pessoa chamando a
--     API direto). registrarHistorico() já grava assim — nada muda no app.
--  3. Desempenho: toda policy passa a chamar as funções de papel dentro de
--     `(select ...)`. Sem isso o Postgres reavalia is_staff()/is_papel()
--     LINHA A LINHA (uma consulta em profiles por linha); com isso vira um
--     InitPlan avaliado uma vez por consulta. Medido com 44 mil
--     obrigações: 358 ms -> 8 ms. Semântica idêntica — mesmas regras, só
--     muda quantas vezes são avaliadas. Nas policies de SELECT que eram só
--     `empresa_visivel(x)`, o `(select is_staff()) or` na frente é o mesmo
--     teste que empresa_visivel já faz por dentro, só que avaliado 1 vez.
--  4. Desempenho do lado do cliente: empresa_visivel(x) por linha roda
--     uma subconsulta em contatos pra CADA linha — medido com 44 mil
--     obrigações, um cliente levava 6,4 s pra listar as dele. Troca por
--     `x = any(empresas_visiveis_ids())`, que monta a lista de empresas do
--     usuário uma vez só: 11 ms, mesmo resultado (4.409 linhas nos dois).
--     empresa_visivel() continua existindo (Storage e código usam).
-- =============================================================

-- Empresas em que o usuário logado é contato (vazio pra quem não é
-- cliente). Mesma regra de empresa_visivel(), sem a parte de staff — as
-- policies testam `(select is_staff())` separado. security definer porque
-- contatos/profiles têm RLS própria; só devolve dados do próprio usuário.
create or replace function public.empresas_visiveis_ids()
returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(c.empresa_id), '{}')
  from public.contatos c
  join public.profiles p on p.id = c.profile_id
  where c.profile_id = auth.uid() and p.ativo
$$;
revoke execute on function public.empresas_visiveis_ids() from public, anon;
grant execute on function public.empresas_visiveis_ids() to authenticated;

-- ---------- catalogos ----------
drop policy if exists catalogos_admin on public.catalogos;
create policy catalogos_admin on public.catalogos for all
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists catalogos_read on public.catalogos;
create policy catalogos_read on public.catalogos for select
  using ((select auth.uid()) is not null);

-- ---------- escritorio_config ----------
drop policy if exists config_admin on public.escritorio_config;
create policy config_admin on public.escritorio_config for all
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists config_read on public.escritorio_config;
create policy config_read on public.escritorio_config for select
  using ((select auth.uid()) is not null);

-- ---------- profiles ----------
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = (select auth.uid()) or (select public.is_staff()));
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------- historico (item 2) ----------
drop policy if exists historico_insert on public.historico;
create policy historico_insert on public.historico for insert
  with check ((select public.is_staff()) and autor_id = (select auth.uid()));
drop policy if exists historico_read on public.historico;
create policy historico_read on public.historico for select
  using ((select public.is_staff()));

-- ---------- empresas (item 1) ----------
drop policy if exists empresas_select on public.empresas;
create policy empresas_select on public.empresas for select
  using ((select public.is_staff()) or id = any ((select public.empresas_visiveis_ids())::uuid[]));
drop policy if exists empresas_staff_write on public.empresas;
drop policy if exists empresas_staff_insert on public.empresas;
create policy empresas_staff_insert on public.empresas for insert
  with check ((select public.is_staff()));
drop policy if exists empresas_staff_update on public.empresas;
create policy empresas_staff_update on public.empresas for update
  using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists empresas_admin_delete on public.empresas;
create policy empresas_admin_delete on public.empresas for delete
  using ((select public.is_admin()));

-- ---------- socios / contatos ----------
drop policy if exists socios_select on public.socios;
create policy socios_select on public.socios for select
  using ((select public.is_staff()) or empresa_id = any ((select public.empresas_visiveis_ids())::uuid[]));
drop policy if exists socios_staff_write on public.socios;
create policy socios_staff_write on public.socios for all
  using ((select public.is_staff())) with check ((select public.is_staff()));

drop policy if exists contatos_select on public.contatos;
create policy contatos_select on public.contatos for select
  using ((select public.is_staff()) or empresa_id = any ((select public.empresas_visiveis_ids())::uuid[]));
drop policy if exists contatos_staff_write on public.contatos;
create policy contatos_staff_write on public.contatos for all
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- ---------- tarefas ----------
drop policy if exists tarefas_select on public.tarefas;
create policy tarefas_select on public.tarefas for select
  using ((select public.is_staff())
         or (empresa_id is not null and empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])));
drop policy if exists tarefas_staff_write on public.tarefas;
create policy tarefas_staff_write on public.tarefas for all
  using ((select public.is_staff())) with check ((select public.is_staff()));

drop policy if exists tarefa_itens_select on public.tarefa_itens;
create policy tarefa_itens_select on public.tarefa_itens for select
  using ((select public.is_staff()) or exists (
    select 1 from public.tarefas t
    where t.id = tarefa_itens.tarefa_id
      and t.empresa_id is not null and t.empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])));
drop policy if exists tarefa_itens_staff_write on public.tarefa_itens;
create policy tarefa_itens_staff_write on public.tarefa_itens for all
  using ((select public.is_staff())) with check ((select public.is_staff()));

drop policy if exists tarefa_docs_select on public.tarefa_documentos;
create policy tarefa_docs_select on public.tarefa_documentos for select
  using ((select public.is_staff()) or exists (
    select 1 from public.tarefas t
    where t.id = tarefa_documentos.tarefa_id
      and t.empresa_id is not null and t.empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])));
drop policy if exists tarefa_docs_staff_write on public.tarefa_documentos;
create policy tarefa_docs_staff_write on public.tarefa_documentos for all
  using ((select public.is_staff())) with check ((select public.is_staff()));

drop policy if exists templates_admin on public.tarefa_templates;
create policy templates_admin on public.tarefa_templates for all
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists templates_read on public.tarefa_templates;
create policy templates_read on public.tarefa_templates for select
  using ((select public.is_staff()));

-- ---------- documentos ----------
drop policy if exists documentos_select on public.documentos;
create policy documentos_select on public.documentos for select
  using ((select public.is_staff()) or empresa_id = any ((select public.empresas_visiveis_ids())::uuid[]));
drop policy if exists documentos_staff_write on public.documentos;
create policy documentos_staff_write on public.documentos for all
  using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists documentos_cliente_insert on public.documentos;
create policy documentos_cliente_insert on public.documentos for insert
  with check (
    origem = 'cliente'
    and empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])
    and enviado_por = (select auth.uid())
    and status = 'pendente'
  );

drop policy if exists doc_acessos_select on public.documento_acessos;
create policy doc_acessos_select on public.documento_acessos for select
  using ((select public.is_staff()));
drop policy if exists doc_acessos_insert on public.documento_acessos;
create policy doc_acessos_insert on public.documento_acessos for insert
  with check (
    (select auth.uid()) is not null
    and profile_id = (select auth.uid())
    and exists (
      select 1 from public.documentos d
      where d.id = documento_acessos.documento_id
        and d.empresa_id = any ((select public.empresas_visiveis_ids())::uuid[]))
  );

-- ---------- agenda ----------
drop policy if exists eventos_select on public.eventos_agenda;
create policy eventos_select on public.eventos_agenda for select
  using ((select public.is_staff())
         or (empresa_id is not null and empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])));
drop policy if exists eventos_staff_write on public.eventos_agenda;
create policy eventos_staff_write on public.eventos_agenda for all
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- ---------- fiscal ----------
drop policy if exists obrigacoes_select on public.obrigacoes;
create policy obrigacoes_select on public.obrigacoes for select
  using ((select public.is_staff()) or empresa_id = any ((select public.empresas_visiveis_ids())::uuid[]));
drop policy if exists obrigacoes_staff_write on public.obrigacoes;
create policy obrigacoes_staff_write on public.obrigacoes for all
  using ((select public.is_papel('admin', 'fiscal')))
  with check ((select public.is_papel('admin', 'fiscal')));

drop policy if exists recorrencias_select on public.obrigacao_recorrencias;
create policy recorrencias_select on public.obrigacao_recorrencias for select
  using ((select public.is_papel('admin', 'fiscal')));
drop policy if exists recorrencias_staff_write on public.obrigacao_recorrencias;
create policy recorrencias_staff_write on public.obrigacao_recorrencias for all
  using ((select public.is_papel('admin', 'fiscal')))
  with check ((select public.is_papel('admin', 'fiscal')));

-- ---------- pessoal ----------
drop policy if exists funcionarios_select on public.funcionarios;
create policy funcionarios_select on public.funcionarios for select
  using ((select public.is_papel('admin', 'pessoal')));
drop policy if exists funcionarios_staff_write on public.funcionarios;
create policy funcionarios_staff_write on public.funcionarios for all
  using ((select public.is_papel('admin', 'pessoal')))
  with check ((select public.is_papel('admin', 'pessoal')));

drop policy if exists eventos_dp_select on public.eventos_dp;
create policy eventos_dp_select on public.eventos_dp for select
  using ((select public.is_papel('admin', 'pessoal')));
drop policy if exists eventos_dp_staff_write on public.eventos_dp;
create policy eventos_dp_staff_write on public.eventos_dp for all
  using ((select public.is_papel('admin', 'pessoal')))
  with check ((select public.is_papel('admin', 'pessoal')));

drop policy if exists evento_dp_itens_select on public.evento_dp_itens;
create policy evento_dp_itens_select on public.evento_dp_itens for select
  using ((select public.is_papel('admin', 'pessoal')));
drop policy if exists evento_dp_itens_staff_write on public.evento_dp_itens;
create policy evento_dp_itens_staff_write on public.evento_dp_itens for all
  using ((select public.is_papel('admin', 'pessoal')))
  with check ((select public.is_papel('admin', 'pessoal')));

drop policy if exists folhas_select on public.folhas;
create policy folhas_select on public.folhas for select
  using ((select public.is_papel('admin', 'pessoal')));
drop policy if exists folhas_staff_write on public.folhas;
create policy folhas_staff_write on public.folhas for all
  using ((select public.is_papel('admin', 'pessoal')))
  with check ((select public.is_papel('admin', 'pessoal')));

-- ---------- contábil ----------
drop policy if exists fechamentos_select on public.fechamentos_contabeis;
create policy fechamentos_select on public.fechamentos_contabeis for select
  using ((select public.is_papel('admin', 'contabil')));
drop policy if exists fechamentos_write on public.fechamentos_contabeis;
create policy fechamentos_write on public.fechamentos_contabeis for all
  using ((select public.is_papel('admin', 'contabil')))
  with check ((select public.is_papel('admin', 'contabil')));

drop policy if exists fechamento_itens_select on public.fechamento_itens;
create policy fechamento_itens_select on public.fechamento_itens for select
  using ((select public.is_papel('admin', 'contabil')));
drop policy if exists fechamento_itens_write on public.fechamento_itens;
create policy fechamento_itens_write on public.fechamento_itens for all
  using ((select public.is_papel('admin', 'contabil')))
  with check ((select public.is_papel('admin', 'contabil')));

-- ---------- societário ----------
drop policy if exists processos_societarios_select on public.processos_societarios;
create policy processos_societarios_select on public.processos_societarios for select
  using ((select public.is_papel('admin', 'societario')));
drop policy if exists processos_societarios_write on public.processos_societarios;
create policy processos_societarios_write on public.processos_societarios for all
  using ((select public.is_papel('admin', 'societario')))
  with check ((select public.is_papel('admin', 'societario')));

drop policy if exists processo_societario_itens_select on public.processo_societario_itens;
create policy processo_societario_itens_select on public.processo_societario_itens for select
  using ((select public.is_papel('admin', 'societario')));
drop policy if exists processo_societario_itens_write on public.processo_societario_itens;
create policy processo_societario_itens_write on public.processo_societario_itens for all
  using ((select public.is_papel('admin', 'societario')))
  with check ((select public.is_papel('admin', 'societario')));

-- ---------- IR ----------
drop policy if exists declaracoes_ir_select on public.declaracoes_ir;
create policy declaracoes_ir_select on public.declaracoes_ir for select
  using ((select public.is_papel('admin', 'fiscal', 'contabil')));
drop policy if exists declaracoes_ir_write on public.declaracoes_ir;
create policy declaracoes_ir_write on public.declaracoes_ir for all
  using ((select public.is_papel('admin', 'fiscal', 'contabil')))
  with check ((select public.is_papel('admin', 'fiscal', 'contabil')));

-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0024_obrigacoes_so_empresa_ativa.sql <<<<<<<<<<<<<<<<<<<<
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

-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0025_modelos_e_vinculos.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0025_modelos_e_vinculos.sql — telas de modelos de tarefa e de
-- documentos vinculados à tarefa
-- =============================================================
-- As duas tabelas existiam desde a 0003, mas sem tela. Antes de ligar a
-- interface, fecha as brechas de integridade que ela passaria a expor.

-- 1. tarefa_documentos.documento_id não tinha FK: apagar um documento
--    deixava vínculo apontando pro nada. Limpa órfãos e amarra com cascade.
delete from public.tarefa_documentos td
where not exists (select 1 from public.documentos d where d.id = td.documento_id);

alter table public.tarefa_documentos
  drop constraint if exists tarefa_documentos_documento_id_fkey;
alter table public.tarefa_documentos
  add constraint tarefa_documentos_documento_id_fkey
  foreign key (documento_id) references public.documentos(id) on delete cascade;

create index if not exists tarefa_documentos_documento_idx
  on public.tarefa_documentos (documento_id);

-- 2. Documento vinculado tem que ser da MESMA empresa da tarefa (a action
--    confere, mas a regra mora no banco pra não depender da tela).
create or replace function public.tarefa_documento_mesma_empresa()
returns trigger language plpgsql as $$
declare
  emp_tarefa uuid;
  emp_doc uuid;
begin
  select empresa_id into emp_tarefa from public.tarefas where id = new.tarefa_id;
  select empresa_id into emp_doc from public.documentos where id = new.documento_id;
  if emp_tarefa is null or emp_doc is distinct from emp_tarefa then
    raise exception 'O documento precisa ser da mesma empresa da tarefa.'
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_tarefa_documento_mesma_empresa on public.tarefa_documentos;
create trigger trg_tarefa_documento_mesma_empresa
  before insert or update on public.tarefa_documentos
  for each row execute function public.tarefa_documento_mesma_empresa();

-- 3. Modelos: dia do prazo válido e lista de itens sempre um array JSON.
update public.tarefa_templates set dia_prazo = null
where dia_prazo is not null and dia_prazo not between 1 and 31;
update public.tarefa_templates set itens_padrao = '[]'::jsonb
where jsonb_typeof(itens_padrao) is distinct from 'array';

alter table public.tarefa_templates
  drop constraint if exists tarefa_templates_dia_prazo_check;
alter table public.tarefa_templates
  add constraint tarefa_templates_dia_prazo_check
  check (dia_prazo is null or dia_prazo between 1 and 31);

alter table public.tarefa_templates
  drop constraint if exists tarefa_templates_itens_array_check;
alter table public.tarefa_templates
  add constraint tarefa_templates_itens_array_check
  check (jsonb_typeof(itens_padrao) = 'array');

-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0026_fix_trilha_acessos_staff.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0026_fix_trilha_acessos_staff.sql — staff voltou a gravar na trilha
-- =============================================================
-- Regressão da 0023: ao trocar `empresa_visivel(d.empresa_id)` por
-- `d.empresa_id = any(empresas_visiveis_ids())` na policy de INSERT de
-- documento_acessos, faltou o `is_staff() or` na frente — empresa_visivel()
-- já incluía staff; empresas_visiveis_ids() lista só empresas de contato.
-- Resultado: desde a 0023, upload/download feito por colaborador não ficava
-- registrado na trilha LGPD (o insert é best-effort no código, então não
-- aparecia erro nenhum). Cliente não foi afetado.

drop policy if exists doc_acessos_insert on public.documento_acessos;
create policy doc_acessos_insert on public.documento_acessos for insert
  with check (
    (select auth.uid()) is not null
    and profile_id = (select auth.uid())
    and exists (
      select 1 from public.documentos d
      where d.id = documento_acessos.documento_id
        and ((select public.is_staff())
             or d.empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])))
  );

-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0027_trilha_sobrevive_exclusao.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0027_trilha_sobrevive_exclusao.sql — excluir documento sem apagar a
-- trilha de acessos (LGPD)
-- =============================================================
-- documento_acessos.documento_id era `on delete cascade`: apagar um
-- documento apagava junto o registro de quem o enviou/baixou — o oposto do
-- que uma trilha de auditoria deve fazer. Agora a exclusão só solta o
-- vínculo (set null) e cada linha guarda uma cópia do título e da empresa,
-- pra continuar legível depois que o documento some. A própria exclusão
-- também entra na trilha (acao = 'excluiu', já prevista desde a 0004).

alter table public.documento_acessos
  add column if not exists documento_titulo text,
  add column if not exists empresa_id uuid references public.empresas(id) on delete set null;

-- preenche o histórico que já existe
update public.documento_acessos a
   set documento_titulo = d.titulo,
       empresa_id = d.empresa_id
  from public.documentos d
 where d.id = a.documento_id
   and (a.documento_titulo is null or a.empresa_id is null);

alter table public.documento_acessos alter column documento_id drop not null;
alter table public.documento_acessos
  drop constraint if exists documento_acessos_documento_id_fkey;
alter table public.documento_acessos
  add constraint documento_acessos_documento_id_fkey
  foreign key (documento_id) references public.documentos(id) on delete set null;

create index if not exists doc_acessos_empresa_idx
  on public.documento_acessos (empresa_id, created_at desc);

-- Toda linha nova já nasce com título/empresa (o código não precisa mandar).
create or replace function public.doc_acesso_copia_dados()
returns trigger language plpgsql as $$
begin
  if new.documento_id is not null
     and (new.documento_titulo is null or new.empresa_id is null) then
    select coalesce(new.documento_titulo, d.titulo), coalesce(new.empresa_id, d.empresa_id)
      into new.documento_titulo, new.empresa_id
      from public.documentos d
     where d.id = new.documento_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_doc_acesso_copia_dados on public.documento_acessos;
create trigger trg_doc_acesso_copia_dados
  before insert on public.documento_acessos
  for each row execute function public.doc_acesso_copia_dados();

-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0028_indices_listagens.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0028_indices_listagens.sql — índices para as listas que só crescem
-- =============================================================
-- Medido com volume de escritório (300 empresas, 3 anos): as telas
-- "Histórico" e "Acessos a documentos" da Administração liam a tabela
-- inteira e ordenavam a cada abertura (60 mil linhas de histórico → ~125 ms,
-- e crescendo todo dia). Com índice na ordem da tela, a busca dos 100/200
-- mais recentes lê só essas linhas.

create index if not exists historico_recentes_idx
  on public.historico (created_at desc);

create index if not exists doc_acessos_recentes_idx
  on public.documento_acessos (created_at desc);

-- Listas de tarefas e obrigações filtram por status e ordenam por prazo /
-- vencimento; o índice composto evita ordenar milhares de linhas.
create index if not exists tarefas_status_prazo_idx
  on public.tarefas (status, prazo);

create index if not exists obrigacoes_competencia_vencimento_idx
  on public.obrigacoes (competencia, vencimento);

-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0029_backups.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0029_backups.sql — registro das execuções de backup
-- =============================================================
-- O scripts\backup-sistema.ps1 (instalação do escritório) grava aqui cada
-- execução: quando rodou, se deu certo, se o ensaio de restauração passou e
-- o tamanho. A tela de Administração (aba Backup) lista as execuções e o
-- painel do admin avisa quando o último backup bem-sucedido ficou velho —
-- backup que falha em silêncio é o pior tipo de falha.
--
-- Na nuvem a tabela fica vazia (o Supabase Cloud faz o próprio backup) e o
-- aviso não aparece: ele só liga depois do primeiro registro.
--
-- Mesmo esquema de eventos_seguranca: RLS ativa sem nenhuma policy, então
-- só a service role (no servidor) lê. O script grava direto pelo psql,
-- como dono da tabela.

create table if not exists public.backups (
  id              uuid primary key default gen_random_uuid(),
  iniciado_em     timestamptz not null default now(),
  concluido_em    timestamptz,
  sucesso         boolean not null default false,
  -- Ensaio de restauração: o banco do backup foi carregado num banco
  -- temporário e as contagens bateram; cada documento está no arquivo.
  verificado      boolean not null default false,
  destino         text,
  tamanho_bytes   bigint,
  detalhe         text
);
create index if not exists backups_recentes_idx
  on public.backups (iniciado_em desc);

alter table public.backups enable row level security;
-- (sem policies de propósito — bloqueia anon/authenticated por completo)

-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0030_honorario_so_admin.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0030_honorario_so_admin.sql — honorário mensal só para admin, NO BANCO
-- =============================================================
-- A 0022 escondeu o honorário atrás de uma view (empresas_com_honorario),
-- mas a coluna continuava em public.empresas: qualquer staff lia (e
-- ALTERAVA) o valor de todas as empresas, e o cliente lia o da própria
-- empresa, consultando a tabela direto pela API — a tela escondia, o banco
-- entregava. (Confirmado por teste com um usuário de cada papel.)
--
-- RLS filtra linha, não coluna. Em vez de brigar com privilégio por coluna
-- (que quebraria `select *` e a view security_invoker), o valor sai da
-- tabela de empresas e vai para uma tabela própria, com RLS só de admin:
--
--   public.empresa_honorarios (empresa_id, valor)  → só admin lê/grava
--   public.empresas_com_honorario (view)           → como antes: a coluna
--     honorario_mensal vem do join; não-admin não enxerga a linha em
--     empresa_honorarios (RLS do invoker) e recebe null.
--
-- Idempotente. Os valores já cadastrados são copiados antes de a coluna
-- ser removida.

create table if not exists public.empresa_honorarios (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  valor      numeric(12,2) not null check (valor >= 0),
  updated_at timestamptz not null default now()
);

alter table public.empresa_honorarios enable row level security;

drop policy if exists honorarios_admin on public.empresa_honorarios;
create policy honorarios_admin on public.empresa_honorarios
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists trg_honorarios_touch on public.empresa_honorarios;
create trigger trg_honorarios_touch
  before update on public.empresa_honorarios
  for each row execute function public.touch_updated_at();

-- Copia o que existe (só enquanto a coluna antiga ainda existir).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'empresas'
      and column_name = 'honorario_mensal'
  ) then
    insert into public.empresa_honorarios (empresa_id, valor)
    select id, honorario_mensal from public.empresas
    where honorario_mensal is not null and honorario_mensal >= 0
    on conflict (empresa_id) do nothing;
  end if;
end $$;

-- A view depende da coluna: refaz a view, depois remove a coluna.
drop view if exists public.empresas_com_honorario;

alter table public.empresas drop column if exists honorario_mensal;

create view public.empresas_com_honorario
  with (security_invoker = true) as
select
  e.id, e.razao_social, e.nome_fantasia, e.cnpj, e.inscricao_estadual,
  e.inscricao_municipal, e.cnae_principal, e.regime_tributario, e.situacao,
  e.data_abertura, e.email, e.telefone, e.cep, e.logradouro, e.numero,
  e.complemento, e.bairro, e.municipio, e.uf, e.responsavel_id,
  e.departamentos_responsaveis, e.observacoes, e.ativo, e.created_at,
  e.updated_at,
  h.valor as honorario_mensal
from public.empresas e
left join public.empresa_honorarios h on h.empresa_id = e.id;

comment on view public.empresas_com_honorario is
  'Como public.empresas, mais honorario_mensal vindo de empresa_honorarios. '
  'Com security_invoker, a RLS de empresa_honorarios (só admin) vale para '
  'quem consulta: quem não é admin recebe null. Ao adicionar coluna em '
  'empresas, adicionar aqui também.';

revoke all on public.empresas_com_honorario from anon;
grant select on public.empresas_com_honorario to authenticated;
revoke all on public.empresa_honorarios from anon;

-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0031_acesso_por_departamento.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- 0031_acesso_por_departamento.sql
-- Documentos do Pessoal, histórico por departamento e tarefas do cliente
-- =============================================================
-- Auditoria de 2026-10: qualquer funcionário (até o atendimento) lia e
-- baixava holerites e demais documentos do Pessoal, o histórico mostrava a
-- todos o que acontecia em outros departamentos, e o cliente lia pela API
-- TODAS as tarefas da própria empresa, inclusive anotações internas.
-- Regras definidas pelo dono do sistema:
--
--  1. DOCUMENTOS: só os do departamento PESSOAL ficam restritos (admin +
--     papel pessoal). Os demais departamentos continuam abertos a todo o
--     staff. O cliente continua vendo os documentos da PRÓPRIA empresa.
--     Os arquivos no Storage seguem a mesma regra (a tabela documentos é a
--     fonte única) e o staff deixa de apagar arquivo direto pela API: só o
--     dono do arquivo e o admin (a exclusão pelo sistema roda no servidor).
--  2. HISTÓRICO: cada papel vê os registros do seu departamento. Admin vê
--     tudo; usuários, configuração e modelos de tarefa só admin. REGRA:
--     um tipo novo de histórico (coluna entidade) precisa ser acrescentado
--     em historico_entidades_visiveis(); sem isso ele fica visível só ao admin.
--  3. TAREFAS: o cliente só enxerga as tarefas "aguardando_cliente" da sua
--     empresa (e o checklist/documentos dessas tarefas).
--
-- Idempotente: cada policy é precedida de drop policy if exists.

-- Cada arquivo pertence a UM documento. Índice ÚNICO (e não só de busca): a
-- policy de leitura do Storage libera o arquivo para quem enxerga o registro
-- que aponta para ele; sem unicidade, quem pudesse registrar um documento
-- "aberto" (ex.: do Fiscal) apontando para o caminho de um arquivo do Pessoal
-- ganharia acesso a ele. (Testado: era possível.)
drop index if exists public.documentos_storage_path_idx;
create unique index if not exists documentos_storage_path_uidx
  on public.documentos (storage_path);

-- O arquivo de um documento fica SEMPRE na pasta da própria empresa (o Zod já
-- exige isto na action; aqui o banco também, para quem registra pela API).
-- NOT VALID: vale para o que for gravado daqui para frente, sem varrer o
-- que já existe.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'documentos_caminho_da_empresa'
      and conrelid = 'public.documentos'::regclass
  ) then
    alter table public.documentos
      add constraint documentos_caminho_da_empresa
      check (storage_path like empresa_id::text || '/%') not valid;
  end if;
end $$;

-- Usuário ativo? As policies "de dono do arquivo" (Storage) precisam disto:
-- quem foi desativado mantém o JWT até expirar e não pode continuar lendo ou
-- apagando o que enviou.
create or replace function public.sou_ativo()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select ativo from public.profiles where id = auth.uid()), false)
$$;

-- Este arquivo já pertence a algum documento? (security definer: precisa
-- enxergar também os documentos que a RLS esconderia de quem pergunta.)
create or replace function public.arquivo_tem_documento(p_caminho text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.documentos where storage_path = p_caminho)
$$;

revoke all on function public.sou_ativo() from public, anon;
revoke all on function public.arquivo_tem_documento(text) from public, anon;
grant execute on function public.sou_ativo() to authenticated, service_role;
grant execute on function public.arquivo_tem_documento(text) to authenticated, service_role;

-- ---------- 1. DOCUMENTOS ----------
-- "is distinct from": documento sem departamento não pode sumir para o staff.
drop policy if exists documentos_select on public.documentos;
create policy documentos_select on public.documentos
  for select to authenticated
  using (
    (
      (select public.is_staff())
      and (departamento is distinct from 'pessoal'
           or (select public.is_papel('admin', 'pessoal')))
    )
    or empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])
  );

-- Era uma policy FOR ALL (qualquer staff, qualquer departamento). Agora a
-- mesma regra vale para gravar, e usando/with check iguais impedem
-- "reclassificar" um documento para dentro ou para fora do Pessoal.
drop policy if exists documentos_staff_write on public.documentos;
drop policy if exists documentos_staff_insert on public.documentos;
drop policy if exists documentos_staff_update on public.documentos;
drop policy if exists documentos_staff_delete on public.documentos;
create policy documentos_staff_insert on public.documentos
  for insert to authenticated
  with check (
    (select public.is_staff())
    and (departamento is distinct from 'pessoal'
         or (select public.is_papel('admin', 'pessoal')))
  );
create policy documentos_staff_update on public.documentos
  for update to authenticated
  using (
    (select public.is_staff())
    and (departamento is distinct from 'pessoal'
         or (select public.is_papel('admin', 'pessoal')))
  )
  with check (
    (select public.is_staff())
    and (departamento is distinct from 'pessoal'
         or (select public.is_papel('admin', 'pessoal')))
  );
create policy documentos_staff_delete on public.documentos
  for delete to authenticated
  using (
    (select public.is_staff())
    and (departamento is distinct from 'pessoal'
         or (select public.is_papel('admin', 'pessoal')))
  );
-- documentos_cliente_insert (cliente envia na própria empresa) não muda.

-- Trilha de acessos (LGPD): acompanha a visibilidade do documento. Linhas de
-- documento já excluído (documento_id nulo) só o admin vê.
drop policy if exists doc_acessos_select on public.documento_acessos;
create policy doc_acessos_select on public.documento_acessos
  for select to authenticated
  using (
    (select public.is_admin())
    or (
      (select public.is_staff())
      and documento_id is not null
      and exists (
        select 1 from public.documentos d where d.id = documento_acessos.documento_id
      )
    )
  );

-- ---------- 2. STORAGE (bucket documentos) ----------
-- Leitura: admin; o próprio dono do arquivo (precisa conferir o upload antes
-- de existir o registro em documentos); ou quem enxerga o registro do
-- documento — a subconsulta roda sob a RLS de documentos, então herda a regra
-- do Pessoal e a do cliente (própria empresa). Arquivo órfão: só dono/admin.
drop policy if exists "documentos storage read" on storage.objects;
create policy "documentos storage read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documentos'
    and (
      (select public.is_admin())
      or (owner_id = (select auth.uid())::text and (select public.sou_ativo()))
      or exists (
        select 1 from public.documentos d where d.storage_path = storage.objects.name
      )
    )
  );

-- Era FOR ALL para qualquer staff: lia, sobrescrevia e apagava qualquer
-- arquivo do bucket. Agora: staff só ENVIA. Apagar é do admin ou do DONO do
-- arquivo, e o dono só enquanto o arquivo ainda não pertence a nenhum
-- documento (é o que o sistema faz para limpar um envio recusado; depois de
-- registrado, nem o cliente que enviou apaga pela API). A exclusão de
-- documento pelo sistema remove o arquivo no servidor.
drop policy if exists "documentos storage staff write" on storage.objects;
drop policy if exists "documentos storage staff insert" on storage.objects;
create policy "documentos storage staff insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos' and (select public.is_staff()));

drop policy if exists "documentos storage owner delete" on storage.objects;
create policy "documentos storage owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documentos'
    and (
      (select public.is_admin())
      or (
        owner_id = (select auth.uid())::text
        and (select public.sou_ativo())
        and not public.arquivo_tem_documento(storage.objects.name)
      )
    )
  );
-- "documentos storage cliente upload" (cliente envia para a própria pasta) não muda.

-- ---------- 3. HISTÓRICO por departamento ----------
create or replace function public.historico_entidades_visiveis()
returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case p.papel
      when 'fiscal'      then array['empresa','tarefa','obrigacao','fiscal','declaracao_ir']
      when 'contabil'    then array['empresa','tarefa','fechamento','declaracao_ir']
      when 'pessoal'     then array['empresa','tarefa','funcionario','evento_dp','folha']
      when 'societario'  then array['empresa','tarefa','processo_societario']
      when 'atendimento' then array['empresa','tarefa']
      else '{}'::text[]            -- cliente; admin é tratado por is_admin() na policy
    end
    from public.profiles p where p.id = auth.uid() and p.ativo
  ), '{}'::text[])
$$;
revoke all on function public.historico_entidades_visiveis() from public, anon;
grant execute on function public.historico_entidades_visiveis() to authenticated, service_role;

drop policy if exists historico_read on public.historico;
create policy historico_read on public.historico
  for select to authenticated
  using (
    (select public.is_admin())
    or (
      (select public.is_staff())
      and (
        entidade = any ((select public.historico_entidades_visiveis())::text[])
        -- registro sobre documento: só para quem enxerga o documento
        or (entidade = 'documento'
            and exists (select 1 from public.documentos d where d.id = historico.entidade_id))
      )
    )
  );
-- usuario, config, tarefa_modelo e qualquer tipo não listado: só admin.

-- ---------- 4. TAREFAS: o cliente só vê "aguardando_cliente" ----------
drop policy if exists tarefas_select on public.tarefas;
create policy tarefas_select on public.tarefas
  for select to authenticated
  using (
    (select public.is_staff())
    or (
      status = 'aguardando_cliente'
      and empresa_id is not null
      and empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])
    )
  );

drop policy if exists tarefa_itens_select on public.tarefa_itens;
create policy tarefa_itens_select on public.tarefa_itens
  for select to authenticated
  using (
    (select public.is_staff())
    or exists (
      select 1 from public.tarefas t
      where t.id = tarefa_itens.tarefa_id
        and t.status = 'aguardando_cliente'
        and t.empresa_id is not null
        and t.empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])
    )
  );

drop policy if exists tarefa_docs_select on public.tarefa_documentos;
create policy tarefa_docs_select on public.tarefa_documentos
  for select to authenticated
  using (
    (select public.is_staff())
    or exists (
      select 1 from public.tarefas t
      where t.id = tarefa_documentos.tarefa_id
        and t.status = 'aguardando_cliente'
        and t.empresa_id is not null
        and t.empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])
    )
  );

-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/0032_ultimo_admin.sql <<<<<<<<<<<<<<<<<<<<
-- O escritório nunca pode ficar sem administrador ativo.
--
-- A tela de Usuários já recusa rebaixar/desativar o último admin, mas só no
-- servidor: dois admins se alterando ao mesmo tempo passam os dois pela
-- checagem (cada um enxerga o outro como "admin restante"), e quem usa a API
-- direto nem passa por ela. Aqui o banco garante, serializando as alterações.

create or replace function public.profiles_protege_ultimo_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- só importa quando um admin ATIVO deixa de sê-lo (rebaixado, desativado ou apagado)
  if old.papel = 'admin' and old.ativo
     and (tg_op = 'DELETE' or new.papel <> 'admin' or not new.ativo) then
    -- uma alteração por vez: sem isto, duas transações simultâneas contariam o
    -- mesmo "outro admin" e as duas passariam
    perform pg_advisory_xact_lock(hashtext('profiles_ultimo_admin'));
    if not exists (
      select 1 from public.profiles
      where papel = 'admin' and ativo and id <> old.id
    ) then
      raise exception 'O escritório precisa ter ao menos um administrador ativo.'
        using errcode = 'check_violation';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.profiles_protege_ultimo_admin() from public, anon, authenticated;

drop trigger if exists profiles_ultimo_admin on public.profiles;
create trigger profiles_ultimo_admin
  before update or delete on public.profiles
  for each row execute function public.profiles_protege_ultimo_admin();
