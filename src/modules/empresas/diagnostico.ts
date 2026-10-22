import "server-only";

import { isModuleEnabled } from "@/core/config/modules";
import { fetchTodos } from "@/core/db/pagination";
import { createSupabaseServerClient } from "@/core/db/server";
import type {
  ContatoRow,
  DocumentoRow,
  EmpresaRow,
  ObrigacaoRow,
  SocioRow,
  TarefaRow,
} from "@/core/db/types";
import { competenciaAtual, hojeISO } from "@/core/lib/format";

export type Severidade = "alta" | "media" | "baixa";

export interface Pendencia {
  chave: string;
  severidade: Severidade;
  titulo: string;
  detalhe?: string;
  href: string;
  cta: string;
}

export interface DiagnosticoEmpresa {
  empresa: Pick<
    EmpresaRow,
    | "id"
    | "razao_social"
    | "nome_fantasia"
    | "cnpj"
    | "regime_tributario"
    | "situacao"
    | "ativo"
  >;
  pendencias: Pendencia[];
}

const hoje = hojeISO;

/** Linhas já buscadas do banco — o suficiente pra calcular as pendências. */
export interface DadosDiagnostico {
  empresas: Pick<
    EmpresaRow,
    | "id"
    | "razao_social"
    | "nome_fantasia"
    | "cnpj"
    | "regime_tributario"
    | "situacao"
    | "ativo"
    | "cnae_principal"
    | "municipio"
    | "uf"
    | "data_abertura"
    | "responsavel_id"
    | "email"
    | "telefone"
  >[];
  socios: Pick<SocioRow, "empresa_id">[];
  contatos: Pick<ContatoRow, "empresa_id" | "recebe_comunicacoes">[];
  documentos: Pick<DocumentoRow, "empresa_id" | "status" | "competencia">[];
  tarefas: Pick<TarefaRow, "empresa_id" | "prazo" | "status">[];
  /** Já filtradas: status não concluído e vencimento no passado. */
  obrigacoesAtrasadas: Pick<ObrigacaoRow, "empresa_id">[];
}

/**
 * Calcula as pendências de cada empresa a partir de dados já carregados —
 * função pura, sem I/O, pra poder ser testada sem mockar o Supabase.
 * `hoje`/`competencia` são parâmetros (não `new Date()` direto) pra o
 * resultado ser determinístico em teste.
 */
