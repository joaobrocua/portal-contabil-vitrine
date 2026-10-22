import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { listarHistorico } from "@/core/lib/historico";
import { HistoricoList } from "@/core/layout/historico-list";
import { formatCompetencia, formatData } from "@/core/lib/format";
import { EVENTO_DP_TIPO_LABEL, type EventoDpStatus, type EventoDpTipo } from "@/core/types/domain";
import {
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/core/ui";
import {
  ChecklistEventoDp,
  EventoDpStatusBadge,
  EventoDpStatusPicker,
  getEventoDp,
} from "@/modules/pessoal";

export async function generateMetadata({
  params,
}: PageProps<"/pessoal/processos/[id]">) {
  const { id } = await params;
  const e = await getEventoDp(id);
  return { title: e ? EVENTO_DP_TIPO_LABEL[e.tipo as EventoDpTipo] : "Processo" };
}

export default async function ProcessoPage({
  params,
}: PageProps<"/pessoal/processos/[id]">) {
  assertModuleEnabled("pessoal");
  await requireRole("admin", "pessoal");
  const { id } = await params;
  const evento = await getEventoDp(id);
  if (!evento) notFound();

  const historico = await listarHistorico({ entidade: "evento_dp", entidadeId: id });

  const linhas: [string, React.ReactNode][] = [
    [
      "Empresa",
      evento.empresa ? (
        <Link
          href={`/empresas/${evento.empresa.id}?aba=pessoal`}
          className="text-[var(--color-carmine-bright)] hover:underline"
        >
          {evento.empresa.nome_fantasia || evento.empresa.razao_social}
        </Link>
      ) : (
        "—"
      ),
    ],
    [
      "Funcionário",
      evento.funcionario ? (
        <Link
          href={`/pessoal/funcionarios/${evento.funcionario.id}`}
          className="text-[var(--color-carmine-bright)] hover:underline"
        >
          {evento.funcionario.nome}
        </Link>
      ) : (
        "Não vinculado"
      ),
    ],
    ["Competência", evento.competencia ? formatCompetencia(evento.competencia) : "—"],
    ["Data de referência", evento.data_referencia ? formatData(evento.data_referencia) : "—"],
    ["Responsável", evento.responsavel?.nome ?? "Não atribuído"],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={EVENTO_DP_TIPO_LABEL[evento.tipo as EventoDpTipo]}
        eyebrow="Processo de DP"
        actions={
          <>
            <EventoDpStatusBadge status={evento.status as EventoDpStatus} />
            <Link
              href={`/pessoal/processos/${id}/editar`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil className="size-4" />
              Editar
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Situação</CardTitle>
              <EventoDpStatusPicker id={id} status={evento.status as EventoDpStatus} />
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
              {evento.detalhe ? (
                <p className="mt-4 whitespace-pre-wrap border-t border-[var(--color-line-soft)] pt-4 text-sm text-[var(--color-text-dim)]">
                  {evento.detalhe}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <ChecklistEventoDp eventoId={id} itens={evento.itens} />
            </CardContent>
          </Card>
        </div>

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
