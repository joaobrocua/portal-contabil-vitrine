import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseServerClient } from "@/core/db/server";

import { listarHistorico, registrarHistorico } from "./historico";

vi.mock("@/core/db/server", () => ({ createSupabaseServerClient: vi.fn() }));

const serverClientMock = vi.mocked(createSupabaseServerClient);

function mockSupabase(linhas: unknown[] | null = []) {
  const capturado: {
    inserts: unknown[];
    eqs: [string, unknown][];
    limite: number | null;
  } = { inserts: [], eqs: [], limite: null };

  const query = {
    select: () => query,
    order: () => query,
    limit(n: number) {
      capturado.limite = n;
      return query;
    },
    eq(coluna: string, valor: unknown) {
      capturado.eqs.push([coluna, valor]);
      return query;
    },
    then(resolve: (r: { data: unknown[] | null }) => unknown) {
      return Promise.resolve(resolve({ data: linhas }));
    },
    insert(payload: unknown) {
      capturado.inserts.push(payload);
      return Promise.resolve({ error: null });
    },
  };

  serverClientMock.mockResolvedValue({
    from: () => query,
  } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

  return capturado;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registrarHistorico", () => {
  it("converte os campos para o formato da tabela", async () => {
    const cap = mockSupabase();
    await registrarHistorico({
      entidade: "declaracoes_ir",
      entidadeId: "decl-1",
      acao: "status",
      campo: "status",
      de: "Pendente",
      para: "Entregue",
      descricao: "IRPF → Entregue",
      autorId: "user-1",
    });

    expect(cap.inserts).toEqual([
      {
        entidade: "declaracoes_ir",
        entidade_id: "decl-1",
        acao: "status",
        campo: "status",
        de: "Pendente",
        para: "Entregue",
        descricao: "IRPF → Entregue",
        autor_id: "user-1",
      },
    ]);
  });

  it("preenche com null os campos opcionais omitidos", async () => {
    const cap = mockSupabase();
    await registrarHistorico({
      entidade: "empresas",
      acao: "criar",
      descricao: "Empresa criada",
    });

    expect(cap.inserts[0]).toMatchObject({
      entidade_id: null,
      campo: null,
      de: null,
      para: null,
      autor_id: null,
    });
  });

  it("não estoura quando o insert falha (auditoria é best-effort)", async () => {
    serverClientMock.mockRejectedValue(new Error("banco fora"));
    await expect(
      registrarHistorico({
        entidade: "empresas",
        acao: "criar",
        descricao: "x",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("listarHistorico", () => {
  it("usa limite 50 por padrão e não filtra", async () => {
    const cap = mockSupabase([]);
    await listarHistorico();
    expect(cap.limite).toBe(50);
    expect(cap.eqs).toEqual([]);
  });

  it("respeita o limite informado", async () => {
    const cap = mockSupabase([]);
    await listarHistorico({ limite: 10 });
    expect(cap.limite).toBe(10);
  });

  it("filtra por entidade e por id quando informados", async () => {
    const cap = mockSupabase([]);
    await listarHistorico({ entidade: "empresas", entidadeId: "e1" });
    expect(cap.eqs).toEqual([
      ["entidade", "empresas"],
      ["entidade_id", "e1"],
    ]);
  });

  it("devolve lista vazia quando a consulta não traz dados", async () => {
    mockSupabase(null);
    expect(await listarHistorico()).toEqual([]);
  });

  it("devolve as linhas encontradas", async () => {
    mockSupabase([{ id: "h1", descricao: "algo" }]);
    const r = await listarHistorico();
    expect(r).toHaveLength(1);
    expect(r[0].descricao).toBe("algo");
  });
});
