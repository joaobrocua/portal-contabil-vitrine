import { describe, expect, it } from "vitest";

import {
  canAccessModule,
  isModuleEnabled,
  listModules,
  MODULES,
  menuFor,
} from "./modules";

describe("isModuleEnabled", () => {
  it("é true para módulo ligado", () => {
    expect(isModuleEnabled("fiscal")).toBe(true);
  });

  it("é false para módulo desligado", () => {
    expect(isModuleEnabled("comunicacao")).toBe(false);
    expect(isModuleEnabled("relatorios")).toBe(false);
  });
});

describe("canAccessModule", () => {
  it("nega qualquer módulo quando não há papel (não autenticado)", () => {
    expect(canAccessModule("dashboard", null)).toBe(false);
    expect(canAccessModule("fiscal", null)).toBe(false);
  });

  it("papeis vazio significa 'todo papel autenticado'", () => {
    expect(MODULES.dashboard.papeis).toEqual([]);
    expect(canAccessModule("dashboard", "cliente")).toBe(true);
    expect(canAccessModule("dashboard", "fiscal")).toBe(true);
    expect(canAccessModule("documentos", "cliente")).toBe(true);
  });

  it("restringe módulo de departamento ao papel correspondente", () => {
    expect(canAccessModule("fiscal", "fiscal")).toBe(true);
    expect(canAccessModule("fiscal", "admin")).toBe(true);
    expect(canAccessModule("fiscal", "pessoal")).toBe(false);
    expect(canAccessModule("pessoal", "fiscal")).toBe(false);
  });

  it("IR é acessível a admin, fiscal e contábil", () => {
    expect(canAccessModule("ir", "admin")).toBe(true);
    expect(canAccessModule("ir", "fiscal")).toBe(true);
    expect(canAccessModule("ir", "contabil")).toBe(true);
    expect(canAccessModule("ir", "societario")).toBe(false);
  });

  it("cliente não acessa módulos internos", () => {
    expect(canAccessModule("empresas", "cliente")).toBe(false);
    expect(canAccessModule("tarefas", "cliente")).toBe(false);
    expect(canAccessModule("usuarios", "cliente")).toBe(false);
  });

  it("gestão (usuários/administração) é só de admin", () => {
    expect(canAccessModule("usuarios", "admin")).toBe(true);
    expect(canAccessModule("administracao", "admin")).toBe(true);
    expect(canAccessModule("usuarios", "atendimento")).toBe(false);
    expect(canAccessModule("administracao", "contabil")).toBe(false);
  });

  it("nega módulo desligado mesmo para admin", () => {
    expect(canAccessModule("comunicacao", "admin")).toBe(false);
    expect(canAccessModule("relatorios", "admin")).toBe(false);
  });
});

describe("listModules", () => {
  it("retorna todos os módulos ordenados por 'ordem'", () => {
    const mods = listModules();
    expect(mods).toHaveLength(Object.keys(MODULES).length);
    const ordens = mods.map((m) => m.ordem);
    expect(ordens).toEqual([...ordens].sort((a, b) => a - b));
  });
});

describe("menuFor", () => {
  it("não devolve nada sem papel", () => {
    expect(menuFor(null)).toEqual([]);
  });

  it("admin enxerga os três grupos", () => {
    const grupos = menuFor("admin").map((s) => s.grupo);
    expect(grupos).toEqual(["principal", "departamentos", "gestao"]);
  });

  it("omite grupos que ficariam vazios", () => {
    // cliente só alcança módulos de papeis:[] — todos do grupo principal.
    const secoes = menuFor("cliente");
    expect(secoes.map((s) => s.grupo)).toEqual(["principal"]);
  });

  it("colaborador de departamento vê só o próprio departamento", () => {
    const secoes = menuFor("fiscal");
    const departamentos = secoes.find((s) => s.grupo === "departamentos");
    const ids = departamentos?.itens.map((m) => m.id) ?? [];
    expect(ids).toContain("fiscal");
    expect(ids).toContain("ir"); // fiscal também cuida de IR
    expect(ids).not.toContain("pessoal");
    expect(ids).not.toContain("contabil");
  });

  it("não expõe gestão para quem não é admin", () => {
    const secoes = menuFor("atendimento");
    expect(secoes.find((s) => s.grupo === "gestao")).toBeUndefined();
  });

  it("nunca inclui módulo desligado", () => {
    const ids = menuFor("admin").flatMap((s) => s.itens.map((m) => m.id));
    expect(ids).not.toContain("comunicacao");
    expect(ids).not.toContain("relatorios");
  });

  it("traz o rótulo do grupo junto", () => {
    const secoes = menuFor("admin");
    expect(secoes[0].label).toBe("Operação");
  });
});
