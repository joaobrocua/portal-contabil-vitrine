import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "@/core/auth/session";
import { createSupabaseServerClient } from "@/core/db/server";
import { registrarHistorico } from "@/core/lib/historico";

vi.mock("@/core/auth/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/core/db/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/core/lib/historico", () => ({ registrarHistorico: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const {
  adicionarItem,
  alternarItem,
  criarTarefa,
  mudarStatusTarefa,
  salvarModelo,
  vincularDocumento,
} = await import("./actions");

const requireRoleMock = vi.mocked(requireRole);
const serverClientMock = vi.mocked(createSupabaseServerClient);
const registrarHistoricoMock = vi.mocked(registrarHistorico);

const SESSION = { userId: "user-1" } as unknown as Awaited<
  ReturnType<typeof requireRole>
>;
const TAREFA_ID = "550e8400-e29b-41d4-a716-446655440000";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue(SESSION);
});

describe("criarTarefa", () => {
  it("marca origem 'manual' e o criador da sessão", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "tarefa-1" }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ insert })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const r = await criarTarefa(null, formData({ titulo: "Conciliação bancária" }));
    expect(r.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ origem: "manual", criado_por: "user-1" }),
    );
  });

  it("rejeita título muito curto", async () => {
    const r = await criarTarefa(null, formData({ titulo: "Ab" }));
    expect(r.ok).toBe(false);
  });
});

describe("mudarStatusTarefa", () => {
  it("monta a descrição de/para com o título da tarefa", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: { status: "em_andamento", titulo: "Fechamento do mês" } });
    const selectEq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq: updateEq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select, update })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    await mudarStatusTarefa(TAREFA_ID, "concluida");
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        de: "Em andamento",
        para: "Concluída",
        descricao: expect.stringContaining("Fechamento do mês"),
      }),
    );
  });

  it("usa 'tarefa' como fallback na descrição quando a tarefa atual não é encontrada", async () => {
    const single = vi.fn().mockResolvedValue({ data: null });
    const selectEq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq: updateEq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select, update })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    await mudarStatusTarefa(TAREFA_ID, "concluida");
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({ de: null, descricao: expect.stringContaining("tarefa") }),
    );
  });
});

describe("checklist", () => {
  it("adicionarItem usa a contagem atual como ordem", async () => {
    const selectEq = vi.fn().mockResolvedValue({ count: 5 });
    const select = vi.fn(() => ({ eq: selectEq }));
    const insert = vi.fn().mockResolvedValue({ error: null });
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select, insert })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    await adicionarItem(null, formData({ tarefa_id: TAREFA_ID, descricao: "Item novo" }));
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ ordem: 5 }));
  });

  it("alternarItem marca feito/feito_em/feito_por quando concluído", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ update })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    await alternarItem("item-1", TAREFA_ID, true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ feito: true, feito_por: "user-1" }),
    );
  });

  it("alternarItem zera feito_em/feito_por ao desmarcar", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ update })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    await alternarItem("item-1", TAREFA_ID, false);
    expect(update).toHaveBeenCalledWith({
      feito: false,
      feito_em: null,
      feito_por: null,
    });
  });
});

const MODELO_ID = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
const DOC_ID = "6ba7b811-9dad-41d1-80b4-00c04fd430c8";

