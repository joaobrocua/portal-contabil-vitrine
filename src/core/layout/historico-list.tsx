import { formatDataHora } from "@/core/lib/format";
import type { HistoricoComAutor } from "@/core/lib/historico";
import { EmptyState } from "@/core/ui";

export function HistoricoList({ itens }: { itens: HistoricoComAutor[] }) {
  if (itens.length === 0) {
    return (
      <EmptyState
        title="Sem registros"
        description="As ações realizadas aparecerão aqui."
      />
    );
  }

  return (
    <ol className="relative ml-1 space-y-4 border-l border-[var(--color-line)]">
      {itens.map((h) => (
        <li key={h.id} className="relative pl-5">
          <span className="absolute -left-[4.5px] top-[0.55rem] size-2 rounded-full bg-[var(--color-ouro)] ring-4 ring-[var(--color-surface-1)]" />
          <p className="text-sm text-[var(--color-text)]">{h.descricao}</p>
          {h.campo && (h.de || h.para) ? (
            <p className="text-xs text-[var(--color-text-dim)]">
              {h.campo}: <span className="line-through">{h.de ?? "—"}</span> →{" "}
              <span className="font-medium text-[var(--color-text)]">
                {h.para ?? "—"}
              </span>
            </p>
          ) : null}
          <p className="data mt-0.5 text-xs text-[var(--color-text-faint)]">
            {formatDataHora(h.created_at)}
            {h.autor?.nome ? ` · ${h.autor.nome}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
