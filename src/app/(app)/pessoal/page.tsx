import Link from "next/link";
import { CalendarClock, ClipboardList, Users } from "lucide-react";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { Card, CardContent, PageHeader } from "@/core/ui";
import { paramBusca, paramPagina } from "@/core/lib/paginacao";
import { paramEnum } from "@/core/lib/search-params";
import { EVENTO_DP_TIPO_LABEL, type EventoDpTipo } from "@/core/types/domain";
import { contarPessoal, EventosDpList, paginarEventosDp } from "@/modules/pessoal";

export const metadata = { title: "Departamento Pessoal" };

function Atalho({
  href,
  icon: Icon,
  titulo,
  valor,
  legenda,
}: {
  href: string;
  icon: typeof Users;
  titulo: string;
  valor: number;
  legenda: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-transform hover:-translate-y-0.5">
        <CardContent className="flex items-center gap-4">
          <span className="grid size-11 place-items-center rounded-[var(--radius)] bg-[var(--color-carmine-tint)] text-[var(--color-carmine-bright)]">
            <Icon className="size-5" />
          </span>
          <div>
            <p className="stat text-2xl text-[var(--color-text)]">{valor}</p>
            <p className="text-xs text-[var(--color-text-dim)]">{legenda}</p>
          </div>
          <span className="ml-auto font-display text-sm text-[var(--color-text-dim)]">
            {titulo} →
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function PessoalPage({ searchParams }: PageProps<"/pessoal">) {
  assertModuleEnabled("pessoal");
  await requireRole("admin", "pessoal");
  const sp = await searchParams;

  const [resumo, processosAbertos] = await Promise.all([
    contarPessoal(),
    paginarEventosDp(
      {
        status: sp.status === "todos" ? "todos" : "abertos",
        tipo: paramEnum(sp.tipo, Object.keys(EVENTO_DP_TIPO_LABEL) as EventoDpTipo[]),
        busca: paramBusca(sp.busca),
      },
      paramPagina(sp.pagina),
    ),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departamento Pessoal"
        eyebrow="Departamento"
        description="Funcionários, processos de admissão/demissão/férias e controle de folha."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Atalho
          href="/pessoal/funcionarios"
          icon={Users}
          titulo="Funcionários"
          valor={resumo.funcionariosAtivos}
          legenda="ativos"
        />
        <Atalho
          href="/pessoal/processos"
          icon={ClipboardList}
          titulo="Processos"
          valor={resumo.processosAbertos}
          legenda="em aberto"
        />
        <Atalho
          href="/pessoal/folhas"
          icon={CalendarClock}
          titulo="Folhas"
          valor={resumo.folhasAbertas}
          legenda="em aberto"
        />
      </div>

      <div className="space-y-3">
        <p className="eyebrow">Processos em aberto</p>
        <EventosDpList pagina={processosAbertos} />
      </div>
    </div>
  );
}
