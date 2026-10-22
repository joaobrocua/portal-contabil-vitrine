import "server-only";

import type { createSupabaseServerClient } from "./server";

export type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Filtro `or()` do PostgREST: razão social, nome fantasia ou CNPJ contém a
 * busca. O CNPJ é comparado só pelos dígitos (a pessoa pode digitar com ou
 * sem pontos e barra) e só a partir de 3 dígitos, para "12" não casar com
 * metade dos CNPJs. `busca` precisa vir higienizada (paramBusca).
 */
export function filtroEmpresaNomeOuCnpj(busca: string): string {
  const digitos = busca.replace(/\D/g, "");
  const partes = [`razao_social.ilike.*${busca}*`, `nome_fantasia.ilike.*${busca}*`];
  // Só conta como CNPJ se a pessoa digitou apenas números e pontuação; "Empresa 007" não deve casar com CNPJs que tenham 007.
  if (digitos.length >= 3 && /^[\d.\-/\s]+$/.test(busca)) partes.push(`cnpj.ilike.*${digitos}*`);
  return partes.join(",");
}

/**
 * Ids das empresas cujo nome (razão social ou fantasia) contém `busca` —
 * para listas que buscam "por empresa" direto no banco, com
 * `empresa_id.in.(…)`. `busca` precisa vir higienizada (paramBusca): ela
 * entra num filtro `or()` do PostgREST.
 */
export async function idsEmpresasPorNome(supabase: Supabase, busca: string): Promise<string[]> {
  const { data } = await supabase
    .from("empresas")
    .select("id")
    .or(filtroEmpresaNomeOuCnpj(busca))
    .limit(200);
  return (data ?? []).map((e) => e.id);
}

/**
 * Filtro `or()` "campo contém busca OU empresa é uma destas" — sem empresa
 * que case, só o campo.
 */
export function orCampoOuEmpresa(campo: string, busca: string, empresas: string[]): string {
  const partes = [`${campo}.ilike.*${busca}*`];
  if (empresas.length) partes.push(`empresa_id.in.(${empresas.join(",")})`);
  return partes.join(",");
}

/** Junta condições de busca para um `or()`; sem nenhuma, nada casa (null). */
export function orBusca(partes: (string | null)[]): string | null {
  const validas = partes.filter((p): p is string => !!p);
  return validas.length ? validas.join(",") : null;
}

/** `coluna.in.(a,b,…)`, ou null se a lista estiver vazia. */
export function inLista(coluna: string, ids: string[]): string | null {
  return ids.length ? `${coluna}.in.(${ids.join(",")})` : null;
}
