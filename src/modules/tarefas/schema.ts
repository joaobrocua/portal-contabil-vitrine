import { z } from "zod";

const DEPARTAMENTOS = [
  "fiscal",
  "pessoal",
  "contabil",
  "societario",
  "ir",
  "atendimento",
  "geral",
] as const;

const STATUS = [
  "nao_iniciada",
  "em_andamento",
  "aguardando_cliente",
  "em_revisao",
  "concluida",
  "atrasada",
  "cancelada",
] as const;

const PRIORIDADES = ["baixa", "normal", "alta", "urgente"] as const;

const uuidOrNull = z
  .string()
  .uuid()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const dateOrNull = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

/** input[type=month] devolve 'YYYY-MM' → guardamos 'YYYY-MM-01'. */
const competenciaOrNull = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => {
    if (!v) return null;
    if (/^\d{4}-\d{2}$/.test(v)) return `${v}-01`;
    if (/^\d{4}-\d{2}-01$/.test(v)) return v;
    return null;
  });

export const tarefaSchema = z.object({
  titulo: z.string().trim().min(3, "Descreva a tarefa").max(200),
  descricao: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((v) => (v ? v : null)),
  empresa_id: uuidOrNull,
  departamento: z.enum(DEPARTAMENTOS).default("geral"),
  responsavel_id: uuidOrNull,
  competencia: competenciaOrNull,
  prazo: dateOrNull,
  prioridade: z.enum(PRIORIDADES).default("normal"),
  status: z.enum(STATUS).default("nao_iniciada"),
});

export type TarefaInput = z.infer<typeof tarefaSchema>;

export const tarefaItemSchema = z.object({
  tarefa_id: z.string().uuid(),
  descricao: z.string().trim().min(1, "Descreva o item").max(300),
});

/* ------------------------------ modelos ---------------------------- */

const MAX_ITENS_MODELO = 50;

/** Textarea "um item por linha" → array limpo (sem linhas vazias). */
const itensPorLinha = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(z.string().max(300, "Cada item pode ter até 300 caracteres"))
      .max(MAX_ITENS_MODELO, `No máximo ${MAX_ITENS_MODELO} itens`),
  );

const diaPrazo = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? Number(v) : null))
  .pipe(z.number().int().min(1).max(31).nullable());

export const modeloSchema = z.object({
  nome: z.string().trim().min(2, "Dê um nome ao modelo").max(100),
  departamento: z.enum(DEPARTAMENTOS).default("geral"),
  titulo_padrao: z.string().trim().min(3, "Descreva a tarefa").max(200),
  descricao: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((v) => (v ? v : null)),
  itens_padrao: itensPorLinha,
  dia_prazo: diaPrazo,
});

export type ModeloInput = z.infer<typeof modeloSchema>;

/**
 * Prazo sugerido por um modelo com "dia do prazo": esse dia no mês atual;
 * se já passou, no mês seguinte. Dia maior que o mês (ex. 31 em fevereiro)
 * cai no último dia. `hoje` no formato 'YYYY-MM-DD'.
 */
export function prazoDoModelo(dia: number | null, hoje: string): string | null {
  if (!dia) return null;
  const [a, m, d] = hoje.split("-").map(Number);
  const noMes = (ano: number, mes: number) => {
    const ultimo = new Date(ano, mes, 0).getDate();
    return `${ano}-${String(mes).padStart(2, "0")}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
  };
  const este = noMes(a, m);
  if (Number(este.slice(8)) >= d) return este;
  return m === 12 ? noMes(a + 1, 1) : noMes(a, m + 1);
}

export const STATUS_VALUES = STATUS;
export const PRIORIDADE_VALUES = PRIORIDADES;
export const DEPARTAMENTO_VALUES = DEPARTAMENTOS;
