import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseServerClient } from "@/core/db/server";

vi.mock("@/core/db/server", () => ({ createSupabaseServerClient: vi.fn() }));

const { itensDoPeriodo } = await import("./queries");

/** Tabela falsa que obedece ao teto de 1000 linhas do PostgREST. */
function tabela(linhas: Record<string, unknown>[]) {
  const range = vi.fn(async (de: number, ate: number) => ({
    data: linhas.slice(de, Math.min(ate, de + 999) + 1),
    error: null,
  }));
  const q: Record<string, unknown> = { range };
  for (const m of ["select", "gte", "lte", "not", "order"]) q[m] = vi.fn(() => q);
  return { q, range };
}

function mockCliente(eventos: Record<string, unknown>[], tarefas: Record<string, unknown>[]) {
  const ev = tabela(eventos);
  const tf = tabela(tarefas);
  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    from: (t: string) => (t === "eventos_agenda" ? ev.q : tf.q),
  } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
  return { ev, tf };
}

/** Colunas passadas a .order(), na ordem das chamadas. */
function chamadasDeOrder(q: Record<string, unknown>): unknown[] {
  return (q.order as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]);
}

beforeEach(() => vi.clearAllMocks());

describe("itensDoPeriodo", () => {
  it("busca a 2ª página quando passa de 1000 linhas", async () => {
    const tarefas = Array.from({ length: 1200 }, (_, i) => ({
      id: `t${i}`, prazo: "2026-10-10", titulo: `T${i}`, departamento: null, status: "pendente", empresa: null,
    }));
    const { tf } = mockCliente([], tarefas);
    const itens = await itensDoPeriodo("2026-10-01", "2026-10-31");
    expect(itens).toHaveLength(1200);
    expect(tf.range).toHaveBeenCalledTimes(2);
    expect(tf.range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("desempata a ordem por id (sem isso o .range() repete ou pula linhas entre páginas)", async () => {
    const { ev, tf } = mockCliente([], []);
    await itensDoPeriodo("2026-10-01", "2026-10-31");
    expect(chamadasDeOrder(ev.q)).toEqual(["data", "id"]);
    expect(chamadasDeOrder(tf.q)).toEqual(["prazo", "id"]);
  });

  it("junta eventos e tarefas ordenados por data", async () => {
    mockCliente(
      [{ id: "e1", data: "2026-10-20", titulo: "Reunião", tipo: "reuniao", departamento: null, concluido: false, empresa: null }],
      [{ id: "t1", prazo: "2026-10-05", titulo: "Tarefa", departamento: null, status: "concluida", empresa: null }],
    );
    const itens = await itensDoPeriodo("2026-10-01", "2026-10-31");
    expect(itens.map((i) => i.id)).toEqual(["tf-t1", "ev-e1"]);
    expect(itens[0].concluido).toBe(true);
  });

  it("propaga erro do banco em vez de devolver lista vazia", async () => {
    const q: Record<string, unknown> = { range: async () => ({ data: null, error: { message: "falhou" } }) };
    for (const m of ["select", "gte", "lte", "not", "order"]) q[m] = () => q;
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: () => q } as never);
    await expect(itensDoPeriodo("2026-10-01", "2026-10-31")).rejects.toThrow("falhou");
  });
});
