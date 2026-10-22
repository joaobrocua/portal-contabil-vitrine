"use client";

import { ErroView } from "@/core/layout/erro-view";

/** Erro fora da área logada, ou no próprio layout dela (ex.: falha ao ler a sessão). */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErroView error={error} retry={retry} telaCheia />;
}
