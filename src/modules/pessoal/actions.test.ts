import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "@/core/auth/session";
import { createSupabaseServerClient } from "@/core/db/server";
import { registrarHistorico } from "@/core/lib/historico";

vi.mock("@/core/auth/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/core/db/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/core/lib/historico", () => ({ registrarHistorico: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const {
  abrirFolhas,
  adicionarItemEventoDp,
  criarEventoDp,
  criarFuncionario,
  mudarStatusEventoDp,
} = await import("./actions");

const requireRoleMock = vi.mocked(requireRole);
const serverClientMock = vi.mocked(createSupabaseServerClient);
const registrarHistoricoMock = vi.mocked(registrarHistorico);

const SESSION = { userId: "user-1" } as unknown as Awaited<
  ReturnType<typeof requireRole>
>;
const EMPRESA_ID = "550e8400-e29b-41d4-a716-446655440000";
const EVENTO_ID = "550e8400-e29b-41d4-a716-446655440001";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue(SESSION);
});

describe("criarFuncionario", () => {
  it("exige admin/pessoal e cria no caminho feliz", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "func-1" }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ insert })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const r = await criarFuncionario(
      null,
      formData({ empresa_id: EMPRESA_ID, nome: "Maria Souza" }),
    );
    expect(r.ok).toBe(true);
    expect(requireRoleMock).toHaveBeenCalledWith("admin", "pessoal");
  });
});

describe("criarEventoDp", () => {
  function mockServerClient(itensError: unknown = null, desfazError: unknown = null) {
    const single = vi.fn().mockResolvedValue({ data: { id: "evento-1" }, error: null });
    const select = vi.fn(() => ({ single }));
    const insertEventos = vi.fn(() => ({ select }));
    const insertItens = vi.fn().mockResolvedValue({ error: itensError });
    const deleteEq = vi.fn().mockResolvedValue({ error: desfazError });
    const deleteEventos = vi.fn(() => ({ eq: deleteEq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn((tabela: string) =>
        tabela === "eventos_dp" ? { insert: insertEventos, delete: deleteEventos } : { insert: insertItens },
      ),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    return { insertEventos, insertItens, deleteEventos };
  }

  it("cria o processo com o solicitante da sessão e injeta o checklist padrão do tipo", async () => {
    const { insertEventos, insertItens } = mockServerClient();
    const r = await criarEventoDp(
      null,
      formData({ empresa_id: EMPRESA_ID, tipo: "admissao" }),
    );
    expect(r.ok).toBe(true);
    expect(insertEventos).toHaveBeenCalledWith(
      expect.objectContaining({ solicitado_por: "user-1" }),
    );
    // checklist padrão de admissão tem 6 itens (ver EVENTO_DP_CHECKLIST_PADRAO)
    expect(insertItens).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ evento_id: "evento-1", ordem: 0 }),
      ]),
    );
  });

  it("falha ao criar o checklist padrão desfaz o processo e NÃO volta como sucesso", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { deleteEventos } = mockServerClient({ message: "rls" });
    const r = await criarEventoDp(null, formData({ empresa_id: EMPRESA_ID, tipo: "admissao" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/tente novamente/i);
    expect(deleteEventos).toHaveBeenCalled();
  });

  it("se nem o desfazer funcionar, avisa para NÃO reenviar (evita duplicado)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockServerClient({ message: "rls" }, { message: "rls" });
    const r = await criarEventoDp(null, formData({ empresa_id: EMPRESA_ID, tipo: "admissao" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/não envie de novo/i);
  });

  it("não injeta checklist pra tipo sem checklist padrão (ex. 'outro')", async () => {
    const { insertItens } = mockServerClient();
    await criarEventoDp(null, formData({ empresa_id: EMPRESA_ID, tipo: "outro" }));
    expect(insertItens).not.toHaveBeenCalled();
  });
});

describe("adicionarItemEventoDp", () => {
  it("usa a contagem atual como ordem do novo item", async () => {
    const selectEq = vi.fn().mockResolvedValue({ count: 3 });
    const select = vi.fn(() => ({ eq: selectEq }));
    const insert = vi.fn().mockResolvedValue({ error: null });
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select, insert })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    await adicionarItemEventoDp(
      null,
      formData({ evento_id: EVENTO_ID, descricao: "Novo item" }),
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ ordem: 3 }),
    );
  });
});

describe("mudarStatusEventoDp", () => {
  it("monta a descrição com tipo + label do novo status", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: { status: "solicitado", tipo: "ferias" } });
    const selectEq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq: updateEq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select, update })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    await mudarStatusEventoDp(EVENTO_ID, "concluido");
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        de: "Solicitado",
        para: "Concluído",
        descricao: expect.stringContaining("Férias"),
      }),
    );
  });
});

describe("abrirFolhas", () => {
  it("chama a RPC abrir_folhas com a competência normalizada", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 6, error: null });
    serverClientMock.mockResolvedValue({
      rpc,
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const r = await abrirFolhas(null, formData({ competencia: "2026-11" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.criadas).toBe(6);
    expect(rpc).toHaveBeenCalledWith("abrir_folhas", { p_competencia: "2026-11-01" });
  });

  it("rejeita competência vazia sem chamar a RPC", async () => {
    const rpc = vi.fn();
    serverClientMock.mockResolvedValue({
      rpc,
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const r = await abrirFolhas(null, formData({ competencia: "" }));
    expect(r.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
