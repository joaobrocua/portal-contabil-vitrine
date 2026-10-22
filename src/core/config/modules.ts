/**
 * Registro central de módulos (item 2 da especificação).
 *
 * Cada módulo é declarado com id, `fase` (V1/V2/V3), flag `enabled` e os papéis
 * com acesso. Desligar um módulo remove o item do menu e faz
 * `assertModuleEnabled()` bloquear as rotas dele. Atualizar um módulo nunca
 * exige tocar em outro.
 */

import type { Papel } from "@/core/types/domain";

export type ModuleId =
  | "dashboard"
  | "empresas"
  | "tarefas"
  | "fiscal"
  | "pessoal"
  | "contabil"
  | "societario"
  | "ir"
  | "documentos"
  | "comunicacao"
  | "agenda"
  | "usuarios"
  | "relatorios"
  | "administracao";

/** 1 = Gestão do Escritório · 2 = Departamentos · 3 = Automação */
export type Fase = 1 | 2 | 3;

export interface ModuleDef {
  id: ModuleId;
  label: string;
  href: string;
  /** Nome do ícone lucide-react (ver core/ui/icon.tsx). */
  icon: string;
  /** Papéis com acesso. Vazio = todos os papéis autenticados. */
  papeis: Papel[];
  fase: Fase;
  enabled: boolean;
  ordem: number;
  descricao: string;
  /** Agrupamento no menu lateral. */
  grupo: "principal" | "departamentos" | "gestao";
}

const STAFF: Papel[] = [
  "admin",
  "fiscal",
  "pessoal",
  "contabil",
  "societario",
  "atendimento",
];

