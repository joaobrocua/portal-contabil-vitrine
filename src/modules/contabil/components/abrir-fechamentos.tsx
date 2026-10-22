"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { Button, Formulario } from "@/core/ui";

import { abrirFechamentos } from "../actions";

export function AbrirFechamentos({ competencia }: { competencia: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(abrirFechamentos, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const msg = !state
    ? null
    : state.ok
      ? state.data.criadas > 0
        ? `${state.data.criadas} fechamento(s) aberto(s).`
        : "Nenhum fechamento novo — todas as empresas elegíveis já têm um aberto."
      : state.error;

  return (
    <Formulario action={action} className="flex items-center gap-2">
      <input type="hidden" name="competencia" value={competencia.slice(0, 7)} />
      <Button type="submit" variant="subtle" size="sm" disabled={pending}>
        <Sparkles className="size-4" />
        {pending ? "Abrindo…" : "Abrir fechamentos da competência"}
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
