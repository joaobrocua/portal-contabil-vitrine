import "server-only";

import { empresasParaEscolha } from "@/core/db/empresas-opcoes";
import type { EmpresaOpcao } from "@/core/types/empresa-opcao";
import { fetchTodos } from "@/core/db/pagination";
import { idsEmpresasPorNome, inLista, orBusca, type Supabase } from "@/core/db/busca";
import { createSupabaseServerClient } from "@/core/db/server";
import type { ObrigacaoRecorrenciaRow, ObrigacaoRow } from "@/core/db/types";
import { hojeISO, somarDias } from "@/core/lib/format";
import { buscarPagina, TAMANHO_PAGINA, type Pagina } from "@/core/lib/paginacao";
import {
  estadoObrigacao,
  OBRIGACAO_TIPO_CURTO,
  type GradeEstado,
  type ObrigacaoStatus,
  type ObrigacaoTipo,
} from "@/core/types/domain";

export interface ObrigacaoItem extends ObrigacaoRow {
  empresa: { id: string; razao_social: string; nome_fantasia: string | null } | null;
  responsavel: { nome: string } | null;
}

export interface ObrigacaoFiltros {
  competencia?: string;
  empresaId?: string;
  tipo?: ObrigacaoTipo;
  status?: ObrigacaoStatus | "abertas" | "atrasadas";
  responsavelId?: string;
}

const SEL =
  "*, empresa:empresas(id, razao_social, nome_fantasia), responsavel:profiles!obrigacoes_responsavel_id_fkey(nome)";

const LIMITE_PADRAO = 1000;

function consultaObrigacoes(supabase: Supabase, f: ObrigacaoFiltros, contar: boolean) {
  let q = supabase
    .from("obrigacoes")
    .select(SEL, contar ? { count: "exact" } : undefined)
    .order("vencimento", { ascending: true })
    .order("id");

  if (f.competencia) q = q.eq("competencia", f.competencia);
  if (f.empresaId) q = q.eq("empresa_id", f.empresaId);
  if (f.tipo) q = q.eq("tipo", f.tipo);
  if (f.responsavelId) q = q.eq("responsavel_id", f.responsavelId);
  if (f.status === "abertas")
    q = q.not("status", "in", "(entregue,paga,dispensada)");
  else if (f.status === "atrasadas")
    q = q
      .not("status", "in", "(entregue,paga,dispensada)")
      .lt("vencimento", hojeISO());
  else if (f.status) q = q.eq("status", f.status);
  return q;
}

/** Obrigações de uma empresa (ficha, área do cliente) — lista curta, inteira. */
export async function listObrigacoes(
  f: ObrigacaoFiltros = {},
): Promise<ObrigacaoItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await consultaObrigacoes(supabase, f, false).limit(LIMITE_PADRAO);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ObrigacaoItem[];
}

/** Uma página de obrigações; `busca` (higienizada) casa com o tipo (DAS, FGTS…) ou a empresa. */
export async function paginarObrigacoes(
  f: ObrigacaoFiltros & { busca?: string },
  pagina: number,
  tamanho = TAMANHO_PAGINA,
): Promise<Pagina<ObrigacaoItem>> {
  const supabase = await createSupabaseServerClient();
  let q = consultaObrigacoes(supabase, f, true);
  if (f.busca) {
    const termo = f.busca.toLowerCase();
    const tipos = (Object.keys(OBRIGACAO_TIPO_CURTO) as ObrigacaoTipo[]).filter((t) =>
      OBRIGACAO_TIPO_CURTO[t].toLowerCase().includes(termo),
    );
    const cond = orBusca([
      inLista("tipo", tipos),
      inLista("empresa_id", await idsEmpresasPorNome(supabase, f.busca)),
    ]);
    if (!cond) return { itens: [], total: 0, pagina, tamanho };
    q = q.or(cond);
  }
  const { data, error, count, pagina: efetiva } = await buscarPagina(
    (de, ate) => q.range(de, ate),
    pagina,
    tamanho,
  );
  if (error) throw new Error(error.message);
  return { itens: (data ?? []) as unknown as ObrigacaoItem[], total: count ?? 0, pagina: efetiva, tamanho };
}

export async function getObrigacao(id: string): Promise<ObrigacaoItem | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("obrigacoes")
    .select(SEL)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as ObrigacaoItem) ?? null;
}

/* ------------------------------ Grade anual ----------------------- */

export interface GradeLinha {
  empresa: { id: string; nome: string };
  meses: {
    mes: number; // 1-12
    estado: GradeEstado;
    total: number;
    ok: number;
    atraso: number;
  }[];
}

/**
 * Uma página da grade (empresas ativas em ordem alfabética; `busca`
 * higienizada filtra pelo nome). Busca só as obrigações das empresas da
 * página — antes vinha o ano inteiro de todas, dezenas de milhares de linhas.
 */
