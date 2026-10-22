"use client";

import Link from "next/link";

import { cn } from "@/core/lib/cn";
import { diasAte, formatData, formatMoeda, hojeISO } from "@/core/lib/format";
import type { Pagina } from "@/core/lib/paginacao";
import {
  OBRIGACAO_STATUS_LABEL,
  OBRIGACAO_TIPO_CURTO,
  type ObrigacaoStatus,
  type ObrigacaoTipo,
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

import type { ObrigacaoItem } from "../queries";
import { ObrigacaoStatusBadge } from "./status-badge";

/**
 * Com `pagina`, filtros no endereço e o servidor filtra/pagina (tela do
 * Fiscal). Com `obrigacoes`, lista curta filtrada no navegador (ficha da
 * empresa).
 */
export function ObrigacoesList({
  obrigacoes,
  pagina,
}: {
  obrigacoes?: ObrigacaoItem[];
  pagina?: Pagina<ObrigacaoItem>;
}) {
  const filtros = useFiltros(!!pagina);
  const { valor, definir, carregando } = filtros;
  const status = valor("status", "abertas");
  const busca = valor("busca").trim().toLowerCase();

  const hoje = hojeISO();

  const filtradas = pagina
    ? pagina.itens
    : (obrigacoes ?? []).filter((o) => {
        const concluida = ["entregue", "paga", "dispensada"].includes(o.status);
        if (status === "abertas" && concluida) return false;
        if (status === "atrasadas" && (concluida || o.vencimento >= hoje))
          return false;
        if (
          status !== "abertas" &&
          status !== "atrasadas" &&
          status !== "todos" &&
          o.status !== status
        )
          return false;
        if (
          busca &&
          !OBRIGACAO_TIPO_CURTO[o.tipo].toLowerCase().includes(busca) &&
          !(o.empresa?.razao_social.toLowerCase().includes(busca) ?? false)
        )
          return false;
        return true;
      });

  return (
    <div className={cn("space-y-4 transition-opacity", carregando && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <BuscaUrl filtros={filtros} placeholder="Buscar por tipo ou empresa…" />
        <Select
          value={status}
          onChange={(e) => definir({ status: e.target.value === "abertas" ? null : e.target.value })}
          className="w-auto"
          aria-label="Status"
        >
          <option value="abertas">Em aberto</option>
          <option value="atrasadas">Atrasadas</option>
          <option value="todos">Todos os status</option>
          {(Object.keys(OBRIGACAO_STATUS_LABEL) as ObrigacaoStatus[]).map((s) => (
            <option key={s} value={s}>
              {OBRIGACAO_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      {filtradas.length === 0 ? (
        <EmptyState
          title="Nenhuma obrigação"
          description="Ajuste os filtros, gere a competência ou crie uma obrigação."
        />
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--color-line)] bg-[var(--color-surface-1)]">
          <Table>
            <THead>
              <TR>
                <TH>Tipo</TH>
                <TH>Empresa</TH>
                <TH>Venc.</TH>
                <TH className="text-right">Valor</TH>
                <TH>Responsável</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {filtradas.map((o) => {
                const d = diasAte(o.vencimento);
                const atrasada =
                  d != null &&
                  d < 0 &&
                  !["entregue", "paga", "dispensada"].includes(o.status);
                return (
                  <TR key={o.id}>
                    <TD>
                      <Link
                        href={`/fiscal/${o.id}`}
                        className="font-medium text-[var(--color-text)] hover:text-[var(--color-carmine-bright)]"
                      >
                        {OBRIGACAO_TIPO_CURTO[o.tipo as ObrigacaoTipo]}
                      </Link>
                    </TD>
                    <TD className="text-[var(--color-text-dim)]">
                      {o.empresa
                        ? o.empresa.nome_fantasia || o.empresa.razao_social
                        : "—"}
                    </TD>
                    <TD
                      className={cn(
                        "data text-xs",
                        atrasada &&
                          "font-medium text-[var(--color-carmine-bright)]",
                      )}
                    >
                      {formatData(o.vencimento)}
                    </TD>
                    <TD className="data text-right text-xs">
                      {o.valor != null ? formatMoeda(o.valor) : "—"}
                    </TD>
                    <TD className="text-[var(--color-text-dim)]">
                      {o.responsavel?.nome ?? "—"}
                    </TD>
                    <TD>
                      <ObrigacaoStatusBadge
                        status={o.status as ObrigacaoStatus}
                        atrasada={atrasada}
                      />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}

      {pagina ? (
        <Paginacao total={pagina.total} pagina={pagina.pagina} tamanho={pagina.tamanho} nomeItem="obrigações" />
      ) : null}
    </div>
  );
}
