"use client";

import { ErroView } from "@/core/layout/erro-view";

/** Erro dentro da área logada — menu e topo continuam na tela. */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErroView error={error} retry={retry} />;
}
