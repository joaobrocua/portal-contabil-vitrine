/**
 * Catálogos que alguma tela do sistema realmente lê. Só esses aparecem em
 * Administração → Catálogos e só neles dá pra cadastrar item.
 *
 * `tipo_tarefa`, `tipo_obrigacao` e `status_customizado` existem no banco
 * desde a V1, mas nada os consome (tarefas não têm categoria; tipo de
 * obrigação e status são listas fixas no código). Mostrá-los fazia o admin
 * cadastrar itens que não apareciam em lugar nenhum. Para ligar um deles,
 * primeiro faça a tela que o usa e depois acrescente aqui.
 */
export const CATALOGOS_EM_USO = {
  tipo_documento: "Tipos de documento",
} as const;

export type TipoCatalogo = keyof typeof CATALOGOS_EM_USO;

export const TIPOS_CATALOGO = Object.keys(CATALOGOS_EM_USO) as [
  TipoCatalogo,
  ...TipoCatalogo[],
];
