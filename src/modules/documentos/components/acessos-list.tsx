import Link from "next/link";

import { formatDataHora } from "@/core/lib/format";
import { Badge, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/core/ui";

import type { AcessoDocumento } from "../queries";

const ACAO: Record<AcessoDocumento["acao"], { label: string; tone: "info" | "neutral" | "warning" | "danger" }> = {
  upload: { label: "Enviou", tone: "info" },
  download: { label: "Baixou", tone: "neutral" },
  visualizou: { label: "Visualizou", tone: "neutral" },
  excluiu: { label: "Excluiu", tone: "danger" },
};

export function AcessosDocumentosList({ acessos }: { acessos: AcessoDocumento[] }) {
  if (acessos.length === 0) {
    return (
      <EmptyState
        title="Nenhum acesso registrado"
        description="Cada envio e download de documento aparece aqui."
      />
    );
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Quando</TH>
          <TH>Quem</TH>
          <TH>Ação</TH>
          <TH>Documento</TH>
          <TH>Empresa</TH>
        </TR>
      </THead>
      <TBody>
        {acessos.map((a) => {
          const acao = ACAO[a.acao] ?? { label: a.acao, tone: "neutral" as const };
          const empresa = a.empresa;
          const titulo = a.documento?.titulo ?? a.documento_titulo ?? "—";
          return (
            <TR key={a.id}>
              <TD className="whitespace-nowrap text-xs">{formatDataHora(a.created_at)}</TD>
              <TD>{a.pessoa?.nome ?? "—"}</TD>
              <TD>
                <Badge tone={acao.tone}>{acao.label}</Badge>
              </TD>
              <TD>
                {titulo}
                {!a.documento ? (
                  <span className="ml-1.5 text-xs text-[var(--color-text-faint)]">(excluído)</span>
                ) : null}
              </TD>
              <TD>
                {empresa ? (
                  <Link
                    href={`/documentos?empresa=${empresa.id}`}
                    className="text-brand hover:underline"
                  >
                    {empresa.nome_fantasia || empresa.razao_social}
                  </Link>
                ) : (
                  "—"
                )}
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
