import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { requireRole } from "@/core/auth/session";
import { paramMes } from "@/core/lib/search-params";
import { hojeISO } from "@/core/lib/format";
import { PAPEIS_INTERNOS } from "@/core/types/domain";
import { buttonVariants, PageHeader } from "@/core/ui";
import { itensDoPeriodo, MonthGrid, NovoEventoForm } from "@/modules/agenda";
import { empresasParaSelecao } from "@/modules/tarefas";

export const metadata = { title: "Agenda & Prazos" };

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default async function AgendaPage({
  searchParams,
}: PageProps<"/agenda">) {
  await requireRole(...PAPEIS_INTERNOS);
  const sp = await searchParams;

  // ?mes=AAAA-MM; inválido (ex.: 2026-13, que virava a data "2026-13-01"
  // e derrubava a página) cai no mês atual.
  const [ano, mes] = (paramMes(sp.mes) ?? hojeISO().slice(0, 7))
    .split("-")
    .map(Number);

  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(
    new Date(ano, mes, 0).getDate(),
  ).padStart(2, "0")}`;

  const [itens, empresas] = await Promise.all([
    itensDoPeriodo(inicio, fim),
    empresasParaSelecao(),
  ]);

  const prev = new Date(ano, mes - 2, 1);
  const next = new Date(ano, mes, 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda & Prazos"
        description="Prazos de tarefas, obrigações, reuniões e lembretes do escritório."
        actions={
          <div className="flex items-center gap-1">
            <Link
              href={`/agenda?mes=${fmt(prev)}`}
              className={buttonVariants({ variant: "outline", size: "icon" })}
            >
              <ChevronLeft className="size-4" />
            </Link>
            <span className="min-w-40 text-center text-sm font-medium">
              {MESES[mes - 1]} / {ano}
            </span>
            <Link
              href={`/agenda?mes=${fmt(next)}`}
              className={buttonVariants({ variant: "outline", size: "icon" })}
            >
              <ChevronRight className="size-4" />
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <MonthGrid ano={ano} mes={mes} itens={itens} />
        <NovoEventoForm empresas={empresas} />
      </div>
    </div>
  );
}
