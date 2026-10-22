"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { Button, Formulario } from "@/core/ui";

import { gerarCompetencia } from "../actions";

export function GerarCompetencia({ competencia }: { competencia: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(gerarCompetencia, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const msg = !state
    ? null
    : state.ok
      ? state.data.criadas > 0
        ? `${state.data.criadas} obrigação(ões) geradas.`
        : "Nada a gerar — competência já completa."
      : state.error;

  return (
    <Formulario action={action} className="flex items-center gap-2">
      <input type="hidden" name="competencia" value={competencia.slice(0, 7)} />
      <Button type="submit" variant="subtle" size="sm" disabled={pending}>
        <Sparkles className="size-4" />
        {pending ? "Gerando…" : "Gerar competência"}
      </Button>
      {msg ? (
        <span
          className={
            state && !state.ok
              ? "text-xs text-[var(--color-carmine-bright)]"
              : "text-xs text-[var(--color-text-dim)]"
          }
        >
          {msg}
        </span>
      ) : null}
    </Formulario>
  );
}
