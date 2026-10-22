import Link from "next/link";
import { History } from "lucide-react";

import { requireSession } from "@/core/auth/session";
import { paramUuid } from "@/core/lib/search-params";
import { listarHistorico } from "@/core/lib/historico";
import { HistoricoList } from "@/core/layout/historico-list";
import { cn } from "@/core/lib/cn";
import { diasAte, formatCNPJ, formatData, FUSO_ESCRITORIO } from "@/core/lib/format";
import { DEPARTAMENTO_LABEL, isStaff } from "@/core/types/domain";
import {
  Badge,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Wing,
  WingTick,
} from "@/core/ui";
import { isModuleEnabled } from "@/core/config/modules";
import { AvisoBackup, situacaoBackup } from "@/modules/administracao";
import { contarContabil } from "@/modules/contabil";
import { listDocumentos } from "@/modules/documentos";
import {
  AtencaoList,
  contarEmpresas,
  diagnosticarEmpresas,
  empresasDoCliente,
  type EmpresaClienteItem,
} from "@/modules/empresas";
import { contarObrigacoes, listObrigacoes, ObrigacaoStatusBadge } from "@/modules/fiscal";
import { contarIr } from "@/modules/ir";
import { contarPessoal } from "@/modules/pessoal";
import { contarSocietario } from "@/modules/societario";
import { contarTarefas, listTarefas, type TarefaListItem } from "@/modules/tarefas";

export const metadata = { title: "Dashboard" };

const DATA_LONGA = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: FUSO_ESCRITORIO,
});
const MES_CURTO = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function empresaNome(t: TarefaListItem) {
  return t.empresa ? t.empresa.nome_fantasia || t.empresa.razao_social : "Interna";
}

function PrazoTile({ t, index }: { t: TarefaListItem; index: number }) {
  const d = diasAte(t.prazo);
  const atrasada = d != null && d < 0;
  const urgente = d != null && d >= 0 && d <= 3;
  const [ano, mes, dia] = (t.prazo ?? "").split("-").map(Number);
  const cor = atrasada
    ? "border-[var(--color-carmine)] bg-[var(--color-carmine-tint)]"
    : urgente
      ? "border-[var(--color-ouro)] bg-[var(--color-ouro-tint)]"
      : "border-[var(--color-line)] bg-[var(--color-surface-2)]";
  const numCor = atrasada
    ? "text-[var(--color-carmine-bright)]"
    : urgente
      ? "text-[var(--color-ouro-bright)]"
      : "text-[var(--color-text)]";
  return (
    <Link
      href={`/tarefas/${t.id}`}
      className={`rise flex min-w-[9.5rem] flex-1 flex-col rounded-[var(--radius)] border-t-2 ${cor} p-3 transition-transform hover:-translate-y-0.5`}
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <div className="flex items-baseline gap-1.5">
        <span className={`stat text-4xl ${numCor}`}>
          {String(dia).padStart(2, "0")}
        </span>
        <span className="data text-xs text-[var(--color-text-dim)]">
          {MES_CURTO[(mes ?? 1) - 1]} {String(ano).slice(2)}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium text-[var(--color-text)]">
        {t.titulo}
      </p>
      <p className="mt-auto truncate pt-1 text-xs text-[var(--color-text-faint)]">
        {empresaNome(t)}
        {atrasada ? ` · ${Math.abs(d!)}d em atraso` : d === 0 ? " · vence hoje" : ""}
      </p>
    </Link>
  );
}

function StatNum({
  valor,
  label,
  href,
  tone,
}: {
  valor: number;
  label: string;
  href: string;
  tone?: "carmine" | "gold" | "ok" | null;
}) {
  const cor =
    tone === "carmine"
      ? "text-[var(--color-carmine-bright)]"
      : tone === "gold"
        ? "text-[var(--color-ouro-bright)]"
        : tone === "ok"
          ? "text-[var(--color-ok)]"
          : "text-[var(--color-text)]";
  return (
    <Link
      href={href}
      className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius)] px-2 py-1.5 transition-colors hover:bg-[var(--color-surface-2)]"
    >
      <span className={`stat text-3xl ${cor}`}>{valor}</span>
      <span className="text-xs leading-snug text-[var(--color-text-dim)]">{label}</span>
    </Link>
  );
}

/** Bloco de números de uma área (Tarefas, Fiscal...), com título e link. */
function StatGrupo({
  titulo,
  href,
  className,
  largo,
  children,
}: {
  titulo: string;
  href: string;
  className?: string;
  /** 4 números lado a lado (ocupa 2 colunas da grade). */
  largo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "levanta rounded-[var(--radius)] border border-[var(--color-line)] bg-[var(--color-surface-1)] p-3",
        largo && "sm:col-span-2",
        className,
      )}
    >
      <Link
        href={href}
        className="eyebrow mb-1 block px-2 hover:text-[var(--color-ouro-bright)]"
      >
        {titulo}
      </Link>
      <div className={cn("grid grid-cols-2 gap-1", largo && "sm:grid-cols-4")}>
        {children}
      </div>
    </div>
  );
}

