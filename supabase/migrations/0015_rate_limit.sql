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
