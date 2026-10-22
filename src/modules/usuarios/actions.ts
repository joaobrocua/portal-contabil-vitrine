"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { limiteExcedido, registrarEvento } from "@/core/auth/rate-limit";
import { requireRole } from "@/core/auth/session";
import { createSupabaseAdminClient } from "@/core/db/admin";
import { createSupabaseServerClient } from "@/core/db/server";
import { mensagemErroBanco } from "@/core/lib/erros";
import { registrarHistorico } from "@/core/lib/historico";
import { SUPABASE_SERVICE_ROLE_KEY } from "@/core/db/env";
import {
  actionErr,
  actionOk,
  type ActionResult,
} from "@/core/types/domain";

const PAPEIS = [
  "admin",
  "fiscal",
  "pessoal",
  "contabil",
  "societario",
  "atendimento",
  "cliente",
] as const;

const DEPS = [
  "fiscal",
  "pessoal",
  "contabil",
  "societario",
  "ir",
  "atendimento",
  "geral",
] as const;

const novoSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  email: z.string().trim().email("E-mail inválido"),
  senha: z.string().min(8, "Mínimo de 8 caracteres"),
  papel: z.enum(PAPEIS),
  departamento: z
    .enum(DEPS)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  telefone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : null)),
});

export async function criarUsuario(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("admin");
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return actionErr(
      "SUPABASE_SERVICE_ROLE_KEY não configurada — necessária para criar usuários.",
    );
  }

  // Trava de volume: uma sessão de admin comprometida não vira uma fábrica
  // de contas — não é sobre "adivinhar" nada, então conta toda tentativa,
  // não só falha.
  const bloqueado = await limiteExcedido({
    tipo: "criar_usuario",
    chave: session.userId,
    maxPorChave: 10,
    janelaMinutos: 60,
    apenasFalhas: false,
  });
  if (bloqueado) {
    return actionErr("Muitos usuários criados em pouco tempo. Aguarde antes de criar outro.");
  }

  const parsed = novoSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionErr("Verifique os campos.", parsed.error.flatten().fieldErrors);
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.senha,
    email_confirm: true,
    user_metadata: {
      nome: parsed.data.nome,
      papel: parsed.data.papel,
      departamento: parsed.data.departamento,
    },
  });
  await registrarEvento("criar_usuario", session.userId, !error, null);
  // Erro do GoTrue (não do Postgres) — mensagens como "User already
  // registered" já são pensadas pra aparecer pro usuário, sem vazar
  // detalhe de schema. mensagemErroBanco() é só pros erros de
  // tabela/RLS/constraint do banco, não pra isso.
  if (error) return actionErr(error.message);

  // garante o profile (caso o trigger ainda não tenha corrido)
  const { error: erroPerfil } = await admin.from("profiles").upsert({
    id: data.user.id,
    nome: parsed.data.nome,
    email: parsed.data.email,
    papel: parsed.data.papel,
    departamento: parsed.data.departamento,
    telefone: parsed.data.telefone,
    ativo: true,
  });
  if (erroPerfil) {
    // A conta já existe no login; sem o perfil correto ela ficaria com o
    // papel padrão do trigger. Avisa em vez de fingir que deu certo.
    console.error("[usuarios] perfil não gravado:", erroPerfil.message);
    revalidatePath("/usuarios");
    return actionErr(
      "A conta foi criada, mas não foi possível gravar o papel e os dados dela. Confira em Usuários e ajuste.",
    );
  }

  await registrarHistorico({
    entidade: "usuario",
    entidadeId: data.user.id,
    acao: "criou",
    descricao: `Usuário "${parsed.data.nome}" (${parsed.data.papel}) criado`,
    autorId: session.userId,
  });

  revalidatePath("/usuarios");
  return actionOk(undefined);
}

const updateSchema = z.object({
  id: z.string().uuid(),
  papel: z.enum(PAPEIS),
  // .nullable() além de .optional()/"" — quem chama (usuarios-table.tsx)
  // manda `departamento: dep || null` quando o campo fica vazio, e sem
  // isso o schema recusava (null não batia com nenhuma alternativa),
  // falhando toda atualização de usuário sem departamento selecionado.
  departamento: z
    .enum(DEPS)
    .optional()
    .or(z.literal(""))
    .nullable()
    .transform((v) => (v ? v : null)),
  // boolean de verdade: z.coerce.boolean() transformaria o texto "false" em true
  ativo: z.boolean(),
});

