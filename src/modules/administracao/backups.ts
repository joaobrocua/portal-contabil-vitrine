import "server-only";

import { requireRole } from "@/core/auth/session";
import { createSupabaseAdminClient } from "@/core/db/admin";
import type { BackupRow } from "@/core/db/types";

/**
 * Execuções do backup diário (tabela `backups`, gravada pelo
 * scripts\backup-sistema.ps1 da instalação do escritório). A tabela não tem
 * policy — só a service role lê —, então a checagem de admin fica aqui.
 *
 * Na nuvem a tabela fica vazia (o Supabase Cloud faz o próprio backup):
 * sem nenhum registro, não há aviso nenhum.
 */

/** Depois disso sem um backup bom, o painel do admin avisa. */
export const BACKUP_ATRASADO_HORAS = 36;

export async function listarBackups(limite = 60): Promise<BackupRow[]> {
  await requireRole("admin");
  const { data, error } = await createSupabaseAdminClient()
    .from("backups")
    .select("*")
    .order("iniciado_em", { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface SituacaoBackup {
  /** Nunca houve registro (nuvem, ou backup ainda não instalado). */
  monitorado: boolean;
  ultimoBom: BackupRow | null;
  ultimo: BackupRow | null;
  /** Texto do problema, se houver algo a avisar. */
  alerta: string | null;
}

export function avaliarBackups(
  ultimo: BackupRow | null,
  ultimoBom: BackupRow | null,
  agora: Date = new Date(),
): SituacaoBackup {
  if (!ultimo) return { monitorado: false, ultimoBom: null, ultimo: null, alerta: null };

  let alerta: string | null = null;
  if (!ultimoBom) {
    alerta = "Nenhum backup completo (com ensaio de restauração) foi concluído ainda.";
  } else {
    const horas = (agora.getTime() - new Date(ultimoBom.iniciado_em).getTime()) / 3_600_000;
    if (horas > BACKUP_ATRASADO_HORAS) {
      const dias = Math.floor(horas / 24);
      alerta = `O último backup completo foi há ${dias} ${dias === 1 ? "dia" : "dias"}.`;
    }
  }
  if (!ultimo.sucesso && ultimo.concluido_em) {
    alerta = `${alerta ? alerta + " " : ""}A última tentativa falhou: ${ultimo.detalhe ?? "sem detalhe"}`;
  }
  return { monitorado: true, ultimoBom, ultimo, alerta };
}

/** Para o painel do admin: a última execução e a última completa. */
export async function situacaoBackup(): Promise<SituacaoBackup> {
  await requireRole("admin");
  const admin = createSupabaseAdminClient();
  const [ultimo, ultimoBom] = await Promise.all([
    admin.from("backups").select("*").order("iniciado_em", { ascending: false }).limit(1).maybeSingle(),
    admin
      .from("backups")
      .select("*")
      .eq("sucesso", true)
      .eq("verificado", true)
      .order("iniciado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (ultimo.error) throw new Error(ultimo.error.message);
  return avaliarBackups(ultimo.data, ultimoBom.data);
}
