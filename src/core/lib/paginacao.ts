/**
 * Paginação das listas no servidor.
 *
 * Antes, as listas buscavam até 1000 linhas e filtravam no navegador. Com o
 * escritório crescendo, isso (1) deixava registros de fora sem aviso — a
 * lista de tarefas, com 9 mil tarefas, só recebia as 1000 de prazo mais
 * antigo e nunca mostrava as abertas deste mês — e (2) mandava 1–2 MB de
 * página para o navegador montar. Agora o banco filtra e devolve só a
 * página pedida, com o total real.
 */

export const TAMANHO_PAGINA = 50;

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  tamanho: number;
}

/** ?pagina= válido (inteiro ≥ 1), senão 1. */
export function paramPagina(v: unknown): number {
  const n = typeof v === "string" && /^\d{1,5}$/.test(v) ? Number(v) : 1;
  return n >= 1 ? n : 1;
}

/** Faixa de linhas (inclusive) para o `.range()` do Supabase. */
export function faixaDaPagina(pagina: number, tamanho = TAMANHO_PAGINA): [number, number] {
  const inicio = (pagina - 1) * tamanho;
  return [inicio, inicio + tamanho - 1];
}

export interface ResultadoConsulta<T> {
  data: T[] | null;
  error: { code?: string; message: string } | null;
  count: number | null;
}

/**
 * Busca uma página. Página além do fim (?pagina=99999, ou a última que
 * esvaziou) faz o PostgREST responder 416 / PGRST103; em vez de quebrar a
 * tela, refaz a consulta na página 1 e devolve `pagina: 1` para a lista e o
 * `Paginacao` mostrarem a página realmente exibida. Outros erros seguem no
 * resultado para o chamador lançar.
 */
export async function buscarPagina<T>(
  consulta: (de: number, ate: number) => PromiseLike<ResultadoConsulta<T>>,
  pagina: number,
  tamanho = TAMANHO_PAGINA,
): Promise<ResultadoConsulta<T> & { pagina: number }> {
  const r = await consulta(...faixaDaPagina(pagina, tamanho));
  if (r.error?.code === "PGRST103" && pagina !== 1) {
    return { ...(await consulta(...faixaDaPagina(1, tamanho))), pagina: 1 };
  }
  return { ...r, pagina };
}

/**
 * Texto de busca seguro para filtros `or(...)` / `ilike` do PostgREST:
 * vírgula, parênteses e curingas quebrariam a sintaxe do filtro (ou
 * mudariam o sentido da busca). Devolve undefined se sobrar nada.
 */
export function paramBusca(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const limpo = v.replace(/[,()*%\\:"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return limpo || undefined;
}
