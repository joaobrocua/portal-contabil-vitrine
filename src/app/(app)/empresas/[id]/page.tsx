import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { requireRole } from "@/core/auth/session";
import { createSupabaseServerClient } from "@/core/db/server";
import { listarHistorico } from "@/core/lib/historico";
import { paramEnum } from "@/core/lib/search-params";
import {
  formatCNPJ,
  formatData,
  formatMoeda,
  formatTelefone,
} from "@/core/lib/format";
import { HistoricoList } from "@/core/layout/historico-list";
import {
  DEPARTAMENTO_LABEL,
  PAPEIS_INTERNOS,
  REGIME_LABEL,
  SITUACAO_EMPRESA_LABEL,
  type Departamento,
} from "@/core/types/domain";
import {
  Badge,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  TabNav,
  type TabItem,
} from "@/core/ui";
import {
  AlternarAtivoEmpresa,
  ContatosPanel,
  getContatos,
  getEmpresa,
  getSocios,
  SociosPanel,
} from "@/modules/empresas";
import { isModuleEnabled } from "@/core/config/modules";
import { FechamentosList, listFechamentos } from "@/modules/contabil";
import { listObrigacoes, ObrigacoesList } from "@/modules/fiscal";
import { DeclaracoesIrList, listDeclaracoesIr } from "@/modules/ir";
import { FuncionariosList, listFuncionarios } from "@/modules/pessoal";
import { listProcessosSocietarios, ProcessosSocietariosList } from "@/modules/societario";

export async function generateMetadata({
  params,
}: PageProps<"/empresas/[id]">) {
  const { id } = await params;
  const empresa = await getEmpresa(id);
  return { title: empresa?.nome_fantasia || empresa?.razao_social || "Empresa" };
}

const ABAS = [
  "dados",
  "contatos",
  "socios",
  "tarefas",
  "fiscal",
  "pessoal",
  "contabil",
  "societario",
  "ir",
  "documentos",
  "historico",
] as const;
type Aba = (typeof ABAS)[number];

