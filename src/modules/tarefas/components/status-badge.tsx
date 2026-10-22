import {
  TAREFA_STATUS_LABEL,
  TAREFA_STATUS_TONE,
  type TarefaStatus,
} from "@/core/types/domain";
import { Badge } from "@/core/ui";

export function TarefaStatusBadge({ status }: { status: TarefaStatus }) {
  return (
    <Badge tone={TAREFA_STATUS_TONE[status]}>{TAREFA_STATUS_LABEL[status]}</Badge>
  );
}
