import Link from "next/link";

import { PAPEL_LABEL } from "@/core/types/domain";
import type { SessionContext } from "@/core/auth/session";
import { Badge, LogoMark } from "@/core/ui";

import { MenuCelular } from "./menu-celular";
import type { MenuGrupo } from "./nav-links";
import { SignOutButton } from "./sign-out-button";

export function Topbar({
  session,
  grupos,
}: {
  session: SessionContext;
  grupos: MenuGrupo[];
}) {
  const { profile } = session;
  const iniciais = profile.nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <header className="flex h-20 shrink-0 items-center justify-between gap-3 border-b border-[var(--color-line)] bg-[var(--color-bg)] px-4 lg:px-6">
      <div className="flex items-center gap-2 lg:hidden">
        <MenuCelular grupos={grupos} />
        <LogoMark className="size-10" />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight text-[var(--color-text)]">
            {profile.nome}
          </p>
          <p className="data text-[11px] leading-tight text-[var(--color-text-faint)]">
            {profile.email}
          </p>
        </div>
        <Link
          href="/minha-conta"
          title="Minha conta"
          className="grid size-8 place-items-center rounded-full bg-[var(--color-azul)] font-display text-xs font-bold text-white"
        >
          {iniciais || "?"}
        </Link>
        <Badge tone={profile.papel === "cliente" ? "gold" : "brand"}>
          {PAPEL_LABEL[profile.papel]}
        </Badge>
        <SignOutButton />
      </div>
    </header>
  );
}
