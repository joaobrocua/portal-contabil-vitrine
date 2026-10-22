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
