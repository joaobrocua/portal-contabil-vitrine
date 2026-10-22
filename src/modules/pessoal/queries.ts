import "server-only";

import { empresasParaEscolha } from "@/core/db/empresas-opcoes";
import type { EmpresaOpcao } from "@/core/types/empresa-opcao";
import { fetchTodos } from "@/core/db/pagination";
import { idsEmpresasPorNome, orCampoOuEmpresa, type Supabase } from "@/core/db/busca";
import { createSupabaseServerClient } from "@/core/db/server";
import type { EventoDpItemRow, FuncionarioRow } from "@/core/db/types";
import { competenciaAtual } from "@/core/lib/format";
import { buscarPagina, TAMANHO_PAGINA, type Pagina } from "@/core/lib/paginacao";
import type {
  EventoDpStatus,
  EventoDpTipo,
  FuncionarioStatus,
} from "@/core/types/domain";

const LIMITE_PADRAO = 1000;

/* ----------------------------- funcionários ----------------------- */

export interface FuncionarioItem extends FuncionarioRow {
  empresa: { id: string; razao_social: string; nome_fantasia: string | null } | null;
}

export interface FuncionarioFiltros {
  empresaId?: string;
  status?: FuncionarioStatus | "todos";
  busca?: string;
}

function consultaFuncionarios(
  supabase: Supabase,
  f: FuncionarioFiltros,
  empresasBusca: string[],
  contar: boolean,
) {
  let q = supabase
    .from("funcionarios")
    .select("*, empresa:empresas(id, razao_social, nome_fantasia)", contar ? { count: "exact" } : undefined)
    .order("nome")
    .order("id");

  if (f.empresaId) q = q.eq("empresa_id", f.empresaId);
  if (f.status && f.status !== "todos") q = q.eq("status", f.status);
  if (f.busca) q = q.or(orCampoOuEmpresa("nome", f.busca, empresasBusca));
  return q;
}

/** Funcionários de uma empresa (ficha da empresa) — lista curta, inteira. */
export async function listFuncionarios(
  f: FuncionarioFiltros = {},
): Promise<FuncionarioItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await consultaFuncionarios(supabase, f, [], false).limit(LIMITE_PADRAO);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FuncionarioItem[];
}

/** Uma página de funcionários; `busca` (higienizada) casa com nome ou empresa. */
export async function paginarFuncionarios(
  f: FuncionarioFiltros,
  pagina: number,
  tamanho = TAMANHO_PAGINA,
): Promise<Pagina<FuncionarioItem>> {
  const supabase = await createSupabaseServerClient();
  const empresas = f.busca ? await idsEmpresasPorNome(supabase, f.busca) : [];
  const { data, error, count, pagina: efetiva } = await buscarPagina(
    (de, ate) => consultaFuncionarios(supabase, f, empresas, true).range(de, ate),
    pagina,
    tamanho,
  );
  if (error) throw new Error(error.message);
  return { itens: (data ?? []) as unknown as FuncionarioItem[], total: count ?? 0, pagina: efetiva, tamanho };
}

export async function getFuncionario(
  id: string,
): Promise<FuncionarioItem | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("funcionarios")
    .select("*, empresa:empresas(id, razao_social, nome_fantasia)")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as FuncionarioItem) ?? null;
}

/* ------------------------------ processos --------------------------- */

export interface EventoDpItem extends EventoDpRowWithRel {
  empresa: { id: string; razao_social: string; nome_fantasia: string | null } | null;
  funcionario: { id: string; nome: string } | null;
  responsavel: { nome: string } | null;
}

type EventoDpRowWithRel = {
  id: string;
  empresa_id: string;
  funcionario_id: string | null;
  tipo: EventoDpTipo;
  competencia: string | null;
  data_referencia: string | null;
  status: EventoDpStatus;
  detalhe: string | null;
  responsavel_id: string | null;
  solicitado_por: string | null;
  concluido_em: string | null;
  created_at: string;
  updated_at: string;
};

export interface EventoDpFiltros {
  empresaId?: string;
  tipo?: EventoDpTipo;
  status?: EventoDpStatus | "abertos" | "todos";
  funcionarioId?: string;
}

const EVENTO_SEL =
  "*, empresa:empresas(id, razao_social, nome_fantasia), funcionario:funcionarios(id, nome), responsavel:profiles!eventos_dp_responsavel_id_fkey(nome)";

function consultaEventosDp(supabase: Supabase, f: EventoDpFiltros, contar: boolean) {
  let q = supabase
    .from("eventos_dp")
    .select(EVENTO_SEL, contar ? { count: "exact" } : undefined)
    .order("created_at", { ascending: false })
    .order("id");

  if (f.empresaId) q = q.eq("empresa_id", f.empresaId);
  if (f.tipo) q = q.eq("tipo", f.tipo);
  if (f.funcionarioId) q = q.eq("funcionario_id", f.funcionarioId);
  if (f.status === "abertos")
    q = q.not("status", "in", "(concluido,cancelado)");
  else if (f.status && f.status !== "todos") q = q.eq("status", f.status);
  return q;
}

