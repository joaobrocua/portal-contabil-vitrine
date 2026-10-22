import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";

import { cn } from "@/core/lib/cn";
import { formatCNPJ } from "@/core/lib/format";
import { REGIME_LABEL, type RegimeTributario } from "@/core/types/domain";
import { Badge, Card, CardContent } from "@/core/ui";

import type { DiagnosticoEmpresa, Severidade } from "../diagnostico";
import { EmDiaSection } from "./em-dia-section";

const DOT: Record<Severidade, string> = {
  alta: "bg-[var(--color-carmine)]",
  media: "bg-[var(--color-ouro)]",
  baixa: "bg-[var(--color-text-faint)]",
};

function EmpresaCard({ d }: { d: DiagnosticoEmpresa }) {
  const alta = d.pendencias.filter((p) => p.severidade === "alta").length;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line-soft)] px-5 py-3">
        <div className="min-w-0">
          <Link
            href={`/empresas/${d.empresa.id}`}
            className="font-display text-sm font-semibold text-[var(--color-text)] hover:text-[var(--color-carmine-bright)]"
          >
            {d.empresa.nome_fantasia || d.empresa.razao_social}
          </Link>
          <p className="data text-xs text-[var(--color-text-faint)]">
            {formatCNPJ(d.empresa.cnpj)} ·{" "}
            {REGIME_LABEL[d.empresa.regime_tributario as RegimeTributario]}
          </p>
        </div>
        <Badge tone={alta > 0 ? "danger" : "warning"}>
          {d.pendencias.length}{" "}
          {d.pendencias.length === 1 ? "pendência" : "pendências"}
        </Badge>
      </div>
      <ul className="divide-y divide-[var(--color-line-soft)]">
        {d.pendencias.map((p) => (
          <li
            key={p.chave}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2.5"
          >
            <span
              className={cn("size-2 shrink-0 rounded-full", DOT[p.severidade])}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[var(--color-text)]">{p.titulo}</p>
              {p.detalhe ? (
                <p className="text-xs text-[var(--color-text-dim)]">
                  {p.detalhe}
                </p>
              ) : null}
            </div>
            <Link
              href={p.href}
              className="inline-flex items-center gap-1 rounded-[var(--radius)] bg-[var(--color-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-carmine-tint)] hover:text-[var(--color-carmine-bright)]"
            >
              {p.cta}
              <ArrowRight className="size-3" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PendenciasView({ dados }: { dados: DiagnosticoEmpresa[] }) {
  const comPendencia = dados.filter((d) => d.pendencias.length > 0);
  const emDia = dados.filter((d) => d.pendencias.length === 0);
  const totalPendencias = comPendencia.reduce(
    (s, d) => s + d.pendencias.length,
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="flex items-center gap-2 text-[var(--color-text-dim)]">
          <CircleAlert className="size-4 text-[var(--color-carmine)]" />
          <strong className="font-display text-[var(--color-text)]">
            {comPendencia.length}
          </strong>{" "}
          {comPendencia.length === 1
            ? "empresa com pendências"
            : "empresas com pendências"}{" "}
          ({totalPendencias} {totalPendencias === 1 ? "item" : "itens"})
        </span>
        <span className="flex items-center gap-2 text-[var(--color-text-dim)]">
          <CheckCircle2 className="size-4 text-[var(--color-ok)]" />
          <strong className="font-display text-[var(--color-text)]">
            {emDia.length}
          </strong>{" "}
          em dia
        </span>
      </div>

      {comPendencia.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CheckCircle2 className="size-8 text-[var(--color-ok)]" />
            <p className="font-display font-semibold text-[var(--color-text)]">
              Tudo em dia
            </p>
            <p className="text-sm text-[var(--color-text-dim)]">
              Nenhuma empresa com pendências de cadastro, documentos ou tarefas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {comPendencia.map((d) => (
            <EmpresaCard key={d.empresa.id} d={d} />
          ))}
        </div>
      )}

      {emDia.length > 0 ? <EmDiaSection empresas={emDia.map((d) => d.empresa)} /> : null}
    </div>
  );
}
