"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";

import { cn } from "@/core/lib/cn";

import { buttonVariants } from "./button";
import { Input } from "./input";

/**
 * Filtros de lista guardados no endereço (?status=…&busca=…): o servidor
 * filtra e pagina, e o link pode ser copiado/voltado com o botão do
 * navegador. Mudar um filtro volta para a página 1.
 */
export function useFiltroUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [carregando, start] = useTransition();

  function definir(mudancas: Record<string, string | null | undefined>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(mudancas)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    p.delete("pagina");
    const qs = p.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return {
    valor: (k: string, padrao = "") => params.get(k) ?? padrao,
    definir,
    carregando,
  };
}

export type Filtros = ReturnType<typeof useFiltroUrl>;

/**
 * Mesma interface do useFiltroUrl, escolhendo o modo: no endereço (lista
 * paginada no servidor) ou só no navegador (lista pequena, já inteira na
 * tela — ex.: funcionários dentro da ficha da empresa).
 */
export function useFiltros(noEndereco: boolean, iniciais: Record<string, string> = {}): Filtros {
  const url = useFiltroUrl();
  const [local, setLocal] = useState(iniciais);
  if (noEndereco) return url;
  return {
    valor: (k, padrao = "") => local[k] ?? padrao,
    definir: (mudancas) =>
      setLocal((atual) => {
        const novo = { ...atual };
        for (const [k, v] of Object.entries(mudancas)) {
          if (v) novo[k] = v;
          else delete novo[k];
        }
        return novo;
      }),
    carregando: false,
  };
}

/** Campo de busca que atualiza o endereço sozinho, 400 ms depois de parar de digitar. */
export function BuscaUrl({
  placeholder,
  nome = "busca",
  className,
  filtros,
}: {
  placeholder: string;
  nome?: string;
  className?: string;
  /** De useFiltros; sem ele, a busca vai para o endereço. */
  filtros?: Filtros;
}) {
  const url = useFiltroUrl();
  const { valor, definir, carregando } = filtros ?? url;
  const [texto, setTexto] = useState(valor(nome));
  const atual = valor(nome);

  useEffect(() => {
    // Só age se o texto digitado for diferente do que já está no endereço —
    // assim abrir a página (ou o React rodar o efeito duas vezes em
    // desenvolvimento) não dispara uma busca à toa, que voltaria à página 1.
    if (texto.trim() === atual.trim()) return;
    const t = setTimeout(() => definir({ [nome]: texto.trim() || null }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só o texto dispara
  }, [texto]);

  return (
    <div className={cn("relative min-w-[200px] flex-1", className)}>
      {carregando ? (
        <Loader2 className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-neutral-400" />
      ) : (
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
      )}
      <Input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={placeholder}
        className="pl-8"
        aria-label={placeholder}
      />
    </div>
  );
}

/** "Mostrando 51–100 de 4.547" + Anterior / Próxima. */
export function Paginacao({
  total,
  pagina,
  tamanho,
  nomeItem = "itens",
}: {
  total: number;
  pagina: number;
  tamanho: number;
  nomeItem?: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const paginas = Math.max(1, Math.ceil(total / tamanho));
  const inicio = total === 0 ? 0 : (pagina - 1) * tamanho + 1;
  const fim = Math.min(pagina * tamanho, total);
  const fmt = (n: number) => n.toLocaleString("pt-BR");

  const href = (p: number) => {
    const q = new URLSearchParams(params.toString());
    if (p <= 1) q.delete("pagina");
    else q.set("pagina", String(p));
    const s = q.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  if (total <= tamanho && pagina === 1) {
    return (
      <p className="text-xs text-[var(--color-text-faint)]">
        {fmt(total)} {nomeItem}
      </p>
    );
  }

  const botao = (desabilitado: boolean) =>
    cn(buttonVariants({ variant: "outline", size: "sm" }), desabilitado && "pointer-events-none opacity-40");

  return (
    <nav className="flex flex-wrap items-center justify-between gap-2" aria-label="Paginação">
      <p className="text-xs text-[var(--color-text-faint)]">
        Mostrando {fmt(inicio)}–{fmt(fim)} de {fmt(total)} {nomeItem}
      </p>
      <div className="flex items-center gap-2">
        <Link href={href(pagina - 1)} className={botao(pagina <= 1)} aria-disabled={pagina <= 1} scroll={false}>
          <ChevronLeft className="size-4" /> Anterior
        </Link>
        <span className="text-xs text-[var(--color-text-dim)]">
          {pagina} / {fmt(paginas)}
        </span>
        <Link href={href(pagina + 1)} className={botao(pagina >= paginas)} aria-disabled={pagina >= paginas} scroll={false}>
          Próxima <ChevronRight className="size-4" />
        </Link>
      </div>
    </nav>
  );
}
