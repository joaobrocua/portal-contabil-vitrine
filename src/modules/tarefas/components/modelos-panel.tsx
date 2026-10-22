"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { DEPARTAMENTO_LABEL, type ActionResult } from "@/core/types/domain";
import type { TarefaTemplateRow } from "@/core/db/types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Formulario,
  Input,
  Select,
  Textarea,
  useToast,
} from "@/core/ui";

import { alternarModelo, excluirModelo, salvarModelo } from "../actions";
import { DEPARTAMENTO_VALUES } from "../schema";

function ModeloForm({
  modelo,
  onDone,
}: {
  modelo: TarefaTemplateRow | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(salvarModelo, null);

  useEffect(() => {
    if (state?.ok) {
      onDone();
      router.refresh();
    }
  }, [state, router, onDone]);

  const erro = (campo: string) =>
    (state && !state.ok && state.fieldErrors?.[campo]?.[0]) || undefined;

  return (
    <Formulario action={action} className="space-y-3">
      {modelo ? <input type="hidden" name="id" value={modelo.id} /> : null}
      <Field label="Nome do modelo" htmlFor="mod_nome" error={erro("nome")}>
        <Input
          id="mod_nome"
          name="nome"
          required
          placeholder="Ex.: Fechamento mensal"
          defaultValue={modelo?.nome ?? ""}
        />
      </Field>
      <Field label="Título da tarefa" htmlFor="mod_titulo" error={erro("titulo_padrao")}>
        <Input
          id="mod_titulo"
          name="titulo_padrao"
          required
          placeholder="Ex.: Conferir extratos e lançamentos"
          defaultValue={modelo?.titulo_padrao ?? ""}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Departamento" htmlFor="mod_dep">
          <Select
            id="mod_dep"
            name="departamento"
            defaultValue={modelo?.departamento ?? "geral"}
          >
            {DEPARTAMENTO_VALUES.map((d) => (
              <option key={d} value={d}>
                {DEPARTAMENTO_LABEL[d]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Dia do prazo" htmlFor="mod_dia" error={erro("dia_prazo")}>
          <Input
            id="mod_dia"
            name="dia_prazo"
            type="number"
            min={1}
            max={31}
            placeholder="—"
            defaultValue={modelo?.dia_prazo ?? ""}
          />
        </Field>
      </div>
      <Field label="Descrição" htmlFor="mod_desc">
        <Textarea
          id="mod_desc"
          name="descricao"
          rows={2}
          defaultValue={modelo?.descricao ?? ""}
        />
      </Field>
      <Field
        label="Checklist (um item por linha)"
        htmlFor="mod_itens"
        error={erro("itens_padrao")}
      >
        <Textarea
          id="mod_itens"
          name="itens_padrao"
          rows={6}
          placeholder={"Solicitar extratos\nConciliar contas\nEnviar balancete"}
          defaultValue={(modelo?.itens_padrao ?? []).join("\n")}
        />
      </Field>

      {state && !state.ok ? (
        <p className="text-sm text-[var(--color-carmine-bright)]">{state.error}</p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {modelo ? null : <Plus className="size-4" />}
          {pending ? "Salvando…" : modelo ? "Salvar modelo" : "Criar modelo"}
        </Button>
        {modelo ? (
          <Button type="button" variant="outline" onClick={onDone}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </Formulario>
  );
}

export function ModelosPanel({ modelos }: { modelos: TarefaTemplateRow[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const { notify } = useToast();
  const [editando, setEditando] = useState<TarefaTemplateRow | null>(null);
  // Remonta o formulário ao trocar de modelo / depois de salvar (limpa campos).
  const [versao, setVersao] = useState(0);
  const terminar = () => {
    setEditando(null);
    setVersao((v) => v + 1);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader>
          <CardTitle>Modelos</CardTitle>
        </CardHeader>
        <CardContent>
          {modelos.length === 0 ? (
            <EmptyState
              title="Nenhum modelo"
              description="Cadastre ao lado as tarefas que se repetem. Em Nova tarefa, é só escolher o modelo: título, departamento, prazo e checklist já vêm preenchidos."
            />
          ) : (
            <ul className="divide-y divide-[var(--color-line-soft)]">
              {modelos.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-[var(--color-text)]">
                      {m.nome}
                    </span>
                    <span className="block text-xs text-[var(--color-text-faint)]">
                      {DEPARTAMENTO_LABEL[m.departamento]} ·{" "}
                      {m.itens_padrao.length} item(ns) no checklist
                      {m.dia_prazo ? ` · prazo dia ${m.dia_prazo}` : ""}
                    </span>
                  </span>
                  {!m.ativo ? <Badge tone="neutral">Inativo</Badge> : null}
                  <button
                    type="button"
                    onClick={() => {
                      setEditando(m);
                      setVersao((v) => v + 1);
                    }}
                    className="text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
                    title="Editar"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      start(async () => {
                        const res = await alternarModelo(m.id, !m.ativo);
                        if (!res.ok) notify(res.error);
                        else router.refresh();
                      })
                    }
                    className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
                  >
                    {m.ativo ? "Desativar" : "Reativar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Excluir o modelo "${m.nome}"? As tarefas já criadas com ele continuam.`,
                        )
                      )
                        return;
                      start(async () => {
                        const res = await excluirModelo(m.id);
                        if (!res.ok) notify(res.error);
                        else {
                          if (editando?.id === m.id) terminar();
                          router.refresh();
                        }
                      });
                    }}
                    className="text-[var(--color-text-faint)] hover:text-[var(--color-carmine)]"
                    title="Excluir"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editando ? `Editar: ${editando.nome}` : "Novo modelo"}</CardTitle>
        </CardHeader>
        <CardContent>
          <ModeloForm key={versao} modelo={editando} onDone={terminar} />
        </CardContent>
      </Card>
    </div>
  );
}
