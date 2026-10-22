import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseAdminClient } from "@/core/db/admin";

import { requireRole } from "./session";

vi.mock("./session", () => ({ requireRole: vi.fn() }));
vi.mock("@/core/db/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

const { listarEventosSeguranca } = await import("./eventos-seguranca");

const requireRoleMock = vi.mocked(requireRole);
const adminMock = vi.mocked(createSupabaseAdminClient);

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue(
    {} as Awaited<ReturnType<typeof requireRole>>,
  );
});

function mockAdmin(eventos: unknown[], falhas: number, perfis: unknown[]) {
  const lista = {
    order: vi.fn(() => ({
      limit: vi.fn().mockResolvedValue({ data: eventos, error: null }),
    })),
  };
  const contagem = {
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({ gte: vi.fn().mockResolvedValue({ count: falhas }) })),
    })),
  };
  const from = vi.fn((tabela: string) => {
    if (tabela === "profiles") {
      return {
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({ data: perfis }),
        })),
      };
    }
    return {
      select: vi.fn((_cols: string, opts?: { head?: boolean }) =>
        opts?.head ? contagem : lista,
      ),
    };
  });
  adminMock.mockReturnValue({ from } as unknown as ReturnType<
    typeof createSupabaseAdminClient
  >);
  return { from };
}

describe("listarEventosSeguranca", () => {
  it("só admin: sem papel, nem chega a abrir o client de service role", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(listarEventosSeguranca()).rejects.toThrow();
    expect(requireRoleMock).toHaveBeenCalledWith("admin");
    expect(adminMock).not.toHaveBeenCalled();
  });

  it("troca id de usuário pelo nome e mantém e-mail do login como está", async () => {
    mockAdmin(
      [
        { id: "1", tipo: "login", chave: "x@y.com", ip: "10.0.0.5", sucesso: false, created_at: "t" },
        { id: "2", tipo: "trocar_senha", chave: USER_ID, ip: null, sucesso: true, created_at: "t" },
      ],
      3,
      [{ id: USER_ID, nome: "Maria" }],
    );
    const r = await listarEventosSeguranca();
    expect(r.falhasLogin24h).toBe(3);
    expect(r.eventos.map((e) => e.quem)).toEqual(["x@y.com", "Maria"]);
  });
});
