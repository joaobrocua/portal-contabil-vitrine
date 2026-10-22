import { describe, expect, it } from "vitest";

import { assinaturaCombinaComMime, mimePelaExtensao } from "./assinaturas";

const bytes = (nums: number[]): Uint8Array => new Uint8Array(nums);
const texto = (s: string): Uint8Array => new TextEncoder().encode(s);

describe("assinaturaCombinaComMime — formatos binários", () => {
  it("aceita PDF real", () => {
    expect(
      assinaturaCombinaComMime(
        "application/pdf",
        bytes([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]), // %PDF-1.4
      ),
    ).toBe(true);
  });

  it("rejeita PDF sem a assinatura real", () => {
    expect(
      assinaturaCombinaComMime("application/pdf", texto("nao é um pdf")),
    ).toBe(false);
  });

  it("aceita JPEG real", () => {
    expect(
      assinaturaCombinaComMime(
        "image/jpeg",
        bytes([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
      ),
    ).toBe(true);
  });

  it("aceita PNG real", () => {
    expect(
      assinaturaCombinaComMime(
        "image/png",
        bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]),
      ),
    ).toBe(true);
  });

  it("aceita WEBP real (RIFF....WEBP)", () => {
    const b = new Uint8Array(16);
    b.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
    b.set([0x00, 0x00, 0x00, 0x00], 4); // tamanho (irrelevante pro teste)
    b.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
    expect(assinaturaCombinaComMime("image/webp", b)).toBe(true);
  });

  it("rejeita RIFF sem WEBP no offset certo (outro formato baseado em RIFF, ex. WAV)", () => {
    const b = new Uint8Array(16);
    b.set([0x52, 0x49, 0x46, 0x46], 0);
    b.set([0x57, 0x41, 0x56, 0x45], 8); // WAVE, não WEBP
    expect(assinaturaCombinaComMime("image/webp", b)).toBe(false);
  });

  it("aceita XLSX/DOCX reais (assinatura ZIP)", () => {
    const zip = bytes([0x50, 0x4b, 0x03, 0x04]);
    expect(
      assinaturaCombinaComMime(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        zip,
      ),
    ).toBe(true);
    expect(
      assinaturaCombinaComMime(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        zip,
      ),
    ).toBe(true);
  });

  it("aceita XLS/DOC antigos reais (assinatura OLE)", () => {
    const ole = bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(assinaturaCombinaComMime("application/vnd.ms-excel", ole)).toBe(
      true,
    );
    expect(assinaturaCombinaComMime("application/msword", ole)).toBe(true);
  });

  it("rejeita mistura de tipos binários (PNG declarado, JPEG de verdade)", () => {
    expect(
      assinaturaCombinaComMime("image/png", bytes([0xff, 0xd8, 0xff])),
    ).toBe(false);
  });
});

describe("assinaturaCombinaComMime — formatos texto (csv/xml)", () => {
  it("aceita CSV comum", () => {
    expect(
      assinaturaCombinaComMime("text/csv", texto("nome,valor\nx,10\n")),
    ).toBe(true);
  });

  it("aceita XML comum", () => {
    expect(
      assinaturaCombinaComMime(
        "application/xml",
        texto('<?xml version="1.0"?><nota><valor>10</valor></nota>'),
      ),
    ).toBe(true);
  });

  it("rejeita HTML/script disfarçado de CSV (o cenário do achado da auditoria)", () => {
    expect(
      assinaturaCombinaComMime(
        "text/csv",
        texto("<html><body><script>alert(1)</script></body></html>"),
      ),
    ).toBe(false);
  });

  it("rejeita HTML disfarçado de XML", () => {
    expect(
      assinaturaCombinaComMime(
        "text/xml",
        texto("<!DOCTYPE html><html><body>oi</body></html>"),
      ),
    ).toBe(false);
  });

  it("rejeita executável Windows disfarçado de CSV", () => {
    expect(
      assinaturaCombinaComMime(
        "text/csv",
        bytes([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]), // MZ
      ),
    ).toBe(false);
  });

  it("rejeita binário com byte nulo disfarçado de CSV", () => {
    expect(
      assinaturaCombinaComMime("text/csv", bytes([0x41, 0x00, 0x42, 0x00])),
    ).toBe(false);
  });

  it("tolera espaço/BOM antes da tag em HTML disfarçado (não escapa pela borda)", () => {
    expect(
      assinaturaCombinaComMime(
        "text/csv",
        texto("﻿   <html><script>x</script></html>"),
      ),
    ).toBe(false);
  });
});

describe("assinaturaCombinaComMime — tipo não mapeado", () => {
  it("deixa passar (allow-list de MIME já filtrou antes disso)", () => {
    expect(assinaturaCombinaComMime("application/octet-stream", texto("x"))).toBe(
      true,
    );
  });
});

describe("mimePelaExtensao", () => {
  it("deriva o mime pela extensão do caminho, ignorando maiúsculas", () => {
    expect(mimePelaExtensao("empresa-1/guia.PDF")).toBe("application/pdf");
    expect(mimePelaExtensao("empresa-1/nota.xml")).toBe("application/xml");
    expect(mimePelaExtensao("empresa-1/planilha.csv")).toBe("text/csv");
  });

  it("trata .jpg e .jpeg igual", () => {
    expect(mimePelaExtensao("a.jpg")).toBe("image/jpeg");
    expect(mimePelaExtensao("a.jpeg")).toBe("image/jpeg");
  });

  it("retorna null pra extensão fora da allow-list ou sem extensão", () => {
    expect(mimePelaExtensao("empresa-1/arquivo.exe")).toBeNull();
    expect(mimePelaExtensao("empresa-1/semextensao")).toBeNull();
  });
});
