"use client";

import { useActionState, useEffect, useRef } from "react";
import { CalendarPlus } from "lucide-react";

import { DEPARTAMENTO_LABEL, type Departamento } from "@/core/types/domain";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Formulario,
  Input,
  Select,
  Textarea,
  SelectEmpresa,
} from "@/core/ui";
import type { EmpresaOpcao } from "@/core/types/empresa-opcao";

import { criarEvento } from "../actions";

const DEPARTAMENTOS: Departamento[] = [
  "fiscal",
  "pessoal",
  "contabil",
  "societario",
  "ir",
  "atendimento",
  "geral",
];

export function NovoEventoForm({
  empresas,
}: {
  empresas: EmpresaOpcao[];
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(criarEvento, null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo evento</CardTitle>
      </CardHeader>
      <CardContent>
        <Formulario ref={ref} action={action} className="space-y-3">
          <Field label="Título" htmlFor="ev_titulo">
            <Input id="ev_titulo" name="titulo" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" htmlFor="ev_data">
              <Input id="ev_data" name="data" type="date" required />
            </Field>
            <Field label="Hora" htmlFor="ev_hora">
              <Input id="ev_hora" name="hora" type="time" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo" htmlFor="ev_tipo">
              <Select id="ev_tipo" name="tipo" defaultValue="lembrete">
                <option value="lembrete">Lembrete</option>
                <option value="reuniao">Reunião</option>
                <option value="prazo">Prazo</option>
                <option value="obrigacao">Obrigação</option>
                <option value="outro">Outro</option>
              </Select>
            </Field>
            <Field label="Departamento" htmlFor="ev_dep">
              <Select id="ev_dep" name="departamento" defaultValue="">
                <option value="">—</option>
                {DEPARTAMENTOS.map((d) => (
                  <option key={d} value={d}>
                    {DEPARTAMENTO_LABEL[d]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Empresa" htmlFor="ev_emp">
            <SelectEmpresa
              id="ev_emp"
              name="empresa_id"
              empresas={empresas}
              vazioLabel="— nenhuma —"
            />
          </Field>
          <Field label="Descrição" htmlFor="ev_desc">
            <Textarea id="ev_desc" name="descricao" />
          </Field>

          {state && !state.ok ? (
            <p className="text-sm text-[var(--color-carmine-bright)]">{state.error}</p>
          ) : null}

          <Button type="submit" disabled={pending} className="w-full">
            <CalendarPlus className="size-4" />
            {pending ? "Salvando…" : "Adicionar evento"}
          </Button>
        </Formulario>
      </CardContent>
    </Card>
  );
}
