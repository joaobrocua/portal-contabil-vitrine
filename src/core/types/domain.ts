/** Contratos de domínio compartilhados entre módulos. */

import { hojeISO } from "@/core/lib/format";

/* ------------------------------- Papéis -------------------------------- */
/**
 * Nível de acesso global do usuário (item 15 da especificação).
 * Colaboradores de departamento só enxergam empresas/abas do seu setor;
 * `atendimento` cuida de clientes, solicitações e documentos;
 * `cliente` só vê a própria empresa.
 */
export type Papel =
  | "admin"
  | "fiscal"
  | "pessoal"
  | "contabil"
  | "societario"
  | "atendimento"
  | "cliente";

export const PAPEL_LABEL: Record<Papel, string> = {
  admin: "Administrador",
  fiscal: "Fiscal",
  pessoal: "Departamento Pessoal",
  contabil: "Contábil",
  societario: "Societário",
  atendimento: "Atendimento",
  cliente: "Cliente",
};

export const PAPEIS_INTERNOS: Papel[] = [
  "admin",
  "fiscal",
  "pessoal",
  "contabil",
  "societario",
  "atendimento",
];

export const isCliente = (p: Papel) => p === "cliente";
export const isStaff = (p: Papel) => p !== "cliente";
export const isAdmin = (p: Papel) => p === "admin";

/* ----------------------------- Departamentos -------------------------- */

export type Departamento =
  | "fiscal"
  | "pessoal"
  | "contabil"
  | "societario"
  | "ir"
  | "atendimento"
  | "geral";

export const DEPARTAMENTO_LABEL: Record<Departamento, string> = {
  fiscal: "Fiscal / Tributário",
  pessoal: "Departamento Pessoal",
  contabil: "Contábil",
  societario: "Societário / Legalização",
  ir: "Imposto de Renda",
  atendimento: "Atendimento",
  geral: "Geral",
};

/** Departamento "natural" de um papel (para filtros padrão). null = vê todos. */
export function departamentoDoPapel(papel: Papel): Departamento | null {
  switch (papel) {
    case "fiscal":
      return "fiscal";
    case "pessoal":
      return "pessoal";
    case "contabil":
      return "contabil";
    case "societario":
      return "societario";
    case "atendimento":
      return "atendimento";
    default:
      return null; // admin e cliente
  }
}

/* --------------------------- Regime tributário ----------------------- */

export type RegimeTributario =
  | "simples_nacional"
  | "lucro_presumido"
  | "lucro_real"
  | "mei"
  | "imune_isenta";

export const REGIME_LABEL: Record<RegimeTributario, string> = {
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
  mei: "MEI",
  imune_isenta: "Imune / Isenta",
};

/* ---------------------------- Situação empresa ---------------------- */

export type SituacaoEmpresa =
  | "ativa"
  | "suspensa"
  | "baixada"
  | "em_abertura"
  | "distrato";

export const SITUACAO_EMPRESA_LABEL: Record<SituacaoEmpresa, string> = {
  ativa: "Ativa",
  suspensa: "Suspensa",
  baixada: "Baixada",
  em_abertura: "Em abertura",
  distrato: "Em distrato",
};

/* ------------------------------ Tarefas ---------------------------- */

export type TarefaStatus =
  | "nao_iniciada"
  | "em_andamento"
  | "aguardando_cliente"
  | "em_revisao"
  | "concluida"
  | "atrasada"
  | "cancelada";

export const TAREFA_STATUS_LABEL: Record<TarefaStatus, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  aguardando_cliente: "Aguardando cliente",
  em_revisao: "Em revisão",
  concluida: "Concluída",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

export type TarefaStatusTone =
  | "neutral"
  | "info"
  | "warning"
  | "brand"
  | "success"
  | "danger";

export const TAREFA_STATUS_TONE: Record<TarefaStatus, TarefaStatusTone> = {
  nao_iniciada: "neutral",
  em_andamento: "info",
  aguardando_cliente: "warning",
  em_revisao: "brand",
  concluida: "success",
  atrasada: "danger",
  cancelada: "neutral",
};

