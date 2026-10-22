import Link from "next/link";
import { Plus } from "lucide-react";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { paramBusca, paramPagina } from "@/core/lib/paginacao";
import { paramEnum, paramUuid } from "@/core/lib/search-params";
import { PROCESSO_SOCIETARIO_TIPO_LABEL, type ProcessoSocietarioTipo } from "@/core/types/domain";
import { buttonVariants, Card, CardContent, PageHeader } from "@/core/ui";
import { contarSocietario, paginarProcessosSocietarios, ProcessosSocietariosList } from "@/modules/societario";

export const metadata = { title: "Societário" };

function StatTile({ valor, label }: { valor: number; label: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="stat text-3xl text-[var(--color-text)]">{valor}</span>
        <span className="text-xs text-[var(--color-text-dim)]">{label}</span>
      </CardContent>
    </Card>
  );
}

export default async function SocietarioPage({
  searchParams,
}: PageProps<"/societario">) {
  assertModuleEnabled("societario");
  await requireRole("admin", "societario");
  const sp = await searchParams;
  const empresaId = paramUuid(sp.empresa);

  const [resumo, pagina] = await Promise.all([
    contarSocietario(),
    paginarProcessosSocietarios(
      {
        empresaId,
        status: sp.status === "todos" ? "todos" : "abertos",
        tipo: paramEnum(
          sp.tipo,
          Object.keys(PROCESSO_SOCIETARIO_TIPO_LABEL) as ProcessoSocietarioTipo[],
        ),
        busca: paramBusca(sp.busca),
      },
      paramPagina(sp.pagina),
    ),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Societário"
        eyebrow="Departamento"
        description="Abertura, alteração contratual e encerramento de empresa, por checklist de etapas."
        actions={
          <Link
            href={`/societario/novo${empresaId ? `?empresa=${empresaId}` : ""}`}
            className={buttonVariants({ size: "sm" })}
          >
            <Plus className="size-4" />
            Novo processo
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile valor={resumo.processosAbertos} label="processos em aberto" />
        <StatTile valor={resumo.aguardandoOrgao} label="aguardando órgão" />
        <StatTile valor={resumo.concluidosMes} label="concluídos no mês" />
      </div>

      <ProcessosSocietariosList pagina={pagina} />
    </div>
  );
}
