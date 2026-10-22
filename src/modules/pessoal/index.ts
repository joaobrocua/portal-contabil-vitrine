/** Módulo Departamento Pessoal (V2) — API pública. */

export {
  listFuncionarios,
  paginarFuncionarios,
  getFuncionario,
  listEventosDp,
  paginarEventosDp,
  getEventoDp,
  listFolhas,
  contarPessoal,
  processosAbertosPorEmpresa,
  empresasParaPessoal,
  funcionariosParaSelecao,
  type FuncionarioItem,
  type FuncionarioFiltros,
  type EventoDpItem,
  type EventoDpDetalhe,
  type EventoDpFiltros,
  type FolhaItem,
} from "./queries";

export { FuncionarioForm } from "./components/funcionario-form";
export { FuncionariosList } from "./components/funcionarios-list";
export { EventoDpForm } from "./components/evento-form";
export { EventosDpList } from "./components/eventos-list";
export { ChecklistEventoDp } from "./components/checklist";
export { EventoDpStatusPicker } from "./components/status-picker";
export {
  EventoDpStatusBadge,
  FuncionarioStatusBadge,
  FolhaStatusBadge,
} from "./components/status-badge";
export { AbrirFolhas } from "./components/abrir-folhas";
export { FolhasList } from "./components/folhas-list";