export type Prioridade = "baixa" | "normal" | "alta" | "urgente";

export const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

/* ------------------------------ Fiscal ---------------------------- */

export type ObrigacaoTipo =
  | "das"
  | "das_mei"
  | "fgts"
  | "inss_gps"
  | "darf_irpj"
  | "darf_csll"
  | "darf_pis"
  | "darf_cofins"
  | "darf_irrf"
  | "iss"
  | "icms"
  | "difal"
  | "dctfweb"
  | "efd_contribuicoes"
  | "efd_icms_ipi"
  | "efd_reinf"
  | "sped_ecd"
  | "sped_ecf"
  | "defis"
  | "dirf"
  | "rais"
  | "outro";

export const OBRIGACAO_TIPO_LABEL: Record<ObrigacaoTipo, string> = {
  das: "DAS - Simples Nacional",
  das_mei: "DAS - MEI (DAS-SIMEI)",
  fgts: "FGTS",
  inss_gps: "INSS / GPS",
  darf_irpj: "DARF IRPJ",
  darf_csll: "DARF CSLL",
  darf_pis: "DARF PIS",
  darf_cofins: "DARF COFINS",
  darf_irrf: "DARF IRRF",
  iss: "ISS",
  icms: "ICMS",
  difal: "ICMS DIFAL",
  dctfweb: "DCTFWeb",
  efd_contribuicoes: "EFD-Contribuições",
  efd_icms_ipi: "EFD ICMS/IPI (SPED Fiscal)",
  efd_reinf: "EFD-Reinf",
  sped_ecd: "SPED ECD",
  sped_ecf: "SPED ECF",
  defis: "DEFIS",
  dirf: "DIRF",
  rais: "RAIS",
  outro: "Outra obrigação",
};

/** Abreviação para a grade. */
export const OBRIGACAO_TIPO_CURTO: Record<ObrigacaoTipo, string> = {
  das: "DAS",
  das_mei: "DAS-MEI",
  fgts: "FGTS",
  inss_gps: "INSS",
  darf_irpj: "IRPJ",
  darf_csll: "CSLL",
  darf_pis: "PIS",
  darf_cofins: "COFINS",
  darf_irrf: "IRRF",
  iss: "ISS",
  icms: "ICMS",
  difal: "DIFAL",
  dctfweb: "DCTFWeb",
  efd_contribuicoes: "EFD-Contrib",
  efd_icms_ipi: "SPED Fiscal",
  efd_reinf: "EFD-Reinf",
  sped_ecd: "ECD",
  sped_ecf: "ECF",
  defis: "DEFIS",
  dirf: "DIRF",
  rais: "RAIS",
  outro: "Outra",
};

export type ObrigacaoStatus =
  | "pendente"
  | "em_andamento"
  | "gerada"
  | "disponivel"
  | "entregue"
  | "paga"
  | "dispensada";

export const OBRIGACAO_STATUS_LABEL: Record<ObrigacaoStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  gerada: "Guia gerada",
  disponivel: "Disponível ao cliente",
  entregue: "Entregue / transmitida",
  paga: "Paga",
  dispensada: "Dispensada",
};

/** Estado visual da célula na grade: verde (ok) / amarelo (andamento) / vermelho (atraso). */
export type GradeEstado = "ok" | "andamento" | "atraso" | "vazio";

export function estadoObrigacao(
  status: ObrigacaoStatus,
  vencimento: string | null,
): GradeEstado {
  if (["entregue", "paga", "dispensada"].includes(status)) return "ok";
  if (vencimento && vencimento < hojeISO()) return "atraso";
  return "andamento";
}

export type Periodicidade = "mensal" | "trimestral" | "anual";

export const PERIODICIDADE_LABEL: Record<Periodicidade, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  anual: "Anual",
};

/* --------------------------- Dep. Pessoal --------------------------- */

