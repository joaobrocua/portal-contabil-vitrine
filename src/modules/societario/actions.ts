"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/core/auth/session";
import { createSupabaseServerClient } from "@/core/db/server";
import { mensagemErroBanco } from "@/core/lib/erros";
import { registrarHistorico } from "@/core/lib/historico";
import {
  actionErr,
  actionOk,
  PROCESSO_SOCIETARIO_CHECKLIST_PADRAO,
  PROCESSO_SOCIETARIO_STATUS_LABEL,
  PROCESSO_SOCIETARIO_TIPO_LABEL,
  type ActionResult,
  type ProcessoSocietarioStatus,
  type ProcessoSocietarioTipo,
} from "@/core/types/domain";

import { processoSocietarioItemSchema, processoSocietarioSchema } from "./schema";

const STAFF = ["admin", "societario"] as const;

function flat(fd: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of new Set(fd.keys())) o[k] = fd.get(k);
  return o;
}

export async function criarProcessoSocietario(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole(...STAFF);
  const parsed = processoSocietarioSchema.safeParse(flat(formData));
  if (!parsed.success)
    return actionErr("Verifique os campos.", parsed.error.flatten().fieldErrors);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("processos_societarios")
    .insert({ ...parsed.data, solicitado_por: session.userId })
    .select("id")
    .single();
  if (error) return actionErr(mensagemErroBanco(error));

  const checklist =
    PROCESSO_SOCIETARIO_CHECKLIST_PADRAO[parsed.data.tipo as ProcessoSocietarioTipo];
  if (checklist?.length) {
    const { error: itensError } = await supabase.from("processo_societario_itens").insert(
      checklist.map((descricao, ordem) => ({
        processo_id: data.id,
        descricao,
        ordem,
      })),
    );
    if (itensError) {
      console.error("[societario] checklist padrão não criado:", itensError.message);
      // Desfaz o processo recém-criado: se ele ficasse, o formulário continuaria
      // na tela e quem reenviasse criaria um duplicado.
      const { error: desfazError } = await supabase.from("processos_societarios").delete().eq("id", data.id);
      if (desfazError) {
        console.error("[societario] processo sem checklist não pôde ser desfeito:", desfazError.message);
        revalidatePath("/societario");
        return actionErr(
          "O processo foi criado, mas sem o checklist padrão. Não envie de novo: abra o processo na lista e adicione os itens.",
        );
      }
      return actionErr("Não foi possível criar o processo (checklist padrão). Tente novamente.");
    }
  }

  await registrarHistorico({
    entidade: "processo_societario",
    entidadeId: data.id,
    acao: "criou",
    descricao: `Processo de ${PROCESSO_SOCIETARIO_TIPO_LABEL[parsed.data.tipo as ProcessoSocietarioTipo]} criado`,
    autorId: session.userId,
  });
  revalidatePath("/societario");
  return actionOk({ id: data.id });
}

export async function atualizarProcessoSocietario(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole(...STAFF);
  const id = String(formData.get("id") ?? "");
  if (!id) return actionErr("Processo não informado.");
  const parsed = processoSocietarioSchema.safeParse(flat(formData));
  if (!parsed.success)
    return actionErr("Verifique os campos.", parsed.error.flatten().fieldErrors);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("processos_societarios")
    .update(parsed.data)
    .eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "processo_societario",
    entidadeId: id,
    acao: "alterou",
    descricao: "Processo atualizado",
    autorId: session.userId,
  });
  revalidatePath(`/societario/${id}`);
  revalidatePath("/societario");
  return actionOk({ id });
}

export async function mudarStatusProcessoSocietario(
  id: string,
  novo: ProcessoSocietarioStatus,
): Promise<ActionResult> {
  const session = await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();

  const { data: atual } = await supabase
    .from("processos_societarios")
    .select("status, tipo")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("processos_societarios")
    .update({ status: novo })
    .eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "processo_societario",
    entidadeId: id,
    acao: "alterou_status",
    campo: "status",
    de: atual ? PROCESSO_SOCIETARIO_STATUS_LABEL[atual.status as ProcessoSocietarioStatus] : null,
    para: PROCESSO_SOCIETARIO_STATUS_LABEL[novo],
    descricao: `Processo de ${
      atual ? PROCESSO_SOCIETARIO_TIPO_LABEL[atual.tipo as ProcessoSocietarioTipo] : "societário"
    } → ${PROCESSO_SOCIETARIO_STATUS_LABEL[novo]}`,
    autorId: session.userId,
  });
  revalidatePath("/societario");
  revalidatePath(`/societario/${id}`);
  revalidatePath("/painel");
  return actionOk(undefined);
}

/* -------------------------------- checklist -------------------------- */

export async function adicionarItemProcessoSocietario(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(...STAFF);
  const parsed = processoSocietarioItemSchema.safeParse(flat(formData));
  if (!parsed.success) return actionErr("Descreva o item.");

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("processo_societario_itens")
    .select("id", { count: "exact", head: true })
    .eq("processo_id", parsed.data.processo_id);

  const { error } = await supabase.from("processo_societario_itens").insert({
    processo_id: parsed.data.processo_id,
    descricao: parsed.data.descricao,
    ordem: count ?? 0,
  });
  if (error) return actionErr(mensagemErroBanco(error));
  revalidatePath(`/societario/${parsed.data.processo_id}`);
  return actionOk(undefined);
}

export async function alternarItemProcessoSocietario(
  itemId: string,
  processoId: string,
  feito: boolean,
): Promise<ActionResult> {
  const session = await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("processo_societario_itens")
    .update({
      feito,
      feito_em: feito ? new Date().toISOString() : null,
      feito_por: feito ? session.userId : null,
    })
    .eq("id", itemId);
  if (error) return actionErr(mensagemErroBanco(error));
  revalidatePath(`/societario/${processoId}`);
  return actionOk(undefined);
}

export async function removerItemProcessoSocietario(
  itemId: string,
  processoId: string,
): Promise<ActionResult> {
  await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("processo_societario_itens")
    .delete()
    .eq("id", itemId);
  if (error) return actionErr(mensagemErroBanco(error));
  revalidatePath(`/societario/${processoId}`);
  return actionOk(undefined);
}