export const MODULES: Record<ModuleId, ModuleDef> = {
  dashboard: {
    id: "dashboard",
    label: "Dashboard",
    href: "/painel",
    icon: "LayoutDashboard",
    papeis: [],
    fase: 1,
    enabled: true,
    ordem: 0,
    grupo: "principal",
    descricao: "Visão geral do escritório e o que precisa de atenção.",
  },
  empresas: {
    id: "empresas",
    label: "Clientes & Empresas",
    href: "/empresas",
    icon: "Building2",
    papeis: [...STAFF],
    fase: 1,
    enabled: true,
    ordem: 1,
    grupo: "principal",
    descricao: "Cadastro de empresas, sócios e contatos.",
  },
  tarefas: {
    id: "tarefas",
    label: "Tarefas & Processos",
    href: "/tarefas",
    icon: "ListChecks",
    papeis: [...STAFF],
    fase: 1,
    enabled: true,
    ordem: 2,
    grupo: "principal",
    descricao: "Toda atividade do escritório como tarefa, com checklist e prazo.",
  },
  agenda: {
    id: "agenda",
    label: "Agenda & Prazos",
    href: "/agenda",
    icon: "CalendarDays",
    papeis: [...STAFF],
    fase: 1,
    enabled: true,
    ordem: 3,
    grupo: "principal",
    descricao: "Calendário do escritório: prazos, reuniões e lembretes.",
  },
  documentos: {
    id: "documentos",
    label: "Central de Documentos",
    href: "/documentos",
    icon: "FolderTree",
    papeis: [],
    fase: 1,
    enabled: true,
    ordem: 4,
    grupo: "principal",
    descricao: "Arquivos das empresas organizados por departamento.",
  },

  fiscal: {
    id: "fiscal",
    label: "Fiscal",
    href: "/fiscal",
    icon: "ReceiptText",
    papeis: ["admin", "fiscal"],
    fase: 2,
    enabled: true,
    ordem: 10,
    grupo: "departamentos",
    descricao: "Obrigações, guias e grade de competências por empresa.",
  },
  pessoal: {
    id: "pessoal",
    label: "Dep. Pessoal",
    href: "/pessoal",
    icon: "Users",
    papeis: ["admin", "pessoal"],
    fase: 2,
    enabled: true,
    ordem: 11,
    grupo: "departamentos",
    descricao: "Funcionários, admissões, folha, férias, rescisões e holerites.",
  },
  contabil: {
    id: "contabil",
    label: "Contábil",
    href: "/contabil",
    icon: "BookOpenCheck",
    papeis: ["admin", "contabil"],
    fase: 2,
    enabled: true,
    ordem: 12,
    grupo: "departamentos",
    descricao: "Controle de fechamento: conciliação, escrituração, balancete.",
  },
  societario: {
    id: "societario",
    label: "Societário",
    href: "/societario",
    icon: "Landmark",
    papeis: ["admin", "societario"],
    fase: 2,
    enabled: true,
    ordem: 13,
    grupo: "departamentos",
    descricao: "Abertura, alteração e baixa de empresas por checklist de etapas.",
  },
  ir: {
    id: "ir",
    label: "Imposto de Renda",
    href: "/ir",
    icon: "FileSpreadsheet",
    papeis: ["admin", "fiscal", "contabil"],
    fase: 2,
    enabled: true,
    ordem: 14,
    grupo: "departamentos",
    descricao: "Campanhas de IRPF/IRPJ/ITR com controle por cliente.",
  },
  comunicacao: {
    id: "comunicacao",
    label: "Comunicação & Solicitações",
    href: "/comunicacao",
    icon: "MessagesSquare",
    papeis: [],
    fase: 2,
    enabled: false,
    ordem: 15,
    grupo: "gestao",
    descricao: "Solicitações de documentos e conversa com o cliente.",
  },
  relatorios: {
    id: "relatorios",
    label: "Relatórios",
    href: "/relatorios",
    icon: "BarChart3",
    papeis: ["admin", "atendimento"],
    fase: 2,
    enabled: false,
    ordem: 16,
    grupo: "gestao",
    descricao: "Relatórios operacionais, de clientes e de prazos.",
  },

  usuarios: {
    id: "usuarios",
    label: "Usuários & Permissões",
    href: "/usuarios",
    icon: "ShieldCheck",
    papeis: ["admin"],
    fase: 1,
    enabled: true,
    ordem: 90,
    grupo: "gestao",
    descricao: "Contas, papéis e níveis de acesso.",
  },
  administracao: {
    id: "administracao",
    label: "Administração",
    href: "/administracao",
    icon: "Settings",
    papeis: ["admin"],
    fase: 1,
    enabled: true,
    ordem: 91,
    grupo: "gestao",
    descricao: "Parâmetros, catálogos (tipos e status) e histórico de ações.",
  },
};

export const GRUPO_LABEL: Record<ModuleDef["grupo"], string> = {
  principal: "Operação",
  departamentos: "Departamentos",
  gestao: "Gestão",
};

export function listModules(): ModuleDef[] {
  return Object.values(MODULES).sort((a, b) => a.ordem - b.ordem);
}

export function isModuleEnabled(id: ModuleId): boolean {
  return MODULES[id]?.enabled ?? false;
}

export function canAccessModule(id: ModuleId, papel: Papel | null): boolean {
  const mod = MODULES[id];
  if (!mod || !mod.enabled || !papel) return false;
  if (mod.papeis.length === 0) return true;
  return mod.papeis.includes(papel);
}

/** Itens de menu visíveis para um papel, agrupados. */
export function menuFor(
  papel: Papel | null,
): { grupo: ModuleDef["grupo"]; label: string; itens: ModuleDef[] }[] {
  const visiveis = listModules().filter((m) => canAccessModule(m.id, papel));
  const grupos: ModuleDef["grupo"][] = ["principal", "departamentos", "gestao"];
  return grupos
    .map((g) => ({
      grupo: g,
      label: GRUPO_LABEL[g],
      itens: visiveis.filter((m) => m.grupo === g),
    }))
    .filter((s) => s.itens.length > 0);
}
