import { z } from "zod";

export const PROCESSO_SOCIETARIO_TIPOS = [
  "abertura",
  "alteracao_contratual",
  "encerramento",
  "outro",
] as const;

export const PROCESSO_SOCIETARIO_STATUS_VALUES = [
  "solicitado",
  "em_andamento",
  "aguardando_orgao",
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

// Sem campo "status" de propósito: a situação do processo muda só pelo
// seletor de status dedicado (mudarStatusProcessoSocietario), nunca por
// este formulário — assim editar descrição/responsável nunca reseta a
// situação atual do processo.
export const processoSocietarioSchema = z.object({
  empresa_id: z.string().uuid("Selecione a empresa"),
  tipo: z.enum(PROCESSO_SOCIETARIO_TIPOS),
  descricao: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v ? v : null)),
  protocolo: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v ? v : null)),
  responsavel_id: uuidOrNull,
});

export const processoSocietarioItemSchema = z.object({
  processo_id: z.string().uuid(),
  descricao: z.string().trim().min(1, "Descreva o item").max(300),
});
