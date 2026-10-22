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
