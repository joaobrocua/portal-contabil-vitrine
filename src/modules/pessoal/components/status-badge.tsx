import {
  EVENTO_DP_STATUS_LABEL,
  EVENTO_DP_STATUS_TONE,
  FOLHA_STATUS_LABEL,
  FUNCIONARIO_STATUS_LABEL,
  type EventoDpStatus,
  type FolhaStatus,
  type FuncionarioStatus,
} from "@/core/types/domain";
import { Badge } from "@/core/ui";

export function EventoDpStatusBadge({ status }: { status: EventoDpStatus }) {
  return (
    <Badge tone={EVENTO_DP_STATUS_TONE[status]}>
      {EVENTO_DP_STATUS_LABEL[status]}
    </Badge>
  );
}

const FUNC_TONE: Record<FuncionarioStatus, Parameters<typeof Badge>[0]["tone"]> = {
  ativo: "success",
  afastado: "warning",
  ferias: "info",
  desligado: "neutral",
};

export function FuncionarioStatusBadge({ status }: { status: FuncionarioStatus }) {
  return <Badge tone={FUNC_TONE[status]}>{FUNCIONARIO_STATUS_LABEL[status]}</Badge>;
}

const FOLHA_TONE: Record<FolhaStatus, Parameters<typeof Badge>[0]["tone"]> = {
  aberta: "neutral",
  em_processamento: "info",
  revisao: "warning",
  fechada: "success",
  transmitida: "success",
};

export function FolhaStatusBadge({ status }: { status: FolhaStatus }) {
  return <Badge tone={FOLHA_TONE[status]}>{FOLHA_STATUS_LABEL[status]}</Badge>;
}
