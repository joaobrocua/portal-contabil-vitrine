import {
  PROCESSO_SOCIETARIO_STATUS_LABEL,
  PROCESSO_SOCIETARIO_STATUS_TONE,
  type ProcessoSocietarioStatus,
} from "@/core/types/domain";
import { Badge } from "@/core/ui";

export function ProcessoSocietarioStatusBadge({
  status,
}: {
  status: ProcessoSocietarioStatus;
}) {
  return (
    <Badge tone={PROCESSO_SOCIETARIO_STATUS_TONE[status]}>
      {PROCESSO_SOCIETARIO_STATUS_LABEL[status]}
    </Badge>
  );
}
