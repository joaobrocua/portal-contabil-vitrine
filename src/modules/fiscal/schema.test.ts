import { describe, expect, it } from "vitest";

import { gerarSchema, obrigacaoSchema, recorrenciaSchema } from "./schema";

const EMPRESA_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("obrigacaoSchema", () => {
  const base = {
    empresa_id: EMPRESA_ID,
    competencia: "2026-09",
    tipo: "das" as const,
    vencimento: "2026-10-20",
  };

  it("normaliza competência YYYY-MM para YYYY-MM-01", () => {
    const r = obrigacaoSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.competencia).toBe("2026-09-01");
      expect(r.data.status).toBe("pendente");
    }
  });

  it("rejeita competência em formato inválido", () => {
    expect(
      obrigacaoSchema.safeParse({ ...base, competencia: "09/2026" }).success,
    ).toBe(false);
  });

  it("rejeita empresa_id que não é uuid", () => {
    expect(
      obrigacaoSchema.safeParse({ ...base, empresa_id: "não-é-uuid" })
        .success,
    ).toBe(false);
  });

  it("faz parsing de valor em formato BRL", () => {
    const r = obrigacaoSchema.safeParse({ ...base, valor: "2.430,50" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.valor).toBe(2430.5);
  });
});

describe("recorrenciaSchema", () => {
  const base = { empresa_id: EMPRESA_ID, tipo: "fgts" as const };

  it("aplica os defaults de periodicidade/dia/meses", () => {
    const r = recorrenciaSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.periodicidade).toBe("mensal");
      expect(r.data.dia_vencimento).toBe(20);
      expect(r.data.meses_apos).toBe(1);
    }
  });

  it("rejeita dia_vencimento fora do range 1-31", () => {
    expect(
      recorrenciaSchema.safeParse({ ...base, dia_vencimento: 32 }).success,
    ).toBe(false);
  });

  it("coage dia_vencimento vindo como string numérica", () => {
    const r = recorrenciaSchema.safeParse({ ...base, dia_vencimento: "15" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.dia_vencimento).toBe(15);
  });
});

describe("gerarSchema", () => {
  it("aceita YYYY-MM-01 e também normaliza YYYY-MM", () => {
    expect(gerarSchema.safeParse({ competencia: "2026-09-01" }).success).toBe(
      true,
    );
    const r = gerarSchema.safeParse({ competencia: "2026-09" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.competencia).toBe("2026-09-01");
  });

  it("rejeita formato que não bate com YYYY-MM nem YYYY-MM-01", () => {
    expect(gerarSchema.safeParse({ competencia: "09/2026" }).success).toBe(
      false,
    );
  });
});
