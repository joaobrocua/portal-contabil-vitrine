"use client";

import Link from "next/link";

import { cn } from "@/core/lib/cn";
import { formatCNPJ } from "@/core/lib/format";
import type { Pagina } from "@/core/lib/paginacao";
import {
  REGIME_LABEL,
  SITUACAO_EMPRESA_LABEL,
  type RegimeTributario,
  type SituacaoEmpresa,
} from "@/core/types/domain";
import {
  Badge,
  BuscaUrl,
  EmptyState,
  Paginacao,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useFiltroUrl,
} from "@/core/ui";
import type { EmpresaListItem } from "../queries";

const SIT_TONE: Record<SituacaoEmpresa, Parameters<typeof Badge>[0]["tone"]> = {
  ativa: "success",
  suspensa: "warning",
  baixada: "neutral",
  em_abertura: "info",
  distrato: "danger",
};

export function EmpresasTable({
  pagina,
  nInativas,
}: {
  pagina: Pagina<EmpresaListItem>;
  nInativas: number;
}) {
  const { valor, definir, carregando } = useFiltroUrl();
  // Inativa = cliente que o escritório deixou de atender. Some da lista por
  // padrão (senão ex-clientes poluem o dia a dia), mas continua acessível.
  const mostrarInativas = valor("inativas") === "1";
  const filtradas = pagina.itens;

  return (
    <div className={cn("space-y-4 transition-opacity", carregando && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-4">
        <BuscaUrl placeholder="Buscar por nome ou CNPJ…" className="w-full max-w-sm flex-none" />
        {nInativas > 0 ? (
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-dim)]">
            <input
              type="checkbox"
              checked={mostrarInativas}
              onChange={(e) => definir({ inativas: e.target.checked ? "1" : null })}
              className="size-4 accent-[var(--color-carmine)]"
            />
            Mostrar inativas ({nInativas})
          </label>
        ) : null}
      </div>

      {filtradas.length === 0 ? (
        <EmptyState
          title="Nenhuma empresa encontrada"
          description={
            valor("busca")
              ? "Ajuste a busca ou cadastre uma nova empresa."
              : "Cadastre a primeira empresa para começar."
          }
        />
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-[var(--color-surface)]">
          <Table>
            <THead>
              <TR>
                <TH>Empresa</TH>
                <TH>CNPJ</TH>
                <TH>Regime</TH>
                <TH>Local</TH>
                <TH>Responsável</TH>
                <TH>Situação</TH>
              </TR>
            </THead>
            <TBody>
              {filtradas.map((e) => (
                <TR key={e.id} className={e.ativo ? "cursor-pointer" : "cursor-pointer opacity-60"}>
                  <TD>
                    <Link
                      href={`/empresas/${e.id}`}
                      className="font-medium text-neutral-900 hover:text-brand"
                    >
                      {e.nome_fantasia || e.razao_social}
                    </Link>
                    {!e.ativo ? (
                      <Badge tone="danger" className="ml-2">
                        Inativa
                      </Badge>
                    ) : null}
                    {e.nome_fantasia ? (
                      <p className="text-xs text-neutral-400">
                        {e.razao_social}
                      </p>
                    ) : null}
                  </TD>
                  <TD className="data text-xs">{formatCNPJ(e.cnpj)}</TD>
                  <TD>
                    {REGIME_LABEL[e.regime_tributario as RegimeTributario]}
                  </TD>
                  <TD>
                    {[e.municipio, e.uf].filter(Boolean).join(" / ") || "—"}
                  </TD>
                  <TD>{e.responsavel?.nome ?? "—"}</TD>
                  <TD>
                    <Badge tone={SIT_TONE[e.situacao as SituacaoEmpresa]}>
                      {SITUACAO_EMPRESA_LABEL[e.situacao as SituacaoEmpresa]}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      <Paginacao total={pagina.total} pagina={pagina.pagina} tamanho={pagina.tamanho} nomeItem="empresas" />
    </div>
  );
}
