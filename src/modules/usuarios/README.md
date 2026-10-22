# Módulo: Usuários & Permissões

Contas de acesso e papéis (item 15). Somente `admin`.

**Tabela:** `profiles` (criada por trigger a partir de `auth.users`).

**Rota:** `/usuarios`.

**API pública** (`index.ts`): `listarProfiles`, `UsuariosTable`, `NovoUsuarioForm`.

Criar usuário usa a **service role** (`SUPABASE_SERVICE_ROLE_KEY`) via
`auth.admin.createUser`. O `user_metadata` (`nome`, `papel`, `departamento`)
alimenta o trigger `handle_new_user`.
