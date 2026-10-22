import * as React from "react";

import { cn } from "@/core/lib/cn";
import { Wing } from "./wing";

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-[var(--radius)] border border-dashed border-[var(--color-line)] bg-[var(--color-surface-1)] px-6 py-12 text-center",
        className,
      )}
    >
      <Wing className="pointer-events-none absolute -right-6 -top-4 h-28 text-[var(--color-ouro)] opacity-[0.06]" />
      {icon ? (
        <div className="relative text-[var(--color-text-faint)]">{icon}</div>
      ) : null}
      <div className="relative space-y-1">
        <p className="font-display font-semibold text-[var(--color-text)]">
          {title}
        </p>
        {description ? (
          <p className="max-w-sm text-sm text-[var(--color-text-dim)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="relative">{action}</div> : null}
    </div>
  );
}
