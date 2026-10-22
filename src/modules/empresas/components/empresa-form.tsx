"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/core/lib/cn";
import { formatCNPJ } from "@/core/lib/format";
import {
  DEPARTAMENTO_LABEL,
  REGIME_LABEL,
  SITUACAO_EMPRESA_LABEL,
  type ActionResult,
} from "@/core/types/domain";
import type { EmpresaRow, ProfileRow } from "@/core/db/types";
import { Button, Card, CardContent, Field, Formulario, Input, Label, Select, Textarea } from "@/core/ui";

import { atualizarEmpresa, criarEmpresa } from "../actions";

type Responsavel = Pick<ProfileRow, "id" | "nome" | "papel">;

const ROTULO_CAMPO: Record<string, string> = {
  razao_social: "Razão social",
  nome_fantasia: "Nome fantasia",
  cnpj: "CNPJ",
  regime_tributario: "Regime tributário",
  situacao: "Situação",
  inscricao_estadual: "Inscrição estadual",
  inscricao_municipal: "Inscrição municipal",
  cnae_principal: "CNAE principal",
  data_abertura: "Data de abertura",
  email: "E-mail",
  telefone: "Telefone",
  cep: "CEP",
  logradouro: "Logradouro",
  numero: "Número",
  complemento: "Complemento",
  bairro: "Bairro",
  municipio: "Município",
  uf: "UF",
  responsavel_id: "Responsável",
  honorario_mensal: "Honorário mensal",
  observacoes: "Observações",
};

const DEPARTAMENTOS = [
  "fiscal",
  "pessoal",
  "contabil",
  "societario",
  "ir",
  "atendimento",
] as const;

