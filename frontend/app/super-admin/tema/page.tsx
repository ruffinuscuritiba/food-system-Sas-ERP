"use client";
import { useState, useCallback, useEffect } from "react";
import {
  Undo2, Monitor, Smartphone, ChevronLeft, Check, RotateCcw, Save,
  Eye, EyeOff, Layers,
} from "lucide-react";
import Link from "next/link";

// ── Color palette ─────────────────────────────────────────────────────────────
const PALETTE_ROWS: string[][] = [
  ["#0d1117","#161b22","#1e293b","#0f172a","#111827","#1f2937"],
  ["#064e3b","#065f46","#047857","#059669","#10b981","#34d399"],
  ["#14b8a6","#0d9488","#0e7490","#0369a1","#1d4ed8","#3730a3"],
  ["#7c3aed","#6d28d9","#9333ea","#a21caf","#be185d","#e11d48"],
  ["#991b1b","#b91c1c","#c2410c","#ea580c","#f97316","#fb923c"],
  ["#92400e","#b45309","#d97706","#ca8a04","#65a30d","#16a34a"],
  ["#f8fafc","#e2e8f0","#cbd5e1","#94a3b8","#64748b","#475569"],
  ["#fef3c7","#fde68a","#fcd34d","#fbbf24","#f59e0b","#d97706"],
];

// ── Theme interface ───────────────────────────────────────────────────────────
interface ThemeColors {
  pageBg: string;
  navBg: string;
  navText: string;
  navActive: string;
  headerBg: string;
  headerText: string;
  cardBg: string;
  cardBorder: string;
  btnBg: string;
  btnText: string;
  textPrimary: string;
  textSecondary: string;
  inputBg: string;
  footerBg: string;
  footerText: string;
  accent: string;
}

const DEFAULT_THEME: ThemeColors = {
  pageBg: "#1a1a2e",
  navBg: "#0f172a",
  navText: "#94a3b8",
  navActive: "#14b8a6",
  headerBg: "#0f172a",
  headerText: "#f8fafc",
  cardBg: "#1e293b",
  cardBorder: "#334155",
  btnBg: "#14b8a6",
  btnText: "#ffffff",
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  inputBg: "#0f172a",
  footerBg: "#0f172a",
  footerText: "#64748b",
  accent: "#14b8a6",
};

// ── Elements definition ───────────────────────────────────────────────────────
type ElemId = "pageBg" | "header" | "nav" | "cards" | "buttons" | "typography" | "input" | "footer" | "accent";

interface ThemeElement {
  id: ElemId;
  label: string;
  desc: string;
  icon: string;
  sub: { key: keyof ThemeColors; label: string }[];
  highlight: string; // CSS selector hint — used for label only
}

const ELEMENTS: ThemeElement[] = [
  {
    id: "pageBg",
    label: "Fundo",
    desc: "Cor de fundo geral",
    icon: "🖼️",
    sub: [{ key: "pageBg", label: "Fundo da Página" }],
    highlight: "page-bg",
  },
  {
    id: "header",
    label: "Cabeçalho",
    desc: "Barra superior do PDV",
    icon: "▬",
    sub: [
      { key: "headerBg", label: "Fundo do Cabeçalho" },
      { key: "headerText", label: "Texto do Cabeçalho" },
    ],
    highlight: "header",
  },
  {
    id: "nav",
    label: "Navegação",
    desc: "Menu lateral de categorias",
    icon: "☰",
    sub: [
      { key: "navBg", label: "Fundo do Menu" },
      { key: "navText", label: "Texto das Categorias" },
      { key: "navActive", label: "Categoria Ativa" },
    ],
    highlight: "nav",
  },
  {
    id: "cards",
    label: "Cartões",
    desc: "Cards de produtos",
    icon: "🃏",
    sub: [
      { key: "cardBg", label: "Fundo do Card" },
      { key: "cardBorder", label: "Borda do Card" },
    ],
    highlight: "card",
  },
  {
    id: "buttons",
    label: "Botões",
    desc: "Botões de ação",
    icon: "◼",
    sub: [
      { key: "btnBg", label: "Cor do Botão" },
      { key: "btnText", label: "Texto do Botão" },
    ],
    highlight: "btn",
  },
  {
    id: "typography",
    label: "Tipografia",
    desc: "Cores dos textos",
    icon: "Aa",
    sub: [
      { key: "textPrimary", label: "Texto Principal" },
      { key: "textSecondary", label: "Texto Secundário" },
    ],
    highlight: "text",
  },
  {
    id: "input",
    label: "Formulários",
    desc: "Campos de busca e entrada",
    icon: "⌨️",
    sub: [{ key: "inputBg", label: "Fundo dos Campos" }],
    highlight: "input",
  },
  {
    id: "footer",
    label: "Rodapé",
    desc: "Barra inferior de status",
    icon: "▬",
    sub: [
      { key: "footerBg", label: "Fundo do Rodapé" },
      { key: "footerText", label: "Texto do Rodapé" },
    ],
    highlight: "footer",
  },
  {
    id: "accent",
    label: "Paleta Global",
    desc: "Cor de destaque principal",
    icon: "🎨",
    sub: [{ key: "accent", label: "Cor de Destaque" }],
    highlight: "accent",
  },
];

