import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/core/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral:
          "bg-[var(--color-surface-3)] text-[var(--color-text-dim)]",
        brand: "bg-[var(--color-azul-tint)] text-[var(--color-azul-bright)]",
        gold: "bg-[var(--color-ouro-tint)] text-[var(--color-ouro-bright)]",
        success: "bg-[var(--color-ok-tint)] text-[var(--color-ok)]",
        warning: "bg-[var(--color-ouro-tint)] text-[var(--color-ouro-bright)]",
        danger: "bg-[var(--color-carmine-tint)] text-[var(--color-carmine-bright)]",
        info: "bg-[var(--color-info-tint)] text-[var(--color-info)]",
      },
      shape: {
        pill: "rounded-full",
        stamp:
          "rounded-[3px] font-display font-semibold uppercase tracking-[0.06em]",
      },
    },
    defaultVariants: { tone: "neutral", shape: "pill" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, shape, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, shape }), className)} {...props} />
  );
}

/** Status em forma de carimbo — telas de detalhe. */
export function StatusStamp({
  label,
  tone = "brand",
  className,
}: {
  label: string;
  tone?: BadgeProps["tone"];
  className?: string;
}) {
  return (
    <span
      className={cn(
        badgeVariants({ tone, shape: "stamp" }),
        "border border-white/10 px-2.5 py-1 text-[0.7rem]",
        className,
      )}
    >
      {label}
    </span>
  );
}

export { badgeVariants };
