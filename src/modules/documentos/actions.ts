"use server";

import { revalidatePath } from "next/cache";

import { requireRole, requireSession } from "@/core/auth/session";
import { createSupabaseAdminClient } from "@/core/db/admin";
import { createSupabaseServerClient } from "@/core/db/server";
import { mensagemErroBanco } from "@/core/lib/erros";
import { registrarHistorico } from "@/core/lib/historico";
import {
  actionErr,
  actionOk,
  isStaff,
  PAPEIS_INTERNOS,
  type ActionResult,
} from "@/core/types/domain";

import { assinaturaCombinaComMime, mimePelaExtensao } from "./assinaturas";
import {
  departamentosParaEnvio,
  registrarDocumentoSchema,
  revisarDocumentoSchema,
} from "./schema";

function flat(fd: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of new Set(fd.keys())) o[k] = fd.get(k);
  return o;
}

/**
 * Trilha LGPD. Best-effort: falhar aqui não derruba o upload/download, mas
 * vai pro log do servidor — antes o erro era descartado em silêncio, e uma
 * policy errada (0023 → corrigida na 0026) passou dias sem ninguém notar.
 */
async function registrarAcesso(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  documentoId: string,
  profileId: string,
  acao: "upload" | "download",
) {
  const { error } = await supabase.from("documento_acessos").insert({
    documento_id: documentoId,
    profile_id: profileId,
    acao,
  });
  if (error) mensagemErroBanco(error);
}

