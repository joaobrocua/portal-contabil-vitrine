import { describe, expect, it } from "vitest";

import { abrirFolhasSchema, eventoDpSchema, funcionarioSchema } from "./schema";

const EMPRESA_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("funcionarioSchema", () => {
  const base = { empresa_id: EMPRESA_ID, nome: "Maria Souza" };

  it("aceita o mínimo válido com defaults", () => {
    const r = funcionarioSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.tipo_contrato).toBe("clt");
      expect(r.data.status).toBe("ativo");
      expect(r.data.cpf).toBeNull();
    }
  });

  it("rejeita CPF com tamanho errado quando informado", () => {
    expect(
      funcionarioSchema.safeParse({ ...base, cpf: "123" }).success,
    ).toBe(false);
  });

  it("faz parsing de salário em formato BRL", () => {
    const r = funcionarioSchema.safeParse({ ...base, salario: "3.200,00" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.salario).toBe(3200);
  });

  it("rejeita nome muito curto", () => {
    expect(funcionarioSchema.safeParse({ ...base, nome: "M" }).success).toBe(
      false,
    );
  });
});

describe("eventoDpSchema", () => {
  const base = { empresa_id: EMPRESA_ID, tipo: "admissao" as const };

  it("aceita o mínimo válido", () => {
    expect(eventoDpSchema.safeParse(base).success).toBe(true);
  });

  it("normaliza competência YYYY-MM para YYYY-MM-01", () => {
    const r = eventoDpSchema.safeParse({ ...base, competencia: "2026-09" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.competencia).toBe("2026-09-01");
  });

  it("rejeita tipo de evento fora do enum", () => {
    expect(
      eventoDpSchema.safeParse({ ...base, tipo: "invalido" }).success,
    ).toBe(false);
  });

  it("não tem campo status (situação muda só pelo seletor dedicado)", () => {
    const r = eventoDpSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).not.toHaveProperty("status");
  });
});

describe("abrirFolhasSchema", () => {
  it("aceita competência vazia (normaliza pra null)", () => {
    const r = abrirFolhasSchema.safeParse({ competencia: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.competencia).toBeNull();
  });

  it("normaliza YYYY-MM para YYYY-MM-01", () => {
    const r = abrirFolhasSchema.safeParse({ competencia: "2026-09" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.competencia).toBe("2026-09-01");
  });
});
