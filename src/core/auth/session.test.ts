import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseServerClient } from "@/core/db/server";

import {
  assertModuleEnabled,
  empresaIdsVisiveis,
  getSession,
  requireRole,
  requireSession,
  type SessionContext,
} from "./session";

vi.mock("@/core/db/server", () => ({ createSupabaseServerClient: vi.fn() }));

// O redirect/notFound do Next interrompem a execução lançando — o mock
// precisa lançar também, senão o código seguiria em frente no teste.
class RedirectError extends Error {
  constructor(readonly destino: string) {
    super(`REDIRECT:${destino}`);
  }
}
class NotFoundError extends Error {}

vi.mock("next/navigation", () => ({
  redirect: vi.fn((destino: string) => {
    throw new RedirectError(destino);
  }),
  notFound: vi.fn(() => {
    throw new NotFoundError();
  }),
}));

const serverClientMock = vi.mocked(createSupabaseServerClient);

const PERFIL = {
  id: "user-1",
  email: "perfil@escritorio.com.br",
  nome: "Fulano",
  papel: "fiscal",
  ativo: true,
};

/** Monta um client com `auth.getClaims()` e `from(...)` controlados. */
function mockSupabase(opts: {
  user?: { id: string; email?: string | null } | null;
  profile?: Record<string, unknown> | null;
  contatos?: { empresa_id: string }[] | null;
}) {
  const contatosQuery = {
    select: () => contatosQuery,
    eq: () => Promise.resolve({ data: opts.contatos ?? null }),
  };
  const profileQuery = {
    select: () => profileQuery,
    eq: () => profileQuery,
    single: () => Promise.resolve({ data: opts.profile ?? null }),
  };

  serverClientMock.mockResolvedValue({
    auth: {
      getClaims: () =>
        Promise.resolve({
          data: opts.user ? { claims: { sub: opts.user.id, email: opts.user.email } } : null,
        }),
    },
    from: (tabela: string) =>
      tabela === "contatos" ? contatosQuery : profileQuery,
  } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSession", () => {
  it("devolve null quando não há usuário autenticado", async () => {
    mockSupabase({ user: null });
    expect(await getSession()).toBeNull();
  });

  it("devolve null quando o perfil não existe", async () => {
    mockSupabase({ user: { id: "user-1" }, profile: null });
    expect(await getSession()).toBeNull();
  });

  it("devolve null quando o perfil está inativo", async () => {
    mockSupabase({
      user: { id: "user-1" },
      profile: { ...PERFIL, ativo: false },
    });
    expect(await getSession()).toBeNull();
  });

  it("devolve o contexto quando usuário e perfil estão ok", async () => {
    mockSupabase({
      user: { id: "user-1", email: "login@escritorio.com.br" },
      profile: PERFIL,
    });
    const s = await getSession();
    expect(s?.userId).toBe("user-1");
    expect(s?.email).toBe("login@escritorio.com.br");
    expect(s?.profile.papel).toBe("fiscal");
  });

  it("cai para o e-mail do perfil quando o do auth é nulo", async () => {
    mockSupabase({ user: { id: "user-1", email: null }, profile: PERFIL });
    expect((await getSession())?.email).toBe("perfil@escritorio.com.br");
  });
});

describe("requireSession", () => {
  it("redireciona para /login sem sessão", async () => {
    mockSupabase({ user: null });
    await expect(requireSession()).rejects.toThrow("REDIRECT:/login");
  });

  it("devolve a sessão quando autenticado", async () => {
    mockSupabase({ user: { id: "user-1" }, profile: PERFIL });
    expect((await requireSession()).userId).toBe("user-1");
  });
});

describe("requireRole", () => {
  it("libera quando o papel está na lista", async () => {
    mockSupabase({ user: { id: "user-1" }, profile: PERFIL });
    await expect(requireRole("admin", "fiscal")).resolves.toBeTruthy();
  });

  it("redireciona para /painel quando o papel não está na lista", async () => {
    mockSupabase({ user: { id: "user-1" }, profile: PERFIL });
    await expect(requireRole("admin", "pessoal")).rejects.toThrow(
      "REDIRECT:/painel",
    );
  });

  it("sem papéis informados exige só estar autenticado", async () => {
    mockSupabase({ user: { id: "user-1" }, profile: PERFIL });
    await expect(requireRole()).resolves.toBeTruthy();
  });

  it("redireciona para /login antes de checar papel, se não autenticado", async () => {
    mockSupabase({ user: null });
    await expect(requireRole("admin")).rejects.toThrow("REDIRECT:/login");
  });
});

describe("assertModuleEnabled", () => {
  it("passa direto para módulo ligado", () => {
    expect(() => assertModuleEnabled("fiscal")).not.toThrow();
  });

  it("chama notFound para módulo desligado", () => {
    expect(() => assertModuleEnabled("comunicacao")).toThrow(NotFoundError);
  });
});

describe("empresaIdsVisiveis", () => {
  const sessionCom = (papel: string) =>
    ({
      userId: "user-1",
      email: "x@y.com",
      profile: { ...PERFIL, papel },
    }) as unknown as SessionContext;

  it("devolve null para staff (RLS libera todas)", async () => {
    mockSupabase({});
    expect(await empresaIdsVisiveis(sessionCom("fiscal"))).toBeNull();
    expect(await empresaIdsVisiveis(sessionCom("admin"))).toBeNull();
  });

  it("devolve as empresas em que o cliente é contato", async () => {
    mockSupabase({ contatos: [{ empresa_id: "e1" }, { empresa_id: "e2" }] });
    expect(await empresaIdsVisiveis(sessionCom("cliente"))).toEqual([
      "e1",
      "e2",
    ]);
  });

  it("devolve lista vazia quando o cliente não é contato de nenhuma", async () => {
    mockSupabase({ contatos: null });
    expect(await empresaIdsVisiveis(sessionCom("cliente"))).toEqual([]);
  });
});
