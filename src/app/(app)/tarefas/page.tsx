import Link from "next/link";
import { LayoutTemplate, Plus } from "lucide-react";

import { requireRole } from "@/core/auth/session";
import { paramBusca, paramPagina } from "@/core/lib/paginacao";
import { paramEnum, paramUuid } from "@/core/lib/search-params";
import { PAPEIS_INTERNOS, type Departamento, type TarefaStatus } from "@/core/types/domain";
import { buttonVariants, PageHeader } from "@/core/ui";
import { paginarTarefas, TarefasList } from "@/modules/tarefas";

export const metadata = { title: "Tarefas & Processos" };

const STATUS = [
  "abertas", "todos", "nao_iniciada", "em_andamento", "aguardando_cliente",
  "em_revisao", "concluida", "atrasada", "cancelada",
] as const;
const DEPARTAMENTOS = ["fiscal", "pessoal", "contabil", "societario", "ir", "atendimento", "geral"] as const;

export default async function TarefasPage({
  searchParams,
}: PageProps<"/tarefas">) {
  const session = await requireRole(...PAPEIS_INTERNOS);
  const sp = await searchParams;
  const status = paramEnum(sp.status, STATUS) ?? "abertas";

  const pagina = await paginarTarefas(
    {
      status: status === "todos" ? undefined : (status as TarefaStatus | "abertas"),
      departamento: paramEnum(sp.dep, DEPARTAMENTOS) as Departamento | undefined,
      empresaId: paramUuid(sp.empresa),
      busca: paramBusca(sp.busca),
    },
    paramPagina(sp.pagina),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tarefas & Processos"
        description="Toda atividade do escritório vira uma tarefa, com checklist, prazo e histórico."
        actions={
          <>
            {session.profile.papel === "admin" ? (
              <Link
                href="/tarefas/modelos"
                className={buttonVariants({ variant: "outline" })}
              >
                <LayoutTemplate className="size-4" />
                Modelos
              </Link>
            ) : null}
            <Link href="/tarefas/nova" className={buttonVariants()}>
              <Plus className="size-4" />
              Nova tarefa
            </Link>
          </>
        }
      />
      <TarefasList pagina={pagina} />
    </div>
  );
}
