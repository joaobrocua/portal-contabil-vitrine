import "server-only";

/**
 * O PostgREST corta toda resposta em `PGRST_DB_MAX_ROWS` linhas (1000 nesta
 * instalação, self-hosted e nuvem) — sem aviso nem erro, a query só volta
 * com as primeiras 1000 e pronto. Pra listas paginadas na tela isso é o
 * limite normal de página; pra uma busca que precisa de "todas as linhas
 * que baterem o filtro" (ex.: painel de Pendências, grade anual), é dado
 * sumindo caladamente assim que o escritório cresce.
 *
 * Usa isto sempre que a busca não for uma lista paginada de UI — ela pagina
 * sozinha, nos bastidores, até esgotar os resultados.
 */
const TAMANHO_PAGINA = 1000;

interface RespostaPagina<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export async function fetchTodos<T>(
  pagina: (from: number, to: number) => PromiseLike<RespostaPagina<T>>,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await pagina(from, from + TAMANHO_PAGINA - 1);
    if (error) throw new Error(error.message);
    const linhas = data ?? [];
    out.push(...linhas);
    if (linhas.length < TAMANHO_PAGINA) break;
    from += TAMANHO_PAGINA;
  }
  return out;
}
