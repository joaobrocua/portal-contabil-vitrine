/**
 * Módulo Tarefas & Processos — API pública.
 * Motor central: outras áreas (Fiscal, DP, Contábil...) são visões sobre isto.
 */

export {
  listTarefas,
  paginarTarefas,
  getTarefa,
  contarTarefas,
  empresasParaSelecao,
  listModelos,
  getModelo,
  documentosDaTarefa,
  type TarefaListItem,
  type TarefaDetalhe,
  type TarefaFiltros,
  type DocumentoVinculado,
} from "./queries";

export { prazoDoModelo } from "./schema";

export { TarefaForm } from "./components/tarefa-form";
export { TarefasList } from "./components/tarefas-list";
export { Checklist } from "./components/checklist";
export { StatusPicker } from "./components/status-picker";
export { TarefaStatusBadge } from "./components/status-badge";
export { ModelosPanel } from "./components/modelos-panel";
export { ModeloSelect } from "./components/modelo-select";
export {
  VincularDocumento,
  DesvincularDocumento,
} from "./components/documentos-vinculados";
