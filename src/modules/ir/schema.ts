import { z } from "zod";

import { parseValor } from "@/core/lib/validators";

export const IR_TIPOS = ["irpf", "irpj", "itr"] as const;

export const IR_STATUS_VALUES = [
  "pendente",
  "documentos_recebidos",
  "em_elaboracao",
  "entregue",
  "retificacao",
  "dispensada",
] as const;

const dateOrNull = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const valorOpt = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => {
    if (!v) return null;
    return parseValor(v);
  });

const uuidOrNull = z
  .string()
  .uuid()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

export const gerarDeclaracoesIrSchema = z.object({
  tipo: z.enum(IR_TIPOS),
  ano_exercicio: z.coerce.number().int().min(2000).max(2100),
  prazo: dateOrNull,
});

// Sem "status" de propósito — muda só pelo seletor de status dedicado.
export const atualizarDeclaracaoIrSchema = z.object({
  id: z.string().uuid(),
  prazo: dateOrNull,
  valor_a_pagar: valorOpt,
  valor_a_restituir: valorOpt,
  recibo: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v ? v : null)),
  responsavel_id: uuidOrNull,
  observacao: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : null)),
});
