"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { PROCESSO_SOCIETARIO_TIPO_LABEL, type ActionResult } from "@/core/types/domain";
import type { ProcessoSocietarioRow, ProfileRow } from "@/core/db/types";
import { Button, Card, CardContent, Field, Formulario, Input, Select, Textarea, SelectEmpresa } from "@/core/ui";
import type { EmpresaOpcao } from "@/core/types/empresa-opcao";

import { atualizarProcessoSocietario, criarProcessoSocietario } from "../actions";
import { PROCESSO_SOCIETARIO_TIPOS } from "../schema";

export function ProcessoSocietarioForm({
  processo,
  empresas,
  responsaveis,
  empresaFixaId,
}: {
  processo?: ProcessoSocietarioRow;
  empresas: EmpresaOpcao[];
  responsaveis: Pick<ProfileRow, "id" | "nome">[];
  empresaFixaId?: string;
}) {
  const router = useRouter();
  const editando = Boolean(processo);
  const action = editando ? atualizarProcessoSocietario : criarProcessoSocietario;
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (state?.ok) {
      router.push(`/societario/${state.data.id}`);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Formulario action={formAction} className="space-y-4">
      {processo ? <input type="hidden" name="id" value={processo.id} /> : null}

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Empresa" htmlFor="empresa_id">
            <SelectEmpresa
              id="empresa_id"
              name="empresa_id"
              empresas={empresas}
              required
              defaultValue={empresaFixaId ?? processo?.empresa_id ?? ""}
              disabled={Boolean(empresaFixaId)}
            />
            {empresaFixaId ? (
              <input type="hidden" name="empresa_id" value={empresaFixaId} />
            ) : null}
          </Field>

          <Field label="Tipo de processo" htmlFor="tipo">
            <Select id="tipo" name="tipo" defaultValue={processo?.tipo ?? "abertura"}>
              {PROCESSO_SOCIETARIO_TIPOS.map((t) => (
                <option key={t} value={t}>
                  {PROCESSO_SOCIETARIO_TIPO_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Protocolo (Junta Comercial)" htmlFor="protocolo">
            <Input
              id="protocolo"
              name="protocolo"
              placeholder="Número do protocolo, se já houver"
              defaultValue={processo?.protocolo ?? ""}
            />
          </Field>

          <Field label="Responsável" htmlFor="responsavel_id">
            <Select
              id="responsavel_id"
              name="responsavel_id"
              defaultValue={processo?.responsavel_id ?? ""}
            >
              <option value="">— não atribuído —</option>
              {responsaveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Descrição" htmlFor="descricao" className="sm:col-span-2">
            <Textarea
              id="descricao"
              name="descricao"
              placeholder="O que está sendo alterado, motivo do encerramento, etc."
              defaultValue={processo?.descricao ?? ""}
            />
          </Field>
        </CardContent>
      </Card>

      {!editando ? (
        <p className="text-xs text-[var(--color-text-faint)]">
          Um checklist padrão é criado automaticamente conforme o tipo de processo.
        </p>
      ) : null}

      {state && !state.ok ? (
        <p className="rounded-[var(--radius)] bg-[var(--color-carmine-tint)] px-3 py-2 text-sm text-[var(--color-carmine-bright)]">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Salvando…" : editando ? "Salvar" : "Criar processo"}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </Formulario>
  );
}
