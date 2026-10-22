/**
 * Mensagem segura pra devolver ao usuário quando uma operação no banco
 * falha sem já ter sido tratada com uma mensagem específica antes (ex.:
 * violação de CNPJ duplicado). `error.message` do Postgres/PostgREST pode
 * conter nome de tabela, coluna, constraint ou até um pedaço da query —
 * detalhe interno de implementação que não deveria aparecer pra quem está
 * usando o sistema (inclusive `cliente`, que também dispara algumas dessas
 * actions). O erro de verdade é logado no servidor — só some da tela.
 */
export function mensagemErroBanco(error: { message: string; code?: string }): string {
  console.error("[erro de banco]", error.code ?? "(sem código)", error.message);
  return "Não foi possível concluir a operação. Tente novamente em instantes.";
}
