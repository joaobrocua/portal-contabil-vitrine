import { z } from "zod";

import { parseValor, zCNPJ, zCPF } from "@/core/lib/validators";

const REGIMES = [
  "simples_nacional",
  "lucro_presumido",
  "lucro_real",
  "mei",
  "imune_isenta",
] as const;

const SITUACOES = [
  "ativa",
  "suspensa",
  "baixada",
  "em_abertura",
  "distrato",
] as const;

const DEPARTAMENTOS = [
  "fiscal",
  "pessoal",
  "contabil",
  "societario",
  "ir",
  "atendimento",
  "geral",
] as const;

const opt = (max = 255) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const empresaSchema = z.object({
  razao_social: z.string().trim().min(2, "Informe a razão social").max(200),
  nome_fantasia: opt(200),
  cnpj: zCNPJ,
  inscricao_estadual: opt(30),
  inscricao_municipal: opt(30),
  cnae_principal: opt(15),
  regime_tributario: z.enum(REGIMES),
  situacao: z.enum(SITUACOES).default("ativa"),
  data_abertura: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  email: z
    .string()
    .trim()
    .email("E-mail inválido")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  telefone: opt(20),
  cep: opt(9),
  logradouro: opt(200),
  numero: opt(20),
  complemento: opt(100),
  bairro: opt(100),
  municipio: opt(100),
  uf: opt(2),
  responsavel_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  departamentos_responsaveis: z.array(z.enum(DEPARTAMENTOS)).default([]),
  honorario_mensal: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v, ctx) => {
      if (!v || !v.trim()) return null;
      const n = parseValor(v);
      // Texto que não vira número NÃO pode virar "vazio": o campo vazio
      // apaga o honorário já cadastrado.
      if (n == null) {
        ctx.addIssue({ code: "custom", message: "Informe um valor em reais, por exemplo 1.850,00." });
        return z.NEVER;
      }
      if (n < 0) {
        ctx.addIssue({ code: "custom", message: "O valor não pode ser negativo." });
        return z.NEVER;
      }
      return n;
    }),
  observacoes: opt(2000),
});

export type EmpresaInput = z.infer<typeof empresaSchema>;

export const socioSchema = z.object({
  empresa_id: z.string().uuid(),
  nome: z.string().trim().min(2, "Informe o nome").max(150),
  cpf: zCPF,
  participacao: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => {
      if (!v) return null;
      const n = Number(String(v).replace(",", "."));
      return Number.isFinite(n) ? n : null;
    }),
  administrador: z.coerce.boolean().default(false),
});

export const contatoSchema = z.object({
  empresa_id: z.string().uuid(),
  nome: z.string().trim().min(2, "Informe o nome").max(150),
  cpf: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v.replace(/\D/g, "") : null))
    .refine((v) => v === null || v.length === 11, "CPF deve ter 11 dígitos"),
  telefone: opt(20),
  email: z
    .string()
    .trim()
    .email("E-mail inválido")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  cargo: opt(100),
  tipo: z
    .enum([
      "socio",
      "financeiro",
      "rh",
      "responsavel_legal",
      "contador_interno",
      "outro",
    ])
    .default("outro"),
  recebe_comunicacoes: z.coerce.boolean().default(true),
});
