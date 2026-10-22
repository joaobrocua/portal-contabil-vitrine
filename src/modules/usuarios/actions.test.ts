import { beforeEach, describe, expect, it, vi } from "vitest";

import { limiteExcedido, registrarEvento } from "@/core/auth/rate-limit";
import { requireRole } from "@/core/auth/session";
import { createSupabaseAdminClient } from "@/core/db/admin";
import { createSupabaseServerClient } from "@/core/db/server";
import { registrarHistorico } from "@/core/lib/historico";

vi.mock("@/core/auth/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/core/auth/rate-limit", () => ({
  limiteExcedido: vi.fn(),
  registrarEvento: vi.fn(),
}));
vi.mock("@/core/db/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/core/db/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/core/lib/historico", () => ({ registrarHistorico: vi.fn() }));
vi.mock("@/core/db/env", () => ({ SUPABASE_SERVICE_ROLE_KEY: "fake-service-role-key" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { atualizarUsuario, criarUsuario, redefinirSenhaUsuario } = await import(
  "./actions"
);

const requireRoleMock = vi.mocked(requireRole);
const limiteExcedidoMock = vi.mocked(limiteExcedido);
const registrarEventoMock = vi.mocked(registrarEvento);
const adminMock = vi.mocked(createSupabaseAdminClient);
const serverClientMock = vi.mocked(createSupabaseServerClient);
const registrarHistoricoMock = vi.mocked(registrarHistorico);

const ADMIN_ID = "550e8400-e29b-41d4-a716-446655440099";
const OUTRO_USUARIO_ID = "550e8400-e29b-41d4-a716-446655440000";

const SESSION_ADMIN = {
  userId: ADMIN_ID,
  email: "admin@escritorio.com.br",
  profile: { papel: "admin" },
} as unknown as Awaited<ReturnType<typeof requireRole>>;

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function mockAdminClient(opts: {
  createUser: { data: unknown; error: unknown };
  upsertError?: unknown;
}) {
  const upsert = vi.fn().mockResolvedValue({ error: opts.upsertError ?? null });
  const client = {
    auth: { admin: { createUser: vi.fn().mockResolvedValue(opts.createUser) } },
    from: vi.fn(() => ({ upsert })),
  };
  adminMock.mockReturnValue(client as unknown as ReturnType<typeof createSupabaseAdminClient>);
  return { client, upsert };
}

function mockServerClient(
  updateError: unknown = null,
  opts: { alvo?: { papel: string; ativo: boolean } | null; outrosAdmins?: number; erroAlvo?: boolean } = {},
) {
  const eq = vi.fn().mockResolvedValue({ error: updateError });
  const update = vi.fn(() => ({ eq }));
  // select(...) usado pela trava do "último admin": busca o alvo e conta os outros admins ativos
  const consulta = {
    eq: () => consulta,
    neq: () => Promise.resolve({ count: opts.outrosAdmins ?? 1, error: null }),
    maybeSingle: () =>
      Promise.resolve({
        data: opts.alvo === undefined ? { papel: "fiscal", ativo: true } : opts.alvo,
        error: opts.erroAlvo ? { message: "falha" } : null,
      }),
  };
  serverClientMock.mockResolvedValue({
    from: vi.fn(() => ({ update, select: () => consulta })),
  } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
  return { update, eq };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue(SESSION_ADMIN);
  limiteExcedidoMock.mockResolvedValue(false);
});

const CAMPOS_VALIDOS = {
  nome: "Fulano de Tal",
  email: "fulano@escritorio.com.br",
  senha: "senha-com-mais-de-8",
  papel: "fiscal",
};

describe("criarUsuario", () => {
  it("exige papel admin antes de qualquer outra coisa", async () => {
    mockAdminClient({ createUser: { data: { user: { id: "u1" } }, error: null } });
    await criarUsuario(null, formData(CAMPOS_VALIDOS));
    expect(requireRoleMock).toHaveBeenCalledWith("admin");
  });

  it("recusa quando o limite de criação por hora foi atingido", async () => {
    limiteExcedidoMock.mockResolvedValue(true);
    const { client } = mockAdminClient({
      createUser: { data: { user: { id: "u1" } }, error: null },
    });
    const r = await criarUsuario(null, formData(CAMPOS_VALIDOS));
    expect(r.ok).toBe(false);
    expect(client.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("conta toda tentativa (não só falha) — é trava de volume, não de senha", async () => {
    mockAdminClient({ createUser: { data: { user: { id: "u1" } }, error: null } });
    await criarUsuario(null, formData(CAMPOS_VALIDOS));
    expect(limiteExcedidoMock).toHaveBeenCalledWith(
      expect.objectContaining({ apenasFalhas: false, chave: ADMIN_ID }),
    );
  });

  it("rejeita e-mail inválido sem chamar o client admin", async () => {
    const { client } = mockAdminClient({
      createUser: { data: { user: { id: "u1" } }, error: null },
    });
    const r = await criarUsuario(
      null,
      formData({ ...CAMPOS_VALIDOS, email: "não-é-email" }),
    );
    expect(r.ok).toBe(false);
    expect(client.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("rejeita senha curta", async () => {
    const r = await criarUsuario(
      null,
      formData({ ...CAMPOS_VALIDOS, senha: "123" }),
    );
    expect(r.ok).toBe(false);
  });

  it("cria o usuário e o profile, registra histórico, no caminho feliz", async () => {
    const { client, upsert } = mockAdminClient({
      createUser: { data: { user: { id: "novo-id" } }, error: null },
    });
    const r = await criarUsuario(null, formData(CAMPOS_VALIDOS));

    expect(r.ok).toBe(true);
    expect(client.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "fulano@escritorio.com.br",
        password: "senha-com-mais-de-8",
        email_confirm: true,
      }),
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "novo-id", papel: "fiscal", ativo: true }),
    );
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({ entidade: "usuario", entidadeId: "novo-id" }),
    );
  });

  it("erro ao gravar o perfil NÃO é ignorado: avisa que a conta foi criada mas o papel não", async () => {
    mockAdminClient({
      createUser: { data: { user: { id: "novo-id" } }, error: null },
      upsertError: { message: "violates check constraint" },
    });
    const r = await criarUsuario(null, formData(CAMPOS_VALIDOS));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/conta foi criada/i);
      expect(r.error).not.toMatch(/constraint/);
    }
    expect(registrarHistoricoMock).not.toHaveBeenCalled();
  });

  it("registra o evento de segurança como sucesso/falha de acordo com o resultado", async () => {
    mockAdminClient({
      createUser: { data: { user: { id: "novo-id" } }, error: null },
    });
    await criarUsuario(null, formData(CAMPOS_VALIDOS));
    expect(registrarEventoMock).toHaveBeenCalledWith(
      "criar_usuario",
      ADMIN_ID,
      true,
      null,
    );
  });

  it("propaga erro do GoTrue (ex. e-mail já cadastrado) e registra falha no evento", async () => {
    mockAdminClient({
      createUser: { data: { user: null }, error: { message: "E-mail já existe" } },
    });
    const r = await criarUsuario(null, formData(CAMPOS_VALIDOS));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("E-mail já existe");
    expect(registrarEventoMock).toHaveBeenCalledWith(
      "criar_usuario",
      ADMIN_ID,
      false,
      null,
    );
  });
});

function mockBanClient(banError: unknown = null) {
  const updateUserById = vi.fn().mockResolvedValue({ error: banError });
  adminMock.mockReturnValue({
    auth: { admin: { updateUserById } },
  } as unknown as ReturnType<typeof createSupabaseAdminClient>);
  return { updateUserById };
}

describe("atualizarUsuario", () => {
  const INPUT_BASE = { id: OUTRO_USUARIO_ID, papel: "fiscal", departamento: "", ativo: true };

  beforeEach(() => {
    mockBanClient();
  });

  it("desativar bane o usuário no GoTrue (derruba o acesso, não só o perfil)", async () => {
    mockServerClient();
    const { updateUserById } = mockBanClient();
    const r = await atualizarUsuario({ ...INPUT_BASE, ativo: false });
    expect(r.ok).toBe(true);
    expect(updateUserById).toHaveBeenCalledWith(OUTRO_USUARIO_ID, {
      ban_duration: "876000h",
    });
  });

  it("reativar remove o ban", async () => {
    mockServerClient();
    const { updateUserById } = mockBanClient();
    await atualizarUsuario({ ...INPUT_BASE, ativo: true });
    expect(updateUserById).toHaveBeenCalledWith(OUTRO_USUARIO_ID, {
      ban_duration: "none",
    });
  });

  it("falha no ban vira erro visível (não finge que bloqueou)", async () => {
    mockServerClient();
    mockBanClient({ message: "gotrue fora do ar" });
    const r = await atualizarUsuario({ ...INPUT_BASE, ativo: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/bloquear/);
  });

  it("não mexe no ban se a atualização do perfil falhou", async () => {
    mockServerClient({ message: "rls" });
    const { updateUserById } = mockBanClient();
    const r = await atualizarUsuario({ ...INPUT_BASE, ativo: false });
    expect(r.ok).toBe(false);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("exige papel admin", async () => {
    mockServerClient();
    await atualizarUsuario(INPUT_BASE);
    expect(requireRoleMock).toHaveBeenCalledWith("admin");
  });

  it("impede o admin de desativar a própria conta", async () => {
    const { update } = mockServerClient();
    const r = await atualizarUsuario({
      ...INPUT_BASE,
      id: ADMIN_ID, // mesmo id da sessão
      ativo: false,
    });
    expect(r.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("permite o admin manter a própria conta ativa e trocar o papel", async () => {
    mockServerClient();
    const r = await atualizarUsuario({ ...INPUT_BASE, id: ADMIN_ID, ativo: true });
    expect(r.ok).toBe(true);
  });

  it("permite desativar OUTRO usuário normalmente", async () => {
    const { update, eq } = mockServerClient();
    const r = await atualizarUsuario({ ...INPUT_BASE, ativo: false });
    expect(r.ok).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ papel: "fiscal", ativo: false }),
    );
    expect(eq).toHaveBeenCalledWith("id", INPUT_BASE.id);
  });

  describe("trava do último administrador", () => {
    const ALVO_ADMIN = { papel: "admin", ativo: true };

    it("não deixa desativar o único admin ativo", async () => {
      const { update } = mockServerClient(null, { alvo: ALVO_ADMIN, outrosAdmins: 0 });
      const r = await atualizarUsuario({ ...INPUT_BASE, papel: "admin", ativo: false });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/último administrador/i);
      expect(update).not.toHaveBeenCalled();
    });

    it("não deixa rebaixar o único admin ativo (nem a si mesmo)", async () => {
      const { update } = mockServerClient(null, { alvo: ALVO_ADMIN, outrosAdmins: 0 });
      const r = await atualizarUsuario({ ...INPUT_BASE, id: ADMIN_ID, papel: "fiscal", ativo: true });
      expect(r.ok).toBe(false);
      expect(update).not.toHaveBeenCalled();
    });

    it("corrida entre dois admins: se o trigger do banco recusar, a mensagem é a do último admin", async () => {
      mockServerClient({ code: "23514", message: "O escritório precisa ter ao menos um administrador ativo." }, { alvo: ALVO_ADMIN, outrosAdmins: 1 });
      const r = await atualizarUsuario({ ...INPUT_BASE, papel: "fiscal", ativo: true });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/último administrador/i);
    });

    it("erro ao consultar o alvo NÃO libera a alteração (a trava não pode falhar aberta)", async () => {
      const { update } = mockServerClient(null, { alvo: ALVO_ADMIN, outrosAdmins: 1, erroAlvo: true });
      const r = await atualizarUsuario({ ...INPUT_BASE, papel: "fiscal", ativo: true });
      expect(r.ok).toBe(false);
      expect(update).not.toHaveBeenCalled();
    });

    it("permite rebaixar um admin quando há outro admin ativo", async () => {
      mockServerClient(null, { alvo: ALVO_ADMIN, outrosAdmins: 1 });
      const r = await atualizarUsuario({ ...INPUT_BASE, papel: "fiscal", ativo: true });
      expect(r.ok).toBe(true);
    });

    it("não interfere em quem continua admin e ativo", async () => {
      mockServerClient(null, { alvo: ALVO_ADMIN, outrosAdmins: 0 });
      const r = await atualizarUsuario({ ...INPUT_BASE, papel: "admin", ativo: true });
      expect(r.ok).toBe(true);
    });

    it("não conta como último admin um alvo que não é admin", async () => {
      mockServerClient(null, { alvo: { papel: "fiscal", ativo: true }, outrosAdmins: 0 });
      const r = await atualizarUsuario({ ...INPUT_BASE, ativo: false });
      expect(r.ok).toBe(true);
    });
  });

  it("rejeita 'ativo' que não seja boolean (o texto \"false\" viraria true com coerção)", async () => {
    const { update } = mockServerClient();
    const r = await atualizarUsuario({ ...INPUT_BASE, ativo: "false" as unknown as boolean });
    expect(r.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejeita id que não é uuid", async () => {
    mockServerClient();
    const r = await atualizarUsuario({ ...INPUT_BASE, id: "não-é-uuid" });
    expect(r.ok).toBe(false);
  });

  it("aceita departamento null — é exatamente o que usuarios-table.tsx manda quando o campo fica vazio (dep || null)", async () => {
    const { update } = mockServerClient();
    const r = await atualizarUsuario({ ...INPUT_BASE, departamento: null });
    expect(r.ok).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ departamento: null }),
    );
  });

  it("normaliza departamento vazio ('') pra null igual a null direto", async () => {
    const { update } = mockServerClient();
    await atualizarUsuario({ ...INPUT_BASE, departamento: "" });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ departamento: null }),
    );
  });

  it("mantém um departamento válido quando informado", async () => {
    const { update } = mockServerClient();
    await atualizarUsuario({ ...INPUT_BASE, departamento: "fiscal" });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ departamento: "fiscal" }),
    );
  });

  it("registra histórico da alteração", async () => {
    mockServerClient();
    await atualizarUsuario(INPUT_BASE);
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({ entidade: "usuario", entidadeId: INPUT_BASE.id }),
    );
  });
});

