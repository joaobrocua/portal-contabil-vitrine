import { NextResponse } from "next/server";

import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/core/db/env";

/**
 * Health check pra monitoramento externo (NSSM/Task Scheduler pode checar
 * isso periodicamente, ou uma ferramenta de monitoramento de fora).
 * Rota pública (ver PUBLIC_PREFIXES em src/proxy.ts) — não exige sessão.
 *
 * Confere se o processo do Next está de pé E se o Supabase (PostgREST)
 * está respondendo — um "liveness" sozinho (só "o processo existe") não
 * pega o caso mais comum na prática aqui: o container do banco/Supabase
 * caiu mas o Next continua rodando e servindo erro pra todo mundo.
 */
export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { status: "erro", motivo: "Supabase não configurado" },
      { status: 503 },
    );
  }

  try {
    // /auth/v1/health é o health check nativo do GoTrue — testado ao vivo:
    // a raiz do PostgREST (/rest/v1/) e /auth/v1/health SEM apikey voltam
    // 403/401 aqui (RBAC do gateway bloqueia acesso "solto"); com o
    // apikey, este endpoint responde 200 rápido, sem depender de
    // RLS/tabela nenhuma — só confirma que o gateway e o Auth estão de pé.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { status: "erro", motivo: `Supabase respondeu ${res.status}` },
        { status: 503 },
      );
    }
  } catch {
    return NextResponse.json(
      { status: "erro", motivo: "Supabase não respondeu" },
      { status: 503 },
    );
  }

  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}
