/** Módulo Imposto de Renda — API pública. */

export {
  listDeclaracoesIr,
  paginarDeclaracoesIr,
  getDeclaracaoIr,
  contarIr,
  type DeclaracaoIrItem,
  type DeclaracaoIrFiltros,
} from "./queries";

export { DeclaracoesIrList } from "./components/declaracoes-list";
export { DeclaracaoIrDetalhesForm } from "./components/detalhes-form";
export { GerarDeclaracoesIr } from "./components/gerar-declaracoes";
export { DeclaracaoIrStatusBadge } from "./components/status-badge";
export { DeclaracaoIrStatusPicker } from "./components/status-picker";
