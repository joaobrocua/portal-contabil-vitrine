"use client";

import Link from "next/link";

import { formatCompetenciaCurta, formatData, diasAte } from "@/core/lib/format";
import { cn } from "@/core/lib/cn";
import type { Pagina } from "@/core/lib/paginacao";
import {
  DEPARTAMENTO_LABEL,
  TAREFA_STATUS_LABEL,
  type Departamento,
  type TarefaStatus,
} from "@/core/types/domain";
import {
  BuscaUrl,
  EmptyState,
  Paginacao,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useFiltroUrl,
} from "@/core/ui";

import type { TarefaListItem } from "../queries";
import { TarefaStatusBadge } from "./status-badge";

const DEPARTAMENTOS: Departamento[] = [
  "fiscal",
  "pessoal",
  "contabil",
  "societario",
  "ir",
  "atendimento",
  "geral",
];

export function TarefasList({ pagina }: { pagina: Pagina<TarefaListItem> }) {
  const { valor, definir, carregando } = useFiltroUrl();
  const filtradas = pagina.itens;

  return (
    <div className={cn("space-y-4 transition-opacity", carregando && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <BuscaUrl placeholder="Buscar tarefa ou empresa…" />
        <Select
          value={valor("status", "abertas")}
          onChange={(e) => definir({ status: e.target.value === "abertas" ? null : e.target.value })}
          className="w-auto"
          aria-label="Status"
        >
          <option value="abertas">Abertas</option>
          <option value="todos">Todos os status</option>
          {(Object.keys(TAREFA_STATUS_LABEL) as TarefaStatus[]).map((s) => (
            <option key={s} value={s}>
              {TAREFA_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Select
          value={valor("dep")}
          onChange={(e) => definir({ dep: e.target.value || null })}
          className="w-auto"
          aria-label="Departamento"
        >
          <option value="">Todos os departamentos</option>
          {DEPARTAMENTOS.map((d) => (
            <option key={d} value={d}>
              {DEPARTAMENTO_LABEL[d]}
            </option>
          ))}
        </Select>
      </div>

      {filtradas.length === 0 ? (
        <EmptyState
          title="Nenhuma tarefa"
          description="Ajuste os filtros ou crie uma nova tarefa."
        />
      ) : (
        <div className="rounded-md border border-[var(--color-ledger)] bg-[var(--color-surface)]">
          <Table>
            <THead>
              <TR>
                <TH>Tarefa</TH>
                <TH>Empresa</TH>
                <TH>Depto.</TH>
                <TH>Responsável</TH>
                <TH>Comp.</TH>
                <TH>Prazo</TH>
                <TH>Checklist</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {filtradas.map((tf) => {
                const dias = diasAte(tf.prazo);
                const atrasada =
                  dias != null &&
                  dias < 0 &&
                  !["concluida", "cancelada"].includes(tf.status);
                return (
                  <TR key={tf.id}>
                    <TD>
                      <Link
                        href={`/tarefas/${tf.id}`}
                        className="font-medium text-neutral-900 hover:text-brand"
                      >
                        {tf.titulo}
                      </Link>
                    </TD>
                    <TD className="text-neutral-600">
                      {tf.empresa
                        ? tf.empresa.nome_fantasia || tf.empresa.razao_social
                        : "—"}
                    </TD>
                    <TD>{DEPARTAMENTO_LABEL[tf.departamento]}</TD>
                    <TD>{tf.responsavel?.nome ?? "—"}</TD>
                    <TD className="data text-xs">
                      {formatCompetenciaCurta(tf.competencia)}
                    </TD>
                    <TD
                      className={cn(
                        "data text-xs",
                        atrasada &&
                          "font-medium text-[var(--color-carmine)]",
                      )}
                    >
                      {tf.prazo ? formatData(tf.prazo) : "—"}
                    </TD>
                    <TD className="data text-xs text-[var(--color-ink-soft)]">
                      {tf.itens_total > 0
                        ? `${tf.itens_feitos}/${tf.itens_total}`
                        : "—"}
                    </TD>
                    <TD>
                      <TarefaStatusBadge
                        status={
                          atrasada ? "atrasada" : (tf.status as TarefaStatus)
                        }
                      />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}

      <Paginacao total={pagina.total} pagina={pagina.pagina} tamanho={pagina.tamanho} nomeItem="tarefas" />
    </div>
  );
}
