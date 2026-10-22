import { describe, expect, it, vi } from "vitest";

import { fetchTodos } from "./pagination";

describe("fetchTodos", () => {
  it("devolve tudo numa página só quando cabe (menos de 1000 linhas)", async () => {
    const pagina = vi.fn().mockResolvedValue({
      data: [{ id: 1 }, { id: 2 }, { id: 3 }],
      error: null,
    });
    const out = await fetchTodos(pagina);
    expect(out).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(pagina).toHaveBeenCalledTimes(1);
    expect(pagina).toHaveBeenCalledWith(0, 999);
  });

  it("segue pra próxima página quando a resposta vem cheia (1000 linhas) — o caso que truncava antes", async () => {
    const pagina1000 = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const pagina = vi
      .fn()
      .mockResolvedValueOnce({ data: pagina1000, error: null })
      .mockResolvedValueOnce({ data: [{ id: 1000 }, { id: 1001 }], error: null });

    const out = await fetchTodos(pagina);
    expect(out).toHaveLength(1002);
    expect(pagina).toHaveBeenCalledTimes(2);
    expect(pagina).toHaveBeenNthCalledWith(1, 0, 999);
    expect(pagina).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("para quando a página exatamente cheia é seguida de uma vazia (múltiplo exato de 1000)", async () => {
    const pagina1000 = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const pagina = vi
      .fn()
      .mockResolvedValueOnce({ data: pagina1000, error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const out = await fetchTodos(pagina);
    expect(out).toHaveLength(1000);
    expect(pagina).toHaveBeenCalledTimes(2);
  });

  it("trata data null como página vazia", async () => {
    const pagina = vi.fn().mockResolvedValue({ data: null, error: null });
    expect(await fetchTodos(pagina)).toEqual([]);
  });

  it("propaga erro da query", async () => {
    const pagina = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "falha no banco" } });
    await expect(fetchTodos(pagina)).rejects.toThrow("falha no banco");
  });
});
