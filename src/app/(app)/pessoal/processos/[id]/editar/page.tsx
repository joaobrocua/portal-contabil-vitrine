import { notFound } from "next/navigation";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { listarColaboradores } from "@/core/auth/profiles";
import { PageHeader } from "@/core/ui";
import {
  empresasParaPessoal,
  EventoDpForm,
  funcionariosParaSelecao,
  getEventoDp,
} from "@/modules/pessoal";

export const metadata = { title: "Editar processo — Departamento Pessoal" };

export default async function EditarProcessoPage({
  params,
}: PageProps<"/pessoal/processos/[id]/editar">) {
  assertModuleEnabled("pessoal");
  await requireRole("admin", "pessoal");
  const { id } = await params;
  const evento = await getEventoDp(id);
  if (!evento) notFound();

  const [empresas, funcionarios, responsaveis] = await Promise.all([
    empresasParaPessoal(),
    funcionariosParaSelecao(evento.empresa_id),
    listarColaboradores(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Editar processo" eyebrow="Departamento Pessoal" />
      <EventoDpForm
        evento={evento}
        empresas={empresas}
        funcionarios={funcionarios}
        responsaveis={responsaveis}
      />
    </div>
  );
}