describe("criarTarefa a partir de modelo", () => {
  function mockComModelo(modelo: unknown) {
    const single = vi.fn().mockResolvedValue({ data: { id: "tarefa-1" }, error: null });
    const tarefasInsert = vi.fn(() => ({ select: vi.fn(() => ({ single })) }));
    const itensInsert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: modelo });
    const from = vi.fn((tabela: string) => {
      if (tabela === "tarefa_templates")
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) };
      if (tabela === "tarefa_itens") return { insert: itensInsert };
      return { insert: tarefasInsert };
    });
    serverClientMock.mockResolvedValue({ from } as unknown as Awaited<
      ReturnType<typeof createSupabaseServerClient>
    >);
    return { tarefasInsert, itensInsert };
  }

  it("grava template_id e copia o checklist do modelo lido no banco, na ordem", async () => {
    const { tarefasInsert, itensInsert } = mockComModelo({
      id: MODELO_ID,
      itens_padrao: ["Pedir extratos", 42, "", "Conciliar"],
    });
    const r = await criarTarefa(
      null,
      formData({ titulo: "Fechamento", template_id: MODELO_ID }),
    );
    expect(r.ok).toBe(true);
    expect(tarefasInsert).toHaveBeenCalledWith(
      expect.objectContaining({ template_id: MODELO_ID }),
    );
    // Lixo no jsonb (número, string vazia) é descartado.
    expect(itensInsert).toHaveBeenCalledWith([
      { tarefa_id: "tarefa-1", descricao: "Pedir extratos", ordem: 0 },
      { tarefa_id: "tarefa-1", descricao: "Conciliar", ordem: 1 },
    ]);
  });

  it("recusa modelo inexistente sem criar a tarefa", async () => {
    const { tarefasInsert } = mockComModelo(null);
    const r = await criarTarefa(
      null,
      formData({ titulo: "Fechamento", template_id: MODELO_ID }),
    );
    expect(r.ok).toBe(false);
    expect(tarefasInsert).not.toHaveBeenCalled();
  });

  it("template_id que não é UUID é ignorado (tarefa em branco)", async () => {
    const { tarefasInsert, itensInsert } = mockComModelo(null);
    const r = await criarTarefa(
      null,
      formData({ titulo: "Fechamento", template_id: "abc" }),
    );
    expect(r.ok).toBe(true);
    expect(tarefasInsert).toHaveBeenCalledWith(
      expect.objectContaining({ template_id: null }),
    );
    expect(itensInsert).not.toHaveBeenCalled();
  });
});

describe("salvarModelo", () => {
  it("exige papel admin", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(
      salvarModelo(null, formData({ nome: "X", titulo_padrao: "Algo" })),
    ).rejects.toThrow();
    expect(requireRoleMock).toHaveBeenCalledWith("admin");
  });

  it("cria com recorrência 'nenhuma' e o checklist em lista", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: MODELO_ID }, error: null });
    const insert = vi.fn(() => ({ select: vi.fn(() => ({ single })) }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ insert })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const r = await salvarModelo(
      null,
      formData({
        nome: "Fechamento",
        titulo_padrao: "Fechamento mensal",
        itens_padrao: "A\nB",
        dia_prazo: "10",
      }),
    );
    expect(r.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        itens_padrao: ["A", "B"],
        dia_prazo: 10,
        recorrencia: "nenhuma",
        ativo: true,
      }),
    );
  });

  it("recusa id que não é UUID", async () => {
    const r = await salvarModelo(
      null,
      formData({ id: "abc", nome: "Fechamento", titulo_padrao: "Fechamento mensal" }),
    );
    expect(r.ok).toBe(false);
  });
});

describe("vincularDocumento", () => {
  function mockVinculo(tarefa: unknown, doc: unknown) {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((tabela: string) => {
      const dado = tabela === "tarefas" ? tarefa : doc;
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: dado }),
          })),
        })),
        insert,
      };
    });
    serverClientMock.mockResolvedValue({ from } as unknown as Awaited<
      ReturnType<typeof createSupabaseServerClient>
    >);
    return { insert };
  }

  it("vincula quando documento e tarefa são da mesma empresa", async () => {
    const { insert } = mockVinculo(
      { empresa_id: "emp-1" },
      { empresa_id: "emp-1", titulo: "Extrato" },
    );
    const r = await vincularDocumento(TAREFA_ID, DOC_ID);
    expect(r.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith({ tarefa_id: TAREFA_ID, documento_id: DOC_ID });
  });

  it("recusa documento de outra empresa", async () => {
    const { insert } = mockVinculo(
      { empresa_id: "emp-1" },
      { empresa_id: "emp-2", titulo: "Extrato" },
    );
    const r = await vincularDocumento(TAREFA_ID, DOC_ID);
    expect(r.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("recusa em tarefa interna (sem empresa)", async () => {
    const { insert } = mockVinculo(
      { empresa_id: null },
      { empresa_id: "emp-1", titulo: "Extrato" },
    );
    const r = await vincularDocumento(TAREFA_ID, DOC_ID);
    expect(r.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("recusa ids inválidos antes de ir ao banco", async () => {
    const r = await vincularDocumento("abc", DOC_ID);
    expect(r.ok).toBe(false);
    expect(serverClientMock).not.toHaveBeenCalled();
  });
});
