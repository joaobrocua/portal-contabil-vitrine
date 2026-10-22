import type { MetadataRoute } from "next";

import { brand } from "@/core/config/brand";

/**
 * Manifesto do app: nome, ícone e cores que o navegador usa quando o
 * sistema abre como janela própria (atalho da área de trabalho).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.nome,
    short_name: brand.nomeCurto,
    description: "Portal de gestão do escritório",
    start_url: "/painel",
    scope: "/",
    display: "standalone",
    background_color: "#0f1419",
    theme_color: "#0f1419",
    lang: "pt-BR",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