export default async function EmpresaPage({
  params,
  searchParams,
}: PageProps<"/empresas/[id]">) {
  const session = await requireRole(...PAPEIS_INTERNOS);
  const { id } = await params;
  const sp = await searchParams;
  const aba: Aba = paramEnum(sp.aba, ABAS) ?? "dados";

  const empresa = await getEmpresa(id);
  if (!empresa) notFound();

  const fiscalOn = isModuleEnabled("fiscal");
  const pessoalOn = isModuleEnabled("pessoal");
  const contabilOn = isModuleEnabled("contabil");
  const societarioOn = isModuleEnabled("societario");
  const irOn = isModuleEnabled("ir");
  const supabase = await createSupabaseServerClient();
  const [
    { count: nContatos },
    { count: nSocios },
    { count: nTarefas },
    { count: nDocs },
    { count: nObrigacoes },
    { count: nFuncionarios },
    { count: nFechamentos },
    { count: nProcessosSocietarios },
    { count: nDeclaracoesIr },
  ] = await Promise.all([
    supabase.from("contatos").select("id", { count: "exact", head: true }).eq("empresa_id", id),
    supabase.from("socios").select("id", { count: "exact", head: true }).eq("empresa_id", id),
    supabase.from("tarefas").select("id", { count: "exact", head: true }).eq("empresa_id", id),
    supabase.from("documentos").select("id", { count: "exact", head: true }).eq("empresa_id", id),
    fiscalOn
      ? supabase
          .from("obrigacoes")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", id)
      : Promise.resolve({ count: 0 }),
    pessoalOn
      ? supabase
          .from("funcionarios")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", id)
          .eq("status", "ativo")
      : Promise.resolve({ count: 0 }),
    contabilOn
      ? supabase
          .from("fechamentos_contabeis")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", id)
      : Promise.resolve({ count: 0 }),
    societarioOn
      ? supabase
          .from("processos_societarios")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", id)
      : Promise.resolve({ count: 0 }),
    irOn
      ? supabase
          .from("declaracoes_ir")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", id)
      : Promise.resolve({ count: 0 }),
  ]);

  const tab = (label: string, a: Aba, badge?: number | null): TabItem => ({
    label,
    href: `/empresas/${id}?aba=${a}`,
    active: aba === a,
    badge: badge ?? undefined,
  });

  const tabs: TabItem[] = [
    tab("Dados", "dados"),
    tab("Contatos", "contatos", nContatos),
    tab("Sócios", "socios", nSocios),
    tab("Tarefas", "tarefas", nTarefas),
    ...(fiscalOn ? [tab("Fiscal", "fiscal", nObrigacoes)] : []),
    ...(pessoalOn ? [tab("Pessoal", "pessoal", nFuncionarios)] : []),
    ...(contabilOn ? [tab("Contábil", "contabil", nFechamentos)] : []),
    ...(societarioOn ? [tab("Societário", "societario", nProcessosSocietarios)] : []),
    ...(irOn ? [tab("IR", "ir", nDeclaracoesIr)] : []),
    tab("Documentos", "documentos", nDocs),
    tab("Histórico", "historico"),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={empresa.nome_fantasia || empresa.razao_social}
        description={`${formatCNPJ(empresa.cnpj)} · ${
          REGIME_LABEL[empresa.regime_tributario]
        }`}
        actions={
          <>
            {!empresa.ativo ? (
              <Badge tone="danger">Inativa no escritório</Badge>
            ) : null}
            <Badge
              tone={empresa.situacao === "ativa" ? "success" : "warning"}
            >
              {SITUACAO_EMPRESA_LABEL[empresa.situacao]}
            </Badge>
            <Link
              href={`/empresas/${id}/editar`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil className="size-4" />
              Editar
            </Link>
            {session.profile.papel === "admin" ? (
              <AlternarAtivoEmpresa
                id={id}
                ativo={empresa.ativo}
                nome={empresa.nome_fantasia || empresa.razao_social}
              />
            ) : null}
          </>
        }
      />
      {!empresa.ativo ? (
        <p className="rounded-[var(--radius)] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text-dim)]">
          Esta empresa está inativa: não aparece nas listas de seleção nem
          recebe obrigações, folhas, fechamentos ou declarações novas. O
          histórico continua disponível abaixo.
          {session.profile.papel === "admin" ? " Use “Reativar” pra voltar a atendê-la." : ""}
        </p>
      ) : null}

      <TabNav items={tabs} />

      {aba === "dados" ? <DadosTab empresa={empresa} /> : null}
      {aba === "contatos" ? (
        <ContatosPanel empresaId={id} contatos={await getContatos(id)} />
      ) : null}
      {aba === "socios" ? (
        <SociosPanel empresaId={id} socios={await getSocios(id)} />
      ) : null}
      {aba === "tarefas" ? (
        <PointerCard
          titulo="Tarefas da empresa"
          texto={`${nTarefas ?? 0} tarefa(s) vinculadas a esta empresa.`}
          href={`/tarefas?empresa=${id}`}
          cta="Abrir no módulo Tarefas"
        />
      ) : null}
      {aba === "fiscal" && fiscalOn ? (
        <div className="space-y-4">
          <PointerCard
            titulo="Obrigações fiscais"
            texto={`${nObrigacoes ?? 0} obrigação(ões) registradas. Gere a competência e acompanhe a grade no módulo Fiscal.`}
            href={`/fiscal?empresa=${id}`}
            cta="Abrir no módulo Fiscal"
          />
          <ObrigacoesList obrigacoes={await listObrigacoes({ empresaId: id })} />
        </div>
      ) : null}
      {aba === "pessoal" && pessoalOn ? (
        <div className="space-y-4">
          <PointerCard
            titulo="Departamento Pessoal"
            texto={`${nFuncionarios ?? 0} funcionário(s) ativo(s). Cadastre admissões, férias e rescisões no módulo Pessoal.`}
            href={`/pessoal/funcionarios?empresa=${id}`}
            cta="Abrir no módulo Pessoal"
          />
          <FuncionariosList
            funcionarios={await listFuncionarios({ empresaId: id, status: "todos" })}
            mostrarEmpresa={false}
          />
        </div>
      ) : null}
      {aba === "contabil" && contabilOn ? (
        <div className="space-y-4">
          <PointerCard
            titulo="Fechamento contábil"
            texto={`${nFechamentos ?? 0} fechamento(s) registrado(s). Abra a competência e acompanhe o checklist no módulo Contábil.`}
            href={`/contabil?empresa=${id}`}
            cta="Abrir no módulo Contábil"
          />
          <FechamentosList
            fechamentos={await listFechamentos({ empresaId: id })}
            mostrarEmpresa={false}
          />
        </div>
      ) : null}
      {aba === "societario" && societarioOn ? (
        <div className="space-y-4">
          <PointerCard
            titulo="Processos societários"
            texto={`${nProcessosSocietarios ?? 0} processo(s) registrado(s). Acompanhe abertura, alteração e encerramento no módulo Societário.`}
            href={`/societario?empresa=${id}`}
            cta="Abrir no módulo Societário"
          />
          <ProcessosSocietariosList
            processos={await listProcessosSocietarios({ empresaId: id })}
            mostrarEmpresa={false}
          />
        </div>
      ) : null}
      {aba === "ir" && irOn ? (
        <div className="space-y-4">
          <PointerCard
            titulo="Imposto de Renda"
            texto={`${nDeclaracoesIr ?? 0} declaração(ões) registrada(s). Gere as campanhas de IRPF/IRPJ/ITR no módulo IR.`}
            href={`/ir?empresa=${id}`}
            cta="Abrir no módulo IR"
          />
          <DeclaracoesIrList declaracoes={await listDeclaracoesIr({ empresaId: id })} />
        </div>
      ) : null}
      {aba === "documentos" ? (
        <PointerCard
          titulo="Documentos da empresa"
          texto={`${nDocs ?? 0} documento(s) arquivados.`}
          href={`/documentos?empresa=${id}`}
          cta="Abrir na Central de Documentos"
        />
      ) : null}
      {aba === "historico" ? (
        <Card>
          <CardContent>
            <HistoricoList
              itens={await listarHistorico({
                entidade: "empresa",
                entidadeId: id,
              })}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function DadosTab({
  empresa,
}: {
  empresa: Awaited<ReturnType<typeof getEmpresa>> & object;
}) {
  const endereco = [
    empresa.logradouro,
    empresa.numero,
    empresa.complemento,
    empresa.bairro,
    [empresa.municipio, empresa.uf].filter(Boolean).join("/"),
    empresa.cep,
  ]
    .filter(Boolean)
    .join(", ");

  const linhas: [string, string][] = [
    ["Razão social", empresa.razao_social],
    ["Nome fantasia", empresa.nome_fantasia || "—"],
    ["CNPJ", formatCNPJ(empresa.cnpj)],
    ["Inscrição estadual", empresa.inscricao_estadual || "—"],
    ["Inscrição municipal", empresa.inscricao_municipal || "—"],
    ["CNAE principal", empresa.cnae_principal || "—"],
    ["Regime tributário", REGIME_LABEL[empresa.regime_tributario]],
    ["Situação", SITUACAO_EMPRESA_LABEL[empresa.situacao]],
    ["Data de abertura", formatData(empresa.data_abertura)],
    ["E-mail", empresa.email || "—"],
    ["Telefone", formatTelefone(empresa.telefone) || "—"],
    ["Endereço", endereco || "—"],
    [
      "Honorário mensal",
      empresa.honorario_mensal != null
        ? formatMoeda(empresa.honorario_mensal)
        : "—",
    ],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Dados cadastrais</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {linhas.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase tracking-wide text-neutral-400">
                  {k}
                </dt>
                <dd className="text-sm text-neutral-800">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Atendimento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-400">
              Departamentos responsáveis
            </p>
            {empresa.departamentos_responsaveis.length ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {empresa.departamentos_responsaveis.map((d) => (
                  <Badge key={d} tone="brand">
                    {DEPARTAMENTO_LABEL[d as Departamento]}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-neutral-500">Nenhum definido</p>
            )}
          </div>
          {empresa.observacoes ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-400">
                Observações
              </p>
              <p className="whitespace-pre-wrap text-neutral-700">
                {empresa.observacoes}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function PointerCard({
  titulo,
  texto,
  href,
  cta,
}: {
  titulo: string;
  texto: string;
  href: string;
  cta: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 py-8">
        <div>
          <p className="font-medium text-neutral-900">{titulo}</p>
          <p className="text-sm text-neutral-500">{texto}</p>
        </div>
        <Link href={href} className={buttonVariants({ variant: "subtle" })}>
          {cta}
        </Link>
      </CardContent>
    </Card>
  );
}
