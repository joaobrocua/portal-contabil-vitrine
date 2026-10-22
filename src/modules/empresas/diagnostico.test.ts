import { describe, expect, it } from "vitest";

import { calcularPendencias, type DadosDiagnostico } from "./diagnostico";

const HOJE = "2026-09-12";
const COMPETENCIA = "2026-09-01";

const EMPRESA_COMPLETA = {
  id: "e1",
  razao_social: "ABC Comércio LTDA",
  nome_fantasia: "ABC",
  cnpj: "11222333000181",
  regime_tributario: "simples_nacional" as const,
  situacao: "ativa" as const,
  ativo: true,
  cnae_principal: "4692-3/00",
  municipio: "Cidade Exemplo",
  uf: "SP",
  data_abertura: "2015-03-11",
  responsavel_id: "user-1",
  email: "financeiro@abc.com.br",
  telefone: "1133311200",
};

const dadosVazios = (
  empresas: DadosDiagnostico["empresas"] = [EMPRESA_COMPLETA],
): DadosDiagnostico => ({
  empresas,
  socios: [],
  contatos: [],
  documentos: [],
  tarefas: [],
  obrigacoesAtrasadas: [],
});

/** Empresa completa + 1 sócio + 1 contato que recebe comunicações + doc na
 * competência atual não deve gerar nenhuma pendência. */
function dadosSemPendencia(): DadosDiagnostico {
  return {
    empresas: [EMPRESA_COMPLETA],
    socios: [{ empresa_id: "e1" }],
    contatos: [{ empresa_id: "e1", recebe_comunicacoes: true }],
    documentos: [
      { empresa_id: "e1", status: "aprovado", competencia: COMPETENCIA },
    ],
    tarefas: [],
    obrigacoesAtrasadas: [],
  };
}

describe("calcularPendencias — empresa em dia", () => {
  it("não gera nenhuma pendência quando tudo está preenchido", () => {
    const r = calcularPendencias(dadosSemPendencia(), HOJE, COMPETENCIA);
    expect(r).toHaveLength(1);
    expect(r[0].pendencias).toEqual([]);
  });

  it("devolve os dados básicos da empresa junto", () => {
    const r = calcularPendencias(dadosSemPendencia(), HOJE, COMPETENCIA);
    expect(r[0].empresa).toEqual({
      id: "e1",
      razao_social: "ABC Comércio LTDA",
      nome_fantasia: "ABC",
      cnpj: "11222333000181",
      regime_tributario: "simples_nacional",
      situacao: "ativa",
      ativo: true,
    });
  });
});

describe("calcularPendencias — cadastro incompleto", () => {
  it("aponta CNAE, endereço, data de abertura, contato e responsável faltando", () => {
    const empresaVazia = {
      ...EMPRESA_COMPLETA,
      cnae_principal: null,
      municipio: null,
      uf: null,
      data_abertura: null,
      email: null,
      telefone: null,
      responsavel_id: null,
    };
    const r = calcularPendencias(
      dadosVazios([empresaVazia]),
      HOJE,
      COMPETENCIA,
    );
    const chaves = r[0].pendencias.map((p) => p.chave);
    expect(chaves).toEqual(
      expect.arrayContaining([
        "cnae",
        "endereco",
        "data_abertura",
        "contato_empresa",
        "responsavel",
        "contatos",
      ]),
    );
  });

  it("não cobra data de abertura de empresa em fase de abertura", () => {
    const empresaEmAbertura = {
      ...EMPRESA_COMPLETA,
      situacao: "em_abertura" as const,
      data_abertura: null,
    };
    const r = calcularPendencias(
      { ...dadosSemPendencia(), empresas: [empresaEmAbertura] },
      HOJE,
      COMPETENCIA,
    );
    expect(r[0].pendencias.map((p) => p.chave)).not.toContain(
      "data_abertura",
    );
  });

  it("não cobra sócio de empresa MEI mesmo sem nenhum sócio cadastrado", () => {
    const mei = { ...EMPRESA_COMPLETA, regime_tributario: "mei" as const };
    const r = calcularPendencias(
      { ...dadosSemPendencia(), empresas: [mei], socios: [] },
      HOJE,
      COMPETENCIA,
    );
    expect(r[0].pendencias.map((p) => p.chave)).not.toContain("socios");
  });

  it("cobra sócio de empresa não-MEI sem nenhum sócio cadastrado", () => {
    const r = calcularPendencias(
      { ...dadosSemPendencia(), socios: [] },
      HOJE,
      COMPETENCIA,
    );
    expect(r[0].pendencias.map((p) => p.chave)).toContain("socios");
  });
});

