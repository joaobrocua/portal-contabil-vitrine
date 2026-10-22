"use client";

import { useActionState } from "react";

import type { EscritorioConfigRow } from "@/core/db/types";
import { Button, Card, CardContent, Field, Formulario, Input } from "@/core/ui";

import { salvarConfig } from "../actions";

export function ConfigForm({ config }: { config: EscritorioConfigRow | null }) {
  const [state, action, pending] = useActionState(salvarConfig, null);

  return (
    <Card>
      <CardContent>
        <Formulario action={action} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do escritório" htmlFor="cfg_nome" className="sm:col-span-2">
            <Input
              id="cfg_nome"
              name="nome"
              required
              defaultValue={config?.nome ?? "Escritório de Contabilidade"}
            />
          </Field>
          <Field label="CNPJ" htmlFor="cfg_cnpj">
            <Input id="cfg_cnpj" name="cnpj" defaultValue={config?.cnpj ?? ""} />
          </Field>
          <Field label="Telefone" htmlFor="cfg_tel">
            <Input
              id="cfg_tel"
              name="telefone"
              defaultValue={config?.telefone ?? ""}
            />
          </Field>
          <Field label="E-mail" htmlFor="cfg_email">
            <Input
              id="cfg_email"
              name="email"
              type="email"
              defaultValue={config?.email ?? ""}
            />
          </Field>
          <Field label="Endereço" htmlFor="cfg_end">
            <Input
              id="cfg_end"
              name="endereco"
              defaultValue={config?.endereco ?? ""}
            />
          </Field>

          <div className="sm:col-span-2">
            {state?.ok ? (
              <p className="mb-2 text-sm text-[var(--color-ok)]">Salvo.</p>
            ) : null}
            {state && !state.ok ? (
              <p className="mb-2 text-sm text-[var(--color-carmine-bright)]">{state.error}</p>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Salvar configuração"}
            </Button>
          </div>
        </Formulario>
      </CardContent>
    </Card>
  );
}
