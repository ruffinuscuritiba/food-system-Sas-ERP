"use client";
import { useState, useEffect } from "react";
import {
  ChevronLeft, Check, RotateCcw, Save, Monitor, Smartphone, Layers,
} from "lucide-react";
import Link from "next/link";

// ── Color palette rows ────────────────────────────────────────────────────────
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

// ── Theme ─────────────────────────────────────────────────────────────────────
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

// ── Elements ──────────────────────────────────────────────────────────────────
type ElemId = "pageBg"|"header"|"nav"|"cards"|"buttons"|"typography"|"input"|"footer"|"accent";

interface Sub { key: keyof ThemeColors; label: string }
interface ThemeElement { id: ElemId; label: string; icon: string; sub: Sub[] }

const ELEMENTS: ThemeElement[] = [
  { id:"pageBg",     label:"Fundo",        icon:"🖼️", sub:[{key:"pageBg",    label:"Cor do Fundo"}] },
  { id:"header",     label:"Cabeçalho",    icon:"▬",  sub:[{key:"headerBg",  label:"Fundo"},{key:"headerText",label:"Texto"}] },
  { id:"nav",        label:"Navegação",    icon:"☰",  sub:[{key:"navBg",     label:"Fundo"},{key:"navText",label:"Texto"},{key:"navActive",label:"Ativo"}] },
  { id:"cards",      label:"Cartões",      icon:"🃏", sub:[{key:"cardBg",    label:"Fundo"},{key:"cardBorder",label:"Borda"}] },
  { id:"buttons",    label:"Botões",       icon:"◼",  sub:[{key:"btnBg",     label:"Cor do Botão"},{key:"btnText",label:"Texto"}] },
  { id:"typography", label:"Tipografia",   icon:"Aa", sub:[{key:"textPrimary",label:"Texto Principal"},{key:"textSecondary",label:"Secundário"}] },
  { id:"input",      label:"Formulários",  icon:"⌨️", sub:[{key:"inputBg",   label:"Fundo dos Campos"}] },
  { id:"footer",     label:"Rodapé",       icon:"—",  sub:[{key:"footerBg",  label:"Fundo"},{key:"footerText",label:"Texto"}] },
  { id:"accent",     label:"Paleta Global",icon:"🎨", sub:[{key:"accent",    label:"Cor de Destaque"}] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function isLight(hex: string) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return (r*299+g*587+b*114)/1000>128;
}
function glowStyle(color: string, active: boolean): React.CSSProperties {
  if (!active) return {};
  return { boxShadow:`0 0 0 2.5px ${color}, 0 0 22px ${color}99`, borderRadius:8, zIndex:10, position:"relative" };
}

// ── Products mock ─────────────────────────────────────────────────────────────
const PRODUCTS = [
  { id:1, name:"Classic Smash Burger",  desc:"Blend 180g, queijo americano, alface",     price:32.9, img:"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=200&fit=crop&q=80" },
  { id:2, name:"BBQ Bacon Double",      desc:"Duplo blend, bacon, molho BBQ defumado",    price:44.9, img:"https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=300&h=200&fit=crop&q=80" },
  { id:3, name:"Crispy Chicken",        desc:"Frango crocante, coleslaw, picles",         price:36.9, img:"https://images.unsplash.com/photo-1513185158878-8d8c2a2a3da3?w=300&h=200&fit=crop&q=80" },
  { id:4, name:"Veggie Mushroom",       desc:"Blend vegetal, cogumelo grelhado, rúcula",  price:38.9, img:"https://images.unsplash.com/photo-1550317138-10000687a72b?w=300&h=200&fit=crop&q=80" },
  { id:5, name:"Truffle Gourmet",       desc:"Blend premium, molho trufado, emmental",    price:52.9, img:"https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=300&h=200&fit=crop&q=80" },
  { id:6, name:"Hot Jalapeño",          desc:"Blend picante, jalapeño, cream cheese",     price:39.9, img:"https://images.unsplash.com/photo-1561050488-b2a8cc2b1bae?w=300&h=200&fit=crop&q=80" },
];
const CATS = ["🍔 Hambúrgueres","🥤 Bebidas","🍟 Porções","🍰 Sobremesas","🍕 Entradas"];

// ── PDV Preview ───────────────────────────────────────────────────────────────
function PdvPreview({ theme, activeEl }: { theme: ThemeColors; activeEl: ElemId|null }) {
  const [activeCat, setActiveCat] = useState(0);
  const is = (el: ElemId) => activeEl === el;
  const hasOverlay = activeEl !== null;
  const glow = (el: ElemId) => glowStyle(theme.accent, is(el));

  return (
    <div style={{ background:theme.pageBg, borderRadius:12, overflow:"hidden", height:"100%",
      display:"flex", flexDirection:"column", position:"relative", minHeight:540,
      border:`1px solid ${theme.cardBorder}`, ...glow("pageBg") }}>

      {/* dim overlay */}
      {hasOverlay && (
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.58)",
          zIndex:5, pointerEvents:"none", borderRadius:12 }} />
      )}

      {/* Header */}
      <div style={{ background:theme.headerBg, padding:"0 16px", height:52,
        display:"flex", alignItems:"center", gap:12,
        borderBottom:`1px solid ${theme.cardBorder}`, flexShrink:0,
        ...(is("header") ? { zIndex:10, position:"relative",
          boxShadow:`0 0 0 2.5px ${theme.accent}, 0 0 22px ${theme.accent}99` } : {}) }}>
        <div style={{ flex:1, background:theme.inputBg, border:`1px solid ${theme.cardBorder}`,
          borderRadius:8, height:34, display:"flex", alignItems:"center", paddingLeft:12, gap:8,
          ...(is("input") ? { zIndex:10, position:"relative",
            boxShadow:`0 0 0 2.5px ${theme.accent}, 0 0 22px ${theme.accent}99` } : {}) }}>
          <span style={{ color:theme.textSecondary, fontSize:12 }}>🔍</span>
          <span style={{ color:theme.textSecondary, fontSize:11 }}>Buscar produto ou bipar código...</span>
        </div>
        <span style={{ color:theme.headerText, fontSize:12, fontWeight:600,
          ...(is("typography") ? { textShadow:`0 0 10px ${theme.accent}` } : {}) }}>
          Caixa #1
        </span>
        <div style={{ width:30, height:30, borderRadius:6, background:theme.btnBg,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:14,
          ...(is("buttons") ? { zIndex:10, position:"relative",
            boxShadow:`0 0 0 2.5px ${theme.accent}, 0 0 22px ${theme.accent}99` } : {}) }}>
          👤
        </div>
      </div>

      {/* Body */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
        {/* Nav */}
        <div style={{ width:130, background:theme.navBg, borderRight:`1px solid ${theme.cardBorder}`,
          flexShrink:0, display:"flex", flexDirection:"column", padding:"8px 0",
          ...(is("nav") ? { zIndex:10, position:"relative",
            boxShadow:`0 0 0 2.5px ${theme.accent}, 0 0 22px ${theme.accent}99` } : {}) }}>
          {CATS.map((cat,i) => (
            <button key={cat} onClick={() => setActiveCat(i)} style={{
              display:"flex", alignItems:"center", gap:8, padding:"9px 12px",
              border:"none", background: i===activeCat ? `${theme.navActive}22` : "transparent",
              borderLeft: i===activeCat ? `3px solid ${theme.navActive}` : "3px solid transparent",
              color: i===activeCat ? theme.navActive : theme.navText,
              fontSize:11, cursor:"pointer", textAlign:"left",
              fontWeight: i===activeCat ? 600 : 400 }}>
              {cat}
            </button>
          ))}
          <div style={{ flex:1 }} />
          <div style={{ padding:"8px 10px", borderTop:`1px solid ${theme.cardBorder}` }}>
            <div style={{ background:theme.btnBg, borderRadius:8, padding:"7px 8px", textAlign:"center",
              ...(is("buttons") ? { zIndex:10, position:"relative",
                boxShadow:`0 0 0 2.5px ${theme.accent}, 0 0 22px ${theme.accent}99` } : {}) }}>
              <div style={{ color:theme.btnText, fontSize:9, fontWeight:700 }}>🛒 CARRINHO</div>
              <div style={{ color:theme.btnText, fontSize:13, fontWeight:800, marginTop:2 }}>R$ 76,80</div>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div style={{ flex:1, overflowY:"auto", padding:10 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {PRODUCTS.map(prod => (
              <div key={prod.id} style={{ background:theme.cardBg, border:`1px solid ${theme.cardBorder}`,
                borderRadius:10, overflow:"hidden",
                ...(is("cards") ? { zIndex:10, position:"relative",
                  boxShadow:`0 0 0 2.5px ${theme.accent}, 0 0 22px ${theme.accent}99` } : {}) }}>
                <div style={{ height:80, overflow:"hidden" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={prod.img} alt={prod.name}
                    style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                </div>
                <div style={{ padding:"7px 8px" }}>
                  <div style={{ color:theme.textPrimary, fontSize:10, fontWeight:700, marginBottom:1,
                    ...(is("typography") ? { textShadow:`0 0 8px ${theme.accent}` } : {}) }}>
                    {prod.name}
                  </div>
                  <div style={{ color:theme.textSecondary, fontSize:9, marginBottom:6, lineHeight:1.3,
                    ...(is("typography") ? { textShadow:`0 0 8px ${theme.accent}` } : {}) }}>
                    {prod.desc}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ color:theme.navActive, fontSize:12, fontWeight:800 }}>
                      R$ {prod.price.toFixed(2).replace(".",",")}
                    </span>
                    <button style={{ background:theme.btnBg, color:theme.btnText, border:"none",
                      borderRadius:6, padding:"4px 8px", fontSize:10, fontWeight:700, cursor:"pointer",
                      ...(is("buttons") ? { zIndex:10, position:"relative",
                        boxShadow:`0 0 0 2px ${theme.accent}, 0 0 14px ${theme.accent}99` } : {}) }}>
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
      <div style={{ background:theme.footerBg, borderTop:`1px solid ${theme.cardBorder}`,
        padding:"7px 16px", display:"flex", alignItems:"center", justifyContent:"space-between",
        flexShrink:0,
        ...(is("footer") ? { zIndex:10, position:"relative",
          boxShadow:`0 0 0 2.5px ${theme.accent}, 0 0 22px ${theme.accent}99` } : {}) }}>
        <span style={{ color:theme.footerText, fontSize:10 }}>
          🕐 {new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
        </span>
        <span style={{ color:theme.footerText, fontSize:10 }}>PDV v2.1</span>
        <span style={{ color:theme.footerText, fontSize:10 }}>✅ Online</span>
      </div>
    </div>
  );
}

// ── Color Swatch ──────────────────────────────────────────────────────────────
function Swatch({ color, selected, onClick }: { color:string; selected:boolean; onClick:()=>void }) {
  return (
    <button onClick={onClick} title={color} style={{
      width:28, height:28, borderRadius:6, background:color,
      border: selected ? "2.5px solid #f97316" : "1.5px solid rgba(255,255,255,0.08)",
      cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
      flexShrink:0, transform: selected ? "scale(1.2)" : "scale(1)",
      transition:"transform 0.1s",
    }}>
      {selected && <Check size={12} color={isLight(color)?"#000":"#fff"} />}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ThemeEditorPage() {
  const [theme, setTheme] = useState<ThemeColors>(() => {
    if (typeof window==="undefined") return DEFAULT_THEME;
    try { const s=localStorage.getItem("sa_pdv_theme"); if(s) return {...DEFAULT_THEME,...JSON.parse(s)}; } catch{/**/}
    return DEFAULT_THEME;
  });
  const [activeEl, setActiveEl] = useState<ElemId|null>(null);
  const [activeSubKey, setActiveSubKey] = useState<keyof ThemeColors|null>(null);
  const [saved, setSaved] = useState(false);

  const activeElement = ELEMENTS.find(e => e.id === activeEl);
  const currentColor = activeSubKey ? theme[activeSubKey] : "#14b8a6";

  function clickEl(el: ThemeElement) {
    if (activeEl===el.id) { setActiveEl(null); setActiveSubKey(null); }
    else { setActiveEl(el.id); setActiveSubKey(el.sub[0].key); }
  }
  function pickColor(color: string) {
    if (!activeSubKey) return;
    setTheme(prev => ({...prev, [activeSubKey]: color}));
  }
  function reset() { setTheme(DEFAULT_THEME); setActiveEl(null); setActiveSubKey(null); }
  function save() {
    localStorage.setItem("sa_pdv_theme", JSON.stringify(theme));
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  }

  return (
    <div style={{ display:"flex", height:"100vh", background:"#0a0a0b",
      color:"#f1f5f9", fontFamily:"'Inter',system-ui,sans-serif" }}>

      {/* ── Sidebar ── */}
      <div style={{ width:300, background:"#111113", borderRight:"1px solid #1e293b",
        display:"flex", flexDirection:"column", flexShrink:0 }}>

        {/* Header */}
        <div style={{ padding:"12px 14px", borderBottom:"1px solid #1e293b",
          display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <Link href="/super-admin/dashboard"
            style={{ color:"#64748b", display:"flex", alignItems:"center", textDecoration:"none" }}>
            <ChevronLeft size={16} />
          </Link>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#f8fafc" }}>Editor de Tema PDV</div>
            <div style={{ fontSize:10, color:"#64748b" }}>Clique num elemento, escolha a cor</div>
          </div>
          <Layers size={14} style={{ color:"#475569" }} />
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid #1e293b", flexShrink:0 }}>
          {["Adicionar","Conteúdo","Tema"].map((t,i) => (
            <button key={t} style={{ flex:1, padding:"9px 0", background:"transparent", border:"none",
              color: i===2?"#f97316":"#64748b", fontSize:11, fontWeight:i===2?700:400, cursor:"pointer",
              borderBottom: i===2?"2px solid #f97316":"2px solid transparent" }}>{t}</button>
          ))}
        </div>

        {/* Section title */}
        <div style={{ padding:"10px 14px 6px", display:"flex", alignItems:"center",
          justifyContent:"space-between", flexShrink:0 }}>
          <span style={{ fontSize:10, fontWeight:700, color:"#64748b",
            textTransform:"uppercase", letterSpacing:1 }}>Atributos de Tema</span>
          <button onClick={reset} style={{ background:"none", border:"none",
            color:"#475569", cursor:"pointer", fontSize:10,
            display:"flex", alignItems:"center", gap:4 }}>
            <RotateCcw size={10} /> Resetar
          </button>
        </div>

        {/* Element grid — scrollable middle section */}
        <div style={{ flex:1, overflowY:"auto", padding:"0 10px 8px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
            {ELEMENTS.map(el => {
              const sel = activeEl===el.id;
              return (
                <button key={el.id} onClick={() => clickEl(el)} style={{
                  background: sel ? "rgba(249,115,22,0.12)" : "#1a1a2e",
                  border: sel ? "1.5px solid #f97316" : "1.5px solid #1e293b",
                  borderRadius:9, padding:"9px 9px", cursor:"pointer",
                  display:"flex", flexDirection:"column", alignItems:"flex-start",
                  gap:5, transition:"all 0.12s",
                }}>
                  <div style={{ display:"flex", alignItems:"center", width:"100%" }}>
                    <span style={{ fontSize:14 }}>{el.icon}</span>
                    <div style={{ marginLeft:"auto", display:"flex", gap:3 }}>
                      {el.sub.map(s => (
                        <div key={s.key} style={{ width:10, height:10, borderRadius:"50%",
                          background:theme[s.key], border:"1px solid rgba(255,255,255,0.15)" }} />
                      ))}
                    </div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:sel?700:500,
                    color:sel?"#fb923c":"#cbd5e1" }}>{el.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Color picker — fixed at bottom ── */}
        <div style={{ flexShrink:0, borderTop:"1px solid #1e293b",
          background:"#0d0d0f", padding: activeElement ? "0" : "0" }}>

          {activeElement ? (
            <div>
              {/* Element name */}
              <div style={{ padding:"8px 14px 6px",
                background:"rgba(249,115,22,0.07)", borderBottom:"1px solid #1e293b",
                display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:14 }}>{activeElement.icon}</span>
                <span style={{ fontSize:12, fontWeight:700, color:"#fb923c" }}>{activeElement.label}</span>
                <button onClick={()=>{setActiveEl(null);setActiveSubKey(null);}}
                  style={{ marginLeft:"auto", background:"none", border:"none",
                    color:"#475569", cursor:"pointer", fontSize:18, lineHeight:1 }}>×</button>
              </div>

              {/* Sub-color tabs */}
              {activeElement.sub.length > 1 && (
                <div style={{ display:"flex", gap:5, padding:"7px 10px",
                  borderBottom:"1px solid #1e293b", flexWrap:"wrap" }}>
                  {activeElement.sub.map(s => {
                    const isSub = activeSubKey===s.key;
                    return (
                      <button key={s.key} onClick={()=>setActiveSubKey(s.key)} style={{
                        display:"flex", alignItems:"center", gap:5, padding:"4px 8px",
                        borderRadius:6, border: isSub?"1px solid #f97316":"1px solid #334155",
                        background: isSub?"rgba(249,115,22,0.15)":"#1e293b",
                        color: isSub?"#fb923c":"#94a3b8", fontSize:10, cursor:"pointer" }}>
                        <div style={{ width:9, height:9, borderRadius:"50%",
                          background:theme[s.key], border:"1px solid rgba(255,255,255,0.2)" }} />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Current color row */}
              <div style={{ display:"flex", alignItems:"center", gap:10,
                padding:"7px 12px", borderBottom:"1px solid #1e293b" }}>
                <div style={{ width:32, height:32, borderRadius:7, background:currentColor,
                  border:"2px solid rgba(255,255,255,0.1)", flexShrink:0 }} />
                <div>
                  <div style={{ color:"#f1f5f9", fontSize:11, fontWeight:700 }}>
                    {activeElement.sub.find(s=>s.key===activeSubKey)?.label ?? "Cor"}
                  </div>
                  <div style={{ color:"#64748b", fontSize:10 }}>{currentColor.toUpperCase()}</div>
                </div>
                <input type="color" value={currentColor}
                  onChange={e=>pickColor(e.target.value)}
                  style={{ marginLeft:"auto", width:32, height:32, border:"none",
                    borderRadius:6, cursor:"pointer", background:"transparent" }}
                  title="Cor personalizada" />
              </div>

              {/* Color grid */}
              <div style={{ padding:"8px 10px 6px" }}>
                {PALETTE_ROWS.map((row,ri) => (
                  <div key={ri} style={{ display:"flex", gap:4, marginBottom:4 }}>
                    {row.map(color => (
                      <Swatch key={color} color={color}
                        selected={currentColor.toLowerCase()===color.toLowerCase()}
                        onClick={()=>pickColor(color)} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding:"16px 14px", textAlign:"center" }}>
              <div style={{ fontSize:24, marginBottom:6 }}>👆</div>
              <div style={{ color:"#475569", fontSize:11 }}>
                Clique num elemento acima<br/>para ver as opções de cor
              </div>
            </div>
          )}
        </div>

        {/* Save / Reset buttons */}
        <div style={{ padding:"10px 10px", display:"flex", gap:7,
          borderTop:"1px solid #1e293b", flexShrink:0 }}>
          <button onClick={reset} style={{ flex:1, display:"flex", alignItems:"center",
            justifyContent:"center", gap:5, padding:"9px 0",
            background:"#1e293b", border:"1px solid #334155",
            borderRadius:9, color:"#94a3b8", fontSize:11, cursor:"pointer" }}>
            <RotateCcw size={12} /> Resetar
          </button>
          <button onClick={save} style={{ flex:2, display:"flex", alignItems:"center",
            justifyContent:"center", gap:5, padding:"9px 0",
            background: saved?"#16a34a":"#f97316", border:"none",
            borderRadius:9, color:"#fff", fontSize:11, fontWeight:700,
            cursor:"pointer", transition:"background 0.2s" }}>
            {saved ? <><Check size={12}/>Salvo!</> : <><Save size={12}/>Salvar Tema</>}
          </button>
        </div>
      </div>

      {/* ── Preview ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* Top bar */}
        <div style={{ height:48, background:"#111113", borderBottom:"1px solid #1e293b",
          display:"flex", alignItems:"center", padding:"0 18px", gap:14, flexShrink:0 }}>
          <span style={{ fontSize:13, fontWeight:700, color:"#f8fafc" }}>Visualização ao Vivo</span>
          {activeEl && (
            <div style={{ display:"flex", alignItems:"center", gap:6,
              background:"rgba(249,115,22,0.15)", border:"1px solid rgba(249,115,22,0.4)",
              borderRadius:20, padding:"3px 10px", fontSize:11, color:"#fb923c" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:"#f97316",
                display:"inline-block" }} />
              Editando: {ELEMENTS.find(e=>e.id===activeEl)?.label}
            </div>
          )}
          <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
            <button style={{ background:"#1e293b", border:"1px solid #334155", borderRadius:7,
              padding:"4px 10px", color:"#94a3b8", fontSize:11, cursor:"pointer",
              display:"flex", alignItems:"center", gap:5 }}>
              <Monitor size={12} /> Desktop
            </button>
            <button style={{ background:"#1e293b", border:"1px solid #334155", borderRadius:7,
              padding:"4px 8px", color:"#64748b", fontSize:11, cursor:"pointer",
              display:"flex", alignItems:"center" }}>
              <Smartphone size={12} />
            </button>
          </div>
        </div>

        {/* Legend bar */}
        {activeEl && (
          <div style={{ background:"#0f172a", borderBottom:"1px solid #1e293b",
            padding:"6px 18px", display:"flex", alignItems:"center", gap:18, flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:"#64748b" }}>
              <div style={{ width:10, height:10, borderRadius:2, background:"rgba(0,0,0,0.55)" }} />
              Elementos não selecionados (ofuscados)
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:"#fb923c" }}>
              <div style={{ width:10, height:10, borderRadius:2,
                border:`2px solid ${theme.accent}`,
                boxShadow:`0 0 8px ${theme.accent}` }} />
              {ELEMENTS.find(e=>e.id===activeEl)?.label} — em destaque
            </div>
          </div>
        )}

        {/* PDV */}
        <div style={{ flex:1, padding:20, overflow:"auto",
          background:"repeating-linear-gradient(45deg,#0d0d0d 0,#0d0d0d 10px,#0a0a0b 10px,#0a0a0b 20px)" }}>
          <div style={{ maxWidth:860, margin:"0 auto", height:"100%", minHeight:500 }}>
            <PdvPreview theme={theme} activeEl={activeEl} />
          </div>
        </div>
      </div>
    </div>
  );
}
