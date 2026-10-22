"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/core/auth/session";
import { createSupabaseServerClient } from "@/core/db/server";
import { mensagemErroBanco } from "@/core/lib/erros";
import { registrarHistorico } from "@/core/lib/historico";
import {
  actionErr,
  actionOk,
  PAPEIS_INTERNOS,
  type ActionResult,
} from "@/core/types/domain";

import { contatoSchema, empresaSchema, socioSchema } from "./schema";

const STAFF = PAPEIS_INTERNOS;

function flat(fd: FormData, multi: string[] = []): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    obj[key] = multi.includes(key)
      ? fd.getAll(key).map(String)
      : fd.get(key);
  }
  for (const m of multi) if (!(m in obj)) obj[m] = [];
  return obj;
}

/**
 * Honorário mensal é dado financeiro restrito a admin e vive em tabela
 * própria (empresa_honorarios, RLS só de admin — migration 0030), não na
 * linha da empresa. Valor vazio apaga o registro. Quem não é admin nem
 * chega aqui: o banco recusaria de qualquer jeito.
 */
async function gravarHonorario(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  empresaId: string,
  valor: number | null,
) {
  if (valor == null) {
    return supabase.from("empresa_honorarios").delete().eq("empresa_id", empresaId);
  }
  return supabase
    .from("empresa_honorarios")
    .upsert({ empresa_id: empresaId, valor }, { onConflict: "empresa_id" });
}

/* ------------------------------ empresas ----------------------------- */

