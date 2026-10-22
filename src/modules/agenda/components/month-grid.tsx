import { cn } from "@/core/lib/cn";
import { hojeISO } from "@/core/lib/format";

import { EventoChip } from "./evento-chip";
import type { ItemAgenda } from "../queries";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function MonthGrid({
  ano,
  mes, // 1-12
  itens,
}: {
  ano: number;
  mes: number;
  itens: ItemAgenda[];
}) {
  const primeiro = new Date(ano, mes - 1, 1);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const offset = primeiro.getDay();
  const hoje = hojeISO();

  const porDia = new Map<string, ItemAgenda[]>();
  for (const it of itens) {
    const arr = porDia.get(it.data) ?? [];
    arr.push(it);
    porDia.set(it.data, arr);
  }

  const celulas: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];
  while (celulas.length % 7 !== 0) celulas.push(null);

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-[var(--color-surface)]">
      <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {DIAS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {celulas.map((dia, i) => {
          if (dia === null)
            return <div key={i} className="min-h-24 border-b border-r border-neutral-100 bg-neutral-50/40" />;
          const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
          const doDia = porDia.get(iso) ?? [];
          const isHoje = iso === hoje;
          return (
            <div
              key={i}
              className="min-h-24 space-y-1 border-b border-r border-neutral-100 p-1.5"
            >
              <div
                className={cn(
                  "text-xs font-medium",
                  isHoje
                    ? "inline-grid size-5 place-items-center rounded-full bg-brand text-white"
                    : "text-neutral-500",
                )}
              >
                {dia}
              </div>
              {doDia.slice(0, 4).map((it) => (
                <EventoChip key={it.id} item={it} />
              ))}
              {doDia.length > 4 ? (
                <p className="px-1.5 text-[10px] text-neutral-400">
                  +{doDia.length - 4} mais
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
