"use client";

import { useOptimistic, useTransition } from "react";

import { IR_STATUS_LABEL, type IrStatus } from "@/core/types/domain";
import { Select, useToast } from "@/core/ui";

import { mudarStatusDeclaracaoIr } from "../actions";
import { IR_STATUS_VALUES } from "../schema";

export function DeclaracaoIrStatusPicker({ id, status }: { id: string; status: IrStatus }) {
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
          const r = await mudarStatusDeclaracaoIr(id, e.target.value as IrStatus);
          if (!r.ok) notify(r.error);
        })
      }
      className="w-auto"
    >
      {IR_STATUS_VALUES.map((s) => (
        <option key={s} value={s}>
          {IR_STATUS_LABEL[s]}
        </option>
      ))}
    </Select>
  );
}