export type TipoContrato =
  | "clt"
  | "estagio"
  | "aprendiz"
  | "temporario"
  | "domestico";

export const TIPO_CONTRATO_LABEL: Record<TipoContrato, string> = {
  clt: "CLT",
  estagio: "Estágio",
  aprendiz: "Aprendiz",
  temporario: "Temporário",
  domestico: "Doméstico",
};

export type FuncionarioStatus = "ativo" | "afastado" | "ferias" | "desligado";

export const FUNCIONARIO_STATUS_LABEL: Record<FuncionarioStatus, string> = {
  ativo: "Ativo",
  afastado: "Afastado",
  ferias: "Em férias",
  desligado: "Desligado",
};

export type EventoDpTipo =
  | "admissao"
  | "demissao"
  | "ferias"
  | "retorno_ferias"
  | "afastamento"
  | "retorno_afastamento"
  | "decimo_terceiro"
  | "rescisao"
  | "alteracao_salarial"
  | "outro";

export const EVENTO_DP_TIPO_LABEL: Record<EventoDpTipo, string> = {
  admissao: "Admissão",
  demissao: "Demissão",
  ferias: "Férias",
  retorno_ferias: "Retorno de férias",
  afastamento: "Afastamento",
  retorno_afastamento: "Retorno de afastamento",
  decimo_terceiro: "13º salário",
  rescisao: "Rescisão",
  alteracao_salarial: "Alteração salarial",
  outro: "Outro processo",
};

/** Checklist padrão sugerido ao criar o processo (item 8 da especificação). */
export const EVENTO_DP_CHECKLIST_PADRAO: Partial<Record<EventoDpTipo, string[]>> = {
  admissao: [
    "Documentos recebidos",
    "Cadastro realizado",
    "Contrato gerado",
    "Assinaturas coletadas",
    "Envio ao eSocial",
    "Processo concluído",
  ],
  demissao: [
    "Aviso prévio / comunicado",
    "Cálculo da rescisão",
    "Homologação / assinatura",
    "Envio ao eSocial",
    "Pagamento das verbas",
  ],
  rescisao: [
    "Cálculo da rescisão",
    "Homologação / assinatura",
    "Pagamento das verbas",
  ],
  ferias: ["Aviso de férias", "Recibo assinado", "Pagamento do adiantamento"],
  decimo_terceiro: ["Cálculo da parcela", "Pagamento", "Envio ao eSocial"],
};

export type EventoDpStatus =
  | "solicitado"
  | "em_andamento"
  | "aguardando_cliente"
  | "concluido"
  | "cancelado";

export const EVENTO_DP_STATUS_LABEL: Record<EventoDpStatus, string> = {
  solicitado: "Solicitado",
  em_andamento: "Em andamento",
  aguardando_cliente: "Aguardando cliente",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const EVENTO_DP_STATUS_TONE: Record<EventoDpStatus, TarefaStatusTone> = {
  solicitado: "neutral",
  em_andamento: "info",
  aguardando_cliente: "warning",
  concluido: "success",
  cancelado: "neutral",
};

export type FolhaStatus =
  | "aberta"
  | "em_processamento"
  | "revisao"
  | "fechada"
  | "transmitida";

export const FOLHA_STATUS_LABEL: Record<FolhaStatus, string> = {
  aberta: "Aberta",
  em_processamento: "Em processamento",
  revisao: "Em revisão",
  fechada: "Fechada",
  transmitida: "Transmitida",
};

/* ============================= Contábil ============================= */

export type FechamentoStatus =
  | "aberto"
  | "em_andamento"
  | "revisao"
  | "fechado"
  | "entregue";

export const FECHAMENTO_STATUS_LABEL: Record<FechamentoStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  revisao: "Em revisão",
  fechado: "Fechado",
  entregue: "Entregue",
};

