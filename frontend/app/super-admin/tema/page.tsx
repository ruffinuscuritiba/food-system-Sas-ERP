"use client";
import { useState, useEffect } from "react";
import { ChevronLeft, Check, Save, RotateCcw } from "lucide-react";
import Link from "next/link";

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

// Preset background images
const BG_PRESETS = [
  { label:"Madeira escura",  url:"https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop&q=70" },
  { label:"Concreto",        url:"https://images.unsplash.com/photo-1604147706283-d7119b5b822c?w=800&h=400&fit=crop&q=70" },
  { label:"Granito preto",   url:"https://images.unsplash.com/photo-1620021999568-74fe47e2b1bf?w=800&h=400&fit=crop&q=70" },
  { label:"Restaurante",     url:"https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop&q=70" },
  { label:"Tijolos",         url:"https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&h=400&fit=crop&q=70" },
  { label:"Mesa hambúrguer", url:"https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&h=400&fit=crop&q=70" },
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
  { id:"fundo",       label:"Fundo",         icon:"🖼️", keys:[{k:"pageBg",      l:"Cor do Fundo"},{k:"pageBgImage",l:"Imagem de Fundo"}] },
  { id:"tipografia",  label:"Tipografia",    icon:"Aa", keys:[{k:"textPrimary", l:"Principal"},{k:"textSecondary",l:"Secundário"}] },
  { id:"paleta",      label:"Paleta Global", icon:"🎨", keys:[{k:"accent",      l:"Destaque"},{k:"navActive",l:"Ativo"}] },
  { id:"botoes",      label:"Botões",        icon:"◼",  keys:[{k:"btnBg",       l:"Cor do Botão"},{k:"btnText",l:"Texto"}] },
  { id:"formularios", label:"Formulários",   icon:"⌨️", keys:[{k:"inputBg",    l:"Fundo do Campo"}] },
  { id:"cartoes",     label:"Cartões",       icon:"🃏", keys:[{k:"cardBg",      l:"Fundo"},{k:"cardBorder",l:"Borda"}] },
  { id:"cabecalho",   label:"Cabeçalho",     icon:"▬",  keys:[{k:"headerBg",   l:"Fundo"},{k:"headerText",l:"Texto"}] },
  { id:"rodape",      label:"Rodapé",        icon:"—",  keys:[{k:"footerBg",   l:"Fundo"},{k:"footerText",l:"Texto"}] },
  { id:"navegacao",   label:"Navegação",     icon:"☰",  keys:[{k:"navBg",      l:"Fundo"},{k:"navText",l:"Texto"}] },
];

// Which PDV zones each element controls (for highlight/dim logic)
const TARGETS: Record<ElemId, string[]> = {
  fundo:       ["bg"],
  tipografia:  ["text"],
  paleta:      ["accent","btn","nav-active"],
  botoes:      ["btn"],
  formularios: ["input"],
  cartoes:     ["card"],
  cabecalho:   ["header"],
  rodape:      ["footer"],
  navegacao:   ["nav"],
};

// ─── PDV mock data ────────────────────────────────────────────────────────────

const PRODUCTS = [
  { id:1, name:"Classic Smash Burger",  desc:"Blend 180g, queijo americano, alface", price:34.9, img:"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=260&fit=crop&q=80" },
  { id:2, name:"BBQ Bacon Double",      desc:"Duplo blend, bacon, molho BBQ defumado", price:44.9, img:"https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&h=260&fit=crop&q=80" },
  { id:3, name:"Crispy Chicken",        desc:"Frango crocante, coleslaw, picles", price:36.9, img:"https://images.unsplash.com/photo-1513185158878-8d8c2a2a3da3?w=400&h=260&fit=crop&q=80" },
  { id:4, name:"Truffle Gourmet",       desc:"Blend premium, molho trufado, emmental", price:52.9, img:"https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=260&fit=crop&q=80" },
];
const CATS = ["🍔 Hambúrgueres","🥤 Bebidas","🍟 Porções","🍰 Sobremesas"];

// ─── Helper: is hex color light? ─────────────────────────────────────────────

function isLight(hex: string) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return (r*299+g*587+b*114)/1000 > 128;
}

