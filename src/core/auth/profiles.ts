import "server-only";

import { createSupabaseServerClient } from "@/core/db/server";
import type { ProfileRow } from "@/core/db/types";

/** Perfis internos ativos (não-clientes). Para seletores de responsável. */
export async function listarColaboradores(): Promise<
  Pick<ProfileRow, "id" | "nome" | "papel" | "departamento">[]
> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, nome, papel, departamento")
    .neq("papel", "cliente")
    .eq("ativo", true)
    .order("nome");
  return data ?? [];
}

/** Todos os perfis (para o módulo Usuários). */
export async function listarProfiles(): Promise<ProfileRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("papel")
    .order("nome");
  return data ?? [];
}
