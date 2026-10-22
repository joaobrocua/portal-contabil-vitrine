"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/core/auth/session";
import { createSupabaseServerClient } from "@/core/db/server";
import { mensagemErroBanco } from "@/core/lib/erros";
import { registrarHistorico } from "@/core/lib/historico";
import {
  actionErr,
  actionOk,
  FECHAMENTO_STATUS_LABEL,
  type ActionResult,
  type FechamentoStatus,
} from "@/core/types/domain";

import { abrirFechamentosSchema, atualizarFechamentoSchema, fechamentoItemSchema } from "./schema";

const STAFF = ["admin", "contabil"] as const;

function flat(fd: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of new Set(fd.keys())) o[k] = fd.get(k);
  return o;
}

export async function abrirFechamentos(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ criadas: number }>> {
  const session = await requireRole(...STAFF);
  const parsed = abrirFechamentosSchema.safeParse(flat(formData));
  if (!parsed.success) return actionErr("Competência inválida.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("abrir_fechamentos", {
    p_competencia: parsed.data.competencia,
  });
  // error.message aqui é o "raise exception" da própria função (0012) —
  // mensagem já pensada pro usuário, não erro cru de tabela/constraint.
  if (error) return actionErr(error.message);

  await registrarHistorico({
    entidade: "fechamento",
    acao: "abriu",
    descricao: `${data ?? 0} fechamento(s) aberto(s) para a competência ${parsed.data.competencia.slice(0, 7)}`,
    autorId: session.userId,
  });
  revalidatePath("/contabil");
  return actionOk({ criadas: data ?? 0 });
}

export async function mudarStatusFechamento(
  id: string,
  novo: FechamentoStatus,
): Promise<ActionResult> {
  const session = await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();

  const { data: atual } = await supabase
    .from("fechamentos_contabeis")
    .select("status")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("fechamentos_contabeis")
    .update({ status: novo })
    .eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "fechamento",
    entidadeId: id,
    acao: "alterou_status",
    campo: "status",
    de: atual ? FECHAMENTO_STATUS_LABEL[atual.status as FechamentoStatus] : null,
    para: FECHAMENTO_STATUS_LABEL[novo],
    descricao: `Fechamento → ${FECHAMENTO_STATUS_LABEL[novo]}`,
    autorId: session.userId,
  });
  revalidatePath("/contabil");
  revalidatePath(`/contabil/${id}`);
  revalidatePath("/painel");
  return actionOk(undefined);
}

export async function atualizarFechamento(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole(...STAFF);
  const parsed = atualizarFechamentoSchema.safeParse(flat(formData));
  if (!parsed.success) {
    return actionErr("Verifique os campos.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("fechamentos_contabeis")
    .update({
      responsavel_id: parsed.data.responsavel_id,
      observacao: parsed.data.observacao,
    })
    .eq("id", parsed.data.id);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "fechamento",
    entidadeId: parsed.data.id,
    acao: "alterou",
    descricao: "Responsável/observação do fechamento atualizados",
    autorId: session.userId,
  });
  revalidatePath(`/contabil/${parsed.data.id}`);
  return actionOk(undefined);
}

export async function adicionarItemFechamento(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(...STAFF);
  const parsed = fechamentoItemSchema.safeParse(flat(formData));
  if (!parsed.success) return actionErr("Descreva o item.");

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("fechamento_itens")
    .select("id", { count: "exact", head: true })
    .eq("fechamento_id", parsed.data.fechamento_id);

  const { error } = await supabase.from("fechamento_itens").insert({
    fechamento_id: parsed.data.fechamento_id,
    descricao: parsed.data.descricao,
    ordem: count ?? 0,
  });
  if (error) return actionErr(mensagemErroBanco(error));
  revalidatePath(`/contabil/${parsed.data.fechamento_id}`);
  return actionOk(undefined);
}

export async function alternarItemFechamento(
  itemId: string,
  fechamentoId: string,
  feito: boolean,
): Promise<ActionResult> {
  const session = await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("fechamento_itens")
    .update({
      feito,
      feito_em: feito ? new Date().toISOString() : null,
      feito_por: feito ? session.userId : null,
    })
    .eq("id", itemId);
  if (error) return actionErr(mensagemErroBanco(error));
  revalidatePath(`/contabil/${fechamentoId}`);
  return actionOk(undefined);
}

export async function removerItemFechamento(
  itemId: string,
  fechamentoId: string,
): Promise<ActionResult> {
  await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("fechamento_itens")
    .delete()
    .eq("id", itemId);
  if (error) return actionErr(mensagemErroBanco(error));
  revalidatePath(`/contabil/${fechamentoId}`);
  return actionOk(undefined);
}
