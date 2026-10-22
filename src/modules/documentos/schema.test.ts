import { describe, expect, it } from "vitest";

import { departamentosParaEnvio, registrarDocumentoSchema, revisarDocumentoSchema } from "./schema";

const EMPRESA_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("registrarDocumentoSchema", () => {
  const base = {
    empresa_id: EMPRESA_ID,
    departamento: "fiscal" as const,
    titulo: "Guia DAS setembro",
    storage_path: `${EMPRESA_ID}/guia-das.pdf`,
  };

  it("aceita o mínimo válido", () => {
    const r = registrarDocumentoSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.categoria).toBe("outro");
  });

  it("aceita um MIME permitido", () => {
    expect(
      registrarDocumentoSchema.safeParse({ ...base, mime: "application/pdf" })
        .success,
    ).toBe(true);
  });

  it("rejeita um MIME fora da allow-list", () => {
    expect(
      registrarDocumentoSchema.safeParse({
        ...base,
        mime: "application/x-msdownload",
      }).success,
    ).toBe(false);
  });

  it("rejeita arquivo acima de 25 MB", () => {
    expect(
      registrarDocumentoSchema.safeParse({
        ...base,
        tamanho_bytes: 26 * 1024 * 1024,
      }).success,
    ).toBe(false);
  });

  it("aceita arquivo dentro do limite de 25 MB", () => {
    expect(
      registrarDocumentoSchema.safeParse({
        ...base,
        tamanho_bytes: 10 * 1024 * 1024,
      }).success,
    ).toBe(true);
  });

  it("normaliza competência YYYY-MM para YYYY-MM-01", () => {
    const r = registrarDocumentoSchema.safeParse({
      ...base,
      competencia: "2026-09",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.competencia).toBe("2026-09-01");
  });

  it("rejeita título vazio", () => {
    expect(
      registrarDocumentoSchema.safeParse({ ...base, titulo: "" }).success,
    ).toBe(false);
  });

  it("rejeita storage_path de uma empresa diferente da declarada", () => {
    const OUTRA_EMPRESA = "660e8400-e29b-41d4-a716-446655440001";
    const r = registrarDocumentoSchema.safeParse({
      ...base,
      storage_path: `${OUTRA_EMPRESA}/relatorio.pdf`,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.storage_path?.[0]).toMatch(
        /não corresponde/,
      );
    }
  });

  it.each(["../x.pdf", "a/../b.pdf", "a//b.pdf", "a/./b.pdf", "a\\b.pdf"])(
    "rejeita caminho com segmento perigoso: %s",
    (resto) => {
      const r = registrarDocumentoSchema.safeParse({ ...base, storage_path: `${base.empresa_id}/${resto}` });
      expect(r.success).toBe(false);
    },
  );

  it("rejeita storage_path sem o prefixo de empresa nenhum", () => {
    expect(
      registrarDocumentoSchema.safeParse({
        ...base,
        storage_path: "arquivo-solto.pdf",
      }).success,
    ).toBe(false);
  });
});

describe("revisarDocumentoSchema", () => {
  it("aceita um status válido", () => {
    expect(
      revisarDocumentoSchema.safeParse({
        id: EMPRESA_ID,
        status: "aprovado",
      }).success,
    ).toBe(true);
  });

  it("rejeita status fora do enum", () => {
    expect(
      revisarDocumentoSchema.safeParse({ id: EMPRESA_ID, status: "invalido" })
        .success,
    ).toBe(false);
  });
});

describe("departamentosParaEnvio", () => {
  it("admin, Pessoal e cliente podem enviar para o Pessoal", () => {
    for (const p of ["admin", "pessoal", "cliente"]) expect(departamentosParaEnvio(p)).toContain("pessoal");
  });

  it("os demais papéis do escritório NÃO veem o Pessoal, mas mantêm os outros departamentos", () => {
    for (const p of ["fiscal", "contabil", "societario", "atendimento"]) {
      const d = departamentosParaEnvio(p);
      expect(d).not.toContain("pessoal");
      expect(d).toEqual(expect.arrayContaining(["fiscal", "contabil", "societario", "ir", "geral"]));
    }
  });
});
