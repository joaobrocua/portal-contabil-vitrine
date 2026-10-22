import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { listarHistorico } from "@/core/lib/historico";
import { HistoricoList } from "@/core/layout/historico-list";
import { formatCPF, formatData, formatMoeda } from "@/core/lib/format";
import {
  EVENTO_DP_TIPO_LABEL,
  TIPO_CONTRATO_LABEL,
  type EventoDpTipo,
  type FuncionarioStatus,
  type TipoContrato,
} from "@/core/types/domain";
import {
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
} from "@/core/ui";
import {
  EventoDpStatusBadge,
  FuncionarioStatusBadge,
  getFuncionario,
  listEventosDp,
} from "@/modules/pessoal";

export async function generateMetadata({
  params,
}: PageProps<"/pessoal/funcionarios/[id]">) {
  const { id } = await params;
  const f = await getFuncionario(id);
  return { title: f?.nome ?? "Funcionário" };
}

export default async function FuncionarioPage({
  params,
}: PageProps<"/pessoal/funcionarios/[id]">) {
  assertModuleEnabled("pessoal");
  await requireRole("admin", "pessoal");
  const { id } = await params;
  const funcionario = await getFuncionario(id);
  if (!funcionario) notFound();

  const [eventos, historico] = await Promise.all([
    listEventosDp({ funcionarioId: id }),
    listarHistorico({ entidade: "funcionario", entidadeId: id }),
  ]);

  const linhas: [string, string][] = [
    ["CPF", funcionario.cpf ? formatCPF(funcionario.cpf) : "—"],
    ["Cargo", funcionario.cargo ?? "—"],
    ["Tipo de contrato", TIPO_CONTRATO_LABEL[funcionario.tipo_contrato as TipoContrato]],
    ["Admissão", formatData(funcionario.data_admissao)],
    ["Demissão", funcionario.data_demissao ? formatData(funcionario.data_demissao) : "—"],
    [
      "Salário",
      funcionario.salario != null ? formatMoeda(funcionario.salario) : "—",
    ],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={funcionario.nome}
        eyebrow="Ficha funcional"
        description={
          funcionario.empresa
            ? funcionario.empresa.nome_fantasia || funcionario.empresa.razao_social
            : undefined
        }
        actions={
          <>
            <FuncionarioStatusBadge status={funcionario.status as FuncionarioStatus} />
            <Link
              href={`/pessoal/funcionarios/${id}/editar`}
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
          <CardHeader>
            <CardTitle>Dados funcionais</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {linhas.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">
                    {k}
                  </dt>
                  <dd className="text-sm text-[var(--color-text)]">{v}</dd>
                </div>
              ))}
            </dl>
            {funcionario.observacoes ? (
              <p className="mt-4 whitespace-pre-wrap border-t border-[var(--color-line-soft)] pt-4 text-sm text-[var(--color-text-dim)]">
                {funcionario.observacoes}
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

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Processos deste funcionário</CardTitle>
          <Link
            href={`/pessoal/processos/novo?funcionario=${id}&empresa=${funcionario.empresa_id}`}
            className={buttonVariants({ variant: "subtle", size: "sm" })}
          >
            <Plus className="size-4" />
            Novo processo
          </Link>
        </CardHeader>
        <CardContent>
          {eventos.length === 0 ? (
            <EmptyState title="Nenhum processo registrado" />
          ) : (
            <ul className="divide-y divide-[var(--color-line-soft)]">
              {eventos.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5">
                  <Link
                    href={`/pessoal/processos/${e.id}`}
                    className="flex-1 text-sm text-[var(--color-text)] hover:text-[var(--color-carmine-bright)]"
                  >
                    {EVENTO_DP_TIPO_LABEL[e.tipo as EventoDpTipo]}
                  </Link>
                  <EventoDpStatusBadge status={e.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
