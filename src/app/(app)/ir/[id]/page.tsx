import Link from "next/link";
import { notFound } from "next/navigation";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { listarColaboradores } from "@/core/auth/profiles";
import { listarHistorico } from "@/core/lib/historico";
import { HistoricoList } from "@/core/layout/historico-list";
import { IR_TIPO_DESCRICAO, IR_TIPO_LABEL, type IrTipo } from "@/core/types/domain";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/core/ui";
import {
  DeclaracaoIrDetalhesForm,
  DeclaracaoIrStatusBadge,
  DeclaracaoIrStatusPicker,
  getDeclaracaoIr,
} from "@/modules/ir";

export async function generateMetadata({ params }: PageProps<"/ir/[id]">) {
  const { id } = await params;
  const d = await getDeclaracaoIr(id);
  return { title: d ? `${IR_TIPO_LABEL[d.tipo as IrTipo]} ${d.ano_exercicio}` : "Declaração" };
}

export default async function DeclaracaoIrPage({ params }: PageProps<"/ir/[id]">) {
  assertModuleEnabled("ir");
  await requireRole("admin", "fiscal", "contabil");
  const { id } = await params;
  const declaracao = await getDeclaracaoIr(id);
  if (!declaracao) notFound();

  const [historico, colaboradores] = await Promise.all([
    listarHistorico({ entidade: "declaracao_ir", entidadeId: id }),
    listarColaboradores(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${IR_TIPO_LABEL[declaracao.tipo as IrTipo]} — ${declaracao.ano_exercicio}`}
        eyebrow={IR_TIPO_DESCRICAO[declaracao.tipo as IrTipo]}
        actions={<DeclaracaoIrStatusBadge status={declaracao.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Situação</CardTitle>
              <DeclaracaoIrStatusPicker id={id} status={declaracao.status} />
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">
                    Empresa
                  </dt>
                  <dd className="text-sm text-[var(--color-text)]">
                    {declaracao.empresa ? (
                      <Link
                        href={`/empresas/${declaracao.empresa.id}`}
                        className="text-[var(--color-carmine-bright)] hover:underline"
                      >
                        {declaracao.empresa.nome_fantasia || declaracao.empresa.razao_social}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                {declaracao.socio ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">
                      Sócio
                    </dt>
                    <dd className="text-sm text-[var(--color-text)]">{declaracao.socio.nome}</dd>
                  </div>
                ) : null}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalhes</CardTitle>
            </CardHeader>
            <CardContent>
              <DeclaracaoIrDetalhesForm
                id={id}
                prazo={declaracao.prazo}
                valorAPagar={declaracao.valor_a_pagar}
                valorARestituir={declaracao.valor_a_restituir}
                recibo={declaracao.recibo}
                responsavelId={declaracao.responsavel_id}
                observacao={declaracao.observacao}
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
