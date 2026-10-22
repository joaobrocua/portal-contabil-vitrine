import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mensagemErroBanco } from "./erros";

describe("mensagemErroBanco", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("nunca devolve o texto cru do erro (não vaza nome de tabela/constraint)", () => {
    const msg = mensagemErroBanco({
      message: 'update or delete on table "socios" violates foreign key constraint "declaracoes_ir_socio_id_fkey"',
      code: "23503",
    });
    expect(msg).not.toMatch(/socios|constraint|declaracoes_ir/i);
  });

  it("devolve sempre a mesma mensagem genérica e segura", () => {
    expect(mensagemErroBanco({ message: "qualquer coisa" })).toBe(
      "Não foi possível concluir a operação. Tente novamente em instantes.",
    );
  });

  it("loga o erro de verdade no servidor (pra debugar depois)", () => {
    mensagemErroBanco({ message: "detalhe interno", code: "23505" });
    expect(errorSpy).toHaveBeenCalledWith(
      "[erro de banco]",
      "23505",
      "detalhe interno",
    );
  });

  it("funciona sem code", () => {
    mensagemErroBanco({ message: "sem code" });
    expect(errorSpy).toHaveBeenCalledWith(
      "[erro de banco]",
      "(sem código)",
      "sem code",
    );
  });
});
