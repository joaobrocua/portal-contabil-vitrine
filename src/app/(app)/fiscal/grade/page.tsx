import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

import { assertModuleEnabled, requireRole } from "@/core/auth/session";
import { paramBusca, paramPagina } from "@/core/lib/paginacao";
import { paramAno } from "@/core/lib/search-params";
import { hojeISO } from "@/core/lib/format";
import { BuscaUrl, buttonVariants, PageHeader, Paginacao } from "@/core/ui";
import { GradeAnual, gradeAnual } from "@/modules/fiscal";

export const metadata = { title: "Grade anual — Fiscal" };

export default async function GradeFiscalPage({
  searchParams,
}: PageProps<"/fiscal/grade">) {
  assertModuleEnabled("fiscal");
  await requireRole("admin", "fiscal");
  const sp = await searchParams;
  const ano = paramAno(sp.ano) ?? Number(hojeISO().slice(0, 4));

  const busca = paramBusca(sp.busca);
  const pagina = await gradeAnual(ano, paramPagina(sp.pagina), busca);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grade anual"
        eyebrow="Fiscal"
        description="Cada célula é um mês: verde = tudo entregue, amarelo = em andamento, vermelho = há atraso. Clique para abrir."
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

      <div className="flex items-center gap-2">
        <Link
          href={`/fiscal/grade?ano=${ano - 1}`}
          className={buttonVariants({ variant: "outline", size: "icon" })}
        >
          <ChevronLeft className="size-4" />
        </Link>
        <span className="stat text-xl text-[var(--color-text)]">{ano}</span>
        <Link
          href={`/fiscal/grade?ano=${ano + 1}`}
          className={buttonVariants({ variant: "outline", size: "icon" })}
        >
          <ChevronRight className="size-4" />
        </Link>

        <div className="ml-4 flex items-center gap-3 text-xs text-[var(--color-text-dim)]">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-[3px] bg-[var(--color-ok)]" /> entregue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-[3px] bg-[var(--color-ouro)]" /> em
            andamento
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-[3px] bg-[var(--color-carmine)]" />{" "}
            atraso
          </span>
        </div>
      </div>

      <BuscaUrl placeholder="Buscar empresa…" className="max-w-sm" />

      {pagina.itens.length === 0 ? (
        <p className="text-sm text-[var(--color-text-dim)]">
          {busca ? "Nenhuma empresa ativa com esse nome." : "Nenhuma empresa ativa."}
        </p>
      ) : (
        <GradeAnual linhas={pagina.itens} ano={ano} />
      )}

      <Paginacao total={pagina.total} pagina={pagina.pagina} tamanho={pagina.tamanho} nomeItem="empresas" />
    </div>
  );
}
