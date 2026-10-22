import "server-only";

import { createClient } from "@supabase/supabase-js";

import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./env";
import type { Database } from "./types";

/**
 * Client com service role — ignora RLS. Use SOMENTE para operações
 * administrativas no servidor (ex.: criar usuário, provisionar cliente).
 * Nunca importe isto em código que rode no navegador.
 */
export function createSupabaseAdminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ausente — necessária para operações administrativas.",
    );
  }
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
