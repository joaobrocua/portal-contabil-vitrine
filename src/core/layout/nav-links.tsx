"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { ModuleDef } from "@/core/config/modules";
import { cn } from "@/core/lib/cn";
import { ModuleIcon } from "@/core/ui";

export type MenuGrupo = { grupo: string; label: string; itens: ModuleDef[] };

/** Links do menu por grupo — usados no menu lateral e no menu do celular. */
export function NavLinks({ grupos }: { grupos: MenuGrupo[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {grupos.map((g) => (
        <div key={g.grupo} className="space-y-1">
          <p className="eyebrow px-3 pb-1">{g.label}</p>
          {g.itens.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-[var(--color-azul-tint)] text-[var(--color-text)]"
                    : "text-[var(--color-text-dim)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]",
                )}
              >
                {active ? (
                  <span className="barra-ativa absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-[var(--color-azul)]" />
                ) : null}
                <ModuleIcon
                  name={item.icon}
                  className={cn(
                    "size-4 shrink-0",
                    active && "text-[var(--color-azul-bright)]",
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
