import {
  OBRIGACAO_STATUS_LABEL,
  type GradeEstado,
  type ObrigacaoStatus,
} from "@/core/types/domain";
import { Badge } from "@/core/ui";

const TONE: Record<ObrigacaoStatus, Parameters<typeof Badge>[0]["tone"]> = {
  pendente: "neutral",
  em_andamento: "info",
  gerada: "warning",
  disponivel: "brand",
  entregue: "success",
  paga: "success",
  dispensada: "neutral",
};

export function ObrigacaoStatusBadge({
  status,
  atrasada,
}: {
  status: ObrigacaoStatus;
  atrasada?: boolean;
}) {
  if (atrasada && !["entregue", "paga", "dispensada"].includes(status))
    return <Badge tone="danger">Atrasada</Badge>;
  return <Badge tone={TONE[status]}>{OBRIGACAO_STATUS_LABEL[status]}</Badge>;
}

export const ESTADO_COR: Record<GradeEstado, string> = {
  ok: "bg-[var(--color-ok)]",
  andamento: "bg-[var(--color-ouro)]",
  atraso: "bg-[var(--color-carmine)]",
  vazio: "bg-[var(--color-surface-3)]",
};
