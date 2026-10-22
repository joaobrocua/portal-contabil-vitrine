import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { paramBusca, paramPagina } from "@/core/lib/paginacao";
import { paramEnum, paramUuid } from "@/core/lib/search-params";
import { FUNCIONARIO_STATUS_LABEL, type FuncionarioStatus } from "@/core/types/domain";
import { buttonVariants, PageHeader } from "@/core/ui";
import { FuncionariosList, paginarFuncionarios } from "@/modules/pessoal";

export const metadata = { title: "Funcionários" };

export default async function FuncionariosPage({
  searchParams,
}: PageProps<"/pessoal/funcionarios">) {
  assertModuleEnabled("pessoal");
  await requireRole("admin", "pessoal");
  const sp = await searchParams;
  const empresaId = paramUuid(sp.empresa);

  const status = paramEnum(sp.status, Object.keys(FUNCIONARIO_STATUS_LABEL) as FuncionarioStatus[]);

  const pagina = await paginarFuncionarios(
    { empresaId, status: status ?? "todos", busca: paramBusca(sp.busca) },
    paramPagina(sp.pagina),
  );
  const filtrando = !!(status || sp.busca);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Funcionários"
        eyebrow="Departamento Pessoal"
        description={
          filtrando
            ? "Funcionários que batem com o filtro."
            : `${pagina.total.toLocaleString("pt-BR")} ${
                pagina.total === 1 ? "funcionário cadastrado" : "funcionários cadastrados"
              }`
        }
        actions={
          <>
            <Link href="/pessoal" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ArrowLeft className="size-4" />
              Voltar
            </Link>
            <Link
              href={`/pessoal/funcionarios/novo${empresaId ? `?empresa=${empresaId}` : ""}`}
              className={buttonVariants({ size: "sm" })}
            >
              <Plus className="size-4" />
              Novo funcionário
            </Link>
          </>
        }
      />
      <FuncionariosList pagina={pagina} mostrarEmpresa={!empresaId} />
    </div>
  );
}
