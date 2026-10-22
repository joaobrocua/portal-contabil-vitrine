"use client";

import { useActionState } from "react";

import { Button, Field, Formulario, Select, Textarea } from "@/core/ui";

import { atualizarFechamento } from "../actions";

export function FechamentoResponsavelForm({
  fechamentoId,
  responsavelId,
  observacao,
  colaboradores,
}: {
  fechamentoId: string;
  responsavelId: string | null;
  observacao: string | null;
  colaboradores: { id: string; nome: string }[];
}) {
  const [state, action, pending] = useActionState(atualizarFechamento, null);

  return (
    <Formulario action={action} className="space-y-3">
      <input type="hidden" name="id" value={fechamentoId} />
      <Field label="Responsável" htmlFor="responsavel_id">
        <Select id="responsavel_id" name="responsavel_id" defaultValue={responsavelId ?? ""}>
          <option value="">— não atribuído —</option>
          {colaboradores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Observação" htmlFor="observacao">
        <Textarea
          id="observacao"
          name="observacao"
          rows={3}
          defaultValue={observacao ?? ""}
          placeholder="Anotações do fechamento…"
        />
      </Field>
      {state && !state.ok ? (
        <p className="text-sm text-[var(--color-carmine-bright)]">{state.error}</p>
      ) : null}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </Formulario>
  );
}
