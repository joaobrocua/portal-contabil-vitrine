import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { listarHistorico } from "@/core/lib/historico";
import { HistoricoList } from "@/core/layout/historico-list";
import {
  diasAte,
  formatCompetencia,
  formatData,
  formatMoeda,
} from "@/core/lib/format";
import {
  OBRIGACAO_TIPO_LABEL,
  type ObrigacaoStatus,
  type ObrigacaoTipo,
} from "@/core/types/domain";
import {
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/core/ui";
import {
  getObrigacao,
  ObrigacaoStatusBadge,
  ObrigacaoStatusPicker,
} from "@/modules/fiscal";

export async function generateMetadata({
  params,
}: PageProps<"/fiscal/[id]">) {
  const { id } = await params;
  const o = await getObrigacao(id);
  return {
    title: o ? OBRIGACAO_TIPO_LABEL[o.tipo as ObrigacaoTipo] : "Obrigação",
  };
}

export default async function ObrigacaoPage({
  params,
}: PageProps<"/fiscal/[id]">) {
  assertModuleEnabled("fiscal");
  await requireRole("admin", "fiscal");
  const { id } = await params;
  const o = await getObrigacao(id);
  if (!o) notFound();

  const historico = await listarHistorico({
    entidade: "obrigacao",
    entidadeId: id,
  });

  const d = diasAte(o.vencimento);
  const atrasada =
    d != null &&
    d < 0 &&
    !["entregue", "paga", "dispensada"].includes(o.status);

  const linhas: [string, React.ReactNode][] = [
    [
      "Empresa",
      o.empresa ? (
        <Link
          href={`/empresas/${o.empresa.id}?aba=fiscal`}
          className="text-[var(--color-carmine-bright)] hover:underline"
        >
          {o.empresa.nome_fantasia || o.empresa.razao_social}
        </Link>
      ) : (
        "—"
      ),
    ],
    ["Competência", formatCompetencia(o.competencia)],
    [
      "Vencimento",
      <span
        key="v"
        className={atrasada ? "font-medium text-[var(--color-carmine-bright)]" : ""}
      >
        {formatData(o.vencimento)}
        {atrasada ? ` · ${Math.abs(d!)} dia(s) em atraso` : ""}
      </span>,
    ],
    ["Valor", o.valor != null ? formatMoeda(o.valor) : "—"],
    ["Responsável", o.responsavel?.nome ?? "Não atribuída"],
    ["Data de entrega", o.data_entrega ? formatData(o.data_entrega) : "—"],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={OBRIGACAO_TIPO_LABEL[o.tipo as ObrigacaoTipo]}
        eyebrow="Obrigação fiscal"
        actions={
          <>
            <ObrigacaoStatusBadge
              status={o.status as ObrigacaoStatus}
              atrasada={atrasada}
            />
            <Link
              href={`/fiscal/${id}/editar`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil className="size-4" />
              Editar
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Situação</CardTitle>
            <ObrigacaoStatusPicker id={id} status={o.status as ObrigacaoStatus} />
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {linhas.map(([k, v], i) => (
                <div key={i}>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">
                    {k}
                  </dt>
                  <dd className="text-sm text-[var(--color-text)]">{v}</dd>
                </div>
              ))}
            </dl>
            {o.descricao ? (
              <p className="mt-4 border-t border-[var(--color-line-soft)] pt-4 text-sm text-[var(--color-text-dim)]">
                {o.descricao}
              </p>
            ) : null}
            {o.observacao ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-text-dim)]">
                {o.observacao}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            <HistoricoList itens={historico} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
