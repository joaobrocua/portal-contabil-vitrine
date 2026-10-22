import { cn } from "@/core/lib/cn";

/**
 * Asa do caduceu — assinatura visual.
 * Traços de pena varrendo para cima/direita, derivados da marca.
 * Use como marca d'água (baixa opacidade) em cabeçalhos e telas vazias.
 */
export function Wing({
  className,
  side = "right",
}: {
  className?: string;
  side?: "left" | "right";
}) {
  return (
    <svg
      viewBox="0 0 120 90"
      className={cn(side === "left" && "-scale-x-100", className)}
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M8 82C30 74 58 60 84 34" />
        <path d="M12 66C34 60 56 48 78 24" />
        <path d="M20 52C40 47 58 37 74 18" />
        <path d="M32 40C48 36 62 28 72 14" />
        <path d="M46 30C58 27 68 21 74 12" />
      </g>
      <path
        d="M84 34C90 24 94 16 96 8"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Tique pequeno de asa antes de rótulos de seção. */
export function WingTick({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 14"
      className={cn("inline-block", className)}
      fill="none"
      aria-hidden
    >
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M2 12C7 10 12 7 17 2" />
        <path d="M3 8C7 7 11 4 14 1" />
        <path d="M6 5C9 4 12 3 14 1" />
      </g>
    </svg>
  );
}
