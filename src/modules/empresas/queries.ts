import "server-only";

import { createSupabaseServerClient } from "@/core/db/server";
import { buscarPagina, TAMANHO_PAGINA, type Pagina } from "@/core/lib/paginacao";
import type {
  ContatoRow,
  EmpresaRow,
  ProfileRow,
  SocioRow,
} from "@/core/db/types";

export interface EmpresaListItem
  extends Pick<
    EmpresaRow,
    | "id"
    | "razao_social"
    | "nome_fantasia"
    | "cnpj"
    | "regime_tributario"
    | "situacao"
    | "municipio"
    | "uf"
    | "ativo"
  > {
  responsavel: { nome: string } | null;
}

/** Uma página da lista de empresas; `busca` (higienizada) casa com nome ou CNPJ. */
export async function paginarEmpresas(
  opts: { busca?: string; incluirInativas?: boolean },
  pagina: number,
  tamanho = TAMANHO_PAGINA,
): Promise<Pagina<EmpresaListItem>> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("empresas")
    .select(
      "id, razao_social, nome_fantasia, cnpj, regime_tributario, situacao, municipio, uf, ativo, responsavel:profiles!empresas_responsavel_id_fkey(nome)",
      { count: "exact" },
    )
    .order("razao_social", { ascending: true })
    .order("id");

  if (!opts?.incluirInativas) query = query.eq("ativo", true);

  const busca = opts?.busca?.trim();
  if (busca) {
    const digits = busca.replace(/\D/g, "");
    const ors = [
      `razao_social.ilike.*${busca}*`,
      `nome_fantasia.ilike.*${busca}*`,
    ];
    if (digits.length >= 3) ors.push(`cnpj.ilike.*${digits}*`);
    query = query.or(ors.join(","));
  }

  const { data, error, count, pagina: efetiva } = await buscarPagina(
    (de, ate) => query.range(de, ate),
    pagina,
    tamanho,
  );
  if (error) throw new Error(error.message);
  return { itens: (data ?? []) as unknown as EmpresaListItem[], total: count ?? 0, pagina: efetiva, tamanho };
}

export async function getEmpresa(id: string): Promise<EmpresaRow | null> {
  const supabase = await createSupabaseServerClient();
  // empresas_com_honorario (view): mesmas colunas, mas honorario_mensal só
  // vem preenchido pra admin — ver migration 0022.
  const { data } = await supabase
    .from("empresas_com_honorario")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

export async function getSocios(empresaId: string): Promise<SocioRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("socios")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("administrador", { ascending: false })
    .order("nome");
  return data ?? [];
}

export interface ContatoComAcesso extends ContatoRow {
  acesso: { nome: string; papel: string; ativo: boolean } | null;
}

export async function getContatos(
  empresaId: string,
): Promise<ContatoComAcesso[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("contatos")
    .select(
      "*, acesso:profiles!contatos_profile_id_fkey(nome, papel, ativo)",
    )
    .eq("empresa_id", empresaId)
    .order("nome");
  return (data ?? []) as unknown as ContatoComAcesso[];
}

/** Perfis internos ativos — para o seletor de responsável. */
export async function getResponsaveis(): Promise<
  Pick<ProfileRow, "id" | "nome" | "papel">[]
> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, nome, papel")
    .neq("papel", "cliente")
    .eq("ativo", true)
    .order("nome");
  return data ?? [];
}

export type EmpresaClienteItem = Pick<
  EmpresaRow,
  "id" | "razao_social" | "nome_fantasia" | "cnpj" | "situacao" | "regime_tributario"
>;

/**
 * Empresas que o usuário logado (papel "cliente") pode ver — via `contatos`.
 * Uma pessoa pode ser contato de mais de uma empresa. A RLS já restringe
 * isso por si só (empresa_visivel); aqui só formatamos pro dashboard.
 */
export async function empresasDoCliente(profileId: string): Promise<EmpresaClienteItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("contatos")
    .select(
      "empresa:empresas(id, razao_social, nome_fantasia, cnpj, situacao, regime_tributario)",
    )
    .eq("profile_id", profileId);

  const vistas = new Map<string, EmpresaClienteItem>();
  for (const row of (data ?? []) as unknown as { empresa: EmpresaClienteItem | null }[]) {
    if (row.empresa) vistas.set(row.empresa.id, row.empresa);
  }
  return Array.from(vistas.values()).sort((a, b) =>
    (a.nome_fantasia || a.razao_social).localeCompare(b.nome_fantasia || b.razao_social),
  );
}

export async function contarEmpresas(): Promise<{
  ativas: number;
  total: number;
}> {
  const supabase = await createSupabaseServerClient();
  const [{ count: total }, { count: ativas }] = await Promise.all([
    supabase.from("empresas").select("id", { count: "exact", head: true }),
    supabase
      .from("empresas")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true),
  ]);
  return { ativas: ativas ?? 0, total: total ?? 0 };
}
