"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/core/db/server";
import { safeNextPath } from "@/core/lib/safe-redirect";
import { actionErr, actionOk, type ActionResult } from "@/core/types/domain";

import { requireSession } from "./session";
import { clientIp, confirmarSucesso, descartarEvento, limiteExcedido, registrarEvento } from "./rate-limit";

const MSG_BLOQUEIO =
  "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.";

export async function signInWithPassword(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ next: string }>> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return actionErr("Informe e-mail e senha.");
  }

  const ip = await clientIp();
  // A tentativa é registrada (como falha) ANTES de checar o limite e de
  // verificar a senha. Se fosse depois, 100 pedidos simultâneos leriam todos
  // "0 falhas" e o limite não valeria. Como a própria tentativa já está na
  // contagem, o teto vira 6 (= 5 anteriores + esta) e 21 por IP.
  const tentativa = await registrarEvento("login", email, false, ip);
  const bloqueado = await limiteExcedido({
    tipo: "login",
    chave: email,
    maxPorChave: 6,
    janelaMinutos: 15,
    ip,
    maxPorIp: 21, // trava mais folgada, cobre tentativa distribuída por vários e-mails
  });
  if (bloqueado) {
    await descartarEvento(tentativa);
    return actionErr(MSG_BLOQUEIO);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return actionErr("E-mail ou senha inválidos.");
  }
  await confirmarSucesso(tentativa);

  // Senha certa não basta: conta desativada não entra (o ban no GoTrue já
  // cobre quem foi desativado pela tela de Usuários; isto cobre desativação
  // feita direto no banco).
  const { data: profile } = await supabase
    .from("profiles")
    .select("ativo")
    .eq("id", data.user.id)
    .single();
  if (!profile?.ativo) {
    await supabase.auth.signOut();
    return actionErr("Conta desativada. Fale com o administrador do escritório.");
  }

  return actionOk({ next });
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Troca a própria senha (usuário já logado). Exige a senha atual — sem
 * isso, quem encontrasse uma sessão aberta (computador destravado, etc.)
 * poderia trocar a senha sem saber a original. Não depende de e-mail (sem
 * provedor SMTP configurado ainda — ver V3); "esqueci minha senha"
 * continua sendo o admin resetando pela tela de Usuários.
 */
export async function trocarMinhaSenha(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  const senhaAtual = String(formData.get("senha_atual") ?? "");
  const novaSenha = String(formData.get("nova_senha") ?? "");
  const confirmacao = String(formData.get("confirmar_nova_senha") ?? "");

  if (!senhaAtual || !novaSenha) {
    return actionErr("Informe a senha atual e a nova senha.");
  }
  if (novaSenha.length < 8) {
    return actionErr("A nova senha precisa ter no mínimo 8 caracteres.");
  }
  if (novaSenha !== confirmacao) {
    return actionErr("A confirmação não bate com a nova senha.");
  }
  if (novaSenha === senhaAtual) {
    return actionErr("A nova senha precisa ser diferente da atual.");
  }

  const ip = await clientIp();
  const bloqueado = await limiteExcedido({
    tipo: "trocar_senha",
    chave: session.userId,
    maxPorChave: 5,
    janelaMinutos: 15,
    ip,
    maxPorIp: 20,
  });
  if (bloqueado) return actionErr(MSG_BLOQUEIO);

  const supabase = await createSupabaseServerClient();

  // Confirma a senha atual reautenticando — é isso que garante que quem
  // está trocando de fato sabe a senha antiga, não só está com a sessão
  // aberta.
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: session.email,
    password: senhaAtual,
  });
  await registrarEvento("trocar_senha", session.userId, !authError, ip);
  if (authError) return actionErr("Senha atual incorreta.");

  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) return actionErr("Não foi possível trocar a senha. Tente novamente.");

  // Quem tinha a senha antiga (ou uma sessão roubada) em outro aparelho
  // perde o acesso; só esta sessão continua.
  const { error: erroSessoes } = await supabase.auth.signOut({ scope: "others" });
  if (erroSessoes) console.error("[auth] sessões antigas não encerradas:", erroSessoes.message);

  return actionOk(undefined);
}
