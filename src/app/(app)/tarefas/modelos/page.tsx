import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireRole } from "@/core/auth/session";
import { buttonVariants, PageHeader } from "@/core/ui";
import { listModelos, ModelosPanel } from "@/modules/tarefas";

export const metadata = { title: "Modelos de tarefa" };

export default async function ModelosTarefaPage() {
  await requireRole("admin");
  const modelos = await listModelos();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modelos de tarefa"
        eyebrow="Tarefas"
        description="Tarefas que se repetem, com checklist pronto. Quem cria a tarefa escolhe o modelo e ajusta o que precisar."
        actions={
          <Link
            href="/tarefas"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        }
      />
      <ModelosPanel modelos={modelos} />
    </div>
  );
}
