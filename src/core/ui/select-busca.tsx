"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/core/lib/cn";
import { formatCNPJ } from "@/core/lib/format";
import type { EmpresaOpcao } from "@/core/types/empresa-opcao";

import { fieldBase } from "./input";

export interface OpcaoBusca {
  value: string;
  label: string;
  /** Linha menor abaixo do nome (ex.: CNPJ). */
  detalhe?: string;
  /** Texto extra que também entra na busca (ex.: razão social + CNPJ só com números). */
  busca?: string;
}

/** Sem acento e sem maiúsculas, para "acucar" achar "Açúcar". */
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Lista suspensa com campo de busca — no lugar do <select> quando há muitas
 * opções (empresas). Digite parte do nome (ou do CNPJ) e a lista filtra;
 * setas + Enter escolhem; Esc fecha. O valor escolhido vai num campo oculto
 * com o `name` dado, então funciona em qualquer formulário como um <select>.
 */
export function SelectBusca({
  id,
  name,
  opcoes,
  defaultValue = "",
  vazioLabel,
  placeholder = "Digite para buscar…",
  required,
  disabled,
  className,
}: {
  id?: string;
  name: string;
  opcoes: OpcaoBusca[];
  defaultValue?: string;
  /** Rótulo da opção "nenhum" (valor vazio), ex.: "— nenhuma —". Sem isso, não há opção vazia. */
  vazioLabel?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const idLista = useId();
  const rotuloDe = (v: string) =>
    v === "" ? "" : (opcoes.find((o) => o.value === v)?.label ?? "");

  const [valor, setValor] = useState(defaultValue);
  const [texto, setTexto] = useState(rotuloDe(defaultValue));
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  // Só filtra depois que a pessoa digita: ao abrir com uma empresa já
  // escolhida, a lista aparece inteira (senão só veria a própria escolhida).
  const [digitou, setDigitou] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const caixa = useRef<HTMLDivElement>(null);

  const visiveis = useMemo(() => {
    const termo = digitou ? normalizar(texto.trim()) : "";
    const todas: OpcaoBusca[] = vazioLabel ? [{ value: "", label: vazioLabel }, ...opcoes] : opcoes;
    if (!termo) return todas;
    // Número (CNPJ, com ou sem pontos e barra) compara só os dígitos.
    const soDigitos = /^[\d.\-/\s]+$/.test(termo) ? termo.replace(/\D/g, "") : "";
    return todas.filter(
      (o) =>
        o.value !== "" &&
        (normalizar(`${o.label} ${o.busca ?? ""}`).includes(termo) ||
          (soDigitos !== "" && (o.busca ?? "").replace(/\D/g, "").includes(soDigitos))),
    );
  }, [opcoes, texto, digitou, vazioLabel]);

  // Obrigatório: enquanto nada foi escolhido da lista, o navegador barra o envio com o aviso.
  useEffect(() => {
    campo.current?.setCustomValidity(required && !valor ? "Escolha uma opção da lista." : "");
  }, [required, valor]);

  // Formulário limpo (reset) volta ao valor inicial.
  useEffect(() => {
    const form = campo.current?.form;
    if (!form) return;
    const aoLimpar = () => {
      setValor(defaultValue);
      setTexto(rotuloDe(defaultValue));
      setDigitou(false);
    };
    form.addEventListener("reset", aoLimpar);
    return () => form.removeEventListener("reset", aoLimpar);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só o valor inicial importa
  }, [defaultValue]);

  // Clique fora fecha e devolve o texto da escolha atual.
  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent) {
      if (!caixa.current?.contains(e.target as Node)) fechar();
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fechar só lê o estado atual
  }, [aberto, valor]);

  function fechar() {
    setAberto(false);
    setDigitou(false);
    // Texto solto que não é uma opção volta ao que estava escolhido.
    setTexto(rotuloDe(valor));
  }

  function escolher(o: OpcaoBusca) {
    setValor(o.value);
    setTexto(o.value === "" ? "" : o.label);
    setAberto(false);
    setDigitou(false);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAberto(true);
      setAtivo((i) => Math.min(i + 1, visiveis.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && aberto) {
      e.preventDefault(); // Enter escolhe; não envia o formulário
      const o = visiveis[ativo];
      if (o) escolher(o);
    } else if (e.key === "Escape" && aberto) {
      e.preventDefault();
      e.stopPropagation();
      fechar();
    }
  }

  const rotuloVazio = vazioLabel && valor === "" && !digitou ? vazioLabel : "";

  return (
    <div ref={caixa} className="relative">
      <input
        ref={campo}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={aberto && visiveis[ativo] ? `${idLista}-${ativo}` : undefined}
        autoComplete="off"
        disabled={disabled}
        required={required}
        value={texto}
        placeholder={rotuloVazio || placeholder}
        onFocus={() => {
          setAberto(true);
          setAtivo(0);
        }}
        onClick={() => setAberto(true)}
        onChange={(e) => {
          setTexto(e.target.value);
          setDigitou(true);
          setAberto(true);
          setAtivo(0);
          // Apagou tudo: vale "nenhuma" (se existe) ou fica sem escolha.
          if (e.target.value === "") setValor("");
        }}
        onKeyDown={aoTeclar}
        onBlur={(e) => {
          // Tab para outro campo: fecha (clicar numa opção não passa por aqui).
          if (!caixa.current?.contains(e.relatedTarget as Node | null)) fechar();
        }}
        className={cn(fieldBase, "pr-8", className)}
      />
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-faint)]" />
      {!disabled ? <input type="hidden" name={name} value={valor} /> : null}
      {aberto ? (
        <ul
          id={idLista}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-[var(--radius)] border border-[var(--color-line)] bg-[var(--color-surface-2)] py-1 shadow-lg"
        >
          {visiveis.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[var(--color-text-dim)]">Nenhum resultado.</li>
          ) : (
            visiveis.map((o, i) => (
              <li
                key={o.value || "__vazio"}
                id={`${idLista}-${i}`}
                role="option"
                aria-selected={o.value === valor}
                onMouseDown={(e) => {
                  e.preventDefault(); // não tira o foco do campo antes de escolher
                  escolher(o);
                }}
                onMouseEnter={() => setAtivo(i)}
                className={cn(
                  "cursor-pointer px-3 py-1.5 text-sm",
                  i === ativo && "bg-[var(--color-surface-3)]",
                  o.value === valor && "text-[var(--color-carmine-bright)]",
                )}
              >
                <span className="block truncate text-[var(--color-text)]">{o.label}</span>
                {o.detalhe ? (
                  <span className="data block truncate text-xs text-[var(--color-text-faint)]">
                    {o.detalhe}
                  </span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

/** SelectBusca já preparado para a lista de empresas (nome, razão social e CNPJ). */
export function SelectEmpresa({
  empresas,
  ...props
}: { empresas: EmpresaOpcao[] } & Omit<Parameters<typeof SelectBusca>[0], "opcoes">) {
  const opcoes = useMemo<OpcaoBusca[]>(
    () =>
      empresas.map((e) => ({
        value: e.id,
        label: e.nome,
        detalhe: formatCNPJ(e.cnpj),
        busca: `${e.razao} ${e.cnpj}`,
      })),
    [empresas],
  );
  return <SelectBusca {...props} opcoes={opcoes} placeholder={props.placeholder ?? "Digite o nome ou CNPJ…"} />;
}
