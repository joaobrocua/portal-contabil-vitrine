import { describe, expect, it } from "vitest";

import { contatoSchema, empresaSchema, socioSchema } from "./schema";

const BASE_EMPRESA = {
  razao_social: "ABC Comércio LTDA",
  cnpj: "11.222.333/0001-81",
  regime_tributario: "simples_nacional" as const,
};

describe("empresaSchema", () => {
  it("aceita o mínimo válido e normaliza o CNPJ", () => {
    const r = empresaSchema.safeParse(BASE_EMPRESA);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cnpj).toBe("11222333000181");
      expect(r.data.situacao).toBe("ativa");
      expect(r.data.departamentos_responsaveis).toEqual([]);
    }
  });

  it("rejeita razão social muito curta", () => {
    expect(
      empresaSchema.safeParse({ ...BASE_EMPRESA, razao_social: "A" }).success,
    ).toBe(false);
  });

  it("rejeita CNPJ inválido", () => {
    expect(
      empresaSchema.safeParse({ ...BASE_EMPRESA, cnpj: "11.222.333/0001-82" })
        .success,
    ).toBe(false);
  });

  it("rejeita e-mail com formato inválido", () => {
    expect(
      empresaSchema.safeParse({ ...BASE_EMPRESA, email: "nao-e-email" })
        .success,
    ).toBe(false);
  });

  it("trata e-mail vazio como nulo (campo opcional)", () => {
    const r = empresaSchema.safeParse({ ...BASE_EMPRESA, email: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBeNull();
  });

  it("faz parsing de honorário mensal no formato BRL", () => {
    const r = empresaSchema.safeParse({
      ...BASE_EMPRESA,
      honorario_mensal: "1.850,00",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.honorario_mensal).toBe(1850);
  });
});

describe("empresaSchema — honorário digitado", () => {
  const base = { razao_social: "ABC LTDA", cnpj: "11.222.333/0001-81", regime_tributario: "simples_nacional" };

  it("vazio vira null (campo vazio apaga o honorário, de propósito)", () => {
    const r = empresaSchema.safeParse({ ...base, honorario_mensal: "" });
    expect(r.success && r.data.honorario_mensal).toBe(null);
  });

  it("texto que não é número é ERRO de validação — não pode virar vazio e apagar o valor", () => {
    const r = empresaSchema.safeParse({ ...base, honorario_mensal: "mil e oitocentos" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.honorario_mensal?.[0]).toMatch(/valor em reais/i);
  });

  it("valor negativo é erro", () => {
    expect(empresaSchema.safeParse({ ...base, honorario_mensal: "-50,00" }).success).toBe(false);
  });
});

describe("socioSchema", () => {
  const base = {
    empresa_id: "550e8400-e29b-41d4-a716-446655440000",
    nome: "Carlos Henrique Almeida",
    cpf: "529.982.247-25",
  };

  it("aceita o mínimo válido e normaliza o CPF", () => {
    const r = socioSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cpf).toBe("52998224725");
      expect(r.data.administrador).toBe(false);
    }
  });

  it("rejeita CPF inválido", () => {
    expect(
      socioSchema.safeParse({ ...base, cpf: "111.111.111-11" }).success,
    ).toBe(false);
  });

  it("faz parsing de participação com vírgula decimal", () => {
    const r = socioSchema.safeParse({ ...base, participacao: "33,5" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.participacao).toBe(33.5);
  });
});

describe("contatoSchema", () => {
  const base = {
    empresa_id: "550e8400-e29b-41d4-a716-446655440000",
    nome: "Financeiro",
  };

  it("aceita sem CPF (opcional)", () => {
    const r = contatoSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cpf).toBeNull();
      expect(r.data.tipo).toBe("outro");
      expect(r.data.recebe_comunicacoes).toBe(true);
    }
  });

  it("rejeita CPF com tamanho errado quando informado", () => {
    expect(contatoSchema.safeParse({ ...base, cpf: "123" }).success).toBe(
      false,
    );
  });

  it("rejeita nome muito curto", () => {
    expect(contatoSchema.safeParse({ ...base, nome: "A" }).success).toBe(
      false,
    );
  });
});
