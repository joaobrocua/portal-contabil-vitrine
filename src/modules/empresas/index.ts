/**
 * Módulo Clientes & Empresas — API pública.
 * Fora do módulo, importe SEMPRE daqui (nunca de arquivos internos).
 */

export {
  paginarEmpresas,
  getEmpresa,
  getSocios,
  getContatos,
  getResponsaveis,
  contarEmpresas,
  empresasDoCliente,
  type EmpresaListItem,
  type ContatoComAcesso,
  type EmpresaClienteItem,
} from "./queries";

export { EmpresaForm } from "./components/empresa-form";
export { AlternarAtivoEmpresa } from "./components/alternar-ativo-empresa";
export { EmpresasTable } from "./components/empresas-table";
export { SociosPanel } from "./components/socios-panel";
export { ContatosPanel } from "./components/contatos-panel";
export { PendenciasView } from "./components/pendencias-view";
export { AtencaoList } from "./components/atencao-list";
export {
  diagnosticarEmpresas,
  type DiagnosticoEmpresa,
  type Pendencia,
} from "./diagnostico";
