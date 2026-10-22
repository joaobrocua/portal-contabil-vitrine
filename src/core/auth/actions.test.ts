import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/core/db/server";

import { requireSession } from "./session";
import { clientIp, confirmarSucesso, descartarEvento, limiteExcedido, registrarEvento } from "./rate-limit";

vi.mock("@/core/db/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("./session", () => ({ requireSession: vi.fn() }));
vi.mock("./rate-limit", () => ({
  clientIp: vi.fn(),
  confirmarSucesso: vi.fn(),
  descartarEvento: vi.fn(),
  limiteExcedido: vi.fn(),
  registrarEvento: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

// safeNextPath NÃO é mockado — é a função real, já testada isoladamente em
// safe-redirect.test.ts; usar a real aqui confirma que a action de fato a
// aplica no valor de "next" antes de devolver pro client.
const { signInWithPassword, signOut, trocarMinhaSenha } = await import(
  "./actions"
);

const serverClientMock = vi.mocked(createSupabaseServerClient);
const requireSessionMock = vi.mocked(requireSession);
const clientIpMock = vi.mocked(clientIp);
const limiteExcedidoMock = vi.mocked(limiteExcedido);
const registrarEventoMock = vi.mocked(registrarEvento);
const confirmarSucessoMock = vi.mocked(confirmarSucesso);
const descartarEventoMock = vi.mocked(descartarEvento);
const redirectMock = vi.mocked(redirect);

const SESSION = {
  userId: "user-1",
  email: "fulano@escritorio.com.br",
  profile: { papel: "fiscal" },
} as unknown as Awaited<ReturnType<typeof requireSession>>;

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function mockServerClient(
  signInError: unknown = null,
  profile: { ativo: boolean } | null = { ativo: true },
  updateError: unknown = null,
) {
  const signInWithPassword = vi.fn().mockResolvedValue({
    data: signInError ? { user: null } : { user: { id: "user-1" } },
    error: signInError,
  });
  const signOut = vi.fn().mockResolvedValue({ error: null });
  const updateUser = vi.fn().mockResolvedValue({ error: updateError });
  const single = vi.fn().mockResolvedValue({ data: profile });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  serverClientMock.mockResolvedValue({
    auth: { signInWithPassword, signOut, updateUser },
    from: vi.fn(() => ({ select })),
  } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
  return { signInWithPassword, signOut, updateUser };
}

beforeEach(() => {
  vi.clearAllMocks();
  clientIpMock.mockResolvedValue("203.0.113.7");
  limiteExcedidoMock.mockResolvedValue(false);
  registrarEventoMock.mockResolvedValue("evento-1");
  requireSessionMock.mockResolvedValue(SESSION);
});

describe("signInWithPassword", () => {
  it("recusa sem e-mail/senha, sem sequer checar o limite de tentativas", async () => {
    const r = await signInWithPassword(
      null,
      formData({ email: "", password: "" }),
    );
    expect(r.ok).toBe(false);
    expect(limiteExcedidoMock).not.toHaveBeenCalled();
  });

  it("normaliza o e-mail (trim + minúsculas) antes de usar como chave do rate limit", async () => {
    mockServerClient();
    await signInWithPassword(
      null,
      formData({ email: "  Fulano@Escritorio.com.br  ", password: "x" }),
    );
    expect(limiteExcedidoMock).toHaveBeenCalledWith(
      expect.objectContaining({ chave: "fulano@escritorio.com.br" }),
    );
  });

  it("bloqueia quando o limite de tentativas foi atingido, sem tentar autenticar", async () => {
    limiteExcedidoMock.mockResolvedValue(true);
    const { signInWithPassword: authSignIn } = mockServerClient();
    const r = await signInWithPassword(
      null,
      formData({ email: "a@b.com", password: "x" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/muitas tentativas/i);
    expect(authSignIn).not.toHaveBeenCalled();
    // tentativa bloqueada não renova a janela: a vaga reservada é devolvida
    expect(descartarEventoMock).toHaveBeenCalledWith("evento-1");
  });

  it("tentativa permitida não é descartada", async () => {
    mockServerClient();
    await signInWithPassword(null, formData({ email: "a@b.com", password: "x" }));
    expect(descartarEventoMock).not.toHaveBeenCalled();
  });

  it("usa o IP atual e os limites de 5 por e-mail / 20 por IP em 15 minutos (+1: a própria tentativa já está registrada)", async () => {
    mockServerClient();
    await signInWithPassword(
      null,
      formData({ email: "a@b.com", password: "x" }),
    );
    // apenasFalhas não é passado aqui de propósito — o default (true) é
    // aplicado dentro de limiteExcedido(), já coberto em rate-limit.test.ts.
    expect(limiteExcedidoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: "203.0.113.7",
        maxPorChave: 6,
        maxPorIp: 21,
        janelaMinutos: 15,
      }),
    );
  });

  it("registra a tentativa ANTES de checar o limite e de autenticar (pedidos simultâneos não escapam da contagem)", async () => {
    const ordem: string[] = [];
    registrarEventoMock.mockImplementation(async () => {
      ordem.push("registrar");
      return "evento-1";
    });
    limiteExcedidoMock.mockImplementation(async () => {
      ordem.push("limite");
      return false;
    });
    const { signInWithPassword: authSignIn } = mockServerClient();
    authSignIn.mockImplementation(async () => {
      ordem.push("autenticar");
      return { data: { user: { id: "user-1" } }, error: null };
    });
    await signInWithPassword(null, formData({ email: "a@b.com", password: "x" }));
    expect(ordem).toEqual(["registrar", "limite", "autenticar"]);
  });

  it("login válido: devolve ok com o next sanitizado e registra sucesso no evento", async () => {
    mockServerClient(null);
    const r = await signInWithPassword(
      null,
      formData({ email: "a@b.com", password: "x", next: "/tarefas" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.next).toBe("/tarefas");
    expect(registrarEventoMock).toHaveBeenCalledWith("login", "a@b.com", false, "203.0.113.7");
    expect(confirmarSucessoMock).toHaveBeenCalledWith("evento-1");
  });

  it("sanitiza um 'next' malicioso (open redirect) mesmo em login bem-sucedido", async () => {
    mockServerClient(null);
    const r = await signInWithPassword(
      null,
      formData({ email: "a@b.com", password: "x", next: "//site-falso.com" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.next).toBe("/painel");
  });

  it("senha errada: mensagem genérica (não revela se o e-mail existe) e registra falha", async () => {
    mockServerClient({ message: "Invalid login credentials" });
    const r = await signInWithPassword(
      null,
      formData({ email: "a@b.com", password: "errada" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("E-mail ou senha inválidos.");
    expect(registrarEventoMock).toHaveBeenCalledWith("login", "a@b.com", false, "203.0.113.7");
    expect(confirmarSucessoMock).not.toHaveBeenCalled();
  });

  it("recusa conta desativada mesmo com a senha certa, e encerra a sessão recém-criada", async () => {
    const { signOut: authSignOut } = mockServerClient(null, { ativo: false });
    const r = await signInWithPassword(
      null,
      formData({ email: "a@b.com", password: "certa" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/desativada/i);
    expect(authSignOut).toHaveBeenCalled();
  });

  it("recusa quando o perfil não existe", async () => {
    mockServerClient(null, null);
    const r = await signInWithPassword(
      null,
      formData({ email: "a@b.com", password: "certa" }),
    );
    expect(r.ok).toBe(false);
  });

  it("registra o evento de segurança ANTES de checar o erro (loga tentativa mesmo se falhar)", async () => {
    mockServerClient({ message: "Invalid login credentials" });
    await signInWithPassword(null, formData({ email: "a@b.com", password: "x" }));
    expect(registrarEventoMock).toHaveBeenCalled();
  });
});

describe("signOut", () => {
  it("encerra a sessão no Supabase antes de redirecionar pro login", async () => {
    const { signOut: authSignOut } = mockServerClient();
    await signOut();
    expect(authSignOut).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});


const SENHA_CAMPOS_VALIDOS = {
  senha_atual: "senha-antiga-123",
  nova_senha: "senha-nova-456",
  confirmar_nova_senha: "senha-nova-456",
};

describe("trocarMinhaSenha", () => {
  it("exige sessão (usuário logado)", async () => {
    mockServerClient();
    await trocarMinhaSenha(null, formData(SENHA_CAMPOS_VALIDOS));
    expect(requireSessionMock).toHaveBeenCalled();
  });

  it("recusa sem preencher os campos", async () => {
    mockServerClient();
    const r = await trocarMinhaSenha(
      null,
      formData({ senha_atual: "", nova_senha: "", confirmar_nova_senha: "" }),
    );
    expect(r.ok).toBe(false);
  });

  it("recusa nova senha curta demais", async () => {
    const r = await trocarMinhaSenha(
      null,
      formData({ ...SENHA_CAMPOS_VALIDOS, nova_senha: "123", confirmar_nova_senha: "123" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/8 caracteres/);
  });

  it("recusa quando a confirmação não bate com a nova senha", async () => {
    const r = await trocarMinhaSenha(
      null,
      formData({ ...SENHA_CAMPOS_VALIDOS, confirmar_nova_senha: "outra-coisa-123" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/confirmação/i);
  });

  it("recusa quando a nova senha é igual à atual", async () => {
    const r = await trocarMinhaSenha(
      null,
      formData({
        senha_atual: "mesma-senha-123",
        nova_senha: "mesma-senha-123",
        confirmar_nova_senha: "mesma-senha-123",
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/diferente da atual/i);
  });

  it("bloqueia quando o limite de tentativas foi atingido, sem reautenticar", async () => {
    limiteExcedidoMock.mockResolvedValue(true);
    const { signInWithPassword: authSignIn } = mockServerClient();
    const r = await trocarMinhaSenha(null, formData(SENHA_CAMPOS_VALIDOS));
    expect(r.ok).toBe(false);
    expect(authSignIn).not.toHaveBeenCalled();
  });

  it("recusa quando a senha atual está errada, sem chamar updateUser", async () => {
    const { signInWithPassword: authSignIn, updateUser } = mockServerClient({
      message: "Invalid login credentials",
    });
    const r = await trocarMinhaSenha(null, formData(SENHA_CAMPOS_VALIDOS));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/senha atual incorreta/i);
    expect(authSignIn).toHaveBeenCalledWith(
      expect.objectContaining({
        email: SESSION.email,
        password: SENHA_CAMPOS_VALIDOS.senha_atual,
      }),
    );
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("troca a senha no caminho feliz", async () => {
    const { updateUser } = mockServerClient();
    const r = await trocarMinhaSenha(null, formData(SENHA_CAMPOS_VALIDOS));
    expect(r.ok).toBe(true);
    expect(updateUser).toHaveBeenCalledWith({
      password: SENHA_CAMPOS_VALIDOS.nova_senha,
    });
  });

  it("encerra as OUTRAS sessões da conta depois de trocar a senha", async () => {
    const { signOut: authSignOut } = mockServerClient();
    const r = await trocarMinhaSenha(null, formData(SENHA_CAMPOS_VALIDOS));
    expect(r.ok).toBe(true);
    expect(authSignOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("não encerra sessões se a troca de senha falhou", async () => {
    const { signOut: authSignOut } = mockServerClient(null, { ativo: true }, { message: "x" });
    await trocarMinhaSenha(null, formData(SENHA_CAMPOS_VALIDOS));
    expect(authSignOut).not.toHaveBeenCalled();
  });

  it("mensagem genérica se o updateUser falhar (não vaza erro cru do Supabase)", async () => {
    mockServerClient(null, { ativo: true }, { message: "detalhe interno do banco" });
    const r = await trocarMinhaSenha(null, formData(SENHA_CAMPOS_VALIDOS));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).not.toMatch(/detalhe interno/);
      expect(r.error).toMatch(/não foi possível/i);
    }
  });
});
