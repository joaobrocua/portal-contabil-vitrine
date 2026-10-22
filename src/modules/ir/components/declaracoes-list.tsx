"use client";

import Link from "next/link";

import { cn } from "@/core/lib/cn";
import { formatData, formatMoeda } from "@/core/lib/format";
import type { Pagina } from "@/core/lib/paginacao";
import { IR_TIPO_LABEL, type IrTipo } from "@/core/types/domain";
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

import type { DeclaracaoIrItem } from "../queries";
import { IR_TIPOS } from "../schema";
import { DeclaracaoIrStatusBadge } from "./status-badge";

/**
 * Com `pagina`, filtros no endereço e o servidor filtra/pagina (tela do
 * IR). Com `declaracoes`, lista curta filtrada no navegador (ficha da
 * empresa).
 */
export function DeclaracoesIrList({
  declaracoes,
  pagina,
}: {
  declaracoes?: DeclaracaoIrItem[];
  pagina?: Pagina<DeclaracaoIrItem>;
}) {
  const filtros = useFiltros(!!pagina);
  const { valor, definir, carregando } = filtros;
  const status = valor("status", "abertas");
  const tipo = valor("tipo");
  const busca = valor("busca").trim().toLowerCase();

  const filtradas = pagina
    ? pagina.itens
    : (declaracoes ?? []).filter((d) => {
        const fechado = ["entregue", "dispensada"].includes(d.status);
        if (status === "abertas" && fechado) return false;
        if (tipo && d.tipo !== tipo) return false;
        if (
          busca &&
          !d.empresa?.razao_social.toLowerCase().includes(busca) &&
          !(d.socio?.nome.toLowerCase().includes(busca) ?? false)
        )
          return false;
        return true;
      });

  return (
    <div className={cn("space-y-4 transition-opacity", carregando && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <BuscaUrl filtros={filtros} placeholder="Buscar por empresa ou sócio…" />
        <Select
          value={status}
          onChange={(e) => definir({ status: e.target.value === "abertas" ? null : e.target.value })}
          className="w-auto"
          aria-label="Status"
        >
          <option value="abertas">Abertas</option>
          <option value="todos">Todas</option>
        </Select>
        <Select
          value={tipo}
          onChange={(e) => definir({ tipo: e.target.value || null })}
          className="w-auto"
          aria-label="Tipo"
        >
          <option value="">Todos os tipos</option>
          {IR_TIPOS.map((t) => (
            <option key={t} value={t}>
              {IR_TIPO_LABEL[t]}
            </option>
          ))}
        </Select>
      </div>

      {filtradas.length === 0 ? (
        <EmptyState
          title="Nenhuma declaração"
          description="Ajuste os filtros ou gere as declarações da campanha."
        />
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--color-line)] bg-[var(--color-surface-1)]">
          <Table>
            <THead>
              <TR>
                <TH>Tipo</TH>
                <TH>Cliente</TH>
                <TH>Prazo</TH>
                <TH>Valor</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {filtradas.map((d) => (
                <TR key={d.id}>
                  <TD>
                    <Link
                      href={`/ir/${d.id}`}
                      className="font-medium text-[var(--color-text)] hover:text-[var(--color-carmine-bright)]"
                    >
                      {IR_TIPO_LABEL[d.tipo as IrTipo]}
                    </Link>
                  </TD>
                  <TD className="text-[var(--color-text-dim)]">
                    {d.empresa ? d.empresa.nome_fantasia || d.empresa.razao_social : "—"}
                    {d.socio ? ` · ${d.socio.nome}` : ""}
                  </TD>
                  <TD className="data text-xs text-[var(--color-text-dim)]">
                    {d.prazo ? formatData(d.prazo) : "—"}
                  </TD>
                  <TD className="data text-xs text-[var(--color-text-dim)]">
                    {d.valor_a_pagar ? `Pagar ${formatMoeda(d.valor_a_pagar)}` : null}
                    {d.valor_a_restituir ? `Restituir ${formatMoeda(d.valor_a_restituir)}` : null}
                    {!d.valor_a_pagar && !d.valor_a_restituir ? "—" : null}
                  </TD>
                  <TD>
                    <DeclaracaoIrStatusBadge status={d.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      {pagina ? (
        <Paginacao total={pagina.total} pagina={pagina.pagina} tamanho={pagina.tamanho} nomeItem="declarações" />
      ) : null}
    </div>
  );
}
