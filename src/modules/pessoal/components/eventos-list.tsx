"use client";

import Link from "next/link";

import { cn } from "@/core/lib/cn";
import { formatCompetenciaCurta, formatData } from "@/core/lib/format";
import type { Pagina } from "@/core/lib/paginacao";
import {
  EVENTO_DP_TIPO_LABEL,
  type EventoDpStatus,
  type EventoDpTipo,
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
  useFiltros,
} from "@/core/ui";

import type { EventoDpItem } from "../queries";
import { EVENTO_DP_TIPOS } from "../schema";
import { EventoDpStatusBadge } from "./status-badge";

/**
 * Com `pagina`, filtros no endereço e o servidor filtra/pagina (Pessoal,
 * Processos). Com `eventos`, lista curta filtrada no navegador (ficha do
 * funcionário).
 */
export function EventosDpList({
  eventos,
  pagina,
}: {
  eventos?: EventoDpItem[];
  pagina?: Pagina<EventoDpItem>;
}) {
  const filtros = useFiltros(!!pagina);
  const { valor, definir, carregando } = filtros;
  const status = valor("status", "abertos");
  const tipo = valor("tipo");
  const busca = valor("busca").trim().toLowerCase();

  const filtrados = pagina
    ? pagina.itens
    : (eventos ?? []).filter((e) => {
        const concluido = ["concluido", "cancelado"].includes(e.status);
        if (status === "abertos" && concluido) return false;
        if (tipo && e.tipo !== tipo) return false;
        if (
          busca &&
          !e.empresa?.razao_social.toLowerCase().includes(busca) &&
          !(e.funcionario?.nome.toLowerCase().includes(busca) ?? false)
        )
          return false;
        return true;
      });

  return (
    <div className={cn("space-y-4 transition-opacity", carregando && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <BuscaUrl filtros={filtros} placeholder="Buscar por empresa ou funcionário…" />
        <Select
          value={status}
          onChange={(e) => definir({ status: e.target.value === "abertos" ? null : e.target.value })}
          className="w-auto"
          aria-label="Status"
        >
          <option value="abertos">Abertos</option>
          <option value="todos">Todos</option>
        </Select>
        <Select
          value={tipo}
          onChange={(e) => definir({ tipo: e.target.value || null })}
          className="w-auto"
          aria-label="Tipo"
        >
          <option value="">Todos os tipos</option>
          {EVENTO_DP_TIPOS.map((t) => (
            <option key={t} value={t}>
              {EVENTO_DP_TIPO_LABEL[t]}
            </option>
          ))}
        </Select>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          title="Nenhum processo"
          description="Ajuste os filtros ou crie um novo processo."
        />
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--color-line)] bg-[var(--color-surface-1)]">
          <Table>
            <THead>
              <TR>
                <TH>Processo</TH>
                <TH>Empresa</TH>
                <TH>Funcionário</TH>
                <TH>Competência</TH>
                <TH>Responsável</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {filtrados.map((e) => (
                <TR key={e.id}>
                  <TD>
                    <Link
                      href={`/pessoal/processos/${e.id}`}
                      className="font-medium text-[var(--color-text)] hover:text-[var(--color-carmine-bright)]"
                    >
                      {EVENTO_DP_TIPO_LABEL[e.tipo as EventoDpTipo]}
                    </Link>
                  </TD>
                  <TD className="text-[var(--color-text-dim)]">
                    {e.empresa ? e.empresa.nome_fantasia || e.empresa.razao_social : "—"}
                  </TD>
                  <TD className="text-[var(--color-text-dim)]">
                    {e.funcionario?.nome ?? "—"}
                  </TD>
                  <TD className="data text-xs">
                    {e.competencia ? formatCompetenciaCurta(e.competencia) : formatData(e.data_referencia)}
                  </TD>
                  <TD className="text-[var(--color-text-dim)]">{e.responsavel?.nome ?? "—"}</TD>
                  <TD>
                    <EventoDpStatusBadge status={e.status as EventoDpStatus} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      {pagina ? (
        <Paginacao total={pagina.total} pagina={pagina.pagina} tamanho={pagina.tamanho} nomeItem="processos" />
      ) : null}
    </div>
  );
}