// ── Products mock ─────────────────────────────────────────────────────────────
const MOCK_PRODUCTS = [
  { id: 1, name: "Classic Smash Burger", desc: "Blend 180g, queijo americano, alface, tomate", price: 32.9, img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=200&fit=crop&q=80" },
  { id: 2, name: "BBQ Bacon Double", desc: "Duplo blend, bacon, molho BBQ defumado", price: 44.9, img: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=300&h=200&fit=crop&q=80" },
  { id: 3, name: "Crispy Chicken", desc: "Frango crocante, coleslaw, picles, maionese", price: 36.9, img: "https://images.unsplash.com/photo-1513185158878-8d8c2a2a3da3?w=300&h=200&fit=crop&q=80" },
  { id: 4, name: "Veggie Mushroom", desc: "Blend vegetal, cogumelo grelhado, rúcula", price: 38.9, img: "https://images.unsplash.com/photo-1550317138-10000687a72b?w=300&h=200&fit=crop&q=80" },
  { id: 5, name: "Truffle Gourmet", desc: "Blend premium, molho trufado, emmental", price: 52.9, img: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=300&h=200&fit=crop&q=80" },
  { id: 6, name: "Hot Jalapeño", desc: "Blend picante, jalapeño, cream cheese", price: 39.9, img: "https://images.unsplash.com/photo-1561050488-b2a8cc2b1bae?w=300&h=200&fit=crop&q=80" },
];

const MOCK_CATEGORIES = ["🍔 Hambúrgueres", "🥤 Bebidas", "🍟 Porções", "🍰 Sobremesas", "🍕 Entradas"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function isLight(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function glowStyle(color: string, active: boolean) {
  if (!active) return {};
  return {
    boxShadow: `0 0 0 2.5px ${color}, 0 0 22px ${color}99`,
    borderRadius: 8,
    zIndex: 10,
    position: "relative" as const,
  };
}

// ── Color Swatch ──────────────────────────────────────────────────────────────
function ColorSwatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={color}
      style={{
        width: 28, height: 28, borderRadius: 6,
        background: color,
        border: selected ? "2.5px solid #f97316" : "1.5px solid rgba(255,255,255,0.08)",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        transition: "transform 0.1s",
        transform: selected ? "scale(1.2)" : "scale(1)",
      }}
    >
      {selected && <Check size={12} color={isLight(color) ? "#000" : "#fff"} />}
    </button>
  );
}

// ── PDV Mock Preview ──────────────────────────────────────────────────────────
interface PdvPreviewProps {
  theme: ThemeColors;
  activeEl: ElemId | null;
}

function PdvPreview({ theme, activeEl }: PdvPreviewProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const isActive = (el: ElemId) => activeEl === el;
  const hasOverlay = activeEl !== null;

  const overlay = hasOverlay ? (
    <div
      style={{
        position: "absolute", inset: 0,
        background: "rgba(0,0,0,0.58)",
        zIndex: 5,
        pointerEvents: "none",
        borderRadius: 12,
      }}
    />
  ) : null;

  return (
    <div
      style={{
        background: theme.pageBg,
        borderRadius: 12,
        overflow: "hidden",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        minHeight: 560,
        border: `1px solid ${theme.cardBorder}`,
        ...glowStyle(theme.accent, isActive("pageBg")),
      }}
    >
      {overlay}

      {/* Header */}
      <div
        style={{
          background: theme.headerBg,
          padding: "0 16px",
          height: 52,
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: `1px solid ${theme.cardBorder}`,
          flexShrink: 0,
          ...glowStyle(theme.accent, isActive("header")),
          ...(isActive("header") ? { zIndex: 10 } : {}),
        }}
      >
        {/* Search */}
        <div
          style={{
            flex: 1,
            background: theme.inputBg,
            border: `1px solid ${theme.cardBorder}`,
            borderRadius: 8,
            height: 34,
            display: "flex",
            alignItems: "center",
            paddingLeft: 12,
            gap: 8,
            ...glowStyle(theme.accent, isActive("input")),
          }}
        >
          <span style={{ color: theme.textSecondary, fontSize: 12 }}>🔍</span>
          <span style={{ color: theme.textSecondary, fontSize: 12 }}>Buscar produto ou bipar código...</span>
        </div>
        <div style={{ color: theme.headerText, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
          Caixa #1
        </div>
        <div
          style={{
            width: 30, height: 30, borderRadius: 6,
            background: theme.btnBg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14,
            ...glowStyle(theme.accent, isActive("buttons")),
          }}
        >
          👤
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left nav */}
        <div
          style={{
            width: 130,
            background: theme.navBg,
            borderRight: `1px solid ${theme.cardBorder}`,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            padding: "8px 0",
            ...glowStyle(theme.accent, isActive("nav")),
            ...(isActive("nav") ? { zIndex: 10 } : {}),
          }}
        >
          {MOCK_CATEGORIES.map((cat, i) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                border: "none",
                background: i === activeCategory ? `${theme.navActive}22` : "transparent",
                borderLeft: i === activeCategory ? `3px solid ${theme.navActive}` : "3px solid transparent",
                color: i === activeCategory ? theme.navActive : theme.navText,
                fontSize: 11,
                cursor: "pointer",
                textAlign: "left",
                fontWeight: i === activeCategory ? 600 : 400,
              }}
            >
              {cat}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          {/* Cart indicator */}
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${theme.cardBorder}` }}>
            <div
              style={{
                background: theme.btnBg,
                borderRadius: 8,
                padding: "8px 10px",
                textAlign: "center",
                ...glowStyle(theme.accent, isActive("buttons")),
              }}
            >
              <div style={{ color: theme.btnText, fontSize: 10, fontWeight: 700 }}>🛒 CARRINHO</div>
              <div style={{ color: theme.btnText, fontSize: 14, fontWeight: 800, marginTop: 2 }}>R$ 76,80</div>
            </div>
          </div>
        </div>

        {/* Products grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {MOCK_PRODUCTS.map(prod => (
              <div
                key={prod.id}
                style={{
                  background: theme.cardBg,
                  border: `1px solid ${theme.cardBorder}`,
                  borderRadius: 10,
                  overflow: "hidden",
                  ...glowStyle(theme.accent, isActive("cards")),
                  ...(isActive("cards") ? { zIndex: 10 } : {}),
                }}
              >
                {/* Product image */}
                <div style={{ height: 90, overflow: "hidden" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={prod.img}
                    alt={prod.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>

                {/* Info */}
                <div style={{ padding: "8px 10px" }}>
                  <div
                    style={{
                      color: theme.textPrimary,
                      fontSize: 11,
                      fontWeight: 700,
                      marginBottom: 2,
                      ...glowStyle(theme.accent, isActive("typography")),
                    }}
                  >
                    {prod.name}
                  </div>
                  <div
                    style={{
                      color: theme.textSecondary,
                      fontSize: 9,
                      marginBottom: 8,
                      lineHeight: 1.4,
                      ...glowStyle(theme.accent, isActive("typography")),
                    }}
                  >
                    {prod.desc}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: theme.navActive, fontSize: 13, fontWeight: 800 }}>
                      R$ {prod.price.toFixed(2).replace(".", ",")}
                    </span>
                    <button
                      style={{
                        background: theme.btnBg,
                        color: theme.btnText,
                        border: "none",
                        borderRadius: 6,
                        padding: "5px 10px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        ...glowStyle(theme.accent, isActive("buttons")),
                      }}
                    >
                      + Adicionar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          background: theme.footerBg,
          borderTop: `1px solid ${theme.cardBorder}`,
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          ...glowStyle(theme.accent, isActive("footer")),
          ...(isActive("footer") ? { zIndex: 10 } : {}),
        }}
      >
        <span style={{ color: theme.footerText, fontSize: 11 }}>🕐 {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
        <span style={{ color: theme.footerText, fontSize: 11 }}>Hambúrgueres Gourmet • PDV v2.1</span>
        <span style={{ color: theme.footerText, fontSize: 11 }}>✅ Online</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ThemeEditorPage() {
  const [theme, setTheme] = useState<ThemeColors>(() => {
    if (typeof window === "undefined") return DEFAULT_THEME;
    try {
      const saved = localStorage.getItem("sa_pdv_theme");
      if (saved) return { ...DEFAULT_THEME, ...JSON.parse(saved) };
    } catch { /**/ }
    return DEFAULT_THEME;
  });

  const [activeEl, setActiveEl] = useState<ElemId | null>(null);
  const [activeSubKey, setActiveSubKey] = useState<keyof ThemeColors | null>(null);
  const [saved, setSaved] = useState(false);

  const activeElement = ELEMENTS.find(e => e.id === activeEl);

  function pickElement(el: ThemeElement) {
    if (activeEl === el.id) {
      setActiveEl(null);
      setActiveSubKey(null);
    } else {
      setActiveEl(el.id);
      setActiveSubKey(el.sub[0].key);
    }
  }

  function pickColor(color: string) {
    if (!activeSubKey) return;
    setTheme(prev => ({ ...prev, [activeSubKey]: color }));
  }

  function resetTheme() {
    setTheme(DEFAULT_THEME);
    setActiveEl(null);
    setActiveSubKey(null);
  }

  function saveTheme() {
    localStorage.setItem("sa_pdv_theme", JSON.stringify(theme));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const currentColor = activeSubKey ? theme[activeSubKey] : "#14b8a6";

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "#0a0a0b",
        color: "#f1f5f9",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* ── Left Sidebar ── */}
      <div
        style={{
          width: 320,
          background: "#111113",
          borderRight: "1px solid #1e293b",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          overflowY: "auto",
        }}
      >
        {/* Sidebar Header */}
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #1e293b",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Link
            href="/super-admin/dashboard"
            style={{
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
            }}
          >
            <ChevronLeft size={18} />
          </Link>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>Editor de Tema PDV</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>Clique num elemento, depois escolha a cor</div>
          </div>
          <Layers size={16} style={{ color: "#475569" }} />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #1e293b" }}>
          {["Adicionar", "Conteúdo", "Tema"].map((tab, i) => (
            <button
              key={tab}
              style={{
                flex: 1,
                padding: "10px 0",
                background: "transparent",
                border: "none",
                color: i === 2 ? "#f97316" : "#64748b",
                fontSize: 11,
                fontWeight: i === 2 ? 700 : 400,
                cursor: "pointer",
                borderBottom: i === 2 ? "2px solid #f97316" : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Section title */}
        <div
          style={{
            padding: "12px 16px 8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>
            Atributos de Tema
          </span>
          <button
            onClick={resetTheme}
            title="Restaurar padrão"
            style={{
              background: "none", border: "none",
              color: "#475569", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 10,
            }}
          >
            <Undo2 size={12} /> Resetar
          </button>
        </div>

        {/* Element buttons grid */}
        <div style={{ padding: "0 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {ELEMENTS.map(el => {
            const isSelected = activeEl === el.id;
            return (
              <button
                key={el.id}
                onClick={() => pickElement(el)}
                title={el.desc}
                style={{
                  background: isSelected ? "rgba(249,115,22,0.12)" : "#1a1a2e",
                  border: isSelected ? "1.5px solid #f97316" : "1.5px solid #1e293b",
                  borderRadius: 10,
                  padding: "10px 10px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 6,
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                  <span style={{ fontSize: 16 }}>{el.icon}</span>
                  {/* Color preview swatch */}
                  <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
                    {el.sub.map(s => (
                      <div
                        key={s.key}
                        style={{
                          width: 12, height: 12,
                          borderRadius: "50%",
                          background: theme[s.key],
                          border: "1px solid rgba(255,255,255,0.15)",
                        }}
                      />
                    ))}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? "#fb923c" : "#cbd5e1",
                  }}
                >
                  {el.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Color Picker Panel (expands when element selected) ── */}
        {activeElement && (
          <div
            style={{
              margin: "12px 12px 0",
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Panel header */}
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(249,115,22,0.08)",
                borderBottom: "1px solid #1e293b",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fb923c" }}>
                {activeElement.icon} {activeElement.label}
              </div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{activeElement.desc}</div>
            </div>

            {/* Sub-color selector */}
            {activeElement.sub.length > 1 && (
              <div style={{ padding: "8px 12px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                {activeElement.sub.map(s => {
                  const isSub = activeSubKey === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setActiveSubKey(s.key)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: isSub ? "1px solid #f97316" : "1px solid #334155",
                        background: isSub ? "rgba(249,115,22,0.15)" : "#1e293b",
                        color: isSub ? "#fb923c" : "#94a3b8",
                        fontSize: 10, cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          width: 10, height: 10,
                          borderRadius: "50%",
                          background: theme[s.key],
                          border: "1px solid rgba(255,255,255,0.2)",
                        }}
                      />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Current color preview + hex */}
            <div
              style={{
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 36, height: 36,
                  borderRadius: 8,
                  background: currentColor,
                  border: "2px solid rgba(255,255,255,0.1)",
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ color: "#f1f5f9", fontSize: 12, fontWeight: 700 }}>
                  {activeElement.sub.find(s => s.key === activeSubKey)?.label ?? "Cor"}
                </div>
                <div style={{ color: "#64748b", fontSize: 10 }}>{currentColor.toUpperCase()}</div>
              </div>
              <input
                type="color"
                value={currentColor}
                onChange={e => pickColor(e.target.value)}
                style={{
                  marginLeft: "auto",
                  width: 36, height: 36,
                  border: "none", borderRadius: 6,
                  cursor: "pointer", background: "transparent",
                }}
                title="Cor personalizada"
              />
            </div>

            {/* Color grid */}
            <div style={{ padding: "4px 12px 12px" }}>
              {PALETTE_ROWS.map((row, ri) => (
                <div key={ri} style={{ display: "flex", gap: 5, marginBottom: 5 }}>
                  {row.map(color => (
                    <ColorSwatch
                      key={color}
                      color={color}
                      selected={currentColor.toLowerCase() === color.toLowerCase()}
                      onClick={() => pickColor(color)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom actions */}
        <div style={{ padding: 12, marginTop: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={resetTheme}
            style={{
              flex: 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px 0",
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 10,
              color: "#94a3b8",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            <RotateCcw size={13} />
            Resetar
          </button>
          <button
            onClick={saveTheme}
            style={{
              flex: 2,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px 0",
              background: saved ? "#16a34a" : "#f97316",
              border: "none",
              borderRadius: 10,
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            {saved ? <><Check size={13} /> Salvo!</> : <><Save size={13} /> Salvar Tema</>}
          </button>
        </div>
      </div>

      {/* ── Right: Preview ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Preview topbar */}
        <div
          style={{
            height: 52,
            background: "#111113",
            borderBottom: "1px solid #1e293b",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>Visualização ao Vivo</span>
            {activeEl && (
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "rgba(249,115,22,0.15)",
                  border: "1px solid rgba(249,115,22,0.4)",
                  borderRadius: 20,
                  padding: "3px 10px",
                  fontSize: 11,
                  color: "#fb923c",
                }}
              >
                <span
                  style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "#f97316",
                    display: "inline-block",
                    animation: "pulse 1s infinite",
                  }}
                />
                Editando: {ELEMENTS.find(e => e.id === activeEl)?.label}
              </div>
            )}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button
              style={{
                background: "#1e293b", border: "1px solid #334155",
                borderRadius: 8, padding: "5px 10px",
                color: "#94a3b8", fontSize: 11, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <Monitor size={13} /> Desktop
            </button>
            <button
              style={{
                background: "#1e293b", border: "1px solid #334155",
                borderRadius: 8, padding: "5px 10px",
                color: "#64748b", fontSize: 11, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <Smartphone size={13} />
            </button>
          </div>
        </div>

        {/* Helper legend */}
        {activeEl && (
          <div
            style={{
              background: "#0f172a",
              borderBottom: "1px solid #1e293b",
              padding: "8px 20px",
              display: "flex",
              alignItems: "center",
              gap: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(0,0,0,0.55)" }} />
              Elementos não selecionados (ofuscados)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#fb923c" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, border: `2px solid ${theme.accent}`, boxShadow: `0 0 8px ${theme.accent}` }} />
              {ELEMENTS.find(e => e.id === activeEl)?.label} — em destaque
            </div>
          </div>
        )}

        {/* PDV Preview area */}
        <div
          style={{
            flex: 1,
            padding: 24,
            overflow: "auto",
            background: "repeating-linear-gradient(45deg, #0d0d0d 0px, #0d0d0d 10px, #0a0a0b 10px, #0a0a0b 20px)",
          }}
        >
          <div style={{ maxWidth: 900, margin: "0 auto", height: "100%", minHeight: 560 }}>
            <PdvPreview theme={theme} activeEl={activeEl} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
