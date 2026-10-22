import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { paramMes } from "@/core/lib/search-params";
import { competenciaAtual, formatCompetencia } from "@/core/lib/format";
import { buttonVariants, PageHeader } from "@/core/ui";
import { AbrirFolhas, FolhasList, listFolhas } from "@/modules/pessoal";

export const metadata = { title: "Folhas — Departamento Pessoal" };

function shiftComp(comp: string, delta: number) {
  const [a, m] = comp.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function FolhasPage({
  searchParams,
}: PageProps<"/pessoal/folhas">) {
  assertModuleEnabled("pessoal");
  await requireRole("admin", "pessoal");
  const sp = await searchParams;

  const compParam =
    paramMes(sp.competencia) ?? competenciaAtual().slice(0, 7);
  const competencia = `${compParam}-01`;

  const folhas = await listFolhas({ competencia });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controle de folha"
        eyebrow="Departamento Pessoal"
        description="Uma folha por empresa e competência, com status de processamento."
        actions={
          <Link href="/pessoal" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link
            href={`/pessoal/folhas?competencia=${shiftComp(compParam, -1)}`}
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-44 text-center font-display text-sm font-semibold capitalize text-[var(--color-text)]">
            {formatCompetencia(competencia)}
          </span>
          <Link
            href={`/pessoal/folhas?competencia=${shiftComp(compParam, 1)}`}
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <AbrirFolhas competencia={competencia} />
      </div>

      <FolhasList folhas={folhas} />
    </div>
  );
}
