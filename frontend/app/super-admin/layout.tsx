"use client";
import { useEffect, useState, useRef } from "react";
import { Palette, X, Check } from "lucide-react";

// ─── Temas via CSS filter — muda fundo, botões e fontes sem reescrever páginas

const SA_THEMES = [
  { id: "dark",    name: "Dark",       emoji: "⚫", swatch: "#1e293b", filter: "none" },
  { id: "navy",    name: "Navy",       emoji: "🔵", swatch: "#1e3a5f", filter: "hue-rotate(215deg)" },
  { id: "emerald", name: "Esmeralda",  emoji: "🟢", swatch: "#14532d", filter: "hue-rotate(115deg)" },
  { id: "rose",    name: "Rosa",       emoji: "🌸", swatch: "#4c1d33", filter: "hue-rotate(300deg) saturate(1.2)" },
  { id: "violet",  name: "Violeta",    emoji: "💜", swatch: "#3b1d6b", filter: "hue-rotate(250deg)" },
  { id: "amber",   name: "Âmbar",     emoji: "🟡", swatch: "#451a03", filter: "hue-rotate(35deg) saturate(1.3)" },
  { id: "light",   name: "Claro",      emoji: "☀️", swatch: "#e2e8f0", filter: "invert(1) hue-rotate(180deg)" },
];

// ─── Floating theme picker ────────────────────────────────────────────────────

function SAThemePicker({ onTheme }: { onTheme: (filter: string) => void }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("dark");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("sa_theme") ?? "dark";
    setCurrent(saved);
    const t = SA_THEMES.find(t => t.id === saved) ?? SA_THEMES[0];
    onTheme(t.filter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(id: string) {
    const t = SA_THEMES.find(t => t.id === id) ?? SA_THEMES[0];
    setCurrent(id);
    localStorage.setItem("sa_theme", id);
    onTheme(t.filter);
    setOpen(false);
  }

  const currentTheme = SA_THEMES.find(t => t.id === current) ?? SA_THEMES[0];

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-[9999]" style={{ filter: "none" }}>
      {open && (
        <div
          className="absolute bottom-14 right-0 shadow-2xl w-64"
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 16,
            padding: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: "#f8fafc", fontWeight: 700, fontSize: 14 }}>🎨 Tema do painel</span>
            <button onClick={() => setOpen(false)} style={{ color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}>
              <X size={14} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {SA_THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => select(t.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: current === t.id ? "1px solid #f97316" : "1px solid #334155",
                  background: current === t.id ? "rgba(249,115,22,0.1)" : "#0f172a",
                  color: current === t.id ? "#fb923c" : "#cbd5e1",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: t.swatch,
                    border: "1px solid #475569",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 12, fontWeight: 500, flex: 1, textAlign: "left" }}>{t.name}</span>
                {current === t.id && <Check size={11} color="#f97316" />}
              </button>
            ))}
          </div>
          <p style={{ color: "#475569", fontSize: 11, textAlign: "center", marginTop: 12 }}>
            Salvo automaticamente
          </p>
        </div>
      )}

      {/* Floating button — always visible, outside the filter */}
      <button
        onClick={() => setOpen(o => !o)}
        title={`Tema: ${currentTheme.name}`}
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "#1e293b",
          border: "1px solid #475569",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#94a3b8",
          cursor: "pointer",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          transition: "all 0.15s",
        }}
      >
        <Palette size={20} />
      </button>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [filter, setFilter] = useState("none");

  return (
    <>
      {/* Wrapper que recebe o filtro de tema */}
      <div style={{ filter, minHeight: "100vh" }}>
        {children}
      </div>

      {/* Picker fica fora do filtro para não ser afetado */}
      <SAThemePicker onTheme={setFilter} />
    </>
  );
}
