import { describe, expect, it } from "vitest";

import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("aceita caminho interno normal", () => {
    expect(safeNextPath("/tarefas")).toBe("/tarefas");
    expect(safeNextPath("/empresas/123?aba=fiscal")).toBe(
      "/empresas/123?aba=fiscal",
    );
  });

  it("usa /painel como padrão para vazio/nulo", () => {
    expect(safeNextPath(null)).toBe("/painel");
    expect(safeNextPath(undefined)).toBe("/painel");
    expect(safeNextPath("")).toBe("/painel");
  });

  it("rejeita URL absoluta com esquema", () => {
    expect(safeNextPath("https://site-falso.com")).toBe("/painel");
    expect(safeNextPath("http://site-falso.com/login")).toBe("/painel");
    expect(safeNextPath("javascript:alert(1)")).toBe("/painel");
  });

  it("rejeita URL protocol-relative (//host)", () => {
    expect(safeNextPath("//site-falso.com")).toBe("/painel");
    expect(safeNextPath("///site-falso.com")).toBe("/painel");
  });

  it("rejeita variante com barra invertida (navegador normaliza pra //)", () => {
    expect(safeNextPath("/\\site-falso.com")).toBe("/painel");
    expect(safeNextPath("\\/site-falso.com")).toBe("/painel");
  });

  it("rejeita bypass com tab/CR/LF entre as barras", () => {
    expect(safeNextPath("/\t/site-falso.com")).toBe("/painel");
    expect(safeNextPath("/\n/site-falso.com")).toBe("/painel");
    expect(safeNextPath("/\r/site-falso.com")).toBe("/painel");
  });

  it("rejeita caminho que não começa com barra", () => {
    expect(safeNextPath("painel")).toBe("/painel");
    expect(safeNextPath("site-falso.com")).toBe("/painel");
  });
});
