import Link from "next/link";
import { DatabaseBackup, TriangleAlert } from "lucide-react";

import type { BackupRow } from "@/core/db/types";
import { formatDataHora } from "@/core/lib/format";
import { Badge, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/core/ui";

import type { SituacaoBackup } from "../backups";

function tamanho(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2).replace(".", ",")} GB`;
}

function Situacao({ b }: { b: BackupRow }) {
  if (!b.concluido_em) return <Badge tone="info">Em andamento</Badge>;
  if (!b.sucesso) return <Badge tone="danger">Falhou</Badge>;
  if (!b.verificado) return <Badge tone="warning">Sem ensaio</Badge>;
  return <Badge tone="success">OK · restauração testada</Badge>;
}

/** Aba Administração > Backup. */
export function BackupsPanel({
  backups,
  situacao,
}: {
  backups: BackupRow[];
  situacao: SituacaoBackup;
}) {
  if (!situacao.monitorado) {
    return (
      <EmptyState
        title="Nenhum backup registrado"
        description="Na instalação do escritório, ligue o backup automático com scripts\instalar-backup.ps1 (passo a passo no docs\instalacao-servidor.md, seção 8). Na versão em nuvem, o backup é feito pelo próprio Supabase."
      />
    );
  }

  return (
    <div className="space-y-4">
      {situacao.alerta ? <AvisoBackup situacao={situacao} comLink={false} /> : null}
      <p className="text-sm text-[var(--color-text-dim)]">
        Todo dia o servidor copia o banco, os documentos e a configuração para{" "}
        <span className="font-medium text-[var(--color-text)]">
          {situacao.ultimo?.destino ?? "o destino configurado"}
        </span>{" "}
        e, antes de dar o backup como bom, <strong className="text-[var(--color-text)]">ensaia a restauração</strong>{" "}
        num banco temporário e confere se tudo voltou.
        {situacao.ultimoBom ? (
          <>
            {" "}
            Último backup completo:{" "}
            <strong className="text-[var(--color-text)]">
              {formatDataHora(situacao.ultimoBom.iniciado_em)}
            </strong>
            .
          </>
        ) : null}
      </p>
      <Table>
        <THead>
          <TR>
            <TH>Quando</TH>
            <TH>Situação</TH>
            <TH>Tamanho</TH>
            <TH>Detalhe</TH>
          </TR>
        </THead>
        <TBody>
          {backups.map((b) => (
            <TR key={b.id}>
              <TD className="whitespace-nowrap text-xs">{formatDataHora(b.iniciado_em)}</TD>
              <TD className="whitespace-nowrap">
                <Situacao b={b} />
              </TD>
              <TD className="data whitespace-nowrap text-xs">{tamanho(b.tamanho_bytes)}</TD>
              <TD className="text-xs text-[var(--color-text-dim)]">{b.detalhe ?? "—"}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

/** Faixa de aviso (painel do admin e topo da aba Backup). */
export function AvisoBackup({
  situacao,
  comLink = true,
}: {
  situacao: SituacaoBackup;
  comLink?: boolean;
}) {
  if (!situacao.alerta) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--color-carmine)] bg-[var(--color-carmine-tint)] px-4 py-3 text-sm"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[var(--color-carmine-bright)]" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold text-[var(--color-text)]">Backup precisa de atenção</p>
        <p className="break-words text-[var(--color-text-dim)]">{situacao.alerta}</p>
      </div>
      {comLink ? (
        <Link
          href="/administracao?aba=backup"
          className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-[var(--color-carmine-bright)] hover:underline"
        >
          <DatabaseBackup className="size-4" />
          Ver backups
        </Link>
      ) : null}
    </div>
  );
}
