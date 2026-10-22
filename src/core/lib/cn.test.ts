import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn", () => {
  it("junta classes simples", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("ignora valores falsos (condicionais)", () => {
    expect(cn("px-2", false && "hidden", null, undefined, "")).toBe("px-2");
  });

  it("aceita objeto condicional", () => {
    expect(cn("btn", { "btn-ativo": true, "btn-off": false })).toBe(
      "btn btn-ativo",
    );
  });

  it("resolve conflito do Tailwind mantendo a última classe", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("não mistura utilitários de eixos diferentes", () => {
    expect(cn("px-2", "py-4")).toBe("px-2 py-4");
  });

  it("retorna string vazia sem argumentos", () => {
    expect(cn()).toBe("");
  });
});
