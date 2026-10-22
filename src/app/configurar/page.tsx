import { redirect } from "next/navigation";

import { brand } from "@/core/config/brand";
import { isSupabaseConfigured } from "@/core/db/env";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  LogoMark,
} from "@/core/ui";

export const metadata = { title: "Configuração" };

export default function ConfigurarPage() {
  if (isSupabaseConfigured) redirect("/painel");

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <LogoMark className="size-10" />
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">
            {brand.nome} — Portal
          </h1>
          <p className="text-sm text-neutral-500">Configuração inicial</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conecte o Supabase para começar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-neutral-700">
          <p>
            O sistema usa o Supabase para autenticação, banco de dados e
            armazenamento de arquivos. Siga os passos:
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Crie um projeto em{" "}
              <a
                className="font-medium text-brand underline"
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
              >
                supabase.com/dashboard
              </a>
              .
            </li>
            <li>
              Em <strong>Project Settings → API</strong>, copie a{" "}
              <code className="rounded bg-neutral-100 px-1">Project URL</code>, a{" "}
              <code className="rounded bg-neutral-100 px-1">anon public key</code>{" "}
              e a{" "}
              <code className="rounded bg-neutral-100 px-1">
                service_role key
              </code>
              .
            </li>
            <li>
              Duplique <code className="rounded bg-neutral-100 px-1">.env.example</code>{" "}
              para <code className="rounded bg-neutral-100 px-1">.env.local</code>{" "}
              e preencha os valores.
            </li>
            <li>
              No <strong>SQL Editor</strong> do Supabase, rode as migrations em{" "}
              <code className="rounded bg-neutral-100 px-1">
                supabase/migrations/
              </code>{" "}
              na ordem.
            </li>
            <li>
              Rode <code className="rounded bg-neutral-100 px-1">supabase/seed.sql</code>{" "}
              para criar o primeiro usuário administrador e reinicie{" "}
              <code className="rounded bg-neutral-100 px-1">npm run dev</code>.
            </li>
          </ol>
          <p className="text-neutral-500">
            Instruções completas no{" "}
            <code className="rounded bg-neutral-100 px-1">README.md</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