/** Checklist padrão aberto junto com o fechamento (ver abrir_fechamentos). */
export const FECHAMENTO_CHECKLIST_PADRAO: string[] = [
  "Lançamentos contábeis",
  "Conciliação bancária",
  "Apuração de resultado",
  "Balancete gerado",
  "DRE gerado",
  "Fechamento entregue ao cliente",
];

/* ============================ Societário ============================= */

export type ProcessoSocietarioTipo =
  | "abertura"
  | "alteracao_contratual"
  | "encerramento"
  | "outro";

export const PROCESSO_SOCIETARIO_TIPO_LABEL: Record<ProcessoSocietarioTipo, string> = {
  abertura: "Abertura de empresa",
  alteracao_contratual: "Alteração contratual",
  encerramento: "Encerramento / baixa",
  outro: "Outro processo",
};

/** Checklist padrão sugerido ao criar o processo, por tipo. */
export const PROCESSO_SOCIETARIO_CHECKLIST_PADRAO: Partial<
  Record<ProcessoSocietarioTipo, string[]>
> = {
  abertura: [
    "Documentos e dados recebidos",
    "Contrato social elaborado",
    "Assinaturas coletadas",
    "Registro na Junta Comercial",
    "Inscrição no CNPJ (Receita Federal)",
    "Inscrições estadual/municipal",
    "Alvará de funcionamento",
  ],
  alteracao_contratual: [
    "Documentos recebidos",
    "Alteração contratual elaborada",
    "Assinaturas coletadas",
    "Registro na Junta Comercial",
    "Atualização de dados cadastrais",
  ],
  encerramento: [
    "Distrato elaborado",
    "Assinaturas coletadas",
    "Baixa na Junta Comercial",
    "Baixa no CNPJ (Receita Federal)",
    "Baixa nas inscrições estadual/municipal",
    "Certidões negativas obtidas",
  ],
};

export type ProcessoSocietarioStatus =
  | "solicitado"
  | "em_andamento"
  | "aguardando_orgao"
  | "aguardando_cliente"
  | "concluido"
  | "cancelado";

export const PROCESSO_SOCIETARIO_STATUS_LABEL: Record<ProcessoSocietarioStatus, string> = {
  solicitado: "Solicitado",
  em_andamento: "Em andamento",
  aguardando_orgao: "Aguardando órgão",
  aguardando_cliente: "Aguardando cliente",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const PROCESSO_SOCIETARIO_STATUS_TONE: Record<ProcessoSocietarioStatus, TarefaStatusTone> = {
  solicitado: "neutral",
  em_andamento: "info",
  aguardando_orgao: "brand",
  aguardando_cliente: "warning",
  concluido: "success",
  cancelado: "neutral",
};

/* ================================ IR ================================= */

export type IrTipo = "irpf" | "irpj" | "itr";

export const IR_TIPO_LABEL: Record<IrTipo, string> = {
  irpf: "IRPF",
  irpj: "IRPJ",
  itr: "ITR",
};

export const IR_TIPO_DESCRICAO: Record<IrTipo, string> = {
  irpf: "Imposto de Renda Pessoa Física",
  irpj: "Imposto de Renda Pessoa Jurídica",
  itr: "Imposto Territorial Rural",
};

export type IrStatus =
  | "pendente"
  | "documentos_recebidos"
  | "em_elaboracao"
  | "entregue"
  | "retificacao"
  | "dispensada";

export const IR_STATUS_LABEL: Record<IrStatus, string> = {
  pendente: "Pendente",
  documentos_recebidos: "Documentos recebidos",
  em_elaboracao: "Em elaboração",
  entregue: "Entregue",
  retificacao: "Retificação",
  dispensada: "Dispensada",
};

export const IR_STATUS_TONE: Record<IrStatus, TarefaStatusTone> = {
  pendente: "neutral",
  documentos_recebidos: "info",
  em_elaboracao: "brand",
  entregue: "success",
  retificacao: "warning",
  dispensada: "neutral",
};

/* -------------------------- Retorno de actions -------------------- */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export const actionOk = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const actionErr = (
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> => ({ ok: false, error, fieldErrors });
