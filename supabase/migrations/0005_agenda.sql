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
