import "server-only";

import { empresasParaEscolha } from "@/core/db/empresas-opcoes";
import type { EmpresaOpcao } from "@/core/types/empresa-opcao";
import { idsEmpresasPorNome, orCampoOuEmpresa, type Supabase } from "@/core/db/busca";
import { createSupabaseServerClient } from "@/core/db/server";
import { competenciaAtual, hojeISO } from "@/core/lib/format";
import { buscarPagina, TAMANHO_PAGINA, type Pagina } from "@/core/lib/paginacao";
import type {
  DocumentoRow,
  TarefaItemRow,
  TarefaRow,
  TarefaTemplateRow,
} from "@/core/db/types";
import type { Departamento, TarefaStatus } from "@/core/types/domain";

export interface TarefaListItem extends TarefaRow {
  empresa: { id: string; razao_social: string; nome_fantasia: string | null } | null;
  responsavel: { nome: string } | null;
  itens_total: number;
  itens_feitos: number;
}

export interface TarefaFiltros {
  status?: TarefaStatus | "abertas";
  departamento?: Departamento;
  empresaId?: string;
  responsavelId?: string;
  /** Já higienizada (paramBusca): casa com o título ou com o nome da empresa. */
  busca?: string;
  /** Só tarefas com prazo definido (parede de prazos do painel). */
  comPrazo?: boolean;
}

const SELECT =
  "*, empresa:empresas(id, razao_social, nome_fantasia), responsavel:profiles!tarefas_responsavel_id_fkey(nome), tarefa_itens(feito)";

function withProgress(rows: unknown[]): TarefaListItem[] {
  return (rows as (TarefaRow & {
    empresa: TarefaListItem["empresa"];
    responsavel: TarefaListItem["responsavel"];
    tarefa_itens: { feito: boolean }[];
  })[]).map((r) => {
    const itens = r.tarefa_itens ?? [];
    const { tarefa_itens: _omit, ...rest } = r;
    void _omit;
    return {
      ...rest,
      itens_total: itens.length,
      itens_feitos: itens.filter((i) => i.feito).length,
    };
  });
}

/**
 * Monta a consulta com os filtros — o banco filtra, não o navegador.
 * `empresasBusca` vem de idsEmpresasPorNome, resolvida antes: a consulta não
 * pode passar por um await aqui, senão é executada sem o limit/range.
 */
function consultaTarefas(
  supabase: Supabase,
  f: TarefaFiltros,
  empresasBusca: string[],
  contar: boolean,
) {
  let query = supabase
    .from("tarefas")
    .select(SELECT, contar ? { count: "exact" } : undefined)
    .order("prazo", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id");

  if (f.status === "abertas") {
    query = query.not("status", "in", "(concluida,cancelada)");
  } else if (f.status) {
    query = query.eq("status", f.status);
  }
  if (f.departamento) query = query.eq("departamento", f.departamento);
  if (f.empresaId) query = query.eq("empresa_id", f.empresaId);
  if (f.responsavelId) query = query.eq("responsavel_id", f.responsavelId);
  if (f.comPrazo) query = query.not("prazo", "is", null);
  if (f.busca) {
    query = query.or(orCampoOuEmpresa("titulo", f.busca, empresasBusca));
  }
  return query;
}

/** Poucas tarefas, já na ordem de prazo (painel, área do cliente). */
export async function listTarefas(
  f: TarefaFiltros = {},
  limite = 100,
): Promise<TarefaListItem[]> {
  const supabase = await createSupabaseServerClient();
  const empresas = f.busca ? await idsEmpresasPorNome(supabase, f.busca) : [];
  const { data, error } = await consultaTarefas(supabase, f, empresas, false).limit(limite);
  if (error) throw new Error(error.message);
  return withProgress(data ?? []);
}

/** Uma página da lista de tarefas, com o total real para a paginação. */
export async function paginarTarefas(
  f: TarefaFiltros,
  pagina: number,
  tamanho = TAMANHO_PAGINA,
): Promise<Pagina<TarefaListItem>> {
  const supabase = await createSupabaseServerClient();
  const empresas = f.busca ? await idsEmpresasPorNome(supabase, f.busca) : [];
  const { data, error, count, pagina: efetiva } = await buscarPagina(
    (de, ate) => consultaTarefas(supabase, f, empresas, true).range(de, ate),
    pagina,
    tamanho,
  );
  if (error) throw new Error(error.message);
  return { itens: withProgress(data ?? []), total: count ?? 0, pagina: efetiva, tamanho };
}

export interface TarefaDetalhe extends TarefaRow {
  empresa: { id: string; razao_social: string; nome_fantasia: string | null } | null;
  responsavel: { id: string; nome: string } | null;
  criador: { nome: string } | null;
  itens: TarefaItemRow[];
}

export async function getTarefa(id: string): Promise<TarefaDetalhe | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("tarefas")
    .select(
      "*, empresa:empresas(id, razao_social, nome_fantasia), responsavel:profiles!tarefas_responsavel_id_fkey(id, nome), criador:profiles!tarefas_criado_por_fkey(nome), itens:tarefa_itens(*)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const d = data as unknown as TarefaDetalhe;
  d.itens = [...(d.itens ?? [])].sort((a, b) => a.ordem - b.ordem);
  return d;
}

export async function contarTarefas(): Promise<{
  abertas: number;
  atrasadas: number;
  aguardandoCliente: number;
  concluidasMes: number;
}> {
  const supabase = await createSupabaseServerClient();
  const hoje = hojeISO();
  const inicioMes = competenciaAtual();

  const [abertas, atrasadas, aguardando, concluidas] = await Promise.all([
    supabase
      .from("tarefas")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(concluida,cancelada)"),
    supabase
      .from("tarefas")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(concluida,cancelada)")
      .lt("prazo", hoje),
    supabase
      .from("tarefas")
      .select("id", { count: "exact", head: true })
      .eq("status", "aguardando_cliente"),
    supabase
      .from("tarefas")
      .select("id", { count: "exact", head: true })
      .eq("status", "concluida")
      .gte("concluida_em", inicioMes),
  ]);

  return {
    abertas: abertas.count ?? 0,
    atrasadas: atrasadas.count ?? 0,
    aguardandoCliente: aguardando.count ?? 0,
    concluidasMes: concluidas.count ?? 0,
  };
}

/* ------------------------------ modelos ---------------------------- */

export async function listModelos(
  opts: { apenasAtivos?: boolean } = {},
): Promise<TarefaTemplateRow[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase.from("tarefa_templates").select("*").order("nome");
  if (opts.apenasAtivos) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getModelo(id: string): Promise<TarefaTemplateRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("tarefa_templates")
    .select("*")
    .eq("id", id)
    .eq("ativo", true)
    .maybeSingle();
  return data ?? null;
}

/* ------------------------ documentos vinculados -------------------- */

/** Mesmo formato do `DocumentoItem` da Central de Documentos. */
export type DocumentoVinculado = DocumentoRow & { enviado: { nome: string } | null };

export async function documentosDaTarefa(
  tarefaId: string,
): Promise<DocumentoVinculado[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tarefa_documentos")
    .select(
      "created_at, documento:documentos(*, enviado:profiles!documentos_enviado_por_fkey(nome))",
    )
    .eq("tarefa_id", tarefaId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as { documento: DocumentoVinculado | null }[])
    .map((r) => r.documento)
    .filter((d): d is DocumentoVinculado => d != null);
}

/** Empresas ativas para os seletores de tarefa. */
export async function empresasParaSelecao(): Promise<EmpresaOpcao[]> {
  return empresasParaEscolha({ apenasAtivas: true });
}
