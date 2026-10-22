"use client";

import Link from "next/link";

import { cn } from "@/core/lib/cn";
import { formatData, formatMoeda } from "@/core/lib/format";
import type { Pagina } from "@/core/lib/paginacao";
import {
  FUNCIONARIO_STATUS_LABEL,
  TIPO_CONTRATO_LABEL,
  type FuncionarioStatus,
  type TipoContrato,
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

import type { FuncionarioItem } from "../queries";
import { FuncionarioStatusBadge } from "./status-badge";

/**
 * Com `pagina`, os filtros vão para o endereço e o servidor filtra/pagina
 * (tela de Funcionários). Com `funcionarios`, a lista já veio inteira e
 * filtra no navegador (ficha da empresa).
 */
export function FuncionariosList({
  funcionarios,
  pagina,
  mostrarEmpresa = true,
}: {
  funcionarios?: FuncionarioItem[];
  pagina?: Pagina<FuncionarioItem>;
  mostrarEmpresa?: boolean;
}) {
  const filtros = useFiltros(!!pagina);
  const { valor, definir, carregando } = filtros;
  const status = valor("status", "todos");
  const busca = valor("busca").trim().toLowerCase();

  const filtrados = pagina
    ? pagina.itens
    : (funcionarios ?? []).filter((f) => {
        if (status !== "todos" && f.status !== status) return false;
        if (busca && !f.nome.toLowerCase().includes(busca)) return false;
        return true;
      });

  return (
    <div className={cn("space-y-4 transition-opacity", carregando && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <BuscaUrl
          filtros={filtros}
          placeholder={pagina && mostrarEmpresa ? "Buscar por nome ou empresa…" : "Buscar por nome…"}
        />
        <Select
          value={status}
          onChange={(e) => definir({ status: e.target.value === "todos" ? null : e.target.value })}
          className="w-auto"
          aria-label="Status"
        >
          <option value="todos">Todos os status</option>
          {(Object.keys(FUNCIONARIO_STATUS_LABEL) as FuncionarioStatus[]).map((s) => (
            <option key={s} value={s}>
              {FUNCIONARIO_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          title="Nenhum funcionário"
          description="Ajuste os filtros ou cadastre o primeiro funcionário."
        />
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--color-line)] bg-[var(--color-surface-1)]">
          <Table>
            <THead>
              <TR>
                <TH>Nome</TH>
                {mostrarEmpresa ? <TH>Empresa</TH> : null}
                <TH>Cargo</TH>
                <TH>Contrato</TH>
                <TH>Admissão</TH>
                <TH className="text-right">Salário</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {filtrados.map((f) => (
                <TR key={f.id}>
                  <TD>
                    <Link
                      href={`/pessoal/funcionarios/${f.id}`}
                      className="font-medium text-[var(--color-text)] hover:text-[var(--color-carmine-bright)]"
                    >
                      {f.nome}
                    </Link>
                  </TD>
                  {mostrarEmpresa ? (
                    <TD className="text-[var(--color-text-dim)]">
                      {f.empresa
                        ? f.empresa.nome_fantasia || f.empresa.razao_social
                        : "—"}
                    </TD>
                  ) : null}
                  <TD className="text-[var(--color-text-dim)]">{f.cargo ?? "—"}</TD>
                  <TD>{TIPO_CONTRATO_LABEL[f.tipo_contrato as TipoContrato]}</TD>
                  <TD className="data text-xs">{formatData(f.data_admissao)}</TD>
                  <TD className="data text-right text-xs">
                    {f.salario != null ? formatMoeda(f.salario) : "—"}
                  </TD>
                  <TD>
                    <FuncionarioStatusBadge status={f.status as FuncionarioStatus} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      {pagina ? (
        <Paginacao total={pagina.total} pagina={pagina.pagina} tamanho={pagina.tamanho} nomeItem="funcionários" />
      ) : null}
    </div>
  );
}
