"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/core/auth/session";
import { createSupabaseServerClient } from "@/core/db/server";
import { mensagemErroBanco } from "@/core/lib/erros";
import { registrarHistorico } from "@/core/lib/historico";
import {
  actionErr,
  actionOk,
  OBRIGACAO_STATUS_LABEL,
  type ActionResult,
  type ObrigacaoStatus,
} from "@/core/types/domain";

import { gerarSchema, obrigacaoSchema, recorrenciaSchema } from "./schema";

const STAFF = ["admin", "fiscal"] as const;

function flat(fd: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of new Set(fd.keys())) o[k] = fd.get(k);
  return o;
}

/* ----------------------------- obrigações ------------------------ */

export async function criarObrigacao(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole(...STAFF);
  const parsed = obrigacaoSchema.safeParse(flat(formData));
  if (!parsed.success)
    return actionErr("Verifique os campos.", parsed.error.flatten().fieldErrors);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("obrigacoes")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505")
      return actionErr("Já existe essa obrigação para a empresa/competência.");
    return actionErr(mensagemErroBanco(error));
  }

  await registrarHistorico({
    entidade: "obrigacao",
    entidadeId: data.id,
    acao: "criou",
    descricao: `Obrigação ${parsed.data.tipo.toUpperCase()} criada`,
    autorId: session.userId,
  });
  revalidatePath("/fiscal");
  return actionOk({ id: data.id });
}

export async function atualizarObrigacao(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole(...STAFF);
  const id = String(formData.get("id") ?? "");
  if (!id) return actionErr("Obrigação não informada.");
  const parsed = obrigacaoSchema.safeParse(flat(formData));
  if (!parsed.success)
    return actionErr("Verifique os campos.", parsed.error.flatten().fieldErrors);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("obrigacoes")
    .update(parsed.data)
    .eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "obrigacao",
    entidadeId: id,
    acao: "alterou",
    descricao: "Obrigação atualizada",
    autorId: session.userId,
  });
  revalidatePath(`/fiscal/${id}`);
  revalidatePath("/fiscal");
  return actionOk({ id });
}

export async function mudarStatusObrigacao(
  id: string,
  novo: ObrigacaoStatus,
): Promise<ActionResult> {
  const session = await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();

  const { data: atual } = await supabase
    .from("obrigacoes")
    .select("status, tipo")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("obrigacoes")
    .update({ status: novo })
    .eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "obrigacao",
    entidadeId: id,
    acao: "alterou_status",
    campo: "status",
    de: atual ? OBRIGACAO_STATUS_LABEL[atual.status as ObrigacaoStatus] : null,
    para: OBRIGACAO_STATUS_LABEL[novo],
    descricao: `${(atual?.tipo ?? "obrigação").toString().toUpperCase()} → ${OBRIGACAO_STATUS_LABEL[novo]}`,
    autorId: session.userId,
  });
  revalidatePath("/fiscal");
  revalidatePath(`/fiscal/${id}`);
  revalidatePath("/painel");
  return actionOk(undefined);
}

export async function excluirObrigacao(id: string): Promise<ActionResult> {
  const session = await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();
  const { data: atual } = await supabase
    .from("obrigacoes")
    .select("tipo, competencia, empresa_id")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("obrigacoes").delete().eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "obrigacao",
    entidadeId: id,
    acao: "excluiu",
    descricao: `${(atual?.tipo ?? "obrigação").toString().toUpperCase()}${
      atual?.competencia ? ` (${atual.competencia.slice(0, 7)})` : ""
    } excluída`,
    autorId: session.userId,
  });

  revalidatePath("/fiscal");
  return actionOk(undefined);
}

/* ------------------------ geração da competência ---------------- */

export async function gerarCompetencia(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ criadas: number }>> {
  const session = await requireRole(...STAFF);
  const parsed = gerarSchema.safeParse(flat(formData));
  if (!parsed.success) return actionErr("Competência inválida.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("gerar_obrigacoes", {
    p_competencia: parsed.data.competencia,
  });
  // error.message aqui é o "raise exception" da própria função (0017) —
  // mensagem que já escrevemos pensada pro usuário ("Apenas o
  // departamento fiscal pode gerar obrigações"), não erro cru de
  // tabela/constraint. mensagemErroBanco() é só pra esse segundo caso.
  if (error) return actionErr(error.message);

  await registrarHistorico({
    entidade: "fiscal",
    acao: "gerou",
    descricao: `${data ?? 0} obrigação(ões) geradas para a competência ${parsed.data.competencia.slice(0, 7)}`,
    autorId: session.userId,
  });
  revalidatePath("/fiscal");
  return actionOk({ criadas: data ?? 0 });
}

/* ---------------------------- recorrências --------------------- */

export async function criarRecorrencia(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(...STAFF);
  const parsed = recorrenciaSchema.safeParse(flat(formData));
  if (!parsed.success)
    return actionErr("Verifique os campos.", parsed.error.flatten().fieldErrors);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("obrigacao_recorrencias")
    .insert({ ...parsed.data, ativo: true });
  if (error) {
    if (error.code === "23505")
      return actionErr("Essa empresa já tem essa obrigação recorrente.");
    return actionErr(mensagemErroBanco(error));
  }
  revalidatePath("/fiscal/recorrencias");
  return actionOk(undefined);
}

export async function alternarRecorrencia(
  id: string,
  ativo: boolean,
): Promise<ActionResult> {
  await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("obrigacao_recorrencias")
    .update({ ativo })
    .eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));
  revalidatePath("/fiscal/recorrencias");
  return actionOk(undefined);
}

export async function removerRecorrencia(id: string): Promise<ActionResult> {
  const session = await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();
  const { data: atual } = await supabase
    .from("obrigacao_recorrencias")
    .select("tipo, empresa_id")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("obrigacao_recorrencias")
    .delete()
    .eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "empresa",
    entidadeId: atual?.empresa_id ?? null,
    acao: "excluiu",
    descricao: `Recorrência fiscal "${(atual?.tipo ?? id).toString().toUpperCase()}" removida`,
    autorId: session.userId,
  });

  revalidatePath("/fiscal/recorrencias");
  return actionOk(undefined);
}
