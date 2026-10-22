import { describe, expect, it } from "vitest";

import {
  abrirFechamentosSchema,
  atualizarFechamentoSchema,
  fechamentoItemSchema,
} from "./schema";

describe("abrirFechamentosSchema", () => {
  it("normaliza YYYY-MM para YYYY-MM-01", () => {
    const r = abrirFechamentosSchema.safeParse({ competencia: "2026-09" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.competencia).toBe("2026-09-01");
  });

  it("rejeita competência já no formato YYYY-MM-01 (exige YYYY-MM puro)", () => {
    expect(
      abrirFechamentosSchema.safeParse({ competencia: "2026-09-01" }).success,
    ).toBe(false);
  });

  it("rejeita formato inválido", () => {
    expect(
      abrirFechamentosSchema.safeParse({ competencia: "09/2026" }).success,
    ).toBe(false);
  });
});

describe("atualizarFechamentoSchema", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";

  it("aceita só o id (demais campos opcionais)", () => {
    const r = atualizarFechamentoSchema.safeParse({ id });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.responsavel_id).toBeNull();
      expect(r.data.observacao).toBeNull();
    }
  });

  it("rejeita id que não é uuid", () => {
    expect(
      atualizarFechamentoSchema.safeParse({ id: "não-é-uuid" }).success,
    ).toBe(false);
  });
});

describe("fechamentoItemSchema", () => {
  it("exige descrição não vazia", () => {
    expect(
      fechamentoItemSchema.safeParse({
        fechamento_id: "550e8400-e29b-41d4-a716-446655440000",
        descricao: "",
      }).success,
    ).toBe(false);
  });
});
