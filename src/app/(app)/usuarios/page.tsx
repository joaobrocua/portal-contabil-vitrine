import { requireRole } from "@/core/auth/session";
import { PageHeader } from "@/core/ui";
import {
  listarProfiles,
  NovoUsuarioForm,
  UsuariosTable,
} from "@/modules/usuarios";

export const metadata = { title: "Usuários & Permissões" };

export default async function UsuariosPage() {
  const session = await requireRole("admin");
  const usuarios = await listarProfiles();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários & Permissões"
        description="Contas de acesso, papéis e níveis de permissão."
      />
      <NovoUsuarioForm />
      <UsuariosTable usuarios={usuarios} selfId={session.userId} />
    </div>
  );
}
