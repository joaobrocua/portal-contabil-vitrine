/**
 * Tipos das tabelas do banco (mantidos à mão, espelham `supabase/migrations`).
 *
 * Regra: cada tabela pertence a UM módulo. Ao evoluir um módulo, mexa só no
 * bloco dele aqui e na migration correspondente.
 *
 * Escopo atual: V1 — Gestão do Escritório.
 */

import type {
  Departamento,
  EventoDpStatus,
  EventoDpTipo,
  FechamentoStatus,
  FolhaStatus,
  FuncionarioStatus,
  IrStatus,
  IrTipo,
  ObrigacaoStatus,
  ObrigacaoTipo,
  Papel,
  Periodicidade,
  Prioridade,
  ProcessoSocietarioStatus,
  ProcessoSocietarioTipo,
  RegimeTributario,
  SituacaoEmpresa,
  TarefaStatus,
  TipoContrato,
} from "@/core/types/domain";

/* ============================== core ================================= */

export interface ProfileRow {
  id: string; // = auth.users.id
  nome: string;
  email: string;
  papel: Papel;
  departamento: Departamento | null;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/** Configuração do escritório — linha única (id = 1). */
export interface EscritorioConfigRow {
  id: number;
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  logo_path: string | null;
  updated_at: string;
}

/** Catálogos configuráveis: tipos de tarefa/documento/obrigação, status... */
export interface CatalogoRow {
  id: string;
  tipo: string; // ex.: 'tipo_documento', 'tipo_tarefa', 'tipo_obrigacao'
  valor: string; // slug estável
  rotulo: string;
  ordem: number;
  ativo: boolean;
  created_at: string;
}

/** Histórico de ações (auditoria — itens 17 e 18). */
export interface HistoricoRow {
  id: string;
  entidade: string; // 'tarefa', 'empresa', 'documento'...
  entidade_id: string | null;
  acao: string; // 'criou', 'alterou_status', 'excluiu'...
  campo: string | null;
  de: string | null;
  para: string | null;
  descricao: string;
  autor_id: string | null;
  created_at: string;
}

/**
 * Contagem de tentativas p/ limite de uso. Sem policy: só a service role
 * lê/grava (rate-limit.ts e a aba Segurança da Administração).
 */
export interface EventoSegurancaRow {
  id: string;
  tipo: string; // 'login', 'criar_usuario'...
  chave: string; // e-mail, id do usuário — depende do tipo
  ip: string | null;
  sucesso: boolean;
  created_at: string;
}

/** Uma execução do scripts\backup-sistema.ps1 (instalação do escritório). */
export interface BackupRow {
  id: string;
  iniciado_em: string;
  concluido_em: string | null;
  sucesso: boolean;
  verificado: boolean; // ensaio de restauração passou
  destino: string | null;
  tamanho_bytes: number | null;
  detalhe: string | null;
}

/** Honorário mensal de uma empresa — tabela só de admin (migration 0030). */
export interface EmpresaHonorarioRow {
  empresa_id: string;
  valor: number;
  updated_at: string;
}

/* ============================ empresas =============================== */

export interface EmpresaRow {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string; // 14 dígitos
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  cnae_principal: string | null;
  regime_tributario: RegimeTributario;
  situacao: SituacaoEmpresa;
  data_abertura: string | null;
  email: string | null;
  telefone: string | null;
  // endereço
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  // gestão
  responsavel_id: string | null; // profile de atendimento
  departamentos_responsaveis: Departamento[]; // quais setores atendem
  honorario_mensal: number | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface SocioRow {
  id: string;
  empresa_id: string;
  nome: string;
  cpf: string; // 11 dígitos
  participacao: number | null; // %
  administrador: boolean;
  created_at: string;
}

export type TipoContato =
  | "socio"
  | "financeiro"
  | "rh"
  | "responsavel_legal"
  | "contador_interno"
  | "outro";

export interface ContatoRow {
  id: string;
  empresa_id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  cargo: string | null;
  tipo: TipoContato;
  recebe_comunicacoes: boolean;
  profile_id: string | null; // vinculado a um login, quando houver
  created_at: string;
}

/* ============================= tarefas ============================== */

export type TarefaOrigem =
  | "manual"
  | "recorrente"
  | "obrigacao"
  | "solicitacao"
  | "processo";

export interface TarefaRow {
  id: string;
  titulo: string;
  descricao: string | null;
  empresa_id: string | null; // null = tarefa interna do escritório
  departamento: Departamento;
  responsavel_id: string | null;
  criado_por: string | null;
  competencia: string | null; // 'YYYY-MM-01'
  prazo: string | null; // date
  status: TarefaStatus;
  prioridade: Prioridade;
  origem: TarefaOrigem;
  template_id: string | null;
  concluida_em: string | null;
  created_at: string;
  updated_at: string;
}

/** Itens do checklist / etapas de um processo. */
export interface TarefaItemRow {
  id: string;
  tarefa_id: string;
  descricao: string;
  feito: boolean;
  ordem: number;
  feito_em: string | null;
  feito_por: string | null;
}

export interface TarefaDocumentoRow {
  tarefa_id: string;
  documento_id: string;
  created_at: string;
}

export type Recorrencia = "nenhuma" | "mensal" | "trimestral" | "anual";

export interface TarefaTemplateRow {
  id: string;
  nome: string;
  departamento: Departamento;
  titulo_padrao: string;
  descricao: string | null;
  itens_padrao: string[]; // jsonb
  recorrencia: Recorrencia;
  dia_prazo: number | null; // dia do mês para o prazo
  ativo: boolean;
  created_at: string;
}

/* =========================== documentos ============================ */

export type DocumentoOrigem = "cliente" | "escritorio";
export type DocumentoStatus =
  | "pendente"
  | "recebido"
  | "aprovado"
  | "rejeitado"
  | "correcao";

export interface DocumentoRow {
  id: string;
  empresa_id: string;
  departamento: Departamento;
  categoria: string; // livre / catálogo 'tipo_documento'
  competencia: string | null;
  titulo: string;
  descricao: string | null;
  storage_path: string;
  tamanho_bytes: number | null;
  mime: string | null;
  origem: DocumentoOrigem;
  status: DocumentoStatus;
  enviado_por: string | null;
  revisado_por: string | null;
  revisado_em: string | null;
  observacao: string | null;
  created_at: string;
}

/** Trilha de acesso a documentos (LGPD — item 18). */
export interface DocumentoAcessoRow {
  id: string;
  /** null depois que o documento é excluído (a linha da trilha fica). */
  documento_id: string | null;
  profile_id: string | null;
  acao: "upload" | "download" | "visualizou" | "excluiu";
  /** Cópias preenchidas por trigger (0027) — legíveis mesmo após excluir. */
  documento_titulo: string | null;
  empresa_id: string | null;
  created_at: string;
}

/** View agregada (0011_paginacao.sql) — evita buscar todo documento pra contar. */
export interface DocumentoContagemRow {
  empresa_id: string;
  total: number;
  pendentes: number;
}

/* ============================= agenda ============================= */

export type EventoTipo = "prazo" | "reuniao" | "lembrete" | "obrigacao" | "outro";
export type EventoOrigem = "manual" | "tarefa" | "obrigacao";

export interface EventoAgendaRow {
  id: string;
  titulo: string;
  descricao: string | null;
  data: string; // date
  hora: string | null; // time
  tipo: EventoTipo;
  departamento: Departamento | null;
  empresa_id: string | null;
  responsavel_id: string | null;
  origem: EventoOrigem;
  ref_id: string | null; // id da tarefa/obrigação de origem
  concluido: boolean;
  criado_por: string | null;
  created_at: string;
}

/* =============================== fiscal ============================= */

export interface ObrigacaoRecorrenciaRow {
  id: string;
  empresa_id: string;
  tipo: ObrigacaoTipo;
  descricao: string | null;
  periodicidade: Periodicidade;
  dia_vencimento: number;
  meses_apos: number;
  responsavel_id: string | null;
  ativo: boolean;
  created_at: string;
}

export interface ObrigacaoRow {
  id: string;
  empresa_id: string;
  competencia: string;
  tipo: ObrigacaoTipo;
  descricao: string | null;
  vencimento: string;
  valor: number | null;
  status: ObrigacaoStatus;
  responsavel_id: string | null;
  guia_path: string | null;
  comprovante_path: string | null;
  data_entrega: string | null;
  observacao: string | null;
  recorrencia_id: string | null;
  created_at: string;
  updated_at: string;
}

/* ============================== pessoal ============================= */

export interface FuncionarioRow {
  id: string;
  empresa_id: string;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  tipo_contrato: TipoContrato;
  data_admissao: string | null;
  data_demissao: string | null;
  salario: number | null;
  status: FuncionarioStatus;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventoDpRow {
  id: string;
  empresa_id: string;
  funcionario_id: string | null;
  tipo: EventoDpTipo;
  competencia: string | null;
  data_referencia: string | null;
  status: EventoDpStatus;
  detalhe: string | null;
  responsavel_id: string | null;
  solicitado_por: string | null;
  concluido_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventoDpItemRow {
  id: string;
  evento_id: string;
  descricao: string;
  feito: boolean;
  ordem: number;
  feito_em: string | null;
  feito_por: string | null;
}

export interface FolhaRow {
  id: string;
  empresa_id: string;
  competencia: string;
  status: FolhaStatus;
  qtd_funcionarios: number | null;
  observacao: string | null;
  fechada_em: string | null;
  fechada_por: string | null;
  created_at: string;
  updated_at: string;
}

/* ================================ IR ================================= */

export interface DeclaracaoIrRow {
  id: string;
  empresa_id: string;
  socio_id: string | null;
  tipo: IrTipo;
  ano_exercicio: number;
  status: IrStatus;
  prazo: string | null;
  valor_a_pagar: number | null;
  valor_a_restituir: number | null;
  recibo: string | null;
  responsavel_id: string | null;
  observacao: string | null;
  entregue_em: string | null;
  created_at: string;
  updated_at: string;
}

/* ============================ societário ============================ */

export interface ProcessoSocietarioRow {
  id: string;
  empresa_id: string;
  tipo: ProcessoSocietarioTipo;
  status: ProcessoSocietarioStatus;
  descricao: string | null;
  protocolo: string | null;
  responsavel_id: string | null;
  solicitado_por: string | null;
  concluido_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessoSocietarioItemRow {
  id: string;
  processo_id: string;
  descricao: string;
  feito: boolean;
  ordem: number;
  feito_em: string | null;
  feito_por: string | null;
}

/* ============================= contábil ============================= */

export interface FechamentoContabilRow {
  id: string;
  empresa_id: string;
  competencia: string;
  status: FechamentoStatus;
  responsavel_id: string | null;
  observacao: string | null;
  fechado_em: string | null;
  entregue_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface FechamentoItemRow {
  id: string;
  fechamento_id: string;
  descricao: string;
  feito: boolean;
  ordem: number;
  feito_em: string | null;
  feito_por: string | null;
}

/* ===================== montagem do tipo Database ================== */

/**
 * Supabase/postgrest exigem que cada tabela satisfaça `GenericTable`, cujo
 * `Row` deve ser `Record<string, unknown>`. Interfaces TS não têm índice
 * implícito, então intersectamos com `Record<string, unknown>`.
 */
type Idx<T> = { [K in keyof T]: T[K] } & Record<string, unknown>;

type TableShape<Row> = {
  Row: Idx<Row>;
  Insert: Idx<Partial<Row>>;
  Update: Idx<Partial<Row>>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableShape<ProfileRow>;
      escritorio_config: TableShape<EscritorioConfigRow>;
      catalogos: TableShape<CatalogoRow>;
      historico: TableShape<HistoricoRow>;
      eventos_seguranca: TableShape<EventoSegurancaRow>;
      backups: TableShape<BackupRow>;
      // A tabela NÃO tem honorario_mensal (0030): ele vive em
      // empresa_honorarios, só admin. A view empresas_com_honorario (abaixo)
      // devolve o valor (null para quem não é admin).
      empresas: TableShape<Omit<EmpresaRow, "honorario_mensal">>;
      empresa_honorarios: TableShape<EmpresaHonorarioRow>;
      // View (não tabela): mesmas colunas de empresas, mas
      // honorario_mensal só vem preenchido pra admin (migrations 0022/0030).
      // Some tela que mostra o honorário deve ler daqui, nunca de
      // "empresas" direto.
      empresas_com_honorario: TableShape<EmpresaRow>;
      socios: TableShape<SocioRow>;
      contatos: TableShape<ContatoRow>;
      tarefas: TableShape<TarefaRow>;
      tarefa_itens: TableShape<TarefaItemRow>;
      tarefa_documentos: TableShape<TarefaDocumentoRow>;
      tarefa_templates: TableShape<TarefaTemplateRow>;
      documentos: TableShape<DocumentoRow>;
      documento_acessos: TableShape<DocumentoAcessoRow>;
      eventos_agenda: TableShape<EventoAgendaRow>;
      obrigacoes: TableShape<ObrigacaoRow>;
      obrigacao_recorrencias: TableShape<ObrigacaoRecorrenciaRow>;
      funcionarios: TableShape<FuncionarioRow>;
      eventos_dp: TableShape<EventoDpRow>;
      evento_dp_itens: TableShape<EventoDpItemRow>;
      folhas: TableShape<FolhaRow>;
      fechamentos_contabeis: TableShape<FechamentoContabilRow>;
      fechamento_itens: TableShape<FechamentoItemRow>;
      processos_societarios: TableShape<ProcessoSocietarioRow>;
      processo_societario_itens: TableShape<ProcessoSocietarioItemRow>;
      declaracoes_ir: TableShape<DeclaracaoIrRow>;
    };
    Views: {
      documentos_contagem_por_empresa: TableShape<DocumentoContagemRow>;
    };
    Functions: {
      gerar_obrigacoes: {
        Args: { p_competencia: string };
        Returns: number;
      };
      abrir_folhas: {
        Args: { p_competencia: string };
        Returns: number;
      };
      abrir_fechamentos: {
        Args: { p_competencia: string };
        Returns: number;
      };
      gerar_declaracoes_ir: {
        Args: { p_tipo: IrTipo; p_ano: number; p_prazo: string | null };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
  };
}
