import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/core/db/env";

/** Rotas públicas (não exigem sessão). */
const PUBLIC_PREFIXES = [
  "/login",
  "/auth",
  "/configurar",
  "/_next",
  "/favicon",
  // Nome/ícone da janela do app — o navegador busca antes do login; o
  // .ico do atalho da área de trabalho é baixado pelo instalar-atalho.ps1.
  "/manifest.webmanifest",
  "/icones/",
  "/api/health",
];

const isPublic = (path: string) =>
  path === "/" || PUBLIC_PREFIXES.some((p) => path.startsWith(p));

/**
 * Proxy (antigo middleware, renomeado no Next 16).
 * - Renova a sessão do Supabase a cada request.
 * - Redireciona não autenticados para /login (checagem otimista;
 *   a autorização de verdade é feita nas páginas/actions + RLS).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Sem Supabase configurado: manda para a tela de setup.
  if (!isSupabaseConfigured) {
    if (pathname.startsWith("/configurar") || pathname.startsWith("/_next")) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/configurar", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getClaims: valida o token localmente (e renova a sessão quando vence),
  // sem a ida ao servidor de Auth que o getUser fazia em TODA requisição.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;

  if (!userId && !isPublic(pathname)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (userId && pathname === "/login") {
    // Perfil desativado com sessão ainda válida: as páginas mandam pra
    // /login (getSession() recusa inativo) e aqui voltaria pro /painel —
    // loop infinito. Encerra a sessão e deixa o login aparecer.
    const { data: profile } = await supabase
      .from("profiles")
      .select("ativo")
      .eq("id", userId)
      .single();
    if (!profile?.ativo) {
      await supabase.auth.signOut();
      return response;
    }
    return NextResponse.redirect(new URL("/painel", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