export function EmpresaForm({
  empresa,
  responsaveis,
  souAdmin = false,
}: {
  empresa?: EmpresaRow;
  responsaveis: Responsavel[];
  /** Honorário é dado financeiro restrito a admin — quem não é admin nem
   * vê o campo no formulário (o valor já chega null da query pra quem não
   * é admin, ver empresas_com_honorario em 0022). */
  souAdmin?: boolean;
}) {
  const router = useRouter();
  const editando = Boolean(empresa);
  const action = editando ? atualizarEmpresa : criarEmpresa;
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (state?.ok) {
      router.push(`/empresas/${state.data.id}`);
      router.refresh();
    }
  }, [state, router]);

  const fe = (state && !state.ok && state.fieldErrors) || {};
  const err = (k: string) => fe[k]?.[0];
  // Nomes dos campos com problema, pra mensagem de cima dizer ONDE olhar.
  const camposComErro = Object.keys(fe)
    .filter((k) => fe[k]?.length)
    .map((k) => ROTULO_CAMPO[k] ?? k);

  return (
    <Formulario action={formAction} className="space-y-6">
      {empresa ? <input type="hidden" name="id" value={empresa.id} /> : null}

      <p className="text-xs text-[var(--color-text-dim)]">
        Campos com <span className="text-[var(--color-carmine-bright)]">*</span>{" "}
        são obrigatórios; o resto pode ficar em branco e ser completado depois.
      </p>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Razão social"
            htmlFor="razao_social"
            className="sm:col-span-2"
            error={err("razao_social")}
          >
            <Input
              id="razao_social"
              name="razao_social"
              required
              defaultValue={empresa?.razao_social ?? ""}
            />
          </Field>

          <Field label="Nome fantasia" htmlFor="nome_fantasia" error={err("nome_fantasia")}>
            <Input
              id="nome_fantasia"
              name="nome_fantasia"
              defaultValue={empresa?.nome_fantasia ?? ""}
            />
          </Field>

          <Field label="CNPJ" htmlFor="cnpj" error={err("cnpj")}>
            <Input
              id="cnpj"
              name="cnpj"
              required
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              defaultValue={empresa ? formatCNPJ(empresa.cnpj) : ""}
            />
          </Field>

          <Field
            label="Regime tributário"
            htmlFor="regime_tributario"
            error={err("regime_tributario")}
            obrigatorio
          >
            <Select
              id="regime_tributario"
              name="regime_tributario"
              defaultValue={empresa?.regime_tributario ?? "simples_nacional"}
            >
              {Object.entries(REGIME_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Situação" htmlFor="situacao" error={err("situacao")}>
            <Select
              id="situacao"
              name="situacao"
              defaultValue={empresa?.situacao ?? "ativa"}
            >
              {Object.entries(SITUACAO_EMPRESA_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Inscrição estadual" htmlFor="inscricao_estadual" error={err("inscricao_estadual")}>
            <Input
              id="inscricao_estadual"
              name="inscricao_estadual"
              defaultValue={empresa?.inscricao_estadual ?? ""}
            />
          </Field>
          <Field label="Inscrição municipal" htmlFor="inscricao_municipal" error={err("inscricao_municipal")}>
            <Input
              id="inscricao_municipal"
              name="inscricao_municipal"
              defaultValue={empresa?.inscricao_municipal ?? ""}
            />
          </Field>
          <Field label="CNAE principal" htmlFor="cnae_principal" error={err("cnae_principal")}>
            <Input
              id="cnae_principal"
              name="cnae_principal"
              placeholder="0000-0/00"
              defaultValue={empresa?.cnae_principal ?? ""}
            />
          </Field>
          <Field label="Data de abertura" htmlFor="data_abertura" error={err("data_abertura")}>
            <Input
              id="data_abertura"
              name="data_abertura"
              type="date"
              defaultValue={empresa?.data_abertura ?? ""}
            />
          </Field>

          <Field label="E-mail" htmlFor="email" error={err("email")}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={empresa?.email ?? ""}
            />
          </Field>
          <Field label="Telefone" htmlFor="telefone" error={err("telefone")}>
            <Input
              id="telefone"
              name="telefone"
              defaultValue={empresa?.telefone ?? ""}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-6">
          <Field label="CEP" htmlFor="cep" className="sm:col-span-2" error={err("cep")}>
            <Input id="cep" name="cep" defaultValue={empresa?.cep ?? ""} />
          </Field>
          <Field
            label="Logradouro"
            htmlFor="logradouro"
            className="sm:col-span-3"
            error={err("logradouro")}
          >
            <Input
              id="logradouro"
              name="logradouro"
              defaultValue={empresa?.logradouro ?? ""}
            />
          </Field>
          <Field label="Número" htmlFor="numero" className="sm:col-span-1" error={err("numero")}>
            <Input
              id="numero"
              name="numero"
              defaultValue={empresa?.numero ?? ""}
            />
          </Field>
          <Field
            label="Complemento"
            htmlFor="complemento"
            className="sm:col-span-2"
            error={err("complemento")}
          >
            <Input
              id="complemento"
              name="complemento"
              defaultValue={empresa?.complemento ?? ""}
            />
          </Field>
          <Field label="Bairro" htmlFor="bairro" className="sm:col-span-2" error={err("bairro")}>
            <Input
              id="bairro"
              name="bairro"
              defaultValue={empresa?.bairro ?? ""}
            />
          </Field>
          <Field label="Município" htmlFor="municipio" className="sm:col-span-1" error={err("municipio")}>
            <Input
              id="municipio"
              name="municipio"
              defaultValue={empresa?.municipio ?? ""}
            />
          </Field>
          <Field label="UF" htmlFor="uf" className="sm:col-span-1" error={err("uf")}>
            <Input
              id="uf"
              name="uf"
              maxLength={2}
              defaultValue={empresa?.uf ?? ""}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Responsável pelo atendimento" htmlFor="responsavel_id" error={err("responsavel_id")}>
            <Select
              id="responsavel_id"
              name="responsavel_id"
              defaultValue={empresa?.responsavel_id ?? ""}
            >
              <option value="">— não definido —</option>
              {responsaveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </Select>
          </Field>
          {souAdmin && (
            <Field label="Honorário mensal (R$)" htmlFor="honorario_mensal" error={err("honorario_mensal")}>
              <Input
                id="honorario_mensal"
                name="honorario_mensal"
                inputMode="decimal"
                placeholder="0,00"
                defaultValue={
                  empresa?.honorario_mensal != null
                    ? String(empresa.honorario_mensal).replace(".", ",")
                    : ""
                }
              />
            </Field>
          )}

          <div className="sm:col-span-2">
            <Label>Departamentos responsáveis</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEPARTAMENTOS.map((d) => {
                const checked = empresa?.departamentos_responsaveis?.includes(d);
                return (
                  <label
                    key={d}
                    className={cn(
                      // `relative`: o checkbox escondido (sr-only é absolute)
                      // fica preso ao botão. Sem isso ele se posicionava
                      // pela página inteira e, ao receber foco no clique,
                      // o navegador rolava o documento todo — o menu e o
                      // fundo subiam e sobrava uma faixa vazia embaixo.
                      "relative cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
                      "border-neutral-300 text-neutral-600 hover:bg-neutral-50",
                      "has-[:checked]:border-brand has-[:checked]:bg-brand/10 has-[:checked]:text-brand",
                    )}
                  >
                    <input
                      type="checkbox"
                      name="departamentos_responsaveis"
                      value={d}
                      defaultChecked={checked}
                      className="sr-only"
                    />
                    {DEPARTAMENTO_LABEL[d]}
                  </label>
                );
              })}
            </div>
          </div>

          <Field
            label="Observações"
            htmlFor="observacoes"
            className="sm:col-span-2"
            error={err("observacoes")}
          >
            <Textarea
              id="observacoes"
              name="observacoes"
              defaultValue={empresa?.observacoes ?? ""}
            />
          </Field>
        </CardContent>
      </Card>

      {state && !state.ok ? (
        <p className="rounded-[var(--radius)] bg-[var(--color-carmine-tint)] px-3 py-2 text-sm text-[var(--color-carmine-bright)]">
          {state.error}
          {camposComErro.length > 0 ? ` Confira: ${camposComErro.join(", ")}.` : null}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending
            ? "Salvando…"
            : editando
              ? "Salvar alterações"
              : "Cadastrar empresa"}
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
