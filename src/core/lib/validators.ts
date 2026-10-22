/** Validação de CPF/CNPJ (dígitos verificadores) e helpers zod. */
import { z } from "zod";

const digits = (v: string) => v.replace(/\D/g, "");

export function isValidCPF(value: string): boolean {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export function isValidCNPJ(value: string): boolean {
  const cnpj = digits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (len: number) => {
    const nums = cnpj.slice(0, len);
    let pos = len - 7;
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += Number(nums[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

/** Campo zod para CNPJ: normaliza para 14 dígitos e valida DV. */
export const zCNPJ = z
  .string()
  .transform((v) => digits(v))
  .refine((v) => v.length === 14, "CNPJ deve ter 14 dígitos")
  .refine(isValidCNPJ, "CNPJ inválido");

/** Campo zod para CPF: normaliza para 11 dígitos e valida DV. */
export const zCPF = z
  .string()
  .transform((v) => digits(v))
  .refine((v) => v.length === 11, "CPF deve ter 11 dígitos")
  .refine(isValidCPF, "CPF inválido");

/**
 * Valor monetário digitado → número. Aceita o formato brasileiro
 * ("1.234,56", "1234,56") e também ponto como decimal quando não há
 * vírgula e o ponto tem 1–2 casas depois ("1500.50") — senão o ponto seria
 * tratado como milhar e "1500.50" viraria 150050.
 */
export function parseValor(value: string | null | undefined): number | null {
  const v = (value ?? "").replace(/R\$/i, "").replace(/\s/g, "");
  if (!v) return null;
  let normalizado: string;
  if (v.includes(",")) {
    normalizado = v.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d+\.\d{1,2}$/.test(v)) {
    normalizado = v;
  } else {
    normalizado = v.replace(/\./g, "");
  }
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/** Competência no formato 'YYYY-MM-01'. */
export const zCompetencia = z
  .string()
  .regex(/^\d{4}-\d{2}-01$/, "Competência inválida (use o 1º dia do mês)");
