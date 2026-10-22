/**
 * Diferente do layout, o template é recriado a cada navegação — por isso é
 * aqui que a animação de entrada da página roda de novo a cada troca.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="pagina-entra">{children}</div>;
}
