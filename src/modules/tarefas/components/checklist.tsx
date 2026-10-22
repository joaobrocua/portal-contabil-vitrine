"use client";

import { useActionState, useEffect, useOptimistic, useRef, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import { cn } from "@/core/lib/cn";
import type { TarefaItemRow } from "@/core/db/types";
import { Button, Formulario, Input, useToast } from "@/core/ui";

import { adicionarItem, alternarItem, removerItem } from "../actions";

export function Checklist({
  tarefaId,
  itens,
}: {
  tarefaId: string;
  itens: TarefaItemRow[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(adicionarItem, null);
  const [, startTransition] = useTransition();
  const { notify } = useToast();
  // Atualização otimista: a caixinha marca (ou o item some) na hora do
  // clique; o servidor confirma por trás. Se ele recusar, o React volta
  // sozinho ao estado real e o aviso aparece. Sem isso, o clique parecia
  // não ter funcionado até a resposta chegar — e a pessoa clicava de novo.
  const [itensTela, aplicar] = useOptimistic(
    itens,
    (
      atual,
      acao: { tipo: "marcar"; id: string; feito: boolean } | { tipo: "remover"; id: string },
    ) =>
      acao.tipo === "remover"
        ? atual.filter((i) => i.id !== acao.id)
        : atual.map((i) => (i.id === acao.id ? { ...i, feito: acao.feito } : i)),
  );

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
    else if (state && !state.ok) notify(state.error);
  }, [state, notify]);

  const feitos = itensTela.filter((i) => i.feito).length;

  return (
    <div className="space-y-3">
      {itensTela.length > 0 ? (
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${(feitos / itensTela.length) * 100}%` }}
            />
          </div>
          {feitos}/{itensTela.length}
        </div>
      ) : null}

      <ul className="space-y-1">
        {itensTela.map((i) => (
          <li
            key={i.id}
            className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-neutral-50"
          >
            <input
              type="checkbox"
              checked={i.feito}
              onChange={(e) =>
                startTransition(async () => {
                  aplicar({ tipo: "marcar", id: i.id, feito: e.target.checked });
                  const r = await alternarItem(i.id, tarefaId, e.target.checked);
                  if (!r.ok) notify(r.error);
                })
              }
              className="size-4 accent-[var(--color-brand)]"
            />
            <span
              className={cn(
                "flex-1 text-sm",
                i.feito
                  ? "text-neutral-400 line-through"
                  : "text-neutral-800",
              )}
            >
              {i.descricao}
            </span>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  aplicar({ tipo: "remover", id: i.id });
                  const r = await removerItem(i.id, tarefaId);
                  if (!r.ok) notify(r.error);
                })
              }
              className="text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--color-carmine)]"
              title="Remover item"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      <Formulario ref={formRef} action={action} className="flex gap-2">
        <input type="hidden" name="tarefa_id" value={tarefaId} />
        <Input
          name="descricao"
          placeholder="Novo item do checklist…"
          required
          className="h-8"
        />
        <Button type="submit" size="sm" variant="subtle" disabled={pending}>
          <Plus className="size-4" />
        </Button>
      </Formulario>
    </div>
  );
}
