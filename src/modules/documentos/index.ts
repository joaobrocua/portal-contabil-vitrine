/** Módulo Central de Documentos — API pública. */

export {
  listDocumentos,
  paginarPastas,
  categoriasDocumento,
  getEmpresaNome,
  listarAcessosDocumentos,
  type DocumentoItem,
  type EmpresaPasta,
  type AcessoDocumento,
} from "./queries";

export { departamentosParaEnvio } from "./schema";
export { UploadDocumento } from "./components/upload-documento";
export { DocumentoLinha } from "./components/documento-linha";
export { AcessosDocumentosList } from "./components/acessos-list";
