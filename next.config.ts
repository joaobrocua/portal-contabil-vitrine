import type { NextConfig } from "next";

/**
 * Origem do Supabase (self-hosted local ou cloud) lida do próprio .env do
 * deploy — cada instalação (nuvem, escritório) aponta pro seu servidor, daí
 * ler em vez de fixar um valor aqui.
 */
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

/**
 * Baseline de cabeçalhos de segurança (defesa em profundidade — hoje não
 * existe nenhum vetor de XSS/injeção ativo no app, mas isso blinda contra
 * regressões futuras: clickjacking, MIME-sniffing, carregamento de script
 * de outra origem). CSP com 'unsafe-inline' em script/style porque o Next
 * (hidratação) e o Tailwind (estilo inline em alguns componentes) ainda
 * não usam nonce — dá pra apertar mais adicionando infraestrutura de nonce
 * depois, se fizer sentido.
 */
// 'unsafe-eval' só no `next dev`: o React usa eval() em desenvolvimento
// (reconstrução de call stack) e sem isso o overlay do Next mostra "1 Issue"
// o tempo todo. Em produção o React nunca usa eval — lá o CSP segue estrito.
const scriptEval = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${scriptEval}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  "font-src 'self' data:",
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Não anuncia "X-Powered-By: Next.js" em toda resposta.
  poweredByHeader: false,
  // Pasta do build. Normalmente `.next`; o script de atualização do
  // servidor do escritório compila a versão nova em outra pasta enquanto a atual
  // continua no ar, e só troca as pastas no fim — parada de segundos.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
