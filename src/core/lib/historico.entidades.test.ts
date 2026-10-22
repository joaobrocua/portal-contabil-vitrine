import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * O histórico é filtrado por departamento NO BANCO (função
 * historico_entidades_visiveis, migration 0031): um tipo de `entidade` que
 * o código grava mas a função não lista fica visível só ao admin, em
 * silêncio. Este teste compara as duas listas para isso não passar batido.
 */

const RAIZ = process.cwd();

function arquivos(dir: string, saida: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) arquivos(p, saida);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) saida.push(p);
  }
  return saida;
}

/** Tipos que o código grava com registrarHistorico({ entidade: "x" ... }). */
function entidadesGravadas(): Set<string> {
  const achadas = new Set<string>();
  for (const f of arquivos(path.join(RAIZ, "src"))) {
    const texto = fs.readFileSync(f, "utf8");
    for (const m of texto.matchAll(/registrarHistorico\(\{[^}]*?entidade:\s*"([a-z_]+)"/g)) achadas.add(m[1]);
  }
  return achadas;
}

/** Tipos listados na versão MAIS RECENTE da função SQL (qualquer papel). */
function entidadesDaFuncao(): Set<string> {
  const dir = path.join(RAIZ, "supabase", "migrations");
  const mais_recente = fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".sql"))
    .sort()
    .reverse()
    .find((n) => /create or replace function public\.historico_entidades_visiveis/i.test(fs.readFileSync(path.join(dir, n), "utf8")));
  if (!mais_recente) throw new Error("função historico_entidades_visiveis não encontrada nas migrations");
  const sql = fs.readFileSync(path.join(dir, mais_recente), "utf8");
  const corpo = sql.slice(sql.search(/create or replace function public\.historico_entidades_visiveis/i));
  const fim = corpo.indexOf("$$;", corpo.indexOf("$$") + 2);
  const tipos = new Set<string>();
  for (const m of corpo.slice(0, fim).matchAll(/array\[([^\]]*)\]/g)) {
    for (const t of m[1].matchAll(/'([a-z_]+)'/g)) tipos.add(t[1]);
  }
  return tipos;
}

/** Só o admin vê, de propósito (usuários, configuração, modelos de tarefa) ou via regra própria (documento). */
const SO_ADMIN_OU_REGRA_PROPRIA = new Set(["usuario", "config", "tarefa_modelo", "documento"]);

describe("histórico: tipos gravados pelo código x função historico_entidades_visiveis()", () => {
  it("todo tipo que o código grava é visível a algum departamento (ou é admin-only de propósito)", () => {
    const funcao = entidadesDaFuncao();
    const esquecidos = [...entidadesGravadas()].filter((e) => !funcao.has(e) && !SO_ADMIN_OU_REGRA_PROPRIA.has(e));
    expect(
      esquecidos,
      `Tipo(s) de histórico gravado(s) pelo código mas ausente(s) de historico_entidades_visiveis(): ${esquecidos.join(", ")}. ` +
        "Sem isso só o admin os enxerga. Acrescente-os na função (migration nova).",
    ).toEqual([]);
  });

  it("acha de fato os tipos esperados (o teste não está olhando para o vazio)", () => {
    const gravadas = entidadesGravadas();
    for (const e of ["empresa", "tarefa", "obrigacao", "funcionario", "documento"]) expect(gravadas.has(e)).toBe(true);
    const funcao = entidadesDaFuncao();
    for (const e of ["empresa", "tarefa", "obrigacao", "funcionario", "fechamento", "processo_societario"]) expect(funcao.has(e)).toBe(true);
  });
});
