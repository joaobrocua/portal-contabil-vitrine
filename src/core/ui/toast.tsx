"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { cn } from "@/core/lib/cn";

/**
 * Aviso rápido (toast). Existe especificamente pra controles que disparam
 * uma action sem formulário em volta — um <select> de status, um checkbox
 * de item de checklist, o "x" de remover sócio/contato — onde não tem
 * onde renderizar `state.error` como nos formulários (useActionState).
 * Antes, esses controles simplesmente descartavam o erro (`.then(() =>
 * {})`): a ação falhava e a tela continuava exatamente igual, sem nenhum
 * sinal pro usuário de que nada mudou.
 */

interface Toast {
  id: number;
  mensagem: string;
  tipo: "erro" | "sucesso";
}

interface ToastContextValue {
  notify: (mensagem: string, tipo?: Toast["tipo"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let proximoId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((atual) => atual.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (mensagem: string, tipo: Toast["tipo"] = "erro") => {
      const id = proximoId++;
      setToasts((atual) => [...atual, { id, mensagem, tipo }]);
      const timer = setTimeout(() => dismiss(id), 6000);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const mapaAtual = timers.current;
    return () => {
      for (const timer of mapaAtual.values()) clearTimeout(timer);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={cn(
              "toast-entra pointer-events-auto flex max-w-sm items-start gap-2 rounded-[var(--radius)] border px-4 py-3 text-sm shadow-lg",
              t.tipo === "erro"
                ? "border-[var(--color-carmine)] bg-[var(--color-carmine-tint)] text-[var(--color-carmine-bright)]"
                : "border-[var(--color-info)] bg-[var(--color-info-tint)] text-[var(--color-info)]",
            )}
          >
            <span className="flex-1">{t.mensagem}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 opacity-70 hover:opacity-100"
              aria-label="Fechar aviso"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** `notify(mensagem)` — chamar quando uma action fora de um <form> falhar
 * (result.ok === false). Precisa estar dentro de <ToastProvider> (montado
 * uma vez no AppShell). */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return ctx;
}
