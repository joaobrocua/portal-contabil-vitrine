import { IR_STATUS_LABEL, IR_STATUS_TONE, type IrStatus } from "@/core/types/domain";
import { Badge } from "@/core/ui";

export function DeclaracaoIrStatusBadge({ status }: { status: IrStatus }) {
  return <Badge tone={IR_STATUS_TONE[status]}>{IR_STATUS_LABEL[status]}</Badge>;
}
