# Portal Contábil

Sistema de gestão para escritório de contabilidade (vitrine): clientes e
empresas, tarefas e processos, agenda de prazos, documentos e os
departamentos Fiscal, Pessoal, Contábil, Societário e Imposto de Renda.

- **Stack:** Next.js 16 (App Router), React 19, Tailwind v4, Supabase
  (Auth, Postgres, Storage).
- **Segurança:** autorização por papel no banco (RLS), acesso por
  departamento, limite de tentativas de login, trilha de auditoria.
- **Dados:** a demonstração usa apenas dados fictícios.

## Como rodar

```bash
cp .env.example .env.local   # preencha com as chaves do seu projeto Supabase
npm install
npm run dev
```

O banco é criado pelas migrations em `supabase/migrations` (ou pelo arquivo
único `supabase/_setup_completo.sql`).

## Comandos

- `npm run dev` — desenvolvimento
- `npm run typecheck` — tipos
- `npm run lint` — ESLint
- `npx vitest run` — testes
- `npm run build` — build de produção
