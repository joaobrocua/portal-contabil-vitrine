import { requireRole } from "@/core/auth/session";
import { paramUuid } from "@/core/lib/search-params";
import { listarColaboradores } from "@/core/auth/profiles";
import { hojeISO } from "@/core/lib/format";
import { PAPEIS_INTERNOS } from "@/core/types/domain";
import { PageHeader } from "@/core/ui";
import {
  empresasParaSelecao,
  getModelo,
  listModelos,
  ModeloSelect,
  prazoDoModelo,
  TarefaForm,
} from "@/modules/tarefas";

export const metadata = { title: "Nova tarefa" };

export default async function NovaTarefaPage({
  searchParams,
}: PageProps<"/tarefas/nova">) {
  await requireRole(...PAPEIS_INTERNOS);
  const sp = await searchParams;
  const empresaFixaId = paramUuid(sp.empresa);
  const modeloId = paramUuid(sp.modelo);

  const [empresas, responsaveis, modelos, modelo] = await Promise.all([
    empresasParaSelecao(),
    listarColaboradores(),
    listModelos({ apenasAtivos: true }),
    modeloId ? getModelo(modeloId) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nova tarefa"
        description={
          modelo
            ? "Revise o que veio do modelo e ajuste o que precisar."
            : "Depois de criar, adicione o checklist de etapas na página da tarefa."
        }
      />
      {modelos.length > 0 ? (
        <ModeloSelect
          modelos={modelos.map((m) => ({ id: m.id, nome: m.nome }))}
          atual={modelo?.id}
        />
      ) : null}
      <TarefaForm
        // Remonta ao trocar de modelo: os campos usam defaultValue.
        key={modelo?.id ?? "branco"}
        empresas={empresas}
        responsaveis={responsaveis}
        empresaFixaId={empresaFixaId}
        modelo={modelo}
        prazoSugerido={prazoDoModelo(modelo?.dia_prazo ?? null, hojeISO())}
      />
    </div>
  );
}
