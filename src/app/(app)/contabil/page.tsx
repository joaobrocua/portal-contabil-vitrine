import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { paramPagina } from "@/core/lib/paginacao";
import { paramMes, paramUuid } from "@/core/lib/search-params";
import { competenciaAtual, formatCompetencia } from "@/core/lib/format";
import { buttonVariants, PageHeader } from "@/core/ui";
import { AbrirFechamentos, FechamentosList, paginarFechamentos } from "@/modules/contabil";

export const metadata = { title: "Contábil" };

function shiftComp(comp: string, delta: number) {
  const [a, m] = comp.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ContabilPage({
  searchParams,
}: PageProps<"/contabil">) {
  assertModuleEnabled("contabil");
  await requireRole("admin", "contabil");
  const sp = await searchParams;

  const compParam =
    paramMes(sp.competencia) ?? competenciaAtual().slice(0, 7);
  const competencia = `${compParam}-01`;
  const empresaId = paramUuid(sp.empresa);

  const pagina = await paginarFechamentos({ competencia, empresaId }, paramPagina(sp.pagina));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contábil"
        eyebrow="Departamento"
        description="Fechamento de cada empresa por competência: conciliação, escrituração, balancete e entrega."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link
            href={`/contabil?competencia=${shiftComp(compParam, -1)}`}
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-44 text-center font-display text-sm font-semibold capitalize text-[var(--color-text)]">
            {formatCompetencia(competencia)}
          </span>
          <Link
            href={`/contabil?competencia=${shiftComp(compParam, 1)}`}
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <AbrirFechamentos competencia={competencia} />
      </div>

      <FechamentosList pagina={pagina} />
    </div>
  );
}
