/**
 * Leitura segura de parâmetros de URL (?empresa=, ?competencia=, ?ano=…)
 * antes de irem pra uma consulta. Sem isso, um link editado à mão ou
 * truncado (ex.: `/fiscal?competencia=2026-9` ou `?empresa=abc`) chegava
 * direto no Postgres, que recusa data/UUID inválido — e a página inteira
 * caía na tela de erro. Aqui, valor inválido vira `undefined`: a página
 * segue como se o filtro não tivesse sido passado.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function texto(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** UUID válido, senão undefined. */
export function paramUuid(v: unknown): string | undefined {
  const s = texto(v);
  return s && UUID_RE.test(s) ? s : undefined;
}

/** Mês no formato 'YYYY-MM' (mês 01–12, ano 2000–2100), senão undefined. */
export function paramMes(v: unknown): string | undefined {
  const s = texto(v);
  const m = s ? /^(\d{4})-(\d{2})$/.exec(s) : null;
  if (!m) return undefined;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  return ano >= 2000 && ano <= 2100 && mes >= 1 && mes <= 12 ? s : undefined;
}

/** Ano inteiro entre 2000 e 2100, senão undefined. */
export function paramAno(v: unknown): number | undefined {
  const s = texto(v);
  if (!s || !/^\d{4}$/.test(s)) return undefined;
  const n = Number(s);
  return n >= 2000 && n <= 2100 ? n : undefined;
}

/** Um dos valores permitidos, senão undefined. */
export function paramEnum<T extends string>(
  v: unknown,
  permitidos: readonly T[],
): T | undefined {
  const s = texto(v);
  return s && (permitidos as readonly string[]).includes(s) ? (s as T) : undefined;
}
