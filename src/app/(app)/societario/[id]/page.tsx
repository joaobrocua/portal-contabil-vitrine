import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { listarHistorico } from "@/core/lib/historico";
import { HistoricoList } from "@/core/layout/historico-list";
import {
  PROCESSO_SOCIETARIO_TIPO_LABEL,
  type ProcessoSocietarioStatus,
  type ProcessoSocietarioTipo,
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
  ChecklistProcessoSocietario,
  getProcessoSocietario,
  ProcessoSocietarioStatusBadge,
  ProcessoSocietarioStatusPicker,
} from "@/modules/societario";

export async function generateMetadata({
  params,
}: PageProps<"/societario/[id]">) {
  const { id } = await params;
  const p = await getProcessoSocietario(id);
  return { title: p ? PROCESSO_SOCIETARIO_TIPO_LABEL[p.tipo as ProcessoSocietarioTipo] : "Processo" };
}

export default async function ProcessoSocietarioPage({
  params,
}: PageProps<"/societario/[id]">) {
  assertModuleEnabled("societario");
  await requireRole("admin", "societario");
  const { id } = await params;
  const processo = await getProcessoSocietario(id);
  if (!processo) notFound();

  const historico = await listarHistorico({ entidade: "processo_societario", entidadeId: id });

  const linhas: [string, React.ReactNode][] = [
    [
      "Empresa",
      processo.empresa ? (
        <Link
          href={`/empresas/${processo.empresa.id}`}
          className="text-[var(--color-carmine-bright)] hover:underline"
        >
          {processo.empresa.nome_fantasia || processo.empresa.razao_social}
        </Link>
      ) : (
        "—"
      ),
    ],
    ["Protocolo", processo.protocolo || "—"],
    ["Responsável", processo.responsavel?.nome ?? "Não atribuído"],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={PROCESSO_SOCIETARIO_TIPO_LABEL[processo.tipo as ProcessoSocietarioTipo]}
        eyebrow="Processo societário"
        actions={
          <>
            <ProcessoSocietarioStatusBadge status={processo.status as ProcessoSocietarioStatus} />
            <Link
              href={`/societario/${id}/editar`}
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
              <ProcessoSocietarioStatusPicker id={id} status={processo.status as ProcessoSocietarioStatus} />
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
              {processo.descricao ? (
                <p className="mt-4 whitespace-pre-wrap border-t border-[var(--color-line-soft)] pt-4 text-sm text-[var(--color-text-dim)]">
                  {processo.descricao}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <ChecklistProcessoSocietario processoId={id} itens={processo.itens} />
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
