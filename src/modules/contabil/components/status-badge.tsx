import { FECHAMENTO_STATUS_LABEL, type FechamentoStatus } from "@/core/types/domain";
import { Badge } from "@/core/ui";

const FECHAMENTO_TONE: Record<FechamentoStatus, Parameters<typeof Badge>[0]["tone"]> = {
  aberto: "neutral",
  em_andamento: "info",
  revisao: "warning",
  fechado: "success",
  entregue: "success",
};

export function FechamentoStatusBadge({ status }: { status: FechamentoStatus }) {
  return <Badge tone={FECHAMENTO_TONE[status]}>{FECHAMENTO_STATUS_LABEL[status]}</Badge>;
}