export async function gradeAnual(
  ano: number,
  pagina = 1,
  busca?: string,
  tamanho = TAMANHO_PAGINA,
): Promise<Pagina<GradeLinha>> {
  const supabase = await createSupabaseServerClient();

  let qEmpresas = supabase
    .from("empresas")
    .select("id, razao_social, nome_fantasia", { count: "exact" })
    .eq("ativo", true)
    .order("razao_social")
    .order("id");
  if (busca) qEmpresas = qEmpresas.or(`razao_social.ilike.*${busca}*,nome_fantasia.ilike.*${busca}*`);
  const { data: empresasData, error, count, pagina: efetiva } = await buscarPagina(
    (de, ate) => qEmpresas.range(de, ate),
    pagina,
    tamanho,
  );
  if (error) throw new Error(error.message);
  const empresas = empresasData ?? [];
  if (!empresas.length) return { itens: [], total: count ?? 0, pagina: efetiva, tamanho };

  // fetchTodos: 50 empresas × recorrências × 12 meses ainda pode passar de
  // 1000 linhas — sem paginar, o PostgREST corta caladamente e a grade
  // mostra meses "vazios" errados.
  const obrigacoes = await fetchTodos((from, to) =>
    supabase
      .from("obrigacoes")
      .select("empresa_id, competencia, status, vencimento")
      .in("empresa_id", empresas.map((e) => e.id))
      .gte("competencia", `${ano}-01-01`)
      .lte("competencia", `${ano}-12-01`)
      .order("id")
      .range(from, to),
  );

  const porEmpresaMes = new Map<string, ObrigacaoRow[]>();
  for (const o of obrigacoes as Pick<
    ObrigacaoRow,
    "empresa_id" | "competencia" | "status" | "vencimento"
  >[]) {
    const mes = Number(o.competencia.slice(5, 7));
    const k = `${o.empresa_id}-${mes}`;
    const arr = porEmpresaMes.get(k) ?? [];
    arr.push(o as ObrigacaoRow);
    porEmpresaMes.set(k, arr);
  }

  const itens = empresas.map((e) => ({
    empresa: { id: e.id, nome: e.nome_fantasia || e.razao_social },
    meses: Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const lista = porEmpresaMes.get(`${e.id}-${mes}`) ?? [];
      if (lista.length === 0)
        return { mes, estado: "vazio" as GradeEstado, total: 0, ok: 0, atraso: 0 };
      let ok = 0;
      let atraso = 0;
      for (const o of lista) {
        const est = estadoObrigacao(
          o.status as ObrigacaoStatus,
          o.vencimento,
        );
        if (est === "ok") ok += 1;
        else if (est === "atraso") atraso += 1;
      }
      const estado: GradeEstado =
        atraso > 0 ? "atraso" : ok === lista.length ? "ok" : "andamento";
      return { mes, estado, total: lista.length, ok, atraso };
    }),
  }));
  return { itens, total: count ?? 0, pagina, tamanho };
}

/* --------------------------- Recorrências ----------------------- */

export interface RecorrenciaItem extends ObrigacaoRecorrenciaRow {
  empresa: { razao_social: string; nome_fantasia: string | null } | null;
  responsavel: { nome: string } | null;
}

export async function listRecorrencias(
  empresaId?: string,
): Promise<RecorrenciaItem[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("obrigacao_recorrencias")
    .select(
      "*, empresa:empresas(razao_social, nome_fantasia), responsavel:profiles!obrigacao_recorrencias_responsavel_id_fkey(nome)",
    )
    .order("tipo");
  if (empresaId) q = q.eq("empresa_id", empresaId);
  const { data } = await q;
  return (data ?? []) as unknown as RecorrenciaItem[];
}

/* ----------------------- Resumo p/ dashboard -------------------- */

export async function contarObrigacoes(): Promise<{
  abertas: number;
  atrasadas: number;
  venceSemana: number;
}> {
  const supabase = await createSupabaseServerClient();
  const iso = hojeISO();
  const em7 = somarDias(iso, 7);
  const abertoFiltro = "(entregue,paga,dispensada)";

  const [abertas, atrasadas, semana] = await Promise.all([
    supabase
      .from("obrigacoes")
      .select("id", { count: "exact", head: true })
      .not("status", "in", abertoFiltro),
    supabase
      .from("obrigacoes")
      .select("id", { count: "exact", head: true })
      .not("status", "in", abertoFiltro)
      .lt("vencimento", iso),
    supabase
      .from("obrigacoes")
      .select("id", { count: "exact", head: true })
      .not("status", "in", abertoFiltro)
      .gte("vencimento", iso)
      .lte("vencimento", em7),
  ]);

  return {
    abertas: abertas.count ?? 0,
    atrasadas: atrasadas.count ?? 0,
    venceSemana: semana.count ?? 0,
  };
}

/** Contagem de obrigações atrasadas por empresa (para Pendências). */
export async function obrigacoesAtrasadasPorEmpresa(): Promise<
  Map<string, number>
> {
  const supabase = await createSupabaseServerClient();
  const data = await fetchTodos((from, to) =>
    supabase
      .from("obrigacoes")
      .select("empresa_id, vencimento, status")
      .not("status", "in", "(entregue,paga,dispensada)")
      .lt("vencimento", hojeISO())
      .order("id")
      .range(from, to),
  );
  const m = new Map<string, number>();
  for (const o of data) m.set(o.empresa_id, (m.get(o.empresa_id) ?? 0) + 1);
  return m;
}

export async function empresasParaFiscal(): Promise<EmpresaOpcao[]> {
  return empresasParaEscolha({ apenasAtivas: true });
}