/** Registra o documento após o upload do arquivo para o Storage. */
export async function registrarDocumento(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();
  const parsed = registrarDocumentoSchema.safeParse(flat(formData));
  if (!parsed.success) {
    return actionErr(
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const staff = isStaff(session.profile.papel);
  const supabase = await createSupabaseServerClient();
  const dados = parsed.data;

  // Só apaga arquivo que NÃO pertence a nenhum documento. Um retry de rede ou
  // pedido repetido (o caminho já registrado, índice único) não pode apagar o
  // arquivo de um documento que já existe. A consulta usa a chave de serviço
  // porque a RLS esconderia, por exemplo, um documento do Pessoal.
  async function limparArquivoOrfao() {
    const { data: jaRegistrado } = await createSupabaseAdminClient()
      .from("documentos")
      .select("id")
      .eq("storage_path", dados.storage_path)
      .maybeSingle();
    if (jaRegistrado) return;
    await supabase.storage.from("documentos").remove([dados.storage_path]);
  }

  // O navegador sobe o arquivo ANTES de chegar aqui, então a regra "documento
  // do Pessoal só do Pessoal/admin" também é conferida no servidor: sem isto,
  // uma tela desatualizada ou um pedido forjado cairia num erro genérico do
  // banco e deixaria o arquivo para trás.
  if (!departamentosParaEnvio(session.profile.papel).includes(dados.departamento)) {
    await limparArquivoOrfao();
    return actionErr(
      "Documentos do Pessoal só podem ser enviados pelo Pessoal ou pelo administrador.",
    );
  }

  // O Content-Type do upload é o que o navegador declarou — não garante
  // nada sobre o conteúdo real, e às vezes nem vem preenchido (alguns
  // sistemas não associam .csv/.xml a um tipo, então o campo chega vazio
  // por um motivo legítimo). Nos dois casos, sempre confere a assinatura
  // dos bytes — nunca pula essa checagem: sem mime declarado, deriva da
  // extensão do arquivo (já validada contra a allow-list no client).
  const mimeParaVerificar = dados.mime ?? mimePelaExtensao(dados.storage_path);
  if (!mimeParaVerificar) {
    await limparArquivoOrfao();
    return actionErr("Não foi possível determinar o tipo do arquivo.");
  }

  const { data: arquivo, error: dlError } = await supabase.storage
    .from("documentos")
    .download(dados.storage_path);
  if (dlError || !arquivo) {
    await limparArquivoOrfao();
    return actionErr("Não foi possível verificar o arquivo enviado.");
  }
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (!assinaturaCombinaComMime(mimeParaVerificar, bytes)) {
    await limparArquivoOrfao();
    return actionErr(
      "O conteúdo do arquivo não corresponde ao tipo declarado.",
    );
  }

  const { data, error } = await supabase
    .from("documentos")
    .insert({
      ...parsed.data,
      // Sempre grava o mime que foi de fato verificado (nunca null quando
      // dava pra determinar pela extensão).
      mime: mimeParaVerificar,
      origem: staff ? "escritorio" : "cliente",
      status: staff ? "recebido" : "pendente",
      enviado_por: session.userId,
    })
    .select("id")
    .single();
  if (error) {
    await limparArquivoOrfao();
    return actionErr(mensagemErroBanco(error));
  }

  await registrarAcesso(supabase, data.id, session.userId, "upload");

  await registrarHistorico({
    entidade: "documento",
    entidadeId: data.id,
    acao: "enviou",
    descricao: `Documento "${parsed.data.titulo}" enviado`,
    autorId: session.userId,
  });

  revalidatePath("/documentos");
  return actionOk({ id: data.id });
}

export async function revisarDocumento(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole(...PAPEIS_INTERNOS);
  const parsed = revisarDocumentoSchema.safeParse(flat(formData));
  if (!parsed.success) return actionErr("Dados inválidos.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("documentos")
    .update({
      status: parsed.data.status,
      observacao: parsed.data.observacao,
      revisado_por: session.userId,
      revisado_em: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);
  if (error) return actionErr(mensagemErroBanco(error));

  await registrarHistorico({
    entidade: "documento",
    entidadeId: parsed.data.id,
    acao: "revisou",
    campo: "status",
    para: parsed.data.status,
    descricao: `Documento marcado como ${parsed.data.status}`,
    autorId: session.userId,
  });

  revalidatePath("/documentos");
  return actionOk(undefined);
}

/**
 * URL assinada para download (registra o acesso). O caminho do arquivo vem
 * do próprio registro no banco — nunca do navegador —, então a trilha de
 * acessos sempre aponta pro documento que foi de fato baixado.
 */
export async function urlDownload(
  documentoId: string,
): Promise<ActionResult<{ url: string }>> {
  const session = await requireSession();
  const supabase = await createSupabaseServerClient();
  const { data: doc } = await supabase
    .from("documentos")
    .select("storage_path")
    .eq("id", documentoId)
    .maybeSingle();
  if (!doc) return actionErr("Documento não encontrado.");

  const { data, error } = await supabase.storage
    .from("documentos")
    .createSignedUrl(doc.storage_path, 60);
  if (error || !data) {
    if (error) return actionErr(mensagemErroBanco(error));
    return actionErr("Falha ao gerar link.");
  }

  await registrarAcesso(supabase, documentoId, session.userId, "download");

  return actionOk({ url: data.signedUrl });
}

/**
 * Exclui o documento (registro + arquivo). Só equipe do escritório.
 * A exclusão entra ANTES na trilha de acessos (que desde a 0027 sobrevive
 * ao documento) — se não der pra registrar quem excluiu, não exclui.
 */
export async function excluirDocumento(
  documentoId: string,
): Promise<ActionResult> {
  const session = await requireRole(...PAPEIS_INTERNOS);
  const supabase = await createSupabaseServerClient();

  const { data: doc } = await supabase
    .from("documentos")
    .select("id, titulo, storage_path, empresa_id")
    .eq("id", documentoId)
    .maybeSingle();
  if (!doc) return actionErr("Documento não encontrado.");

  const { error: trilhaError } = await supabase.from("documento_acessos").insert({
    documento_id: doc.id,
    profile_id: session.userId,
    acao: "excluiu",
  });
  if (trilhaError) return actionErr(mensagemErroBanco(trilhaError));

  const { data: apagados, error } = await supabase
    .from("documentos")
    .delete()
    .eq("id", doc.id)
    .select("id");
  if (error) return actionErr(mensagemErroBanco(error));
  // A RLS que barra a exclusão NÃO dá erro: devolve zero linhas. Só se a
  // linha realmente saiu é que o arquivo pode ser apagado — com a chave de
  // serviço, que passa por cima de qualquer regra do Storage.
  if (!apagados || apagados.length !== 1) {
    return actionErr("Você não tem permissão para excluir este documento.");
  }

  // O registro já saiu; o arquivo é removido em seguida, aqui no servidor
  // (o staff não apaga arquivo direto pela API do Storage — migration 0031).
  // Só se o caminho estiver na pasta da PRÓPRIA empresa do documento: a RLS
  // deixa o staff registrar qualquer caminho, e sem esta checagem uma linha
  // forjada faria a chave de serviço apagar arquivo de outra pasta.
  // Se a remoção falhar, sobra só um arquivo órfão (invisível na tela) — log.
  if (doc.storage_path.startsWith(`${doc.empresa_id}/`)) {
    const { error: storageError } = await createSupabaseAdminClient()
      .storage.from("documentos")
      .remove([doc.storage_path]);
    if (storageError) mensagemErroBanco(storageError);
  }

  await registrarHistorico({
    entidade: "documento",
    entidadeId: doc.id,
    acao: "excluiu",
    descricao: `Documento "${doc.titulo}" excluído`,
    autorId: session.userId,
  });

  revalidatePath("/documentos");
  return actionOk(undefined);
}
