"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Field, Select } from "@/core/ui";

/** Escolhe o modelo em Nova tarefa — vai pra URL (?modelo=) e o form se preenche. */
export function ModeloSelect({
  modelos,
  atual,
}: {
  modelos: { id: string; nome: string }[];
  atual?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function escolher(id: string) {
    const p = new URLSearchParams(params.toString());
    if (id) p.set("modelo", id);
    else p.delete("modelo");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <Field label="Começar de um modelo" htmlFor="modelo" className="max-w-sm">
      <Select
        id="modelo"
        value={atual ?? ""}
        onChange={(e) => escolher(e.target.value)}
      >
        <option value="">— tarefa em branco —</option>
        {modelos.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nome}
          </option>
        ))}
      </Select>
    </Field>
  );
}
