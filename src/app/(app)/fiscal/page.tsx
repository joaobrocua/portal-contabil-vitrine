import Link from "next/link";
import { ChevronLeft, ChevronRight, Grid3x3, Plus, Repeat } from "lucide-react";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { paramBusca, paramPagina } from "@/core/lib/paginacao";
import { paramEnum, paramMes, paramUuid } from "@/core/lib/search-params";
import { OBRIGACAO_STATUS_LABEL, type ObrigacaoStatus } from "@/core/types/domain";
import { competenciaAtual, formatCompetencia } from "@/core/lib/format";
import { buttonVariants, PageHeader } from "@/core/ui";
import {
  GerarCompetencia,
  paginarObrigacoes,
  ObrigacoesList,
} from "@/modules/fiscal";

export const metadata = { title: "Fiscal" };

function shiftComp(comp: string, delta: number) {
  const [a, m] = comp.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function FiscalPage({
  searchParams,
}: PageProps<"/fiscal">) {
  assertModuleEnabled("fiscal");
  await requireRole("admin", "fiscal");
  const sp = await searchParams;

  const compParam = paramMes(sp.competencia) ?? competenciaAtual().slice(0, 7);
  const competencia = `${compParam}-01`;
  const empresaId = paramUuid(sp.empresa);

  const status =
    sp.status === "todos"
      ? undefined
      : (paramEnum(sp.status, [
          "atrasadas",
          ...(Object.keys(OBRIGACAO_STATUS_LABEL) as ObrigacaoStatus[]),
        ]) ?? "abertas");

  const pagina = await paginarObrigacoes(
    { competencia, empresaId, status, busca: paramBusca(sp.busca) },
    paramPagina(sp.pagina),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fiscal"
        eyebrow="Departamento"
        description="Obrigações da competência, grade anual e recorrências."
        actions={
          <>
            <Link
              href="/fiscal/grade"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Grid3x3 className="size-4" />
              Grade anual
            </Link>
            <Link
              href="/fiscal/recorrencias"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Repeat className="size-4" />
              Recorrências
            </Link>
            <Link
              href={`/fiscal/nova?competencia=${compParam}`}
              className={buttonVariants({ size: "sm" })}
            >
              <Plus className="size-4" />
              Nova obrigação
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link
            href={`/fiscal?competencia=${shiftComp(compParam, -1)}`}
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-44 text-center font-display text-sm font-semibold capitalize text-[var(--color-text)]">
            {formatCompetencia(competencia)}
          </span>
          <Link
            href={`/fiscal?competencia=${shiftComp(compParam, 1)}`}
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <GerarCompetencia competencia={competencia} />
      </div>

      <ObrigacoesList pagina={pagina} />
    </div>
  );
}
