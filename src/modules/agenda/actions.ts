"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/core/auth/session";
import { createSupabaseServerClient } from "@/core/db/server";
import { mensagemErroBanco } from "@/core/lib/erros";
import {
  actionErr,
  actionOk,
  PAPEIS_INTERNOS,
  type ActionResult,
} from "@/core/types/domain";

const schema = z.object({
  titulo: z.string().trim().min(2, "Informe o título").max(200),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  hora: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  tipo: z.enum(["prazo", "reuniao", "lembrete", "obrigacao", "outro"]),
  departamento: z
    .enum([
      "fiscal",
      "pessoal",
      "contabil",
      "societario",
      "ir",
      "atendimento",
      "geral",
    ])
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  empresa_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  descricao: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : null)),
});

export async function criarEvento(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole(...PAPEIS_INTERNOS);
  const obj = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(obj);
  if (!parsed.success) {
    return actionErr(
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("eventos_agenda").insert({
    ...parsed.data,
    origem: "manual",
    criado_por: session.userId,
  });
  if (error) return actionErr(mensagemErroBanco(error));

  revalidatePath("/agenda");
  return actionOk(undefined);
}

export async function alternarEventoConcluido(
  id: string,
  concluido: boolean,
): Promise<ActionResult> {
  await requireRole(...PAPEIS_INTERNOS);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("eventos_agenda")
    .update({ concluido })
    .eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));
  revalidatePath("/agenda");
  return actionOk(undefined);
}
