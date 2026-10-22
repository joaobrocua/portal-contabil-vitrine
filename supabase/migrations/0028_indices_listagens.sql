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
