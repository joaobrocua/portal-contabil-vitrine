import Link from "next/link";

import { cn } from "@/core/lib/cn";

export interface TabItem {
  label: string;
  href: string;
  active?: boolean;
  badge?: string | number;
  muted?: boolean;
}

export function TabNav({ items }: { items: TabItem[] }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-line)]">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 font-display text-sm font-medium tracking-tight transition-colors",
            t.active
              ? "border-[var(--color-carmine)] text-[var(--color-text)]"
              : "border-transparent text-[var(--color-text-dim)] hover:text-[var(--color-text)]",
            t.muted && !t.active && "text-[var(--color-text-faint)]",
          )}
        >
          {t.label}
          {t.badge != null ? (
            <span className="data rounded-full bg-[var(--color-surface-3)] px-1.5 text-xs text-[var(--color-text-dim)]">
              {t.badge}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
