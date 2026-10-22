import { notFound } from "next/navigation";

import { requireRole } from "@/core/auth/session";
import { listarColaboradores } from "@/core/auth/profiles";
import { PAPEIS_INTERNOS } from "@/core/types/domain";
import { PageHeader } from "@/core/ui";
import { empresasParaSelecao, getTarefa, TarefaForm } from "@/modules/tarefas";

export const metadata = { title: "Editar tarefa" };

export default async function EditarTarefaPage({
  params,
}: PageProps<"/tarefas/[id]/editar">) {
  await requireRole(...PAPEIS_INTERNOS);
  const { id } = await params;
  const [tarefa, empresas, responsaveis] = await Promise.all([
    getTarefa(id),
    empresasParaSelecao(),
    listarColaboradores(),
  ]);
  if (!tarefa) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Editar tarefa" description={tarefa.titulo} />
      <TarefaForm
        tarefa={tarefa}
        empresas={empresas}
        responsaveis={responsaveis}
      />
    </div>
  );
}
