"use client";

import { useActionState } from "react";

import { Button, Field, Formulario, Input, Select, Textarea } from "@/core/ui";

import { atualizarDeclaracaoIr } from "../actions";

export function DeclaracaoIrDetalhesForm({
  id,
  prazo,
  valorAPagar,
  valorARestituir,
  recibo,
  responsavelId,
  observacao,
  colaboradores,
}: {
  id: string;
  prazo: string | null;
  valorAPagar: number | null;
  valorARestituir: number | null;
  recibo: string | null;
  responsavelId: string | null;
  observacao: string | null;
  colaboradores: { id: string; nome: string }[];
}) {
  const [state, action, pending] = useActionState(atualizarDeclaracaoIr, null);

  return (
    <Formulario action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prazo" htmlFor="prazo">
          <Input id="prazo" name="prazo" type="date" defaultValue={prazo ?? ""} />
        </Field>
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
        <Field label="Valor a pagar" htmlFor="valor_a_pagar">
          <Input
            id="valor_a_pagar"
            name="valor_a_pagar"
            placeholder="0,00"
            defaultValue={valorAPagar != null ? String(valorAPagar).replace(".", ",") : ""}
          />
        </Field>
        <Field label="Valor a restituir" htmlFor="valor_a_restituir">
          <Input
            id="valor_a_restituir"
            name="valor_a_restituir"
            placeholder="0,00"
            defaultValue={valorARestituir != null ? String(valorARestituir).replace(".", ",") : ""}
          />
        </Field>
        <Field label="Recibo de entrega" htmlFor="recibo" className="sm:col-span-2">
          <Input
            id="recibo"
            name="recibo"
            placeholder="Número do recibo, se já entregue"
            defaultValue={recibo ?? ""}
          />
        </Field>
      </div>
      <Field label="Observação" htmlFor="observacao">
        <Textarea
          id="observacao"
          name="observacao"
          rows={3}
          defaultValue={observacao ?? ""}
          placeholder="Anotações da declaração…"
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
