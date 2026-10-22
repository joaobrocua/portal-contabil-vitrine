"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Mail, Phone, Trash2, UserPlus } from "lucide-react";

import { formatTelefone } from "@/core/lib/format";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  Formulario,
  Input,
  Select,
  useToast,
} from "@/core/ui";

import { adicionarContato, removerContato } from "../actions";
import type { ContatoComAcesso } from "../queries";

const TIPO_LABEL: Record<string, string> = {
  socio: "Sócio",
  financeiro: "Financeiro",
  rh: "RH",
  responsavel_legal: "Responsável legal",
  contador_interno: "Contador interno",
  outro: "Outro",
};

export function ContatosPanel({
  empresaId,
  contatos,
}: {
  empresaId: string;
  contatos: ContatoComAcesso[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(adicionarContato, null);
  const [removing, startRemove] = useTransition();
  const { notify } = useToast();

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="space-y-6">
      {contatos.length === 0 ? (
        <EmptyState
          title="Nenhum contato cadastrado"
          description="Cadastre quem responde pela empresa (sócio, financeiro, RH…)."
        />
      ) : (
        <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-[var(--color-surface)]">
          {contatos.map((c) => (
            <div
              key={c.id}
              className="flex items-start justify-between gap-3 px-4 py-3"
            >
              <div className="space-y-1">
                <p className="flex flex-wrap items-center gap-2 font-medium text-neutral-900">
                  {c.nome}
                  <Badge tone="neutral">{TIPO_LABEL[c.tipo] ?? c.tipo}</Badge>
                  {c.cargo ? (
                    <span className="text-xs font-normal text-neutral-400">
                      {c.cargo}
                    </span>
                  ) : null}
                  {c.recebe_comunicacoes ? (
                    <Badge tone="info">Recebe comunicações</Badge>
                  ) : null}
                  {c.acesso ? (
                    <Badge tone="gold">Tem acesso ao portal</Badge>
                  ) : null}
                </p>
                <p className="flex flex-wrap gap-4 text-xs text-neutral-500">
                  {c.telefone ? (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-3" />
                      {formatTelefone(c.telefone)}
                    </span>
                  ) : null}
                  {c.email ? (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="size-3" />
                      {c.email}
                    </span>
                  ) : null}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                disabled={removing}
                onClick={() =>
                  startRemove(async () => {
                    const r = await removerContato(c.id, empresaId);
                    if (!r.ok) notify(r.error);
                  })
                }
                title="Remover contato"
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
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome" htmlFor="ct_nome">
                <Input id="ct_nome" name="nome" required />
              </Field>
              <Field label="Cargo / função" htmlFor="ct_cargo">
                <Input id="ct_cargo" name="cargo" />
              </Field>
              <Field label="Telefone" htmlFor="ct_tel">
                <Input id="ct_tel" name="telefone" />
              </Field>
              <Field
                label="E-mail"
                htmlFor="ct_email"
                error={
                  (state && !state.ok && state.fieldErrors?.email?.[0]) ||
                  undefined
                }
              >
                <Input id="ct_email" name="email" type="email" />
              </Field>
              <Field label="CPF" htmlFor="ct_cpf">
                <Input id="ct_cpf" name="cpf" inputMode="numeric" />
              </Field>
              <Field label="Tipo de contato" htmlFor="ct_tipo">
                <Select id="ct_tipo" name="tipo" defaultValue="outro">
                  {Object.entries(TIPO_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                name="recebe_comunicacoes"
                value="true"
                defaultChecked
                className="size-4 accent-[var(--color-brand)]"
              />
              Recebe solicitações e comunicados
            </label>

            {state && !state.ok ? (
              <p className="text-sm text-[var(--color-carmine-bright)]">{state.error}</p>
            ) : null}

            <Button type="submit" variant="subtle" disabled={pending}>
              <UserPlus className="size-4" />
              {pending ? "Adicionando…" : "Adicionar contato"}
            </Button>
          </Formulario>
        </CardContent>
      </Card>
    </div>
  );
}
