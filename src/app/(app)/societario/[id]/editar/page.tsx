import { notFound } from "next/navigation";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { listarColaboradores } from "@/core/auth/profiles";
import { PageHeader } from "@/core/ui";
import {
  empresasParaSocietario,
  getProcessoSocietario,
  ProcessoSocietarioForm,
} from "@/modules/societario";

export const metadata = { title: "Editar processo — Societário" };

export default async function EditarProcessoSocietarioPage({
  params,
}: PageProps<"/societario/[id]/editar">) {
  assertModuleEnabled("societario");
  await requireRole("admin", "societario");
  const { id } = await params;
  const processo = await getProcessoSocietario(id);
  if (!processo) notFound();

  const [empresas, responsaveis] = await Promise.all([
    empresasParaSocietario(),
    listarColaboradores(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Editar processo" eyebrow="Societário" />
      <ProcessoSocietarioForm
        processo={processo}
        empresas={empresas}
        responsaveis={responsaveis}
      />
    </div>
  );
}
