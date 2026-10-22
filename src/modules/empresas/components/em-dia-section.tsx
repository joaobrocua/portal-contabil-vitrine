"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { formatCNPJ } from "@/core/lib/format";
import type { DiagnosticoEmpresa } from "../diagnostico";

type Emp = DiagnosticoEmpresa["empresa"];

export function EmDiaSection({ empresas }: { empresas: Emp[] }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-line)]">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-medium text-[var(--color-text-dim)]">
          {empresas.length}{" "}
          {empresas.length === 1
            ? "empresa sem pendências"
            : "empresas sem pendências"}
        </span>
        <ChevronDown
          className={`size-4 text-[var(--color-text-faint)] transition-transform ${
            aberto ? "rotate-180" : ""
          }`}
        />
      </button>
      {aberto ? (
        <ul className="divide-y divide-[var(--color-line-soft)] border-t border-[var(--color-line)]">
          {empresas.map((e) => (
            <li key={e.id}>
              <Link
                href={`/empresas/${e.id}`}
                className="flex items-center justify-between px-5 py-2.5 text-sm hover:bg-[var(--color-surface-2)]"
              >
                <span className="text-[var(--color-text)]">
                  {e.nome_fantasia || e.razao_social}
                </span>
                <span className="data text-xs text-[var(--color-text-faint)]">
                  {formatCNPJ(e.cnpj)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
