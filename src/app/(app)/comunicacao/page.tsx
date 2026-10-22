import { assertModuleEnabled, requireSession } from "@/core/auth/session";
import { ModuleComingSoon } from "@/core/layout/module-coming-soon";

export const metadata = { title: "Comunicação & Solicitações" };

export default async function ComunicacaoPage() {
  // Módulo desligado (V3) → 404, como as demais rotas de módulo.
  assertModuleEnabled("comunicacao");
  await requireSession();
  return <ModuleComingSoon id="comunicacao" />;
}
