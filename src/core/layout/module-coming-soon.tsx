import { MODULES, type ModuleId } from "@/core/config/modules";
import { Card, CardContent, ModuleIcon, PageHeader, Wing } from "@/core/ui";

/** Placeholder para módulos ainda não liberados (V2/V3). */
export function ModuleComingSoon({ id }: { id: ModuleId }) {
  const mod = MODULES[id];
  return (
    <div className="space-y-6">
      <PageHeader title={mod.label} eyebrow={`Fase ${mod.fase}`} description={mod.descricao} />
      <Card className="relative overflow-hidden">
        <Wing className="pointer-events-none absolute -right-8 -top-6 h-40 text-[var(--color-ouro)] opacity-[0.05]" />
        <CardContent className="relative flex flex-col items-center gap-4 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-[var(--color-carmine-tint)] text-[var(--color-carmine-bright)]">
            <ModuleIcon name={mod.icon} className="size-7" />
          </span>
          <div className="space-y-1">
            <p className="font-display text-lg font-semibold text-[var(--color-text)]">
              Disponível na V{mod.fase}
            </p>
            <p className="max-w-md text-sm text-[var(--color-text-dim)]">
              Este módulo faz parte da próxima etapa do roadmap. A estrutura de
              dados e o registro do módulo já estão preparados — falta a
              interface.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
