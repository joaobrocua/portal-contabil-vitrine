import { z } from "zod";

export const FECHAMENTO_STATUS_VALUES = [
  "aberto",
  "em_andamento",
  "revisao",
  "fechado",
  "entregue",
] as const;

export const abrirFechamentosSchema = z.object({
  competencia: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Competência inválida")
    .transform((v) => `${v}-01`),
});

export const atualizarFechamentoSchema = z.object({
  id: z.string().uuid(),
  responsavel_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  observacao: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : null)),
});

export const fechamentoItemSchema = z.object({
  fechamento_id: z.string().uuid(),
  descricao: z.string().trim().min(1, "Descreva o item").max(200),
});
