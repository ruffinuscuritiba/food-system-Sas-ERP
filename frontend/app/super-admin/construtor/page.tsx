"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import { SuperAdminTopBar, saBtn } from "@/components/super-admin/SuperAdminTopBar";
import {
  Store, Layout, Eye, EyeOff, Save, RefreshCw, Palette,
  Columns, CircleDot, Copy, Check, LayoutGrid, LayoutList,
  Star, GripVertical, Smartphone, ExternalLink, Sparkles,
  Image as ImageIcon, Tag, ShoppingCart, ChevronDown, Globe,
} from "lucide-react";
import type { DropResult } from "@hello-pangea/dnd";

// ── DnD (SSR-safe) ────────────────────────────────────────────────────────────
const DragDropContext  = dynamic(() => import("@hello-pangea/dnd").then(m => m.DragDropContext),  { ssr: false });
const Droppable        = dynamic(() => import("@hello-pangea/dnd").then(m => m.Droppable),        { ssr: false });
const Draggable        = dynamic(() => import("@hello-pangea/dnd").then(m => m.Draggable),        { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────
interface Company { id: string; name: string; businessSegment?: string; plan?: string }
interface LayoutBlock { id: "banner"|"categories"|"featured"|"products"; label: string; visible: boolean; order: number; icon: string }
interface LayoutConfig { layoutType: "GRID"|"LIST"|"CLASSIC"; buttonRadius: "SM"|"MD"|"LG"|"FULL"; blocks: LayoutBlock[]; colors?: ColorConfig }
interface ColorConfig { primary: string; secondary: string; background: string; text: string; card: string }

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_COLORS: ColorConfig = { primary: "#f97316", secondary: "#1e293b", background: "#ffffff", text: "#111827", card: "#f8fafc" };

const BLOCK_META: Record<string, { icon: string; color: string; desc: string }> = {
  banner:     { icon: "🖼️", color: "bg-violet-500/10 border-violet-500/30 text-violet-300", desc: "Imagem de destaque no topo" },
  categories: { icon: "📂", color: "bg-blue-500/10 border-blue-500/30 text-blue-300",       desc: "Menu de categorias de produtos" },
  featured:   { icon: "⭐", color: "bg-amber-500/10 border-amber-500/30 text-amber-300",    desc: "Produtos em destaque / promoções" },
  products:   { icon: "🛒", color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", desc: "Grade ou lista de produtos" },
};

const DEFAULT_BLOCKS: LayoutBlock[] = [
  { id: "banner",     label: "Banner",     visible: true,  order: 0, icon: "🖼️" },
  { id: "categories", label: "Categorias", visible: true,  order: 1, icon: "📂" },
  { id: "featured",   label: "Destaques",  visible: false, order: 2, icon: "⭐" },
  { id: "products",   label: "Produtos",   visible: true,  order: 3, icon: "🛒" },
];

const SEGMENT_TEMPLATES: Record<string, Omit<LayoutConfig, "colors">> = {
  PIZZARIA:    { layoutType: "GRID", buttonRadius: "MD",   blocks: [...DEFAULT_BLOCKS] },
  LANCHONETE:  { layoutType: "GRID", buttonRadius: "LG",   blocks: [{ id: "banner", label: "Banner", visible: true, order: 0, icon: "🖼️" }, { id: "featured", label: "Destaques", visible: true, order: 1, icon: "⭐" }, { id: "categories", label: "Categorias", visible: true, order: 2, icon: "📂" }, { id: "products", label: "Produtos", visible: true, order: 3, icon: "🛒" }] },
  PADARIA:     { layoutType: "LIST", buttonRadius: "SM",   blocks: [{ id: "featured", label: "Destaques", visible: true, order: 0, icon: "⭐" }, { id: "categories", label: "Categorias", visible: true, order: 1, icon: "📂" }, { id: "banner", label: "Banner", visible: true, order: 2, icon: "🖼️" }, { id: "products", label: "Produtos", visible: true, order: 3, icon: "🛒" }] },
  CONVENIENCIA:{ layoutType: "GRID", buttonRadius: "FULL", blocks: [{ id: "categories", label: "Categorias", visible: true, order: 0, icon: "📂" }, { id: "products", label: "Produtos", visible: true, order: 1, icon: "🛒" }, { id: "featured", label: "Destaques", visible: true, order: 2, icon: "⭐" }, { id: "banner", label: "Banner", visible: false, order: 3, icon: "🖼️" }] },
  MERCADO:     { layoutType: "LIST", buttonRadius: "MD",   blocks: [{ id: "categories", label: "Categorias", visible: true, order: 0, icon: "📂" }, { id: "featured", label: "Destaques", visible: true, order: 1, icon: "⭐" }, { id: "products", label: "Produtos", visible: true, order: 2, icon: "🛒" }, { id: "banner", label: "Banner", visible: false, order: 3, icon: "🖼️" }] },
  RESTAURANTE: { layoutType: "LIST", buttonRadius: "MD",   blocks: [...DEFAULT_BLOCKS] },
};

const RADIUS_OPTIONS = [
  { value: "SM",   label: "Quadrado",    cls: "rounded-sm",   preview: "rounded" },
  { value: "MD",   label: "Suave",       cls: "rounded-md",   preview: "rounded-md" },
  { value: "LG",   label: "Arredondado", cls: "rounded-xl",   preview: "rounded-xl" },
  { value: "FULL", label: "Pílula",      cls: "rounded-full", preview: "rounded-full" },
];

const PALETTE_PRESETS: { name: string; colors: ColorConfig }[] = [
  { name: "Laranja Clássico", colors: { primary: "#f97316", secondary: "#1e293b", background: "#ffffff", text: "#111827", card: "#f8fafc" } },
  { name: "Verde Fresh",      colors: { primary: "#16a34a", secondary: "#064e3b", background: "#f0fdf4", text: "#14532d", card: "#ffffff" } },
  { name: "Vermelho Bold",    colors: { primary: "#dc2626", secondary: "#450a0a", background: "#fff7f7", text: "#1c0a0a", card: "#ffffff" } },
  { name: "Roxo Premium",     colors: { primary: "#7c3aed", secondary: "#1e1b4b", background: "#faf5ff", text: "#1e1b4b", card: "#ffffff" } },
  { name: "Azul Confiança",   colors: { primary: "#2563eb", secondary: "#1e3a8a", background: "#eff6ff", text: "#1e3a8a", card: "#ffffff" } },
  { name: "Dark Mode",        colors: { primary: "#f97316", secondary: "#f97316", background: "#0f172a", text: "#f1f5f9", card: "#1e293b" } },
  { name: "Dourado Gourmet",  colors: { primary: "#d97706", secondary: "#292524", background: "#fffbeb", text: "#292524", card: "#fef3c7" } },
  { name: "Rosa Moderno",     colors: { primary: "#ec4899", secondary: "#831843", background: "#fdf4ff", text: "#701a75", card: "#ffffff" } },
];

const COLOR_FIELDS: { key: keyof ColorConfig; label: string; desc: string }[] = [
  { key: "primary",    label: "Cor Principal",   desc: "Botões, destaques e CTAs" },
  { key: "secondary",  label: "Cor Secundária",  desc: "Cabeçalho e rodapé" },
  { key: "background", label: "Fundo da Página", desc: "Background geral" },
  { key: "text",       label: "Cor do Texto",    desc: "Textos e títulos" },
  { key: "card",       label: "Fundo dos Cards", desc: "Cards de produto" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const sortedBlocks = (blocks: LayoutBlock[]) => [...blocks].sort((a, b) => a.order - b.order);
const getSaToken = () => (typeof window !== "undefined" ? localStorage.getItem("sa_token") ?? "" : "");
const getApiBase = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

// ── Color Picker Field ────────────────────────────────────────────────────────
function ColorField({ label, desc, value, onChange }: { label: string; desc: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141418] border border-zinc-800 hover:border-zinc-700 transition group">
      <button
        onClick={() => ref.current?.click()}
        className="w-9 h-9 rounded-lg border-2 border-white/20 shrink-0 shadow-md transition hover:scale-110 cursor-pointer"
        style={{ backgroundColor: value }}
        title={`Editar ${label}`}
      />
      <input ref={ref} type="color" value={value} onChange={e => onChange(e.target.value)} className="sr-only" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-200">{label}</p>
        <p className="text-[10px] text-zinc-500">{desc}</p>
      </div>
      <code className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-300 transition">{value}</code>
    </div>
  );
}

// ── Fotos de comida fotorrealistas via gradiente radial ───────────────────────
// Simula iluminação, textura e profundidade de foto real de prato
const FP = {
  frango:    "radial-gradient(ellipse at 42% 32%, #fef08a 0%,#fbbf24 18%,#d97706 38%,#b45309 58%,#7c2d12 82%,#3b0a00 100%)",
  salada:    "radial-gradient(ellipse at 48% 38%, #d9f99d 0%,#86efac 15%,#22c55e 35%,#16a34a 55%,#14532d 78%,#052e16 100%)",
  pizza:     "radial-gradient(ellipse at 50% 40%, #fef9c3 0%,#fde68a 12%,#f59e0b 30%,#d97706 48%,#c2410c 68%,#7c2d12 88%,#3b0a00 100%)",
  carne:     "radial-gradient(ellipse at 45% 35%, #fca5a5 0%,#f87171 15%,#dc2626 35%,#b91c1c 55%,#7f1d1d 75%,#450a0a 100%)",
  burguer:   "radial-gradient(ellipse at 44% 30%, #fef3c7 0%,#fde68a 12%,#f59e0b 28%,#ca8a04 46%,#92400e 65%,#451a03 100%)",
  sobremesa: "radial-gradient(ellipse at 48% 38%, #fdf2f8 0%,#fbcfe8 15%,#f472b6 35%,#db2777 55%,#9d174d 78%,#500724 100%)",
  bebida:    "radial-gradient(ellipse at 50% 25%, #e0f2fe 0%,#7dd3fc 18%,#0284c7 40%,#0369a1 60%,#075985 80%,#082f49 100%)",
};

type LayoutPhoneType = "dark-list" | "grid" | "classic";
function LayoutPhone({ type, tilt, selected, label, colors: c, onClick }: {
  type: LayoutPhoneType; tilt: number; selected: boolean; label: string;
  colors: ColorConfig; onClick: () => void;
}) {
  const W = tilt !== 0 ? 98 : 122;
  const H = tilt !== 0 ? 200 : 248;

  // ══════════════════════════════════════════════════════════════════════════════
  // LISTA DARK — baseado na ref "meu garçom": fundo escuro, pills laranja,
  // cada item tem THUMBNAIL à DIREITA + texto+preço à esquerda
  // ══════════════════════════════════════════════════════════════════════════════
  const DarkListContent = () => {
    const items = [
      { name:"Picanha Grelhada", desc:"Acompanha arroz, feijão e vinagrete.", price:"R$ 57,90", grad: FP.carne },
      { name:"Burger Artesanal", desc:"Blend 160g, queijo especial, bacon.", price:"R$ 38,90", grad: FP.burguer },
      { name:"Drink Tropical",   desc:"Rum, abacaxi, hortelã e limão.",      price:"R$ 29,90", grad: FP.bebida },
      { name:"Sobremesa Brownie",desc:"Brownie com sorvete de chocolate.",    price:"R$ 24,90", grad: FP.sobremesa },
    ];
    return (
      <div style={{ background:"#111111", height:"100%", display:"flex", flexDirection:"column" }}>
        {/* Header dark com logo e nome */}
        <div style={{ background:"linear-gradient(180deg,#1a1a1a 0%,#111 100%)", padding:"20px 8px 6px", display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:16, height:16, borderRadius:"50%", background:"#f97316", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, fontWeight:900, color:"#fff", flexShrink:0 }}>R</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:6, fontWeight:900, color:"#fff", lineHeight:1 }}>Meu Restaurante</div>
            <div style={{ fontSize:3.5, color:"#555", marginTop:1 }}>CARDÁPIO DIGITAL</div>
          </div>
          <div style={{ display:"flex", gap:3 }}>
            {["PEDIDOS","MESAS"].map(t => (
              <div key={t} style={{ fontSize:3, padding:"1.5px 3px", borderRadius:3, background:"#1f1f1f", color:"#666", border:"0.5px solid #333" }}>{t}</div>
            ))}
          </div>
        </div>
        {/* Pills de categoria */}
        <div style={{ display:"flex", gap:3, padding:"4px 7px", background:"#111", borderBottom:"1px solid #1e1e1e", overflow:"hidden" }}>
          {["CATEGORIAS","ENTRADAS","BEBIDAS","SOBREMESAS"].map((cat,i) => (
            <div key={cat} style={{ fontSize:3.5, padding:"2.5px 6px", borderRadius:10, fontWeight:700, flexShrink:0, color:i===0?"#111":"#f97316", background:i===0?"#f97316":"transparent", border:`1px solid ${i===0?"#f97316":"#333"}` }}>{cat}</div>
          ))}
        </div>
        {/* Lista de itens: texto esquerda + foto direita */}
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
          {items.map((item, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", padding:"6px 7px", borderBottom:"1px solid #1a1a1a", gap:5 }}>
              {/* Texto esquerda */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:5.5, fontWeight:800, color:"#fff", lineHeight:1.2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.name}</div>
                <div style={{ fontSize:3.5, color:"#555", lineHeight:1.3, marginTop:1.5, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{item.desc}</div>
                <div style={{ fontSize:5, fontWeight:700, color:"#f97316", marginTop:3 }}>{item.price}</div>
              </div>
              {/* Foto direita — thumbnail quadrado */}
              <div style={{ width:32, height:32, borderRadius:7, flexShrink:0, background:item.grad, boxShadow:"0 2px 6px rgba(0,0,0,0.5)", position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg,rgba(255,255,255,0.08) 0%,transparent 50%)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // GRADE — cards 2 colunas com cores customizadas da empresa
  // ══════════════════════════════════════════════════════════════════════════════
  const gridItems = [
    { name:"X Salada", price:"R$ 30,00", grad: FP.burguer },
    { name:"Pizza Marg.", price:"R$ 45,00", grad: FP.pizza },
    { name:"Prato Exec.", price:"R$ 38,00", grad: FP.frango },
    { name:"Suco Tropical", price:"R$ 12,00", grad: FP.bebida },
  ];
  const GridContent = () => (
    <div style={{ background: c.background, height:"100%", display:"flex", flexDirection:"column" }}>
      {/* Header com cor secundária */}
      <div style={{ background: c.secondary, padding:"20px 8px 6px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:6, fontWeight:900, color:"#fff", lineHeight:1 }}>Meu Restaurante</div>
          <div style={{ fontSize:3.5, color:"rgba(255,255,255,0.6)", marginTop:1 }}>Aberto agora · Mesa 1</div>
        </div>
        <div style={{ width:18, height:18, borderRadius:"50%", background:"rgba(255,255,255,0.12)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9 }}>🛒</div>
      </div>
      {/* Pills */}
      <div style={{ display:"flex", gap:3, padding:"4px 6px", background: c.secondary, overflow:"hidden" }}>
        {["Todos","Pizza","Bebidas","Pratos"].map((cat,i) => (
          <div key={cat} style={{ fontSize:3.5, padding:"2px 5px", borderRadius:10, fontWeight:700, flexShrink:0, color:i===0?"#fff":c.primary, background:i===0?c.primary:c.primary+"22", border:i===0?"none":`1px solid ${c.primary}55` }}>{cat}</div>
        ))}
      </div>
      {/* Grid 2 cols */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4, padding:"5px 6px", flex:1, overflow:"hidden" }}>
        {gridItems.map((item,i) => (
          <div key={i} style={{ background: c.card, borderRadius:9, overflow:"hidden", boxShadow:`0 2px 8px rgba(0,0,0,0.15)`, border:`1px solid ${c.primary}18` }}>
            <div style={{ height:38, background: item.grad, position:"relative" }}>
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg,rgba(255,255,255,0.06) 0%,transparent 60%)" }} />
              <div style={{ position:"absolute", bottom:0, left:0, right:0, height:10, background:"linear-gradient(transparent,rgba(0,0,0,0.3))" }} />
            </div>
            <div style={{ padding:"4px 5px 5px" }}>
              <div style={{ fontSize:4.5, fontWeight:700, color: c.text, lineHeight:1.2 }}>{item.name}</div>
              <div style={{ fontSize:4.5, color: c.primary, fontWeight:700, marginTop:2 }}>{item.price}</div>
              <div style={{ marginTop:3, background: c.primary, borderRadius:5, height:10, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontSize:4, fontWeight:700, color:"#fff" }}>+ Adicionar</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // LISTA CLÁSSICA — fiel às refs 3 e 4: header laranja, círculos com "foto",
  // cards foto full-width + seção branca + tag + bottom nav
  // ══════════════════════════════════════════════════════════════════════════════
  const catCircles = [
    { label:"Petiscos", grad: FP.frango },
    { label:"Almoço",   grad: FP.carne  },
    { label:"Entradas", grad: FP.salada },
    { label:"Pizza",    grad: FP.pizza  },
    { label:"Burguer",  grad: FP.burguer},
  ];
  const classicCards = [
    { name:"Petiscos Happy Hour", meta:"20 min", tag:null,        grad: FP.frango },
    { name:"Almoço Executivo",    meta:"30 min", tag:"seg a sex", grad: FP.carne  },
    { name:"Almoço Executivo",    meta:"40 min", tag:"seg a sex", grad: FP.salada },
    { name:"Promoção do dia",     meta:"25 min", tag:"Oferta",    grad: FP.pizza  },
  ];
  const ClassicContent = () => (
    <div style={{ background:"#f2f2f2", height:"100%", display:"flex", flexDirection:"column" }}>
      {/* Header laranja — logo cliente + nome + Mesa 1 + bandeiras */}
      <div style={{ background:"linear-gradient(135deg,#c2410c 0%,#ea580c 40%,#f97316 100%)", padding:"20px 8px 7px", display:"flex", alignItems:"center", gap:5 }}>
        <div style={{ width:20, height:20, borderRadius:"50%", background:"rgba(255,255,255,0.22)", border:"2px solid rgba(255,255,255,0.5)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, flexShrink:0 }}>🍽️</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:6, fontWeight:900, color:"#fff", lineHeight:1, letterSpacing:-0.2 }}>Meu Restaurante</div>
          <div style={{ fontSize:3.5, color:"rgba(255,255,255,0.75)", marginTop:1.5, display:"flex", gap:4 }}>
            <span>🟢 Aberto agora</span><span>Mesa 1</span>
          </div>
        </div>
        <span style={{ fontSize:10 }}>🇧🇷🇺🇸</span>
      </div>
      {/* Círculos de categoria com fundo "fotográfico" */}
      <div style={{ background:"#fff", borderBottom:"1px solid #e5e5e5", padding:"6px 7px 5px", display:"flex", gap:5, overflowX:"hidden" }}>
        {catCircles.map(cat => (
          <div key={cat.label} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, flexShrink:0 }}>
            <div style={{ width:24, height:24, borderRadius:"50%", background: cat.grad, border:"2px solid #fed7aa", position:"relative", overflow:"hidden", boxShadow:"0 2px 4px rgba(0,0,0,0.15)" }}>
              <div style={{ position:"absolute", inset:0, background:"radial-gradient(circle at 35% 30%, rgba(255,255,255,0.25) 0%, transparent 60%)" }} />
            </div>
            <span style={{ fontSize:3.5, color:"#6b7280", fontWeight:500, lineHeight:1, textAlign:"center" }}>{cat.label}</span>
          </div>
        ))}
      </div>
      {/* Cards com foto full-width */}
      <div style={{ flex:1, overflow:"hidden", padding:"5px 6px 3px", display:"flex", flexDirection:"column", gap:4 }}>
        {classicCards.map((card,i) => (
          <div key={i} style={{ background:"#fff", borderRadius:11, overflow:"hidden", boxShadow:"0 1px 6px rgba(0,0,0,0.10)", flexShrink:0 }}>
            {/* Foto full-width */}
            <div style={{ height:28, background: card.grad, position:"relative" }}>
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg,rgba(255,255,255,0.07) 0%,transparent 50%)" }} />
              <div style={{ position:"absolute", bottom:0, left:0, right:0, height:10, background:"linear-gradient(transparent,rgba(0,0,0,0.22))" }} />
            </div>
            {/* Seção branca */}
            <div style={{ padding:"4px 7px 5px" }}>
              <div style={{ fontSize:5.5, fontWeight:800, color:"#111827", lineHeight:1.2 }}>{card.name}</div>
              <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
                <span style={{ fontSize:3.5, color:"#9ca3af" }}>⏱ {card.meta}</span>
                {card.tag && (
                  <span style={{ fontSize:3, fontWeight:700, padding:"1px 4px", borderRadius:4, background:"#fff7ed", color:"#ea580c", border:"0.5px solid #fdba74" }}>{card.tag}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Bottom nav */}
      <div style={{ background:"#fff", borderTop:"1px solid #e5e5e5", padding:"5px 10px 6px", display:"flex", justifyContent:"space-around", alignItems:"center", marginTop:"auto" }}>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:1 }}>
          <span style={{ fontSize:11 }}>🛒</span><span style={{ fontSize:3.5, color:"#ea580c", fontWeight:700 }}>Pedidos</span>
        </div>
        <div style={{ width:22, height:22, borderRadius:"50%", background:"linear-gradient(135deg,#ea580c,#f97316)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, boxShadow:"0 2px 6px rgba(249,115,22,0.4)" }}>🍽️</div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:1 }}>
          <span style={{ fontSize:11 }}>💰</span><span style={{ fontSize:3.5, color:"#9ca3af" }}>Cashback</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:1 }}>
          <span style={{ fontSize:11 }}>👤</span><span style={{ fontSize:3.5, color:"#9ca3af" }}>Conta</span>
        </div>
      </div>
    </div>
  );

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 group transition-all duration-200"
      style={{ transform: tilt !== 0 ? `perspective(800px) rotateY(${tilt}deg)` : undefined, transformOrigin: "bottom center" }}
    >
      {/* Bezel físico do phone */}
      <div
        className="transition-all duration-200"
        style={{
          width: W, height: H, borderRadius: 22,
          background: "linear-gradient(160deg,#2a2a2a 0%,#111 50%,#1a1a1a 100%)",
          padding: 3.5,
          boxShadow: selected
            ? "0 0 0 3px #f97316, 0 0 32px rgba(249,115,22,0.55), 0 10px 28px rgba(0,0,0,0.7)"
            : "0 0 0 1.5px #3a3a3a, 2px 4px 0 #0a0a0a, 0 10px 24px rgba(0,0,0,0.55)",
        }}
      >
        {/* Tela */}
        <div style={{ width:"100%", height:"100%", borderRadius:18.5, overflow:"hidden", position:"relative" }}>
          {/* Notch pill (Dynamic Island style) */}
          <div style={{ position:"absolute", top:5, left:"50%", transform:"translateX(-50%)", width:22, height:5, background:"#111", borderRadius:3, zIndex:30 }} />
          {type === "dark-list" && <DarkListContent />}
          {type === "grid"      && <GridContent />}
          {type === "classic"   && <ClassicContent />}
        </div>
      </div>
      <span className={`text-[11px] font-semibold transition-colors text-center leading-tight ${selected ? "text-orange-400" : "text-zinc-500 group-hover:text-zinc-300"}`}>
        {label}
      </span>
    </button>
  );
}

// ── Phone Mockup Preview ──────────────────────────────────────────────────────
function PhonePreview({ config, companyId, colors, onRefresh }: { config: LayoutConfig; companyId?: string; colors: ColorConfig; onRefresh: () => void }) {
  const [key, setKey] = useState(0);
  const sorted = sortedBlocks(config.blocks).filter(b => b.visible);
  const radiusMap: Record<string, string> = { SM: "rounded", MD: "rounded-lg", LG: "rounded-xl", FULL: "rounded-full" };
  const r = radiusMap[config.buttonRadius] ?? "rounded-lg";

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Phone */}
      <div className="relative select-none" style={{ width: 220 }}>
        {/* Camera notch */}
        <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-14 h-3.5 bg-[#0a0a0b] rounded-full z-20 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-zinc-800 border border-zinc-700" />
        </div>
        {/* Shell */}
        <div className="rounded-[2.5rem] border-[5px] border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden" style={{ height: 440 }}>
          {companyId ? (
            <iframe
              key={`${companyId}-${key}`}
              src={`/menu/${companyId}`}
              className="w-full h-full border-0"
              style={{ transform: "scale(0.72)", transformOrigin: "top left", width: "139%", height: "139%" }}
              title="Preview"
            />
          ) : (
            /* Static mockup */
            <div className="h-full overflow-hidden text-[9px]" style={{ backgroundColor: colors.background, color: colors.text }}>
              {/* Header */}
              <div className="px-3 py-2.5 text-white text-[8px] font-bold" style={{ backgroundColor: colors.secondary }}>
                🍕 Minha Pizzaria
              </div>
              {sorted.map(b => (
                <div key={b.id} className="mx-2 mt-1.5">
                  {b.id === "banner" && (
                    <div className="h-14 rounded-lg flex items-center justify-center text-white text-[8px] font-bold"
                         style={{ backgroundColor: colors.primary }}>
                      📣 Promoção do Dia
                    </div>
                  )}
                  {b.id === "categories" && (
                    <div className="flex gap-1 overflow-hidden">
                      {["Pizzas","Bebidas","Bordas"].map(cat => (
                        <div key={cat} className={`px-1.5 py-0.5 text-[7px] font-semibold shrink-0 ${r}`}
                             style={{ backgroundColor: colors.primary, color: "#fff" }}>{cat}</div>
                      ))}
                    </div>
                  )}
                  {b.id === "featured" && (
                    <div className="flex gap-1">
                      {[1,2].map(i => (
                        <div key={i} className={`flex-1 h-10 ${r}`} style={{ backgroundColor: colors.card, border: `1px solid ${colors.primary}44` }} />
                      ))}
                    </div>
                  )}
                  {b.id === "products" && (
                    config.layoutType === "GRID" ? (
                      <div className="grid grid-cols-2 gap-1">
                        {[1,2,3,4].map(i => (
                          <div key={i} className={`h-14 ${r}`} style={{ backgroundColor: colors.card, border: `1px solid ${colors.primary}22` }} />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {[1,2,3].map(i => (
                          <div key={i} className={`h-8 w-full ${r}`} style={{ backgroundColor: colors.card, border: `1px solid ${colors.primary}22` }} />
                        ))}
                      </div>
                    )
                  )}
                </div>
              ))}
              {/* CTA */}
              <div className="mx-2 mt-2">
                <div className={`py-1.5 text-center text-[8px] font-bold text-white ${r}`} style={{ backgroundColor: colors.primary }}>
                  Ver pedido (3 itens)
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Home bar */}
        <div className="mt-2 mx-auto w-14 h-1 bg-zinc-700 rounded-full" />
      </div>

      {/* Actions */}
      <div className="w-full space-y-1.5">
        {companyId && (
          <a href={`/menu/${companyId}`} target="_blank" rel="noreferrer"
             className={`flex items-center justify-center gap-1.5 w-full py-2 text-white text-xs font-semibold rounded-xl transition ${saBtn}`}
             style={{ backgroundColor: colors.primary }}>
            <ExternalLink size={12} /> Abrir cardápio ao vivo
          </a>
        )}
        <button onClick={() => { setKey(k => k + 1); onRefresh(); }}
          className={`flex items-center justify-center gap-1.5 w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-xl transition ${saBtn}`}>
          <RefreshCw size={12} /> Atualizar preview
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: "layout",  label: "Layout",  icon: Columns },
  { id: "colors",  label: "Cores",   icon: Palette },
  { id: "blocks",  label: "Blocos",  icon: LayoutGrid },
  { id: "google",  label: "Google",  icon: Globe },
] as const;
type Tab = typeof TABS[number]["id"];

export default function ConstrutorPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState<Tab>("layout");
  const [config, setConfig] = useState<LayoutConfig>({ layoutType: "LIST", buttonRadius: "MD", blocks: DEFAULT_BLOCKS });
  const [colors, setColors] = useState<ColorConfig>(DEFAULT_COLORS);
  const [googleUrl, setGoogleUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tplName, setTplName] = useState("");
  const [savingTpl, setSavingTpl] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState("");
  const [previewRefresh, setPreviewRefresh] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);

  const saToken = getSaToken();
  const apiBase = getApiBase();
  const selected = companies.find(c => c.id === selectedId);

  useEffect(() => {
    fetch(`${apiBase}/company`, { headers: { Authorization: `Bearer ${saToken}` } })
      .then(r => r.json())
      .then((data: Company[]) => {
        const list = data.filter(c => !c.id.startsWith("demo-"));
        setCompanies(list);
        if (list.length) setSelectedId(list[0].id);
      })
      .catch(() => toast.error("Erro ao carregar empresas"));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    fetch(`${apiBase}/company/layout/public?companyId=${selectedId}`)
      .then(r => r.json())
      .then(layout => {
        const raw = layout?.layoutConfig as (LayoutConfig & { googleReviewUrl?: string }) | null;
        setGoogleUrl(layout?.googleReviewUrl ?? "");
        if (raw?.blocks?.length) {
          setConfig({ layoutType: raw.layoutType ?? "LIST", buttonRadius: raw.buttonRadius ?? "MD", blocks: raw.blocks });
          if (raw.colors) setColors(raw.colors);
        } else {
          const seg = companies.find(c => c.id === selectedId)?.businessSegment ?? "RESTAURANTE";
          const tpl = SEGMENT_TEMPLATES[seg] ?? SEGMENT_TEMPLATES.RESTAURANTE;
          setActiveTemplate(seg);
          setConfig({ layoutType: layout?.layoutType ?? tpl.layoutType, buttonRadius: layout?.buttonRadius ?? tpl.buttonRadius, blocks: tpl.blocks });
        }
      })
      .catch(() => toast.error("Erro ao carregar layout"))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const onDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const sorted = sortedBlocks(config.blocks);
    const [moved] = sorted.splice(result.source.index, 1);
    sorted.splice(result.destination.index, 0, moved);
    setConfig(c => ({ ...c, blocks: sorted.map((b, i) => ({ ...b, order: i })) }));
  }, [config.blocks]);

  const toggleVisible = (id: string) =>
    setConfig(c => ({ ...c, blocks: c.blocks.map(b => b.id === id ? { ...b, visible: !b.visible } : b) }));

  const applyTemplate = (seg: string) => {
    const tpl = SEGMENT_TEMPLATES[seg];
    if (tpl) { setConfig({ ...tpl, colors }); setActiveTemplate(seg); }
    toast.success(`Template "${seg}" aplicado`);
  };

  const applyPalette = (p: ColorConfig) => {
    setColors(p);
    toast.success("Paleta aplicada");
  };

  const setColor = (key: keyof ColorConfig, val: string) =>
    setColors(c => ({ ...c, [key]: val }));

  const save = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/layout-templates/company/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${saToken}` },
        body: JSON.stringify({ ...config, colors, googleReviewUrl: googleUrl }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(msg);
      }
      setSaved(true);
      setPreviewRefresh(k => k + 1);
      setTimeout(() => setSaved(false), 2500);
      toast.success("Layout salvo com sucesso!");
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err?.message ?? "Tente novamente"}`);
    } finally { setSaving(false); }
  };

  const saveAsTpl = async () => {
    if (!tplName.trim()) { toast.error("Dê um nome ao template"); return; }
    setSavingTpl(true);
    try {
      await fetch(`${apiBase}/layout-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${saToken}` },
        body: JSON.stringify({ name: tplName, config: { ...config, colors } }),
      });
      setTplName("");
      toast.success("Template salvo na biblioteca!");
    } catch { toast.error("Erro ao salvar template"); }
    finally { setSavingTpl(false); }
  };

  const sorted = sortedBlocks(config.blocks);

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col">
      <SuperAdminTopBar />

      {/* ── Top bar ── */}
      <div className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4">
        {/* Title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center">
            <Layout size={16} />
          </div>
          <div>
            <h1 className="text-sm font-black text-white">Construtor de Lojas</h1>
            <p className="text-[10px] text-zinc-500">Personalização do cardápio digital</p>
          </div>
        </div>

        <div className="w-px h-8 bg-zinc-800 shrink-0" />

        {/* Company selector */}
        <div className="relative flex-1 max-w-xs">
          <button
            onClick={() => setShowDropdown(v => !v)}
            className="w-full flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white hover:border-zinc-600 transition"
          >
            <Store size={14} className="text-orange-400 shrink-0" />
            <span className="flex-1 text-left truncate">{selected?.name ?? "Selecionar empresa…"}</span>
            <ChevronDown size={14} className="text-zinc-500 shrink-0" />
          </button>
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto">
              {companies.map(c => (
                <button key={c.id} onClick={() => { setSelectedId(c.id); setShowDropdown(false); }}
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-zinc-800 transition flex items-center gap-2 ${c.id === selectedId ? "text-orange-400" : "text-zinc-200"}`}>
                  <Store size={12} className="shrink-0 opacity-50" />
                  {c.name}
                  {c.businessSegment && <span className="text-[10px] text-zinc-600 ml-auto">{c.businessSegment}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={save} disabled={saving || !selectedId}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition disabled:opacity-50 ${saBtn} ${saved ? "bg-emerald-600 text-white" : "bg-orange-500 hover:bg-orange-400 text-white"}`}>
            {saved ? <><Check size={15} /> Salvo!</> : saving ? <><RefreshCw size={15} className="animate-spin" /> Salvando…</> : <><Save size={15} /> Salvar</>}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar: tabs ── */}
        <aside className="w-56 shrink-0 border-r border-zinc-800 flex flex-col bg-[#0d0d0f]">
          <nav className="p-2 space-y-0.5">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  tab === t.id ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}>
                <t.icon size={15} className={tab === t.id ? "text-orange-400" : ""} />
                {t.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto p-3 border-t border-zinc-800">
            <div className="text-[10px] text-zinc-600 font-semibold mb-2 uppercase tracking-wider">Salvar como template</div>
            <input value={tplName} onChange={e => setTplName(e.target.value)}
              placeholder="Nome do template…"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500 mb-1.5" />
            <button onClick={saveAsTpl} disabled={savingTpl || !tplName.trim()}
              className={`w-full flex items-center justify-center gap-1.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg text-xs font-semibold transition ${saBtn}`}>
              <Copy size={11} /> {savingTpl ? "Salvando…" : "Salvar template"}
            </button>
          </div>
        </aside>

        {/* ── Center: config ── */}
        <main className="flex-1 overflow-y-auto p-5 space-y-4">

          {loading && (
            <div className="flex items-center gap-2 text-zinc-500 text-sm">
              <RefreshCw size={14} className="animate-spin" /> Carregando configurações…
            </div>
          )}

          {/* ── TAB: Layout ── */}
          {tab === "layout" && !loading && (
            <div className="space-y-4">
              {/* Templates */}
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={14} className="text-orange-400" />
                  <h2 className="text-sm font-bold text-white">Templates por Segmento</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.keys(SEGMENT_TEMPLATES).map(seg => (
                    <button key={seg} onClick={() => applyTemplate(seg)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-semibold transition ${saBtn} ${
                        activeTemplate === seg
                          ? "border-orange-500 bg-orange-500/10 text-orange-300"
                          : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white"
                      }`}>
                      {seg}
                    </button>
                  ))}
                </div>
              </section>

              {/* Display type — 3-phone showcase */}
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
                <div className="flex items-center gap-2 mb-5">
                  <Columns size={14} className="text-orange-400" />
                  <h2 className="text-sm font-bold text-white">Tipo de Exibição dos Produtos</h2>
                  <span className="ml-auto text-[10px] text-zinc-500">Clique para selecionar</span>
                </div>

                {/* 3 phones side by side */}
                <div
                  className="flex items-end justify-center gap-6 pb-4 mb-4"
                  style={{
                    backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
                    backgroundSize: "22px 22px",
                    borderRadius: 16,
                    padding: "20px 12px 16px",
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <LayoutPhone
                    type="dark-list"
                    tilt={11}
                    selected={config.layoutType === "LIST"}
                    label="Lista Dark"
                    colors={colors}
                    onClick={() => setConfig(c => ({ ...c, layoutType: "LIST" }))}
                  />
                  <LayoutPhone
                    type="grid"
                    tilt={0}
                    selected={config.layoutType === "GRID"}
                    label="Grade (suas cores)"
                    colors={colors}
                    onClick={() => setConfig(c => ({ ...c, layoutType: "GRID" }))}
                  />
                  <LayoutPhone
                    type="classic"
                    tilt={-11}
                    selected={config.layoutType === "CLASSIC"}
                    label="Lista Clássica"
                    colors={colors}
                    onClick={() => setConfig(c => ({ ...c, layoutType: "CLASSIC" }))}
                  />
                </div>

                {/* Quick toggle buttons — 3 opções */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "LIST",    label: "Lista Dark",    Icon: LayoutList, desc: "Foto + scrim" },
                    { value: "GRID",    label: "Grade",         Icon: LayoutGrid, desc: "2–4 colunas" },
                    { value: "CLASSIC", label: "Lista Clássica",Icon: LayoutList, desc: "Foto no topo" },
                  ].map(opt => (
                    <button key={opt.value}
                      onClick={() => setConfig(c => ({ ...c, layoutType: opt.value as "GRID"|"LIST"|"CLASSIC" }))}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition ${saBtn} ${
                        config.layoutType === opt.value
                          ? "border-orange-500 bg-orange-500/10 text-white"
                          : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                      }`}>
                      <opt.Icon size={15} />
                      <p className="font-semibold text-[10px] text-center leading-tight">{opt.label}</p>
                      <p className="text-[9px] opacity-50">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </section>

              {/* Button radius */}
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <CircleDot size={14} className="text-orange-400" />
                  <h2 className="text-sm font-bold text-white">Formato dos Botões & Cards</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {RADIUS_OPTIONS.map(opt => (
                    <button key={opt.value}
                      onClick={() => setConfig(c => ({ ...c, buttonRadius: opt.value as LayoutConfig["buttonRadius"] }))}
                      className={`p-3 border text-center transition ${saBtn} ${opt.cls} ${
                        config.buttonRadius === opt.value
                          ? "border-orange-500 bg-orange-500/10 text-orange-300"
                          : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                      }`}>
                      <span className="text-xs font-semibold block mb-2">{opt.label}</span>
                      <div className="h-5 bg-orange-400 opacity-80" style={{ borderRadius: opt.preview === "rounded" ? "4px" : opt.preview === "rounded-md" ? "8px" : opt.preview === "rounded-xl" ? "12px" : "9999px" }} />
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ── TAB: Colors ── */}
          {tab === "colors" && (
            <div className="space-y-4">
              {/* Palettes */}
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={14} className="text-orange-400" />
                  <h2 className="text-sm font-bold text-white">Paletas Prontas</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PALETTE_PRESETS.map(p => (
                    <button key={p.name} onClick={() => applyPalette(p.colors)}
                      className={`group relative rounded-xl border border-zinc-700 overflow-hidden transition ${saBtn} hover:border-zinc-500`}>
                      {/* Color strip */}
                      <div className="flex h-8">
                        {[p.colors.primary, p.colors.secondary, p.colors.background, p.colors.card].map((c, i) => (
                          <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <div className="px-2 py-1.5 bg-zinc-900 text-[10px] font-semibold text-zinc-300 group-hover:text-white transition truncate">
                        {p.name}
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Custom colors */}
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Palette size={14} className="text-orange-400" />
                  <h2 className="text-sm font-bold text-white">Cores Personalizadas</h2>
                  <span className="text-[10px] text-zinc-500 ml-auto">Clique na cor para editar</span>
                </div>
                <div className="space-y-2">
                  {COLOR_FIELDS.map(f => (
                    <ColorField key={f.key} label={f.label} desc={f.desc} value={colors[f.key]} onChange={v => setColor(f.key, v)} />
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ── TAB: Blocks ── */}
          {tab === "blocks" && (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <LayoutGrid size={14} className="text-orange-400" />
                <h2 className="text-sm font-bold text-white">Ordem dos Blocos</h2>
              </div>
              <p className="text-xs text-zinc-500 mb-4">
                Arraste para reposicionar · <EyeOff size={10} className="inline" /> oculta o bloco no cardápio
              </p>

              {/* @ts-ignore */}
              <DragDropContext onDragEnd={onDragEnd}>
                {/* @ts-ignore */}
                <Droppable droppableId="blocks">
                  {(provided: any) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                      {sorted.map((block, idx) => {
                        const meta = BLOCK_META[block.id];
                        return (
                          // @ts-ignore
                          <Draggable key={block.id} draggableId={block.id} index={idx}>
                            {(drag: any, snap: any) => (
                              <div ref={drag.innerRef} {...drag.draggableProps}
                                className={`flex items-center gap-3 p-3.5 rounded-xl border transition ${
                                  snap.isDragging ? "border-orange-500 bg-orange-500/10 shadow-xl shadow-orange-500/20 scale-105" :
                                  block.visible   ? `${meta.color} border` : "border-zinc-800 bg-zinc-900 opacity-40"
                                }`}>
                                {/* Drag handle */}
                                <div {...drag.dragHandleProps} className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300 transition">
                                  <GripVertical size={16} />
                                </div>
                                <span className="text-xl w-7 text-center">{block.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold">{block.label}</p>
                                  <p className="text-[10px] opacity-60 mt-0.5">{meta?.desc}</p>
                                </div>
                                <button onClick={() => toggleVisible(block.id)}
                                  className={`p-2 rounded-lg transition ${saBtn} ${block.visible ? "hover:bg-white/10" : "hover:bg-white/5"}`}
                                  title={block.visible ? "Ocultar" : "Mostrar"}>
                                  {block.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              <div className="mt-4 pt-4 border-t border-zinc-800 text-xs text-zinc-500">
                {config.blocks.filter(b => b.visible).length} de {config.blocks.length} blocos visíveis
              </div>
            </section>
          )}

          {/* ── TAB: Google ── */}
          {tab === "google" && (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Star size={14} className="text-yellow-400" />
                <h2 className="text-sm font-bold text-white">Link de Avaliação Google</h2>
              </div>
              <p className="text-xs text-zinc-500 mb-4">
                Após cada entrega o sistema envia este link por WhatsApp para o cliente avaliar no Google.
              </p>
              <input value={googleUrl} onChange={e => setGoogleUrl(e.target.value)}
                placeholder="https://g.page/r/…"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition" />
              {googleUrl && (
                <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                  <Check size={12} /> Enviado automaticamente via WhatsApp após cada entrega
                </div>
              )}
            </section>
          )}
        </main>

        {/* ── Right: preview ── */}
        <aside className="w-72 shrink-0 border-l border-zinc-800 flex flex-col bg-[#0d0d0f]">
          <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
            <Smartphone size={14} className="text-orange-400" />
            <span className="text-xs font-bold text-white">Preview ao vivo</span>
            {selected && (
              <span className="ml-auto text-[10px] text-zinc-600 truncate max-w-[100px]">{selected.name}</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <PhonePreview
              config={config}
              companyId={selected?.id}
              colors={colors}
              onRefresh={() => setPreviewRefresh(k => k + 1)}
            />

            {/* Color preview strip */}
            <div className="mt-5 rounded-xl overflow-hidden border border-zinc-800">
              <div className="text-[9px] font-bold text-zinc-600 px-2 pt-2 pb-1 uppercase tracking-wider">Paleta atual</div>
              <div className="flex h-6">
                {COLOR_FIELDS.map(f => (
                  <div key={f.key} className="flex-1 group relative" style={{ backgroundColor: colors[f.key] }}
                       title={`${f.label}: ${colors[f.key]}`}>
                  </div>
                ))}
              </div>
              <div className="flex">
                {COLOR_FIELDS.map(f => (
                  <div key={f.key} className="flex-1 text-[7px] text-zinc-600 px-0.5 py-1 text-center truncate">{f.label.split(" ")[0]}</div>
                ))}
              </div>
            </div>

            {/* Block order summary */}
            <div className="mt-4 space-y-1">
              <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider mb-2">Ordem dos blocos</div>
              {sorted.map((b, i) => {
                const meta = BLOCK_META[b.id];
                return (
                  <div key={b.id} className={`flex items-center gap-2 text-[10px] rounded-lg px-2 py-1 border ${b.visible ? meta?.color : "border-zinc-800 text-zinc-700 opacity-50"}`}>
                    <span className="text-[10px] w-3.5 text-center font-bold opacity-60">{i+1}</span>
                    <span>{b.icon}</span>
                    <span className="font-medium">{b.label}</span>
                    {!b.visible && <EyeOff size={9} className="ml-auto opacity-50" />}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
