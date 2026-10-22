/**
 * Identidade visual do produto.
 * Ajuste aqui (nome, cores, logo) e o app inteiro acompanha.
 */
export const brand = {
  nome: "Portal Contábil",
  nomeCurto: "Portal",
  telefones: [] as string[],
  // Cores (também espelhadas em globals.css como CSS vars)
  cores: {
    primaria: "#2f6fe4",
    primariaHover: "#1f55b8",
    dourado: "#c98a1a",
    douradoClaro: "#e8b04b",
  },
  /**
   * Arte oficial da marca. Coloque um arquivo em `public/` e aponte aqui
   * (ex.: "/logo.png"). `null` usa a marca vetorial de `core/ui/logo.tsx`.
   * Usada no ícone pequeno (cabeçalho/sidebar, ~32px) — por isso pede uma
   * arte quadrada e legível nesse tamanho. Para uma logo com texto/detalhe
   * (cartão, papelaria), use `logoCompletaFile` em vez desta.
   */
  logoFile: null as string | null,
  logoFileDark: null as string | null,
  logoTemFundoEscuro: false,
  /**
   * Logo completa (com o nome escrito) — tela de login e topo do menu
   * lateral. Precisa de fundo transparente: aparece sobre o tema escuro.
   */
  logoCompletaFile: null as string | null,
} as const;

export type Brand = typeof brand;
