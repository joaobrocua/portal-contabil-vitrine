"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/core/auth/session";
import { createSupabaseServerClient } from "@/core/db/server";
import { mensagemErroBanco } from "@/core/lib/erros";
import { registrarHistorico } from "@/core/lib/historico";
import {
  actionErr,
  actionOk,
  EVENTO_DP_CHECKLIST_PADRAO,
  EVENTO_DP_STATUS_LABEL,
  EVENTO_DP_TIPO_LABEL,
  type ActionResult,
  type EventoDpStatus,
  type EventoDpTipo,
  type FolhaStatus,
} from "@/core/types/domain";

import {
  abrirFolhasSchema,
  eventoDpSchema,
  evendoDpItemSchema,
  funcionarioSchema,
} from "./schema";

const STAFF = ["admin", "pessoal"] as const;

function flat(fd: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of new Set(fd.keys())) o[k] = fd.get(k);
  return o;
}

/* ------------------------------ funcionários ----------------------- */

export async function criarFuncionario(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole(...STAFF);
  const parsed = funcionarioSchema.safeParse(flat(formData));
  if (!parsed.success)
    return actionErr("Verifique os campos.", parsed.error.flatten().fieldErrors);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("funcionarios")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "funcionario",
    entidadeId: data.id,
    acao: "criou",
    descricao: `Funcionário "${parsed.data.nome}" cadastrado`,
    autorId: session.userId,
  });
  revalidatePath("/pessoal/funcionarios");
  return actionOk({ id: data.id });
}

export async function atualizarFuncionario(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole(...STAFF);
  const id = String(formData.get("id") ?? "");
  if (!id) return actionErr("Funcionário não informado.");
  const parsed = funcionarioSchema.safeParse(flat(formData));
  if (!parsed.success)
    return actionErr("Verifique os campos.", parsed.error.flatten().fieldErrors);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("funcionarios")
    .update(parsed.data)
    .eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "funcionario",
    entidadeId: id,
    acao: "alterou",
    descricao: `Funcionário "${parsed.data.nome}" atualizado`,
    autorId: session.userId,
  });
  revalidatePath(`/pessoal/funcionarios/${id}`);
  revalidatePath("/pessoal/funcionarios");
  return actionOk({ id });
}

/* -------------------------------- processos ------------------------- */

export async function criarEventoDp(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole(...STAFF);
  const parsed = eventoDpSchema.safeParse(flat(formData));
  if (!parsed.success)
    return actionErr("Verifique os campos.", parsed.error.flatten().fieldErrors);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("eventos_dp")
    .insert({ ...parsed.data, solicitado_por: session.userId })
    .select("id")
    .single();
  if (error) return actionErr(mensagemErroBanco(error));

  const checklist = EVENTO_DP_CHECKLIST_PADRAO[parsed.data.tipo as EventoDpTipo];
  if (checklist?.length) {
    const { error: itensError } = await supabase.from("evento_dp_itens").insert(
      checklist.map((descricao, ordem) => ({
        evento_id: data.id,
        descricao,
        ordem,
      })),
    );
    if (itensError) {
      console.error("[pessoal] checklist padrão não criado:", itensError.message);
      // Desfaz o processo recém-criado: se ele ficasse, o formulário continuaria
      // na tela e quem reenviasse criaria um duplicado.
      const { error: desfazError } = await supabase.from("eventos_dp").delete().eq("id", data.id);
      if (desfazError) {
        console.error("[pessoal] processo sem checklist não pôde ser desfeito:", desfazError.message);
        revalidatePath("/pessoal/processos");
        return actionErr(
          "O processo foi criado, mas sem o checklist padrão. Não envie de novo: abra o processo na lista e adicione os itens.",
        );
      }
      return actionErr("Não foi possível criar o processo (checklist padrão). Tente novamente.");
    }
  }

  await registrarHistorico({
    entidade: "evento_dp",
    entidadeId: data.id,
    acao: "criou",
    descricao: `Processo de ${EVENTO_DP_TIPO_LABEL[parsed.data.tipo as EventoDpTipo]} criado`,
    autorId: session.userId,
  });
  revalidatePath("/pessoal/processos");
  return actionOk({ id: data.id });
}

