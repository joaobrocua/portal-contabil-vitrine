import "server-only";

import { filtroEmpresaNomeOuCnpj } from "@/core/db/busca";
import { createSupabaseServerClient } from "@/core/db/server";
import type { DocumentoAcessoRow, DocumentoRow } from "@/core/db/types";
import { buscarPagina, TAMANHO_PAGINA, type Pagina } from "@/core/lib/paginacao";
import type { Departamento } from "@/core/types/domain";

export interface DocumentoItem extends DocumentoRow {
  enviado: { nome: string } | null;
}

const LIMITE_PADRAO = 1000;

export async function listDocumentos(opts: {
  empresaId: string;
  departamento?: Departamento;
}): Promise<DocumentoItem[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("documentos")
    .select("*, enviado:profiles!documentos_enviado_por_fkey(nome)")
    .eq("empresa_id", opts.empresaId)
    .order("competencia", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (opts.departamento) q = q.eq("departamento", opts.departamento);
  q = q.limit(LIMITE_PADRAO);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DocumentoItem[];
}

export interface EmpresaPasta {
  id: string;
  nome: string;
  cnpj: string;
  total: number;
  pendentes: number;
}

/**
 * Uma página das pastas (empresas ativas, por razão social). `busca`
 * (higienizada) casa com razão social, nome fantasia ou CNPJ — feita no
 * banco, então funciona com qualquer quantidade de clientes.
 */
export async function paginarPastas(
  busca: string | undefined,
  pagina: number,
  tamanho = TAMANHO_PAGINA,
): Promise<Pagina<EmpresaPasta>> {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("empresas")
    .select("id, razao_social, nome_fantasia, cnpj", { count: "exact" })
    .eq("ativo", true)
    .order("razao_social")
    .order("id");
  if (busca) q = q.or(filtroEmpresaNomeOuCnpj(busca));
  const { data: empresas, error, count, pagina: efetiva } = await buscarPagina(
    (de, ate) => q.range(de, ate),
    pagina,
    tamanho,
  );
  if (error) throw new Error(error.message);
  const lista = empresas ?? [];

  // Contagens só das empresas desta página (a view agrega tudo no banco).
  const contagem = new Map<string, { total: number; pendentes: number }>();
  if (lista.length > 0) {
    const { data: contagens } = await supabase
      .from("documentos_contagem_por_empresa")
      .select("empresa_id, total, pendentes")
      .in("empresa_id", lista.map((e) => e.id));
    for (const c of contagens ?? []) contagem.set(c.empresa_id, { total: c.total, pendentes: c.pendentes });
  }

  return {
    itens: lista.map((e) => ({
      id: e.id,
      nome: e.nome_fantasia || e.razao_social,
      cnpj: e.cnpj,
      total: contagem.get(e.id)?.total ?? 0,
      pendentes: contagem.get(e.id)?.pendentes ?? 0,
    })),
    total: count ?? 0,
    pagina: efetiva,
    tamanho,
  };
}

export async function categoriasDocumento(): Promise<
  { valor: string; rotulo: string }[]
> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("catalogos")
    .select("valor, rotulo")
    .eq("tipo", "tipo_documento")
    .eq("ativo", true)
    .order("ordem");
  return data ?? [];
}

export interface AcessoDocumento {
  id: string;
  acao: DocumentoAcessoRow["acao"];
  created_at: string;
  pessoa: { nome: string } | null;
  /** Cópia gravada no acesso — continua legível se o documento for excluído. */
  documento_titulo: string | null;
  /** null quando o documento já foi excluído. */
  documento: { id: string; titulo: string } | null;
  empresa: { id: string; razao_social: string; nome_fantasia: string | null } | null;
}

/** Trilha LGPD: quem enviou/baixou qual documento, mais recentes primeiro. */
export async function listarAcessosDocumentos(
  opts: { limite?: number } = {},
): Promise<AcessoDocumento[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documento_acessos")
    .select(
      "id, acao, created_at, documento_titulo, pessoa:profiles(nome), documento:documentos(id, titulo), empresa:empresas(id, razao_social, nome_fantasia)",
    )
    .order("created_at", { ascending: false })
    .limit(opts.limite ?? 200);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AcessoDocumento[];
}

export async function getEmpresaNome(id: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("empresas")
    .select("razao_social, nome_fantasia")
    .eq("id", id)
    .maybeSingle();
  return data ? data.nome_fantasia || data.razao_social : null;
}
