"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, Check, Save, RotateCcw, Upload, X, Store, ChevronDown } from "lucide-react";
import Link from "next/link";
import { saApi } from "@/services/superAdminApi";

// ─── Types ────────────────────────────────────────────────────────────────────

type ThemeKey =
  | "pageBg"
  | "pageBgImage"   // URL string — empty = no image
  | "pageBgOverlay" // rgba overlay on image, e.g. "rgba(0,0,0,0.5)"
  | "headerBg" | "headerText"
  | "navBg"    | "navText"    | "navActive"
  | "cardBg"   | "cardBorder"
  | "btnBg"    | "btnText"
  | "textPrimary" | "textSecondary"
  | "inputBg"
  | "footerBg" | "footerText"
  | "accent";

type ElemId =
  | "fundo" | "tipografia" | "paleta" | "botoes"
  | "formularios" | "cartoes" | "cabecalho" | "rodape" | "navegacao";

type SidebarTab = "tema" | "adicionar" | "conteudo";

type Theme = Record<ThemeKey, string>;

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT: Theme = {
  pageBg:        "#111827",
  pageBgImage:   "",
  pageBgOverlay: "rgba(0,0,0,0.5)",
  headerBg:      "#0f172a", headerText:    "#f1f5f9",
  navBg:         "#0f172a", navText:       "#94a3b8", navActive: "#059669",
  cardBg:        "#1f2937", cardBorder:    "#374151",
  btnBg:         "#059669", btnText:       "#ffffff",
  textPrimary:   "#f1f5f9", textSecondary: "#9ca3af",
  inputBg:       "#111827",
  footerBg:      "#0f172a", footerText:    "#6b7280",
  accent:        "#059669",
};

// Preset complete themes
const PRESET_THEMES: { name: string; emoji: string; theme: Theme }[] = [
  { name: "Escuro Esmeralda", emoji: "🌿", theme: { ...DEFAULT } },
  {
    name: "Azul Noite", emoji: "💙", theme: {
      pageBg: "#050f1a", pageBgImage: "", pageBgOverlay: "rgba(0,0,0,0.5)",
      headerBg: "#020810", headerText: "#e2e8f0",
      navBg: "#020810", navText: "#64748b", navActive: "#3b82f6",
      cardBg: "#0f1f35", cardBorder: "#1e3a5f",
      btnBg: "#2563eb", btnText: "#ffffff",
      textPrimary: "#e2e8f0", textSecondary: "#64748b",
      inputBg: "#071524", footerBg: "#020810", footerText: "#475569", accent: "#3b82f6",
    },
  },
  {
    name: "Vermelho Gourmet", emoji: "🔥", theme: {
      pageBg: "#1a0808", pageBgImage: "", pageBgOverlay: "rgba(0,0,0,0.5)",
      headerBg: "#0f0404", headerText: "#f1f5f9",
      navBg: "#0f0404", navText: "#94a3b8", navActive: "#f97316",
      cardBg: "#2a0f0f", cardBorder: "#4a1f1f",
      btnBg: "#dc2626", btnText: "#ffffff",
      textPrimary: "#f1f5f9", textSecondary: "#9ca3af",
      inputBg: "#1a0808", footerBg: "#0f0404", footerText: "#6b7280", accent: "#ef4444",
    },
  },
  {
    name: "Roxo Neon", emoji: "💜", theme: {
      pageBg: "#0d0618", pageBgImage: "", pageBgOverlay: "rgba(0,0,0,0.5)",
      headerBg: "#070310", headerText: "#e2e8f0",
      navBg: "#070310", navText: "#6d28d9", navActive: "#a21caf",
      cardBg: "#170a2a", cardBorder: "#3b1f5c",
      btnBg: "#7c3aed", btnText: "#ffffff",
      textPrimary: "#e2e8f0", textSecondary: "#8b5cf6",
      inputBg: "#0d0618", footerBg: "#070310", footerText: "#6b7280", accent: "#9333ea",
    },
  },
  {
    name: "Modo Claro", emoji: "☀️", theme: {
      pageBg: "#f8fafc", pageBgImage: "", pageBgOverlay: "rgba(255,255,255,0.3)",
      headerBg: "#ffffff", headerText: "#1e293b",
      navBg: "#f1f5f9", navText: "#64748b", navActive: "#059669",
      cardBg: "#ffffff", cardBorder: "#e2e8f0",
      btnBg: "#059669", btnText: "#ffffff",
      textPrimary: "#1e293b", textSecondary: "#64748b",
      inputBg: "#f8fafc", footerBg: "#ffffff", footerText: "#94a3b8", accent: "#059669",
    },
  },
  {
    name: "Dourado Premium", emoji: "✨", theme: {
      pageBg: "#0a0800", pageBgImage: "", pageBgOverlay: "rgba(0,0,0,0.5)",
      headerBg: "#050400", headerText: "#fbbf24",
      navBg: "#050400", navText: "#92400e", navActive: "#f59e0b",
      cardBg: "#1a1500", cardBorder: "#3d3000",
      btnBg: "#d97706", btnText: "#000000",
      textPrimary: "#fef3c7", textSecondary: "#92400e",
      inputBg: "#0a0800", footerBg: "#050400", footerText: "#78716c", accent: "#f59e0b",
    },
  },
];

