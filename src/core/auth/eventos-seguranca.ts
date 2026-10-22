import "server-only";

import { createSupabaseAdminClient } from "@/core/db/admin";

import { requireRole } from "./session";

/**
 * Leitura da tabela `eventos_seguranca` (alimentada pelo limite de
 * tentativas em `rate-limit.ts`) para a tela de Administração. A tabela não
 * tem policy nenhuma — só a service role lê —, então a checagem de admin
 * fica aqui dentro, e não só na página que chama.
 */

export const EVENTO_SEGURANCA_LABEL: Record<string, string> = {
  login: "Login",
  trocar_senha: "Troca da própria senha",
  criar_usuario: "Criação de usuário",
  redefinir_senha: "Redefinição de senha (admin)",
};

export interface EventoSegurancaItem {
  id: string;
  tipo: string;
  /** E-mail digitado (login) ou nome de quem fez a ação. */
  quem: string;
  ip: string | null;
  sucesso: boolean;
  created_at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listarEventosSeguranca(
  opts: { limite?: number } = {},
): Promise<{ eventos: EventoSegurancaItem[]; falhasLogin24h: number }> {
  await requireRole("admin");
  const admin = createSupabaseAdminClient();
  const desde = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

  const [{ data, error }, { count }] = await Promise.all([
    admin
      .from("eventos_seguranca")
      .select("id, tipo, chave, ip, sucesso, created_at")
      .order("created_at", { ascending: false })
      .limit(opts.limite ?? 200),
    admin
      .from("eventos_seguranca")
      .select("id", { count: "exact", head: true })
      .eq("tipo", "login")
      .eq("sucesso", false)
      .gte("created_at", desde),
  ]);
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  // Nas ações autenticadas a chave é o id do usuário — troca pelo nome.
  const ids = [...new Set(rows.map((r) => r.chave).filter((c) => UUID.test(c)))];
  const nomes = new Map<string, string>();
  if (ids.length > 0) {
    const { data: perfis } = await admin
      .from("profiles")
      .select("id, nome")
      .in("id", ids);
    for (const p of perfis ?? []) nomes.set(p.id, p.nome);
  }

  return {
    eventos: rows.map((r) => ({
      id: r.id,
      tipo: r.tipo,
      quem: nomes.get(r.chave) ?? r.chave,
      ip: r.ip,
      sucesso: r.sucesso,
      created_at: r.created_at,
    })),
    falhasLogin24h: count ?? 0,
  };
}
