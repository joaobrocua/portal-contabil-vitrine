"use client";

import Link from "next/link";

import { cn } from "@/core/lib/cn";
import { formatData } from "@/core/lib/format";
import type { Pagina } from "@/core/lib/paginacao";
import {
  PROCESSO_SOCIETARIO_TIPO_LABEL,
  type ProcessoSocietarioStatus,
  type ProcessoSocietarioTipo,
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

import type { ProcessoSocietarioItem } from "../queries";
import { PROCESSO_SOCIETARIO_TIPOS } from "../schema";
import { ProcessoSocietarioStatusBadge } from "./status-badge";

/**
 * Com `pagina`, filtros no endereço e o servidor filtra/pagina (tela do
 * Societário). Com `processos`, lista curta filtrada no navegador (ficha
 * da empresa).
 */
export function ProcessosSocietariosList({
  processos,
  pagina,
  mostrarEmpresa = true,
}: {
  processos?: ProcessoSocietarioItem[];
  pagina?: Pagina<ProcessoSocietarioItem>;
  mostrarEmpresa?: boolean;
}) {
  const filtros = useFiltros(!!pagina);
  const { valor, definir, carregando } = filtros;
  const status = valor("status", "abertos");
  const tipo = valor("tipo");
  const busca = valor("busca").trim().toLowerCase();

  const filtrados = pagina
    ? pagina.itens
    : (processos ?? []).filter((p) => {
        const concluido = ["concluido", "cancelado"].includes(p.status);
        if (status === "abertos" && concluido) return false;
        if (tipo && p.tipo !== tipo) return false;
        if (
          busca &&
          !p.empresa?.razao_social.toLowerCase().includes(busca) &&
          !(p.protocolo?.toLowerCase().includes(busca) ?? false)
        )
          return false;
        return true;
      });

  return (
    <div className={cn("space-y-4 transition-opacity", carregando && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <BuscaUrl filtros={filtros} placeholder="Buscar por empresa ou protocolo…" />
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
          {PROCESSO_SOCIETARIO_TIPOS.map((t) => (
            <option key={t} value={t}>
              {PROCESSO_SOCIETARIO_TIPO_LABEL[t]}
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
                {mostrarEmpresa ? <TH>Empresa</TH> : null}
                <TH>Protocolo</TH>
                <TH>Responsável</TH>
                <TH>Aberto em</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {filtrados.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link
                      href={`/societario/${p.id}`}
                      className="font-medium text-[var(--color-text)] hover:text-[var(--color-carmine-bright)]"
                    >
                      {PROCESSO_SOCIETARIO_TIPO_LABEL[p.tipo as ProcessoSocietarioTipo]}
                    </Link>
                  </TD>
                  {mostrarEmpresa ? (
                    <TD className="text-[var(--color-text-dim)]">
                      {p.empresa ? p.empresa.nome_fantasia || p.empresa.razao_social : "—"}
                    </TD>
                  ) : null}
                  <TD className="data text-xs text-[var(--color-text-dim)]">
                    {p.protocolo ?? "—"}
                  </TD>
                  <TD className="text-[var(--color-text-dim)]">{p.responsavel?.nome ?? "—"}</TD>
                  <TD className="data text-xs text-[var(--color-text-dim)]">
                    {formatData(p.created_at)}
                  </TD>
                  <TD>
                    <ProcessoSocietarioStatusBadge status={p.status as ProcessoSocietarioStatus} />
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
