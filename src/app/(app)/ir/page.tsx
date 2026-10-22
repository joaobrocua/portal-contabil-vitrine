import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { paramBusca, paramPagina } from "@/core/lib/paginacao";
import { paramAno, paramEnum, paramUuid } from "@/core/lib/search-params";
import { IR_TIPO_LABEL, type IrTipo } from "@/core/types/domain";
import { hojeISO } from "@/core/lib/format";
import { buttonVariants, Card, CardContent, PageHeader } from "@/core/ui";
import { contarIr, DeclaracoesIrList, GerarDeclaracoesIr, paginarDeclaracoesIr } from "@/modules/ir";

export const metadata = { title: "Imposto de Renda" };

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

export default async function IrPage({ searchParams }: PageProps<"/ir">) {
  assertModuleEnabled("ir");
  await requireRole("admin", "fiscal", "contabil");
  const sp = await searchParams;

  const anoAtual = Number(hojeISO().slice(0, 4));
  const ano = paramAno(sp.ano) ?? anoAtual;
  const empresaId = paramUuid(sp.empresa);

  const [resumo, pagina] = await Promise.all([
    contarIr(),
    paginarDeclaracoesIr(
      {
        ano,
        empresaId,
        status: sp.status === "todos" ? undefined : "abertas",
        tipo: paramEnum(sp.tipo, Object.keys(IR_TIPO_LABEL) as IrTipo[]),
        busca: paramBusca(sp.busca),
      },
      paramPagina(sp.pagina),
    ),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Imposto de Renda"
        eyebrow="Departamento"
        description="Campanhas de IRPF, IRPJ e ITR por exercício, com controle por cliente."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile valor={resumo.pendentes} label="pendentes" />
        <StatTile valor={resumo.atrasadas} label="atrasadas" />
        <StatTile valor={resumo.entreguesAno} label="entregues neste ano" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link
            href={`/ir?ano=${ano - 1}`}
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-24 text-center font-display text-sm font-semibold text-[var(--color-text)]">
            Exercício {ano}
          </span>
          <Link
            href={`/ir?ano=${ano + 1}`}
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <GerarDeclaracoesIr ano={ano} />
      </div>

      <DeclaracoesIrList pagina={pagina} />
    </div>
  );
}
