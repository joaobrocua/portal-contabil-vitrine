"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { IR_TIPO_LABEL } from "@/core/types/domain";
import { Button, Field, Formulario, Input, Select } from "@/core/ui";

import { gerarDeclaracoesIr } from "../actions";
import { IR_TIPOS } from "../schema";

export function GerarDeclaracoesIr({ ano }: { ano: number }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(gerarDeclaracoesIr, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const msg = !state
    ? null
    : state.ok
      ? state.data.criadas > 0
        ? `${state.data.criadas} declaração(ões) gerada(s).`
        : "Nenhuma declaração nova para essa combinação."
      : state.error;

  return (
    <Formulario action={action} className="flex flex-wrap items-end gap-2">
      <Field label="Tipo" htmlFor="gerar-tipo">
        <Select id="gerar-tipo" name="tipo" defaultValue="irpf" className="h-9 w-auto">
          {IR_TIPOS.map((t) => (
            <option key={t} value={t}>
              {IR_TIPO_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>
      <input type="hidden" name="ano_exercicio" value={ano} />
      <Field label="Prazo final (opcional)" htmlFor="gerar-prazo">
        <Input id="gerar-prazo" name="prazo" type="date" className="h-9" />
      </Field>
      <Button type="submit" variant="subtle" size="sm" disabled={pending}>
        <Sparkles className="size-4" />
        {pending ? "Gerando…" : `Gerar declarações de ${ano}`}
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
