import Link from "next/link";

import { cn } from "@/core/lib/cn";
import type { GradeLinha } from "../queries";
import { ESTADO_COR } from "./status-badge";

const MESES = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MESES_FULL = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** Grade empresa × mês. Cada célula: verde / amarelo / vermelho / vazio. */
export function GradeAnual({
  linhas,
  ano,
}: {
  linhas: GradeLinha[];
  ano: number;
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-line)] bg-[var(--color-surface-1)]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--color-surface-2)] px-3 py-2 text-left font-display text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
              Empresa
            </th>
            {MESES.map((m, i) => (
              <th
                key={i}
                className="w-9 bg-[var(--color-surface-2)] py-2 text-center font-display text-[0.7rem] font-semibold uppercase text-[var(--color-text-faint)]"
                title={MESES_FULL[i]}
              >
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr
              key={l.empresa.id}
              className="border-t border-[var(--color-line-soft)]"
            >
              <td className="sticky left-0 z-10 max-w-[220px] truncate bg-[var(--color-surface-1)] px-3 py-1.5">
                <Link
                  href={`/empresas/${l.empresa.id}?aba=fiscal`}
                  className="text-[var(--color-text)] hover:text-[var(--color-carmine-bright)]"
                >
                  {l.empresa.nome}
                </Link>
              </td>
              {l.meses.map((c) => {
                const comp = `${ano}-${String(c.mes).padStart(2, "0")}`;
                const cell = (
                  <span
                    className={cn(
                      "mx-auto block size-5 rounded-[4px]",
                      ESTADO_COR[c.estado],
                      c.estado === "vazio" && "opacity-40",
                    )}
                    title={
                      c.total === 0
                        ? `${MESES_FULL[c.mes - 1]}: sem obrigações`
                        : `${MESES_FULL[c.mes - 1]}: ${c.ok}/${c.total} concluídas${
                            c.atraso ? ` · ${c.atraso} atrasada(s)` : ""
                          }`
                    }
                  />
                );
                return (
                  <td key={c.mes} className="p-1 text-center">
                    {c.total > 0 ? (
                      <Link
                        href={`/fiscal?empresa=${l.empresa.id}&competencia=${comp}`}
                        className="block hover:brightness-110"
                      >
                        {cell}
                      </Link>
                    ) : (
                      cell
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
