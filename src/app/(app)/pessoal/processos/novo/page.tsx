import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { paramUuid } from "@/core/lib/search-params";
import { listarColaboradores } from "@/core/auth/profiles";
import { PageHeader } from "@/core/ui";
import {
  empresasParaPessoal,
  EventoDpForm,
  funcionariosParaSelecao,
} from "@/modules/pessoal";

export const metadata = { title: "Novo processo — Departamento Pessoal" };

export default async function NovoProcessoPage({
  searchParams,
}: PageProps<"/pessoal/processos/novo">) {
  assertModuleEnabled("pessoal");
  await requireRole("admin", "pessoal");
  const sp = await searchParams;
  const empresaId = paramUuid(sp.empresa);
  const funcionarioId =
    paramUuid(sp.funcionario);

  const [empresas, funcionarios, responsaveis] = await Promise.all([
    empresasParaPessoal(),
    funcionariosParaSelecao(empresaId),
    listarColaboradores(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Novo processo" eyebrow="Departamento Pessoal" />
      <EventoDpForm
        empresas={empresas}
        funcionarios={funcionarios}
        responsaveis={responsaveis}
        empresaFixaId={empresaId}
        funcionarioInicialId={funcionarioId}
      />
    </div>
  );
}
