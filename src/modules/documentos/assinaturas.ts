/**
 * Confirma que os bytes do arquivo batem com o tipo declarado, em vez de
 * confiar só no Content-Type que o navegador mandou (o cliente escolhe
 * esse valor livremente — nada garante que corresponda ao conteúdo real).
 * Formatos binários têm assinatura fixa nos primeiros bytes — conferimos
 * exatamente. CSV/XML são texto puro, sem assinatura própria; pra esses,
 * só bloqueamos o cenário perigoso de verdade (executável/HTML/script
 * disfarçado de um desses tipos).
 */

function temPrefixoEm(
  bytes: Uint8Array,
  offset: number,
  assinatura: number[],
): boolean {
  if (bytes.length < offset + assinatura.length) return false;
  return assinatura.every((byte, i) => bytes[offset + i] === byte);
}

function temPrefixo(bytes: Uint8Array, assinatura: number[]): boolean {
  return temPrefixoEm(bytes, 0, assinatura);
}

function ehOle(bytes: Uint8Array): boolean {
  // .doc/.xls antigos (OLE Compound File) — mesma assinatura pros dois.
  return temPrefixo(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
}

function ehZip(bytes: Uint8Array): boolean {
  // .docx/.xlsx (Office Open XML) são um .zip por baixo.
  // PK\x03\x04 (normal), PK\x05\x06 (vazio), PK\x07\x08 (fragmentado).
  return (
    temPrefixo(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    temPrefixo(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    temPrefixo(bytes, [0x50, 0x4b, 0x07, 0x08])
  );
}

const ASSINATURAS_BINARIAS: Record<string, (bytes: Uint8Array) => boolean> = {
  "application/pdf": (b) => temPrefixo(b, [0x25, 0x50, 0x44, 0x46]), // %PDF
  "image/jpeg": (b) => temPrefixo(b, [0xff, 0xd8, 0xff]),
  "image/png": (b) =>
    temPrefixo(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/webp": (b) =>
    temPrefixo(b, [0x52, 0x49, 0x46, 0x46]) &&
    temPrefixoEm(b, 8, [0x57, 0x45, 0x42, 0x50]),
  "application/vnd.ms-excel": ehOle,
  "application/msword": ehOle,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ehZip,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ehZip,
};

const TIPOS_TEXTO = new Set(["text/csv", "application/xml", "text/xml"]);

/** Sinais de conteúdo perigoso (executável/HTML/script) disfarçado de texto. */
function pareceConteudoPerigoso(bytes: Uint8Array): boolean {
  const inicio = bytes.subarray(0, Math.min(bytes.length, 512));

  // Byte nulo logo no início = quase certeza de binário, não texto puro.
  if (inicio.includes(0)) return true;

  // Executáveis
  if (temPrefixo(bytes, [0x4d, 0x5a])) return true; // MZ (Windows EXE/DLL)
  if (temPrefixo(bytes, [0x7f, 0x45, 0x4c, 0x46])) return true; // \x7fELF

  const texto = new TextDecoder("utf-8", { fatal: false })
    .decode(inicio)
    .replace(/^﻿/, "")
    .trimStart()
    .slice(0, 100)
    .toLowerCase();
  if (
    texto.startsWith("<!doctype html") ||
    texto.startsWith("<html") ||
    texto.startsWith("<script")
  ) {
    return true;
  }

  return false;
}

/**
 * true = os bytes são compatíveis com o MIME declarado (ou o tipo não é
 * verificável — allow-list de MIME/extensão continua valendo antes disso).
 */
export function assinaturaCombinaComMime(
  mimeDeclarado: string,
  bytes: Uint8Array,
): boolean {
  const checarBinario = ASSINATURAS_BINARIAS[mimeDeclarado];
  if (checarBinario) return checarBinario(bytes);
  if (TIPOS_TEXTO.has(mimeDeclarado)) return !pareceConteudoPerigoso(bytes);
  return true;
}

/**
 * MIME esperado pela extensão do arquivo — usado quando o navegador não
 * informou Content-Type (acontece de verdade: alguns sistemas não
 * associam .csv/.xml a um tipo, e o campo chega vazio por um motivo
 * legítimo). Nunca é motivo pra pular a checagem de assinatura — só muda
 * de onde vem o "tipo declarado" a verificar contra os bytes de verdade.
 */
const MIME_POR_EXTENSAO: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xml: "application/xml",
};

export function mimePelaExtensao(caminhoOuNome: string): string | null {
  const ext = caminhoOuNome.split(".").pop()?.toLowerCase();
  return ext ? (MIME_POR_EXTENSAO[ext] ?? null) : null;
}
