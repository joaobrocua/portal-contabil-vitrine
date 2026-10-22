import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseAdminClient } from "@/core/db/admin";

import { clientIp, confirmarSucesso, descartarEvento, limiteExcedido, registrarEvento, saltosConfiaveis } from "./rate-limit";

vi.mock("@/core/db/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));

const { headers } = await import("next/headers");

const adminMock = vi.mocked(createSupabaseAdminClient);
const headersMock = vi.mocked(headers);

/**
 * Simula a cadeia `admin.from(...).select(...).eq(...).eq(...).gte(...)`,
 * que só resolve (thenable) no fim, devolvendo `{ count }`.
 * `capturado` guarda os filtros aplicados pra checar o `apenasFalhas`.
 */
function mockAdminComContagem(counts: number[]) {
  const capturado: { eqs: [string, unknown][]; inserts: unknown[]; updates: unknown[]; deletes: number } = {
    deletes: 0,
    eqs: [],
    inserts: [],
    updates: [],
  };
  let chamada = 0;

  const query = {
    eq(coluna: string, valor: unknown) {
      capturado.eqs.push([coluna, valor]);
      return query;
    },
    gte() {
      return query;
    },
    then(resolve: (r: { count: number }) => unknown) {
      const count = counts[chamada] ?? 0;
      chamada += 1;
      return Promise.resolve(resolve({ count }));
    },
  };

  adminMock.mockReturnValue({
    from: () => ({
      select: () => query,
      insert: (payload: unknown) => {
        capturado.inserts.push(payload);
        return { select: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "evento-9" } }) }) };
      },
      delete: () => ({
        eq: (coluna: string, valor: unknown) => {
          capturado.eqs.push([coluna, valor]);
          capturado.deletes += 1;
          return Promise.resolve({ error: null });
        },
      }),
      update: (payload: unknown) => {
        capturado.updates.push(payload);
        return { eq: (coluna: string, valor: unknown) => { capturado.eqs.push([coluna, valor]); return Promise.resolve({ error: null }); } };
      },
    }),
  } as unknown as ReturnType<typeof createSupabaseAdminClient>);

  return capturado;
}

beforeEach(() => {
  vi.clearAllMocks();
});

function headersCom(valores: Record<string, string>) {
  headersMock.mockResolvedValue({
    get: (nome: string) => valores[nome] ?? null,
  } as unknown as Awaited<ReturnType<typeof headers>>);
}

describe("saltosConfiaveis", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sem configuração e fora da Vercel: 0 (nenhum proxy confiável)", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "");
    vi.stubEnv("VERCEL", "");
    expect(saltosConfiaveis()).toBe(0);
  });

  it("na Vercel: 1, sem precisar configurar nada", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "");
    vi.stubEnv("VERCEL", "1");
    expect(saltosConfiaveis()).toBe(1);
  });

  it("TRUSTED_PROXY_HOPS tem prioridade sobre a detecção", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    expect(saltosConfiaveis()).toBe(2);
  });

  it("valor inválido vira 0 (o mais seguro: ignora os cabeçalhos)", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("TRUSTED_PROXY_HOPS", "abc");
    expect(saltosConfiaveis()).toBe(0);
    vi.stubEnv("TRUSTED_PROXY_HOPS", "-1");
    expect(saltosConfiaveis()).toBe(0);
  });
});

describe("clientIp", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sem proxy confiável IGNORA x-forwarded-for e x-real-ip (o cliente os forja)", async () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "0");
    headersCom({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8" });
    expect(await clientIp()).toBeNull();
  });

  it("com 1 proxy confiável: usa o último IP (o que o proxy acrescentou)", async () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    headersCom({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1 " });
    expect(await clientIp()).toBe("10.0.0.1");
  });

  it("com 1 proxy: não deixa o cliente forjar o início da lista", async () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    headersCom({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" });
    expect(await clientIp()).toBe("203.0.113.7");
  });

  it("com 2 proxies confiáveis: o IP do cliente é o penúltimo", async () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    headersCom({ "x-forwarded-for": "9.9.9.9, 203.0.113.7, 10.0.0.1" });
    expect(await clientIp()).toBe("203.0.113.7");
  });

  it("lista mais curta que o número de proxies: não dá para confiar, devolve null", async () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    headersCom({ "x-forwarded-for": "203.0.113.7" });
    expect(await clientIp()).toBeNull();
  });

  it("devolve null quando não há x-forwarded-for (x-real-ip não é usado)", async () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    headersCom({ "x-real-ip": "198.51.100.4" });
    expect(await clientIp()).toBeNull();
  });

  it("devolve null (sem estourar) se headers() falhar", async () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    headersMock.mockRejectedValue(new Error("fora de request"));
    expect(await clientIp()).toBeNull();
  });
});