export async function atualizarUsuario(input: {
  id: string;
  papel: string;
  departamento: string | null;
  ativo: boolean;
}): Promise<ActionResult> {
  const session = await requireRole("admin");
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return actionErr("Dados inválidos.");
  if (parsed.data.id === session.userId && !parsed.data.ativo) {
    return actionErr("Você não pode desativar a própria conta.");
  }

  const supabase = await createSupabaseServerClient();

  // O escritório nunca pode ficar sem administrador ativo: rebaixar ou
  // desativar o último trancaria todo mundo para fora da Administração.
  if (parsed.data.papel !== "admin" || !parsed.data.ativo) {
    const { data: alvo, error: erroAlvo } = await supabase
      .from("profiles")
      .select("papel, ativo")
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (erroAlvo) return actionErr(mensagemErroBanco(erroAlvo));
    if (alvo?.papel === "admin" && alvo.ativo) {
      const { count, error: erroConta } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("papel", "admin")
        .eq("ativo", true)
        .neq("id", parsed.data.id);
      if (erroConta) return actionErr(mensagemErroBanco(erroConta));
      if ((count ?? 0) === 0) {
        return actionErr("Este é o último administrador ativo. Crie ou ative outro antes de alterar este.");
      }
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      papel: parsed.data.papel,
      departamento: parsed.data.departamento,
      ativo: parsed.data.ativo,
    })
    .eq("id", parsed.data.id);
  if (error) {
    // trigger 0032: a trava do último admin também vale no banco (corrida entre dois admins)
    if (error.code === "23514") {
      return actionErr("Este é o último administrador ativo. Crie ou ative outro antes de alterar este.");
    }
    return actionErr(mensagemErroBanco(error));
  }

  // Desativar no profile não derruba a sessão já aberta: o refresh token
  // seguiria emitindo JWTs. O ban no GoTrue impede novos tokens/login;
  // reativar remove o ban.
  if (SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createSupabaseAdminClient();
    const { error: banError } = await admin.auth.admin.updateUserById(
      parsed.data.id,
      { ban_duration: parsed.data.ativo ? "none" : "876000h" },
    );
    if (banError) {
      return actionErr(
        `Perfil atualizado, mas não foi possível ${
          parsed.data.ativo ? "liberar" : "bloquear"
        } o acesso: ${banError.message}`,
      );
    }
  }

  await registrarHistorico({
    entidade: "usuario",
    entidadeId: parsed.data.id,
    acao: "alterou",
    descricao: `Usuário atualizado (${parsed.data.papel}${
      parsed.data.ativo ? "" : ", inativo"
    })`,
    autorId: session.userId,
  });

  revalidatePath("/usuarios");
  return actionOk(undefined);
}

const redefinirSenhaSchema = z.object({
  id: z.string().uuid(),
  senha: z.string().min(8, "Mínimo de 8 caracteres"),
});

/**
 * Admin define uma senha provisória pra outro usuário (o caso "esqueci
 * minha senha" — sem provedor de e-mail, não tem link de recuperação).
 * Não serve pra própria conta: pra isso existe Minha conta, que exige a
 * senha atual — senão uma sessão de admin deixada aberta viraria um jeito
 * de trocar a senha dele sem conhecê-la.
 */
export async function redefinirSenhaUsuario(input: {
  id: string;
  senha: string;
}): Promise<ActionResult> {
  const session = await requireRole("admin");
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return actionErr(
      "SUPABASE_SERVICE_ROLE_KEY não configurada — necessária para redefinir senhas.",
    );
  }

  const parsed = redefinirSenhaSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr(
      parsed.error.flatten().fieldErrors.senha?.[0] ?? "Dados inválidos.",
    );
  }
  if (parsed.data.id === session.userId) {
    return actionErr("Para trocar a sua própria senha, use Minha conta.");
  }

  // Mesma trava de volume da criação de usuário: conta toda tentativa.
  const bloqueado = await limiteExcedido({
    tipo: "redefinir_senha",
    chave: session.userId,
    maxPorChave: 10,
    janelaMinutos: 60,
    apenasFalhas: false,
  });
  if (bloqueado) {
    return actionErr("Muitas senhas redefinidas em pouco tempo. Aguarde e tente de novo.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(parsed.data.id, {
    password: parsed.data.senha,
  });
  await registrarEvento("redefinir_senha", session.userId, !error, null);
  // Erro do GoTrue (ex.: senha fraca demais) — já é mensagem pensada pro
  // usuário, não detalhe de schema.
  if (error) return actionErr(error.message);

  // Nunca registrar a senha no histórico — só o fato.
  await registrarHistorico({
    entidade: "usuario",
    entidadeId: parsed.data.id,
    acao: "redefiniu_senha",
    descricao: "Senha redefinida pelo administrador",
    autorId: session.userId,
  });

  return actionOk(undefined);
}
