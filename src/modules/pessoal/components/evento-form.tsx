"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { EVENTO_DP_TIPO_LABEL, type ActionResult } from "@/core/types/domain";
import type { EventoDpRow, ProfileRow } from "@/core/db/types";
import { Button, Card, CardContent, Field, Formulario, Input, Select, Textarea, SelectEmpresa } from "@/core/ui";
import type { EmpresaOpcao } from "@/core/types/empresa-opcao";

import { atualizarEventoDp, criarEventoDp } from "../actions";
import { EVENTO_DP_TIPOS } from "../schema";

export function EventoDpForm({
  evento,
  empresas,
  funcionarios,
  responsaveis,
  empresaFixaId,
  funcionarioInicialId,
}: {
  evento?: EventoDpRow;
  empresas: EmpresaOpcao[];
  funcionarios: { id: string; nome: string }[];
  responsaveis: Pick<ProfileRow, "id" | "nome">[];
  empresaFixaId?: string;
  funcionarioInicialId?: string;
}) {
  const router = useRouter();
  const editando = Boolean(evento);
  const action = editando ? atualizarEventoDp : criarEventoDp;
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(action, null);
  const [tipo, setTipo] = useState(evento?.tipo ?? "admissao");

  useEffect(() => {
    if (state?.ok) {
      router.push(`/pessoal/processos/${state.data.id}`);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Formulario action={formAction} className="space-y-4">
      {evento ? <input type="hidden" name="id" value={evento.id} /> : null}

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Empresa" htmlFor="empresa_id">
            <SelectEmpresa
              id="empresa_id"
              name="empresa_id"
              empresas={empresas}
              required
              defaultValue={empresaFixaId ?? evento?.empresa_id ?? ""}
              disabled={Boolean(empresaFixaId)}
            />
            {empresaFixaId ? (
              <input type="hidden" name="empresa_id" value={empresaFixaId} />
            ) : null}
          </Field>

          <Field label="Tipo de processo" htmlFor="tipo">
            <Select
              id="tipo"
              name="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as typeof tipo)}
            >
              {EVENTO_DP_TIPOS.map((t) => (
                <option key={t} value={t}>
                  {EVENTO_DP_TIPO_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Funcionário" htmlFor="funcionario_id" className="sm:col-span-2">
            <Select
              id="funcionario_id"
              name="funcionario_id"
              defaultValue={evento?.funcionario_id ?? funcionarioInicialId ?? ""}
            >
              <option value="">— não vinculado a um funcionário específico —</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Competência" htmlFor="competencia">
            <Input
              id="competencia"
              name="competencia"
              type="month"
              defaultValue={evento?.competencia?.slice(0, 7) ?? ""}
            />
          </Field>
          <Field label="Data de referência" htmlFor="data_referencia">
            <Input
              id="data_referencia"
              name="data_referencia"
              type="date"
              defaultValue={evento?.data_referencia ?? ""}
            />
          </Field>

          <Field label="Responsável" htmlFor="responsavel_id">
            <Select id="responsavel_id" name="responsavel_id" defaultValue={evento?.responsavel_id ?? ""}>
              <option value="">— não atribuído —</option>
              {responsaveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Detalhe" htmlFor="detalhe" className="sm:col-span-2">
            <Textarea id="detalhe" name="detalhe" defaultValue={evento?.detalhe ?? ""} />
          </Field>
        </CardContent>
      </Card>

      {!editando ? (
        <p className="text-xs text-[var(--color-text-faint)]">
          Um checklist padrão é criado automaticamente para admissão e demissão.
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
