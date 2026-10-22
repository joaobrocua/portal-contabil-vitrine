"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  FUNCIONARIO_STATUS_LABEL,
  TIPO_CONTRATO_LABEL,
  type ActionResult,
} from "@/core/types/domain";
import type { FuncionarioRow } from "@/core/db/types";
import { Button, Card, CardContent, Field, Formulario, Input, Select, Textarea, SelectEmpresa } from "@/core/ui";
import type { EmpresaOpcao } from "@/core/types/empresa-opcao";

import { atualizarFuncionario, criarFuncionario } from "../actions";
import { FUNCIONARIO_STATUS_VALUES, TIPOS_CONTRATO } from "../schema";

export function FuncionarioForm({
  funcionario,
  empresas,
  empresaFixaId,
}: {
  funcionario?: FuncionarioRow;
  empresas: EmpresaOpcao[];
  empresaFixaId?: string;
}) {
  const router = useRouter();
  const editando = Boolean(funcionario);
  const action = editando ? atualizarFuncionario : criarFuncionario;
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (state?.ok) {
      router.push(`/pessoal/funcionarios/${state.data.id}`);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Formulario action={formAction} className="space-y-4">
      {funcionario ? (
        <input type="hidden" name="id" value={funcionario.id} />
      ) : null}

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Empresa" htmlFor="empresa_id" className="sm:col-span-2">
            <SelectEmpresa
              id="empresa_id"
              name="empresa_id"
              empresas={empresas}
              required
              defaultValue={empresaFixaId ?? funcionario?.empresa_id ?? ""}
              disabled={Boolean(empresaFixaId)}
            />
            {empresaFixaId ? (
              <input type="hidden" name="empresa_id" value={empresaFixaId} />
            ) : null}
          </Field>

          <Field
            label="Nome"
            htmlFor="nome"
            className="sm:col-span-2"
            error={
              (state && !state.ok && state.fieldErrors?.nome?.[0]) || undefined
            }
          >
            <Input id="nome" name="nome" required defaultValue={funcionario?.nome ?? ""} />
          </Field>

          <Field label="CPF" htmlFor="cpf">
            <Input
              id="cpf"
              name="cpf"
              inputMode="numeric"
              placeholder="000.000.000-00"
              defaultValue={funcionario?.cpf ?? ""}
            />
          </Field>
          <Field label="Cargo" htmlFor="cargo">
            <Input id="cargo" name="cargo" defaultValue={funcionario?.cargo ?? ""} />
          </Field>

          <Field label="Tipo de contrato" htmlFor="tipo_contrato">
            <Select
              id="tipo_contrato"
              name="tipo_contrato"
              defaultValue={funcionario?.tipo_contrato ?? "clt"}
            >
              {TIPOS_CONTRATO.map((t) => (
                <option key={t} value={t}>
                  {TIPO_CONTRATO_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={funcionario?.status ?? "ativo"}>
              {FUNCIONARIO_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {FUNCIONARIO_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Data de admissão" htmlFor="data_admissao">
            <Input
              id="data_admissao"
              name="data_admissao"
              type="date"
              defaultValue={funcionario?.data_admissao ?? ""}
            />
          </Field>
          <Field label="Data de demissão" htmlFor="data_demissao">
            <Input
              id="data_demissao"
              name="data_demissao"
              type="date"
              defaultValue={funcionario?.data_demissao ?? ""}
            />
          </Field>

          <Field label="Salário (R$)" htmlFor="salario">
            <Input
              id="salario"
              name="salario"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={
                funcionario?.salario != null
                  ? String(funcionario.salario).replace(".", ",")
                  : ""
              }
            />
          </Field>

          <Field label="Observações" htmlFor="observacoes" className="sm:col-span-2">
            <Textarea id="observacoes" name="observacoes" defaultValue={funcionario?.observacoes ?? ""} />
          </Field>
        </CardContent>
      </Card>

      {state && !state.ok ? (
        <p className="rounded-[var(--radius)] bg-[var(--color-carmine-tint)] px-3 py-2 text-sm text-[var(--color-carmine-bright)]">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Salvando…" : editando ? "Salvar" : "Cadastrar funcionário"}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </Formulario>
  );
}
