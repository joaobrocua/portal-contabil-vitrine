/**
 * Esqueleto de carregamento da área logada (loading.tsx). Aparece na hora
 * em que o usuário clica num link, enquanto o servidor busca os dados — o
 * menu e o topo continuam na tela. Antes a página ficava parada até tudo
 * carregar, sem sinal de que o clique tinha funcionado.
 */
export function CarregandoView() {
  const bloco = "animate-pulse rounded-[var(--radius)] bg-[var(--color-surface-2)]";
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      <div className="space-y-2">
        <div className={`${bloco} h-3 w-24`} />
        <div className={`${bloco} h-8 w-72`} />
        <div className={`${bloco} h-4 w-96 max-w-full`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${bloco} h-24`} />
        ))}
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`${bloco} h-10`} />
        ))}
      </div>
    </div>
  );
}
