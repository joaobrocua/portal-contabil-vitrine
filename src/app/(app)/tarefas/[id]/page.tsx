import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { requireRole } from "@/core/auth/session";
import { listarHistorico } from "@/core/lib/historico";
import { HistoricoList } from "@/core/layout/historico-list";
import {
  formatCompetencia,
  formatData,
  formatDataHora,
  diasAte,
} from "@/core/lib/format";
import {
  DEPARTAMENTO_LABEL,
  PAPEIS_INTERNOS,
  PRIORIDADE_LABEL,
  type TarefaStatus,
} from "@/core/types/domain";
import {
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/core/ui";
import { DocumentoLinha, listDocumentos } from "@/modules/documentos";
import {
  Checklist,
  DesvincularDocumento,
  documentosDaTarefa,
  getTarefa,
  StatusPicker,
  TarefaStatusBadge,
  VincularDocumento,
} from "@/modules/tarefas";

export async function generateMetadata({
  params,
}: PageProps<"/tarefas/[id]">) {
  const { id } = await params;
  const t = await getTarefa(id);
  return { title: t?.titulo ?? "Tarefa" };
}

export default async function TarefaPage({
  params,
}: PageProps<"/tarefas/[id]">) {
  await requireRole(...PAPEIS_INTERNOS);
  const { id } = await params;
  const tarefa = await getTarefa(id);
  if (!tarefa) notFound();

  const empresaId = tarefa.empresa?.id ?? null;
  const [historico, vinculados, docsEmpresa] = await Promise.all([
    listarHistorico({ entidade: "tarefa", entidadeId: id }),
    documentosDaTarefa(id),
    empresaId ? listDocumentos({ empresaId }) : Promise.resolve([]),
  ]);
  const idsVinculados = new Set(vinculados.map((d) => d.id));
  const opcoesVincular = docsEmpresa
    .filter((d) => !idsVinculados.has(d.id))
    .map((d) => ({ id: d.id, titulo: d.titulo }));

  const dias = diasAte(tarefa.prazo);
  const atrasada =
    dias != null &&
    dias < 0 &&
    !["concluida", "cancelada"].includes(tarefa.status);

  const meta: [string, React.ReactNode][] = [
    ["Empresa", tarefa.empresa ? (
      <Link
        href={`/empresas/${tarefa.empresa.id}`}
        className="text-brand hover:underline"
      >
        {tarefa.empresa.nome_fantasia || tarefa.empresa.razao_social}
      </Link>
    ) : "Interna"],
    ["Departamento", DEPARTAMENTO_LABEL[tarefa.departamento]],
    ["Responsável", tarefa.responsavel?.nome ?? "Não atribuída"],
    ["Prioridade", PRIORIDADE_LABEL[tarefa.prioridade]],
    ["Competência", formatCompetencia(tarefa.competencia)],
    [
      "Prazo",
      <span key="p" className={atrasada ? "font-medium text-[var(--color-carmine-bright)]" : ""}>
        {tarefa.prazo ? formatData(tarefa.prazo) : "—"}
        {atrasada ? ` (${Math.abs(dias!)} dia(s) em atraso)` : ""}
      </span>,
    ],
    ["Criada por", tarefa.criador?.nome ?? "—"],
    ["Criada em", formatDataHora(tarefa.created_at)],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tarefa.titulo}
        actions={
          <>
            <TarefaStatusBadge
              status={atrasada ? "atrasada" : (tarefa.status as TarefaStatus)}
            />
            <Link
              href={`/tarefas/${id}/editar`}
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
              <StatusPicker
                tarefaId={id}
                status={tarefa.status as TarefaStatus}
              />
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {meta.map(([k, v], i) => (
                  <div key={i}>
                    <dt className="text-xs uppercase tracking-wide text-neutral-400">
                      {k}
                    </dt>
                    <dd className="text-sm text-neutral-800">{v}</dd>
                  </div>
                ))}
              </dl>
              {tarefa.descricao ? (
                <p className="mt-4 whitespace-pre-wrap border-t border-neutral-100 pt-4 text-sm text-neutral-700">
                  {tarefa.descricao}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklist / etapas</CardTitle>
            </CardHeader>
            <CardContent>
              <Checklist tarefaId={id} itens={tarefa.itens} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documentos vinculados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!empresaId ? (
                <p className="text-sm text-[var(--color-text-dim)]">
                  Tarefa interna — só dá pra vincular documento quando a tarefa
                  é de uma empresa.
                </p>
              ) : (
                <>
                  {vinculados.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-dim)]">
                      Nenhum documento vinculado.
                    </p>
                  ) : (
                    <div className="divide-y divide-[var(--color-line-soft)] rounded-[var(--radius)] border border-[var(--color-line-soft)]">
                      {vinculados.map((doc) => (
                        <div key={doc.id} className="flex items-center pr-2">
                          <div className="min-w-0 flex-1">
                            {/* Revisão (aprovar/rejeitar) fica na Central de Documentos. */}
                            <DocumentoLinha doc={doc} podeRevisar={false} />
                          </div>
                          <DesvincularDocumento tarefaId={id} documentoId={doc.id} />
                        </div>
                      ))}
                    </div>
                  )}
                  <VincularDocumento tarefaId={id} opcoes={opcoesVincular} />
                </>
              )}
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
