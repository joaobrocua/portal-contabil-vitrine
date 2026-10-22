"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { cn } from "@/core/lib/cn";
import type { CatalogoRow } from "@/core/db/types";
import { Button, Card, CardContent, CardHeader, CardTitle, Formulario, Input, useToast } from "@/core/ui";

import { adicionarCatalogo, alternarCatalogo } from "../actions";
import { CATALOGOS_EM_USO, TIPOS_CATALOGO, type TipoCatalogo } from "../catalogos";

function Grupo({ tipo, itens }: { tipo: TipoCatalogo; itens: CatalogoRow[] }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(adicionarCatalogo, null);
  const [, start] = useTransition();
  const { notify } = useToast();

  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{CATALOGOS_EM_USO[tipo]}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {itens.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                start(async () => {
                  const r = await alternarCatalogo(c.id, !c.ativo);
                  if (!r.ok) notify(r.error);
                  else router.refresh();
                })
              }
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                c.ativo
                  ? "border-brand/20 bg-brand/10 text-brand"
                  : "border-neutral-200 bg-neutral-50 text-neutral-400 line-through",
              )}
              title={c.ativo ? "Desativar" : "Reativar"}
            >
              {c.rotulo}
            </button>
          ))}
        </div>
        <Formulario ref={ref} action={action} className="flex gap-2">
          <input type="hidden" name="tipo" value={tipo} />
          <Input name="rotulo" placeholder="Novo item…" required className="h-8" />
          <Button type="submit" size="sm" variant="subtle" disabled={pending}>
            <Plus className="size-4" />
          </Button>
        </Formulario>
        {state && !state.ok ? (
          <p className="text-xs text-[var(--color-carmine-bright)]">{state.error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function CatalogosPanel({
  grupos,
}: {
  grupos: Record<string, CatalogoRow[]>;
}) {
  // Só os catálogos que alguma tela usa (ver ../catalogos.ts); linhas de
  // outros tipos que existam no banco ficam guardadas, mas fora da tela.
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {TIPOS_CATALOGO.map((t) => (
        <Grupo key={t} tipo={t} itens={grupos[t] ?? []} />
      ))}
    </div>
  );
}
