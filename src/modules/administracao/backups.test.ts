import { describe, expect, it } from "vitest";

import type { BackupRow } from "@/core/db/types";

import { avaliarBackups } from "./backups";

const AGORA = new Date("2026-09-25T12:00:00Z");
const horasAtras = (h: number) => new Date(AGORA.getTime() - h * 3_600_000).toISOString();

function backup(p: Partial<BackupRow>): BackupRow {
  return {
    id: "b",
    iniciado_em: horasAtras(10),
    concluido_em: horasAtras(10),
    sucesso: true,
    verificado: true,
    destino: "E:\\Backups",
    tamanho_bytes: 1000,
    detalhe: null,
    ...p,
  };
}

describe("avaliarBackups", () => {
  it("sem nenhum registro (nuvem, ou backup não instalado): não monitora nem avisa", () => {
    expect(avaliarBackups(null, null, AGORA)).toEqual({
      monitorado: false,
      ultimoBom: null,
      ultimo: null,
      alerta: null,
    });
  });

  it("backup completo recente: sem aviso", () => {
    const b = backup({});
    const s = avaliarBackups(b, b, AGORA);
    expect(s.monitorado).toBe(true);
    expect(s.alerta).toBeNull();
  });

  it("último backup completo há mais de 36h: avisa em dias", () => {
    const b = backup({ iniciado_em: horasAtras(60) });
    expect(avaliarBackups(b, b, AGORA).alerta).toBe("O último backup completo foi há 2 dias.");
  });

  it("última tentativa falhou: avisa com o motivo, mesmo com um backup bom recente", () => {
    const bom = backup({ iniciado_em: horasAtras(20) });
    const falha = backup({ sucesso: false, verificado: false, detalhe: "HD desconectado" });
    expect(avaliarBackups(falha, bom, AGORA).alerta).toBe("A última tentativa falhou: HD desconectado");
  });

  it("nunca houve backup completo (só com falha ou sem ensaio): avisa", () => {
    const semEnsaio = backup({ verificado: false });
    expect(avaliarBackups(semEnsaio, null, AGORA).alerta).toMatch(/Nenhum backup completo/);
  });

  it("backup em andamento não conta como falha", () => {
    const bom = backup({ iniciado_em: horasAtras(24) });
    const rodando = backup({ iniciado_em: horasAtras(0.1), concluido_em: null, sucesso: false, verificado: false });
    expect(avaliarBackups(rodando, bom, AGORA).alerta).toBeNull();
  });
});
