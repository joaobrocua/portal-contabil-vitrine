# Módulo: Administração do Sistema

Parâmetros do escritório, catálogos configuráveis e trilhas de auditoria
(itens 17 e 18). Somente `admin`.

**Tabelas:** `escritorio_config` (linha única), `catalogos`,
`historico` (log de ações — alimentado por `core/lib/historico`).

**Catálogos:** só aparecem (e só aceitam item novo) os que alguma tela usa —
lista em `catalogos.ts`. Hoje: `tipo_documento`. `tipo_tarefa`,
`tipo_obrigacao` e `status_customizado` existem no banco, mas nada os lê;
ficam fora da tela até ganharem uso.

**Rota:** `/administracao?aba=config|catalogos|historico|acessos|seguranca`.
As abas "Acessos a documentos" e "Segurança" são montadas pela página com
`@/modules/documentos` (`listarAcessosDocumentos`) e
`@/core/auth/eventos-seguranca` (`listarEventosSeguranca`).

**API pública** (`index.ts`): `getConfig`, `listCatalogos`, `ConfigForm`,
`CatalogosPanel`.
