"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/core/auth/session";
import { createSupabaseServerClient } from "@/core/db/server";
import { mensagemErroBanco } from "@/core/lib/erros";
import { registrarHistorico } from "@/core/lib/historico";
import {
  actionErr,
  actionOk,
  PAPEIS_INTERNOS,
  TAREFA_STATUS_LABEL,
  type ActionResult,
  type TarefaStatus,
} from "@/core/types/domain";

import { modeloSchema, tarefaItemSchema, tarefaSchema } from "./schema";

const STAFF = PAPEIS_INTERNOS;

function flat(fd: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of new Set(fd.keys())) o[k] = fd.get(k);
  return o;
}

export async function criarTarefa(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole(...STAFF);
  const parsed = tarefaSchema.safeParse(flat(formData));
  if (!parsed.success) {
    return actionErr("Verifique os campos.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  // Criada a partir de um modelo: o checklist vem do modelo gravado no
  // banco, nunca do navegador.
  let modelo: { id: string; itens_padrao: string[] } | null = null;
  const templateId = z.string().uuid().safeParse(formData.get("template_id"));
  if (templateId.success) {
    const { data: t } = await supabase
      .from("tarefa_templates")
      .select("id, itens_padrao")
      .eq("id", templateId.data)
      .maybeSingle();
    if (!t) return actionErr("Modelo não encontrado.");
    modelo = {
      id: t.id,
      itens_padrao: (Array.isArray(t.itens_padrao) ? t.itens_padrao : []).filter(
        (x): x is string => typeof x === "string" && x.trim() !== "",
      ),
    };
  }

  const { data, error } = await supabase
    .from("tarefas")
    .insert({
      ...parsed.data,
      criado_por: session.userId,
      origem: "manual",
      template_id: modelo?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return actionErr(mensagemErroBanco(error));

  if (modelo && modelo.itens_padrao.length > 0) {
    const { error: itensError } = await supabase.from("tarefa_itens").insert(
      modelo.itens_padrao.map((descricao, ordem) => ({
        tarefa_id: data.id,
        descricao,
        ordem,
      })),
    );
    // A tarefa já existe; sem o checklist ela ainda serve, então não
    // desfaz — só avisa no log.
    if (itensError) mensagemErroBanco(itensError);
  }

  await registrarHistorico({
    entidade: "tarefa",
    entidadeId: data.id,
    acao: "criou",
    descricao: `Tarefa "${parsed.data.titulo}" criada`,
    autorId: session.userId,
  });

  revalidatePath("/tarefas");
  return actionOk({ id: data.id });
}

export async function atualizarTarefa(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole(...STAFF);
  const id = String(formData.get("id") ?? "");
  if (!id) return actionErr("Tarefa não informada.");
  const parsed = tarefaSchema.safeParse(flat(formData));
  if (!parsed.success) {
    return actionErr("Verifique os campos.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tarefas")
    .update(parsed.data)
    .eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "tarefa",
    entidadeId: id,
    acao: "alterou",
    descricao: `Tarefa "${parsed.data.titulo}" atualizada`,
    autorId: session.userId,
  });

  revalidatePath(`/tarefas/${id}`);
  revalidatePath("/tarefas");
  return actionOk({ id });
}

export async function mudarStatusTarefa(
  id: string,
  novo: TarefaStatus,
): Promise<ActionResult> {
  const session = await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();

  const { data: atual } = await supabase
    .from("tarefas")
    .select("status, titulo")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("tarefas")
    .update({ status: novo })
    .eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "tarefa",
    entidadeId: id,
    acao: "alterou_status",
    campo: "status",
    de: atual ? TAREFA_STATUS_LABEL[atual.status as TarefaStatus] : null,
    para: TAREFA_STATUS_LABEL[novo],
    descricao: `Status de "${atual?.titulo ?? "tarefa"}" alterado para ${TAREFA_STATUS_LABEL[novo]}`,
    autorId: session.userId,
  });

  revalidatePath(`/tarefas/${id}`);
  revalidatePath("/tarefas");
  revalidatePath("/painel");
  return actionOk(undefined);
}

/* ------------------------------ checklist -------------------------- */

export async function adicionarItem(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(...STAFF);
  const parsed = tarefaItemSchema.safeParse(flat(formData));
  if (!parsed.success) return actionErr("Descreva o item.");

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("tarefa_itens")
    .select("id", { count: "exact", head: true })
    .eq("tarefa_id", parsed.data.tarefa_id);

  const { error } = await supabase.from("tarefa_itens").insert({
    tarefa_id: parsed.data.tarefa_id,
    descricao: parsed.data.descricao,
    ordem: count ?? 0,
  });
  if (error) return actionErr(mensagemErroBanco(error));
  revalidatePath(`/tarefas/${parsed.data.tarefa_id}`);
  return actionOk(undefined);
}

export async function alternarItem(
  itemId: string,
  tarefaId: string,
  feito: boolean,
): Promise<ActionResult> {
  const session = await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tarefa_itens")
    .update({
      feito,
      feito_em: feito ? new Date().toISOString() : null,
      feito_por: feito ? session.userId : null,
    })
    .eq("id", itemId);
  if (error) return actionErr(mensagemErroBanco(error));
  revalidatePath(`/tarefas/${tarefaId}`);
  return actionOk(undefined);
}

/* ------------------------------ modelos ---------------------------- */

/** Cria (sem `id`) ou atualiza (com `id`) um modelo de tarefa. Só admin. */
export async function salvarModelo(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole("admin");
  const parsed = modeloSchema.safeParse(flat(formData));
  if (!parsed.success) {
    return actionErr("Verifique os campos.", parsed.error.flatten().fieldErrors);
  }
  const idRaw = formData.get("id");
  const id = idRaw ? z.string().uuid().safeParse(idRaw) : null;
  if (id && !id.success) return actionErr("Modelo inválido.");

  const supabase = await createSupabaseServerClient();
  let modeloId: string;
  if (id) {
    const { error } = await supabase
      .from("tarefa_templates")
      .update(parsed.data)
      .eq("id", id.data);
    if (error) return actionErr(mensagemErroBanco(error));
    modeloId = id.data;
  } else {
    const { data, error } = await supabase
      .from("tarefa_templates")
      .insert({ ...parsed.data, recorrencia: "nenhuma", ativo: true })
      .select("id")
      .single();
    if (error) return actionErr(mensagemErroBanco(error));
    modeloId = data.id;
  }

  await registrarHistorico({
    entidade: "tarefa_modelo",
    entidadeId: modeloId,
    acao: id ? "alterou" : "criou",
    descricao: `Modelo de tarefa "${parsed.data.nome}" ${id ? "atualizado" : "criado"}`,
    autorId: session.userId,
  });
  revalidatePath("/tarefas/modelos");
  revalidatePath("/tarefas/nova");
  return actionOk({ id: modeloId });
}

export async function alternarModelo(
  id: string,
  ativo: boolean,
): Promise<ActionResult> {
  await requireRole("admin");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tarefa_templates")
    .update({ ativo })
    .eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));
  revalidatePath("/tarefas/modelos");
  revalidatePath("/tarefas/nova");
  return actionOk(undefined);
}

