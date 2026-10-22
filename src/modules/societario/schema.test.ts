import { describe, expect, it } from "vitest";

import {
  processoSocietarioItemSchema,
  processoSocietarioSchema,
} from "./schema";

const EMPRESA_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("processoSocietarioSchema", () => {
  const base = { empresa_id: EMPRESA_ID, tipo: "abertura" as const };

  it("aceita o mínimo válido", () => {
    const r = processoSocietarioSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.descricao).toBeNull();
      expect(r.data.protocolo).toBeNull();
    }
  });

  it("rejeita tipo fora do enum", () => {
    expect(
      processoSocietarioSchema.safeParse({ ...base, tipo: "invalido" })
        .success,
    ).toBe(false);
  });

  it("não tem campo status (situação muda só pelo seletor dedicado)", () => {
    const r = processoSocietarioSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).not.toHaveProperty("status");
  });

  it("aceita protocolo informado", () => {
    const r = processoSocietarioSchema.safeParse({
      ...base,
      protocolo: "JC-2026-04471",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.protocolo).toBe("JC-2026-04471");
  });
});

describe("processoSocietarioItemSchema", () => {
  it("exige descrição não vazia", () => {
    expect(
      processoSocietarioItemSchema.safeParse({
        processo_id: EMPRESA_ID,
        descricao: "",
      }).success,
    ).toBe(false);
  });
});
