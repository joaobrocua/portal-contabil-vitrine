import { menuFor } from "@/core/config/modules";
import type { SessionContext } from "@/core/auth/session";
import { AbrirCalendario, ToastProvider } from "@/core/ui";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/** Estrutura da área autenticada: sidebar + topbar + conteúdo. */
export function AppShell({
  session,
  children,
}: {
  session: SessionContext;
  children: React.ReactNode;
}) {
  const grupos = menuFor(session.profile.papel);

  return (
    <ToastProvider>
      <AbrirCalendario />
      <div className="flex h-dvh overflow-hidden">
        <Sidebar grupos={grupos} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar session={session} grupos={grupos} />
          <main className="flex-1 overflow-y-auto bg-[var(--color-bg)]">
            <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
