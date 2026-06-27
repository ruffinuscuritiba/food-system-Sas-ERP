"use client";

/**
 * Error boundary RAIZ (substitui o layout quando há erro não tratado no root).
 * Precisa renderizar <html>/<body> próprios. Estilo do Design System (cinza-azul).
 * Também previne o edge case de prerender do /_global-error no Next 16 + React 19.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0B0E",
          color: "#e5e7eb",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 420 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>
            Algo deu errado
          </h1>
          <p style={{ fontSize: 14, color: "#9aa6b8", margin: "0 0 20px", lineHeight: 1.5 }}>
            Ocorreu um erro inesperado. Tente novamente — se persistir, recarregue a página.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: "#f97316",
              color: "#fff",
              border: "none",
              padding: "10px 24px",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
