import { assertModuleEnabled, requireSession } from "@/core/auth/session";
import { ModuleComingSoon } from "@/core/layout/module-coming-soon";

export const metadata = { title: "Relatórios" };

export default async function RelatoriosPage() {
  // Módulo desligado (V3) → 404, como as demais rotas de módulo.
  assertModuleEnabled("relatorios");
  await requireSession();
  return <ModuleComingSoon id="relatorios" />;
}
