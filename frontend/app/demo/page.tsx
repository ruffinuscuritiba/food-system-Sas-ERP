"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  LayoutGrid,
  List,
  Loader2,
  Mail,
  MessageCircle,
  Minus,
  Phone,
  RotateCcw,
  Smartphone,
  Star,
  Store,
  TrendingUp,
  UtensilsCrossed,
  User,
  X,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import { DEMO_ACCOUNTS, type DemoAccount } from "@/lib/demoThemes";
import { SUPPORT_WHATSAPP } from "@/config/support";
import { NICHE_DATA, resolveNiche, type NicheKey } from "@/lib/nicheData";

const SPECIALIST_WA_URL = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
  "Olá! Gostaria de falar com um especialista da Ruffinu's FoodSaaS ERP.",
)}`;

// ─── Comparison table ─────────────────────────────────────────────────────────
type PlanKey = "basic" | "pro" | "enterprise";
interface Feature { label: string; basic: boolean; pro: boolean; enterprise: boolean; }

const COMPARISON: Feature[] = [
  { label: "PDV",              basic: true,  pro: true,  enterprise: true  },
  { label: "Pedidos",          basic: true,  pro: true,  enterprise: true  },
  { label: "Cozinha",          basic: true,  pro: true,  enterprise: true  },
  { label: "Mesas",            basic: true,  pro: true,  enterprise: true  },
  { label: "Cardápio Online",  basic: true,  pro: true,  enterprise: true  },
  { label: "Cupons",           basic: false, pro: true,  enterprise: true  },
  { label: "Relatórios",       basic: false, pro: true,  enterprise: true  },
  { label: "WhatsApp IA",      basic: false, pro: true,  enterprise: true  },
  { label: "Multiunidades",    basic: false, pro: false, enterprise: true  },
  { label: "White Label",      basic: false, pro: false, enterprise: true  },
];

// Screenshots agora vêm de NICHE_DATA, dinâmicos por nicho selecionado

function planKey(plan: string): PlanKey { return plan.toLowerCase() as PlanKey; }

// ─── Niche selector list ──────────────────────────────────────────────────────
const NICHES_LIST: { key: NicheKey; emoji: string; label: string }[] = [
  { key: "restaurante", emoji: "🍕", label: "Restaurantes & Pizzarias"    },
  { key: "marmitaria",  emoji: "🍱", label: "Marmitarias & Dark Kitchens" },
  { key: "pastelaria",  emoji: "🥟", label: "Pastelarias & Food Trucks"   },
  { key: "hotdog",      emoji: "🌭", label: "Hot-Dogs & Lanchonetes"      },
];

// ─── Portfolio simulator data ─────────────────────────────────────────────────
interface MenuItem { id: string; name: string; emoji: string; count: number; }

const NICHE_MENU_ITEMS: Record<NicheKey, MenuItem[]> = {
  restaurante: [
    { id: "r1", name: "Pizzas",           emoji: "🍕", count: 12 },
    { id: "r2", name: "Bebidas",          emoji: "🥤", count: 8  },
    { id: "r3", name: "Bordas Especiais", emoji: "🧀", count: 5  },
    { id: "r4", name: "Sobremesas",       emoji: "🍰", count: 4  },
    { id: "r5", name: "Entradas",         emoji: "🥗", count: 6  },
    { id: "r6", name: "Combos",           emoji: "📦", count: 3  },
  ],
  marmitaria: [
    { id: "m1", name: "Proteínas",        emoji: "🥩", count: 8  },
    { id: "m2", name: "Acompanhamentos",  emoji: "🍚", count: 10 },
    { id: "m3", name: "Diet / Fit",       emoji: "🥦", count: 5  },
    { id: "m4", name: "Bebidas",          emoji: "🥤", count: 4  },
    { id: "m5", name: "Encomendas",       emoji: "📦", count: 3  },
    { id: "m6", name: "Sobremesas",       emoji: "🍮", count: 3  },
  ],
  pastelaria: [
    { id: "p1", name: "Pastéis Salgados", emoji: "🥟", count: 15 },
    { id: "p2", name: "Pastéis Doces",    emoji: "🍬", count: 8  },
    { id: "p3", name: "Caldos",           emoji: "🍜", count: 4  },
    { id: "p4", name: "Bebidas Geladas",  emoji: "🧃", count: 6  },
    { id: "p5", name: "Combos",           emoji: "📦", count: 3  },
    { id: "p6", name: "Adicionais",       emoji: "✨", count: 5  },
  ],
  hotdog: [
    { id: "h1", name: "Hot-Dogs",         emoji: "🌭", count: 10 },
    { id: "h2", name: "Hambúrgueres",     emoji: "🍔", count: 8  },
    { id: "h3", name: "Batatas Fritas",   emoji: "🍟", count: 4  },
    { id: "h4", name: "Bebidas",          emoji: "🥤", count: 6  },
    { id: "h5", name: "Porções",          emoji: "🍗", count: 4  },
    { id: "h6", name: "Sobremesas",       emoji: "🍦", count: 3  },
  ],
};

// ─── Pillars data ─────────────────────────────────────────────────────────────
const PILLARS_DATA = [
  {
    id: "operacao",
    icon: Zap,
    title: "Operação rápida",
    badge: "PDV + Cozinha",
    headline: "Menos de 10 segundos\ndo pedido ao fogão.",
    sub: "PDV fluido, cozinha integrada e zero travamento — mesmo no horário de pico mais intenso. Seu time atende mais rápido e erra menos.",
    bullets: [
      "Pedido registrado e enviado à cozinha em menos de 10 segundos",
      "Modo offline: a internet caiu? A operação não para.",
      "Impressão automática na cozinha — sem garçom correndo ao balcão",
      "Caixa, mesa, delivery e balcão em uma única interface unificada",
      "Scanner de código de barras para bebidas: bipe e já adicionou",
    ],
    mockup: 0,
  },
  {
    id: "gestao",
    icon: BarChart3,
    title: "Gestão completa",
    badge: "Financeiro + Estoque",
    headline: "Saiba exatamente o quanto\nvocê lucrou hoje — agora.",
    sub: "Chega de achismos no final do mês. CMV, estoque e fluxo de caixa calculados automaticamente, pedido a pedido, em tempo real.",
    bullets: [
      "CMV calculado por ficha técnica a cada pedido confirmado",
      "Estoque debitado em tempo real: sem contar ingrediente na mão",
      "Relatórios de lucratividade por produto, categoria e período",
      "Controle de caixa com abertura, sangria e fechamento diário",
      "Alertas automáticos antes do ingrediente acabar no meio do pico",
    ],
    mockup: 1,
  },
  {
    id: "cardapio",
    icon: Smartphone,
    title: "Cardápio digital",
    badge: "Sem comissão",
    headline: "Vendas diretas.\nSem pagar comissão\npara ninguém.",
    sub: "Link próprio e personalizado para seu cardápio. Pedidos chegam direto no sistema em tempo real — sem marketplaces, sem taxas abusivas.",
    bullets: [
      "Link próprio do cardápio (0% de comissão para terceiros)",
      "Pedidos chegam direto no PDV e na cozinha, em tempo real",
      "Preços e fotos atualizados em segundos, direto do painel",
      "Aceita PIX, cartão e dinheiro — você escolhe como receber",
      "QR Code gerado para mesa, sacola de delivery ou vitrine da loja",
    ],
    mockup: 2,
  },
  {
    id: "automacao",
    icon: Cpu,
    title: "Automação inteligente",
    badge: "WhatsApp IA · 24h",
    headline: "Sua loja atende e fecha\npedidos às 2h da manhã\nsem você.",
    sub: "Um atendente virtual treinado no seu cardápio, preços e regras de negócio. Opera 24h no WhatsApp da sua empresa, sem pausas e sem erros.",
    bullets: [
      "Tira pedidos completos no WhatsApp sem nenhuma intervenção humana",
      "Aprende cardápio, tamanhos, bordas, complementos e promoções",
      "Faz upsell automático: \"Quer adicionar borda de catupiry?\"",
      "Transfere para humano com o histórico da conversa preservado",
      "Notifica o cliente a cada etapa: confirmado, saiu para entrega, entregue",
    ],
    mockup: 3,
  },
  {
    id: "vendas",
    icon: TrendingUp,
    title: "Mais vendas",
    badge: "Fidelidade + Upsell",
    headline: "Clientes fiéis gastam 67%\nmais. Automatize\na fidelização.",
    sub: "Ferramentas nativas de retenção, upsell e recuperação de clientes inativos — integradas diretamente ao fluxo de pedidos, sem configuração complexa.",
    bullets: [
      "Programa de pontos e cashback no PDV e no cardápio online",
      "Upsell automático no carrinho: combos, bordas e bebidas sugeridas",
      "Cupons de desconto por valor, porcentagem ou frete grátis",
      "Histórico completo de pedidos por cliente para campanhas de retorno",
      "Meta Pixel e Google Analytics integrados para remarketing pago",
    ],
    mockup: 4,
  },
];

// ─── Mockup: PDV ─────────────────────────────────────────────────────────────
function PdvMockup() {
  const products = [
    { name: "Pizza Margherita", price: "R$ 52", c: "bg-orange-500/20" },
    { name: "Burger Classic",   price: "R$ 34", c: "bg-blue-500/20" },
    { name: "Batata Frita P.",  price: "R$ 18", c: "bg-amber-500/20" },
    { name: "Coca-Cola 350ml",  price: "R$ 8",  c: "bg-red-500/20" },
    { name: "Pizza Frango",     price: "R$ 48", c: "bg-purple-500/20" },
    { name: "Milk Shake",       price: "R$ 22", c: "bg-green-500/20" },
  ];
  return (
    <div className="rounded-2xl bg-[#0a0d14] border border-white/[0.08] overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] font-bold text-white/80">PDV — Balcão</span>
        </div>
        <span className="text-[9px] text-white/35">Pedido #142</span>
      </div>
      <div className="flex">
        <div className="flex-1 p-2.5 grid grid-cols-3 gap-1.5">
          {products.map((p) => (
            <div key={p.name} className={`rounded-xl ${p.c} border border-white/[0.06] p-2 cursor-pointer`}>
              <div className="h-8 rounded-lg bg-white/[0.07] mb-1.5" />
              <p className="text-[7.5px] font-semibold text-white/75 truncate leading-tight">{p.name}</p>
              <p className="text-[9px] font-black text-orange-400">{p.price}</p>
            </div>
          ))}
        </div>
        <div className="w-[96px] border-l border-white/[0.06] p-2.5 flex flex-col bg-black/20">
          <p className="text-[7.5px] font-black text-white/50 uppercase tracking-wide mb-2">Carrinho</p>
          <div className="flex-1 space-y-1.5">
            {[["1× Pizza Mg.", "52,00"], ["2× Burger Cl.", "68,00"], ["1× Coca-Cola", "8,00"]].map(([l, v]) => (
              <div key={l} className="flex justify-between">
                <span className="text-[7px] text-white/55">{l}</span>
                <span className="text-[7px] text-white/35">{v}</span>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-white/[0.06] mt-2 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[7px] text-white/35">Total</span>
              <span className="text-[9px] text-white font-black">R$ 128,00</span>
            </div>
            <div className="rounded-lg bg-orange-500 py-1.5 text-center text-[7.5px] font-black text-white cursor-pointer">
              Finalizar
            </div>
          </div>
        </div>
      </div>
      <div className="px-3.5 py-1.5 bg-white/[0.015] border-t border-white/[0.05] flex items-center">
        <span className="text-[7px] text-white/25">Caixa: Felipe • turno 18h</span>
        <span className="ml-auto text-[7px] text-green-400">● 3 pedidos ativos</span>
      </div>
    </div>
  );
}

// ─── Mockup: Dashboard Financeiro ────────────────────────────────────────────
function DashboardMockup() {
  const bars = [55, 38, 75, 50, 90, 68, 82];
  return (
    <div className="rounded-2xl bg-[#0a0d14] border border-white/[0.08] overflow-hidden shadow-2xl">
      <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[10px] font-bold text-white/80">Painel Financeiro</span>
        <span className="text-[9px] text-white/30">Hoje · Jun 20</span>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { l: "Receita Hoje", v: "R$ 2.840", c: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
            { l: "CMV",          v: "28,4%",    c: "text-blue-400",  bg: "bg-blue-500/10 border-blue-500/20" },
            { l: "Lucro",        v: "R$ 718",   c: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
          ].map((k) => (
            <div key={k.l} className={`${k.bg} rounded-xl border p-2.5`}>
              <p className="text-[7px] text-white/35 mb-0.5">{k.l}</p>
              <p className={`text-[11px] font-black ${k.c}`}>{k.v}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-2.5">
          <p className="text-[7.5px] text-white/35 mb-2">Receita por dia (semana atual)</p>
          <div className="flex items-end gap-1 h-14">
            {bars.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full rounded-t-sm" style={{ height: `${h}%`, background: i === 4 ? "#f97316" : "rgba(249,115,22,0.45)" }} />
                <span className="text-[5.5px] text-white/20">{["S","T","Q","Q","S","S","D"][i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-2.5">
          <p className="text-[7.5px] text-white/35 mb-2">Produtos mais lucrativos</p>
          {[["Pizza Margherita", "68%", 85], ["Burger Classic", "54%", 65], ["Batata Frita", "72%", 45]].map(([n, m, b]) => (
            <div key={n as string} className="flex items-center gap-2 mb-1.5">
              <span className="text-[7px] text-white/55 w-20 truncate">{n}</span>
              <div className="flex-1 h-1 rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-green-500/70" style={{ width: `${b}%` }} />
              </div>
              <span className="text-[7px] text-green-400 font-bold">{m}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Mockup: Cardápio Mobile ──────────────────────────────────────────────────
function MenuMockup() {
  return (
    <div className="flex justify-center">
      <div className="relative w-[188px]">
        <div className="rounded-[2.2rem] bg-[#1a1a2e] border-[4px] border-[#2a2a40] shadow-2xl overflow-hidden">
          <div className="flex justify-center pt-2 pb-1 bg-[#0f0f1e]">
            <div className="w-16 h-3 rounded-full bg-[#2a2a40]" />
          </div>
          <div className="bg-white text-gray-900">
            <div className="px-3 pt-3 pb-2.5 bg-orange-500">
              <p className="text-[8.5px] font-black text-white">🍕 Bella Napoli</p>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-[6.5px] text-white/80">Aberto · Entrega ~35 min</p>
                <span className="text-[6px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-bold">Frete R$ 5,00</span>
              </div>
            </div>
            <div className="flex gap-1.5 px-2.5 py-2">
              {["Pizzas","Bebidas","Bordas","Combos"].map((c, i) => (
                <span key={c} className={`text-[6.5px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${i === 0 ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-500"}`}>{c}</span>
              ))}
            </div>
            <div className="px-2.5 space-y-1.5">
              {[
                { n: "Pizza Margherita", d: "Molho, muzz, manjericão", p: "R$ 52,00" },
                { n: "Pizza Frango", d: "Frango, cheddar, milho", p: "R$ 48,00" },
              ].map((p) => (
                <div key={p.n} className="flex items-center gap-2 rounded-xl bg-gray-50 p-2 border border-gray-100">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex-shrink-0 flex items-center justify-center text-lg">🍕</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[7.5px] font-black text-gray-900 leading-tight">{p.n}</p>
                    <p className="text-[6px] text-gray-400 truncate">{p.d}</p>
                    <p className="text-[8px] font-black text-orange-500 mt-0.5">{p.p}</p>
                  </div>
                  <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-white text-[11px] font-black leading-none">+</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mx-2.5 mt-2 mb-2 rounded-xl bg-orange-500 py-2 flex items-center justify-between px-3 shadow-md">
              <span className="text-[7.5px] font-black text-white">Ver pedido (1 item)</span>
              <span className="text-[7.5px] font-black text-white">R$ 52,00</span>
            </div>
          </div>
          <div className="flex justify-center py-1.5 bg-white">
            <div className="w-10 h-[3px] rounded-full bg-gray-200" />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 rounded-[2.2rem]"
          style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,transparent 50%)" }}
        />
      </div>
    </div>
  );
}

