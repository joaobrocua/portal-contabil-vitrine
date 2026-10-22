# Módulo: Central de Documentos

Arquivos das empresas organizados por departamento (item 12).

**Tabelas:** `documentos`, `documento_acessos` (trilha LGPD de upload/download).
**Storage:** bucket privado `documentos`, caminho `documentos/<empresa_id>/<uuid>.<ext>`.

**Rota:** `/documentos` (pastas por empresa) · `/documentos?empresa=<id>&dep=<departamento>`.
A trilha de acessos aparece em `/administracao?aba=acessos`.

**API pública** (`index.ts`): `listDocumentos`, `paginarPastas`, `departamentosParaEnvio`,
`categoriasDocumento`, `getEmpresaNome`, `listarAcessosDocumentos`,
`UploadDocumento`, `DocumentoLinha`, `AcessosDocumentosList`.

Upload: o navegador envia o arquivo direto ao Storage (RLS), depois a server
action `registrarDocumento` grava a linha. Cliente envia com status `pendente`;
staff revisa (recebido/aprovado/rejeitado/correção).

Download: `urlDownload(documentoId)` busca o caminho do arquivo no registro do
banco (nunca aceita caminho vindo do navegador), então a trilha de acessos
sempre aponta pro documento baixado de fato.
