import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  competenciaAtual,
  diasAte,
  formatCNPJ,
  formatCompetencia,
  formatCompetenciaCurta,
  formatCPF,
  formatCpfCnpj,
  formatData,
  formatDataHora,
  formatMoeda,
  formatTelefone,
  hojeISO,
  ultimasCompetencias,
} from "./format";

describe("formatCNPJ", () => {
  it("aplica a máscara", () => {
    expect(formatCNPJ("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("retorna vazio para nulo/indefinido", () => {
    expect(formatCNPJ(null)).toBe("");
    expect(formatCNPJ(undefined)).toBe("");
  });
});

describe("formatCPF", () => {
  it("aplica a máscara", () => {
    expect(formatCPF("52998224725")).toBe("529.982.247-25");
  });

  it("retorna vazio para nulo", () => {
    expect(formatCPF(null)).toBe("");
  });
});

describe("formatCpfCnpj", () => {
  it("detecta CPF pelo tamanho", () => {
    expect(formatCpfCnpj("52998224725")).toBe("529.982.247-25");
  });

  it("detecta CNPJ pelo tamanho", () => {
    expect(formatCpfCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
});

describe("formatTelefone", () => {
  it("formata celular (11 dígitos)", () => {
    expect(formatTelefone("66995551234")).toBe("(66) 99555-1234");
  });

  it("formata fixo (10 dígitos)", () => {
    expect(formatTelefone("6635311200")).toBe("(66) 3531-1200");
  });

  it("mantém original se não bater com 10/11 dígitos", () => {
    expect(formatTelefone("123")).toBe("123");
  });
});

describe("formatMoeda", () => {
  it("formata em BRL", () => {
    expect(formatMoeda(1850)).toBe("R$ 1.850,00");
  });

  it("trata nulo como zero", () => {
    expect(formatMoeda(null)).toBe("R$ 0,00");
  });
});

describe("formatData / formatDataHora", () => {
  it("formata data pura sem passar por fuso (não 'anda' um dia)", () => {
    expect(formatData("2026-09-12")).toBe("12/09/2026");
  });

  it("retorna travessão para valor vazio/inválido", () => {
    expect(formatData(null)).toBe("—");
    expect(formatData("data-invalida")).toBe("—");
    expect(formatDataHora(null)).toBe("—");
  });
});

describe("hojeISO / competência / diasAte — fuso de Cuiabá (America/Cuiaba, UTC-4)", () => {
  // Fixamos por instante UTC explícito (não construtor local) pra o teste
  // não depender do fuso de quem roda (CI, Windows local do escritório,
  // etc.) — é exatamente o bug que estamos corrigindo.
  beforeEach(() => {
    // 2026-09-12T16:00:00Z = 2026-09-12 12:00 em Cuiabá (UTC-4).
    vi.setSystemTime(new Date("2026-09-12T16:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hojeISO usa o fuso de Cuiabá, não UTC", () => {
    expect(hojeISO()).toBe("2026-09-12");
  });

  it("hojeISO não vira o dia seguinte de noite (o bug do UTC direto)", () => {
    // 2026-09-13T02:00:00Z = 2026-09-12 22:00 em Cuiabá — já é dia 13 em
    // UTC, mas ainda é dia 12 aqui. `new Date().toISOString().slice(0,10)`
    // (a versão antiga) daria "2026-09-13", errado.
    vi.setSystemTime(new Date("2026-09-13T02:00:00Z"));
    expect(hojeISO()).toBe("2026-09-12");
  });

  it("competenciaAtual retorna o mês atual no formato YYYY-MM-01", () => {
    expect(competenciaAtual()).toBe("2026-09-01");
  });

  it("formatCompetencia escreve por extenso", () => {
    expect(formatCompetencia("2026-09-01")).toBe("setembro/2026");
  });

  it("formatCompetenciaCurta usa mm/aaaa", () => {
    expect(formatCompetenciaCurta("2026-09-01")).toBe("09/2026");
  });

  it("formatCompetencia trata nulo", () => {
    expect(formatCompetencia(null)).toBe("—");
  });

  it("ultimasCompetencias lista N meses, mais recente primeiro", () => {
    const meses = ultimasCompetencias(3);
    expect(meses).toEqual(["2026-09-01", "2026-08-01", "2026-07-01"]);
  });

  it("calcula dias no futuro, a partir de string 'YYYY-MM-DD'", () => {
    expect(diasAte("2026-09-15")).toBe(3);
  });

  it("calcula dias em atraso como negativo", () => {
    expect(diasAte("2026-09-10")).toBe(-2);
  });

  it("aceita Date também (getters locais, não reinterpretado por fuso)", () => {
    expect(diasAte(new Date(2026, 8, 15))).toBe(3);
  });

  it("retorna null para valor vazio ou string inválida", () => {
    expect(diasAte(null)).toBeNull();
    expect(diasAte("não-é-data")).toBeNull();
  });
});
