"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Trash2, UserPlus } from "lucide-react";

import { formatCPF } from "@/core/lib/format";
import type { SocioRow } from "@/core/db/types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  Formulario,
  Input,
  useToast,
} from "@/core/ui";

import { adicionarSocio, removerSocio } from "../actions";

export function SociosPanel({
  empresaId,
  socios,
}: {
  empresaId: string;
  socios: SocioRow[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(adicionarSocio, null);
  const [removing, startRemove] = useTransition();
  const { notify } = useToast();

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="space-y-6">
      {socios.length === 0 ? (
        <EmptyState
          title="Nenhum sócio cadastrado"
          description="Adicione os sócios da empresa abaixo."
        />
      ) : (
        <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-[var(--color-surface)]">
          {socios.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="flex items-center gap-2 font-medium text-neutral-900">
                  {s.nome}
                  {s.administrador ? (
                    <Badge tone="brand">Administrador</Badge>
                  ) : null}
                </p>
                <p className="text-xs text-neutral-500">
                  CPF {formatCPF(s.cpf)}
                  {s.participacao != null
                    ? ` · ${s.participacao}% de participação`
                    : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                disabled={removing}
                onClick={() =>
                  startRemove(async () => {
                    const r = await removerSocio(s.id, empresaId);
                    if (!r.ok) notify(r.error);
                  })
                }
                title="Remover sócio"
              >
                <Trash2 className="size-4 text-[var(--color-carmine)]" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardContent>
          <Formulario ref={formRef} action={action} className="space-y-4">
            <input type="hidden" name="empresa_id" value={empresaId} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Nome"
                htmlFor="socio_nome"
                className="sm:col-span-2"
                error={
                  (state && !state.ok && state.fieldErrors?.nome?.[0]) ||
                  undefined
                }
              >
                <Input id="socio_nome" name="nome" required />
              </Field>
              <Field
                label="CPF"
                htmlFor="socio_cpf"
                error={
                  (state && !state.ok && state.fieldErrors?.cpf?.[0]) ||
                  undefined
                }
              >
                <Input
                  id="socio_cpf"
                  name="cpf"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  required
                />
              </Field>
              <Field label="Participação (%)" htmlFor="socio_part">
                <Input
                  id="socio_part"
                  name="participacao"
                  inputMode="decimal"
                  placeholder="0"
                />
              </Field>
              <label className="mt-6 flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  name="administrador"
                  value="true"
                  className="size-4 accent-[var(--color-brand)]"
                />
                Sócio administrador
              </label>
            </div>

            {state && !state.ok ? (
              <p className="text-sm text-[var(--color-carmine-bright)]">{state.error}</p>
            ) : null}

            <Button type="submit" variant="subtle" disabled={pending}>
              <UserPlus className="size-4" />
              {pending ? "Adicionando…" : "Adicionar sócio"}
            </Button>
          </Formulario>
        </CardContent>
      </Card>
    </div>
  );
}
