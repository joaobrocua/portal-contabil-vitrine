/** Empresa numa lista de escolha (seletor com busca). Só o necessário para achar e mostrar. */
export interface EmpresaOpcao {
  id: string;
  /** Nome fantasia, ou a razão social se não houver. */
  nome: string;
  razao: string;
  /** Só os 14 dígitos. */
  cnpj: string;
}
