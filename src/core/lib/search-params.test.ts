import { describe, expect, it } from "vitest";

import { paramAno, paramEnum, paramMes, paramUuid } from "./search-params";

describe("paramUuid", () => {
  it("aceita UUID válido (maiúsculas também)", () => {
    expect(paramUuid("35c04701-ca5f-49d5-add8-9175b6b209d3")).toBe(
      "35c04701-ca5f-49d5-add8-9175b6b209d3",
    );
    expect(paramUuid("35C04701-CA5F-49D5-ADD8-9175B6B209D3")).toBeDefined();
  });
  it("recusa lixo, vazio, array e UUID com sobra", () => {
    expect(paramUuid("abc")).toBeUndefined();
    expect(paramUuid("")).toBeUndefined();
    expect(paramUuid(["35c04701-ca5f-49d5-add8-9175b6b209d3"])).toBeUndefined();
    expect(paramUuid("35c04701-ca5f-49d5-add8-9175b6b209d3' or 1=1")).toBeUndefined();
  });
});

describe("paramMes", () => {
  it("aceita YYYY-MM válido", () => {
    expect(paramMes("2026-09")).toBe("2026-09");
    expect(paramMes("2026-12")).toBe("2026-12");
  });
  it("recusa mês fora de 01–12, formato errado e lixo", () => {
    expect(paramMes("2026-13")).toBeUndefined();
    expect(paramMes("2026-00")).toBeUndefined();
    expect(paramMes("2026-9")).toBeUndefined();
    expect(paramMes("lixo")).toBeUndefined();
    expect(paramMes("99999-01")).toBeUndefined();
    expect(paramMes(undefined)).toBeUndefined();
  });
});

describe("paramAno", () => {
  it("aceita ano razoável", () => {
    expect(paramAno("2026")).toBe(2026);
  });
  it("recusa fora da faixa, não numérico e com sobra", () => {
    expect(paramAno("1999")).toBeUndefined();
    expect(paramAno("2101")).toBeUndefined();
    expect(paramAno("20a6")).toBeUndefined();
    expect(paramAno("2026.5")).toBeUndefined();
  });
});

describe("paramEnum", () => {
  it("aceita só valor da lista", () => {
    expect(paramEnum("fiscal", ["fiscal", "pessoal"] as const)).toBe("fiscal");
    expect(paramEnum("outro", ["fiscal", "pessoal"] as const)).toBeUndefined();
  });
});