describe("calcularPendencias — contatos", () => {
  it("sem nenhum contato: pendência 'contatos' (severidade alta)", () => {
    const dados = { ...dadosSemPendencia(), contatos: [] };
    const p = calcularPendencias(dados, HOJE, COMPETENCIA)[0].pendencias.find(
      (x) => x.chave === "contatos",
    );
    expect(p?.severidade).toBe("alta");
  });

  it("tem contato mas nenhum recebe comunicações: pendência dedicada", () => {
    const dados: DadosDiagnostico = {
      ...dadosSemPendencia(),
      contatos: [{ empresa_id: "e1", recebe_comunicacoes: false }],
    };
    const chaves = calcularPendencias(dados, HOJE, COMPETENCIA)[0].pendencias.map(
      (p) => p.chave,
    );
    expect(chaves).toContain("contatos_comunica");
    expect(chaves).not.toContain("contatos");
  });

  it("não soma as duas pendências de contato ao mesmo tempo", () => {
    const semContato = calcularPendencias(
      { ...dadosSemPendencia(), contatos: [] },
      HOJE,
      COMPETENCIA,
    )[0].pendencias.map((p) => p.chave);
    expect(semContato).toContain("contatos");
    expect(semContato).not.toContain("contatos_comunica");
  });
});

describe("calcularPendencias — tarefas", () => {
  it("conta tarefas atrasadas (prazo no passado, não concluída/cancelada)", () => {
    const dados: DadosDiagnostico = {
      ...dadosSemPendencia(),
      tarefas: [
        { empresa_id: "e1", prazo: "2026-09-01", status: "em_andamento" },
        { empresa_id: "e1", prazo: "2026-09-05", status: "concluida" }, // não conta
        { empresa_id: "e1", prazo: "2026-12-01", status: "em_andamento" }, // futura, não conta
      ],
    };
    const p = calcularPendencias(dados, HOJE, COMPETENCIA)[0].pendencias.find(
      (x) => x.chave === "tarefas_atrasadas",
    );
    expect(p?.titulo).toBe("1 tarefa atrasada");
  });

  it("usa plural quando há mais de uma tarefa atrasada", () => {
    const dados: DadosDiagnostico = {
      ...dadosSemPendencia(),
      tarefas: [
        { empresa_id: "e1", prazo: "2026-09-01", status: "nao_iniciada" },
        { empresa_id: "e1", prazo: "2026-09-02", status: "nao_iniciada" },
      ],
    };
    const p = calcularPendencias(dados, HOJE, COMPETENCIA)[0].pendencias.find(
      (x) => x.chave === "tarefas_atrasadas",
    );
    expect(p?.titulo).toBe("2 tarefas atrasadas");
  });

  it("conta tarefas aguardando cliente separadamente", () => {
    const dados: DadosDiagnostico = {
      ...dadosSemPendencia(),
      tarefas: [
        { empresa_id: "e1", prazo: null, status: "aguardando_cliente" },
      ],
    };
    const chaves = calcularPendencias(dados, HOJE, COMPETENCIA)[0].pendencias.map(
      (p) => p.chave,
    );
    expect(chaves).toContain("tarefas_aguardando");
  });
});

