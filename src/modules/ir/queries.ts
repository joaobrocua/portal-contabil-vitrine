import "server-only";

import { idsEmpresasPorNome, inLista, orBusca, type Supabase } from "@/core/db/busca";
import { createSupabaseServerClient } from "@/core/db/server";
import type { DeclaracaoIrRow } from "@/core/db/types";
import { hojeISO } from "@/core/lib/format";
import { buscarPagina, TAMANHO_PAGINA, type Pagina } from "@/core/lib/paginacao";
import type { IrStatus, IrTipo } from "@/core/types/domain";

const LIMITE_PADRAO = 1000;

export interface DeclaracaoIrItem extends DeclaracaoIrRow {
  empresa: { id: string; razao_social: string; nome_fantasia: string | null } | null;
  socio: { id: string; nome: string } | null;
  responsavel: { nome: string } | null;
}

export interface DeclaracaoIrFiltros {
  ano?: number;
  tipo?: IrTipo;
  empresaId?: string;
  status?: IrStatus | "abertas";
}

const SEL =
  "*, empresa:empresas(id, razao_social, nome_fantasia), socio:socios(id, nome), responsavel:profiles!declaracoes_ir_responsavel_id_fkey(nome)";

function consultaDeclaracoes(supabase: Supabase, f: DeclaracaoIrFiltros, contar: boolean) {
  let q = supabase
    .from("declaracoes_ir")
    .select(SEL, contar ? { count: "exact" } : undefined)
    .order("prazo", { ascending: true, nullsFirst: false })
    .order("id");

  if (f.ano) q = q.eq("ano_exercicio", f.ano);
  if (f.tipo) q = q.eq("tipo", f.tipo);
  if (f.empresaId) q = q.eq("empresa_id", f.empresaId);
  if (f.status === "abertas")
    q = q.not("status", "in", "(entregue,dispensada)");
  else if (f.status) q = q.eq("status", f.status);
  return q;
}

/** Declarações de uma empresa (ficha da empresa) — lista curta, inteira. */
export async function listDeclaracoesIr(
  f: DeclaracaoIrFiltros = {},
): Promise<DeclaracaoIrItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await consultaDeclaracoes(supabase, f, false).limit(LIMITE_PADRAO);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DeclaracaoIrItem[];
}

/** Uma página de declarações; `busca` (higienizada) casa com empresa ou sócio. */
export async function paginarDeclaracoesIr(
  f: DeclaracaoIrFiltros & { busca?: string },
  pagina: number,
  tamanho = TAMANHO_PAGINA,
): Promise<Pagina<DeclaracaoIrItem>> {
  const supabase = await createSupabaseServerClient();
  let q = consultaDeclaracoes(supabase, f, true);
  if (f.busca) {
    const [empresas, socios] = await Promise.all([
      idsEmpresasPorNome(supabase, f.busca),
      supabase.from("socios").select("id").ilike("nome", `%${f.busca}%`).limit(200),
    ]);
    const cond = orBusca([
      inLista("empresa_id", empresas),
      inLista("socio_id", (socios.data ?? []).map((s) => s.id)),
    ]);
    if (!cond) return { itens: [], total: 0, pagina, tamanho };
    q = q.or(cond);
  }
  const { data, error, count, pagina: efetiva } = await buscarPagina((de, ate) => q.range(de, ate), pagina, tamanho);
  if (error) throw new Error(error.message);
  return { itens: (data ?? []) as unknown as DeclaracaoIrItem[], total: count ?? 0, pagina: efetiva, tamanho };
}

export async function getDeclaracaoIr(id: string): Promise<DeclaracaoIrItem | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("declaracoes_ir").select(SEL).eq("id", id).maybeSingle();
  return (data as unknown as DeclaracaoIrItem) ?? null;
}

/* --------------------------- resumo p/ dashboard --------------------- */

export async function contarIr(): Promise<{
  pendentes: number;
  atrasadas: number;
  entreguesAno: number;
}> {
  const supabase = await createSupabaseServerClient();
  const hoje = hojeISO();
  const anoAtual = Number(hoje.slice(0, 4));

  const [pendentes, atrasadas, entregues] = await Promise.all([
    supabase
      .from("declaracoes_ir")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(entregue,dispensada)"),
    supabase
      .from("declaracoes_ir")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(entregue,dispensada)")
      .lt("prazo", hoje),
    supabase
      .from("declaracoes_ir")
      .select("id", { count: "exact", head: true })
      .eq("status", "entregue")
      .eq("ano_exercicio", anoAtual),
  ]);

  return {
    pendentes: pendentes.count ?? 0,
    atrasadas: atrasadas.count ?? 0,
    entreguesAno: entregues.count ?? 0,
  };
}
