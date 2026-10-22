"use client";

import { ErroView } from "@/core/layout/erro-view";

import "./globals.css";

/**
 * Último recurso: o próprio layout raiz falhou. Substitui o layout inteiro,
 * então precisa do próprio <html>/<body> e de importar o CSS global (senão
 * a tela sai sem estilo nenhum). Não aceita `metadata` — título via <title>.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <title>Erro · Portal</title>
        <ErroView error={error} retry={retry} telaCheia />
      </body>
    </html>
  );
}
