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
