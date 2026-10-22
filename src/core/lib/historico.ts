import "server-only";

import { createSupabaseServerClient } from "@/core/db/server";
import type { HistoricoRow } from "@/core/db/types";

export interface RegistroHistorico {
  entidade: string;
  entidadeId?: string | null;
  acao: string;
  campo?: string | null;
  de?: string | null;
  para?: string | null;
  descricao: string;
  autorId?: string | null;
}

/**
 * Grava uma linha de auditoria. Best-effort: nunca derruba a ação principal.
 */
export async function registrarHistorico(reg: RegistroHistorico): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("historico").insert({
      entidade: reg.entidade,
      entidade_id: reg.entidadeId ?? null,
      acao: reg.acao,
      campo: reg.campo ?? null,
      de: reg.de ?? null,
      para: reg.para ?? null,
      descricao: reg.descricao,
      autor_id: reg.autorId ?? null,
    });
    // O supabase-js devolve o erro em vez de lançar: sem isto, uma auditoria
    // que não gravou (RLS, tipo novo fora da função) passaria em silêncio.
    if (error) console.error("[historico] não gravado:", error.code ?? "", error.message);
  } catch {
    // silencioso — auditoria não pode quebrar o fluxo
  }
}

// ATENÇÃO: o histórico é filtrado por departamento no banco (policy
// historico_read, migration 0031). Ao criar um tipo novo de `entidade` em
// registrarHistorico, acrescente-o em historico_entidades_visiveis() — senão
// só o admin o enxerga, sem aviso nenhum.
export interface HistoricoComAutor extends HistoricoRow {
  autor: { nome: string } | null;
}

/** Últimos registros de histórico de uma entidade (ou geral, se sem filtro). */
export async function listarHistorico(opts?: {
  entidade?: string;
  entidadeId?: string;
  limite?: number;
}): Promise<HistoricoComAutor[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("historico")
    .select("*, autor:profiles!historico_autor_id_fkey(nome)")
    .order("created_at", { ascending: false })
    .limit(opts?.limite ?? 50);

  if (opts?.entidade) query = query.eq("entidade", opts.entidade);
  if (opts?.entidadeId) query = query.eq("entidade_id", opts.entidadeId);

  const { data } = await query;
  return (data ?? []) as unknown as HistoricoComAutor[];
}
