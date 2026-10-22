import { z } from "zod";

import { parseValor } from "@/core/lib/validators";

export const TIPOS_CONTRATO = [
  "clt",
  "estagio",
  "aprendiz",
  "temporario",
  "domestico",
] as const;

export const FUNCIONARIO_STATUS_VALUES = [
  "ativo",
  "afastado",
  "ferias",
  "desligado",
] as const;

export const EVENTO_DP_TIPOS = [
  "admissao",
  "demissao",
  "ferias",
  "retorno_ferias",
  "afastamento",
  "retorno_afastamento",
  "decimo_terceiro",
  "rescisao",
  "alteracao_salarial",
  "outro",
] as const;

export const EVENTO_DP_STATUS_VALUES = [
  "solicitado",
  "em_andamento",
  "aguardando_cliente",
  "concluido",
  "cancelado",
] as const;

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

const competenciaOrNull = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => {
    if (!v) return null;
    if (/^\d{4}-\d{2}$/.test(v)) return `${v}-01`;
    return /^\d{4}-\d{2}-01$/.test(v) ? v : null;
  });

const valorOpt = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => {
    if (!v) return null;
    return parseValor(v);
  });

export const funcionarioSchema = z.object({
  empresa_id: z.string().uuid("Selecione a empresa"),
  nome: z.string().trim().min(2, "Informe o nome").max(150),
  cpf: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v.replace(/\D/g, "") : null))
    .refine((v) => v === null || v.length === 11, "CPF deve ter 11 dígitos"),
  cargo: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v ? v : null)),
  tipo_contrato: z.enum(TIPOS_CONTRATO).default("clt"),
  data_admissao: dateOrNull,
  data_demissao: dateOrNull,
  salario: valorOpt,
  status: z.enum(FUNCIONARIO_STATUS_VALUES).default("ativo"),
  observacoes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : null)),
});

// Sem "status" de propósito — o formulário (EventoDpForm) não tem esse
// campo, e um "status" com .default() aqui faria atualizarEventoDp
// resetar a situação atual pra "solicitado" a cada edição de detalhe/
// responsável. Criação usa o default da própria coluna no banco; a
// situação muda só pelo seletor dedicado (mudarStatusEventoDp).
export const eventoDpSchema = z.object({
  empresa_id: z.string().uuid("Selecione a empresa"),
  funcionario_id: uuidOrNull,
  tipo: z.enum(EVENTO_DP_TIPOS),
  competencia: competenciaOrNull,
  data_referencia: dateOrNull,
  detalhe: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v ? v : null)),
  responsavel_id: uuidOrNull,
});

export const evendoDpItemSchema = z.object({
  evento_id: z.string().uuid(),
  descricao: z.string().trim().min(1, "Descreva o item").max(300),
});

export const abrirFolhasSchema = z.object({ competencia: competenciaOrNull });

export const FOLHA_STATUS_VALUES = [
  "aberta",
  "em_processamento",
  "revisao",
  "fechada",
  "transmitida",
] as const;
