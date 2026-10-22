/** Formatação e máscaras comuns no domínio contábil brasileiro. */

const onlyDigits = (v: string) => v.replace(/\D/g, "");

export function formatCNPJ(value: string | null | undefined): string {
  if (!value) return "";
  const d = onlyDigits(value).padStart(14, "0").slice(0, 14);
  return d.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5",
  );
}

export function formatCPF(value: string | null | undefined): string {
  if (!value) return "";
  const d = onlyDigits(value).padStart(11, "0").slice(0, 11);
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

export function formatCpfCnpj(value: string | null | undefined): string {
  const d = onlyDigits(value ?? "");
  return d.length <= 11 ? formatCPF(d) : formatCNPJ(d);
}

export function formatTelefone(value: string | null | undefined): string {
  if (!value) return "";
  const d = onlyDigits(value);
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return value;
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatMoeda(value: number | null | undefined): string {
  return brl.format(Number(value ?? 0));
}

/* ------------------------------ Fuso horário ----------------------------- */
/**
 * Fuso do escritório (Cuiabá/MT). Tudo que decide "que dia é hoje" (atraso,
 * competência do mês atual, etc.) usa isto — nunca o fuso do processo que
 * está rodando: em produção na nuvem o servidor roda em UTC, e mesmo na
 * instalação local (Windows) depende do relógio da própria máquina estar
 * certo. Nos dois casos a virada do dia fica até 4h adiantada em relação a
 * Cuiabá (às 21h aqui já é 01h UTC do dia seguinte) — o que fazia uma
 * obrigação/tarefa aparecer como atrasada, ou a competência pular pro mês
 * seguinte, horas antes da hora certa.
 */
export const FUSO_ESCRITORIO = "America/Cuiaba";
const TZ = FUSO_ESCRITORIO;

/** "Hoje" no fuso do escritório, como 'YYYY-MM-DD'. */
export function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/**
 * Componentes {ano, mês 1-based, dia} de um valor de data, sem conversão de
 * fuso: uma string 'YYYY-MM-DD' (formato que o Postgres devolve pra colunas
 * `date`, sem hora) já É o dia certo — não deve passar por `new Date(string)`
 * pra extrair isso, porque isso parseia como meia-noite UTC e, num fuso
 * negativo como o nosso, os getters locais "andam" um dia pra trás depois.
 * Um `Date` usa os getters locais (quem construiu com
 * `new Date(ano, mes, dia)` quis dizer aquele dia de calendário).
 * Não serve pra timestamp completo ('...T...Z') — isso é um instante real,
 * que precisa passar pelo fuso (`hojeISO`/`Intl` com `timeZone`), não ter o
 * dia lido direto da string.
 */
function partesData(value: string | Date): [number, number, number] | null {
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  }
  return Number.isNaN(value.getTime())
    ? null
    : [value.getFullYear(), value.getMonth() + 1, value.getDate()];
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: TZ });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: TZ,
});

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Data pura (sem hora) tipo 'YYYY-MM-DD' — formata pelos dígitos, sem
 * passar por fuso nenhum, pra não correr o risco de "andar" um dia. */
export function formatData(value: string | Date | null | undefined): string {
  if (!value) return "—";
  if (typeof value === "string") {
    const partes = partesData(value);
    if (partes) {
      const [y, m, d] = partes;
      return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
    }
  }
  const d = toDate(value);
  return d ? dateFmt.format(d) : "—";
}

/** Instante real (timestamptz) — mostrado no horário de Cuiabá. */
export function formatDataHora(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? dateTimeFmt.format(d) : "—";
}

/* ----------------------------- Competência ------------------------------ */
/** Competência é sempre o 1º dia do mês, guardado como 'YYYY-MM-01'. */

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Desloca uma competência 'YYYY-MM-01' por N meses (negativo = pro passado).
 * Trabalha em UTC "de calendário" (não é o fuso de verdade, é só pra virar
 * mês sem risco de a hora local empurrar pro dia/mês errado). */
export function deslocarCompetencia(competencia: string, meses: number): string {
  const [ano, mes] = competencia.slice(0, 7).split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function competenciaAtual(): string {
  return `${hojeISO().slice(0, 7)}-01`;
}

export function formatCompetencia(value: string | null | undefined): string {
  if (!value) return "—";
  const [ano, mes] = value.split("-");
  const idx = Number(mes) - 1;
  if (idx < 0 || idx > 11) return value;
  return `${MESES[idx]}/${ano}`;
}

export function formatCompetenciaCurta(value: string | null | undefined): string {
  if (!value) return "—";
  const [ano, mes] = value.split("-");
  return `${mes}/${ano}`;
}

/** Lista as últimas N competências (mais recente primeiro), incluindo a atual. */
export function ultimasCompetencias(n = 12): string[] {
  const atual = competenciaAtual();
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(deslocarCompetencia(atual, -i));
  return out;
}

/** Soma (ou subtrai, com N negativo) dias a uma data 'YYYY-MM-DD' — em UTC
 * "de calendário" (não é o fuso de verdade, é só pra não correr risco de a
 * hora local empurrar o resultado pro dia errado). */
export function somarDias(value: string, n: number): string {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/* ----------------------------- Vencimentos ----------------------------- */

/** Dias de calendário até `value` (negativo = atrasado), comparando com
 * "hoje" no fuso do escritório — não o fuso de quem está rodando o app. */
export function diasAte(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const alvo = partesData(value);
  if (!alvo) return null;
  const hoje = partesData(hojeISO())!;
  const [ay, am, ad] = alvo;
  const [hy, hm, hd] = hoje;
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(hy, hm - 1, hd)) / 86_400_000);
}
