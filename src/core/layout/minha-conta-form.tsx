"use client";

import { useActionState, useEffect, useRef } from "react";

import { trocarMinhaSenha } from "@/core/auth/actions";
import { Button, Field, Formulario, Input } from "@/core/ui";

export function MinhaContaForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(trocarMinhaSenha, null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Formulario ref={formRef} action={action} className="max-w-sm space-y-4">
      <Field label="Senha atual" htmlFor="senha_atual">
        <Input
          id="senha_atual"
          name="senha_atual"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <Field label="Nova senha" htmlFor="nova_senha">
        <Input
          id="nova_senha"
          name="nova_senha"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>

      <Field label="Confirmar nova senha" htmlFor="confirmar_nova_senha">
        <Input
          id="confirmar_nova_senha"
          name="confirmar_nova_senha"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>

      {state && !state.ok ? (
        <p className="rounded-[var(--radius)] bg-[var(--color-carmine-tint)] px-3 py-2 text-sm text-[var(--color-carmine-bright)]">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="rounded-[var(--radius)] bg-[var(--color-info-tint)] px-3 py-2 text-sm text-[var(--color-info)]">
          Senha alterada.
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Trocar senha"}
      </Button>
    </Formulario>
  );
}
