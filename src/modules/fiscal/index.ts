/** Módulo Fiscal (V2) — API pública. */

export {
  listObrigacoes,
  paginarObrigacoes,
  getObrigacao,
  gradeAnual,
  listRecorrencias,
  contarObrigacoes,
  obrigacoesAtrasadasPorEmpresa,
  empresasParaFiscal,
  type ObrigacaoItem,
  type ObrigacaoFiltros,
  type GradeLinha,
  type RecorrenciaItem,
} from "./queries";

export { ObrigacoesList } from "./components/obrigacoes-list";
export { GradeAnual } from "./components/grade-anual";
export { ObrigacaoForm } from "./components/obrigacao-form";
export { ObrigacaoStatusPicker } from "./components/status-picker";
export {
  ObrigacaoStatusBadge,
  ESTADO_COR,
} from "./components/status-badge";
export { GerarCompetencia } from "./components/gerar-competencia";
export { RecorrenciasPanel } from "./components/recorrencias-panel";
