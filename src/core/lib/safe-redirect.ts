/**
 * Sanitiza o destino de redirecionamento pós-login (`?next=`).
 * Sem isso, um link tipo `/login?next=https://site-falso.com` manda o
 * usuário pro site errado logo depois de um login legítimo (open redirect
 * usado em phishing). Só aceita caminho interno começando com uma única
 * barra — rejeita `//host`, `/\host` (o navegador normaliza `\` para `/`)
 * e qualquer coisa com esquema (`http:`, `javascript:` etc.).
 */
export function safeNextPath(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  // Navegadores ignoram tab/CR/LF ao interpretar uma URL — remove antes de
  // checar, senão "/\t/evil.com" escaparia do filtro de "//" abaixo.
  const cleaned = v.replace(/[\t\r\n]/g, "");
  if (!cleaned.startsWith("/")) return "/painel";
  if (/^\/[\\/]/.test(cleaned)) return "/painel";
  return cleaned;
}
