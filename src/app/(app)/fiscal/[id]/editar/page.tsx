import { notFound } from "next/navigation";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { listarColaboradores } from "@/core/auth/profiles";
import { PageHeader } from "@/core/ui";
import {
  empresasParaFiscal,
  getObrigacao,
  ObrigacaoForm,
} from "@/modules/fiscal";

export const metadata = { title: "Editar obrigação — Fiscal" };

export default async function EditarObrigacaoPage({
  params,
}: PageProps<"/fiscal/[id]/editar">) {
  assertModuleEnabled("fiscal");
  await requireRole("admin", "fiscal");
  const { id } = await params;
  const [o, empresas, responsaveis] = await Promise.all([
    getObrigacao(id),
    empresasParaFiscal(),
    listarColaboradores(),
  ]);
  if (!o) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Editar obrigação" eyebrow="Fiscal" />
      <ObrigacaoForm
        obrigacao={o}
        empresas={empresas}
        responsaveis={responsaveis}
      />
    </div>
  );
}
