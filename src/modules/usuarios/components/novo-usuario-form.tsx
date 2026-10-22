"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, UserPlus } from "lucide-react";

import {
  DEPARTAMENTO_LABEL,
  PAPEL_LABEL,
  type Departamento,
  type Papel,
} from "@/core/types/domain";
import {
  Button,
  Card,
  CardContent,
  Field,
  Formulario,
  Input,
  Select,
} from "@/core/ui";

import { criarUsuario } from "../actions";

const PAPEIS: Papel[] = [
  "admin",
  "fiscal",
  "pessoal",
  "contabil",
  "societario",
  "atendimento",
  "cliente",
];
const DEPS: Departamento[] = [
  "fiscal",
  "pessoal",
  "contabil",
  "societario",
  "ir",
  "atendimento",
  "geral",
];

export function NovoUsuarioForm() {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [aberto, setAberto] = useState(false);
  const [state, action, pending] = useActionState(criarUsuario, null);

  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 font-medium text-neutral-900">
          <UserPlus className="size-4 text-brand" />
          Novo usuário
        </span>
        <ChevronDown
          className={`size-4 text-neutral-400 transition-transform ${
            aberto ? "rotate-180" : ""
          }`}
        />
      </button>

      {aberto ? (
        <CardContent className="border-t border-neutral-100">
          <Formulario
            ref={ref}
            action={action}
            className="grid gap-4 pt-4 sm:grid-cols-2"
          >
            <Field label="Nome" htmlFor="nu_nome">
              <Input id="nu_nome" name="nome" required />
            </Field>
            <Field label="E-mail" htmlFor="nu_email">
              <Input id="nu_email" name="email" type="email" required />
            </Field>
            <Field label="Senha provisória" htmlFor="nu_senha">
              <Input
                id="nu_senha"
                name="senha"
                type="text"
                minLength={8}
                required
                placeholder="mín. 8 caracteres"
              />
            </Field>
            <Field label="Telefone" htmlFor="nu_tel">
              <Input id="nu_tel" name="telefone" />
            </Field>
            <Field label="Papel" htmlFor="nu_papel">
              <Select id="nu_papel" name="papel" defaultValue="fiscal">
                {PAPEIS.map((p) => (
                  <option key={p} value={p}>
                    {PAPEL_LABEL[p]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Departamento" htmlFor="nu_dep">
              <Select id="nu_dep" name="departamento" defaultValue="">
                <option value="">—</option>
                {DEPS.map((d) => (
                  <option key={d} value={d}>
                    {DEPARTAMENTO_LABEL[d]}
                  </option>
                ))}
              </Select>
            </Field>

            {state?.ok ? (
              <p className="text-sm text-[var(--color-ok)] sm:col-span-2">
                Usuário criado.
              </p>
            ) : null}
            {state && !state.ok ? (
              <p className="text-sm text-[var(--color-carmine-bright)] sm:col-span-2">{state.error}</p>
            ) : null}

            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Criando…" : "Criar usuário"}
              </Button>
            </div>
          </Formulario>
        </CardContent>
      ) : null}
    </Card>
  );
}