// Preset background images
const BG_PRESETS = [
  { label: "Madeira escura",  url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop&q=70" },
  { label: "Concreto",        url: "https://images.unsplash.com/photo-1604147706283-d7119b5b822c?w=800&h=400&fit=crop&q=70" },
  { label: "Granito preto",   url: "https://images.unsplash.com/photo-1620021999568-74fe47e2b1bf?w=800&h=400&fit=crop&q=70" },
  { label: "Restaurante",     url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop&q=70" },
  { label: "Tijolos",         url: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&h=400&fit=crop&q=70" },
  { label: "Mesa hambúrguer", url: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&h=400&fit=crop&q=70" },
];

// ─── Color palette grid ───────────────────────────────────────────────────────

const PALETTE: string[][] = [
  ["#0d1117","#1e293b","#1f2937","#111827","#0f172a","#27272a"],
  ["#065f46","#059669","#10b981","#34d399","#14b8a6","#0d9488"],
  ["#1d4ed8","#3730a3","#7c3aed","#6d28d9","#9333ea","#a21caf"],
  ["#991b1b","#dc2626","#ea580c","#f97316","#fb923c","#d97706"],
  ["#be185d","#e11d48","#f43f5e","#fb7185","#f59e0b","#ca8a04"],
  ["#f8fafc","#e2e8f0","#cbd5e1","#94a3b8","#64748b","#475569"],
  ["#16a34a","#15803d","#0891b2","#2563eb","#4f46e5","#8b5cf6"],
  ["#84cc16","#22c55e","#06b6d4","#3b82f6","#60a5fa","#c084fc"],
];

// ─── Elements ─────────────────────────────────────────────────────────────────

const ELEMENTS: {
  id: ElemId; label: string; icon: string;
  keys: { k: ThemeKey; l: string }[];
}[] = [
  { id: "fundo",       label: "Fundo",         icon: "🖼️", keys: [{ k: "pageBg", l: "Cor do Fundo" }, { k: "pageBgImage", l: "Imagem de Fundo" }] },
  { id: "tipografia",  label: "Tipografia",    icon: "Aa", keys: [{ k: "textPrimary", l: "Principal" }, { k: "textSecondary", l: "Secundário" }] },
  { id: "paleta",      label: "Paleta Global", icon: "🎨", keys: [{ k: "accent", l: "Destaque" }, { k: "navActive", l: "Ativo" }] },
  { id: "botoes",      label: "Botões",        icon: "◼",  keys: [{ k: "btnBg", l: "Cor do Botão" }, { k: "btnText", l: "Texto" }] },
  { id: "formularios", label: "Formulários",   icon: "⌨️", keys: [{ k: "inputBg", l: "Fundo do Campo" }] },
  { id: "cartoes",     label: "Cartões",       icon: "🃏", keys: [{ k: "cardBg", l: "Fundo" }, { k: "cardBorder", l: "Borda" }] },
  { id: "cabecalho",   label: "Cabeçalho",     icon: "▬",  keys: [{ k: "headerBg", l: "Fundo" }, { k: "headerText", l: "Texto" }] },
  { id: "rodape",      label: "Rodapé",        icon: "—",  keys: [{ k: "footerBg", l: "Fundo" }, { k: "footerText", l: "Texto" }] },
  { id: "navegacao",   label: "Navegação",     icon: "☰",  keys: [{ k: "navBg", l: "Fundo" }, { k: "navText", l: "Texto" }] },
];

// Which PDV zones each element controls (for highlight/dim logic)
const TARGETS: Record<ElemId, string[]> = {
  fundo:       ["bg"],
  tipografia:  ["text"],
  paleta:      ["accent", "btn", "nav-active"],
  botoes:      ["btn"],
  formularios: ["input"],
  cartoes:     ["card"],
  cabecalho:   ["header"],
  rodape:      ["footer"],
  navegacao:   ["nav"],
};

// ─── PDV mock data ────────────────────────────────────────────────────────────

const PRODUCTS = [
  { id: 1, name: "Classic Smash Burger",  desc: "Blend 180g, queijo americano, alface", price: 34.9, img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=260&fit=crop&q=80" },
  { id: 2, name: "BBQ Bacon Double",      desc: "Duplo blend, bacon, molho BBQ defumado", price: 44.9, img: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&h=260&fit=crop&q=80" },
  { id: 3, name: "Crispy Chicken",        desc: "Frango crocante, coleslaw, picles", price: 36.9, img: "https://images.unsplash.com/photo-1513185158878-8d8c2a2a3da3?w=400&h=260&fit=crop&q=80" },
  { id: 4, name: "Truffle Gourmet",       desc: "Blend premium, molho trufado, emmental", price: 52.9, img: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=260&fit=crop&q=80" },
];
const CATS = ["🍔 Hambúrgueres", "🥤 Bebidas", "🍟 Porções", "🍰 Sobremesas"];

// ─── Helper: is hex color light? ─────────────────────────────────────────────

function isLight(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

// Is a PDV zone targeted by the active element?
function isTargeted(zones: string[], activeEl: ElemId | null) {
  if (!activeEl) return false;
  return zones.some(z => TARGETS[activeEl].includes(z));
}

// ─── Color Picker Panel ───────────────────────────────────────────────────────

function ColorPanel({
  element, theme, onPick,
}: {
  element: (typeof ELEMENTS)[number];
  theme: Theme;
  onPick: (key: ThemeKey, color: string) => void;
}) {
  const [subKey, setSubKey] = useState<ThemeKey>(element.keys[0].k);
  const [urlInput, setUrlInput] = useState(theme.pageBgImage || "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlRef = useRef<string>("");

  useEffect(() => setSubKey(element.keys[0].k), [element.id]);
  useEffect(() => setUrlInput(theme.pageBgImage || ""), [theme.pageBgImage]);

  useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const blobUrl = URL.createObjectURL(file);
    blobUrlRef.current = blobUrl;
    setUrlInput(blobUrl);
    onPick("pageBgImage", blobUrl);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [onPick]);

  const removeImage = useCallback(() => {
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = ""; }
    setUrlInput("");
    onPick("pageBgImage", "");
  }, [onPick]);

  const isImageTab = subKey === "pageBgImage";
  const current = theme[subKey] ?? "";

  const overlayOpacity = (() => {
    const m = theme.pageBgOverlay?.match(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)/);
    return m ? parseFloat(m[1]) : 0.5;
  })();

  return (
    <div className="overflow-hidden" style={{ animation: "slideDown 0.18s ease" }}>
      <div className="border-t border-slate-700/60 bg-slate-950/80">
        {/* element label */}
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-900/20 border-b border-slate-700/40">
          <span className="text-base">{element.icon}</span>
          <span className="text-xs font-bold text-emerald-400">{element.label}</span>
        </div>

        {/* sub-key tabs */}
        {element.keys.length > 1 && (
          <div className="flex gap-2 px-3 pt-2">
            {element.keys.map(sk => {
              const isImg = sk.k === "pageBgImage";
              const hasImg = isImg && !!theme.pageBgImage;
              return (
                <button
                  key={sk.k}
                  onClick={() => setSubKey(sk.k)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] border transition-all ${
                    subKey === sk.k
                      ? "border-orange-500 bg-orange-900/30 text-orange-300 font-bold"
                      : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {isImg ? (
                    <span className="text-xs">{hasImg ? "🖼️" : "📁"}</span>
                  ) : (
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                      style={{ background: theme[sk.k] }}
                    />
                  )}
                  {sk.l}
                  {hasImg && <span className="ml-0.5 text-emerald-400 font-bold">✓</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* ── IMAGE TAB ── */}
        {isImageTab ? (
          <div className="px-3 py-2 space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-slate-600 bg-slate-800/60 text-slate-300 text-xs font-semibold hover:border-orange-500 hover:text-orange-300 hover:bg-orange-950/20 transition-all"
            >
              <Upload size={14} />
              Fazer upload do computador
            </button>

            {theme.pageBgImage && (
              <div className="relative rounded-xl overflow-hidden h-20 border border-slate-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={theme.pageBgImage}
                  alt="fundo"
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <button
                  onClick={removeImage}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 border border-slate-600 flex items-center justify-center text-red-400 hover:bg-red-900/60 transition"
                  title="Remover imagem"
                >
                  <X size={10} />
                </button>
                <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-slate-300 px-2 py-0.5 truncate">
                  {theme.pageBgImage.startsWith("blob:") ? "Imagem do computador" : theme.pageBgImage}
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] text-slate-400 mb-1 block font-medium">Ou cole uma URL:</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onBlur={() => { const v = urlInput.trim(); if (v !== theme.pageBgImage) onPick("pageBgImage", v); }}
                  onKeyDown={e => { if (e.key === "Enter") onPick("pageBgImage", urlInput.trim()); }}
                  placeholder="https://exemplo.com/imagem.jpg"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 mb-1.5 block font-medium">Ou escolha um fundo pronto:</label>
              <div className="grid grid-cols-3 gap-1.5">
                {BG_PRESETS.map(preset => {
                  const active = theme.pageBgImage === preset.url;
                  return (
                    <button
                      key={preset.url}
                      onClick={() => { onPick("pageBgImage", preset.url); setUrlInput(preset.url); }}
                      title={preset.label}
                      className={`relative h-14 rounded-lg overflow-hidden border-2 transition-all ${
                        active ? "border-orange-400 scale-[1.04]" : "border-slate-700 hover:border-slate-500"
                      }`}
                      style={{
                        backgroundImage: `url(${preset.url})`,
                        backgroundSize: "cover", backgroundPosition: "center",
                      }}
                    >
                      {active && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Check size={16} color="#fff" strokeWidth={3} />
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] text-slate-300 text-center py-0.5">
                        {preset.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {theme.pageBgImage && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-slate-400 font-medium">Escurecimento da imagem</label>
                  <span className="text-[10px] text-orange-400 font-mono">
                    {Math.round(overlayOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range" min={0} max={0.95} step={0.05}
                  value={overlayOpacity}
                  onChange={e => onPick("pageBgOverlay", `rgba(0,0,0,${e.target.value})`)}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #374151 0%, #000 ${overlayOpacity * 100}%, #374151 ${overlayOpacity * 100}%)`,
                  }}
                />
                <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
                  <span>Sem escurecimento</span>
                  <span>Muito escuro</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* current color row */}
            <div className="flex items-center gap-3 px-3 py-2">
              <span
                className="w-8 h-8 rounded-lg border-2 border-white/10 shrink-0"
                style={{ background: current }}
              />
              <div>
                <div className="text-xs font-semibold text-slate-200">
                  {element.keys.find(sk => sk.k === subKey)?.l ?? "Cor"}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">{current.toUpperCase()}</div>
              </div>
              <input
                type="color"
                value={current.startsWith("#") ? current : "#111827"}
                onChange={e => onPick(subKey, e.target.value)}
                className="ml-auto w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                title="Cor personalizada"
              />
            </div>

            {/* Color grid */}
            <div className="px-2.5 pb-3">
              {PALETTE.map((row, ri) => (
                <div key={ri} className="flex gap-1 mb-1">
                  {row.map(color => {
                    const sel = current.toLowerCase() === color.toLowerCase();
                    return (
                      <button
                        key={color}
                        onClick={() => onPick(subKey, color)}
                        title={color}
                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-transform ${
                          sel ? "scale-125 ring-2 ring-orange-400" : "hover:scale-110"
                        }`}
                        style={{ background: color, border: "1.5px solid rgba(255,255,255,0.08)" }}
                      >
                        {sel && <Check size={11} color={isLight(color) ? "#000" : "#fff"} strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Left Sidebar ─────────────────────────────────────────────────────────────

function Sidebar({
  theme, activeEl, activeTab, onSelect, onPick, onReset, onSave, saved,
  onApplyPreset, onTabChange,
  companies, selectedCompanyId, onSelectCompany, onApplyToCompany, applying, applyMsg,
}: {
  theme: Theme;
  activeEl: ElemId | null;
  activeTab: SidebarTab;
  onSelect: (id: ElemId | null) => void;
  onPick: (key: ThemeKey, color: string) => void;
  onReset: () => void;
  onSave: () => void;
  saved: boolean;
  onApplyPreset: (t: Theme) => void;
  onTabChange: (tab: SidebarTab) => void;
  companies: { id: string; name: string; plan: string }[];
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
  onApplyToCompany: () => void;
  applying: boolean;
  applyMsg: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to color panel when element is selected
  useEffect(() => {
    if (activeEl && panelRef.current) {
      setTimeout(() => {
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 60);
    }
  }, [activeEl]);

  const TAB_LABELS: { key: SidebarTab; label: string }[] = [
    { key: "adicionar", label: "Adicionar" },
    { key: "conteudo",  label: "Conteúdo" },
    { key: "tema",      label: "Tema" },
  ];

  return (
    <div className="w-[290px] shrink-0 bg-[#0e0e10] border-r border-slate-800 flex flex-col h-full">

      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-800 shrink-0">
        <Link href="/super-admin/dashboard"
          className="text-slate-500 hover:text-slate-300 transition">
          <ChevronLeft size={16} />
        </Link>
        <div>
          <div className="text-xs font-bold text-slate-100">Editor de Tema PDV</div>
          <div className="text-[10px] text-slate-500">Clique num bloco → escolha a cor</div>
        </div>
      </div>

      {/* Functional tabs */}
      <div className="flex border-b border-slate-800 shrink-0">
        {TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { onTabChange(key); if (key !== "tema") onSelect(null); }}
            className={`flex-1 py-2 text-[11px] font-medium transition border-b-2 ${
              activeTab === key
                ? "text-orange-400 border-orange-500"
                : "text-slate-500 border-transparent hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: ADICIONAR — Preset Themes ────────────────────────────────── */}
      {activeTab === "adicionar" && (
        <div className="flex-1 overflow-y-auto min-h-0 p-2.5 space-y-2">
          <p className="text-[10px] text-slate-500 px-1 pb-1">
            Escolha um tema pronto e aplique ao preview. Depois vá para "Conteúdo" para salvar numa loja.
          </p>
          {PRESET_THEMES.map(preset => {
            const isActive = Object.keys(preset.theme).every(
              k => theme[k as ThemeKey] === preset.theme[k as ThemeKey]
            );
            return (
              <button
                key={preset.name}
                onClick={() => onApplyPreset(preset.theme)}
                className={`w-full rounded-xl border p-2.5 flex items-center gap-3 transition-all ${
                  isActive
                    ? "border-orange-500 bg-orange-950/40"
                    : "border-slate-700/60 bg-slate-900/60 hover:border-slate-500"
                }`}
              >
                {/* Mini color preview */}
                <div className="w-12 h-10 rounded-lg overflow-hidden shrink-0 border border-white/10 relative" style={{ background: preset.theme.pageBg }}>
                  {/* fake nav */}
                  <div className="absolute left-0 top-0 bottom-0 w-3" style={{ background: preset.theme.navBg }} />
                  {/* fake header */}
                  <div className="absolute left-3 top-0 right-0 h-2.5" style={{ background: preset.theme.headerBg }} />
                  {/* fake card */}
                  <div className="absolute left-4 top-3 right-1 bottom-1 rounded" style={{ background: preset.theme.cardBg }} />
                  {/* fake button */}
                  <div className="absolute right-1.5 bottom-1.5 w-3 h-1.5 rounded" style={{ background: preset.theme.btnBg }} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <span>{preset.emoji}</span>
                    <span className={`text-xs font-semibold ${isActive ? "text-orange-300" : "text-slate-200"}`}>
                      {preset.name}
                    </span>
                    {isActive && <Check size={11} className="text-orange-400 ml-auto" />}
                  </div>
                  {/* color swatches */}
                  <div className="flex gap-1 mt-1.5">
                    {([preset.theme.btnBg, preset.theme.navActive, preset.theme.cardBg, preset.theme.headerBg, preset.theme.textPrimary] as string[]).map((c, i) => (
                      <span key={i} className="w-3.5 h-3.5 rounded border border-white/10" style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── TAB: CONTEÚDO — Apply to Company ─────────────────────────────── */}
      {activeTab === "conteudo" && (
        <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-4">
          <div>
            <p className="text-[10px] text-slate-400 font-medium mb-2">Aplicar tema atual a uma loja:</p>

            {/* Company selector */}
            <div className="relative">
              <Store size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <select
                value={selectedCompanyId}
                onChange={e => onSelectCompany(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-[11px] rounded-xl py-2.5 pl-7 pr-8 appearance-none focus:outline-none focus:border-orange-500"
              >
                <option value="">— Selecione uma loja —</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.plan})
                  </option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* What will be applied */}
          {selectedCompanyId && (
            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-2.5 space-y-2">
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Cores que serão aplicadas</p>
              {[
                { label: "Fundo",       color: theme.pageBg },
                { label: "Cabeçalho",  color: theme.headerBg },
                { label: "Navegação",  color: theme.navBg },
                { label: "Botão",      color: theme.btnBg },
                { label: "Destaque",   color: theme.accent },
                { label: "Texto",      color: theme.textPrimary },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded border border-white/10 shrink-0" style={{ background: color }} />
                  <span className="text-[10px] text-slate-400 flex-1">{label}</span>
                  <span className="text-[9px] text-slate-600 font-mono">{color}</span>
                </div>
              ))}
            </div>
          )}

          <button
            disabled={!selectedCompanyId || applying}
            onClick={onApplyToCompany}
            className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              !selectedCompanyId || applying
                ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                : "bg-orange-500 hover:bg-orange-400 text-white"
            }`}
          >
            {applying ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Aplicando...
              </>
            ) : (
              <>
                <Store size={13} />
                Aplicar Tema à Loja
              </>
            )}
          </button>

          {applyMsg && (
            <div className={`rounded-lg px-3 py-2 text-[10px] font-medium ${
              applyMsg.startsWith("✓") ? "bg-emerald-900/30 text-emerald-400 border border-emerald-800" : "bg-red-900/30 text-red-400 border border-red-800"
            }`}>
              {applyMsg}
            </div>
          )}

          <div className="border-t border-slate-800 pt-3">
            <p className="text-[9px] text-slate-600 leading-relaxed">
              Isso atualiza as cores principais da loja (primária, secundária, fundo, texto). O PDV mostrará as cores ao recarregar. O tema do preview local é salvo separadamente via "Salvar Tema".
            </p>
          </div>
        </div>
      )}

      {/* ── TAB: TEMA — Element Grid + Color Panel ────────────────────────── */}
      {activeTab === "tema" && (
        <>
          {/* Section header */}
          <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b border-slate-800/50">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Atributos de Tema
            </span>
            <button
              onClick={onReset}
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition"
            >
              <RotateCcw size={10} /> Resetar
            </button>
          </div>

          {/* Element grid + picker — scrollable */}
          <div ref={scrollAreaRef} className="flex-1 overflow-y-auto min-h-0 flex flex-col">
            <div className="grid grid-cols-2 gap-2 px-2.5 py-2">
              {ELEMENTS.map(el => {
                const sel = activeEl === el.id;
                return (
                  <button
                    key={el.id}
                    onClick={() => onSelect(sel ? null : el.id)}
                    className={`w-full rounded-xl border p-2.5 transition-all duration-150 flex flex-col items-start gap-1.5 ${
                      sel
                        ? "border-orange-500 bg-orange-950/40"
                        : "border-slate-700/60 bg-slate-900/60 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center w-full">
                      <span className="text-[15px]">{el.icon}</span>
                      <div className="ml-auto flex gap-1">
                        {el.keys.map(sk => {
                          const isImgKey = sk.k === "pageBgImage";
                          const hasImg = isImgKey && !!theme[sk.k];
                          return isImgKey ? (
                            <span key={sk.k} className="text-[10px]">{hasImg ? "🖼️" : "📁"}</span>
                          ) : (
                            <span key={sk.k}
                              className="w-3 h-3 rounded-full border border-white/15"
                              style={{ background: theme[sk.k] }}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <span className={`text-[11px] font-medium ${sel ? "text-orange-300" : "text-slate-300"}`}>
                      {el.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Color picker — renders below grid, auto-scrolls into view */}
            {activeEl && (() => {
              const el = ELEMENTS.find(e => e.id === activeEl);
              return el ? (
                <div ref={panelRef}>
                  <ColorPanel element={el} theme={theme} onPick={onPick} />
                </div>
              ) : null;
            })()}
          </div>
        </>
      )}

      {/* Save / Reset — always visible at bottom */}
      <div className="flex gap-2 p-2.5 border-t border-slate-800 shrink-0">
        <button
          onClick={onReset}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 transition"
        >
          <RotateCcw size={12} /> Resetar
        </button>
        <button
          onClick={onSave}
          className={`flex-[2] flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-xs font-bold transition-all ${
            saved ? "bg-green-600" : "bg-orange-500 hover:bg-orange-400"
          }`}
        >
          {saved ? <><Check size={12} /> Salvo!</> : <><Save size={12} /> Salvar Tema</>}
        </button>
      </div>
    </div>
  );
}

// ─── PDV Preview ──────────────────────────────────────────────────────────────

function PdvPreview({ theme, activeEl }: { theme: Theme; activeEl: ElemId | null }) {
  const [activeCat, setActiveCat] = useState(0);
  const hasOverlay = activeEl !== null;

  function zoneProps(zones: string[]) {
    if (!hasOverlay) return { className: "", style: {} };
    if (isTargeted(zones, activeEl)) {
      return {
        className: "relative z-[10] transition-all duration-200",
        style: {
          boxShadow: `0 0 0 2px ${theme.accent}, 0 0 20px ${theme.accent}88`,
          borderRadius: 8,
        } as React.CSSProperties,
      };
    }
    return { className: "", style: {} };
  }

  const hasBgImage = !!theme.pageBgImage;

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col h-full relative"
      style={{
        background: hasBgImage
          ? `url(${theme.pageBgImage}) center/cover no-repeat`
          : theme.pageBg,
        border: `1px solid ${theme.cardBorder}`,
        minHeight: 500,
      }}
    >
      {hasBgImage && (
        <div
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{ background: theme.pageBgOverlay ?? "rgba(0,0,0,0.5)" }}
        />
      )}

      {hasOverlay && (
        <div className="absolute inset-0 bg-black/55 z-[5] pointer-events-none rounded-xl transition-all duration-300" />
      )}

      <div className="relative z-[2] flex flex-col flex-1 min-h-0">

        {/* Header */}
        {(() => {
          const { className, style } = zoneProps(["header"]);
          return (
            <div
              className={`flex items-center gap-3 px-4 h-12 shrink-0 ${className}`}
              style={{ background: theme.headerBg, borderBottom: `1px solid ${theme.cardBorder}`, ...style }}
            >
              {(() => {
                const inp = zoneProps(["input"]);
                return (
                  <div
                    className={`flex-1 h-8 rounded-lg flex items-center gap-2 px-3 ${inp.className}`}
                    style={{ background: theme.inputBg, border: `1px solid ${theme.cardBorder}`, ...inp.style }}
                  >
                    <span style={{ color: theme.textSecondary, fontSize: 11 }}>🔍</span>
                    <span className="text-[11px]" style={{ color: theme.textSecondary }}>
                      Buscar produto...
                    </span>
                  </div>
                );
              })()}
              <span className="text-xs font-semibold" style={{ color: theme.headerText }}>
                Caixa #1
              </span>
              {(() => {
                const btn = zoneProps(["btn"]);
                return (
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center text-sm ${btn.className}`}
                    style={{ background: theme.btnBg, ...btn.style }}
                  >
                    👤
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Nav sidebar */}
          {(() => {
            const { className, style } = zoneProps(["nav"]);
            return (
              <div
                className={`w-32 shrink-0 flex flex-col py-2 ${className}`}
                style={{ background: theme.navBg, borderRight: `1px solid ${theme.cardBorder}`, ...style }}
              >
                {CATS.map((cat, i) => {
                  const navActive = zoneProps(["nav-active", "btn"]);
                  const isAct = i === activeCat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCat(i)}
                      className={`text-left text-[10px] px-3 py-2 border-l-[3px] transition-colors ${
                        isAct ? `${navActive.className}` : ""
                      }`}
                      style={{
                        background: isAct ? `${theme.navActive}22` : "transparent",
                        borderLeftColor: isAct ? theme.navActive : "transparent",
                        color: isAct ? theme.navActive : theme.navText,
                        fontWeight: isAct ? 700 : 400,
                        ...(isAct ? navActive.style : {}),
                      }}
                    >
                      {cat}
                    </button>
                  );
                })}

                {(() => {
                  const btn = zoneProps(["btn"]);
                  return (
                    <div className="mt-auto mx-2 mb-2">
                      <div
                        className={`rounded-lg p-2 text-center ${btn.className}`}
                        style={{ background: theme.btnBg, ...btn.style }}
                      >
                        <div className="text-[9px] font-bold" style={{ color: theme.btnText }}>🛒 CARRINHO</div>
                        <div className="text-xs font-black" style={{ color: theme.btnText }}>R$ 76,80</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-2.5">
            {activeEl === "fundo" && (
              <div
                className="absolute inset-0 z-[10] rounded-xl pointer-events-none"
                style={{
                  boxShadow: `inset 0 0 0 3px ${theme.accent}, inset 0 0 30px ${theme.accent}44`,
                  borderRadius: 12,
                }}
              />
            )}
            <div className="grid grid-cols-2 gap-2">
              {PRODUCTS.map(prod => {
                const card = zoneProps(["card"]);
                return (
                  <div
                    key={prod.id}
                    className={`rounded-xl overflow-hidden transition-all duration-200 ${card.className}`}
                    style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, ...card.style }}
                  >
                    <div className="h-[80px] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={prod.img} alt={prod.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-2">
                      {(() => {
                        const txt = zoneProps(["text"]);
                        return (
                          <>
                            <div
                              className={`text-[10px] font-bold mb-0.5 ${txt.className}`}
                              style={{ color: theme.textPrimary, ...txt.style }}
                            >
                              {prod.name}
                            </div>
                            <div
                              className={`text-[9px] mb-1.5 leading-tight ${txt.className}`}
                              style={{ color: theme.textSecondary, ...txt.style }}
                            >
                              {prod.desc}
                            </div>
                          </>
                        );
                      })()}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black" style={{ color: theme.navActive }}>
                          R$ {prod.price.toFixed(2).replace(".", ",")}
                        </span>
                        {(() => {
                          const btn = zoneProps(["btn"]);
                          return (
                            <button
                              className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all duration-200 ${btn.className}`}
                              style={{ background: theme.btnBg, color: theme.btnText, ...btn.style }}
                            >
                              + Adicionar
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        {(() => {
          const { className, style } = zoneProps(["footer"]);
          return (
            <div
              className={`flex items-center justify-between px-4 py-2 shrink-0 ${className}`}
              style={{ background: theme.footerBg, borderTop: `1px solid ${theme.cardBorder}`, ...style }}
            >
              <span className="text-[10px]" style={{ color: theme.footerText }}>
                🕐 {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="text-[10px]" style={{ color: theme.footerText }}>PDV v2</span>
              <span className="text-[10px]" style={{ color: theme.footerText }}>✅ Online</span>
            </div>
          );
        })()}

      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ThemeEditorPage() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return DEFAULT;
    try {
      const s = localStorage.getItem("sa_pdv_theme");
      return s ? { ...DEFAULT, ...JSON.parse(s) } : DEFAULT;
    } catch { return DEFAULT; }
  });

  const [activeEl, setActiveEl] = useState<ElemId | null>(null);
  const [activeTab, setActiveTab] = useState<SidebarTab>("tema");
  const [saved, setSaved] = useState(false);

  // Company apply state
  const [companies, setCompanies] = useState<{ id: string; name: string; plan: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState("");

  // Load companies for "Conteúdo" tab
  useEffect(() => {
    saApi.get("/super-admin/companies")
      .then(r => setCompanies(
        (r.data as { id: string; name: string; plan?: string }[])
          .filter((c: { id: string; name: string; plan?: string }) => !c.id.startsWith("demo-"))
          .map((c: { id: string; name: string; plan?: string }) => ({ id: c.id, name: c.name, plan: c.plan ?? "?" }))
      ))
      .catch(() => {/* super-admin não autenticado — silencioso */});
  }, []);

  function pickColor(key: ThemeKey, color: string) {
    setTheme(prev => ({ ...prev, [key]: color }));
  }

  function reset() {
    setTheme(DEFAULT);
    setActiveEl(null);
  }

  function save() {
    localStorage.setItem("sa_pdv_theme", JSON.stringify(theme));
    // broadcast to PDV pages on the same browser
    try {
      const ch = new BroadcastChannel("pdv_theme");
      ch.postMessage({ type: "THEME_UPDATE", theme });
      ch.close();
    } catch { /* BroadcastChannel not supported */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function applyPreset(t: Theme) {
    setTheme(t);
    setActiveEl(null);
    setActiveTab("tema");
  }

  async function applyToCompany() {
    if (!selectedCompanyId) return;
    setApplying(true);
    setApplyMsg("");
    try {
      // Map PDV theme keys to CompanyTheme fields
      await saApi.post(`/themes/${selectedCompanyId}`, {
        primaryColor:     theme.btnBg,
        secondaryColor:   theme.navActive,
        backgroundColor:  theme.pageBg,
        textColor:        theme.textPrimary,
      });
      setApplyMsg(`✓ Tema aplicado com sucesso!`);
    } catch {
      setApplyMsg("✗ Erro ao aplicar o tema. Tente novamente.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex h-screen bg-[#0a0a0b] text-slate-100 font-sans overflow-hidden">
      <Sidebar
        theme={theme}
        activeEl={activeEl}
        activeTab={activeTab}
        onSelect={setActiveEl}
        onPick={pickColor}
        onReset={reset}
        onSave={save}
        saved={saved}
        onApplyPreset={applyPreset}
        onTabChange={setActiveTab}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={setSelectedCompanyId}
        onApplyToCompany={applyToCompany}
        applying={applying}
        applyMsg={applyMsg}
      />

      {/* Right preview area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Preview topbar */}
        <div className="h-11 flex items-center gap-3 px-5 bg-[#111113] border-b border-slate-800 shrink-0">
          <span className="text-sm font-bold text-slate-100">Visualização ao Vivo</span>
          {activeEl && (
            <div className="flex items-center gap-2 bg-orange-900/30 border border-orange-700/50 rounded-full px-3 py-1 text-[11px] text-orange-300">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              Editando: {ELEMENTS.find(e => e.id === activeEl)?.label}
            </div>
          )}
          {activeEl && (
            <div className="ml-auto flex items-center gap-4 text-[10px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-black/55 border border-slate-600" />
                Não selecionado (ofuscado)
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded border-2"
                  style={{ borderColor: theme.accent, boxShadow: `0 0 6px ${theme.accent}` }}
                />
                {ELEMENTS.find(e => e.id === activeEl)?.label} — em destaque
              </span>
            </div>
          )}
        </div>

        {/* PDV canvas */}
        <div
          className="flex-1 overflow-auto p-5"
          style={{
            background: "repeating-linear-gradient(45deg,#0d0d0d 0,#0d0d0d 10px,#0a0a0b 10px,#0a0a0b 20px)",
          }}
        >
          <div className="max-w-[860px] mx-auto" style={{ minHeight: 520, height: "100%" }}>
            <PdvPreview theme={theme} activeEl={activeEl} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
