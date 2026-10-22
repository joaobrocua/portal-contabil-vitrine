import "server-only";

import { empresasParaEscolha } from "@/core/db/empresas-opcoes";
import type { EmpresaOpcao } from "@/core/types/empresa-opcao";
import type { Supabase } from "@/core/db/busca";
import { fetchTodos } from "@/core/db/pagination";
import { createSupabaseServerClient } from "@/core/db/server";
import type { FechamentoItemRow, FechamentoContabilRow } from "@/core/db/types";
import { competenciaAtual, deslocarCompetencia } from "@/core/lib/format";
import { buscarPagina, TAMANHO_PAGINA, type Pagina } from "@/core/lib/paginacao";
import type { FechamentoStatus } from "@/core/types/domain";

export interface FechamentoItem extends FechamentoContabilRow {
  empresa: { id: string; razao_social: string; nome_fantasia: string | null } | null;
  responsavel: { nome: string } | null;
}

export interface FechamentoFiltros {
  competencia?: string;
  empresaId?: string;
  status?: FechamentoStatus | "abertos";
}

const SEL =
  "*, empresa:empresas(id, razao_social, nome_fantasia), responsavel:profiles!fechamentos_contabeis_responsavel_id_fkey(nome)";

function consultaFechamentos(supabase: Supabase, f: FechamentoFiltros, contar: boolean) {
  // `id` desempata: sem ordem total, `.range()` pode repetir/pular linhas
  // entre páginas.
  let q = supabase
    .from("fechamentos_contabeis")
    .select(SEL, contar ? { count: "exact" } : undefined)
    .order("empresa_id")
    .order("id");

  if (f.competencia) q = q.eq("competencia", f.competencia);
  if (f.empresaId) q = q.eq("empresa_id", f.empresaId);
  if (f.status === "abertos") q = q.not("status", "in", "(fechado,entregue)");
  else if (f.status) q = q.eq("status", f.status);
  return q;
}

/** Todos os fechamentos do filtro (ficha da empresa) — pagina nos bastidores. */
export async function listFechamentos(
  f: FechamentoFiltros = {},
): Promise<FechamentoItem[]> {
  const supabase = await createSupabaseServerClient();
  const linhas = await fetchTodos((de, ate) =>
    consultaFechamentos(supabase, f, false).range(de, ate),
  );
  return linhas as unknown as FechamentoItem[];
}

/** Uma página de fechamentos (tela do Contábil: uma linha por empresa). */
export async function paginarFechamentos(
  f: FechamentoFiltros,
  pagina: number,
  tamanho = TAMANHO_PAGINA,
): Promise<Pagina<FechamentoItem>> {
  const supabase = await createSupabaseServerClient();
  const { data, error, count, pagina: efetiva } = await buscarPagina(
    (de, ate) => consultaFechamentos(supabase, f, true).range(de, ate),
    pagina,
    tamanho,
  );
  if (error) throw new Error(error.message);
  return { itens: (data ?? []) as unknown as FechamentoItem[], total: count ?? 0, pagina: efetiva, tamanho };
}

export interface FechamentoDetalhe extends FechamentoItem {
  itens: FechamentoItemRow[];
}

export async function getFechamento(id: string): Promise<FechamentoDetalhe | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("fechamentos_contabeis")
    .select(SEL)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const { data: itens } = await supabase
    .from("fechamento_itens")
    .select("*")
    .eq("fechamento_id", id)
    .order("ordem");

  return { ...(data as unknown as FechamentoItem), itens: itens ?? [] };
}

/* --------------------------- resumo p/ dashboard --------------------- */

export async function contarContabil(): Promise<{
  fechamentosAbertos: number;
  fechamentosAtrasados: number;
  entreguesMes: number;
}> {
  const supabase = await createSupabaseServerClient();
  const inicioMes = competenciaAtual();
  const compAnterior = deslocarCompetencia(inicioMes, -1);

  const [abertos, atrasados, entregues] = await Promise.all([
    supabase
      .from("fechamentos_contabeis")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(fechado,entregue)"),
    // considera atrasado o fechamento de uma competência já passada que
    // ainda não foi fechado nem entregue.
    supabase
      .from("fechamentos_contabeis")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(fechado,entregue)")
      .lt("competencia", compAnterior),
    supabase
      .from("fechamentos_contabeis")
      .select("id", { count: "exact", head: true })
      .eq("status", "entregue")
      .gte("entregue_em", inicioMes),
  ]);

  return {
    fechamentosAbertos: abertos.count ?? 0,
    fechamentosAtrasados: atrasados.count ?? 0,
    entreguesMes: entregues.count ?? 0,
  };
}

export async function empresasParaContabil(): Promise<EmpresaOpcao[]> {
  return empresasParaEscolha({ apenasAtivas: true, semMei: true });
}
