import * as React from "react";

import { cn } from "@/core/lib/cn";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-sm font-medium text-neutral-700 select-none",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";

/** O campo dentro do Field tem `required`? (input/select/textarea direto). */
function filhoObrigatorio(children: React.ReactNode): boolean {
  return React.Children.toArray(children).some(
    (c) =>
      React.isValidElement<{ required?: boolean }>(c) && c.props.required === true,
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  obrigatorio,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  /**
   * Mostra o * vermelho. Por padrão, liga sozinho quando o campo dentro tem
   * `required`; passe `true` para campo sempre preenchido que não usa
   * `required` (ex. select que já vem com um valor escolhido).
   */
  obrigatorio?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const marcar = obrigatorio ?? filhoObrigatorio(children);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {marcar ? (
          <span className="ml-0.5 text-[var(--color-carmine-bright)]" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {hint && !error ? (
        <p className="text-xs text-neutral-400">{hint}</p>
      ) : null}
      {error ? <p className="text-xs text-[var(--color-carmine-bright)]">{error}</p> : null}
    </div>
  );
}
