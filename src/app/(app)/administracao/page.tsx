import { requireRole } from "@/core/auth/session";
import { listarEventosSeguranca } from "@/core/auth/eventos-seguranca";
import { listarHistorico } from "@/core/lib/historico";
import { paramEnum } from "@/core/lib/search-params";
import { EventosSegurancaList } from "@/core/layout/eventos-seguranca-list";
import { HistoricoList } from "@/core/layout/historico-list";
import { Card, CardContent, PageHeader, TabNav, type TabItem } from "@/core/ui";
import {
  avaliarBackups,
  BackupsPanel,
  CatalogosPanel,
  ConfigForm,
  getConfig,
  listarBackups,
  listCatalogos,
} from "@/modules/administracao";
import { AcessosDocumentosList, listarAcessosDocumentos } from "@/modules/documentos";

export const metadata = { title: "Administração" };

const ABAS = ["config", "catalogos", "historico", "acessos", "seguranca", "backup"] as const;

export default async function AdministracaoPage({
  searchParams,
}: PageProps<"/administracao">) {
  await requireRole("admin");
  const sp = await searchParams;
  const aba = paramEnum(sp.aba, ABAS) ?? "config";

  const tabs: TabItem[] = [
    { label: "Escritório", href: "/administracao?aba=config", active: aba === "config" },
    { label: "Catálogos", href: "/administracao?aba=catalogos", active: aba === "catalogos" },
    { label: "Histórico", href: "/administracao?aba=historico", active: aba === "historico" },
    { label: "Acessos a documentos", href: "/administracao?aba=acessos", active: aba === "acessos" },
    { label: "Segurança", href: "/administracao?aba=seguranca", active: aba === "seguranca" },
    { label: "Backup", href: "/administracao?aba=backup", active: aba === "backup" },
  ];

  const seguranca = aba === "seguranca" ? await listarEventosSeguranca() : null;
  const backups = aba === "backup" ? await listarBackups() : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administração"
        description="Parâmetros do escritório, catálogos, trilhas de auditoria e backup."
      />
      <TabNav items={tabs} />

      {aba === "config" ? <ConfigForm config={await getConfig()} /> : null}
      {aba === "catalogos" ? (
        <CatalogosPanel grupos={await listCatalogos()} />
      ) : null}
      {aba === "historico" ? (
        <Card>
          <CardContent>
            <HistoricoList itens={await listarHistorico({ limite: 100 })} />
          </CardContent>
        </Card>
      ) : null}
      {aba === "acessos" ? (
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm text-[var(--color-text-dim)]">
              Últimos 200 envios e downloads de documentos (trilha LGPD).
            </p>
            <AcessosDocumentosList acessos={await listarAcessosDocumentos()} />
          </CardContent>
        </Card>
      ) : null}
      {backups ? (
        <Card>
          <CardContent>
            <BackupsPanel
              backups={backups}
              situacao={avaliarBackups(
                backups[0] ?? null,
                backups.find((b) => b.sucesso && b.verificado) ?? null,
              )}
            />
          </CardContent>
        </Card>
      ) : null}
      {seguranca ? (
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm text-[var(--color-text-dim)]">
              Últimos 200 eventos.{" "}
              <strong
                className={
                  seguranca.falhasLogin24h >= 10
                    ? "text-[var(--color-carmine-bright)]"
                    : "text-[var(--color-text)]"
                }
              >
                {seguranca.falhasLogin24h} login(s) com falha nas últimas 24h
              </strong>
              . Muitas falhas seguidas para o mesmo e-mail ou IP indicam
              tentativa de adivinhar senha — o sistema já bloqueia
              aquele e-mail por 15 minutos após 5 erros.
            </p>
            <EventosSegurancaList eventos={seguranca.eventos} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
