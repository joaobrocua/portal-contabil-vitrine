"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

import { cn } from "@/core/lib/cn";
import { Button, buttonVariants } from "@/core/ui";

/**
 * Tela de erro inesperado (usada pelos error.tsx e pelo global-error.tsx).
 * Antes não existia nenhuma: qualquer falha numa consulta virava a tela
 * genérica do Next, sem caminho de volta.
 *
 * Em produção o Next NÃO manda a mensagem do erro de servidor pro
 * navegador (só um `digest`, pra não vazar detalhe interno) — por isso
 * mostramos o código em vez da mensagem: é o que o admin procura no log
 * (logs\nextjs-stderr.log no servidor) pra saber o que aconteceu.
 */
export function ErroView({
  error,
  retry,
  telaCheia = false,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  /** true fora da área logada (sem menu em volta): centraliza na tela. */
  telaCheia?: boolean;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className={cn(
        "flex items-center justify-center px-4",
        telaCheia ? "min-h-dvh bg-[var(--color-bg)]" : "py-16",
      )}
    >
      <div className="w-full max-w-md space-y-5 rounded-[var(--radius)] border border-[var(--color-line)] bg-[var(--color-surface-1)] p-6 text-center">
        <AlertTriangle className="mx-auto size-8 text-[var(--color-carmine-bright)]" />
        <div className="space-y-2">
          <h1 className="font-display text-lg font-semibold text-[var(--color-text)]">
            Algo deu errado ao carregar esta página
          </h1>
          <p className="text-sm text-[var(--color-text-dim)]">
            Pode ser uma instabilidade momentânea (por exemplo, o servidor
            reiniciando). Tente de novo — se continuar acontecendo, avise o
            administrador do sistema
            {error.digest ? " informando o código abaixo" : ""}.
          </p>
        </div>
        {error.digest ? (
          <p className="data rounded-[var(--radius)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-text-dim)]">
            Código: {error.digest}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => retry()}>
            <RotateCw />
            Tentar de novo
          </Button>
          <Link href="/painel" className={buttonVariants({ variant: "outline" })}>
            Voltar ao painel
          </Link>
        </div>
      </div>
    </div>
  );
}

/** "Não encontrado" — endereço que não existe ou registro apagado. */
export function NaoEncontradoView({ telaCheia = false }: { telaCheia?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center px-4",
        telaCheia ? "min-h-dvh bg-[var(--color-bg)]" : "py-16",
      )}
    >
      <div className="w-full max-w-md space-y-5 rounded-[var(--radius)] border border-[var(--color-line)] bg-[var(--color-surface-1)] p-6 text-center">
        <p className="data text-3xl font-semibold text-[var(--color-text-faint)]">404</p>
        <div className="space-y-2">
          <h1 className="font-display text-lg font-semibold text-[var(--color-text)]">
            Página não encontrada
          </h1>
          <p className="text-sm text-[var(--color-text-dim)]">
            O endereço não existe, ou o registro que você tentou abrir foi
            removido. Confira o link ou volte pro painel.
          </p>
        </div>
        <Link href="/painel" className={buttonVariants()}>
          Voltar ao painel
        </Link>
      </div>
    </div>
  );
}
