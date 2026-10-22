import { describe, expect, it } from "vitest";

import { filtroEmpresaNomeOuCnpj, inLista, orBusca, orCampoOuEmpresa } from "./busca";

describe("orCampoOuEmpresa", () => {
  it("só o campo quando nenhuma empresa casa", () => {
    expect(orCampoOuEmpresa("titulo", "das", [])).toBe("titulo.ilike.*das*");
  });

  it("campo OU empresa quando há empresas", () => {
    expect(orCampoOuEmpresa("nome", "ana", ["a", "b"])).toBe(
      "nome.ilike.*ana*,empresa_id.in.(a,b)",
    );
  });
});

describe("inLista / orBusca", () => {
  it("lista vazia vira null", () => {
    expect(inLista("tipo", [])).toBeNull();
    expect(inLista("tipo", ["das", "fgts"])).toBe("tipo.in.(das,fgts)");
  });

  it("junta só as condições válidas; nenhuma = null (nada casa)", () => {
    expect(orBusca([null, "a.eq.1", null, "b.eq.2"])).toBe("a.eq.1,b.eq.2");
    expect(orBusca([null, null])).toBeNull();
  });
});

describe("filtroEmpresaNomeOuCnpj", () => {
  it("texto comum busca só em razão social e nome fantasia", () => {
    expect(filtroEmpresaNomeOuCnpj("padaria")).toBe("razao_social.ilike.*padaria*,nome_fantasia.ilike.*padaria*");
  });

  it("número de CNPJ (com ou sem pontuação) também busca no CNPJ, só pelos dígitos", () => {
    expect(filtroEmpresaNomeOuCnpj("20590257")).toContain("cnpj.ilike.*20590257*");
    expect(filtroEmpresaNomeOuCnpj("20.590.257/0001-58")).toContain("cnpj.ilike.*20590257000158*");
  });

  it("menos de 3 dígitos não busca CNPJ (senão casaria com quase todos)", () => {
    expect(filtroEmpresaNomeOuCnpj("12")).not.toContain("cnpj");
  });

  it("nome com número no meio não vira busca de CNPJ (\"Empresa 007\" não traz CNPJs com 007)", () => {
    expect(filtroEmpresaNomeOuCnpj("Empresa 007")).not.toContain("cnpj");
  });
});