export function calcularPendencias(
  dados: DadosDiagnostico,
  hoje: string,
  competencia: string,
): DiagnosticoEmpresa[] {
  const { empresas, socios, contatos, documentos, tarefas, obrigacoesAtrasadas } =
    dados;

  const contar = <T extends { empresa_id: string | null }>(
    rows: T[] | null | undefined,
    pred: (r: T) => boolean = () => true,
  ) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!r.empresa_id || !pred(r)) continue;
      m.set(r.empresa_id, (m.get(r.empresa_id) ?? 0) + 1);
    }
    return m;
  };

  const nSocios = contar(socios);
  const nContatos = contar(contatos);
  const nContatosComunica = contar(
    contatos,
    (c) => c.recebe_comunicacoes === true,
  );
  const nDocsPendentes = contar(documentos, (x) =>
    ["pendente", "correcao"].includes(x.status as string),
  );
  const nDocsCompetencia = contar(
    documentos,
    (x) => x.competencia === competencia,
  );
  const nAtrasadas = contar(
    tarefas,
    (t) =>
      !!t.prazo &&
      (t.prazo as string) < hoje &&
      !["concluida", "cancelada"].includes(t.status as string),
  );
  const nAguardando = contar(
    tarefas,
    (t) => t.status === "aguardando_cliente",
  );
  const nObrigAtrasadas = contar(obrigacoesAtrasadas);

  return empresas.map((e) => {
    const p: Pendencia[] = [];
    const isMei = e.regime_tributario === "mei";
    const emAbertura = e.situacao === "em_abertura";

    if (!e.cnae_principal)
      p.push({
        chave: "cnae",
        severidade: "media",
        titulo: "CNAE principal não informado",
        href: `/empresas/${e.id}/editar`,
        cta: "Completar cadastro",
      });

    if (!e.municipio || !e.uf)
      p.push({
        chave: "endereco",
        severidade: "media",
        titulo: "Endereço incompleto",
        detalhe: "Falta município e/ou UF.",
        href: `/empresas/${e.id}/editar`,
        cta: "Editar",
      });

    if (!e.data_abertura && !emAbertura)
      p.push({
        chave: "data_abertura",
        severidade: "baixa",
        titulo: "Data de abertura não informada",
        href: `/empresas/${e.id}/editar`,
        cta: "Editar",
      });

    if (!e.email && !e.telefone)
      p.push({
        chave: "contato_empresa",
        severidade: "baixa",
        titulo: "Sem e-mail nem telefone da empresa",
        href: `/empresas/${e.id}/editar`,
        cta: "Editar",
      });

    if (!e.responsavel_id)
      p.push({
        chave: "responsavel",
        severidade: "alta",
        titulo: "Sem responsável pelo atendimento",
        href: `/empresas/${e.id}/editar`,
        cta: "Definir responsável",
      });

    if (!isMei && (nSocios.get(e.id) ?? 0) === 0)
      p.push({
        chave: "socios",
        severidade: "media",
        titulo: "Nenhum sócio cadastrado",
        href: `/empresas/${e.id}?aba=socios`,
        cta: "Adicionar sócios",
      });

    if ((nContatos.get(e.id) ?? 0) === 0)
      p.push({
        chave: "contatos",
        severidade: "alta",
        titulo: "Nenhum contato cadastrado",
        detalhe: "Sem contato não há como enviar solicitações ao cliente.",
        href: `/empresas/${e.id}?aba=contatos`,
        cta: "Adicionar contato",
      });
    else if ((nContatosComunica.get(e.id) ?? 0) === 0)
      p.push({
        chave: "contatos_comunica",
        severidade: "media",
        titulo: "Nenhum contato recebe comunicações",
        href: `/empresas/${e.id}?aba=contatos`,
        cta: "Ajustar contatos",
      });

    const obrigAtr = nObrigAtrasadas.get(e.id) ?? 0;
    if (obrigAtr > 0)
      p.push({
        chave: "obrigacoes_atrasadas",
        severidade: "alta",
        titulo: `${obrigAtr} ${obrigAtr === 1 ? "obrigação fiscal atrasada" : "obrigações fiscais atrasadas"}`,
        href: `/fiscal?empresa=${e.id}`,
        cta: "Abrir Fiscal",
      });

    const atrasadas = nAtrasadas.get(e.id) ?? 0;
    if (atrasadas > 0)
      p.push({
        chave: "tarefas_atrasadas",
        severidade: "alta",
        titulo: `${atrasadas} ${atrasadas === 1 ? "tarefa atrasada" : "tarefas atrasadas"}`,
        href: `/tarefas?empresa=${e.id}`,
        cta: "Ver tarefas",
      });

    const aguardando = nAguardando.get(e.id) ?? 0;
    if (aguardando > 0)
      p.push({
        chave: "tarefas_aguardando",
        severidade: "media",
        titulo: `${aguardando} ${aguardando === 1 ? "tarefa aguardando" : "tarefas aguardando"} o cliente`,
        href: `/tarefas?empresa=${e.id}`,
        cta: "Ver tarefas",
      });

    const docsPend = nDocsPendentes.get(e.id) ?? 0;
    if (docsPend > 0)
      p.push({
        chave: "docs_pendentes",
        severidade: "media",
        titulo: `${docsPend} ${docsPend === 1 ? "documento" : "documentos"} aguardando revisão`,
        href: `/documentos?empresa=${e.id}`,
        cta: "Revisar documentos",
      });

    if (!emAbertura && (nDocsCompetencia.get(e.id) ?? 0) === 0)
      p.push({
        chave: "sem_docs_competencia",
        severidade: "baixa",
        titulo: "Nenhum documento na competência atual",
        detalhe: "Cliente ainda não enviou nada este mês.",
        href: `/documentos?empresa=${e.id}`,
        cta: "Solicitar / enviar",
      });

    const ordem: Record<Severidade, number> = { alta: 0, media: 1, baixa: 2 };
    p.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);

    return {
      empresa: {
        id: e.id,
        razao_social: e.razao_social,
        nome_fantasia: e.nome_fantasia,
        cnpj: e.cnpj,
        regime_tributario: e.regime_tributario,
        situacao: e.situacao,
        ativo: e.ativo,
      },
      pendencias: p,
    };
  });
}

