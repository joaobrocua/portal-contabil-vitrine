import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { paramUuid } from "@/core/lib/search-params";
import { listarColaboradores } from "@/core/auth/profiles";
import { PageHeader } from "@/core/ui";
import { empresasParaSocietario, ProcessoSocietarioForm } from "@/modules/societario";

export const metadata = { title: "Novo processo — Societário" };

export default async function NovoProcessoSocietarioPage({
  searchParams,
}: PageProps<"/societario/novo">) {
  assertModuleEnabled("societario");
  await requireRole("admin", "societario");
  const sp = await searchParams;
  const empresaId = paramUuid(sp.empresa);

  const [empresas, responsaveis] = await Promise.all([
    empresasParaSocietario(),
    listarColaboradores(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Novo processo" eyebrow="Societário" />
      <ProcessoSocietarioForm
        empresas={empresas}
        responsaveis={responsaveis}
        empresaFixaId={empresaId}
      />
    </div>
  );
}
