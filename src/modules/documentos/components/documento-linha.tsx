"use client";

import { useOptimistic, useTransition } from "react";
import { Download, FileText, Trash2 } from "lucide-react";

import { formatCompetenciaCurta, formatData } from "@/core/lib/format";
import type { DocumentoStatus } from "@/core/db/types";
import { Badge, Button, Select, useToast } from "@/core/ui";

import { excluirDocumento, revisarDocumento, urlDownload } from "../actions";
import type { DocumentoItem } from "../queries";

const STATUS_LABEL: Record<DocumentoStatus, string> = {
  pendente: "Pendente",
  recebido: "Recebido",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  correcao: "Necessita correção",
};
const STATUS_TONE: Record<DocumentoStatus, Parameters<typeof Badge>[0]["tone"]> = {
  pendente: "warning",
  recebido: "info",
  aprovado: "success",
  rejeitado: "danger",
  correcao: "warning",
};

export function DocumentoLinha({
  doc,
  podeRevisar,
  podeExcluir = podeRevisar,
}: {
  doc: DocumentoItem;
  podeRevisar: boolean;
  /** Padrão: quem revisa também exclui (equipe do escritório). */
  podeExcluir?: boolean;
}) {
  const [pending, start] = useTransition();
  const { notify } = useToast();
  // Otimista: o seletor já mostra a escolha; se o servidor recusar, volta.
  const [statusTela, setStatusTela] = useOptimistic(doc.status);
  // A linha some na hora; se a exclusão falhar, volta e o aviso aparece.
  const [excluido, setExcluido] = useOptimistic(false);

  function baixar() {
    start(async () => {
      const res = await urlDownload(doc.id);
      if (res.ok) window.open(res.data.url, "_blank", "noopener");
      else notify(res.error);
    });
  }

  function mudarStatus(status: string) {
    start(async () => {
      setStatusTela(status as DocumentoStatus);
      const fd = new FormData();
      fd.set("id", doc.id);
      fd.set("status", status);
      const r = await revisarDocumento(null, fd);
      if (!r.ok) notify(r.error);
    });
  }

  function excluir() {
    if (
      !window.confirm(
        `Excluir o documento "${doc.titulo}"?\n\nO arquivo é apagado de vez. A exclusão fica registrada na trilha de acessos.`,
      )
    )
      return;
    start(async () => {
      setExcluido(true);
      const r = await excluirDocumento(doc.id);
      if (!r.ok) notify(r.error);
      else notify("Documento excluído.", "sucesso");
    });
  }

  if (excluido) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <FileText className="size-4 shrink-0 text-neutral-400" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-900">
          {doc.titulo}
        </p>
        <p className="text-xs text-neutral-400">
          {doc.categoria} · {formatCompetenciaCurta(doc.competencia)} ·{" "}
          {formatData(doc.created_at)}
          {doc.enviado?.nome ? ` · ${doc.enviado.nome}` : ""}
          {doc.origem === "cliente" ? " · enviado pelo cliente" : ""}
        </p>
      </div>

      {podeRevisar ? (
        <Select
          value={statusTela}
          disabled={pending}
          onChange={(e) => mudarStatus(e.target.value)}
          className="h-8 w-auto"
        >
          {(Object.keys(STATUS_LABEL) as DocumentoStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      ) : (
        <Badge tone={STATUS_TONE[doc.status]}>{STATUS_LABEL[doc.status]}</Badge>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={baixar}
        disabled={pending}
        title="Baixar"
      >
        <Download className="size-4" />
      </Button>
      {podeExcluir ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={excluir}
          disabled={pending}
          title="Excluir"
          className="text-[var(--color-text-faint)] hover:text-[var(--color-carmine-bright)]"
        >
          <Trash2 className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