/**
 * Verifica todas as empresas e devolve, para cada uma, a lista de pendências.
 * 6 consultas no total (sem N+1). Só busca os dados e delega o cálculo pra
 * `calcularPendencias` (função pura, testada separadamente).
 *
 * `documentos` e `tarefas` já vêm filtrados pro subconjunto que
 * `calcularPendencias` realmente usa (documento pendente/em correção ou da
 * competência atual; tarefa ainda aberta) — histórico antigo não importa pra
 * esse painel, e isso também mantém a resposta pequena. As 6 buscas usam
 * `fetchTodos` (pagina sozinha além de 1000 linhas — ver `@/core/db/pagination`)
 * porque, mesmo filtradas, `empresas`/`socios`/`contatos` crescem com o
 * tamanho do escritório, sem um filtro natural pra limitar.
 */
export async function diagnosticarEmpresas(): Promise<DiagnosticoEmpresa[]> {
  const supabase = await createSupabaseServerClient();

  const fiscalOn = isModuleEnabled("fiscal");
  const d = hoje();
  const comp = competenciaAtual();

  const [empresas, socios, contatos, documentos, tarefas, obrigacoes] =
    await Promise.all([
      fetchTodos((from, to) =>
        supabase
          .from("empresas")
          .select(
            "id, razao_social, nome_fantasia, cnpj, regime_tributario, situacao, ativo, cnae_principal, municipio, uf, data_abertura, responsavel_id, email, telefone",
          )
          // Inativa = ex-cliente: não faz sentido cobrar "sem responsável",
          // "sem documentos no mês" etc. de quem o escritório não atende mais.
          .eq("ativo", true)
          .order("razao_social")
          .range(from, to),
      ),
      fetchTodos((from, to) =>
        supabase.from("socios").select("empresa_id").range(from, to),
      ),
      fetchTodos((from, to) =>
        supabase
          .from("contatos")
          .select("empresa_id, recebe_comunicacoes")
          .range(from, to),
      ),
      fetchTodos((from, to) =>
        supabase
          .from("documentos")
          .select("empresa_id, status, competencia")
          .or(`status.in.(pendente,correcao),competencia.eq.${comp}`)
          .range(from, to),
      ),
      fetchTodos((from, to) =>
        supabase
          .from("tarefas")
          .select("empresa_id, prazo, status")
          .not("empresa_id", "is", null)
          .not("status", "in", "(concluida,cancelada)")
          .range(from, to),
      ),
      fiscalOn
        ? fetchTodos((from, to) =>
            supabase
              .from("obrigacoes")
              .select("empresa_id, vencimento, status")
              .not("status", "in", "(entregue,paga,dispensada)")
              .lt("vencimento", d)
              .range(from, to),
          )
        : Promise.resolve([] as { empresa_id: string }[]),
    ]);

  return calcularPendencias(
    { empresas, socios, contatos, documentos, tarefas, obrigacoesAtrasadas: obrigacoes },
    d,
    comp,
  );
}
