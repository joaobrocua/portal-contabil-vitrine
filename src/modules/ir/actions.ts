"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/core/auth/session";
import { createSupabaseServerClient } from "@/core/db/server";
import { mensagemErroBanco } from "@/core/lib/erros";
import { registrarHistorico } from "@/core/lib/historico";
import {
  actionErr,
  actionOk,
  IR_STATUS_LABEL,
  IR_TIPO_LABEL,
  type ActionResult,
  type IrStatus,
  type IrTipo,
} from "@/core/types/domain";

import { atualizarDeclaracaoIrSchema, gerarDeclaracoesIrSchema } from "./schema";

const STAFF = ["admin", "fiscal", "contabil"] as const;

function flat(fd: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of new Set(fd.keys())) o[k] = fd.get(k);
  return o;
}

export async function gerarDeclaracoesIr(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ criadas: number }>> {
  const session = await requireRole(...STAFF);
  const parsed = gerarDeclaracoesIrSchema.safeParse(flat(formData));
  if (!parsed.success)
    return actionErr("Verifique os campos.", parsed.error.flatten().fieldErrors);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("gerar_declaracoes_ir", {
    p_tipo: parsed.data.tipo,
    p_ano: parsed.data.ano_exercicio,
    p_prazo: parsed.data.prazo,
  });
  // error.message aqui é o "raise exception" da própria função (0014) —
  // mensagem já pensada pro usuário, não erro cru de tabela/constraint.
  if (error) return actionErr(error.message);

  await registrarHistorico({
    entidade: "declaracao_ir",
    acao: "gerou",
    descricao: `${data ?? 0} declaração(ões) de ${IR_TIPO_LABEL[parsed.data.tipo as IrTipo]} geradas para ${parsed.data.ano_exercicio}`,
    autorId: session.userId,
  });
  revalidatePath("/ir");
  return actionOk({ criadas: data ?? 0 });
}

export async function mudarStatusDeclaracaoIr(
  id: string,
  novo: IrStatus,
): Promise<ActionResult> {
  const session = await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();

  const { data: atual } = await supabase
    .from("declaracoes_ir")
    .select("status, tipo")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("declaracoes_ir")
    .update({ status: novo })
    .eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "declaracao_ir",
    entidadeId: id,
    acao: "alterou_status",
    campo: "status",
    de: atual ? IR_STATUS_LABEL[atual.status as IrStatus] : null,
    para: IR_STATUS_LABEL[novo],
    descricao: `${atual ? IR_TIPO_LABEL[atual.tipo as IrTipo] : "IR"} → ${IR_STATUS_LABEL[novo]}`,
    autorId: session.userId,
  });
  revalidatePath("/ir");
  revalidatePath(`/ir/${id}`);
  revalidatePath("/painel");
  return actionOk(undefined);
}

export async function atualizarDeclaracaoIr(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole(...STAFF);
  const parsed = atualizarDeclaracaoIrSchema.safeParse(flat(formData));
  if (!parsed.success)
    return actionErr("Verifique os campos.", parsed.error.flatten().fieldErrors);

  const { id, ...resto } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("declaracoes_ir").update(resto).eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "declaracao_ir",
    entidadeId: id,
    acao: "alterou",
    descricao: "Declaração atualizada",
    autorId: session.userId,
  });
  revalidatePath(`/ir/${id}`);
  return actionOk(undefined);
}
