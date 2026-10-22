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
