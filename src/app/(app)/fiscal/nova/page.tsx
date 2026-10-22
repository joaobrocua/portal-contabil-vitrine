import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { paramMes, paramUuid } from "@/core/lib/search-params";
import { listarColaboradores } from "@/core/auth/profiles";
import { PageHeader } from "@/core/ui";
import { empresasParaFiscal, ObrigacaoForm } from "@/modules/fiscal";

export const metadata = { title: "Nova obrigação — Fiscal" };

export default async function NovaObrigacaoPage({
  searchParams,
}: PageProps<"/fiscal/nova">) {
  assertModuleEnabled("fiscal");
  await requireRole("admin", "fiscal");
  const sp = await searchParams;

  const [empresas, responsaveis] = await Promise.all([
    empresasParaFiscal(),
    listarColaboradores(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Nova obrigação" eyebrow="Fiscal" />
      <ObrigacaoForm
        empresas={empresas}
        responsaveis={responsaveis}
        empresaFixaId={paramUuid(sp.empresa)}
        competenciaInicial={(() => {
          const mes = paramMes(sp.competencia);
          return mes ? `${mes}-01` : undefined;
        })()}
      />
    </div>
  );
}
