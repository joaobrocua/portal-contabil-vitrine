import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { cn } from "@/core/lib/cn";
import { EmptyState } from "@/core/ui";

import type { DiagnosticoEmpresa, Severidade } from "../diagnostico";

const DOT: Record<Severidade, string> = {
  alta: "bg-[var(--color-carmine)]",
  media: "bg-[var(--color-ouro)]",
  baixa: "bg-[var(--color-text-faint)]",
};

/**
 * Lista compacta "empresas que precisam de atenção" — para o Dashboard.
 * Ordena por gravidade (mais itens de severidade alta primeiro).
 */
export function AtencaoList({
  dados,
  limite = 5,
}: {
  dados: DiagnosticoEmpresa[];
  limite?: number;
}) {
  const comPendencia = dados
    .filter((d) => d.pendencias.length > 0)
    .map((d) => ({
      d,
      alta: d.pendencias.filter((p) => p.severidade === "alta").length,
    }))
    .sort((a, b) => b.alta - a.alta || b.d.pendencias.length - a.d.pendencias.length);

  if (comPendencia.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="size-6 text-[var(--color-ok)]" />}
        title="Todas as empresas em dia"
        description="Nenhuma pendência de cadastro, documentos ou tarefas."
      />
    );
  }

  const visiveis = comPendencia.slice(0, limite);
  const resto = comPendencia.length - visiveis.length;

  return (
    <div className="space-y-1">
      <ul className="divide-y divide-[var(--color-line-soft)]">
        {visiveis.map(({ d, alta }) => (
          <li key={d.empresa.id}>
            <Link
              href={`/empresas/${d.empresa.id}`}
              className="flex items-center gap-3 py-3 hover:text-[var(--color-carmine-bright)]"
            >
              <span className="flex shrink-0 gap-1">
                {d.pendencias.slice(0, 4).map((p, i) => (
                  <span
                    key={i}
                    className={cn("size-2 rounded-full", DOT[p.severidade])}
                  />
                ))}
              </span>
              <span className="flex-1 truncate text-[0.95rem] text-[var(--color-text)]">
                {d.empresa.nome_fantasia || d.empresa.razao_social}
              </span>
              <span className="data shrink-0 text-sm text-[var(--color-text-faint)]">
                {d.pendencias.length}
                {alta > 0 ? (
                  <span className="text-[var(--color-carmine-bright)]">
                    {" "}
                    · {alta} urgente{alta > 1 ? "s" : ""}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/empresas?view=pendencias"
        className="inline-flex items-center gap-1 pt-1.5 text-sm font-medium text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
      >
        {resto > 0
          ? `Ver todas (${comPendencia.length})`
          : "Abrir pendências"}
        <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}
