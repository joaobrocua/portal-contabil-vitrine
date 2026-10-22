"use client";

import { useOptimistic, useTransition } from "react";

import { PROCESSO_SOCIETARIO_STATUS_LABEL, type ProcessoSocietarioStatus } from "@/core/types/domain";
import { Select, useToast } from "@/core/ui";

import { mudarStatusProcessoSocietario } from "../actions";
import { PROCESSO_SOCIETARIO_STATUS_VALUES } from "../schema";

export function ProcessoSocietarioStatusPicker({
  id,
  status,
}: {
  id: string;
  status: ProcessoSocietarioStatus;
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
          const r = await mudarStatusProcessoSocietario(
            id,
            e.target.value as ProcessoSocietarioStatus,
          );
          if (!r.ok) notify(r.error);
        })
      }
      className="w-auto"
    >
      {PROCESSO_SOCIETARIO_STATUS_VALUES.map((s) => (
        <option key={s} value={s}>
          {PROCESSO_SOCIETARIO_STATUS_LABEL[s]}
        </option>
      ))}
    </Select>
  );
}
