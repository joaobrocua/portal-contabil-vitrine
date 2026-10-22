import { notFound } from "next/navigation";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { PageHeader } from "@/core/ui";
import { empresasParaPessoal, FuncionarioForm, getFuncionario } from "@/modules/pessoal";

export const metadata = { title: "Editar funcionário" };

export default async function EditarFuncionarioPage({
  params,
}: PageProps<"/pessoal/funcionarios/[id]/editar">) {
  assertModuleEnabled("pessoal");
  await requireRole("admin", "pessoal");
  const { id } = await params;
  const [funcionario, empresas] = await Promise.all([
    getFuncionario(id),
    empresasParaPessoal(),
  ]);
  if (!funcionario) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Editar funcionário" eyebrow="Departamento Pessoal" />
      <FuncionarioForm funcionario={funcionario} empresas={empresas} />
    </div>
  );
}
