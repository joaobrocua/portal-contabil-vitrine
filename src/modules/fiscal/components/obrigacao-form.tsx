"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  OBRIGACAO_STATUS_LABEL,
  OBRIGACAO_TIPO_LABEL,
  type ActionResult,
} from "@/core/types/domain";
import type { ObrigacaoRow, ProfileRow } from "@/core/db/types";
import {
  Button,
  Card,
  CardContent,
  Field,
  Formulario,
  Input,
  Select,
  Textarea,
  SelectEmpresa,
} from "@/core/ui";
import type { EmpresaOpcao } from "@/core/types/empresa-opcao";

import { atualizarObrigacao, criarObrigacao } from "../actions";
import { OBRIGACAO_STATUS, OBRIGACAO_TIPOS } from "../schema";

export function ObrigacaoForm({
  obrigacao,
  empresas,
  responsaveis,
  empresaFixaId,
  competenciaInicial,
}: {
  obrigacao?: ObrigacaoRow;
  empresas: EmpresaOpcao[];
  responsaveis: Pick<ProfileRow, "id" | "nome">[];
  empresaFixaId?: string;
  competenciaInicial?: string;
}) {
  const router = useRouter();
  const editando = Boolean(obrigacao);
  const action = editando ? atualizarObrigacao : criarObrigacao;
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (state?.ok) {
      router.push(`/fiscal/${state.data.id}`);
      router.refresh();
    }
  }, [state, router]);

  const comp = (obrigacao?.competencia ?? competenciaInicial ?? "").slice(0, 7);

  return (
    <Formulario action={formAction} className="space-y-4">
      {obrigacao ? <input type="hidden" name="id" value={obrigacao.id} /> : null}

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Empresa" htmlFor="empresa_id">
            <SelectEmpresa
              id="empresa_id"
              name="empresa_id"
              empresas={empresas}
              required
              defaultValue={empresaFixaId ?? obrigacao?.empresa_id ?? ""}
              disabled={Boolean(empresaFixaId)}
            />
            {empresaFixaId ? (
              <input type="hidden" name="empresa_id" value={empresaFixaId} />
            ) : null}
          </Field>

          <Field label="Tipo de obrigação" htmlFor="tipo">
            <Select
              id="tipo"
              name="tipo"
              defaultValue={obrigacao?.tipo ?? "das"}
            >
              {OBRIGACAO_TIPOS.map((t) => (
                <option key={t} value={t}>
                  {OBRIGACAO_TIPO_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Competência" htmlFor="competencia">
            <Input
              id="competencia"
              name="competencia"
              type="month"
              required
              defaultValue={comp}
            />
          </Field>

          <Field label="Vencimento" htmlFor="vencimento">
            <Input
              id="vencimento"
              name="vencimento"
              type="date"
              required
              defaultValue={obrigacao?.vencimento ?? ""}
            />
          </Field>

          <Field label="Valor (R$)" htmlFor="valor">
            <Input
              id="valor"
              name="valor"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={
                obrigacao?.valor != null
                  ? String(obrigacao.valor).replace(".", ",")
                  : ""
              }
            />
          </Field>

          <Field label="Responsável" htmlFor="responsavel_id">
            <Select
              id="responsavel_id"
              name="responsavel_id"
              defaultValue={obrigacao?.responsavel_id ?? ""}
            >
              <option value="">— não atribuída —</option>
              {responsaveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </Select>
          </Field>

          {editando ? (
            <Field label="Status" htmlFor="status">
              <Select
                id="status"
                name="status"
                defaultValue={obrigacao?.status ?? "pendente"}
              >
                {OBRIGACAO_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {OBRIGACAO_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="status" value="pendente" />
          )}

          <Field
            label="Descrição / observação"
            htmlFor="descricao"
            className="sm:col-span-2"
          >
            <Input
              id="descricao"
              name="descricao"
              placeholder="Ex.: ISS retido — nota 1234"
              defaultValue={obrigacao?.descricao ?? ""}
            />
          </Field>

          <Field
            label="Observações internas"
            htmlFor="observacao"
            className="sm:col-span-2"
          >
            <Textarea
              id="observacao"
              name="observacao"
              defaultValue={obrigacao?.observacao ?? ""}
            />
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
          {pending ? "Salvando…" : editando ? "Salvar" : "Criar obrigação"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
      </div>
    </Formulario>
  );
}
