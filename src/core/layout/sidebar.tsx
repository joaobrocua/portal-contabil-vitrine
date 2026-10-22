"use client";

import Link from "next/link";

import { brand } from "@/core/config/brand";
import { Logo } from "@/core/ui";

import { NavLinks, type MenuGrupo } from "./nav-links";

/** Marca no topo do menu (lateral e do celular). */
export function MarcaMenu() {
  return brand.logoCompletaFile ? (
    <Link href="/painel" className="block" title={brand.nome}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={brand.logoCompletaFile}
        alt={brand.nome}
        className="h-16 w-auto max-w-full object-contain"
      />
    </Link>
  ) : (
    <Logo subtitle="Portal de gestão" />
  );
}

export function RodapeMenu() {
  return (
    <div className="border-t border-[var(--color-line)] px-4 py-3">
      <p className="font-display text-xs font-semibold text-[var(--color-text)]">
        {brand.nome}
      </p>
      {brand.telefones[0] ? (
        <p className="data mt-0.5 text-[11px] text-[var(--color-text-faint)]">
          {brand.telefones[0]}
        </p>
      ) : null}
    </div>
  );
}

export function Sidebar({ grupos }: { grupos: MenuGrupo[] }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface-1)] lg:flex">
      <div className="flex h-20 items-center border-b border-[var(--color-line)] px-4">
        <MarcaMenu />
      </div>
      <NavLinks grupos={grupos} />
      <RodapeMenu />
    </aside>
  );
}
