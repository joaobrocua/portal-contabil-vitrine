"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";

import { Button, useToast } from "@/core/ui";

import { alternarAtivoEmpresa } from "../actions";

/**
 * Inativar = o escritório deixou de atender o cliente. A empresa some das
 * listas de seleção e das gerações em lote (obrigações, folhas,
 * fechamentos, IR), mas nada é apagado: histórico, documentos e o que
 * estiver em aberto continuam acessíveis, e dá pra reativar. Só admin
 * (a action e um trigger no banco recusam os outros papéis).
 */
export function AlternarAtivoEmpresa({
  id,
  ativo,
  nome,
}: {
  id: string;
  ativo: boolean;
  nome: string;
}) {
  const [pending, start] = useTransition();
  const { notify } = useToast();
  const router = useRouter();

  function alternar() {
    if (
      ativo &&
      !window.confirm(
        `Inativar "${nome}"?\n\n` +
          "Ela deixa de aparecer nas listas de seleção e não recebe mais " +
          "obrigações, folhas, fechamentos nem declarações novas. Nada é " +
          "apagado — dá pra reativar depois.",
      )
    ) {
      return;
    }
    start(async () => {
      const r = await alternarAtivoEmpresa(id, !ativo);
      if (!r.ok) {
        notify(r.error);
        return;
      }
      notify(ativo ? `"${nome}" inativada.` : `"${nome}" reativada.`, "sucesso");
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={alternar} disabled={pending}>
      {ativo ? <Archive className="size-4" /> : <ArchiveRestore className="size-4" />}
      {pending ? "…" : ativo ? "Inativar" : "Reativar"}
    </Button>
  );
}
