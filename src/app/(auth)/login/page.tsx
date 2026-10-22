import Link from "next/link";
import { redirect } from "next/navigation";

import { brand } from "@/core/config/brand";
import { getSession } from "@/core/auth/session";
import { safeNextPath } from "@/core/lib/safe-redirect";
import { Card, CardContent, LogoMark, Wing } from "@/core/ui";

import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const session = await getSession();
  if (session) redirect("/painel");

  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[var(--color-bg)] px-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in srgb, var(--color-azul) 22%, transparent), transparent 70%)",
        }}
      />
      <Wing className="pointer-events-none absolute -left-10 bottom-10 h-56 rotate-12 text-[var(--color-ouro)] opacity-[0.05]" />

      <div className="rise relative mb-8 flex flex-col items-center gap-4 text-center">
        {brand.logoCompletaFile ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoCompletaFile}
            alt={brand.nome}
            className="h-36 w-auto object-contain sm:h-48"
          />
        ) : (
          <LogoMark className="size-16" />
        )}
        <div>
          <p className="font-display text-xl font-bold text-[var(--color-text)]">
            {brand.nome}
          </p>
          <p className="eyebrow">Portal de gestão do escritório</p>
        </div>
      </div>

      <Card className="rise relative w-full max-w-sm" style={{ animationDelay: "90ms" }}>
        <div className="border-b border-[var(--color-line)] px-5 py-3.5">
          <h1 className="font-display text-lg font-semibold text-[var(--color-text)]">
            Entrar
          </h1>
        </div>
        <CardContent className="pt-5">
          <LoginForm next={next} />
        </CardContent>
      </Card>

      <div className="relative mt-6 space-y-1.5 text-center">
        {brand.telefones.length > 0 ? (
          <p className="data text-xs text-[var(--color-text-dim)]">
            {brand.telefones.join("   ·   ")}
          </p>
        ) : null}
        <p className="text-xs text-[var(--color-text-faint)]">
          Acesso restrito à equipe e clientes.{" "}
          <Link
            href="/configurar"
            className="underline hover:text-[var(--color-carmine-bright)]"
          >
            Configuração
          </Link>
        </p>
      </div>
    </div>
  );
}
