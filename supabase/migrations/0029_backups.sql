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
