"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { NavLinks, type MenuGrupo } from "./nav-links";
import { MarcaMenu, RodapeMenu } from "./sidebar";

/**
 * Menu para telas menores que 1024px (celular, tablet, janela pela metade),
 * onde o menu lateral fica escondido. Antes não havia navegação nenhuma
 * nessas telas — só dava pra andar pelos links de dentro das páginas.
 */
export function MenuCelular({ grupos }: { grupos: MenuGrupo[] }) {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Abrir menu"
        aria-expanded={aberto}
        className="grid size-10 place-items-center rounded-[var(--radius)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
      >
        <Menu className="size-5" />
      </button>

      {aberto ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setAberto(false)}
          />
          <aside
            className="gaveta-entra absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-[var(--color-line)] bg-[var(--color-surface-1)] shadow-2xl"
            // Tocar em qualquer link do menu fecha a gaveta.
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setAberto(false);
            }}
          >
            <div className="flex h-20 items-center justify-between gap-2 border-b border-[var(--color-line)] px-4">
              <MarcaMenu />
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar menu"
                className="grid size-9 shrink-0 place-items-center rounded-[var(--radius)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
              >
                <X className="size-5" />
              </button>
            </div>
            <NavLinks grupos={grupos} />
            <RodapeMenu />
          </aside>
        </div>
      ) : null}
    </>
  );
}