describe("limiteExcedido", () => {
  const base = {
    tipo: "login",
    chave: "alguem@exemplo.com",
    maxPorChave: 5,
    janelaMinutos: 15,
  };

  it("libera quando está abaixo do limite", async () => {
    mockAdminComContagem([4]);
    expect(await limiteExcedido(base)).toBe(false);
  });

  it("bloqueia exatamente ao atingir o limite", async () => {
    mockAdminComContagem([5]);
    expect(await limiteExcedido(base)).toBe(true);
  });

  it("bloqueia acima do limite", async () => {
    mockAdminComContagem([9]);
    expect(await limiteExcedido(base)).toBe(true);
  });

  it("só conta falhas por padrão (apenasFalhas = true)", async () => {
    const cap = mockAdminComContagem([0]);
    await limiteExcedido(base);
    expect(cap.eqs).toContainEqual(["sucesso", false]);
  });

  it("conta toda tentativa quando apenasFalhas = false", async () => {
    const cap = mockAdminComContagem([0]);
    await limiteExcedido({ ...base, apenasFalhas: false });
    expect(cap.eqs).not.toContainEqual(["sucesso", false]);
  });

  it("aplica a trava secundária por IP", async () => {
    // 1ª contagem (chave) abaixo do limite, 2ª (IP) acima.
    mockAdminComContagem([1, 20]);
    const r = await limiteExcedido({
      ...base,
      ip: "203.0.113.7",
      maxPorIp: 20,
    });
    expect(r).toBe(true);
  });

  it("ignora a trava por IP quando maxPorIp não é informado", async () => {
    const cap = mockAdminComContagem([1, 999]);
    const r = await limiteExcedido({ ...base, ip: "203.0.113.7" });
    expect(r).toBe(false);
    expect(cap.eqs).not.toContainEqual(["ip", "203.0.113.7"]);
  });

  it("libera (fail-open) quando a consulta ao banco falha", async () => {
    adminMock.mockImplementation(() => {
      throw new Error("sem chave de service role");
    });
    expect(await limiteExcedido(base)).toBe(false);
  });
});

describe("registrarEvento", () => {
  it("grava o evento com tipo, chave, sucesso e IP", async () => {
    const cap = mockAdminComContagem([]);
    await registrarEvento("login", "alguem@exemplo.com", false, "203.0.113.7");
    expect(cap.inserts).toEqual([
      {
        tipo: "login",
        chave: "alguem@exemplo.com",
        sucesso: false,
        ip: "203.0.113.7",
      },
    ]);
  });

  it("devolve o id do evento gravado", async () => {
    mockAdminComContagem([]);
    expect(await registrarEvento("login", "a@b.com", false, null)).toBe("evento-9");
  });

  it("não estoura se o insert falhar (best-effort) e devolve null", async () => {
    adminMock.mockImplementation(() => {
      throw new Error("indisponível");
    });
    await expect(registrarEvento("login", "alguem@exemplo.com", true, null)).resolves.toBeNull();
  });
});

describe("descartarEvento", () => {
  it("apaga o evento pelo id", async () => {
    const cap = mockAdminComContagem([]);
    await descartarEvento("evento-9");
    expect(cap.deletes).toBe(1);
    expect(cap.eqs).toContainEqual(["id", "evento-9"]);
  });

  it("sem id não faz nada", async () => {
    const cap = mockAdminComContagem([]);
    await descartarEvento(null);
    expect(cap.deletes).toBe(0);
  });
});

describe("confirmarSucesso", () => {
  it("marca o evento como sucesso pelo id", async () => {
    const cap = mockAdminComContagem([]);
    await confirmarSucesso("evento-9");
    expect(cap.updates).toEqual([{ sucesso: true }]);
    expect(cap.eqs).toContainEqual(["id", "evento-9"]);
  });

  it("sem id (registro falhou) não faz nada", async () => {
    const cap = mockAdminComContagem([]);
    await confirmarSucesso(null);
    expect(cap.updates).toEqual([]);
  });

  it("não estoura se o banco falhar", async () => {
    adminMock.mockImplementation(() => {
      throw new Error("indisponível");
    });
    await expect(confirmarSucesso("x")).resolves.toBeUndefined();
  });
});
