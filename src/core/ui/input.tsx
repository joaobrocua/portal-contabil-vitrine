import * as React from "react";

import { cn } from "@/core/lib/cn";

const fieldBase =
  "flex h-9 w-full rounded-[var(--radius)] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-1 text-sm text-[var(--color-text)] transition-colors placeholder:text-[var(--color-text-faint)] focus-visible:outline-none focus-visible:border-[var(--color-carmine)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-carmine)_25%,transparent)] disabled:cursor-not-allowed disabled:opacity-50";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldBase, className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(fieldBase, "h-auto min-h-20 py-2", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(fieldBase, "cursor-pointer pr-8", className)}
    {...props}
  />
));
Select.displayName = "Select";

export { fieldBase };
