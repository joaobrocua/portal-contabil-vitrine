import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "@/core/auth/session";
import { createSupabaseServerClient } from "@/core/db/server";
import { registrarHistorico } from "@/core/lib/historico";

vi.mock("@/core/auth/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/core/db/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/core/lib/historico", () => ({ registrarHistorico: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { criarProcessoSocietario, mudarStatusProcessoSocietario } = await import(
  "./actions"
);

const requireRoleMock = vi.mocked(requireRole);
const serverClientMock = vi.mocked(createSupabaseServerClient);
const registrarHistoricoMock = vi.mocked(registrarHistorico);

const SESSION = { userId: "user-1" } as unknown as Awaited<
  ReturnType<typeof requireRole>
>;
const EMPRESA_ID = "550e8400-e29b-41d4-a716-446655440000";
const PROCESSO_ID = "550e8400-e29b-41d4-a716-446655440001";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue(SESSION);
});

describe("criarProcessoSocietario", () => {
  function mockServerClient(itensError: unknown = null, desfazError: unknown = null) {
    const single = vi.fn().mockResolvedValue({ data: { id: "processo-1" }, error: null });
    const select = vi.fn(() => ({ single }));
    const insertProcessos = vi.fn(() => ({ select }));
    const insertItens = vi.fn().mockResolvedValue({ error: itensError });
    const deleteEq = vi.fn().mockResolvedValue({ error: desfazError });
    const deleteProcessos = vi.fn(() => ({ eq: deleteEq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn((tabela: string) =>
        tabela === "processos_societarios"
          ? { insert: insertProcessos, delete: deleteProcessos }
          : { insert: insertItens },
      ),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    return { insertProcessos, insertItens, deleteProcessos };
  }

  it("falha ao criar o checklist padrão desfaz o processo e NÃO volta como sucesso", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { deleteProcessos } = mockServerClient({ message: "rls" });
    const r = await criarProcessoSocietario(null, formData({ empresa_id: EMPRESA_ID, tipo: "abertura" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/tente novamente/i);
    expect(deleteProcessos).toHaveBeenCalled();
  });

  it("se nem o desfazer funcionar, avisa para NÃO reenviar (evita duplicado)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockServerClient({ message: "rls" }, { message: "rls" });
    const r = await criarProcessoSocietario(null, formData({ empresa_id: EMPRESA_ID, tipo: "abertura" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/não envie de novo/i);
  });

  it("exige admin/societario", async () => {
    mockServerClient();
    await criarProcessoSocietario(
      null,
      formData({ empresa_id: EMPRESA_ID, tipo: "abertura" }),
    );
    expect(requireRoleMock).toHaveBeenCalledWith("admin", "societario");
  });

  it("injeta o checklist padrão do tipo 'abertura' (7 itens)", async () => {
    const { insertItens } = mockServerClient();
    await criarProcessoSocietario(
      null,
      formData({ empresa_id: EMPRESA_ID, tipo: "abertura" }),
    );
    const chamada = insertItens.mock.calls[0]?.[0] as unknown[];
    expect(chamada).toHaveLength(7);
  });

  it("não injeta checklist pro tipo 'outro'", async () => {
    const { insertItens } = mockServerClient();
    await criarProcessoSocietario(
      null,
      formData({ empresa_id: EMPRESA_ID, tipo: "outro" }),
    );
    expect(insertItens).not.toHaveBeenCalled();
  });
});

describe("mudarStatusProcessoSocietario", () => {
  it("monta a descrição de/para com o tipo do processo", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: { status: "solicitado", tipo: "encerramento" } });
    const selectEq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq: updateEq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select, update })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    await mudarStatusProcessoSocietario(PROCESSO_ID, "aguardando_orgao");
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        de: "Solicitado",
        para: "Aguardando órgão",
        descricao: expect.stringContaining("Encerramento"),
      }),
    );
  });
});
