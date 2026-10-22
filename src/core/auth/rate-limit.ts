import "server-only";

import { headers } from "next/headers";

import { createSupabaseAdminClient } from "@/core/db/admin";

/**
 * Limite de tentativas — item 7 do checklist de segurança (proteção contra
 * abusos). Usa a tabela `eventos_seguranca` só pela service role: nunca é
 * lida/gravada pelo navegador, então uma checagem que falhar (rede, chave
 * ausente etc.) precisa deixar o usuário legítimo passar — o objetivo é
 * atrapalhar automação, não virar um novo jeito de derrubar o sistema.
 */

/**
 * Quantos proxies CONFIÁVEIS ficam entre o navegador e este servidor. Cada
 * proxy acrescenta ao FIM de `x-forwarded-for` o IP de quem conectou nele,
 * então o IP real do cliente é o item `hops` posições antes do fim; tudo à
 * esquerda disso o próprio cliente pode forjar.
 *
 * - Vercel: 1 (detectado sozinho pela variável `VERCEL`).
 * - Servidor do escritório, acessado direto (sem proxy): 0 — não existe IP
 *   confiável nos cabeçalhos, então o limite por IP fica desligado e só vale
 *   o limite por e-mail. Se um dia houver um proxy na frente, defina
 *   `TRUSTED_PROXY_HOPS` com a quantidade.
 */
export function saltosConfiaveis(): number {
  const bruto = process.env.TRUSTED_PROXY_HOPS;
  if (bruto !== undefined && bruto.trim() !== "") {
    const n = Number(bruto);
    return Number.isInteger(n) && n >= 0 ? n : 0;
  }
  return process.env.VERCEL ? 1 : 0;
}

/**
 * IP do request atual, ou null quando não há como saber com segurança
 * (sem proxy confiável, cabeçalho curto demais, ou fora de um request).
 * Sem proxy confiável, `x-forwarded-for` e `x-real-ip` são texto livre do
 * cliente: aceitá-los deixaria qualquer um trocar de "IP" a cada tentativa
 * e escapar do limite.
 */
export async function clientIp(): Promise<string | null> {
  try {
    const hops = saltosConfiaveis();
    if (hops === 0) return null;
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    if (!fwd) return null;
    const ips = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    return ips.length >= hops ? ips[ips.length - hops] : null;
  } catch {
    return null;
  }
}

async function contar(
  tipo: string,
  coluna: "chave" | "ip",
  valor: string,
  minutos: number,
  apenasFalhas: boolean,
): Promise<number> {
  try {
    const admin = createSupabaseAdminClient();
    const desde = new Date(Date.now() - minutos * 60_000).toISOString();
    let q = admin
      .from("eventos_seguranca")
      .select("id", { count: "exact", head: true })
      .eq("tipo", tipo)
      .eq(coluna, valor)
      .gte("created_at", desde);
    if (apenasFalhas) q = q.eq("sucesso", false);
    const { count, error } = await q;
    if (error) console.error("[rate-limit] contagem falhou (limite NÃO aplicado):", error.message);
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Registra uma tentativa (best-effort — nunca derruba a ação principal).
 * Devolve o id do evento, para quem registra ANTES de saber o resultado
 * poder marcá-lo como sucesso depois (`confirmarSucesso`).
 */
export async function registrarEvento(
  tipo: string,
  chave: string,
  sucesso: boolean,
  ip: string | null,
): Promise<string | null> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("eventos_seguranca")
      .insert({ tipo, chave, sucesso, ip })
      .select("id")
      .maybeSingle();
    if (error) console.error("[rate-limit] evento não gravado:", error.message);
    return data?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Apaga uma tentativa registrada só para reservar a vaga na contagem. Usado
 * quando o pedido é recusado pelo limite: tentativa bloqueada não pode
 * renovar a janela, senão quem continua tentando (ou um atacante que repete
 * a cada poucos minutos) mantém a conta bloqueada para sempre.
 */
export async function descartarEvento(id: string | null): Promise<void> {
  if (!id) return;
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("eventos_seguranca").delete().eq("id", id);
  } catch {
    // best-effort
  }
}

/** Marca como bem-sucedida uma tentativa registrada antes com `sucesso: false`. */
export async function confirmarSucesso(id: string | null): Promise<void> {
  if (!id) return;
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("eventos_seguranca").update({ sucesso: true }).eq("id", id);
  } catch {
    // best-effort
  }
}

/**
 * true = limite excedido, a ação deve ser recusada.
 * `apenasFalhas`: para login, só tentativa que deu errado conta (não pune
 * quem eventualmente acerta a senha); para ações já autenticadas (ex.
 * criar usuário), conta toda tentativa — o que importa ali é o volume.
 */
export async function limiteExcedido(opts: {
  tipo: string;
  chave: string;
  maxPorChave: number;
  janelaMinutos: number;
  apenasFalhas?: boolean;
  ip?: string | null;
  maxPorIp?: number;
}): Promise<boolean> {
  const apenasFalhas = opts.apenasFalhas ?? true;

  const porChave = await contar(opts.tipo, "chave", opts.chave, opts.janelaMinutos, apenasFalhas);
  if (porChave >= opts.maxPorChave) return true;

  if (opts.ip && opts.maxPorIp) {
    const porIp = await contar(opts.tipo, "ip", opts.ip, opts.janelaMinutos, apenasFalhas);
    if (porIp >= opts.maxPorIp) return true;
  }

  return false;
}
