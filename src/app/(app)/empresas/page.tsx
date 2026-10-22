import Link from "next/link";
import { Plus } from "lucide-react";

import { requireRole } from "@/core/auth/session";
import { paramBusca, paramPagina } from "@/core/lib/paginacao";
import { cn } from "@/core/lib/cn";
import { PAPEIS_INTERNOS } from "@/core/types/domain";
import { buttonVariants, PageHeader } from "@/core/ui";
import {
  diagnosticarEmpresas,
  EmpresasTable,
  contarEmpresas,
  paginarEmpresas,
  PendenciasView,
} from "@/modules/empresas";

export const metadata = { title: "Clientes & Empresas" };

type View = "lista" | "pendencias";

export default async function EmpresasPage({
  searchParams,
}: PageProps<"/empresas">) {
  await requireRole(...PAPEIS_INTERNOS);
  const sp = await searchParams;
  const view: View = sp.view === "pendencias" ? "pendencias" : "lista";

  const [contagem, pagina, diagnostico] = await Promise.all([
    contarEmpresas(),
    view === "lista"
      ? paginarEmpresas(
          { busca: paramBusca(sp.busca), incluirInativas: sp.inativas === "1" },
          paramPagina(sp.pagina),
        )
      : null,
    view === "pendencias" ? diagnosticarEmpresas() : Promise.resolve([]),
  ]);

  const comPendencia = diagnostico.filter((d) => d.pendencias.length > 0).length;
  const nAtivas = contagem.ativas;
  const nInativas = contagem.total - contagem.ativas;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes & Empresas"
        eyebrow="Cadastro"
        description={`${nAtivas} ${nAtivas === 1 ? "empresa ativa" : "empresas ativas"}${
          nInativas > 0 ? ` · ${nInativas} ${nInativas === 1 ? "inativa" : "inativas"}` : ""
        }`}
        actions={
          <Link href="/empresas/nova" className={buttonVariants()}>
            <Plus className="size-4" />
            Nova empresa
          </Link>
        }
      />

      <div className="inline-flex rounded-[var(--radius)] border border-[var(--color-line)] bg-[var(--color-surface-1)] p-0.5 text-sm">
        <Link
          href="/empresas"
          className={cn(
            "rounded-[calc(var(--radius)-2px)] px-3 py-1.5 font-display font-medium transition-colors",
            view === "lista"
              ? "bg-[var(--color-surface-3)] text-[var(--color-text)]"
              : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]",
          )}
        >
          Lista
        </Link>
        <Link
          href="/empresas?view=pendencias"
          className={cn(
            "flex items-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-3 py-1.5 font-display font-medium transition-colors",
            view === "pendencias"
              ? "bg-[var(--color-surface-3)] text-[var(--color-text)]"
              : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]",
          )}
        >
          Pendências
          {view === "pendencias" && comPendencia > 0 ? (
            <span className="rounded-full bg-[var(--color-carmine-tint)] px-1.5 text-xs text-[var(--color-carmine-bright)]">
              {comPendencia}
            </span>
          ) : null}
        </Link>
      </div>

      {view === "lista" ? (
        pagina ? <EmpresasTable pagina={pagina} nInativas={nInativas} /> : null
      ) : (
        <PendenciasView dados={diagnostico} />
      )}
    </div>
  );
}
