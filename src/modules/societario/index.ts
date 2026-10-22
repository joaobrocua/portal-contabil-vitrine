/** Módulo Societário — API pública. */

export {
  listProcessosSocietarios,
  paginarProcessosSocietarios,
  getProcessoSocietario,
  contarSocietario,
  empresasParaSocietario,
  type ProcessoSocietarioItem,
  type ProcessoSocietarioDetalhe,
  type ProcessoSocietarioFiltros,
} from "./queries";

export { ChecklistProcessoSocietario } from "./components/checklist";
export { ProcessoSocietarioForm } from "./components/processo-form";
export { ProcessosSocietariosList } from "./components/processos-list";
export { ProcessoSocietarioStatusBadge } from "./components/status-badge";
export { ProcessoSocietarioStatusPicker } from "./components/status-picker";
