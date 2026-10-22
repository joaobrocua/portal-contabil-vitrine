/**
 * Stub de `server-only` para os testes.
 *
 * O pacote `server-only` não existe no node_modules: o Next resolve esse
 * specifier internamente durante o build. Sob o Vitest a importação
 * quebraria, então `vitest.config.ts` aponta o alias para este módulo vazio.
 */
export {};
