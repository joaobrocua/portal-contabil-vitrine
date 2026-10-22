import { z } from "zod";

import { parseValor } from "@/core/lib/validators";

export const OBRIGACAO_TIPOS = [
  "das",
  "das_mei",
  "fgts",
  "inss_gps",
  "darf_irpj",
  "darf_csll",
  "darf_pis",
  "darf_cofins",
  "darf_irrf",
  "iss",
  "icms",
  "difal",
  "dctfweb",
  "efd_contribuicoes",
  "efd_icms_ipi",
  "efd_reinf",
  "sped_ecd",
  "sped_ecf",
  "defis",
  "dirf",
  "rais",
  "outro",
] as const;

export const OBRIGACAO_STATUS = [
  "pendente",
  "em_andamento",
  "gerada",
  "disponivel",
  "entregue",
  "paga",
  "dispensada",
] as const;

const uuidOrNull = z
  .string()
  .uuid()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const dateReq = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

const competencia = z
  .string()
  .transform((v) => (/^\d{4}-\d{2}$/.test(v) ? `${v}-01` : v))
  .refine((v) => /^\d{4}-\d{2}-01$/.test(v), "Competência inválida");

const valorOpt = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => {
    if (!v) return null;
    return parseValor(v);
  });

export const obrigacaoSchema = z.object({
  empresa_id: z.string().uuid("Selecione a empresa"),
  competencia,
  tipo: z.enum(OBRIGACAO_TIPOS),
  descricao: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : null)),
  vencimento: dateReq,
  valor: valorOpt,
  responsavel_id: uuidOrNull,
  status: z.enum(OBRIGACAO_STATUS).default("pendente"),
  observacao: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : null)),
});

export const recorrenciaSchema = z.object({
  empresa_id: z.string().uuid(),
  tipo: z.enum(OBRIGACAO_TIPOS),
  descricao: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : null)),
  periodicidade: z.enum(["mensal", "trimestral", "anual"]).default("mensal"),
  dia_vencimento: z.coerce.number().int().min(1).max(31).default(20),
  meses_apos: z.coerce.number().int().min(0).max(3).default(1),
  responsavel_id: uuidOrNull,
});

export const gerarSchema = z.object({ competencia });
