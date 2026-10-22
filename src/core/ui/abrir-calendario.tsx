"use client";

import { useEffect } from "react";

const TIPOS = new Set(["date", "month", "time", "datetime-local", "week"]);

/**
 * Clicar em qualquer parte de um campo de data/mês/hora abre o calendário.
 * O navegador só abre ao clicar no iconezinho do canto (e, no tema escuro,
 * quase ninguém vê); no resto do campo, o clique só escolhe o dia/mês/ano
 * para digitar. Um único ouvinte cobre todos os campos do sistema, inclusive
 * os que forem criados depois. Continua dando para digitar (Tab até o campo).
 */
export function AbrirCalendario() {
  useEffect(() => {
    function aoClicar(e: MouseEvent) {
      const el = e.target;
      if (!(el instanceof HTMLInputElement) || !TIPOS.has(el.type)) return;
      if (el.readOnly || el.disabled || typeof el.showPicker !== "function") return;
      // O ícone (extremo direito) já abre sozinho; abrir de novo fecharia.
      const r = el.getBoundingClientRect();
      if (e.clientX > r.right - 36) return;
      try {
        el.showPicker();
      } catch {
        // sem permissão (ex.: dentro de iframe): fica o comportamento normal
      }
    }
    document.addEventListener("click", aoClicar);
    return () => document.removeEventListener("click", aoClicar);
  }, []);
  return null;
}
