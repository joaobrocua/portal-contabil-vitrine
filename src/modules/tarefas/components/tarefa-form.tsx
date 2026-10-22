"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  DEPARTAMENTO_LABEL,
  PRIORIDADE_LABEL,
  TAREFA_STATUS_LABEL,
  type ActionResult,
} from "@/core/types/domain";
import type { ProfileRow, TarefaRow, TarefaTemplateRow } from "@/core/db/types";
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

import { atualizarTarefa, criarTarefa } from "../actions";
import { DEPARTAMENTO_VALUES, PRIORIDADE_VALUES, STATUS_VALUES } from "../schema";

export function TarefaForm({
  tarefa,
  empresas,
  responsaveis,
  empresaFixaId,
  modelo,
  prazoSugerido,
}: {
  tarefa?: TarefaRow;
  empresas: EmpresaOpcao[];
  responsaveis: Pick<ProfileRow, "id" | "nome">[];
  empresaFixaId?: string;
  /** Só na criação: preenche título/departamento/descrição e leva o checklist. */
  modelo?: TarefaTemplateRow | null;
  prazoSugerido?: string | null;
}) {
  const router = useRouter();
  const editando = Boolean(tarefa);
  const action = editando ? atualizarTarefa : criarTarefa;
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (state?.ok) {
      router.push(`/tarefas/${state.data.id}`);
      router.refresh();
    }
  }, [state, router]);

  const comp = tarefa?.competencia?.slice(0, 7) ?? "";

  return (
    <Formulario action={formAction} className="space-y-4">
      {tarefa ? <input type="hidden" name="id" value={tarefa.id} /> : null}
      {!tarefa && modelo ? (
        <input type="hidden" name="template_id" value={modelo.id} />
      ) : null}

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Título"
            htmlFor="titulo"
            className="sm:col-span-2"
            error={(state && !state.ok && state.fieldErrors?.titulo?.[0]) || undefined}
          >
            <Input
              id="titulo"
              name="titulo"
              required
              placeholder="Ex.: Apuração do DAS"
              defaultValue={tarefa?.titulo ?? modelo?.titulo_padrao ?? ""}
            />
          </Field>

          <Field label="Empresa" htmlFor="empresa_id">
            <SelectEmpresa
              id="empresa_id"
              name="empresa_id"
              empresas={empresas}
              defaultValue={empresaFixaId ?? tarefa?.empresa_id ?? ""}
              disabled={Boolean(empresaFixaId)}
              vazioLabel="— tarefa interna —"
            />
            {empresaFixaId ? (
              <input type="hidden" name="empresa_id" value={empresaFixaId} />
            ) : null}
          </Field>

          <Field label="Departamento" htmlFor="departamento">
            <Select
              id="departamento"
              name="departamento"
              defaultValue={tarefa?.departamento ?? modelo?.departamento ?? "geral"}
            >
              {DEPARTAMENTO_VALUES.map((d) => (
                <option key={d} value={d}>
                  {DEPARTAMENTO_LABEL[d]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Responsável" htmlFor="responsavel_id">
            <Select
              id="responsavel_id"
              name="responsavel_id"
              defaultValue={tarefa?.responsavel_id ?? ""}
            >
              <option value="">— não atribuída —</option>
              {responsaveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Prioridade" htmlFor="prioridade">
            <Select
              id="prioridade"
              name="prioridade"
              defaultValue={tarefa?.prioridade ?? "normal"}
            >
              {PRIORIDADE_VALUES.map((p) => (
                <option key={p} value={p}>
                  {PRIORIDADE_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Competência" htmlFor="competencia">
            <Input
              id="competencia"
              name="competencia"
              type="month"
              defaultValue={comp}
            />
          </Field>

          <Field label="Prazo" htmlFor="prazo">
            <Input
              id="prazo"
              name="prazo"
              type="date"
              defaultValue={tarefa?.prazo ?? prazoSugerido ?? ""}
            />
          </Field>

          {editando ? (
            <Field label="Status" htmlFor="status">
              <Select
                id="status"
                name="status"
                defaultValue={tarefa?.status ?? "nao_iniciada"}
              >
                {STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {TAREFA_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="status" value="nao_iniciada" />
          )}

          <Field
            label="Descrição"
            htmlFor="descricao"
            className="sm:col-span-2"
          >
            <Textarea
              id="descricao"
              name="descricao"
              defaultValue={tarefa?.descricao ?? modelo?.descricao ?? ""}
            />
          </Field>

          {!tarefa && modelo && modelo.itens_padrao.length > 0 ? (
            <div className="sm:col-span-2 rounded-[var(--radius)] border border-[var(--color-line-soft)] px-3 py-2 text-sm">
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">
                Checklist do modelo ({modelo.itens_padrao.length} itens, entra ao criar)
              </p>
              <ul className="mt-1 list-disc pl-5 text-[var(--color-text-dim)]">
                {modelo.itens_padrao.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {state && !state.ok ? (
        <p className="rounded-[var(--radius)] bg-[var(--color-carmine-tint)] px-3 py-2 text-sm text-[var(--color-carmine-bright)]">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Salvando…" : editando ? "Salvar" : "Criar tarefa"}
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
