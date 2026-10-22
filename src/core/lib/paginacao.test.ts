import { describe, expect, it, vi } from "vitest";

import { buscarPagina, faixaDaPagina, paramBusca, paramPagina, TAMANHO_PAGINA } from "./paginacao";

describe("paramPagina", () => {
  it("aceita inteiros positivos", () => {
    expect(paramPagina("1")).toBe(1);
    expect(paramPagina("37")).toBe(37);
  });
  it("qualquer outra coisa vira 1", () => {
    for (const v of [undefined, "", "0", "-2", "abc", "1.5", "999999", ["2"]]) {
      expect(paramPagina(v)).toBe(1);
    }
  });
});

describe("faixaDaPagina", () => {
  it("calcula a faixa inclusiva do range", () => {
    expect(faixaDaPagina(1)).toEqual([0, TAMANHO_PAGINA - 1]);
    expect(faixaDaPagina(3, 20)).toEqual([40, 59]);
  });
});

describe("paramBusca", () => {
  it("tira o que quebraria o filtro do PostgREST", () => {
    expect(paramBusca("Padaria, (Centro)*")).toBe("Padaria Centro");
    expect(paramBusca("100%")).toBe("100");
  });
  it("vazio ou só símbolos vira undefined", () => {
    expect(paramBusca("   ")).toBeUndefined();
    expect(paramBusca("(),*")).toBeUndefined();
    expect(paramBusca(undefined)).toBeUndefined();
  });
  it("limita o tamanho", () => {
    expect(paramBusca("a".repeat(200))?.length).toBe(80);
  });
});

describe("buscarPagina", () => {
  const ok = { data: [1], error: null, count: 1 };
  const fora = { data: null, error: { code: "PGRST103", message: "Requested range not satisfiable" }, count: null };

  it("devolve a página pedida na primeira tentativa", async () => {
    const consulta = vi.fn(async () => ok);
    const r = await buscarPagina(consulta, 3, 20);
    expect(consulta).toHaveBeenCalledTimes(1);
    expect(consulta).toHaveBeenCalledWith(40, 59);
    expect(r).toEqual({ ...ok, pagina: 3 });
  });

  it("PGRST103 refaz na página 1 e devolve pagina=1", async () => {
    const consulta = vi.fn(async (de: number) => (de === 0 ? ok : fora));
    const r = await buscarPagina(consulta, 99999, 50);
    expect(consulta).toHaveBeenCalledTimes(2);
    expect(consulta).toHaveBeenNthCalledWith(1, 4999900, 4999949);
    expect(consulta).toHaveBeenNthCalledWith(2, 0, 49);
    expect(r).toEqual({ ...ok, pagina: 1 });
  });

  it("outro erro é devolvido sem refazer", async () => {
    const erro = { data: null, error: { code: "42501", message: "negado" }, count: null };
    const consulta = vi.fn(async () => erro);
    const r = await buscarPagina(consulta, 2);
    expect(consulta).toHaveBeenCalledTimes(1);
    expect(r.error?.message).toBe("negado");
  });

  it("PGRST103 já na página 1 não entra em laço", async () => {
    const consulta = vi.fn(async () => fora);
    const r = await buscarPagina(consulta, 1);
    expect(consulta).toHaveBeenCalledTimes(1);
    expect(r.error?.code).toBe("PGRST103");
  });
});
