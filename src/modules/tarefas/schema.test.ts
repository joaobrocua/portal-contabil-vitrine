import { describe, expect, it } from "vitest";

import { modeloSchema, prazoDoModelo, tarefaItemSchema, tarefaSchema } from "./schema";

describe("tarefaSchema", () => {
  const base = { titulo: "Fechamento do mês" };

  it("aceita o mínimo válido com defaults", () => {
    const r = tarefaSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.departamento).toBe("geral");
      expect(r.data.prioridade).toBe("normal");
      expect(r.data.status).toBe("nao_iniciada");
      expect(r.data.empresa_id).toBeNull();
    }
  });

  it("rejeita título muito curto", () => {
    expect(tarefaSchema.safeParse({ titulo: "Ab" }).success).toBe(false);
  });

  it("normaliza competência YYYY-MM para YYYY-MM-01", () => {
    const r = tarefaSchema.safeParse({ ...base, competencia: "2026-09" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.competencia).toBe("2026-09-01");
  });

  it("rejeita departamento fora do enum", () => {
    expect(
      tarefaSchema.safeParse({ ...base, departamento: "invalido" }).success,
    ).toBe(false);
  });

  it("rejeita prioridade fora do enum", () => {
    expect(
      tarefaSchema.safeParse({ ...base, prioridade: "critica" }).success,
    ).toBe(false);
  });
});

describe("tarefaItemSchema", () => {
  it("exige descrição não vazia", () => {
    expect(
      tarefaItemSchema.safeParse({
        tarefa_id: "550e8400-e29b-41d4-a716-446655440000",
        descricao: "",
      }).success,
    ).toBe(false);
  });

  it("aceita item válido", () => {
    expect(
      tarefaItemSchema.safeParse({
        tarefa_id: "550e8400-e29b-41d4-a716-446655440000",
        descricao: "Conciliação bancária",
      }).success,
    ).toBe(true);
  });
});

describe("modeloSchema", () => {
  const base = { nome: "Fechamento", titulo_padrao: "Fechamento mensal" };

  it("transforma o textarea em lista, ignorando linhas vazias e espaços", () => {
    const r = modeloSchema.safeParse({
      ...base,
      itens_padrao: "  Pedir extratos \r\n\nConciliar\n   \nEnviar balancete",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.itens_padrao).toEqual(["Pedir extratos", "Conciliar", "Enviar balancete"]);
      expect(r.data.dia_prazo).toBeNull();
      expect(r.data.departamento).toBe("geral");
    }
  });

  it("aceita dia do prazo 1–31 e recusa fora disso", () => {
    expect(modeloSchema.safeParse({ ...base, dia_prazo: "20" }).success).toBe(true);
    expect(modeloSchema.safeParse({ ...base, dia_prazo: "0" }).success).toBe(false);
    expect(modeloSchema.safeParse({ ...base, dia_prazo: "32" }).success).toBe(false);
    expect(modeloSchema.safeParse({ ...base, dia_prazo: "abc" }).success).toBe(false);
  });

  it("limita a 50 itens", () => {
    const muitos = Array.from({ length: 51 }, (_, i) => `Item ${i}`).join("\n");
    expect(modeloSchema.safeParse({ ...base, itens_padrao: muitos }).success).toBe(false);
  });

  it("exige nome e título", () => {
    expect(modeloSchema.safeParse({ titulo_padrao: "Algo válido" }).success).toBe(false);
    expect(modeloSchema.safeParse({ nome: "Algo" }).success).toBe(false);
  });
});

describe("prazoDoModelo", () => {
  it("sem dia definido não sugere prazo", () => {
    expect(prazoDoModelo(null, "2026-09-23")).toBeNull();
  });

  it("usa o dia no mês atual quando ainda não passou (inclui hoje)", () => {
    expect(prazoDoModelo(25, "2026-09-23")).toBe("2026-09-25");
    expect(prazoDoModelo(23, "2026-09-23")).toBe("2026-09-23");
  });

  it("pula pro mês seguinte quando o dia já passou, virando o ano em dezembro", () => {
    expect(prazoDoModelo(10, "2026-09-23")).toBe("2026-10-10");
    expect(prazoDoModelo(5, "2026-12-20")).toBe("2027-01-05");
  });

  it("dia maior que o mês cai no último dia", () => {
    expect(prazoDoModelo(31, "2026-09-01")).toBe("2026-09-30");
    expect(prazoDoModelo(31, "2027-02-01")).toBe("2027-02-28");
    expect(prazoDoModelo(30, "2027-01-31")).toBe("2027-02-28");
  });
});
