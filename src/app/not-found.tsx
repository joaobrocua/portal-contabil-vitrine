import { NaoEncontradoView } from "@/core/layout/erro-view";

export const metadata = { title: "Página não encontrada" };

/** Endereço que não corresponde a nenhuma rota. */
export default function NotFound() {
  return <NaoEncontradoView telaCheia />;
}
