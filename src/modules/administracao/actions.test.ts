import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "@/core/auth/session";
import { createSupabaseServerClient } from "@/core/db/server";
import { registrarHistorico } from "@/core/lib/historico";

vi.mock("@/core/auth/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/core/db/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/core/lib/historico", () => ({ registrarHistorico: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { adicionarCatalogo, alternarCatalogo, salvarConfig } = await import(
  "./actions"
);

const requireRoleMock = vi.mocked(requireRole);
const serverClientMock = vi.mocked(createSupabaseServerClient);
const registrarHistoricoMock = vi.mocked(registrarHistorico);

const SESSION = { userId: "admin-1" } as unknown as Awaited<
  ReturnType<typeof requireRole>
>;

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue(SESSION);
});

describe("salvarConfig", () => {
  function mockServerClient(error: unknown = null) {
    const eq = vi.fn().mockResolvedValue({ error });
    const update = vi.fn(() => ({ eq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ update })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    return { update, eq };
  }

  const CAMPOS = { nome: "Escritório Exemplo" };

  it("exige papel admin", async () => {
    mockServerClient();
    await salvarConfig(null, formData(CAMPOS));
    expect(requireRoleMock).toHaveBeenCalledWith("admin");
  });

  it("atualiza a linha única (id=1) e registra histórico", async () => {
    const { update, eq } = mockServerClient();
    const r = await salvarConfig(
      null,
      formData({ ...CAMPOS, cnpj: "11.222.333/0001-81" }),
    );
    expect(r.ok).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ nome: "Escritório Exemplo", cnpj: "11.222.333/0001-81" }),
    );
    expect(eq).toHaveBeenCalledWith("id", 1);
    expect(registrarHistoricoMock).toHaveBeenCalled();
  });

  it("trata campos opcionais vazios como null", async () => {
    const { update } = mockServerClient();
    await salvarConfig(null, formData({ ...CAMPOS, cnpj: "" }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ cnpj: null }));
  });

  it("rejeita nome muito curto", async () => {
    mockServerClient();
    const r = await salvarConfig(null, formData({ nome: "A" }));
    expect(r.ok).toBe(false);
  });
});

describe("adicionarCatalogo", () => {
  function mockServerClient(opts: { count?: number; insertError?: unknown } = {}) {
    const insert = vi.fn().mockResolvedValue({ error: opts.insertError ?? null });
    const selectChain = {
      eq: vi.fn().mockResolvedValue({ count: opts.count ?? 0 }),
    };
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => selectChain),
        insert,
      })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    return { insert };
  }

  it("gera o slug a partir do rótulo", async () => {
    const { insert } = mockServerClient({ count: 2 });
    const r = await adicionarCatalogo(
      null,
      formData({ tipo: "tipo_documento", rotulo: "Nota Fiscal de Serviço" }),
    );
    expect(r.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "tipo_documento",
        valor: "nota_fiscal_de_servico",
        rotulo: "Nota Fiscal de Serviço",
        ordem: 3, // count(2) + 1
        ativo: true,
      }),
    );
  });

  it("usa item_N quando o rótulo não gera nenhum caractere válido de slug", async () => {
    const { insert } = mockServerClient({ count: 0 });
    await adicionarCatalogo(null, formData({ tipo: "tipo_documento", rotulo: "***" }));
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ valor: "item_1" }),
    );
  });

  it("traduz violação de unicidade (23505) numa mensagem amigável", async () => {
    const { insert } = mockServerClient({ insertError: { code: "23505" } });
    const r = await adicionarCatalogo(
      null,
      formData({ tipo: "tipo_documento", rotulo: "Duplicado" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Esse item já existe.");
    void insert;
  });

  it("rejeita rótulo vazio", async () => {
    mockServerClient();
    const r = await adicionarCatalogo(null, formData({ tipo: "tipo_documento", rotulo: "" }));
    expect(r.ok).toBe(false);
  });

  it("rejeita catálogo que nenhuma tela usa", async () => {
    const { insert } = mockServerClient();
    for (const tipo of ["tipo_tarefa", "tipo_obrigacao", "status_customizado", "xx"]) {
      const r = await adicionarCatalogo(null, formData({ tipo, rotulo: "Algo" }));
      expect(r.ok).toBe(false);
    }
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("alternarCatalogo", () => {
  it("liga/desliga o item", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ update })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const r = await alternarCatalogo("cat-1", false);
    expect(r.ok).toBe(true);
    expect(update).toHaveBeenCalledWith({ ativo: false });
    expect(eq).toHaveBeenCalledWith("id", "cat-1");
  });
});