// ─── Mockup: WhatsApp Chat ────────────────────────────────────────────────────
function ChatMockup() {
  const messages = [
    { from: "c", text: "Boa tarde! Quero fazer um pedido 😊" },
    { from: "b", text: "Olá! Bem-vindo à Bella Napoli 🍕 O que você vai querer hoje?" },
    { from: "c", text: "Pizza grande de frango com borda de catupiry" },
    { from: "b", text: "Anotado! Pizza Grande Frango + Borda Catupiry = R$ 68,00.\n\nVai pagar como — PIX ou Cartão?" },
    { from: "c", text: "PIX" },
    { from: "b", text: "✅ Pedido #143 confirmado! Tempo estimado: 40 min. Mandei o QR Code do PIX por aqui 👆" },
  ];
  const times = ["14:23","14:23","14:24","14:24","14:25","14:25"];
  return (
    <div className="rounded-2xl bg-[#0b1521] border border-white/[0.08] overflow-hidden shadow-2xl">
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-[#1a2c3a]">
        <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-[9px] font-black flex-shrink-0">BN</div>
        <div>
          <p className="text-[10px] font-bold text-white leading-tight">Bella Napoli</p>
          <p className="text-[7px] text-green-400">● online agora · atendente virtual</p>
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          {[0,1,2].map(i => <div key={i} className="w-[3px] h-[3px] rounded-full bg-white/25" />)}
        </div>
      </div>
      <div className="p-2.5 space-y-1.5" style={{ background: "#0d1f2d" }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.from === "c" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[82%] rounded-2xl px-2.5 py-1.5 ${msg.from === "c" ? "bg-[#005c4b] rounded-tr-sm" : "bg-[#1f2c33] rounded-tl-sm"}`}>
              <p className="text-[7.5px] text-white/90 leading-relaxed whitespace-pre-line">{msg.text}</p>
              <p className={`text-[5.5px] mt-0.5 ${msg.from === "c" ? "text-right text-white/35" : "text-white/25"}`}>{times[i]} ✓✓</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 px-2.5 py-2 bg-[#1a2c3a]">
        <div className="flex-1 rounded-2xl bg-[#2a3c4a] px-3 py-1.5">
          <p className="text-[7.5px] text-white/20">Mensagem</p>
        </div>
        <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
          <ArrowRight size={11} className="text-white" />
        </div>
      </div>
    </div>
  );
}

// ─── Mockup: Fidelidade & Mais Vendas ────────────────────────────────────────
function LoyaltyMockup() {
  return (
    <div className="rounded-2xl bg-[#0a0d14] border border-white/[0.08] overflow-hidden shadow-2xl">
      <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[10px] font-bold text-white/80">Fidelidade & Mais Vendas</span>
        <span className="text-[8.5px] text-green-400">● ativo</span>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="rounded-xl bg-gradient-to-r from-orange-600/25 to-orange-500/8 border border-orange-500/20 p-3">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <p className="text-[7px] text-orange-300/60 mb-0.5">Cliente Fiel · Gold</p>
              <p className="text-[11px] font-black text-white">João Silva</p>
            </div>
            <div className="text-right">
              <p className="text-[7px] text-orange-300/60 mb-0.5">Seus pontos</p>
              <p className="text-[16px] font-black text-orange-400 leading-none">1.240 <span className="text-[9px]">pts</span></p>
            </div>
          </div>
          <div className="h-1 rounded-full bg-white/10 mb-1">
            <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500" style={{ width: "62%" }} />
          </div>
          <p className="text-[6.5px] text-white/35">620 pts para o próximo brinde grátis</p>
        </div>

        <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Star size={9} className="text-blue-400 fill-blue-400" />
            <p className="text-[8px] font-bold text-blue-300">Sugestão inteligente no carrinho</p>
          </div>
          <p className="text-[7px] text-white/50 mb-2">João adicionou Pizza — sugerir complemento?</p>
          <div className="flex gap-1.5">
            {[["+ Borda Catupiry", "+R$ 12"], ["+ Combo Bebida", "+R$ 8"]].map(([l, p]) => (
              <div key={l} className="flex-1 rounded-lg bg-blue-500/15 border border-blue-500/25 py-1.5 px-2 text-center">
                <p className="text-[7px] font-black text-blue-300">{l}</p>
                <p className="text-[6px] text-white/35">{p}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {[
            { l: "Cupons ativos",  v: "4",  c: "text-green-400",  bg: "bg-green-500/10 border-green-500/20" },
            { l: "Resgatados",     v: "38", c: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20" },
            { l: "Clientes VIP",  v: "12", c: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
          ].map((s) => (
            <div key={s.l} className={`rounded-xl border ${s.bg} p-2 text-center`}>
              <p className={`text-[14px] font-black ${s.c} leading-none`}>{s.v}</p>
              <p className="text-[6px] text-white/35 mt-0.5 leading-tight">{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const MOCKUP_COMPONENTS = [PdvMockup, DashboardMockup, MenuMockup, ChatMockup, LoyaltyMockup];

// ─── Hero Device Mockup (iMac monitor) ──────────────────────────────────────
function HeroDeviceMockup() {
  return (
    <div className="relative w-full max-w-xl select-none">
      {/* Monitor body */}
      <div className="relative rounded-[18px] bg-[#1c1c1e] p-[5px] shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_30px_70px_-15px_rgba(0,0,0,0.85),0_0_80px_-30px_rgba(249,115,22,0.18)]">
        {/* Camera dot */}
        <div className="flex justify-center py-2.5">
          <div className="w-2 h-2 rounded-full bg-[#3a3a3c]" />
        </div>
        {/* Screen — 16:10 */}
        <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "8/5" }}>
          {/* Simulated FoodSaaS landing page inside the monitor */}
          <div className="h-full bg-[#09090b] flex flex-col">
            {/* Top nav */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#0f1117] border-b border-white/[0.06] flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-orange-500 flex items-center justify-center">
                  <span className="text-[5px] font-black text-white">F</span>
                </div>
                <span className="text-[7px] font-black text-white/70">FoodSaaS ERP</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[6px] text-white/30 hidden sm:block">Sistema</span>
                <div className="rounded-full bg-orange-500 px-2 py-0.5">
                  <span className="text-[5.5px] font-black text-white">Agendar Demo</span>
                </div>
              </div>
            </div>

            {/* Feature cards row */}
            <div className="flex gap-1.5 px-3 pt-2 pb-1.5 flex-shrink-0">
              {[
                { icon: "⚡", t: "Operação rápida",   s: "PDV otimizado para velocidade" },
                { icon: "📊", t: "Gestão completa",   s: "Financeiro, dossiê e relatórios" },
                { icon: "📱", t: "Cardápio digital",  s: "Cardápio online com pedidos" },
                { icon: "🤖", t: "Automação",         s: "IA no WhatsApp para vender" },
              ].map((f) => (
                <div key={f.t} className="flex-1 rounded-lg bg-white/[0.04] border border-white/[0.06] p-1.5">
                  <span className="text-[8px]">{f.icon}</span>
                  <p className="text-[4.5px] font-black text-white/80 mt-0.5 leading-tight">{f.t}</p>
                  <p className="text-[3.5px] text-white/35 leading-tight mt-0.5 hidden lg:block">{f.s}</p>
                </div>
              ))}
            </div>

            {/* Main split: text left + PDV right */}
            <div className="flex-1 flex gap-2 px-3 pb-2 min-h-0">
              {/* Left text */}
              <div className="w-[30%] flex-shrink-0 flex flex-col justify-center">
                <p className="text-[5px] font-black text-orange-400 uppercase tracking-widest mb-1">PDV</p>
                <h3 className="text-[9px] font-black text-white leading-tight">
                  OPERAÇÃO<br />RÁPIDA:<br />
                  <span className="text-orange-400">AGILIZADO</span>
                </h3>
                <ul className="mt-1.5 space-y-0.5">
                  {["Lançamento de pedidos em 3 segundos", "Interface tátil e intuitiva", "Integração instantânea com KDS"].map((b) => (
                    <li key={b} className="flex items-start gap-1">
                      <span className="mt-[1.5px] w-1 h-1 rounded-full bg-orange-500 flex-shrink-0" />
                      <span className="text-[4px] text-white/55 leading-tight">{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 rounded-lg bg-orange-500 px-2 py-1 text-center">
                  <span className="text-[5px] font-black text-white">Agendar Demo</span>
                </div>
              </div>

              {/* Right PDV screenshot */}
              <div className="flex-1 rounded-xl bg-[#0d1020] border border-white/[0.08] overflow-hidden flex flex-col">
                <div className="px-2 py-1 bg-[#111828] border-b border-white/[0.06] flex justify-between items-center flex-shrink-0">
                  <span className="text-[5px] font-black text-white/60">PDV · Today</span>
                  <span className="text-[4px] text-white/20">Current Order</span>
                </div>
                <div className="flex flex-1 min-h-0">
                  {/* Product grid */}
                  <div className="flex-1 p-1.5 grid grid-cols-3 gap-1 content-start">
                    {[
                      { n: "Pizza Mg.", c: "bg-orange-500/15", emoji: "🍕" },
                      { n: "Hambúrg.", c: "bg-yellow-500/15", emoji: "🍔" },
                      { n: "Batata",   c: "bg-amber-500/15",  emoji: "🍟" },
                      { n: "Coca",     c: "bg-red-500/15",    emoji: "🥤" },
                      { n: "Pizza Fg.", c: "bg-orange-500/15", emoji: "🍕" },
                      { n: "Hambúrg.", c: "bg-yellow-500/15", emoji: "🍔" },
                    ].map((p, i) => (
                      <div key={i} className={`${p.c} rounded-lg border border-white/[0.05] p-1`}>
                        <div className="h-6 rounded-md bg-white/[0.06] mb-0.5 flex items-center justify-center text-[10px]">
                          {p.emoji}
                        </div>
                        <p className="text-[4px] text-white/55 truncate leading-tight">{p.n}</p>
                      </div>
                    ))}
                  </div>
                  {/* Cart sidebar */}
                  <div className="w-14 border-l border-white/[0.06] p-1.5 bg-black/20 flex flex-col">
                    <p className="text-[4.5px] font-black text-white/35 uppercase tracking-wide mb-1">Carrinho</p>
                    <div className="flex-1 space-y-0.5">
                      {[["1× Pizza", "31,99"], ["Garçom 1", "3,00"], ["Sobrem 2", "1,99"]].map(([l, v]) => (
                        <div key={l} className="flex justify-between">
                          <span className="text-[4px] text-white/40">{l}</span>
                          <span className="text-[4px] text-white/25">{v}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-1 border-t border-white/[0.06]">
                      <div className="flex justify-between mb-1">
                        <span className="text-[4px] text-white/30">Total</span>
                        <span className="text-[5px] font-black text-white">$35,00</span>
                      </div>
                      <div className="rounded bg-orange-500 py-1 text-center">
                        <span className="text-[4.5px] font-black text-white">Finalizar</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom chin */}
        <div className="h-6 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full border border-white/[0.08]" />
        </div>
      </div>

      {/* Stand neck — trapezoid */}
      <div
        className="mx-auto"
        style={{
          width: 56,
          height: 44,
          background: "linear-gradient(180deg, #2a2a2e 0%, #1c1c1e 100%)",
          clipPath: "polygon(28% 0%, 72% 0%, 85% 100%, 15% 100%)",
        }}
      />
      {/* Base */}
      <div
        className="mx-auto rounded-full shadow-[0_4px_16px_-4px_rgba(0,0,0,0.6)]"
        style={{ width: 160, height: 8, background: "linear-gradient(180deg, #2a2a2e, #1c1c1e)" }}
      />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-orange-500/[0.06] blur-3xl" />
    </div>
  );
}

// ─── Interactive Pillars Section ──────────────────────────────────────────────
function PillarsSection() {
  const [active, setActive] = useState(0);
  const pillar = PILLARS_DATA[active];
  const ActiveMockup = MOCKUP_COMPONENTS[active];

  return (
    <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
      {/* Tab row */}
      <div className="flex flex-wrap gap-2 justify-center mb-10">
        {PILLARS_DATA.map((p, i) => {
          const Icon = p.icon;
          const on = i === active;
          return (
            <button
              key={p.id}
              onClick={() => setActive(i)}
              className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition-all duration-200 ${
                on
                  ? "border-orange-500/50 bg-orange-500/15 text-white shadow-[0_0_20px_-4px_rgba(249,115,22,0.35)]"
                  : "border-white/[0.07] bg-white/[0.025] text-white/50 hover:border-white/[0.13] hover:bg-white/[0.04] hover:text-white/80"
              }`}
            >
              <Icon className={`h-4 w-4 flex-shrink-0 ${on ? "text-orange-400" : "text-white/35"}`} />
              <span className="hidden sm:inline">{p.title}</span>
              <span className="sm:hidden text-xs">{p.title.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div key={active} className="grid lg:grid-cols-2 gap-0" style={{ animation: "pillarFade 0.28s ease forwards" }}>
          {/* Left: copy */}
          <div className="p-8 sm:p-10 lg:p-12 flex flex-col justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-orange-400 mb-6 self-start">
              {pillar.badge}
            </span>

            <h3 className="text-3xl font-black leading-[1.1] tracking-tight text-white sm:text-4xl whitespace-pre-line">
              {pillar.headline}
            </h3>

            <p className="mt-4 text-base text-white/55 leading-relaxed max-w-md">
              {pillar.sub}
            </p>

            <ul className="mt-8 space-y-3.5">
              {pillar.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/15 ring-1 ring-orange-500/25">
                    <Check className="h-3 w-3 text-orange-400" strokeWidth={3} />
                  </span>
                  <span className="text-sm text-white/70 leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: mockup */}
          <div className="p-8 sm:p-10 lg:p-12 flex items-center justify-center bg-white/[0.01] border-t border-white/[0.06] lg:border-t-0 lg:border-l lg:border-white/[0.06]">
            <div className="w-full max-w-sm">
              <ActiveMockup />
            </div>
          </div>
        </div>
      </div>

      {/* Keyframe inject */}
      <style>{`
        @keyframes pillarFade {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}

// ─── Portfolio Simulator ──────────────────────────────────────────────────────
interface PortfolioSimulatorProps { niche: NicheKey; }

function PortfolioSimulator({ niche }: PortfolioSimulatorProps) {
  const [items, setItems] = useState<MenuItem[]>(() => [...NICHE_MENU_ITEMS[niche]]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const nicheEmoji = NICHE_DATA[niche].badge.split(" ")[0];

  function startEdit(item: MenuItem) { setEditingId(item.id); setEditValue(item.name); }
  function commitEdit(id: string) {
    if (editValue.trim()) setItems((p) => p.map((i) => i.id === id ? { ...i, name: editValue.trim() } : i));
    setEditingId(null);
  }
  function deleteItem(id: string) { setItems((p) => p.filter((i) => i.id !== id)); }
  function moveItem(index: number, dir: -1 | 1) {
    const nx = index + dir;
    if (nx < 0 || nx >= items.length) return;
    const next = [...items];
    [next[index], next[nx]] = [next[nx], next[index]];
    setItems(next);
  }

  return (
    <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-3">
            Simulador Interativo
          </span>
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Simule o cardápio do seu negócio
          </h2>
          <p className="mt-1.5 text-sm text-white/45 max-w-lg">
            Edite nomes, reordene categorias e exclua o que não quiser — veja em tempo real como ficaria seu cardápio digital.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
            {(["grid", "list"] as const).map((mode) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${viewMode === mode ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/70"}`}>
                {mode === "grid" ? <><LayoutGrid className="h-3.5 w-3.5" /> Grade</> : <><List className="h-3.5 w-3.5" /> Lista</>}
              </button>
            ))}
          </div>
          <button onClick={() => { setItems([...NICHE_MENU_ITEMS[niche]]); setEditingId(null); }}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/10 hover:text-white">
            <RotateCcw className="h-3 w-3" /> Resetar
          </button>
        </div>
      </div>

      {/* Mock browser frame */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0b0e18] overflow-hidden shadow-2xl">
        {/* Browser bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex gap-1.5">
            {["bg-red-500/50", "bg-yellow-500/50", "bg-green-500/50"].map((c, i) => (
              <div key={i} className={`w-2.5 h-2.5 rounded-full ${c}`} />
            ))}
          </div>
          <div className="flex-1 mx-3 rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-1 text-[10px] text-white/25 font-mono">
            cardapio.foodsaas.app/minha-loja
          </div>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-400/20 border border-green-400/30">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          </span>
        </div>

        {/* Menu header */}
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center text-xl">
              {nicheEmoji}
            </div>
            <div>
              <p className="text-sm font-black text-white leading-tight">Minha Loja</p>
              <p className="text-[10px] text-green-400">● Aberto · Pedidos online ativos</p>
            </div>
          </div>
          <span className="text-[10px] text-white/30 border border-white/[0.08] rounded-full px-2.5 py-1">
            {items.length} categoria{items.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm font-semibold text-white/50">Sem categorias</p>
            <p className="text-xs text-white/30 mt-1">Clique em &quot;Resetar&quot; para restaurar</p>
          </div>
        )}

        {/* Grid view */}
        {items.length > 0 && viewMode === "grid" && (
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items.map((item, index) => (
              <div key={item.id} className="group relative rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 transition-all hover:border-orange-500/20 hover:bg-white/[0.05]">
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <button onClick={() => moveItem(index, -1)} disabled={index === 0}
                    className="w-5 h-5 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed transition">
                    <ChevronUp className="h-2.5 w-2.5 text-white" />
                  </button>
                  <button onClick={() => moveItem(index, 1)} disabled={index === items.length - 1}
                    className="w-5 h-5 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed transition">
                    <ChevronDown className="h-2.5 w-2.5 text-white" />
                  </button>
                  <button onClick={() => deleteItem(item.id)}
                    className="w-5 h-5 rounded-md bg-red-500/15 hover:bg-red-500/35 flex items-center justify-center transition">
                    <X className="h-2.5 w-2.5 text-red-400" />
                  </button>
                </div>
                <div className="text-3xl mb-3 leading-none">{item.emoji}</div>
                {editingId === item.id ? (
                  <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitEdit(item.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitEdit(item.id); if (e.key === "Escape") setEditingId(null); }}
                    className="w-full bg-white/10 border border-orange-500/60 rounded-lg px-2 py-1 text-xs font-bold text-white focus:outline-none focus:border-orange-500" />
                ) : (
                  <p onClick={() => startEdit(item)} title="Clique para editar"
                    className="text-xs font-bold text-white/85 cursor-text hover:text-orange-400 transition-colors leading-snug">
                    {item.name}
                  </p>
                )}
                <p className="text-[10px] text-white/30 mt-1">{item.count} itens</p>
              </div>
            ))}
          </div>
        )}

        {/* List view */}
        {items.length > 0 && viewMode === "list" && (
          <div className="divide-y divide-white/[0.04]">
            {items.map((item, index) => (
              <div key={item.id} className="group flex items-center gap-4 px-5 py-3 transition hover:bg-white/[0.02]">
                <span className="text-2xl flex-shrink-0 w-8 text-center">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  {editingId === item.id ? (
                    <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(item.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") commitEdit(item.id); if (e.key === "Escape") setEditingId(null); }}
                      className="w-full max-w-[220px] bg-white/10 border border-orange-500/60 rounded-lg px-2 py-0.5 text-sm font-bold text-white focus:outline-none" />
                  ) : (
                    <p onClick={() => startEdit(item)} title="Clique para editar"
                      className="text-sm font-bold text-white/85 cursor-text hover:text-orange-400 transition-colors truncate">
                      {item.name}
                    </p>
                  )}
                  <p className="text-[10px] text-white/30">{item.count} itens</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <button onClick={() => moveItem(index, -1)} disabled={index === 0}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed transition">
                    <ChevronUp className="h-3.5 w-3.5 text-white" />
                  </button>
                  <button onClick={() => moveItem(index, 1)} disabled={index === items.length - 1}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed transition">
                    <ChevronDown className="h-3.5 w-3.5 text-white" />
                  </button>
                  <button onClick={() => deleteItem(item.id)}
                    className="w-7 h-7 rounded-lg bg-red-500/15 hover:bg-red-500/35 flex items-center justify-center transition">
                    <X className="h-3.5 w-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Hint footer */}
        <div className="px-5 py-3 border-t border-white/[0.05] bg-white/[0.01]">
          <p className="text-[10px] text-white/20">
            💡 Passe o mouse sobre uma categoria para editar, reordenar ou excluir
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Lead Capture Modal ───────────────────────────────────────────────────────
interface LeadForm { name: string; email: string; whatsapp: string; restaurantName: string; }
interface LeadCaptureModalProps { demo: DemoAccount; onClose: () => void; onConfirm: (form: LeadForm) => Promise<void>; loading: boolean; }

function LeadCaptureModal({ demo, onClose, onConfirm, loading }: LeadCaptureModalProps) {
  const [form, setForm] = useState<LeadForm>({ name: "", email: "", whatsapp: "", restaurantName: "" });
  const color = demo.primaryColor;

  function formatPhone(raw: string) {
    const d = raw.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim())    { toast.error("Informe seu nome."); return; }
    if (!form.email.includes("@")) { toast.error("Informe um e-mail válido."); return; }
    if (!form.restaurantName.trim()) { toast.error("Informe o nome do restaurante."); return; }
    await onConfirm(form);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0d1117] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-25"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}88, transparent 70%)` }} aria-hidden />
        <div className="relative flex items-center justify-between px-7 pt-7 pb-0">
          <div>
            <span className="inline-block rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest mb-3"
              style={{ color, backgroundColor: `${color}22`, border: `1px solid ${color}44` }}>
              Demo {demo.plan}
            </span>
            <h2 className="text-xl font-black text-white leading-tight">Acesso à demonstração</h2>
            <p className="mt-1 text-sm text-white/50">Preencha seus dados e explore o sistema completo — sem custo.</p>
          </div>
          <button onClick={onClose} className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition">
            <X size={14} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="relative px-7 py-6 space-y-4">
          {[
            { label: "Seu nome *", type: "text", Icon: User, key: "name", placeholder: "João Silva" },
            { label: "E-mail *", type: "email", Icon: Mail, key: "email", placeholder: "joao@meurestaurante.com.br" },
            { label: "WhatsApp (opcional)", type: "tel", Icon: Phone, key: "whatsapp", placeholder: "(11) 99999-9999" },
            { label: "Nome do restaurante *", type: "text", Icon: Store, key: "restaurantName", placeholder: "Pizzaria Bella Napoli" },
          ].map(({ label, type, Icon, key, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-white/60 mb-1.5">{label}</label>
              <div className="relative">
                <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type={type}
                  value={form[key as keyof LeadForm]}
                  onChange={(e) => {
                    const v = key === "whatsapp" ? formatPhone(e.target.value) : e.target.value;
                    setForm((f) => ({ ...f, [key]: v }));
                  }}
                  placeholder={placeholder}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/25 transition"
                  autoFocus={key === "name"}
                />
              </div>
            </div>
          ))}
          <button type="submit" disabled={loading}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: color, boxShadow: `0 8px 24px -8px ${color}cc, inset 0 1px 0 rgba(255,255,255,0.15)` }}>
            {loading ? (<><Loader2 className="h-4 w-4 animate-spin" />Entrando…</>) : (<>Entrar na demonstração <ArrowRight className="h-4 w-4" /></>)}
          </button>
          <p className="text-center text-[11px] text-white/25 pt-1">Sem cartão de crédito. Acesso imediato. Dados protegidos.</p>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function DemoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedNiche, setSelectedNiche] = useState<NicheKey>(() =>
    resolveNiche(searchParams.get("niche"))
  );
  const nicheContent = NICHE_DATA[selectedNiche];
  const { setAuth } = useAuthStore();
  const [entering, setEntering] = useState<string | null>(null);
  const [modalDemo, setModalDemo] = useState<DemoAccount | null>(null);
  const demoSectionRef = useRef<HTMLElement>(null);

  async function enterDemoWithLead(demo: DemoAccount, form: LeadForm) {
    setEntering(demo.id);
    try {
      const { data } = await api.post("auth/demo-access", {
        name: form.name, email: form.email, whatsapp: form.whatsapp,
        restaurantName: form.restaurantName,
        plan: demo.plan.toLowerCase() as "basic" | "pro" | "enterprise",
      });
      const { accessToken, user } = data;
      if (!accessToken) { toast.error("Demonstração indisponível."); return; }
      setAuth(accessToken, user);
      document.cookie = `token=${accessToken}; path=/`;
      localStorage.setItem("token", accessToken);
      localStorage.setItem("user", JSON.stringify(user));
      setModalDemo(null);
      toast.success(`Bem-vindo à demo ${demo.plan}!`);
      router.push("/pdv");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Não foi possível abrir esta demonstração.");
    } finally {
      setEntering(null);
    }
  }

  function scrollToDemo() {
    demoSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-[#07090f] text-white selection:bg-orange-500/30">
      {modalDemo && (
        <LeadCaptureModal
          demo={modalDemo}
          loading={entering === modalDemo.id}
          onClose={() => { if (!entering) setModalDemo(null); }}
          onConfirm={(form) => enterDemoWithLead(modalDemo, form)}
        />
      )}

      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-60 left-1/3 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-orange-500/8 blur-[180px]" />
        <div className="absolute top-1/2 -right-40 h-[400px] w-[600px] rounded-full bg-violet-600/8 blur-[160px]" />
        <div className="absolute bottom-0 left-1/4 h-[300px] w-[500px] rounded-full bg-blue-600/6 blur-[140px]" />
      </div>

      <div className="relative z-10">

        {/* ── HEADER ── */}
        <header className="sticky top-0 z-50 border-b border-white/5 bg-[#07090f]/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-orange-500/15 p-2 ring-1 ring-orange-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <UtensilsCrossed className="h-4 w-4 text-orange-400" />
              </div>
              <span className="text-base font-black tracking-tight">FoodSaaS ERP</span>
            </div>
            <nav className="flex items-center gap-3">
              <button onClick={scrollToDemo}
                className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 sm:block">
                Ver demos
              </button>
              <a href={SPECIALIST_WA_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-black text-white shadow-[0_4px_14px_-4px_rgba(249,115,22,0.7),inset_0_1px_0_rgba(255,255,255,0.15)] transition hover:bg-orange-600">
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Falar com Especialista</span>
                <span className="sm:hidden">Especialista</span>
              </a>
            </nav>
          </div>
        </header>

        {/* ── HERO ── */}
        <section className="mx-auto max-w-7xl px-5 pb-12 pt-20 sm:px-8 sm:pb-16 sm:pt-28">
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-14">

            {/* Left column — copy */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex flex-col items-center lg:items-start gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-orange-400">
                  Demonstrações ao vivo
                </span>
                {selectedNiche !== "restaurante" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold text-white/55">
                    {nicheContent.badge}
                  </span>
                )}
              </div>

              <h1 className="mt-7 text-5xl font-black leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
                FoodSaaS{" "}
                <span className="bg-gradient-to-r from-orange-400 via-orange-300 to-amber-400 bg-clip-text text-transparent">
                  ERP
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-relaxed text-white/50 sm:text-lg mx-auto lg:mx-0">
                Sistema completo para{" "}
                <span className="text-white/80 font-semibold">{nicheContent.heroHighlight}</span>
                {selectedNiche === "restaurante" && (
                  <>
                    ,{" "}
                    <span className="text-white/80 font-semibold">delivery & dark kitchens</span>,{" "}
                    <span className="text-white/80 font-semibold">conveniências, pastelarias</span>{" "}
                    e <span className="text-white/80 font-semibold">marmitarias</span>
                  </>
                )}
                .
              </p>

              <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <button onClick={scrollToDemo}
                  className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-7 py-4 text-sm font-black text-white shadow-[0_8px_24px_-6px_rgba(249,115,22,0.6),inset_0_1px_0_rgba(255,255,255,0.15)] transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-[0_12px_30px_-6px_rgba(249,115,22,0.7)]">
                  Testar Demonstrações
                  <ChevronDown className="h-4 w-4" />
                </button>
                <a href={SPECIALIST_WA_URL} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-7 py-4 text-sm font-semibold text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur transition hover:border-white/20 hover:bg-white/10">
                  <MessageCircle className="h-4 w-4" />
                  Falar com Especialista
                </a>
              </div>
            </div>

            {/* Right column — iMac mockup (hidden on mobile, visible lg+) */}
            <div className="hidden lg:block w-full max-w-[520px] flex-shrink-0">
              <HeroDeviceMockup />
            </div>

          </div>
        </section>

        {/* ── PILLARS (interactive tabs) ── */}
        <PillarsSection />

        {/* ── NICHE SELECTOR + PLAN CARDS ── */}
        <section id="demos" ref={demoSectionRef} className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Para qual segmento você quer ver a demo?</h2>
            <p className="mt-3 text-sm text-white/50">Clique no seu tipo de negócio — os planos se adaptam na hora.</p>
          </div>

          {/* Niche pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {NICHES_LIST.map((n) => {
              const isActive = selectedNiche === n.key;
              return (
                <button key={n.key} onClick={() => setSelectedNiche(n.key)}
                  className={`flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-bold transition-all duration-200 ${
                    isActive
                      ? "border-orange-500/50 bg-orange-500/15 text-white shadow-[0_0_24px_-4px_rgba(249,115,22,0.4)]"
                      : "border-white/[0.07] bg-white/[0.025] text-white/55 hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white/85"
                  }`}>
                  <span className="text-base">{n.emoji}</span>
                  <span>{n.label}</span>
                </button>
              );
            })}
          </div>

          {/* Plan cards — dynamic */}
          <div className="grid gap-6 md:grid-cols-3">
            {DEMO_ACCOUNTS.map((demo) => {
              const pk = planKey(demo.plan);
              const enriched: DemoAccount = {
                ...demo,
                tagline:  nicheContent.plans[pk].tagline,
                features: nicheContent.plans[pk].features,
              };
              return (
                <DemoCard
                  key={demo.id}
                  demo={enriched}
                  screenshot={nicheContent.screenshots[pk]}
                  loading={entering === demo.id}
                  disabled={entering !== null && entering !== demo.id}
                  onSelect={() => setModalDemo(enriched)}
                />
              );
            })}
          </div>
        </section>

        {/* ── PORTFOLIO SIMULATOR ── */}
        <PortfolioSimulator key={selectedNiche} niche={selectedNiche} />

        {/* ── COMPARISON TABLE ── */}
        <section className="mx-auto max-w-4xl px-5 pb-28 sm:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Comparativo de planos</h2>
            <p className="mt-3 text-sm text-white/50">Escolha o plano ideal para o tamanho da sua operação.</p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur">
            <div className="grid grid-cols-4 border-b border-white/[0.07] bg-white/[0.03]">
              <div className="p-5" />
              {(["BASIC", "PRO", "ENTERPRISE"] as const).map((plan, i) => {
                const colors = ["#16a34a", "#2563eb", "#7c3aed"];
                return (
                  <div key={plan} className="border-l border-white/[0.07] p-5 text-center">
                    <span className="inline-block rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                      style={{ color: colors[i], backgroundColor: `${colors[i]}22`, border: `1px solid ${colors[i]}44` }}>
                      {plan}
                    </span>
                  </div>
                );
              })}
            </div>
            {COMPARISON.map((feat, idx) => (
              <div key={feat.label}
                className={`grid grid-cols-4 border-b border-white/[0.05] transition hover:bg-white/[0.02] ${idx === COMPARISON.length - 1 ? "border-b-0" : ""}`}>
                <div className="flex items-center px-5 py-4 text-sm font-medium text-white/75">{feat.label}</div>
                {(["basic", "pro", "enterprise"] as PlanKey[]).map((key, i) => {
                  const colors = ["#16a34a", "#2563eb", "#7c3aed"];
                  const val = feat[key];
                  return (
                    <div key={key} className="flex items-center justify-center border-l border-white/[0.05] py-4">
                      {val ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: `${colors[i]}22` }}>
                          <Check className="h-3.5 w-3.5" style={{ color: colors[i] }} strokeWidth={3} />
                        </span>
                      ) : (
                        <Minus className="h-4 w-4 text-white/20" strokeWidth={2} />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        {/* ── FOOTER CTA ── */}
        <section className="mx-auto max-w-3xl px-5 pb-20 text-center sm:px-8">
          <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <p className="text-2xl font-black sm:text-3xl">
              Experimente o sistema completo
              <br />
              <span className="text-white/50">antes de contratar.</span>
            </p>
            <p className="mt-3 text-sm text-white/45">Nenhum compromisso. Sem dados de cartão.</p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button onClick={scrollToDemo}
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-6 py-3.5 text-sm font-black text-white shadow-[0_8px_24px_-6px_rgba(249,115,22,0.5),inset_0_1px_0_rgba(255,255,255,0.15)] transition hover:bg-orange-600">
                Ver demonstrações
              </button>
              <a href={SPECIALIST_WA_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:bg-white/10">
                <MessageCircle className="h-4 w-4" />
                Falar com Especialista
              </a>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/[0.05] py-8 text-center text-xs text-white/25">
          © {new Date().getFullYear()} FoodSaaS ERP — Demonstração pública
        </footer>

      </div>
    </div>
  );
}

export default function DemoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07090f]" />}>
      <DemoContent />
    </Suspense>
  );
}

// ─── Demo Card ────────────────────────────────────────────────────────────────
interface DemoCardProps { demo: DemoAccount; screenshot: string; loading: boolean; disabled: boolean; onSelect: () => void; }

function DemoCard({ demo, screenshot, loading, disabled, onSelect }: DemoCardProps) {
  const color = demo.primaryColor;
  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0b0e18] shadow-[0_2px_0_rgba(255,255,255,0.04)_inset,0_24px_48px_-16px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.7)]"
      style={{ boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 24px 60px -20px ${color}44` }}
    >
      <div className="relative h-40 overflow-hidden">
        <Image src={screenshot} alt={`Preview ${demo.label}`} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 768px) 100vw, 33vw" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${color}22 0%, #0b0e18 100%)` }} />
        <span className="absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest backdrop-blur"
          style={{ color, backgroundColor: `${color}33`, border: `1px solid ${color}55` }}>
          {demo.plan}
        </span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-30 transition-opacity duration-300 group-hover:opacity-50"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}55, transparent 70%)` }} aria-hidden />
      <div className="relative flex flex-1 flex-col p-7">
        <h2 className="text-xl font-black tracking-tight">{demo.label}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-white/55">{demo.tagline}</p>
        <ul className="mt-5 space-y-2.5 flex-1">
          {demo.features.map((feat) => (
            <li key={feat} className="flex items-start gap-2.5 text-sm text-white/75">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                style={{ backgroundColor: `${color}22` }}>
                <Check className="h-3 w-3" style={{ color }} strokeWidth={3} />
              </span>
              {feat}
            </li>
          ))}
        </ul>
        <button onClick={onSelect} disabled={loading || disabled}
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: color, boxShadow: `0 8px 24px -8px ${color}cc, inset 0 1px 0 rgba(255,255,255,0.15)` }}>
          {loading
            ? (<><Loader2 className="h-4 w-4 animate-spin" />Abrindo…</>)
            : `Testar ${demo.plan.charAt(0) + demo.plan.slice(1).toLowerCase()}`}
        </button>
      </div>
    </article>
  );
}