/** Processos de um funcionário (ficha dele) — lista curta, inteira. */
export async function listEventosDp(
  f: EventoDpFiltros = {},
): Promise<EventoDpItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await consultaEventosDp(supabase, f, false).limit(LIMITE_PADRAO);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EventoDpItem[];
}

/** Uma página de processos; `busca` (higienizada) casa com empresa ou funcionário. */
export async function paginarEventosDp(
  f: EventoDpFiltros & { busca?: string },
  pagina: number,
  tamanho = TAMANHO_PAGINA,
): Promise<Pagina<EventoDpItem>> {
  const supabase = await createSupabaseServerClient();
  let q = consultaEventosDp(supabase, f, true);
  if (f.busca) {
    const [empresas, funcionarios] = await Promise.all([
      idsEmpresasPorNome(supabase, f.busca),
      supabase.from("funcionarios").select("id").ilike("nome", `%${f.busca}%`).limit(200),
    ]);
    const idsFunc = (funcionarios.data ?? []).map((x) => x.id);
    const partes = [
      ...(empresas.length ? [`empresa_id.in.(${empresas.join(",")})`] : []),
      ...(idsFunc.length ? [`funcionario_id.in.(${idsFunc.join(",")})`] : []),
    ];
    if (!partes.length) return { itens: [], total: 0, pagina, tamanho };
    q = q.or(partes.join(","));
  }
  const { data, error, count, pagina: efetiva } = await buscarPagina(
    (de, ate) => q.range(de, ate),
    pagina,
    tamanho,
  );
  if (error) throw new Error(error.message);
  return { itens: (data ?? []) as unknown as EventoDpItem[], total: count ?? 0, pagina: efetiva, tamanho };
}

export interface EventoDpDetalhe extends EventoDpItem {
  itens: EventoDpItemRow[];
}

export async function getEventoDp(id: string): Promise<EventoDpDetalhe | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("eventos_dp")
    .select(`${EVENTO_SEL}, itens:evento_dp_itens(*)`)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const d = data as unknown as EventoDpDetalhe;
  d.itens = [...(d.itens ?? [])].sort((a, b) => a.ordem - b.ordem);
  return d;
}

/* -------------------------------- folhas ----------------------------- */

export interface FolhaItem {
  id: string;
  empresa_id: string;
  competencia: string;
  status: string;
  qtd_funcionarios: number | null;
  observacao: string | null;
  fechada_em: string | null;
  empresa: { id: string; razao_social: string; nome_fantasia: string | null } | null;
}

export async function listFolhas(opts: {
  competencia: string;
}): Promise<FolhaItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("folhas")
    .select("*, empresa:empresas(id, razao_social, nome_fantasia)")
    .eq("competencia", opts.competencia)
    .order("empresa_id");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FolhaItem[];
}

/* --------------------------- resumo p/ dashboard --------------------- */

export async function contarPessoal(): Promise<{
  funcionariosAtivos: number;
  processosAbertos: number;
  admissoesMes: number;
  folhasAbertas: number;
}> {
  const supabase = await createSupabaseServerClient();
  const inicioMes = competenciaAtual();

  const [ativos, processos, admissoes, folhasAbertas] = await Promise.all([
    supabase
      .from("funcionarios")
      .select("id", { count: "exact", head: true })
      .eq("status", "ativo"),
    supabase
      .from("eventos_dp")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(concluido,cancelado)"),
    supabase
      .from("eventos_dp")
      .select("id", { count: "exact", head: true })
      .eq("tipo", "admissao")
      .gte("created_at", inicioMes),
    supabase
      .from("folhas")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(fechada,transmitida)"),
  ]);

  return {
    funcionariosAtivos: ativos.count ?? 0,
    processosAbertos: processos.count ?? 0,
    admissoesMes: admissoes.count ?? 0,
    folhasAbertas: folhasAbertas.count ?? 0,
  };
}

/** Processos de DP em aberto por empresa (para Pendências). */
export async function processosAbertosPorEmpresa(): Promise<Map<string, number>> {
  const supabase = await createSupabaseServerClient();
  const data = await fetchTodos((from, to) =>
    supabase
      .from("eventos_dp")
      .select("empresa_id, status")
      .not("status", "in", "(concluido,cancelado)")
      .range(from, to),
  );
  const m = new Map<string, number>();
  for (const e of data) m.set(e.empresa_id, (m.get(e.empresa_id) ?? 0) + 1);
  return m;
}

export async function empresasParaPessoal(): Promise<EmpresaOpcao[]> {
  return empresasParaEscolha({ apenasAtivas: true });
}

export async function funcionariosParaSelecao(
  empresaId?: string,
): Promise<{ id: string; nome: string }[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("funcionarios")
    .select("id, nome")
    .neq("status", "desligado")
    .order("nome");
  if (empresaId) q = q.eq("empresa_id", empresaId);
  const { data } = await q;
  return data ?? [];
}
