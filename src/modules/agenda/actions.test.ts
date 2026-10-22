import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "@/core/auth/session";
import { createSupabaseServerClient } from "@/core/db/server";

vi.mock("@/core/auth/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/core/db/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { alternarEventoConcluido, criarEvento } = await import("./actions");

const requireRoleMock = vi.mocked(requireRole);
const serverClientMock = vi.mocked(createSupabaseServerClient);

const SESSION = { userId: "user-1" } as unknown as Awaited<
  ReturnType<typeof requireRole>
>;

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function mockServerClient(error: unknown = null) {
  const eq = vi.fn().mockResolvedValue({ error });
  const update = vi.fn(() => ({ eq }));
  const insert = vi.fn().mockResolvedValue({ error });
  serverClientMock.mockResolvedValue({
    from: vi.fn(() => ({ insert, update })),
  } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
  return { insert, update, eq };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue(SESSION);
});

const CAMPOS_VALIDOS = {
  titulo: "Reunião com cliente",
  data: "2026-10-05",
  tipo: "reuniao",
};

describe("criarEvento", () => {
  it("exige um dos papéis internos", async () => {
    mockServerClient();
    await criarEvento(null, formData(CAMPOS_VALIDOS));
    expect(requireRoleMock).toHaveBeenCalled();
  });

  it("insere com origem 'manual' e o autor da sessão", async () => {
    const { insert } = mockServerClient();
    const r = await criarEvento(null, formData(CAMPOS_VALIDOS));
    expect(r.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: "Reunião com cliente",
        origem: "manual",
        criado_por: "user-1",
      }),
    );
  });

  it("rejeita data em formato inválido", async () => {
    mockServerClient();
    const r = await criarEvento(
      null,
      formData({ ...CAMPOS_VALIDOS, data: "05/10/2026" }),
    );
    expect(r.ok).toBe(false);
  });

  it("rejeita tipo fora do enum", async () => {
    mockServerClient();
    const r = await criarEvento(
      null,
      formData({ ...CAMPOS_VALIDOS, tipo: "invalido" }),
    );
    expect(r.ok).toBe(false);
  });

  it("em erro do banco, devolve mensagem genérica (não vaza o erro cru do Postgres)", async () => {
    mockServerClient({ message: "falha ao inserir" });
    const r = await criarEvento(null, formData(CAMPOS_VALIDOS));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).not.toBe("falha ao inserir");
      expect(r.error).toMatch(/não foi possível/i);
    }
  });
});

describe("alternarEventoConcluido", () => {
  it("marca como concluído", async () => {
    const { update, eq } = mockServerClient();
    const r = await alternarEventoConcluido("evento-1", true);
    expect(r.ok).toBe(true);
    expect(update).toHaveBeenCalledWith({ concluido: true });
    expect(eq).toHaveBeenCalledWith("id", "evento-1");
  });

  it("em erro do banco, devolve mensagem genérica (não vaza o erro cru do Postgres)", async () => {
    mockServerClient({ message: "não encontrado" });
    const r = await alternarEventoConcluido("evento-1", false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toBe("não encontrado");
  });
});
