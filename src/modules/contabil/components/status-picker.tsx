"use client";

import { useOptimistic, useTransition } from "react";

import { FECHAMENTO_STATUS_LABEL, type FechamentoStatus } from "@/core/types/domain";
import { Select, useToast } from "@/core/ui";

import { mudarStatusFechamento } from "../actions";
import { FECHAMENTO_STATUS_VALUES } from "../schema";

export function FechamentoStatusPicker({
  id,
  status,
}: {
  id: string;
  status: FechamentoStatus;
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
          const r = await mudarStatusFechamento(id, e.target.value as FechamentoStatus);
          if (!r.ok) notify(r.error);
        })
      }
      className="w-auto"
    >
      {FECHAMENTO_STATUS_VALUES.map((s) => (
        <option key={s} value={s}>
          {FECHAMENTO_STATUS_LABEL[s]}
        </option>
      ))}
    </Select>
  );
}
