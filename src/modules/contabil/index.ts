/** Módulo Contábil — API pública. */

export {
  listFechamentos,
  paginarFechamentos,
  getFechamento,
  contarContabil,
  empresasParaContabil,
  type FechamentoItem,
  type FechamentoDetalhe,
  type FechamentoFiltros,
} from "./queries";

export { AbrirFechamentos } from "./components/abrir-fechamentos";
export { ChecklistFechamento } from "./components/checklist";
export { FechamentosList } from "./components/fechamentos-list";
export { FechamentoResponsavelForm } from "./components/responsavel-form";
export { FechamentoStatusBadge } from "./components/status-badge";
export { FechamentoStatusPicker } from "./components/status-picker";
