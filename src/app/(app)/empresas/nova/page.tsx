import { requireRole } from "@/core/auth/session";
import { PAPEIS_INTERNOS } from "@/core/types/domain";
import { PageHeader } from "@/core/ui";
import { EmpresaForm, getResponsaveis } from "@/modules/empresas";

export const metadata = { title: "Nova empresa" };

export default async function NovaEmpresaPage() {
  const session = await requireRole(...PAPEIS_INTERNOS);
  const responsaveis = await getResponsaveis();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nova empresa"
        description="Cadastro da empresa-cliente. Sócios e contatos você adiciona depois."
      />
      <EmpresaForm
        responsaveis={responsaveis}
        souAdmin={session.profile.papel === "admin"}
      />
    </div>
  );
}