// Is a PDV zone targeted by the active element?
function isTargeted(zones: string[], activeEl: ElemId|null) {
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

  useEffect(() => setSubKey(element.keys[0].k), [element.id]);
  useEffect(() => setUrlInput(theme.pageBgImage || ""), [theme.pageBgImage]);

  const isImageTab = subKey === "pageBgImage";
  const current = theme[subKey] ?? "";

  // Parse overlay opacity from rgba string for the slider
  const overlayOpacity = (() => {
    const m = theme.pageBgOverlay?.match(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)/);
    return m ? parseFloat(m[1]) : 0.5;
  })();

  return (
    <div className="overflow-hidden">
      <div
        className="border-t border-slate-700/60 bg-slate-950/80"
        style={{ animation: "slideDown 0.18s ease" }}
      >
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
                      : "border-slate-700 bg-slate-800 text-slate-400"
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
            {/* URL input */}
            <div>
              <label className="text-[10px] text-slate-400 mb-1 block font-medium">URL da imagem</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onBlur={() => onPick("pageBgImage", urlInput.trim())}
                  onKeyDown={e => { if (e.key==="Enter") onPick("pageBgImage", urlInput.trim()); }}
                  placeholder="https://... ou deixe vazio para sem imagem"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
                />
                {urlInput && (
                  <button
                    onClick={() => { setUrlInput(""); onPick("pageBgImage", ""); }}
                    className="px-2 py-1 rounded-lg bg-red-900/40 border border-red-800 text-red-400 text-[10px] hover:bg-red-900/70 transition"
                    title="Remover imagem"
                  >✕</button>
                )}
              </div>
            </div>

            {/* Preset gallery */}
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

            {/* Overlay opacity slider (only when image is set) */}
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
                        {sel && <Check size={11} color={isLight(color)?"#000":"#fff"} strokeWidth={3} />}
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
  theme, activeEl, onSelect, onPick, onReset, onSave, saved,
}: {
  theme: Theme;
  activeEl: ElemId | null;
  onSelect: (id: ElemId | null) => void;
  onPick: (key: ThemeKey, color: string) => void;
  onReset: () => void;
  onSave: () => void;
  saved: boolean;
}) {
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

      {/* Fake tabs */}
      <div className="flex border-b border-slate-800 shrink-0">
        {["Adicionar","Conteúdo","Tema"].map((t,i) => (
          <button key={t} className={`flex-1 py-2 text-[11px] font-medium transition border-b-2 ${
            i===2 ? "text-orange-400 border-orange-500" : "text-slate-500 border-transparent"
          }`}>{t}</button>
        ))}
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Atributos de Tema
        </span>
        <button onClick={onReset}
          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition">
          <RotateCcw size={10} /> Resetar
        </button>
      </div>

      {/* Element grid + picker — scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
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
                    {el.keys.map(sk => (
                      <span key={sk.k}
                        className="w-3 h-3 rounded-full border border-white/15"
                        style={{ background: theme[sk.k] }}
                      />
                    ))}
                  </div>
                </div>
                <span className={`text-[11px] font-medium ${sel ? "text-orange-300" : "text-slate-300"}`}>
                  {el.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Color picker — full-width, below the grid, when element is selected */}
        {activeEl && (() => {
          const el = ELEMENTS.find(e => e.id === activeEl);
          return el ? <ColorPanel element={el} theme={theme} onPick={onPick} /> : null;
        })()}
      </div>

      {/* Save / Reset */}
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

  // Returns extra classes+styles for a zone
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
      {/* Background image overlay (darkening layer) */}
      {hasBgImage && (
        <div
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{ background: theme.pageBgOverlay ?? "rgba(0,0,0,0.5)" }}
        />
      )}

      {/* Editor focus overlay */}
      {hasOverlay && (
        <div className="absolute inset-0 bg-black/55 z-[5] pointer-events-none rounded-xl transition-all duration-300" />
      )}

      {/* All content sits above the image overlay (z-2) */}
      <div className="relative z-[2] flex flex-col flex-1 min-h-0">

      {/* Header */}
      {(() => {
        const { className, style } = zoneProps(["header"]);
        return (
          <div
            className={`flex items-center gap-3 px-4 h-12 shrink-0 ${className}`}
            style={{ background: theme.headerBg, borderBottom: `1px solid ${theme.cardBorder}`, ...style }}
          >
            {/* Search */}
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
            {/* Mini btn */}
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
                const navActive = zoneProps(["nav-active","btn"]);
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

              {/* Cart */}
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
          {/* Backdrop background zone */}
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
                    <img src={prod.img} alt={prod.name}
                      className="w-full h-full object-cover" />
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
                        R$ {prod.price.toFixed(2).replace(".",",")}
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
              🕐 {new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
            </span>
            <span className="text-[10px]" style={{ color: theme.footerText }}>PDV v2</span>
            <span className="text-[10px]" style={{ color: theme.footerText }}>✅ Online</span>
          </div>
        );
      })()}

      </div>{/* end z-[2] content wrapper */}
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
  const [saved, setSaved] = useState(false);

  function pickColor(key: ThemeKey, color: string) {
    setTheme(prev => ({ ...prev, [key]: color }));
  }

  function reset() {
    setTheme(DEFAULT);
    setActiveEl(null);
  }

  function save() {
    localStorage.setItem("sa_pdv_theme", JSON.stringify(theme));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex h-screen bg-[#0a0a0b] text-slate-100 font-sans overflow-hidden">
      <Sidebar
        theme={theme}
        activeEl={activeEl}
        onSelect={setActiveEl}
        onPick={pickColor}
        onReset={reset}
        onSave={save}
        saved={saved}
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
