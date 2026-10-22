import { cn } from "@/core/lib/cn";
import { brand } from "@/core/config/brand";

/**
 * Marca do produto.
 * - `LogoMark`: ícone quadrado (caduceu — símbolo do comércio/contabilidade).
 * - `Logo`: lockup horizontal (ícone + nome).
 * Se `brand.logoFile` apontar para uma imagem em `public/`, ela é usada no lugar.
 */

export function LogoMark({ className }: { className?: string }) {
  if (brand.logoFile) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brand.logoFile}
        alt={brand.nome}
        className={cn("h-8 w-8 rounded-lg object-contain", className)}
      />
    );
  }
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("h-8 w-8", className)}
      role="img"
      aria-label={brand.nome}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="48" height="48" rx="11" fill="var(--color-brand)" />
      <g stroke="var(--color-ouro-bright)" strokeWidth="2.4" strokeLinecap="round">
        <path d="M24 11.5V37" />
        <path d="M18.5 15.5c2 2.6 9 2.6 11 0" />
        <path d="M17.5 21c2.7 3.2 9.3 3.2 13 0" />
        <path d="M18.5 26.6c2 2.6 9 2.6 11 0" />
        <path d="M20 12.4c-1.6-1.2-4.2-1-5.4.6M28 12.4c1.6-1.2 4.2-1 5.4.6" />
      </g>
      <circle cx="24" cy="9.2" r="2.6" fill="var(--color-ouro-bright)" />
      <path
        d="M15 38.5h18"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeOpacity="0.9"
      />
    </svg>
  );
}

export function LogoOficial({ className }: { className?: string }) {
  return <LogoMark className={className} />;
}

export function Logo({
  className,
  subtitle,
}: {
  className?: string;
  subtitle?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="size-9 shrink-0" />
      <span className="leading-tight">
        <span className="block font-display text-base font-bold tracking-tight text-[var(--color-text)]">
          {brand.nomeCurto}
        </span>
        {subtitle ? <span className="eyebrow">{subtitle}</span> : null}
      </span>
    </span>
  );
}
