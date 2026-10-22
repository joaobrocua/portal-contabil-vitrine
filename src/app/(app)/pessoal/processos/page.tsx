import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { paramBusca, paramPagina } from "@/core/lib/paginacao";
import { paramEnum, paramUuid } from "@/core/lib/search-params";
import { EVENTO_DP_TIPO_LABEL, type EventoDpTipo } from "@/core/types/domain";
import { buttonVariants, PageHeader } from "@/core/ui";
import { EventosDpList, paginarEventosDp } from "@/modules/pessoal";

export const metadata = { title: "Processos — Departamento Pessoal" };

export default async function ProcessosPage({
  searchParams,
}: PageProps<"/pessoal/processos">) {
  assertModuleEnabled("pessoal");
  await requireRole("admin", "pessoal");
  const sp = await searchParams;
  const empresaId = paramUuid(sp.empresa);

  const pagina = await paginarEventosDp(
    {
      empresaId,
      status: sp.status === "todos" ? "todos" : "abertos",
      tipo: paramEnum(sp.tipo, Object.keys(EVENTO_DP_TIPO_LABEL) as EventoDpTipo[]),
      busca: paramBusca(sp.busca),
    },
    paramPagina(sp.pagina),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Processos"
        eyebrow="Departamento Pessoal"
        description="Admissões, demissões, férias, afastamentos e rescisões."
        actions={
          <>
            <Link href="/pessoal" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ArrowLeft className="size-4" />
              Voltar
            </Link>
            <Link
              href={`/pessoal/processos/novo${empresaId ? `?empresa=${empresaId}` : ""}`}
              className={buttonVariants({ size: "sm" })}
            >
              <Plus className="size-4" />
              Novo processo
            </Link>
          </>
        }
      />
      <EventosDpList pagina={pagina} />
    </div>
  );
}
