import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  actionErr,
  actionOk,
  departamentoDoPapel,
  estadoObrigacao,
  isAdmin,
  isCliente,
  isStaff,
} from "./domain";

describe("estadoObrigacao", () => {
  // Instante UTC explícito (não construtor local) pra "hoje" (fuso de
  // Cuiabá, dentro de estadoObrigacao) não depender do fuso de quem roda o
  // teste. 2026-09-12T16:00:00Z = 2026-09-12 12:00 em Cuiabá (UTC-4).
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-09-12T16:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("status entregue/paga/dispensada é sempre 'ok', mesmo vencida", () => {
    expect(estadoObrigacao("entregue", "2026-09-01")).toBe("ok");
    expect(estadoObrigacao("paga", "2026-09-01")).toBe("ok");
    expect(estadoObrigacao("dispensada", "2026-09-01")).toBe("ok");
  });

  it("vencimento no passado e status não concluído vira 'atraso'", () => {
    expect(estadoObrigacao("pendente", "2026-09-01")).toBe("atraso");
  });

  it("vencimento futuro e status não concluído vira 'andamento'", () => {
    expect(estadoObrigacao("pendente", "2026-09-30")).toBe("andamento");
  });

  it("sem vencimento e não concluído vira 'andamento'", () => {
    expect(estadoObrigacao("em_andamento", null)).toBe("andamento");
  });
});

describe("departamentoDoPapel", () => {
  it("mapeia papéis de departamento para o departamento correspondente", () => {
    expect(departamentoDoPapel("fiscal")).toBe("fiscal");
    expect(departamentoDoPapel("pessoal")).toBe("pessoal");
    expect(departamentoDoPapel("contabil")).toBe("contabil");
    expect(departamentoDoPapel("societario")).toBe("societario");
    expect(departamentoDoPapel("atendimento")).toBe("atendimento");
  });

  it("admin e cliente não têm departamento natural (null = vê todos)", () => {
    expect(departamentoDoPapel("admin")).toBeNull();
    expect(departamentoDoPapel("cliente")).toBeNull();
  });
});

describe("papéis", () => {
  it("isCliente/isStaff são complementares", () => {
    expect(isCliente("cliente")).toBe(true);
    expect(isStaff("cliente")).toBe(false);
    expect(isCliente("admin")).toBe(false);
    expect(isStaff("fiscal")).toBe(true);
  });

  it("isAdmin só é true para admin", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("fiscal")).toBe(false);
  });
});

describe("actionOk / actionErr", () => {
  it("actionOk carrega dados com ok:true", () => {
    expect(actionOk({ id: "1" })).toEqual({ ok: true, data: { id: "1" } });
  });

  it("actionErr carrega mensagem com ok:false", () => {
    expect(actionErr("deu ruim")).toEqual({ ok: false, error: "deu ruim" });
  });

  it("actionErr aceita erros por campo", () => {
    const r = actionErr("validação falhou", { nome: ["obrigatório"] });
    expect(r).toEqual({
      ok: false,
      error: "validação falhou",
      fieldErrors: { nome: ["obrigatório"] },
    });
  });
});
