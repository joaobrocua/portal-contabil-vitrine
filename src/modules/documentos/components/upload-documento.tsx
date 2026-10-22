"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";

import { createSupabaseBrowserClient } from "@/core/db/client";
import { DEPARTAMENTO_LABEL } from "@/core/types/domain";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
} from "@/core/ui";

import { registrarDocumento } from "../actions";
import {
  DEPARTAMENTO_DOC,
  EXTENSOES_PERMITIDAS,
  MIME_PERMITIDOS,
  TAMANHO_MAXIMO_BYTES,
} from "../schema";

const ACCEPT = EXTENSOES_PERMITIDAS.join(",");

function extensaoPermitida(nome: string): boolean {
  const ext = `.${nome.split(".").pop()?.toLowerCase() ?? ""}`;
  return (EXTENSOES_PERMITIDAS as readonly string[]).includes(ext);
}

export function UploadDocumento({
  empresaId,
  departamentoInicial,
  departamentos = DEPARTAMENTO_DOC,
  categorias,
}: {
  empresaId: string;
  departamentoInicial?: string;
  /** Departamentos que quem envia pode escolher (ver departamentosParaEnvio). */
  departamentos?: readonly string[];
  categorias: { valor: string; rotulo: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("arquivo") as File | null;
    if (!file || file.size === 0) {
      setErro("Selecione um arquivo.");
      return;
    }
    if (file.size > TAMANHO_MAXIMO_BYTES) {
      setErro("Arquivo acima de 25 MB.");
      return;
    }
    if (!extensaoPermitida(file.name)) {
      setErro(
        `Tipo de arquivo não aceito. Use: ${EXTENSOES_PERMITIDAS.join(", ")}.`,
      );
      return;
    }
    if (file.type && !(MIME_PERMITIDOS as readonly string[]).includes(file.type)) {
      setErro("Tipo de arquivo não aceito.");
      return;
    }

    start(async () => {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${empresaId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("documentos")
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) {
        setErro(`Falha no upload: ${upErr.message}`);
        return;
      }

      const payload = new FormData();
      payload.set("empresa_id", empresaId);
      payload.set("departamento", String(fd.get("departamento")));
      payload.set("categoria", String(fd.get("categoria")));
      payload.set("competencia", String(fd.get("competencia") ?? ""));
      payload.set(
        "titulo",
        String(fd.get("titulo") || file.name.replace(/\.[^.]+$/, "")),
      );
      payload.set("descricao", String(fd.get("descricao") ?? ""));
      payload.set("storage_path", path);
      payload.set("tamanho_bytes", String(file.size));
      payload.set("mime", file.type || "");

      const res = await registrarDocumento(null, payload);
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enviar documento</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
          <Field label="Arquivo" htmlFor="arquivo">
            <Input id="arquivo" name="arquivo" type="file" accept={ACCEPT} required />
            <p className="mt-1 text-xs text-[var(--color-text-faint)]">
              PDF, imagem, planilha, Word ou XML — até 25 MB.
            </p>
          </Field>
          <Field label="Título" htmlFor="doc_titulo">
            <Input
              id="doc_titulo"
              name="titulo"
              placeholder="(usa o nome do arquivo se vazio)"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Departamento" htmlFor="doc_dep">
              <Select
                id="doc_dep"
                name="departamento"
                defaultValue={
                  departamentoInicial && departamentos.includes(departamentoInicial)
                    ? departamentoInicial
                    : "geral"
                }
              >
                {departamentos.map((d) => (
                  <option key={d} value={d}>
                    {DEPARTAMENTO_LABEL[d as keyof typeof DEPARTAMENTO_LABEL]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Categoria" htmlFor="doc_cat">
              <Select id="doc_cat" name="categoria" defaultValue="outro">
                {categorias.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.rotulo}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Competência" htmlFor="doc_comp">
            <Input id="doc_comp" name="competencia" type="month" />
          </Field>

          {erro ? <p className="text-sm text-[var(--color-carmine-bright)]">{erro}</p> : null}

          <Button type="submit" disabled={pending} className="w-full">
            <UploadCloud className="size-4" />
            {pending ? "Enviando…" : "Enviar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
