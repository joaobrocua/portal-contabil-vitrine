"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";

import { FOLHA_STATUS_LABEL, type FolhaStatus } from "@/core/types/domain";
import { EmptyState, Select, Table, TBody, TD, TH, THead, TR, useToast } from "@/core/ui";

import { mudarStatusFolha } from "../actions";
import type { FolhaItem } from "../queries";
import { FOLHA_STATUS_VALUES } from "../schema";

function LinhaFolha({ f }: { f: FolhaItem }) {
  const [pending, start] = useTransition();
  const { notify } = useToast();
  // Otimista: o seletor já mostra a escolha; se o servidor recusar, volta.
  const [statusTela, setStatusTela] = useOptimistic(f.status);
  return (
    <TR>
      <TD>
        <Link
          href={`/empresas/${f.empresa_id}?aba=pessoal`}
          className="font-medium text-[var(--color-text)] hover:text-[var(--color-carmine-bright)]"
        >
          {f.empresa ? f.empresa.nome_fantasia || f.empresa.razao_social : "—"}
        </Link>
      </TD>
      <TD className="data text-xs text-[var(--color-text-dim)]">
        {f.qtd_funcionarios ?? "—"}
      </TD>
      <TD>
        <Select
          value={statusTela}
          disabled={pending}
          onChange={(e) =>
            start(async () => {
              setStatusTela(e.target.value as typeof statusTela);
              const r = await mudarStatusFolha(f.id, e.target.value as FolhaStatus);
              if (!r.ok) notify(r.error);
            })
          }
          className="h-8 w-auto"
        >
          {FOLHA_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {FOLHA_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </TD>
    </TR>
  );
}

export function FolhasList({ folhas }: { folhas: FolhaItem[] }) {
  if (folhas.length === 0) {
    return (
      <EmptyState
        title="Nenhuma folha nesta competência"
        description="Use 'Abrir folhas da competência' para criar uma por empresa com funcionários ativos."
      />
    );
  }
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-line)] bg-[var(--color-surface-1)]">
      <Table>
        <THead>
          <TR>
            <TH>Empresa</TH>
            <TH>Funcionários</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {folhas.map((f) => (
            <LinhaFolha key={f.id} f={f} />
          ))}
        </TBody>
      </Table>
    </div>
  );
}
