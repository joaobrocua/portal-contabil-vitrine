"use client";

import { useOptimistic, useTransition } from "react";

import {
  OBRIGACAO_STATUS_LABEL,
  type ObrigacaoStatus,
} from "@/core/types/domain";
import { Select, useToast } from "@/core/ui";

import { mudarStatusObrigacao } from "../actions";

const OPCOES: ObrigacaoStatus[] = [
  "pendente",
  "em_andamento",
  "gerada",
  "disponivel",
  "entregue",
  "paga",
  "dispensada",
];

export function ObrigacaoStatusPicker({
  id,
  status,
}: {
  id: string;
  status: ObrigacaoStatus;
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
          const r = await mudarStatusObrigacao(id, e.target.value as ObrigacaoStatus);
          if (!r.ok) notify(r.error);
        })
      }
      className="w-auto"
    >
      {OPCOES.map((s) => (
        <option key={s} value={s}>
          {OBRIGACAO_STATUS_LABEL[s]}
        </option>
      ))}
    </Select>
  );
}
