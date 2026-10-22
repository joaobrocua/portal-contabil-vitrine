"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/core/auth/session";
import { createSupabaseServerClient } from "@/core/db/server";
import { mensagemErroBanco } from "@/core/lib/erros";
import { registrarHistorico } from "@/core/lib/historico";
import { actionErr, actionOk, type ActionResult } from "@/core/types/domain";

import { TIPOS_CATALOGO } from "./catalogos";

const configSchema = z.object({
  nome: z.string().trim().min(2).max(150),
  cnpj: z.string().trim().max(20).optional().or(z.literal("")).transform((v) => v || null),
  telefone: z.string().trim().max(30).optional().or(z.literal("")).transform((v) => v || null),
  email: z.string().trim().max(150).optional().or(z.literal("")).transform((v) => v || null),
  endereco: z.string().trim().max(300).optional().or(z.literal("")).transform((v) => v || null),
});

export async function salvarConfig(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("admin");
  const parsed = configSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionErr("Verifique os campos.", parsed.error.flatten().fieldErrors);
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("escritorio_config")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "config",
    acao: "alterou",
    descricao: "Configuração do escritório atualizada",
    autorId: session.userId,
  });
  revalidatePath("/administracao");
  return actionOk(undefined);
}

const catalogoSchema = z.object({
  tipo: z.enum(TIPOS_CATALOGO),
  rotulo: z.string().trim().min(1).max(80),
});

const slug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

export async function adicionarCatalogo(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("admin");
  const parsed = catalogoSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) return actionErr("Dados inválidos.");

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("catalogos")
    .select("id", { count: "exact", head: true })
    .eq("tipo", parsed.data.tipo);

  const { error } = await supabase.from("catalogos").insert({
    tipo: parsed.data.tipo,
    valor: slug(parsed.data.rotulo) || `item_${(count ?? 0) + 1}`,
    rotulo: parsed.data.rotulo,
    ordem: (count ?? 0) + 1,
    ativo: true,
  });
  if (error) {
    if (error.code === "23505") return actionErr("Esse item já existe.");
    return actionErr(mensagemErroBanco(error));
  }
  revalidatePath("/administracao");
  return actionOk(undefined);
}

export async function alternarCatalogo(
  id: string,
  ativo: boolean,
): Promise<ActionResult> {
  await requireRole("admin");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("catalogos")
    .update({ ativo })
    .eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));
  revalidatePath("/administracao");
  return actionOk(undefined);
}
