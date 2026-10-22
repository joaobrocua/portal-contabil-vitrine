# Módulo: Clientes & Empresas

Cadastro das empresas-clientes, seus **sócios** e **contatos** (item 4 e 5 da
especificação).

**Tabelas:** `empresas`, `socios`, `contatos`.

**Rotas:** `/empresas`, `/empresas/nova`, `/empresas/[id]` (abas: dados,
contatos, sócios, tarefas, documentos, histórico), `/empresas/[id]/editar`.

**API pública** (`index.ts`): `listEmpresas`, `getEmpresa`, `getSocios`,
`getContatos`, `getResponsaveis`, `contarEmpresas`, `EmpresaForm`,
`EmpresasTable`, `SociosPanel`, `ContatosPanel`.

Um contato só tem acesso ao portal quando `profile_id` aponta para um usuário
(criado em Usuários & Permissões).
