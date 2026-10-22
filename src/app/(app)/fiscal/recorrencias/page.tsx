import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { listarColaboradores } from "@/core/auth/profiles";
import { buttonVariants, PageHeader } from "@/core/ui";
import {
  empresasParaFiscal,
  listRecorrencias,
  RecorrenciasPanel,
} from "@/modules/fiscal";

export const metadata = { title: "Recorrências — Fiscal" };

export default async function RecorrenciasPage() {
  assertModuleEnabled("fiscal");
  await requireRole("admin", "fiscal");

  const [empresas, responsaveis, recorrencias] = await Promise.all([
    empresasParaFiscal(),
    listarColaboradores(),
    listRecorrencias(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Obrigações recorrentes"
        eyebrow="Fiscal"
        description="Configure o que cada empresa entrega por período. Depois, em Fiscal, use 'Gerar competência' para criar o mês inteiro de uma vez."
        actions={
          <Link
            href="/fiscal"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        }
      />
      <RecorrenciasPanel
        empresas={empresas}
        responsaveis={responsaveis}
        recorrencias={recorrencias}
      />
    </div>
  );
}
