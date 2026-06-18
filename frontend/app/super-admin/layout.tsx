"use client";
import { useEffect, useState, useRef } from "react";
import { Palette, X, RotateCcw } from "lucide-react";

// ─── Presets rápidos ──────────────────────────────────────────────────────────

const PRESETS = [
  { id: "dark",    name: "Dark",      swatch: "#1e293b", brightness: 1,    hue: 0,   saturate: 1   },
  { id: "navy",    name: "Navy",      swatch: "#1e3a5f", brightness: 1,    hue: 215, saturate: 1.2 },
  { id: "emerald", name: "Esmeralda", swatch: "#14532d", brightness: 0.9,  hue: 115, saturate: 1.3 },
  { id: "rose",    name: "Rosa",      swatch: "#4c1d33", brightness: 0.95, hue: 300, saturate: 1.2 },
  { id: "violet",  name: "Violeta",   swatch: "#3b1d6b", brightness: 0.9,  hue: 250, saturate: 1.2 },
  { id: "amber",   name: "Âmbar",    swatch: "#451a03", brightness: 0.95, hue: 35,  saturate: 1.4 },
  { id: "light",   name: "Claro",     swatch: "#f1f5f9", brightness: 1,    hue: 180, saturate: 0.8 },
];

type ThemeState = { brightness: number; hue: number; saturate: number; preset: string };

const DEFAULT: ThemeState = { brightness: 1, hue: 0, saturate: 1, preset: "dark" };

function buildFilter(s: ThemeState) {
  if (s.preset === "light") return "invert(1) hue-rotate(180deg) saturate(0.8)";
  return `brightness(${s.brightness}) hue-rotate(${s.hue}deg) saturate(${s.saturate})`;
}

function save(s: ThemeState) {
  localStorage.setItem("sa_theme_v2", JSON.stringify(s));
}

function load(): ThemeState {
  try {
    const raw = localStorage.getItem("sa_theme_v2");
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch { /**/ }
  return DEFAULT;
}

// ─── Slider component ─────────────────────────────────────────────────────────

function Slider({
  label, value, min, max, step, format, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ color: "#94a3b8", fontSize: 12 }}>{label}</span>
        <span style={{ color: "#f97316", fontSize: 11, fontWeight: 700 }}>{format(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "#f97316", cursor: "pointer" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#475569", fontSize: 10 }}>{format(min)}</span>
        <span style={{ color: "#475569", fontSize: 10 }}>{format(max)}</span>
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

function SAThemePanel({ onFilter }: { onFilter: (f: string) => void }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ThemeState>(DEFAULT);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = load();
    setState(s);
    onFilter(buildFilter(s));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function update(next: Partial<ThemeState>) {
    const s = { ...state, ...next };
    setState(s);
    save(s);
    onFilter(buildFilter(s));
  }

  function applyPreset(p: typeof PRESETS[0]) {
    const s: ThemeState = { brightness: p.brightness, hue: p.hue, saturate: p.saturate, preset: p.id };
    setState(s);
    save(s);
    onFilter(buildFilter(s));
  }

  function reset() {
    setState(DEFAULT);
    save(DEFAULT);
    onFilter(buildFilter(DEFAULT));
  }

  const panelStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 60,
    left: 0,
    width: 280,
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
    zIndex: 9999,
  };

  return (
    <div ref={ref} style={{ position: "fixed", bottom: 24, left: 24, zIndex: 9999 }}>
      {open && (
        <div style={panelStyle}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ color: "#f8fafc", fontWeight: 700, fontSize: 14 }}>🎨 Personalizar Tema</span>
            <button
              onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Presets */}
          <p style={{ color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 8, letterSpacing: 1 }}>
            Temas prontos
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 16 }}>
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                title={p.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 9px",
                  borderRadius: 10,
                  border: state.preset === p.id ? "1.5px solid #f97316" : "1px solid #1e293b",
                  background: state.preset === p.id ? "rgba(249,115,22,0.12)" : "#1e293b",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: 12, height: 12, borderRadius: "50%",
                    background: p.swatch, border: "1px solid #334155", flexShrink: 0,
                  }}
                />
                <span style={{ color: state.preset === p.id ? "#fb923c" : "#cbd5e1", fontSize: 11 }}>
                  {p.name}
                </span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ borderTop: "1px solid #1e293b", marginBottom: 16 }} />

          {/* Sliders */}
          <p style={{ color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 12, letterSpacing: 1 }}>
            Ajuste fino
          </p>

          <Slider
            label="💡 Fundo (claro / escuro)"
            value={state.brightness}
            min={0.4} max={1.5} step={0.05}
            format={v => `${Math.round(v * 100)}%`}
            onChange={v => update({ brightness: v, preset: "custom" })}
          />

          <Slider
            label="🎨 Cor / Matiz"
            value={state.hue}
            min={0} max={359} step={1}
            format={v => `${v}°`}
            onChange={v => update({ hue: v, preset: "custom" })}
          />

          <Slider
            label="✨ Vivacidade das cores"
            value={state.saturate}
            min={0.2} max={2} step={0.05}
            format={v => `${Math.round(v * 100)}%`}
            onChange={v => update({ saturate: v, preset: "custom" })}
          />

          {/* Reset */}
          <button
            onClick={reset}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              width: "100%", justifyContent: "center",
              marginTop: 4, padding: "8px 12px",
              background: "#1e293b", border: "1px solid #334155",
              borderRadius: 10, color: "#94a3b8", fontSize: 12,
              cursor: "pointer",
            }}
          >
            <RotateCcw size={12} />
            Restaurar padrão
          </button>

          <p style={{ color: "#334155", fontSize: 10, textAlign: "center", marginTop: 10 }}>
            Salvo automaticamente no navegador
          </p>
        </div>
      )}

      {/* Floating button — bottom-left */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Personalizar tema"
        style={{
          width: 48, height: 48, borderRadius: "50%",
          background: "#1e293b", border: "1px solid #334155",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: open ? "#f97316" : "#94a3b8",
          cursor: "pointer",
          boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
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
      <div style={{ filter, minHeight: "100vh" }}>
        {children}
      </div>
      {/* Painel fica fora do filtro para não sofrer distorção */}
      <SAThemePanel onFilter={setFilter} />
    </>
  );
}
