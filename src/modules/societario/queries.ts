import "server-only";

import { empresasParaEscolha } from "@/core/db/empresas-opcoes";
import type { EmpresaOpcao } from "@/core/types/empresa-opcao";
import { idsEmpresasPorNome, orCampoOuEmpresa, type Supabase } from "@/core/db/busca";
import { createSupabaseServerClient } from "@/core/db/server";
import type { ProcessoSocietarioItemRow, ProcessoSocietarioRow } from "@/core/db/types";
import { competenciaAtual } from "@/core/lib/format";
import { buscarPagina, TAMANHO_PAGINA, type Pagina } from "@/core/lib/paginacao";
import type { ProcessoSocietarioStatus, ProcessoSocietarioTipo } from "@/core/types/domain";

const LIMITE_PADRAO = 1000;

export interface ProcessoSocietarioItem extends ProcessoSocietarioRow {
  empresa: { id: string; razao_social: string; nome_fantasia: string | null } | null;
  responsavel: { nome: string } | null;
}

export interface ProcessoSocietarioFiltros {
  empresaId?: string;
  tipo?: ProcessoSocietarioTipo;
  status?: ProcessoSocietarioStatus | "abertos" | "todos";
}

const SEL =
  "*, empresa:empresas(id, razao_social, nome_fantasia), responsavel:profiles!processos_societarios_responsavel_id_fkey(nome)";

function consultaProcessos(supabase: Supabase, f: ProcessoSocietarioFiltros, contar: boolean) {
  let q = supabase
    .from("processos_societarios")
    .select(SEL, contar ? { count: "exact" } : undefined)
    .order("created_at", { ascending: false })
    .order("id");

  if (f.empresaId) q = q.eq("empresa_id", f.empresaId);
  if (f.tipo) q = q.eq("tipo", f.tipo);
  if (f.status === "abertos") q = q.not("status", "in", "(concluido,cancelado)");
  else if (f.status && f.status !== "todos") q = q.eq("status", f.status);
  return q;
}

/** Processos de uma empresa (ficha da empresa) — lista curta, inteira. */
export async function listProcessosSocietarios(
  f: ProcessoSocietarioFiltros = {},
): Promise<ProcessoSocietarioItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await consultaProcessos(supabase, f, false).limit(LIMITE_PADRAO);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProcessoSocietarioItem[];
}

/** Uma página de processos; `busca` (higienizada) casa com empresa ou protocolo. */
export async function paginarProcessosSocietarios(
  f: ProcessoSocietarioFiltros & { busca?: string },
  pagina: number,
  tamanho = TAMANHO_PAGINA,
): Promise<Pagina<ProcessoSocietarioItem>> {
  const supabase = await createSupabaseServerClient();
  let q = consultaProcessos(supabase, f, true);
  if (f.busca) {
    const empresas = await idsEmpresasPorNome(supabase, f.busca);
    q = q.or(orCampoOuEmpresa("protocolo", f.busca, empresas));
  }
  const { data, error, count, pagina: efetiva } = await buscarPagina(
    (de, ate) => q.range(de, ate),
    pagina,
    tamanho,
  );
  if (error) throw new Error(error.message);
  return { itens: (data ?? []) as unknown as ProcessoSocietarioItem[], total: count ?? 0, pagina: efetiva, tamanho };
}

export interface ProcessoSocietarioDetalhe extends ProcessoSocietarioItem {
  itens: ProcessoSocietarioItemRow[];
}

export async function getProcessoSocietario(
  id: string,
): Promise<ProcessoSocietarioDetalhe | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("processos_societarios")
    .select(SEL)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const { data: itens } = await supabase
    .from("processo_societario_itens")
    .select("*")
    .eq("processo_id", id)
    .order("ordem");

  return { ...(data as unknown as ProcessoSocietarioItem), itens: itens ?? [] };
}

/* --------------------------- resumo p/ dashboard --------------------- */

export async function contarSocietario(): Promise<{
  processosAbertos: number;
  aguardandoOrgao: number;
  concluidosMes: number;
}> {
  const supabase = await createSupabaseServerClient();
  const inicioMes = competenciaAtual();

  const [abertos, aguardando, concluidos] = await Promise.all([
    supabase
      .from("processos_societarios")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(concluido,cancelado)"),
    supabase
      .from("processos_societarios")
      .select("id", { count: "exact", head: true })
      .eq("status", "aguardando_orgao"),
    supabase
      .from("processos_societarios")
      .select("id", { count: "exact", head: true })
      .eq("status", "concluido")
      .gte("concluido_em", inicioMes),
  ]);

  return {
    processosAbertos: abertos.count ?? 0,
    aguardandoOrgao: aguardando.count ?? 0,
    concluidosMes: concluidos.count ?? 0,
  };
}

// Sem filtro de "ativo": diferente de Fiscal/Pessoal, o Societário lida
// justamente com empresas em abertura ou em processo de baixa — que não
// costumam estar com ativo=true.
export async function empresasParaSocietario(): Promise<EmpresaOpcao[]> {
  return empresasParaEscolha();
}