export async function criarEmpresa(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole(...STAFF);
  const parsed = empresaSchema.safeParse(
    flat(formData, ["departamentos_responsaveis"]),
  );
  if (!parsed.success) {
    return actionErr(
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  // O honorário não faz parte da linha da empresa (ver gravarHonorario).
  const { honorario_mensal: honorario, ...dados } = parsed.data;
  const ehAdmin = session.profile.papel === "admin";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("empresas")
    .insert(dados)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505")
      return actionErr("Já existe uma empresa com este CNPJ.");
    return actionErr(mensagemErroBanco(error));
  }

  await registrarHistorico({
    entidade: "empresa",
    entidadeId: data.id,
    acao: "criou",
    descricao: `Empresa "${parsed.data.razao_social}" cadastrada`,
    autorId: session.userId,
  });

  revalidatePath("/empresas");

  // Por último: se o honorário falhar, a empresa já está registrada e na
  // lista (e reenviar o formulário daria "CNPJ já existe"); o aviso diz o
  // que fazer.
  if (ehAdmin && honorario != null) {
    const { error: eHon } = await gravarHonorario(supabase, data.id, honorario);
    if (eHon) {
      console.error("[empresas] honorário não gravado:", eHon.message);
      return actionErr(
        "A empresa foi cadastrada, mas não consegui gravar o honorário. Abra a empresa e informe o valor de novo.",
      );
    }
  }
  return actionOk({ id: data.id });
}

export async function atualizarEmpresa(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole(...STAFF);
  const id = String(formData.get("id") ?? "");
  if (!id) return actionErr("Empresa não informada.");

  const parsed = empresaSchema.safeParse(
    flat(formData, ["departamentos_responsaveis"]),
  );
  if (!parsed.success) {
    return actionErr(
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  // Honorário: só admin mexe (e só ele enxerga o campo na tela). Para quem
  // não é admin o valor nem é tocado — um campo oculto que viesse vazio não
  // pode apagar o valor que já estava lá.
  const { honorario_mensal: honorario, ...dados } = parsed.data;
  const ehAdmin = session.profile.papel === "admin";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("empresas")
    .update(dados)
    .eq("id", id);

  if (error) {
    if (error.code === "23505")
      return actionErr("Já existe uma empresa com este CNPJ.");
    return actionErr(mensagemErroBanco(error));
  }

  await registrarHistorico({
    entidade: "empresa",
    entidadeId: id,
    acao: "alterou",
    descricao: `Dados da empresa "${parsed.data.razao_social}" atualizados`,
    autorId: session.userId,
  });

  revalidatePath(`/empresas/${id}`);
  revalidatePath("/empresas");

  if (ehAdmin) {
    const { error: eHon } = await gravarHonorario(supabase, id, honorario);
    if (eHon) {
      console.error("[empresas] honorário não gravado:", eHon.message);
      return actionErr(
        "Os dados foram salvos, mas não consegui gravar o honorário. Tente de novo.",
      );
    }
  }
  return actionOk({ id });
}

export async function alternarAtivoEmpresa(
  id: string,
  ativo: boolean,
): Promise<ActionResult> {
  // Só admin: inativar uma empresa afeta todo mundo que trabalha com ela.
  // O banco também trava isso (trigger trg_empresa_ativo_so_admin em
  // 0022) — esta checagem é só pra dar erro amigável antes de bater lá.
  const session = await requireRole("admin");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("empresas")
    .update({ ativo })
    .eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "empresa",
    entidadeId: id,
    acao: ativo ? "reativou" : "inativou",
    descricao: ativo ? "Empresa reativada" : "Empresa inativada",
    autorId: session.userId,
  });
  revalidatePath("/empresas");
  revalidatePath(`/empresas/${id}`);
  return actionOk(undefined);
}

/* -------------------------------- sócios ---------------------------- */

export async function adicionarSocio(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(...STAFF);
  const parsed = socioSchema.safeParse(flat(formData));
  if (!parsed.success) {
    return actionErr(
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("socios").insert(parsed.data);
  if (error) return actionErr(mensagemErroBanco(error));
  revalidatePath(`/empresas/${parsed.data.empresa_id}`);
  return actionOk(undefined);
}

export async function removerSocio(
  id: string,
  empresaId: string,
): Promise<ActionResult> {
  const session = await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();
  const { data: socio } = await supabase
    .from("socios")
    .select("nome")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("socios").delete().eq("id", id);
  if (error) {
    // 23503 = violação de FK — o sócio tem declaração de IR vinculada
    // (declaracoes_ir_socio_id_fkey, ver 0022: é "on delete restrict" de
    // propósito, pra não perder histórico fiscal ao remover um sócio).
    if (error.code === "23503") {
      return actionErr(
        "Não é possível remover: este sócio tem declarações de IR " +
          "vinculadas. Remova ou reatribua as declarações primeiro.",
      );
    }
    return actionErr(mensagemErroBanco(error));
  }

  await registrarHistorico({
    entidade: "empresa",
    entidadeId: empresaId,
    acao: "excluiu",
    descricao: `Sócio "${socio?.nome ?? id}" removido`,
    autorId: session.userId,
  });

  revalidatePath(`/empresas/${empresaId}`);
  return actionOk(undefined);
}

/* ------------------------------- contatos -------------------------- */

export async function adicionarContato(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(...STAFF);
  const parsed = contatoSchema.safeParse(flat(formData));
  if (!parsed.success) {
    return actionErr(
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("contatos").insert(parsed.data);
  if (error) return actionErr(mensagemErroBanco(error));
  revalidatePath(`/empresas/${parsed.data.empresa_id}`);
  return actionOk(undefined);
}

export async function removerContato(
  id: string,
  empresaId: string,
): Promise<ActionResult> {
  const session = await requireRole(...STAFF);
  const supabase = await createSupabaseServerClient();
  const { data: contato } = await supabase
    .from("contatos")
    .select("nome")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("contatos").delete().eq("id", id);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "empresa",
    entidadeId: empresaId,
    acao: "excluiu",
    descricao: `Contato "${contato?.nome ?? id}" removido`,
    autorId: session.userId,
  });

  revalidatePath(`/empresas/${empresaId}`);
  return actionOk(undefined);
}