/** Dashboard do papel "cliente" — só o que a própria empresa dele expõe. */
async function PainelCliente({
  userId,
  primeiro,
  empresaIdParam,
}: {
  userId: string;
  primeiro: string;
  empresaIdParam?: string;
}) {
  const minhasEmpresas = await empresasDoCliente(userId);

  if (minhasEmpresas.length === 0) {
    return (
      <div className="space-y-6">
        <p className="eyebrow">Área do cliente</p>
        <h1 className="font-display text-3xl font-bold text-[var(--color-text)]">
          Olá, {primeiro}
        </h1>
        <hr className="rule-gold" />
        <Card>
          <CardContent className="py-10 text-center text-sm text-[var(--color-text-dim)]">
            Nenhuma empresa vinculada ao seu acesso ainda. Fale com o escritório
            pelos canais habituais.
          </CardContent>
        </Card>
      </div>
    );
  }

  const empresaAtual: EmpresaClienteItem =
    minhasEmpresas.find((e) => e.id === empresaIdParam) ?? minhasEmpresas[0];

  const fiscalOn = isModuleEnabled("fiscal");
  const [tarefasAguardando, documentos, obrigacoes] = await Promise.all([
    listTarefas({ empresaId: empresaAtual.id, status: "aguardando_cliente" }),
    listDocumentos({ empresaId: empresaAtual.id }),
    fiscalOn
      ? listObrigacoes({ empresaId: empresaAtual.id, status: "abertas" })
      : Promise.resolve([]),
  ]);
  const documentosPendentes = documentos.filter((d) =>
    ["pendente", "correcao"].includes(d.status),
  );

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Área do cliente</p>
        <h1 className="mt-2 font-display text-[1.9rem] font-bold leading-tight tracking-tight text-[var(--color-text)]">
          Olá, {primeiro}.
        </h1>
        <p className="mt-1.5 text-sm text-[var(--color-text-dim)]">
          {empresaAtual.nome_fantasia || empresaAtual.razao_social} ·{" "}
          {formatCNPJ(empresaAtual.cnpj)}
        </p>
      </header>

      {minhasEmpresas.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {minhasEmpresas.map((e) => (
            <Link
              key={e.id}
              href={`/painel?empresa=${e.id}`}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                e.id === empresaAtual.id
                  ? "border-[var(--color-carmine)] bg-[var(--color-carmine-tint)] text-[var(--color-carmine-bright)]"
                  : "border-[var(--color-line)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]",
              )}
            >
              {e.nome_fantasia || e.razao_social}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Aguardando você</CardTitle>
          </CardHeader>
          <CardContent>
            {tarefasAguardando.length === 0 ? (
              <EmptyState
                title="Nada pendente"
                description="Nenhuma tarefa esperando resposta ou documento seu."
              />
            ) : (
              <ul className="divide-y divide-[var(--color-line-soft)]">
                {tarefasAguardando.map((t) => (
                  <li key={t.id} className="py-2.5">
                    <p className="text-sm font-medium text-[var(--color-text)]">
                      {t.titulo}
                    </p>
                    <p className="text-xs text-[var(--color-text-faint)]">
                      {t.prazo ? `Prazo: ${formatData(t.prazo)}` : "Sem prazo definido"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Documentos pendentes</CardTitle>
            <Link
              href={`/documentos?empresa=${empresaAtual.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Enviar documento
            </Link>
          </CardHeader>
          <CardContent>
            {documentosPendentes.length === 0 ? (
              <EmptyState
                title="Tudo em dia"
                description="Nenhum documento pendente de envio ou correção."
              />
            ) : (
              <ul className="divide-y divide-[var(--color-line-soft)]">
                {documentosPendentes.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                    <p className="truncate text-sm font-medium text-[var(--color-text)]">
                      {d.titulo}
                    </p>
                    <Badge tone={d.status === "correcao" ? "warning" : "neutral"}>
                      {DEPARTAMENTO_LABEL[d.departamento]}
                      {d.status === "correcao" ? " · correção" : ""}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {fiscalOn ? (
        <Card>
          <CardHeader>
            <CardTitle>Obrigações fiscais em aberto</CardTitle>
          </CardHeader>
          <CardContent>
            {obrigacoes.length === 0 ? (
              <EmptyState
                title="Nada em aberto"
                description="Nenhuma obrigação fiscal pendente no momento."
              />
            ) : (
              <ul className="divide-y divide-[var(--color-line-soft)]">
                {obrigacoes.slice(0, 8).map((o) => {
                  const d = diasAte(o.vencimento);
                  const atrasada = d != null && d < 0;
                  return (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text)]">
                          {o.descricao || o.tipo.toUpperCase()}
                        </p>
                        <p className="text-xs text-[var(--color-text-faint)]">
                          Vence em {formatData(o.vencimento)}
                        </p>
                      </div>
                      <ObrigacaoStatusBadge status={o.status} atrasada={atrasada} />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default async function PainelPage({
  searchParams,
}: PageProps<"/painel">) {
  const session = await requireSession();
  const staff = isStaff(session.profile.papel);
  const primeiro = session.profile.nome.split(" ")[0];

  if (!staff) {
    const sp = await searchParams;
    const empresaIdParam = paramUuid(sp.empresa);
    return (
      <PainelCliente
        userId={session.userId}
        primeiro={primeiro}
        empresaIdParam={empresaIdParam}
      />
    );
  }

  const fiscalOn = isModuleEnabled("fiscal");
  const pessoalOn = isModuleEnabled("pessoal");
  const contabilOn = isModuleEnabled("contabil");
  const societarioOn = isModuleEnabled("societario");
  const irOn = isModuleEnabled("ir");
  const ehAdmin = session.profile.papel === "admin";
  const [empresas, tarefas, comPrazo, aguardando, historico, diagnostico, fiscal, pessoal, contabil, societario, ir, backup] =
    await Promise.all([
      contarEmpresas(),
      contarTarefas(),
      // Só o que o painel mostra: as 5 de prazo mais próximo e 6 aguardando
      // o cliente (antes buscava até 1000 tarefas para usar 11).
      listTarefas({ status: "abertas", comPrazo: true }, 5),
      listTarefas({ status: "aguardando_cliente" }, 6),
      listarHistorico({ limite: 10 }),
      diagnosticarEmpresas(),
      fiscalOn
        ? contarObrigacoes()
        : Promise.resolve({ abertas: 0, atrasadas: 0, venceSemana: 0 }),
      pessoalOn
        ? contarPessoal()
        : Promise.resolve({
            funcionariosAtivos: 0,
            processosAbertos: 0,
            admissoesMes: 0,
            folhasAbertas: 0,
          }),
      contabilOn
        ? contarContabil()
        : Promise.resolve({ fechamentosAbertos: 0, fechamentosAtrasados: 0, entreguesMes: 0 }),
      societarioOn
        ? contarSocietario()
        : Promise.resolve({ processosAbertos: 0, aguardandoOrgao: 0, concluidosMes: 0 }),
      irOn
        ? contarIr()
        : Promise.resolve({ pendentes: 0, atrasadas: 0, entreguesAno: 0 }),
      // Backup parado é invisível até o dia em que faz falta: o admin vê aqui.
      ehAdmin ? situacaoBackup() : null,
    ]);

  const empresasComPendencia = diagnostico.filter(
    (d) => d.pendencias.length > 0,
  ).length;


  return (
    <div className="space-y-8">
      {backup ? <AvisoBackup situacao={backup} /> : null}
      <header className="relative">
        <Wing className="pointer-events-none absolute -right-4 -top-8 hidden h-32 text-[var(--color-ouro)] opacity-[0.07] sm:block" />
        <p className="eyebrow flex items-center gap-1.5">
          <WingTick className="h-3 w-4" />
          {DATA_LONGA.format(new Date())}
        </p>
        <h1 className="mt-2 font-display text-[1.9rem] font-bold leading-tight tracking-tight text-[var(--color-text)]">
          Bom trabalho, {primeiro}.
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--color-text-dim)]">
          {tarefas.atrasadas > 0 ? (
            <>
              <span className="font-semibold text-[var(--color-carmine-bright)]">
                {tarefas.atrasadas} {tarefas.atrasadas === 1 ? "tarefa atrasada" : "tarefas atrasadas"}
              </span>
              {" · "}
            </>
          ) : null}
          {tarefas.abertas} abertas · {tarefas.aguardandoCliente} aguardando
          cliente · {empresas.ativas} empresas ativas
        </p>
      </header>

      <section>
        <p className="eyebrow mb-3">Parede de prazos</p>
        {comPrazo.length === 0 ? (
          <EmptyState
            title="Nenhum prazo à vista"
            description="Nenhuma tarefa aberta com prazo definido."
          />
        ) : (
          <div className="flex flex-wrap gap-3">
            {comPrazo.map((t, i) => (
              <PrazoTile key={t.id} t={t} index={i} />
            ))}
          </div>
        )}
      </section>

      <section className="cascata grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatGrupo titulo="Tarefas" href="/tarefas" largo>
          <StatNum valor={tarefas.abertas} label="abertas" href="/tarefas" />
          <StatNum
            valor={tarefas.atrasadas}
            label="atrasadas"
            href="/tarefas"
            tone={tarefas.atrasadas > 0 ? "carmine" : null}
          />
          <StatNum
            valor={tarefas.aguardandoCliente}
            label="aguardando cliente"
            href="/tarefas"
            tone={tarefas.aguardandoCliente > 0 ? "gold" : null}
          />
          <StatNum
            valor={tarefas.concluidasMes}
            label="concluídas no mês"
            href="/tarefas"
            tone={tarefas.concluidasMes > 0 ? "ok" : null}
          />
        </StatGrupo>
        <StatGrupo titulo="Empresas" href="/empresas">
          <StatNum valor={empresas.ativas} label="ativas" href="/empresas" />
          <StatNum
            valor={empresasComPendencia}
            label="com pendência"
            href="/empresas"
            tone={empresasComPendencia > 0 ? "gold" : null}
          />
        </StatGrupo>
        {fiscalOn ? (
          <StatGrupo titulo="Fiscal" href="/fiscal">
            <StatNum
              valor={fiscal.atrasadas}
              label="obrigações atrasadas"
              href="/fiscal"
              tone={fiscal.atrasadas > 0 ? "carmine" : null}
            />
            <StatNum
              valor={fiscal.venceSemana}
              label="vencem esta semana"
              href="/fiscal"
              tone={fiscal.venceSemana > 0 ? "gold" : null}
            />
          </StatGrupo>
        ) : null}
        {pessoalOn ? (
          <StatGrupo titulo="Dep. Pessoal" href="/pessoal">
            <StatNum
              valor={pessoal.funcionariosAtivos}
              label="funcionários ativos"
              href="/pessoal/funcionarios"
            />
            <StatNum
              valor={pessoal.processosAbertos}
              label="processos abertos"
              href="/pessoal/processos"
              tone={pessoal.processosAbertos > 0 ? "gold" : null}
            />
          </StatGrupo>
        ) : null}
        {contabilOn ? (
          <StatGrupo titulo="Contábil" href="/contabil">
            <StatNum
              valor={contabil.fechamentosAtrasados}
              label="fechamentos atrasados"
              href="/contabil"
              tone={contabil.fechamentosAtrasados > 0 ? "carmine" : null}
            />
            <StatNum
              valor={contabil.entreguesMes}
              label="entregues no mês"
              href="/contabil"
              tone={contabil.entreguesMes > 0 ? "ok" : null}
            />
          </StatGrupo>
        ) : null}
        {societarioOn ? (
          <StatGrupo titulo="Societário" href="/societario">
            <StatNum
              valor={societario.processosAbertos}
              label="processos abertos"
              href="/societario"
              tone={societario.processosAbertos > 0 ? "gold" : null}
            />
            <StatNum
              valor={societario.aguardandoOrgao}
              label="aguardando órgão"
              href="/societario"
            />
          </StatGrupo>
        ) : null}
        {irOn ? (
          <StatGrupo titulo="Imposto de Renda" href="/ir">
            <StatNum
              valor={ir.atrasadas}
              label="declarações atrasadas"
              href="/ir"
              tone={ir.atrasadas > 0 ? "carmine" : null}
            />
            <StatNum
              valor={ir.entreguesAno}
              label="entregues neste ano"
              href="/ir"
              tone={ir.entreguesAno > 0 ? "ok" : null}
            />
          </StatGrupo>
        ) : null}
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Empresas que precisam de atenção</CardTitle>
          {empresasComPendencia > 0 ? (
            <span className="rounded-full bg-[var(--color-carmine-tint)] px-2 py-0.5 text-xs font-medium text-[var(--color-carmine-bright)]">
              {empresasComPendencia}
            </span>
          ) : null}
        </CardHeader>
        <CardContent>
          <AtencaoList dados={diagnostico} limite={6} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Aguardando o cliente</CardTitle>
          </CardHeader>
          <CardContent>
            {aguardando.length === 0 ? (
              <EmptyState
                title="Nada pendente com clientes"
                description="Nenhuma tarefa parada esperando documento ou resposta."
              />
            ) : (
              <ul className="divide-y divide-[var(--color-line-soft)]">
                {aguardando.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <Link
                      href={`/tarefas/${t.id}`}
                      className="flex-1 truncate text-sm text-[var(--color-text)] hover:text-[var(--color-carmine-bright)]"
                    >
                      {t.titulo}
                    </Link>
                    <span className="truncate text-xs text-[var(--color-text-faint)]">
                      {empresaNome(t)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <History className="size-4 text-[var(--color-ouro)]" />
            <CardTitle>Atividades recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <HistoricoList itens={historico} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
