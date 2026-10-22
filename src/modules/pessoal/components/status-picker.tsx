"use client";

import { useOptimistic, useTransition } from "react";

import { EVENTO_DP_STATUS_LABEL, type EventoDpStatus } from "@/core/types/domain";
import { Select, useToast } from "@/core/ui";

import { mudarStatusEventoDp } from "../actions";
import { EVENTO_DP_STATUS_VALUES } from "../schema";

export function EventoDpStatusPicker({
  id,
  status,
}: {
  id: string;
  status: EventoDpStatus;
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
          const r = await mudarStatusEventoDp(id, e.target.value as EventoDpStatus);
          if (!r.ok) notify(r.error);
        })
      }
      className="w-auto"
    >
      {EVENTO_DP_STATUS_VALUES.map((s) => (
        <option key={s} value={s}>
          {EVENTO_DP_STATUS_LABEL[s]}
        </option>
      ))}
    </Select>
  );
}
