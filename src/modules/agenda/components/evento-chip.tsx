"use client";

import { useTransition } from "react";
import Link from "next/link";

import { cn } from "@/core/lib/cn";
import { useToast } from "@/core/ui";

import { alternarEventoConcluido } from "../actions";
import type { ItemAgenda } from "../queries";

const TIPO_COR: Record<string, string> = {
  prazo: "bg-[var(--color-carmine-tint)] text-[var(--color-carmine-bright)]",
  obrigacao: "bg-[var(--color-ouro-tint)] text-[var(--color-ouro-bright)]",
  reuniao: "bg-[var(--color-info-tint)] text-[var(--color-info)]",
  lembrete: "bg-[var(--color-surface-3)] text-[var(--color-text-dim)]",
  outro: "bg-[var(--color-surface-3)] text-[var(--color-text-dim)]",
};

/**
 * Item da agenda numa célula do mês. Prazo de tarefa (`origem: "tarefa"`)
 * é só um link pra tarefa de verdade — o status se gerencia lá. Evento
 * manual (`origem: "manual"`) não tem outra tela: o clique aqui É a forma
 * de marcar concluído (antes, alternarEventoConcluido existia na action
 * mas nada na UI chamava — o link ia pra "/agenda", a própria página).
 */
export function EventoChip({ item }: { item: ItemAgenda }) {
  const [pending, start] = useTransition();
  const { notify } = useToast();
  const classe = cn(
    "block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-tight",
    TIPO_COR[item.tipo] ?? TIPO_COR.outro,
    item.concluido && "line-through opacity-50",
    pending && "opacity-70",
  );

  if (item.origem === "tarefa") {
    return (
      <Link href={item.refHref} className={classe} title={item.titulo}>
        {item.titulo}
      </Link>
    );
  }

  const id = item.id.replace(/^ev-/, "");
  return (
    <button
      type="button"
      className={classe}
      title={
        item.concluido
          ? "Concluído — clique pra reabrir"
          : "Clique pra marcar como concluído"
      }
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await alternarEventoConcluido(id, !item.concluido);
          if (!r.ok) notify(r.error);
        })
      }
    >
      {item.titulo}
    </button>
  );
}
