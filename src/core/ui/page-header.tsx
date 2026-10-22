import * as React from "react";

import { cn } from "@/core/lib/cn";
import { WingTick } from "./wing";

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          {eyebrow ? (
            <p className="eyebrow flex items-center gap-1.5">
              <WingTick className="h-3 w-4 text-[var(--color-ouro)]" />
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-display text-[1.7rem] font-bold leading-tight tracking-tight text-[var(--color-text)]">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm text-[var(--color-text-dim)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <hr className="rule-gold" />
    </div>
  );
}
