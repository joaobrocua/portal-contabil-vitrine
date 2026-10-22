"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { signInWithPassword } from "@/core/auth/actions";
import { Button, Field, Input } from "@/core/ui";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(signInWithPassword, null);

  useEffect(() => {
    if (state?.ok) {
      router.replace(state.data.next || "/painel");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <Field label="E-mail" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="voce@escritorio.com.br"
        />
      </Field>

      <Field label="Senha" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </Field>

      {state && !state.ok ? (
        <p className="rounded-[var(--radius)] bg-[var(--color-carmine-tint)] px-3 py-2 text-sm text-[var(--color-carmine-bright)]">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