export async function atualizarEventoDp(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole(...STAFF);
  const id = String(formData.get("id") ?? "");
  if (!id) return actionErr("Processo não informado.");
  const parsed = eventoDpSchema.safeParse(flat(formData));
  if (!parsed.success)
    return actionErr("Verifique os campos.", parsed.error.flatten().fieldErrors);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("eventos_dp")
    .update(parsed.data)
    .eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "evento_dp",
    entidadeId: id,
    acao: "alterou",
    descricao: "Processo atualizado",
    autorId: session.userId,
  });
  revalidatePath(`/pessoal/processos/${id}`);
  revalidatePath("/pessoal/processos");
  return actionOk({ id });
}

export async function mudarStatusEventoDp(
  id: string,
  novo: EventoDpStatus,
): Promise<ActionResult> {
  const session = await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();

  const { data: atual } = await supabase
    .from("eventos_dp")
    .select("status, tipo")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("eventos_dp")
    .update({ status: novo })
    .eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "evento_dp",
    entidadeId: id,
    acao: "alterou_status",
    campo: "status",
    de: atual ? EVENTO_DP_STATUS_LABEL[atual.status as EventoDpStatus] : null,
    para: EVENTO_DP_STATUS_LABEL[novo],
    descricao: `Processo de ${
      atual ? EVENTO_DP_TIPO_LABEL[atual.tipo as EventoDpTipo] : "DP"
    } → ${EVENTO_DP_STATUS_LABEL[novo]}`,
    autorId: session.userId,
  });
  revalidatePath("/pessoal/processos");
  revalidatePath(`/pessoal/processos/${id}`);
  revalidatePath("/painel");
  return actionOk(undefined);
}

/* -------------------------------- checklist -------------------------- */

export async function adicionarItemEventoDp(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(...STAFF);
  const parsed = evendoDpItemSchema.safeParse(flat(formData));
  if (!parsed.success) return actionErr("Descreva o item.");

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("evento_dp_itens")
    .select("id", { count: "exact", head: true })
    .eq("evento_id", parsed.data.evento_id);

  const { error } = await supabase.from("evento_dp_itens").insert({
    evento_id: parsed.data.evento_id,
    descricao: parsed.data.descricao,
    ordem: count ?? 0,
  });
  if (error) return actionErr(mensagemErroBanco(error));
  revalidatePath(`/pessoal/processos/${parsed.data.evento_id}`);
  return actionOk(undefined);
}

export async function alternarItemEventoDp(
  itemId: string,
  eventoId: string,
  feito: boolean,
): Promise<ActionResult> {
  const session = await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("evento_dp_itens")
    .update({
      feito,
      feito_em: feito ? new Date().toISOString() : null,
      feito_por: feito ? session.userId : null,
    })
    .eq("id", itemId);
  if (error) return actionErr(mensagemErroBanco(error));
  revalidatePath(`/pessoal/processos/${eventoId}`);
  return actionOk(undefined);
}

export async function removerItemEventoDp(
  itemId: string,
  eventoId: string,
): Promise<ActionResult> {
  await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("evento_dp_itens")
    .delete()
    .eq("id", itemId);
  if (error) return actionErr(mensagemErroBanco(error));
  revalidatePath(`/pessoal/processos/${eventoId}`);
  return actionOk(undefined);
}

/* ---------------------------------- folhas ---------------------------- */

export async function abrirFolhas(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ criadas: number }>> {
  const session = await requireRole(...STAFF);
  const parsed = abrirFolhasSchema.safeParse(flat(formData));
  if (!parsed.success || !parsed.data.competencia)
    return actionErr("Competência inválida.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("abrir_folhas", {
    p_competencia: parsed.data.competencia,
  });
  // error.message aqui é o "raise exception" da própria função (0017) —
  // mensagem já pensada pro usuário, não erro cru de tabela/constraint.
  if (error) return actionErr(error.message);

  await registrarHistorico({
    entidade: "folha",
    acao: "abriu",
    descricao: `${data ?? 0} folha(s) aberta(s) para a competência ${parsed.data.competencia.slice(0, 7)}`,
    autorId: session.userId,
  });
  revalidatePath("/pessoal/folhas");
  return actionOk({ criadas: data ?? 0 });
}

export async function mudarStatusFolha(
  id: string,
  novo: FolhaStatus,
): Promise<ActionResult> {
  const session = await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("folhas")
    .update({ status: novo })
    .eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "folha",
    entidadeId: id,
    acao: "alterou_status",
    para: novo,
    descricao: `Folha marcada como ${novo}`,
    autorId: session.userId,
  });
  revalidatePath("/pessoal/folhas");
  return actionOk(undefined);
}
