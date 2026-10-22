import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "@/core/auth/session";
import { createSupabaseServerClient } from "@/core/db/server";
import { registrarHistorico } from "@/core/lib/historico";

vi.mock("@/core/auth/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/core/db/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/core/lib/historico", () => ({ registrarHistorico: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { abrirFechamentos, adicionarItemFechamento, mudarStatusFechamento } =
  await import("./actions");

const requireRoleMock = vi.mocked(requireRole);
const serverClientMock = vi.mocked(createSupabaseServerClient);
const registrarHistoricoMock = vi.mocked(registrarHistorico);

const SESSION = { userId: "user-1" } as unknown as Awaited<
  ReturnType<typeof requireRole>
>;
const FECHAMENTO_ID = "550e8400-e29b-41d4-a716-446655440000";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue(SESSION);
});

describe("abrirFechamentos", () => {
  it("exige admin/contabil e chama a RPC com a competência normalizada", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 9, error: null });
    serverClientMock.mockResolvedValue({
      rpc,
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const r = await abrirFechamentos(null, formData({ competencia: "2026-09" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.criadas).toBe(9);
    expect(requireRoleMock).toHaveBeenCalledWith("admin", "contabil");
    expect(rpc).toHaveBeenCalledWith("abrir_fechamentos", { p_competencia: "2026-09-01" });
  });
});

describe("mudarStatusFechamento", () => {
  it("monta a descrição de/para", async () => {
    const single = vi.fn().mockResolvedValue({ data: { status: "aberto" } });
    const selectEq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq: updateEq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select, update })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    await mudarStatusFechamento(FECHAMENTO_ID, "entregue");
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({ de: "Aberto", para: "Entregue" }),
    );
  });
});

describe("adicionarItemFechamento", () => {
  it("usa a contagem atual como ordem", async () => {
    const selectEq = vi.fn().mockResolvedValue({ count: 2 });
    const select = vi.fn(() => ({ eq: selectEq }));
    const insert = vi.fn().mockResolvedValue({ error: null });
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select, insert })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    await adicionarItemFechamento(
      null,
      formData({ fechamento_id: FECHAMENTO_ID, descricao: "Novo item" }),
    );
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ ordem: 2 }));
  });

  it("rejeita descrição vazia", async () => {
    const r = await adicionarItemFechamento(
      null,
      formData({ fechamento_id: FECHAMENTO_ID, descricao: "" }),
    );
    expect(r.ok).toBe(false);
  });
});
