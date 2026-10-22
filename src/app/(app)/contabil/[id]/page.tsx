import Link from "next/link";
import { notFound } from "next/navigation";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { listarColaboradores } from "@/core/auth/profiles";
import { listarHistorico } from "@/core/lib/historico";
import { HistoricoList } from "@/core/layout/historico-list";
import { formatCompetencia } from "@/core/lib/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/core/ui";
import {
  ChecklistFechamento,
  FechamentoResponsavelForm,
  FechamentoStatusBadge,
  FechamentoStatusPicker,
  getFechamento,
} from "@/modules/contabil";

export async function generateMetadata({
  params,
}: PageProps<"/contabil/[id]">) {
  const { id } = await params;
  const f = await getFechamento(id);
  const nome = f?.empresa ? f.empresa.nome_fantasia || f.empresa.razao_social : "Fechamento";
  return { title: `${nome} — ${f ? formatCompetencia(f.competencia) : ""}` };
}

export default async function FechamentoPage({
  params,
}: PageProps<"/contabil/[id]">) {
  assertModuleEnabled("contabil");
  await requireRole("admin", "contabil");
  const { id } = await params;
  const fechamento = await getFechamento(id);
  if (!fechamento) notFound();

  const [historico, colaboradores] = await Promise.all([
    listarHistorico({ entidade: "fechamento", entidadeId: id }),
    listarColaboradores(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          fechamento.empresa
            ? fechamento.empresa.nome_fantasia || fechamento.empresa.razao_social
            : "Fechamento"
        }
        eyebrow={`Fechamento contábil · ${formatCompetencia(fechamento.competencia)}`}
        actions={<FechamentoStatusBadge status={fechamento.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Situação</CardTitle>
              <FechamentoStatusPicker id={id} status={fechamento.status} />
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">
                    Empresa
                  </dt>
                  <dd className="text-sm text-[var(--color-text)]">
                    {fechamento.empresa ? (
                      <Link
                        href={`/empresas/${fechamento.empresa.id}?aba=contabil`}
                        className="text-[var(--color-carmine-bright)] hover:underline"
                      >
                        {fechamento.empresa.nome_fantasia || fechamento.empresa.razao_social}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">
                    Competência
                  </dt>
                  <dd className="text-sm text-[var(--color-text)]">
                    {formatCompetencia(fechamento.competencia)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <ChecklistFechamento fechamentoId={id} itens={fechamento.itens} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Responsável e observações</CardTitle>
            </CardHeader>
            <CardContent>
              <FechamentoResponsavelForm
                fechamentoId={id}
                responsavelId={fechamento.responsavel_id}
                observacao={fechamento.observacao}
                colaboradores={colaboradores}
              />
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
