"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, X } from "lucide-react";

import { Button, Select, useToast } from "@/core/ui";

import { desvincularDocumento, vincularDocumento } from "../actions";

/** Seletor dos documentos da empresa da tarefa que ainda não estão vinculados. */
export function VincularDocumento({
  tarefaId,
  opcoes,
}: {
  tarefaId: string;
  opcoes: { id: string; titulo: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { notify } = useToast();
  const [escolhido, setEscolhido] = useState("");

  if (opcoes.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-faint)]">
        Todos os documentos desta empresa já estão vinculados (ou ela ainda não
        tem documentos na Central).
      </p>
    );
  }

  return (
    <div className="flex gap-2">
      <Select
        value={escolhido}
        onChange={(e) => setEscolhido(e.target.value)}
        className="h-8"
        aria-label="Documento para vincular"
      >
        <option value="">— escolha um documento da empresa —</option>
        {opcoes.map((d) => (
          <option key={d.id} value={d.id}>
            {d.titulo}
          </option>
        ))}
      </Select>
      <Button
        size="sm"
        variant="subtle"
        disabled={!escolhido || pending}
        onClick={() =>
          start(async () => {
            const r = await vincularDocumento(tarefaId, escolhido);
            if (!r.ok) notify(r.error);
            else {
              setEscolhido("");
              router.refresh();
            }
          })
        }
      >
        <Link2 className="size-4" />
        Vincular
      </Button>
    </div>
  );
}

export function DesvincularDocumento({
  tarefaId,
  documentoId,
}: {
  tarefaId: string;
  documentoId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { notify } = useToast();

  return (
    <Button
      variant="ghost"
      size="icon"
      title="Desvincular (o documento continua na Central)"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await desvincularDocumento(tarefaId, documentoId);
          if (!r.ok) notify(r.error);
          else router.refresh();
        })
      }
    >
      <X className="size-4" />
    </Button>
  );
}
