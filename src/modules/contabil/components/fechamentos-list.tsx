"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";

import { formatCompetenciaCurta } from "@/core/lib/format";
import { FECHAMENTO_STATUS_LABEL, type FechamentoStatus } from "@/core/types/domain";
import type { Pagina } from "@/core/lib/paginacao";
import { EmptyState, Paginacao, Select, Table, TBody, TD, TH, THead, TR, useToast } from "@/core/ui";

import { mudarStatusFechamento } from "../actions";
import type { FechamentoItem } from "../queries";
import { FECHAMENTO_STATUS_VALUES } from "../schema";

function LinhaFechamento({
  f,
  mostrarEmpresa,
}: {
  f: FechamentoItem;
  mostrarEmpresa: boolean;
}) {
  const [pending, start] = useTransition();
  const { notify } = useToast();
  // Otimista: o seletor já mostra a escolha; se o servidor recusar, volta.
  const [statusTela, setStatusTela] = useOptimistic(f.status);
  return (
    <TR>
      {mostrarEmpresa ? (
        <TD>
          <Link
            href={`/contabil/${f.id}`}
            className="font-medium text-[var(--color-text)] hover:text-[var(--color-carmine-bright)]"
          >
            {f.empresa ? f.empresa.nome_fantasia || f.empresa.razao_social : "—"}
          </Link>
        </TD>
      ) : (
        <TD>
          <Link
            href={`/contabil/${f.id}`}
            className="font-medium text-[var(--color-text)] hover:text-[var(--color-carmine-bright)]"
          >
            {formatCompetenciaCurta(f.competencia)}
          </Link>
        </TD>
      )}
      <TD className="text-sm text-[var(--color-text-dim)]">
        {f.responsavel?.nome ?? "Não atribuído"}
      </TD>
      <TD>
        <Select
          value={statusTela}
          disabled={pending}
          onChange={(e) =>
            start(async () => {
              setStatusTela(e.target.value as typeof statusTela);
              const r = await mudarStatusFechamento(f.id, e.target.value as FechamentoStatus);
              if (!r.ok) notify(r.error);
            })
          }
          className="h-8 w-auto"
        >
          {FECHAMENTO_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {FECHAMENTO_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </TD>
    </TR>
  );
}

export function FechamentosList({
  fechamentos: lista,
  pagina,
  mostrarEmpresa = true,
}: {
  fechamentos?: FechamentoItem[];
  /** Lista paginada no servidor (tela do Contábil); senão usa `fechamentos`. */
  pagina?: Pagina<FechamentoItem>;
  mostrarEmpresa?: boolean;
}) {
  const fechamentos = pagina?.itens ?? lista ?? [];
  if (fechamentos.length === 0) {
    return (
      <EmptyState
        title="Nenhum fechamento nesta competência"
        description="Use 'Abrir fechamentos da competência' para criar um por empresa (exceto MEI)."
      />
    );
  }
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-line)] bg-[var(--color-surface-1)]">
      <Table>
        <THead>
          <TR>
            <TH>{mostrarEmpresa ? "Empresa" : "Competência"}</TH>
            <TH>Responsável</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {fechamentos.map((f) => (
            <LinhaFechamento key={f.id} f={f} mostrarEmpresa={mostrarEmpresa} />
          ))}
        </TBody>
      </Table>
      {pagina ? (
        <Paginacao total={pagina.total} pagina={pagina.pagina} tamanho={pagina.tamanho} nomeItem="fechamentos" />
      ) : null}
    </div>
  );
}
