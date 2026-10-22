import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { paramUuid } from "@/core/lib/search-params";
import { PageHeader } from "@/core/ui";
import { empresasParaPessoal, FuncionarioForm } from "@/modules/pessoal";

export const metadata = { title: "Novo funcionário" };

export default async function NovoFuncionarioPage({
  searchParams,
}: PageProps<"/pessoal/funcionarios/novo">) {
  assertModuleEnabled("pessoal");
  await requireRole("admin", "pessoal");
  const sp = await searchParams;

  const empresas = await empresasParaPessoal();

  return (
    <div className="space-y-6">
      <PageHeader title="Novo funcionário" eyebrow="Departamento Pessoal" />
      <FuncionarioForm
        empresas={empresas}
        empresaFixaId={paramUuid(sp.empresa)}
      />
    </div>
  );
}
