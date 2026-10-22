import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "@/core/auth/session";
import { createSupabaseServerClient } from "@/core/db/server";
import { registrarHistorico } from "@/core/lib/historico";

vi.mock("@/core/auth/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/core/db/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/core/lib/historico", () => ({ registrarHistorico: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const {
  alternarRecorrencia,
  atualizarObrigacao,
  criarObrigacao,
  criarRecorrencia,
  excluirObrigacao,
  gerarCompetencia,
  mudarStatusObrigacao,
  removerRecorrencia,
} = await import("./actions");

const requireRoleMock = vi.mocked(requireRole);
const serverClientMock = vi.mocked(createSupabaseServerClient);
const registrarHistoricoMock = vi.mocked(registrarHistorico);

const SESSION = { userId: "user-1" } as unknown as Awaited<
  ReturnType<typeof requireRole>
>;
const EMPRESA_ID = "550e8400-e29b-41d4-a716-446655440000";
const OBRIGACAO_ID = "550e8400-e29b-41d4-a716-446655440001";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue(SESSION);
});

const OBRIGACAO_VALIDA = {
  empresa_id: EMPRESA_ID,
  competencia: "2026-09",
  tipo: "das",
  vencimento: "2026-10-20",
};

describe("criarObrigacao", () => {
  function mockServerClient(opts: { data?: unknown; error?: unknown } = {}) {
    const single = vi
      .fn()
      .mockResolvedValue({ data: opts.data ?? { id: "nova-obrigacao" }, error: opts.error ?? null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ insert })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    return { insert };
  }

  it("exige admin/fiscal", async () => {
    mockServerClient();
    await criarObrigacao(null, formData(OBRIGACAO_VALIDA));
    expect(requireRoleMock).toHaveBeenCalledWith("admin", "fiscal");
  });

  it("cria no caminho feliz", async () => {
    mockServerClient();
    const r = await criarObrigacao(null, formData(OBRIGACAO_VALIDA));
    expect(r.ok).toBe(true);
  });

  it("traduz violação de unicidade (empresa+competência+tipo já existe)", async () => {
    mockServerClient({ error: { code: "23505" } });
    const r = await criarObrigacao(null, formData(OBRIGACAO_VALIDA));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/já existe/i);
  });
});

describe("atualizarObrigacao", () => {
  it("recusa sem id", async () => {
    const r = await atualizarObrigacao(null, formData(OBRIGACAO_VALIDA));
    expect(r.ok).toBe(false);
  });
});

describe("mudarStatusObrigacao", () => {
  it("monta a descrição do histórico com de/para em label legível", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: { status: "pendente", tipo: "das" } });
    const selectEq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq: updateEq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select, update })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    await mudarStatusObrigacao(OBRIGACAO_ID, "paga");
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        de: "Pendente",
        para: "Paga",
        descricao: expect.stringContaining("DAS"),
      }),
    );
  });
});

describe("excluirObrigacao", () => {
  it("busca o tipo/competência antes de excluir e descreve no histórico", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { tipo: "fgts", competencia: "2026-09-01", empresa_id: EMPRESA_ID },
    });
    const selectEq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn(() => ({ eq: deleteEq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select, delete: del })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const r = await excluirObrigacao(OBRIGACAO_ID);
    expect(r.ok).toBe(true);
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: "excluiu",
        descricao: expect.stringContaining("FGTS"),
      }),
    );
  });
});

describe("gerarCompetencia", () => {
  function mockServerClient(opts: { data?: number; error?: unknown } = {}) {
    const rpc = vi.fn().mockResolvedValue({ data: opts.data ?? 5, error: opts.error ?? null });
    serverClientMock.mockResolvedValue({
      rpc,
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    return { rpc };
  }

  it("chama a RPC gerar_obrigacoes com a competência normalizada", async () => {
    const { rpc } = mockServerClient({ data: 7 });
    const r = await gerarCompetencia(null, formData({ competencia: "2026-09" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.criadas).toBe(7);
    expect(rpc).toHaveBeenCalledWith("gerar_obrigacoes", {
      p_competencia: "2026-09-01",
    });
  });

  it("propaga erro da RPC (ex. bloqueio de RLS por departamento errado)", async () => {
    mockServerClient({ error: { message: "Apenas o departamento fiscal pode gerar obrigações" } });
    const r = await gerarCompetencia(null, formData({ competencia: "2026-09" }));
    expect(r.ok).toBe(false);
  });
});

describe("recorrências", () => {
  it("criarRecorrencia traduz violação de unicidade", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: "23505" } });
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ insert })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const r = await criarRecorrencia(
      null,
      formData({ empresa_id: EMPRESA_ID, tipo: "das" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/já tem essa obrigação/i);
  });

  it("alternarRecorrencia liga/desliga", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ update })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const r = await alternarRecorrencia("rec-1", false);
    expect(r.ok).toBe(true);
    expect(update).toHaveBeenCalledWith({ ativo: false });
  });

  it("removerRecorrencia registra o histórico vinculado à empresa (não à recorrência)", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: { tipo: "das", empresa_id: EMPRESA_ID } });
    const selectEq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn(() => ({ eq: deleteEq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select, delete: del })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    await removerRecorrencia("rec-1");
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({ entidade: "empresa", entidadeId: EMPRESA_ID }),
    );
  });
});
