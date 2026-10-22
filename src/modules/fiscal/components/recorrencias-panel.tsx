"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import {
  OBRIGACAO_TIPO_LABEL,
  PERIODICIDADE_LABEL,
  type ObrigacaoTipo,
  type Periodicidade,
} from "@/core/types/domain";
import type { ProfileRow } from "@/core/db/types";
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
  useToast,
  SelectEmpresa,
} from "@/core/ui";
import type { EmpresaOpcao } from "@/core/types/empresa-opcao";

import {
  alternarRecorrencia,
  criarRecorrencia,
  removerRecorrencia,
} from "../actions";
import { OBRIGACAO_TIPOS } from "../schema";
import type { RecorrenciaItem } from "../queries";

export function RecorrenciasPanel({
  empresas,
  responsaveis,
  recorrencias,
}: {
  empresas: EmpresaOpcao[];
  responsaveis: Pick<ProfileRow, "id" | "nome">[];
  recorrencias: RecorrenciaItem[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(criarRecorrencia, null);
  const [, start] = useTransition();
  const { notify } = useToast();
  const [empresaFiltro, setEmpresaFiltro] = useState("");

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  const visiveis = empresaFiltro
    ? recorrencias.filter((r) => r.empresa_id === empresaFiltro)
    : recorrencias;

  const nomeEmpresa = (r: RecorrenciaItem) =>
    r.empresa ? r.empresa.nome_fantasia || r.empresa.razao_social : "—";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Obrigações recorrentes</CardTitle>
          <Select
            value={empresaFiltro}
            onChange={(e) => setEmpresaFiltro(e.target.value)}
            className="h-8 w-auto"
          >
            <option value="">Todas as empresas</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </Select>
        </CardHeader>
        <CardContent>
          {visiveis.length === 0 ? (
            <EmptyState
              title="Nenhuma recorrência"
              description="Cadastre ao lado o que cada empresa entrega todo mês. Depois é só 'Gerar competência'."
            />
          ) : (
            <ul className="divide-y divide-[var(--color-line-soft)]">
              {visiveis.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
                >
                  <span className="flex-1">
                    <span className="text-sm font-medium text-[var(--color-text)]">
                      {OBRIGACAO_TIPO_LABEL[r.tipo as ObrigacaoTipo]}
                    </span>
                    <span className="block text-xs text-[var(--color-text-faint)]">
                      {nomeEmpresa(r)} ·{" "}
                      {PERIODICIDADE_LABEL[r.periodicidade as Periodicidade]} ·
                      vence dia {r.dia_vencimento}
                      {r.meses_apos > 0
                        ? ` (+${r.meses_apos} mês${r.meses_apos > 1 ? "es" : ""})`
                        : ""}
                    </span>
                  </span>
                  {!r.ativo ? <Badge tone="neutral">Inativa</Badge> : null}
                  <button
                    type="button"
                    onClick={() =>
                      start(async () => {
                        const res = await alternarRecorrencia(r.id, !r.ativo);
                        if (!res.ok) notify(res.error);
                        else router.refresh();
                      })
                    }
                    className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
                  >
                    {r.ativo ? "Desativar" : "Reativar"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      start(async () => {
                        const res = await removerRecorrencia(r.id);
                        if (!res.ok) notify(res.error);
                        else router.refresh();
                      })
                    }
                    className="text-[var(--color-text-faint)] hover:text-[var(--color-carmine)]"
                    title="Remover"
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
          <CardTitle>Nova recorrência</CardTitle>
        </CardHeader>
        <CardContent>
          <Formulario ref={formRef} action={action} className="space-y-3">
            <Field label="Empresa" htmlFor="rec_empresa">
              <SelectEmpresa
              id="rec_empresa"
              name="empresa_id"
              empresas={empresas}
              required
            />
            </Field>
            <Field label="Tipo" htmlFor="rec_tipo">
              <Select id="rec_tipo" name="tipo" defaultValue="das">
                {OBRIGACAO_TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {OBRIGACAO_TIPO_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Periodicidade" htmlFor="rec_per">
                <Select id="rec_per" name="periodicidade" defaultValue="mensal">
                  <option value="mensal">Mensal</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="anual">Anual</option>
                </Select>
              </Field>
              <Field label="Dia venc." htmlFor="rec_dia">
                <Input
                  id="rec_dia"
                  name="dia_vencimento"
                  type="number"
                  min={1}
                  max={31}
                  defaultValue={20}
                />
              </Field>
              <Field label="Meses após" htmlFor="rec_ma">
                <Input
                  id="rec_ma"
                  name="meses_apos"
                  type="number"
                  min={0}
                  max={3}
                  defaultValue={1}
                />
              </Field>
            </div>
            <Field label="Responsável" htmlFor="rec_resp">
              <Select id="rec_resp" name="responsavel_id" defaultValue="">
                <option value="">— não atribuída —</option>
                {responsaveis.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </Select>
            </Field>

            {state && !state.ok ? (
              <p className="text-sm text-[var(--color-carmine-bright)]">
                {state.error}
              </p>
            ) : null}

            <Button type="submit" disabled={pending} className="w-full">
              <Plus className="size-4" />
              {pending ? "Adicionando…" : "Adicionar recorrência"}
            </Button>
          </Formulario>
        </CardContent>
      </Card>
    </div>
  );
}
