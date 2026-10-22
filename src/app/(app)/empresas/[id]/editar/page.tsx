import { notFound } from "next/navigation";

import { requireRole } from "@/core/auth/session";
import { PAPEIS_INTERNOS } from "@/core/types/domain";
import { PageHeader } from "@/core/ui";
import { EmpresaForm, getEmpresa, getResponsaveis } from "@/modules/empresas";

export const metadata = { title: "Editar empresa" };

export default async function EditarEmpresaPage({
  params,
}: PageProps<"/empresas/[id]/editar">) {
  const session = await requireRole(...PAPEIS_INTERNOS);
  const { id } = await params;
  const [empresa, responsaveis] = await Promise.all([
    getEmpresa(id),
    getResponsaveis(),
  ]);
  if (!empresa) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar empresa"
        description={empresa.razao_social}
      />
      <EmpresaForm
        empresa={empresa}
        responsaveis={responsaveis}
        souAdmin={session.profile.papel === "admin"}
      />
    </div>
  );
}
