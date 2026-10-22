import { describe, expect, it } from "vitest";

import { atualizarDeclaracaoIrSchema, gerarDeclaracoesIrSchema } from "./schema";

describe("gerarDeclaracoesIrSchema", () => {
  it("aceita o mínimo válido", () => {
    const r = gerarDeclaracoesIrSchema.safeParse({
      tipo: "irpf",
      ano_exercicio: 2026,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.prazo).toBeNull();
  });

  it("coage ano_exercicio vindo como string", () => {
    const r = gerarDeclaracoesIrSchema.safeParse({
      tipo: "irpj",
      ano_exercicio: "2026",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ano_exercicio).toBe(2026);
  });

  it("rejeita ano fora do range 2000-2100", () => {
    expect(
      gerarDeclaracoesIrSchema.safeParse({ tipo: "itr", ano_exercicio: 1999 })
        .success,
    ).toBe(false);
  });

  it("rejeita tipo fora do enum irpf/irpj/itr", () => {
    expect(
      gerarDeclaracoesIrSchema.safeParse({
        tipo: "invalido",
        ano_exercicio: 2026,
      }).success,
    ).toBe(false);
  });
});

describe("atualizarDeclaracaoIrSchema", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";

  it("aceita só o id (demais campos opcionais)", () => {
    const r = atualizarDeclaracaoIrSchema.safeParse({ id });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.valor_a_pagar).toBeNull();
      expect(r.data.responsavel_id).toBeNull();
    }
  });

  it("faz parsing de valores em formato BRL", () => {
    const r = atualizarDeclaracaoIrSchema.safeParse({
      id,
      valor_a_pagar: "1.234,56",
      valor_a_restituir: "0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.valor_a_pagar).toBe(1234.56);
      expect(r.data.valor_a_restituir).toBe(0);
    }
  });

  it("valor salvo e reaberto no form (ponto decimal) não é multiplicado por 100", () => {
    const r = atualizarDeclaracaoIrSchema.safeParse({
      id,
      valor_a_pagar: "1234.56",
      valor_a_restituir: "1500,5",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.valor_a_pagar).toBe(1234.56);
      expect(r.data.valor_a_restituir).toBe(1500.5);
    }
  });

  it("não tem campo status (muda só pelo seletor dedicado)", () => {
    const r = atualizarDeclaracaoIrSchema.safeParse({ id });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).not.toHaveProperty("status");
  });
});
