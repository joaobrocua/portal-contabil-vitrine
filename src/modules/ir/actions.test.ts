import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "@/core/auth/session";
import { createSupabaseServerClient } from "@/core/db/server";
import { registrarHistorico } from "@/core/lib/historico";

vi.mock("@/core/auth/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/core/db/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/core/lib/historico", () => ({ registrarHistorico: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { atualizarDeclaracaoIr, gerarDeclaracoesIr, mudarStatusDeclaracaoIr } =
  await import("./actions");

const requireRoleMock = vi.mocked(requireRole);
const serverClientMock = vi.mocked(createSupabaseServerClient);
const registrarHistoricoMock = vi.mocked(registrarHistorico);

const SESSION = { userId: "user-1" } as unknown as Awaited<
  ReturnType<typeof requireRole>
>;
const DECLARACAO_ID = "550e8400-e29b-41d4-a716-446655440000";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue(SESSION);
});

describe("gerarDeclaracoesIr", () => {
  it("exige admin/fiscal/contabil e chama a RPC com os parâmetros certos", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 4, error: null });
    serverClientMock.mockResolvedValue({
      rpc,
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const r = await gerarDeclaracoesIr(
      null,
      formData({ tipo: "irpf", ano_exercicio: "2026" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.criadas).toBe(4);
    expect(requireRoleMock).toHaveBeenCalledWith("admin", "fiscal", "contabil");
    expect(rpc).toHaveBeenCalledWith("gerar_declaracoes_ir", {
      p_tipo: "irpf",
      p_ano: 2026,
      p_prazo: null,
    });
  });
});

describe("mudarStatusDeclaracaoIr", () => {
  it("monta a descrição de/para com o tipo da declaração", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: { status: "pendente", tipo: "irpj" } });
    const selectEq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq: updateEq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select, update })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    await mudarStatusDeclaracaoIr(DECLARACAO_ID, "entregue");
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        de: "Pendente",
        para: "Entregue",
        descricao: "IRPJ → Entregue",
      }),
    );
  });
});

describe("atualizarDeclaracaoIr", () => {
  it("atualiza sem incluir o id no payload do update (só no .eq)", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ update })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const r = await atualizarDeclaracaoIr(
      null,
      formData({ id: DECLARACAO_ID, valor_a_pagar: "1.234,56" }),
    );
    expect(r.ok).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ valor_a_pagar: 1234.56 }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.not.objectContaining({ id: expect.anything() }),
    );
    expect(eq).toHaveBeenCalledWith("id", DECLARACAO_ID);
  });
});