describe("redefinirSenhaUsuario", () => {
  const INPUT = { id: OUTRO_USUARIO_ID, senha: "provisoria-123" };

  it("exige papel admin", async () => {
    mockBanClient();
    await redefinirSenhaUsuario(INPUT);
    expect(requireRoleMock).toHaveBeenCalledWith("admin");
  });

  it("define a senha provisória via GoTrue e registra histórico sem a senha", async () => {
    const { updateUserById } = mockBanClient();
    const r = await redefinirSenhaUsuario(INPUT);
    expect(r.ok).toBe(true);
    expect(updateUserById).toHaveBeenCalledWith(OUTRO_USUARIO_ID, {
      password: "provisoria-123",
    });
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({ entidadeId: OUTRO_USUARIO_ID, acao: "redefiniu_senha" }),
    );
    expect(JSON.stringify(registrarHistoricoMock.mock.calls)).not.toContain(
      "provisoria-123",
    );
  });

  it("recusa a própria conta (tem que ser por Minha conta, com a senha atual)", async () => {
    const { updateUserById } = mockBanClient();
    const r = await redefinirSenhaUsuario({ ...INPUT, id: ADMIN_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Minha conta/);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("recusa senha curta sem chamar o GoTrue", async () => {
    const { updateUserById } = mockBanClient();
    const r = await redefinirSenhaUsuario({ ...INPUT, senha: "123" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/8 caracteres/);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("recusa id que não é uuid", async () => {
    mockBanClient();
    const r = await redefinirSenhaUsuario({ ...INPUT, id: "não-é-uuid" });
    expect(r.ok).toBe(false);
  });

  it("respeita o limite de volume, contando toda tentativa", async () => {
    limiteExcedidoMock.mockResolvedValue(true);
    const { updateUserById } = mockBanClient();
    const r = await redefinirSenhaUsuario(INPUT);
    expect(r.ok).toBe(false);
    expect(updateUserById).not.toHaveBeenCalled();
    expect(limiteExcedidoMock).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "redefinir_senha", apenasFalhas: false }),
    );
  });

  it("propaga erro do GoTrue e registra a falha no evento de segurança", async () => {
    mockBanClient({ message: "Password should be stronger" });
    const r = await redefinirSenhaUsuario(INPUT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Password should be stronger");
    expect(registrarEventoMock).toHaveBeenCalledWith(
      "redefinir_senha",
      ADMIN_ID,
      false,
      null,
    );
    expect(registrarHistoricoMock).not.toHaveBeenCalled();
  });
});