/** Tarefas já criadas pelo modelo continuam; só perdem a referência. */
export async function excluirModelo(id: string): Promise<ActionResult> {
  const session = await requireRole("admin");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tarefa_templates")
    .delete()
    .eq("id", id)
    .select("nome")
    .maybeSingle();
  if (error) return actionErr(mensagemErroBanco(error));
  if (!data) return actionErr("Modelo não encontrado.");

  await registrarHistorico({
    entidade: "tarefa_modelo",
    entidadeId: id,
    acao: "excluiu",
    descricao: `Modelo de tarefa "${data.nome}" excluído`,
    autorId: session.userId,
  });
  revalidatePath("/tarefas/modelos");
  revalidatePath("/tarefas/nova");
  return actionOk(undefined);
}

/* ------------------------ documentos vinculados -------------------- */

const vinculoSchema = z.object({
  tarefa_id: z.string().uuid(),
  documento_id: z.string().uuid(),
});

export async function vincularDocumento(
  tarefaId: string,
  documentoId: string,
): Promise<ActionResult> {
  const session = await requireRole(...STAFF);
  const parsed = vinculoSchema.safeParse({ tarefa_id: tarefaId, documento_id: documentoId });
  if (!parsed.success) return actionErr("Escolha um documento.");

  const supabase = await createSupabaseServerClient();
  // O banco também barra (trigger da 0025); conferir aqui só dá uma
  // mensagem melhor.
  const [{ data: tarefa }, { data: doc }] = await Promise.all([
    supabase.from("tarefas").select("empresa_id").eq("id", tarefaId).maybeSingle(),
    supabase.from("documentos").select("empresa_id, titulo").eq("id", documentoId).maybeSingle(),
  ]);
  if (!tarefa || !doc) return actionErr("Tarefa ou documento não encontrado.");
  if (!tarefa.empresa_id || tarefa.empresa_id !== doc.empresa_id) {
    return actionErr("O documento precisa ser da mesma empresa da tarefa.");
  }

  const { error } = await supabase
    .from("tarefa_documentos")
    .insert(parsed.data);
  if (error) {
    if (error.code === "23505") return actionErr("Esse documento já está vinculado.");
    return actionErr(mensagemErroBanco(error));
  }

  await registrarHistorico({
    entidade: "tarefa",
    entidadeId: tarefaId,
    acao: "vinculou_documento",
    descricao: `Documento "${doc.titulo}" vinculado`,
    autorId: session.userId,
  });
  revalidatePath(`/tarefas/${tarefaId}`);
  return actionOk(undefined);
}

export async function desvincularDocumento(
  tarefaId: string,
  documentoId: string,
): Promise<ActionResult> {
  const session = await requireRole(...STAFF);
  const parsed = vinculoSchema.safeParse({ tarefa_id: tarefaId, documento_id: documentoId });
  if (!parsed.success) return actionErr("Dados inválidos.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tarefa_documentos")
    .delete()
    .eq("tarefa_id", tarefaId)
    .eq("documento_id", documentoId);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "tarefa",
    entidadeId: tarefaId,
    acao: "desvinculou_documento",
    descricao: "Documento desvinculado",
    autorId: session.userId,
  });
  revalidatePath(`/tarefas/${tarefaId}`);
  return actionOk(undefined);
}

export async function removerItem(
  itemId: string,
  tarefaId: string,
): Promise<ActionResult> {
  await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tarefa_itens")
    .delete()
    .eq("id", itemId);
  if (error) return actionErr(mensagemErroBanco(error));
  revalidatePath(`/tarefas/${tarefaId}`);
  return actionOk(undefined);
}
