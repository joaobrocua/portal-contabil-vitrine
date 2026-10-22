import {
  EVENTO_SEGURANCA_LABEL,
  type EventoSegurancaItem,
} from "@/core/auth/eventos-seguranca";
import { formatDataHora } from "@/core/lib/format";
import { Badge, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/core/ui";

export function EventosSegurancaList({
  eventos,
}: {
  eventos: EventoSegurancaItem[];
}) {
  if (eventos.length === 0) {
    return (
      <EmptyState
        title="Nenhum evento registrado"
        description="Logins, trocas de senha e criação de usuários aparecem aqui."
      />
    );
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Quando</TH>
          <TH>Evento</TH>
          <TH>Quem</TH>
          <TH>IP</TH>
          <TH>Resultado</TH>
        </TR>
      </THead>
      <TBody>
        {eventos.map((e) => (
          <TR key={e.id}>
            <TD className="whitespace-nowrap text-xs">{formatDataHora(e.created_at)}</TD>
            <TD>{EVENTO_SEGURANCA_LABEL[e.tipo] ?? e.tipo}</TD>
            <TD className="break-all">{e.quem}</TD>
            <TD className="text-xs text-[var(--color-text-dim)]">{e.ip ?? "—"}</TD>
            <TD>
              {e.sucesso ? (
                <Badge tone="success">OK</Badge>
              ) : (
                <Badge tone="danger">Falhou</Badge>
              )}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
