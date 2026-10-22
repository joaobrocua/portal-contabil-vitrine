import "server-only";

import { createSupabaseServerClient } from "@/core/db/server";
import { fetchTodos } from "@/core/db/pagination";
import type { EmpresaOpcao } from "@/core/types/empresa-opcao";

/**
 * Empresas para os seletores com busca dos formulários (tarefa, obrigação,
 * processo...). Traz todas — com paginação interna, porque o PostgREST corta
 * a resposta em 1000 linhas sem avisar — já que a busca é feita na tela.
 */
export async function empresasParaEscolha(
  filtros: { apenasAtivas?: boolean; semMei?: boolean } = {},
): Promise<EmpresaOpcao[]> {
  const supabase = await createSupabaseServerClient();
  const linhas = await fetchTodos((from, to) => {
    let q = supabase
      .from("empresas")
      .select("id, razao_social, nome_fantasia, cnpj")
      .order("razao_social")
      .order("id");
    if (filtros.apenasAtivas) q = q.eq("ativo", true);
    if (filtros.semMei) q = q.neq("regime_tributario", "mei");
    return q.range(from, to);
  });
  return linhas.map((e) => ({
    id: e.id,
    nome: e.nome_fantasia || e.razao_social,
    razao: e.razao_social,
    cnpj: e.cnpj,
  }));
}
