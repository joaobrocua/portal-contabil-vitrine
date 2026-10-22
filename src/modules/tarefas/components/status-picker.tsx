"use client";

import { useOptimistic, useTransition } from "react";

import {
  TAREFA_STATUS_LABEL,
  type TarefaStatus,
} from "@/core/types/domain";
import { Select, useToast } from "@/core/ui";

import { mudarStatusTarefa } from "../actions";

const OPCOES: TarefaStatus[] = [
  "nao_iniciada",
  "em_andamento",
  "aguardando_cliente",
  "em_revisao",
  "concluida",
  "cancelada",
];

export function StatusPicker({
  tarefaId,
  status,
}: {
  tarefaId: string;
  status: TarefaStatus;
}) {
  const [pending, start] = useTransition();
  const { notify } = useToast();
  // Otimista: o seletor já mostra a escolha; se o servidor recusar, volta.
  const [statusTela, setStatusTela] = useOptimistic(status);
  return (
    <Select
      value={statusTela}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          setStatusTela(e.target.value as typeof statusTela);
          const r = await mudarStatusTarefa(tarefaId, e.target.value as TarefaStatus);
          if (!r.ok) notify(r.error);
        })
      }
      className="w-auto"
    >
      {OPCOES.map((s) => (
        <option key={s} value={s}>
          {TAREFA_STATUS_LABEL[s]}
        </option>
      ))}
    </Select>
  );
}
