import Link from "next/link";
import { ArrowLeft, FolderOpen } from "lucide-react";

import { requireSession } from "@/core/auth/session";
import { formatCNPJ } from "@/core/lib/format";
import { paramBusca, paramPagina } from "@/core/lib/paginacao";
import { paramEnum, paramUuid } from "@/core/lib/search-params";
import {
  DEPARTAMENTO_LABEL,
  isStaff,
  type Departamento,
} from "@/core/types/domain";
import {
  Badge,
  BuscaUrl,
  buttonVariants,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  Paginacao,
  TabNav,
  type TabItem,
} from "@/core/ui";
import {
  categoriasDocumento,
  departamentosParaEnvio,
  DocumentoLinha,
  paginarPastas,
  getEmpresaNome,
  listDocumentos,
  UploadDocumento,
} from "@/modules/documentos";

export const metadata = { title: "Central de Documentos" };

const DEPS: Departamento[] = [
  "fiscal",
  "pessoal",
  "contabil",
  "societario",
  "ir",
  "geral",
];

export default async function DocumentosPage({
  searchParams,
}: PageProps<"/documentos">) {
  const session = await requireSession();
  const staff = isStaff(session.profile.papel);
  const sp = await searchParams;
  const empresaId = paramUuid(sp.empresa);
  const dep = paramEnum(sp.dep, DEPS);

  if (!empresaId) {
    const busca = paramBusca(sp.busca);
    const pastas = await paginarPastas(busca, paramPagina(sp.pagina));
    return (
      <div className="space-y-6">
        <PageHeader
          title="Central de Documentos"
          description="Arquivos das empresas, organizados por departamento."
        />
        {staff || busca ? (
          <BuscaUrl
            placeholder="Buscar empresa por nome ou CNPJ…"
            className="max-w-md flex-none"
          />
        ) : null}
        {pastas.itens.length === 0 ? (
          busca ? (
            <EmptyState
              title="Nenhuma empresa encontrada"
              description="Confira o nome ou o CNPJ digitado, ou limpe a busca."
            />
          ) : (
            <EmptyState
              title="Nenhuma empresa"
              description="Cadastre empresas para arquivar documentos."
            />
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pastas.itens.map((p) => (
              <Link key={p.id} href={`/documentos?empresa=${p.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center gap-3">
                    <FolderOpen className="size-8 text-gold" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-neutral-900">
                        {p.nome}
                      </p>
                      <p className="data truncate text-xs text-neutral-500">
                        {formatCNPJ(p.cnpj)}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {p.total} documento(s)
                      </p>
                    </div>
                    {p.pendentes > 0 ? (
                      <Badge tone="warning">{p.pendentes} pend.</Badge>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
        <Paginacao
          total={pastas.total}
          pagina={pastas.pagina}
          tamanho={pastas.tamanho}
          nomeItem="empresas"
        />
      </div>
    );
  }

  const [nome, docs, categorias] = await Promise.all([
    getEmpresaNome(empresaId),
    listDocumentos({ empresaId, departamento: dep }),
    categoriasDocumento(),
  ]);

  const tabs: TabItem[] = [
    {
      label: "Todos",
      href: `/documentos?empresa=${empresaId}`,
      active: !dep,
    },
    // A aba "Pessoal" só existe para quem pode vê-lo (migration 0031); para os
    // demais ela mostraria "Sem documentos" mesmo havendo — enganoso.
    ...DEPS.filter((d) => d !== "pessoal" || departamentosParaEnvio(session.profile.papel).includes("pessoal")).map((d) => ({
      label: DEPARTAMENTO_LABEL[d],
      href: `/documentos?empresa=${empresaId}&dep=${d}`,
      active: dep === d,
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={nome ?? "Documentos"}
        description="Documentos arquivados para esta empresa."
        actions={
          <Link
            href="/documentos"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ArrowLeft className="size-4" />
            Todas as empresas
          </Link>
        }
      />

      <TabNav items={tabs} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-neutral-200 bg-[var(--color-surface)]">
          {docs.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Sem documentos"
                description="Envie o primeiro documento no painel ao lado."
              />
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {docs.map((d) => (
                <DocumentoLinha key={d.id} doc={d} podeRevisar={staff} />
              ))}
            </div>
          )}
        </div>

        <UploadDocumento
          empresaId={empresaId}
          departamentoInicial={dep}
          departamentos={departamentosParaEnvio(session.profile.papel)}
          categorias={categorias}
        />
      </div>
    </div>
  );
}
