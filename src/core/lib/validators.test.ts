import { describe, expect, it } from "vitest";

import {
  isValidCNPJ,
  isValidCPF,
  parseValor,
  zCNPJ,
  zCompetencia,
  zCPF,
} from "./validators";

describe("isValidCPF", () => {
  it("aceita CPFs válidos", () => {
    expect(isValidCPF("529.982.247-25")).toBe(true);
    expect(isValidCPF("52998224725")).toBe(true);
  });

  it("rejeita dígito verificador errado", () => {
    expect(isValidCPF("529.982.247-26")).toBe(false);
  });

  it("rejeita todos os dígitos iguais", () => {
    expect(isValidCPF("111.111.111-11")).toBe(false);
  });

  it("rejeita tamanho errado", () => {
    expect(isValidCPF("123")).toBe(false);
  });
});

describe("isValidCNPJ", () => {
  it("aceita CNPJs válidos", () => {
    expect(isValidCNPJ("11.222.333/0001-81")).toBe(true);
    expect(isValidCNPJ("11222333000181")).toBe(true);
  });

  it("rejeita dígito verificador errado", () => {
    expect(isValidCNPJ("11.222.333/0001-82")).toBe(false);
  });

  it("rejeita todos os dígitos iguais", () => {
    expect(isValidCNPJ("11.111.111/1111-11")).toBe(false);
  });

  it("rejeita tamanho errado", () => {
    expect(isValidCNPJ("123")).toBe(false);
  });
});

describe("zCNPJ", () => {
  it("normaliza formatado para 14 dígitos", () => {
    const r = zCNPJ.safeParse("11.222.333/0001-81");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("11222333000181");
  });

  it("rejeita CNPJ com dígito verificador inválido", () => {
    expect(zCNPJ.safeParse("11.222.333/0001-82").success).toBe(false);
  });

  it("rejeita tamanho errado", () => {
    expect(zCNPJ.safeParse("123").success).toBe(false);
  });
});

describe("zCPF", () => {
  it("normaliza formatado para 11 dígitos", () => {
    const r = zCPF.safeParse("529.982.247-25");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("52998224725");
  });

  it("rejeita CPF inválido", () => {
    expect(zCPF.safeParse("111.111.111-11").success).toBe(false);
  });
});

describe("zCompetencia", () => {
  it("aceita competência no 1º dia do mês", () => {
    expect(zCompetencia.safeParse("2026-09-01").success).toBe(true);
  });

  it("rejeita sem o dia", () => {
    expect(zCompetencia.safeParse("2026-09").success).toBe(false);
  });

  it("rejeita dia diferente de 01", () => {
    expect(zCompetencia.safeParse("2026-09-15").success).toBe(false);
  });
});

describe("parseValor", () => {
  it("formato brasileiro com milhar e vírgula", () => {
    expect(parseValor("1.234,56")).toBe(1234.56);
    expect(parseValor("1234,56")).toBe(1234.56);
    expect(parseValor("1.234.567,89")).toBe(1234567.89);
  });

  it("ponto como decimal quando não há vírgula (evita 1500.50 → 150050)", () => {
    expect(parseValor("1500.50")).toBe(1500.5);
    expect(parseValor("1234.56")).toBe(1234.56);
    expect(parseValor("10.5")).toBe(10.5);
  });

  it("ponto como milhar quando seguido de 3 dígitos", () => {
    expect(parseValor("1.500")).toBe(1500);
    expect(parseValor("1.234.567")).toBe(1234567);
  });

  it("inteiro simples e prefixo R$", () => {
    expect(parseValor("1500")).toBe(1500);
    expect(parseValor("R$ 1.500,00")).toBe(1500);
  });

  it("vazio ou inválido vira null", () => {
    expect(parseValor("")).toBeNull();
    expect(parseValor(null)).toBeNull();
    expect(parseValor("abc")).toBeNull();
  });
});