describe("calcularPendencias — obrigações fiscais", () => {
  it("reporta a contagem de obrigações já filtradas como atrasadas", () => {
    const dados: DadosDiagnostico = {
      ...dadosSemPendencia(),
      obrigacoesAtrasadas: [{ empresa_id: "e1" }, { empresa_id: "e1" }],
    };
    const p = calcularPendencias(dados, HOJE, COMPETENCIA)[0].pendencias.find(
      (x) => x.chave === "obrigacoes_atrasadas",
    );
    expect(p?.titulo).toBe("2 obrigações fiscais atrasadas");
    expect(p?.severidade).toBe("alta");
  });
});

describe("calcularPendencias — documentos", () => {
  it("conta documentos pendentes ou em correção", () => {
    const dados: DadosDiagnostico = {
      ...dadosSemPendencia(),
      documentos: [
        { empresa_id: "e1", status: "pendente", competencia: COMPETENCIA },
        { empresa_id: "e1", status: "correcao", competencia: COMPETENCIA },
        { empresa_id: "e1", status: "aprovado", competencia: COMPETENCIA },
      ],
    };
    const p = calcularPendencias(dados, HOJE, COMPETENCIA)[0].pendencias.find(
      (x) => x.chave === "docs_pendentes",
    );
    expect(p?.titulo).toBe("2 documentos aguardando revisão");
  });

  it("aponta falta de documento na competência atual", () => {
    const dados: DadosDiagnostico = {
      ...dadosSemPendencia(),
      documentos: [
        { empresa_id: "e1", status: "aprovado", competencia: "2026-08-01" },
      ],
    };
    const chaves = calcularPendencias(dados, HOJE, COMPETENCIA)[0].pendencias.map(
      (p) => p.chave,
    );
    expect(chaves).toContain("sem_docs_competencia");
  });

  it("não cobra documento da competência de empresa em abertura", () => {
    const emAbertura = {
      ...EMPRESA_COMPLETA,
      situacao: "em_abertura" as const,
    };
    const dados: DadosDiagnostico = {
      ...dadosSemPendencia(),
      empresas: [emAbertura],
      documentos: [],
    };
    const chaves = calcularPendencias(dados, HOJE, COMPETENCIA)[0].pendencias.map(
      (p) => p.chave,
    );
    expect(chaves).not.toContain("sem_docs_competencia");
  });
});

describe("calcularPendencias — ordenação", () => {
  it("ordena por severidade: alta, depois média, depois baixa", () => {
    const empresaVazia = {
      ...EMPRESA_COMPLETA,
      cnae_principal: null, // media
      data_abertura: null, // baixa
      responsavel_id: null, // alta
    };
    const r = calcularPendencias(
      dadosVazios([empresaVazia]),
      HOJE,
      COMPETENCIA,
    );
    const severidades = r[0].pendencias.map((p) => p.severidade);
    const ordem: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
    const ordenado = [...severidades].sort((a, b) => ordem[a] - ordem[b]);
    expect(severidades).toEqual(ordenado);
    expect(severidades[0]).toBe("alta");
  });
});

describe("calcularPendencias — múltiplas empresas", () => {
  it("calcula cada empresa de forma independente (sem vazar dados entre elas)", () => {
    const empresa2 = { ...EMPRESA_COMPLETA, id: "e2", responsavel_id: null };
    const dados: DadosDiagnostico = {
      empresas: [EMPRESA_COMPLETA, empresa2],
      socios: [{ empresa_id: "e1" }, { empresa_id: "e2" }],
      contatos: [
        { empresa_id: "e1", recebe_comunicacoes: true },
        { empresa_id: "e2", recebe_comunicacoes: true },
      ],
      documentos: [
        { empresa_id: "e1", status: "aprovado", competencia: COMPETENCIA },
        { empresa_id: "e2", status: "aprovado", competencia: COMPETENCIA },
      ],
      tarefas: [],
      obrigacoesAtrasadas: [],
    };
    const r = calcularPendencias(dados, HOJE, COMPETENCIA);
    expect(r.find((x) => x.empresa.id === "e1")?.pendencias).toEqual([]);
    expect(
      r.find((x) => x.empresa.id === "e2")?.pendencias.map((p) => p.chave),
    ).toEqual(["responsavel"]);
  });
});
