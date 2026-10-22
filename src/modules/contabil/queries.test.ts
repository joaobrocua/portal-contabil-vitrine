import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseServerClient } from "@/core/db/server";

vi.mock("@/core/db/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/core/db/empresas-opcoes", () => ({ empresasParaEscolha: vi.fn() }));

const { listFechamentos, paginarFechamentos } = await import("./queries");

function mockCliente(total: number) {
  const linhas = Array.from({ length: total }, (_, i) => ({ id: `f${i}` }));
  const range = vi.fn(async (de: number, ate: number) => ({
    data: linhas.slice(de, Math.min(ate, de + 999) + 1),
    error: null,
    count: total,
  }));
  const q: Record<string, unknown> = { range };
  for (const m of ["select", "eq", "not", "order"]) q[m] = vi.fn(() => q);
  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    from: () => q,
  } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
  return { q, range };
}

/** Colunas passadas a .order(), na ordem das chamadas. */
function chamadasDeOrder(q: Record<string, unknown>): unknown[] {
  return (q.order as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]);
}

beforeEach(() => vi.clearAllMocks());

describe("listFechamentos", () => {
  it("busca a 2ª página quando passa de 1000 linhas", async () => {
    const { range } = mockCliente(1500);
    const r = await listFechamentos({ empresaId: "e1" });
    expect(r).toHaveLength(1500);
    expect(range).toHaveBeenCalledTimes(2);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("ordena por empresa e desempata por id (paginação estável)", async () => {
    const { q } = mockCliente(10);
    await listFechamentos({});
    expect(chamadasDeOrder(q)).toEqual(["empresa_id", "id"]);
  });
});

describe("paginarFechamentos", () => {
  it("pede só a faixa da página e devolve o total real", async () => {
    const { range, q } = mockCliente(1500);
    const r = await paginarFechamentos({ competencia: "2026-10-01" }, 3);
    expect(range).toHaveBeenCalledWith(100, 149);
    expect(r.itens).toHaveLength(50);
    expect(r).toMatchObject({ total: 1500, pagina: 3, tamanho: 50 });
    expect(q.select).toHaveBeenCalledWith(expect.any(String), { count: "exact" });
  });

  it("a ordem da lista paginada também termina em id", async () => {
    const { q } = mockCliente(10);
    await paginarFechamentos({}, 1);
    expect(chamadasDeOrder(q)).toEqual(["empresa_id", "id"]);
  });

  it("propaga erro do banco", async () => {
    const { range } = mockCliente(1);
    range.mockResolvedValueOnce({ data: null, error: { message: "falhou" }, count: 0 } as never);
    await expect(paginarFechamentos({}, 1)).rejects.toThrow("falhou");
  });
});
