import { z } from "zod";

export const DEPARTAMENTO_DOC = [
  "fiscal",
  "pessoal",
  "contabil",
  "societario",
  "ir",
  "geral",
] as const;

/**
 * Departamentos para os quais o papel pode ENVIAR documento. O do Pessoal é
 * restrito a admin e Pessoal (migration 0031; o banco recusa o resto). O
 * cliente envia para qualquer um: o documento fica na pasta da empresa dele
 * e só o Pessoal/admin o revisa.
 */
export function departamentosParaEnvio(papel: string): readonly (typeof DEPARTAMENTO_DOC)[number][] {
  const restrito = papel !== "cliente" && papel !== "admin" && papel !== "pessoal";
  return restrito ? DEPARTAMENTO_DOC.filter((d) => d !== "pessoal") : DEPARTAMENTO_DOC;
}

/**
 * Tipos de arquivo aceitos no upload — mesma lista usada no atributo
 * `accept` do input, na validação do formulário e na policy do bucket
 * de Storage (ver 0010_upload_seguro.sql). Cobre o que um escritório
 * de contabilidade de fato troca: PDF, imagens de comprovante/holerite
 * escaneado, planilhas, documentos de texto e XML de nota fiscal.
 */
export const MIME_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/xml",
  "text/xml",
] as const;

export const EXTENSOES_PERMITIDAS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".xls",
  ".xlsx",
  ".csv",
  ".doc",
  ".docx",
  ".xml",
] as const;

export const TAMANHO_MAXIMO_BYTES = 25 * 1024 * 1024; // 25 MB

export const registrarDocumentoSchema = z
  .object({
    empresa_id: z.string().uuid(),
    departamento: z.enum(DEPARTAMENTO_DOC),
    categoria: z.string().trim().min(1).max(60).default("outro"),
    competencia: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((v) => {
        if (!v) return null;
        if (/^\d{4}-\d{2}$/.test(v)) return `${v}-01`;
        return /^\d{4}-\d{2}-01$/.test(v) ? v : null;
      }),
    titulo: z.string().trim().min(1, "Informe um título").max(200),
    descricao: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((v) => (v ? v : null)),
    storage_path: z.string().min(1),
    tamanho_bytes: z
      .coerce.number()
      .int()
      .nonnegative()
      .max(TAMANHO_MAXIMO_BYTES, "Arquivo acima de 25 MB.")
      .optional(),
    mime: z
      .string()
      .max(120)
      .optional()
      .or(z.literal(""))
      .transform((v) => v || null)
      .refine(
        (v) => v === null || (MIME_PERMITIDOS as readonly string[]).includes(v),
        "Tipo de arquivo não permitido.",
      ),
  })
  // O caminho no Storage é "<empresa_id>/<arquivo>" (é assim que a RLS do
  // bucket restringe por empresa — ver 0004_documentos.sql). Confere aqui
  // também pra não registrar uma linha em `documentos` com empresa_id A
  // apontando pra um arquivo de outra empresa.
  .superRefine((data, ctx) => {
    // Sem segmentos "..", "." nem barras duplicadas/invertidas: o caminho é
    // usado depois (com a chave de serviço) para apagar o arquivo.
    if (data.storage_path.split("/").some((p) => p === "" || p === "." || p === "..") || data.storage_path.includes("\\")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storage_path"],
        message: "Caminho do arquivo inválido.",
      });
    }
    if (!data.storage_path.startsWith(`${data.empresa_id}/`)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storage_path"],
        message: "Caminho do arquivo não corresponde à empresa informada.",
      });
    }
  });

export const revisarDocumentoSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pendente", "recebido", "aprovado", "rejeitado", "correcao"]),
  observacao: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
});
