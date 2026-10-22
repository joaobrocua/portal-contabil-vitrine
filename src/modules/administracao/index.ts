/** Módulo Administração do Sistema — API pública. */

export { getConfig, listCatalogos } from "./queries";
export { ConfigForm } from "./components/config-form";
export { CatalogosPanel } from "./components/catalogos-panel";
export {
  listarBackups,
  situacaoBackup,
  avaliarBackups,
  BACKUP_ATRASADO_HORAS,
  type SituacaoBackup,
} from "./backups";
export { BackupsPanel, AvisoBackup } from "./components/backups-panel";
