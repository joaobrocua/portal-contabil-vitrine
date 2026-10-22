import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import { isModuleEnabled, type ModuleId } from "@/core/config/modules";
import { createSupabaseServerClient } from "@/core/db/server";
import type { ProfileRow } from "@/core/db/types";
import { isStaff, type Papel } from "@/core/types/domain";

export interface SessionContext {
  userId: string;
  email: string;
  profile: ProfileRow;
}

/**
 * Perfil do usuário logado, ou null se não autenticado / inativo.
 *
 * `cache()` do React deduplica chamadas repetidas dentro da MESMA
 * requisição (layout + várias páginas/componentes chamando
 * getSession/requireRole na mesma renderização viravam uma query de Auth +
 * uma em `profiles` cada vez, sem isso) — não é cache entre requisições
 * nem entre usuários diferentes, o React zera isso a cada requisição nova.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createSupabaseServerClient();
  // getClaims confere a assinatura do token localmente (chave pública do
  // Auth, baixada uma vez e guardada) — sem ida ao servidor de Auth, que
  // custava ~185 ms por chamada. A revogação que importa (usuário
  // desativado) continua imediata: o perfil é lido do banco logo abaixo.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", claims.sub)
    .single();

  if (!profile || !profile.ativo) return null;

  const email = typeof claims.email === "string" && claims.email ? claims.email : profile.email;
  return { userId: claims.sub, email, profile };
});

/** Exige autenticação. Redireciona para /login se não houver sessão. */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Exige um dos papéis informados. Redireciona para /painel se não autorizado. */
export async function requireRole(...papeis: Papel[]): Promise<SessionContext> {
  const session = await requireSession();
  if (papeis.length > 0 && !papeis.includes(session.profile.papel)) {
    redirect("/painel");
  }
  return session;
}

/** Bloqueia rotas de módulos desligados no registro. */
export function assertModuleEnabled(id: ModuleId): void {
  if (!isModuleEnabled(id)) notFound();
}

/**
 * IDs das empresas que o usuário pode ver.
 * - staff: null (= todas; RLS libera)
 * - cliente: empresas em que ele é contato
 */
export async function empresaIdsVisiveis(
  session: SessionContext,
): Promise<string[] | null> {
  if (isStaff(session.profile.papel)) return null;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("contatos")
    .select("empresa_id")
    .eq("profile_id", session.userId);

  return (data ?? []).map((r) => r.empresa_id);
}

export { isStaff };
