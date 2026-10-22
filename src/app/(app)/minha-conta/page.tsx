import { requireSession } from "@/core/auth/session";
import { MinhaContaForm } from "@/core/layout/minha-conta-form";
import { Card, CardContent, PageHeader } from "@/core/ui";

export const metadata = { title: "Minha conta" };

export default async function MinhaContaPage() {
  const session = await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minha conta"
        description={`${session.profile.nome} · ${session.email}`}
      />
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-4 font-display text-sm font-semibold text-[var(--color-text)]">
            Trocar senha
          </h2>
          <MinhaContaForm />
        </CardContent>
      </Card>
    </div>
  );
}
