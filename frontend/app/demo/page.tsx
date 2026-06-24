"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Clock,
  Cpu,
  Loader2,
  Mail,
  MessageCircle,
  Minus,
  Phone,
  ShieldCheck,
  Smartphone,
  Star,
  Store,
  TrendingUp,
  UtensilsCrossed,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";

import toast from "react-hot-toast";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import { DEMO_ACCOUNTS, type DemoAccount } from "@/lib/demoThemes";
import { PDV_THEME_PRESETS, savePdvTheme, PDV_THEME_DEFAULT } from "@/lib/pdv-theme";
import { SUPPORT_WHATSAPP } from "@/config/support";

const SPECIALIST_WA_URL = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
  "Olá! Gostaria de falar com um especialista da Ruffinu's R_FoodSaaS ERP.",
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

function planKey(plan: string): PlanKey { return plan.toLowerCase() as PlanKey; }

// ─── Plan cards data ──────────────────────────────────────────────────────────
const PLAN_CARDS = [
  {
    plan: "BASIC" as const,
    label: "FoodSaaS Basic",
    btnClass:
      "bg-green-600 hover:bg-green-700 shadow-[0_8px_24px_-8px_rgba(22,163,74,0.7),inset_0_1px_0_rgba(255,255,255,0.15)]",
  },
  {
    plan: "PRO" as const,
    label: "FoodSaaS Pro",
    btnClass:
      "bg-blue-600 hover:bg-blue-700 shadow-[0_8px_24px_-8px_rgba(37,99,235,0.7),inset_0_1px_0_rgba(255,255,255,0.15)]",
  },
  {
    plan: "ENTERPRISE" as const,
    label: "FoodSaaS Enterprise",
    btnClass:
      "bg-purple-600 hover:bg-purple-700 shadow-[0_8px_24px_-8px_rgba(124,58,237,0.7),inset_0_1px_0_rgba(255,255,255,0.15)]",
  },
  {
    plan: "DELIVERY" as const,
    label: "FoodSaaS Delivery",
    btnClass:
      "bg-orange-600 hover:bg-orange-700 shadow-[0_8px_24px_-8px_rgba(234,88,12,0.7),inset_0_1px_0_rgba(255,255,255,0.15)]",
  },
];

// ─── Niches unified data ──────────────────────────────────────────────────────
const ALL_NICHES = [
  "Restaurantes", "Pizzaria", "Hamburgueria", "Lanchonetes",
  "Churrascaria", "Hotdogs", "Marmitarias", "Padaria",
  "Confeitaria", "Pastelaria", "Açaí", "Conveniências", "Mercados",
];

interface NicheInfo {
  emoji: string;
  image: string;
  features: { basic: string[]; pro: string[]; enterprise: string[] };
}

const NICHES_DATA: Record<string, NicheInfo> = {
  Restaurantes: {
    emoji: "🍽️",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=280&fit=crop&q=80",
    features: {
      basic:      ["PDV rápido por mesa ou balcão", "Cardápio digital sem comissão", "Cozinha integrada em tempo real", "Controle de caixa diário"],
      pro:        ["Cupons e programa de fidelidade", "Relatórios de CMV por produto", "Ficha técnica e controle de estoque", "Relatórios de lucratividade"],
      enterprise: ["Multi-unidades em dashboard único", "WhatsApp IA 24h no cardápio", "Usuários ilimitados com papéis", "BI com metas e benchmarks"],
    },
  },
  Pizzaria: {
    emoji: "🍕",
    image: "/demo-assets/banners/combos.jpg",
    features: {
      basic:      ["Montagem de pizza com meio a meio", "Bordas recheadas por tamanho", "Impressão automática na produção", "PDV de balcão e delivery"],
      pro:        ["Controle de insumos por ingrediente", "Cupons de Sexta e Sábado à noite", "Fidelidade e cashback por pedido", "Relatório de CMV por sabor"],
      enterprise: ["Gestão de múltiplas unidades", "WhatsApp IA fecha pedidos às 2h", "iFood e Rappi integrados", "Suporte VIP com SLA gerencial"],
    },
  },
  Hamburgueria: {
    emoji: "🍔",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=280&fit=crop&q=80",
    features: {
      basic:      ["Montagem com complementos (bacon, queijo...)", "PDV tátil para alta rotatividade", "KDS na cozinha sem papel", "Impressão de senha para retirada"],
      pro:        ["Combos automáticos com batata e bebida", "Controle de estoque de pães e carnes", "WhatsApp notifica quando o lanche saiu", "Fidelidade por carimbo digital"],
      enterprise: ["Múltiplos caixas simultâneos", "BI de conversão por combo", "Robô WhatsApp atende e fecha pedido", "Integração com iFood e Rappi"],
    },
  },
  Lanchonetes: {
    emoji: "🥪",
    image: "https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=600&h=280&fit=crop&q=80",
    features: {
      basic:      ["Frente de caixa veloz para balcão", "Cardápio digital com link próprio", "Controle de caixa e sangria", "Impressão automática na cozinha"],
      pro:        ["Complementos e adicionais por item", "Cupons e promoções do dia", "Controle de estoque por ingrediente", "Relatórios de lucro por produto"],
      enterprise: ["Franquias e múltiplos terminais", "WhatsApp IA atende 24h", "Painéis consolidados multi-unidade", "Suporte VIP e SLA gerencial"],
    },
  },
  Churrascaria: {
    emoji: "🥩",
    image: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600&h=280&fit=crop&q=80",
    features: {
      basic:      ["Comanda por mesa com totalizador", "Rodízio: controle de saídas por corte", "Impressão de pedido para o churrasqueiro", "Caixa com fechamento por grupo"],
      pro:        ["Controle de peso e rendimento do corte", "Reservas e lista de espera digital", "Cupons para datas especiais", "Relatório de consumo médio por pessoa"],
      enterprise: ["Multi-salões e galpões integrados", "Gestão de brigadistas por setor", "WhatsApp IA para reservas", "BI de ocupação e giro de mesa"],
    },
  },
  Hotdogs: {
    emoji: "🌭",
    image: "https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=600&h=280&fit=crop&q=80",
    features: {
      basic:      ["Grade de complementos (milho, queijo, vinagrete...)", "KDS na chapa sem papelzinho sumindo", "PDV rápido para fila de balcão", "Controle de caixa simplificado"],
      pro:        ["Cardápio digital com foto e complementos", "Controle de estoque de pão e salsicha", "Cupons e combo promoção", "Relatório de itens mais vendidos"],
      enterprise: ["Multi-caixas em pico noturno", "WhatsApp IA atende pedidos online", "BI de produto por horário", "Suporte prioritário nos picos"],
    },
  },
  Marmitarias: {
    emoji: "🍱",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=280&fit=crop&q=80",
    features: {
      basic:      ["PDV de montagem rápida (P/M/G)", "Link de pedidos online sem comissão", "Aviso automático de PIX recebido", "Impressão automática na cozinha"],
      pro:        ["Agrupamento de entregadores por bairro", "Programa de fidelidade integrado", "Controle de insumos (arroz, proteína, salada)", "Relatório de marmitas por período"],
      enterprise: ["Múltiplos terminais de produção", "WhatsApp IA para pedidos de almoço", "Dashboards em tempo real", "API para logística de entrega"],
    },
  },
  Padaria: {
    emoji: "🥐",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&h=280&fit=crop&q=80",
    features: {
      basic:      ["PDV rápido para balcão e caixa", "Venda por unidade, kg ou dúzia", "Controle de caixa de abertura às 6h", "Cardápio digital para delivery local"],
      pro:        ["Controle de estoque de farinha e insumos", "Cupons de café da manhã e promoção", "Programa de pontos para clientes fiéis", "Relatório de curva ABC por produto"],
      enterprise: ["Múltiplas lojas com estoque central", "WhatsApp IA para pedidos antecipados", "BI de desperdício e perda", "Gestão de produção por turno"],
    },
  },
  Confeitaria: {
    emoji: "🎂",
    image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&h=280&fit=crop&q=80",
    features: {
      basic:      ["Pedidos personalizados com observações", "Cardápio visual com fotos dos bolos", "Controle de agenda de retiradas", "Caixa com formas de pagamento variadas"],
      pro:        ["Controle de ingredientes e custo por bolo", "Cupons de aniversário e datas especiais", "Fidelidade com pontos por valor gasto", "Relatório de lucro por categoria"],
      enterprise: ["Multi-lojas com produção central", "WhatsApp IA para orçamentos 24h", "BI de sazonalidade e picos de demanda", "Suporte VIP e gerente dedicado"],
    },
  },
  Pastelaria: {
    emoji: "🥟",
    image: "https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=600&h=280&fit=crop&q=80",
    features: {
      basic:      ["Grade de recheios sem erro de comanda", "Impressão setorizada para fritadeira", "Painel de senhas para retirada", "PDV tátil de alta velocidade"],
      pro:        ["Controle de insumos por gramatura de recheio", "Cupons de fim de semana", "Cardápio digital com foto de cada pastel", "Upsell automático de bebidas"],
      enterprise: ["Franquias com cardápio central", "WhatsApp IA fecha pedidos online", "BI de rendimento por kg de massa", "Multi-caixas no pico de feira"],
    },
  },
  Açaí: {
    emoji: "🫐",
    image: "https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=600&h=280&fit=crop&q=80",
    features: {
      basic:      ["Grade de complementos (granola, morango, leite condensado...)", "Tamanhos de copo (300ml/500ml/700ml)", "PDV rápido para fila de balcão", "Cardápio digital com link próprio"],
      pro:        ["Controle de ficha técnica por tamanho", "Cupons e combos de açaí + crepe", "Programa de fidelidade por copo", "Controle de estoque de frutas e complementos"],
      enterprise: ["Multi-unidades com estoque central", "WhatsApp IA para pedidos delivery", "BI de consumo por complemento", "Integração iFood e Rappi"],
    },
  },
  Conveniências: {
    emoji: "🏪",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&h=280&fit=crop&q=80",
    features: {
      basic:      ["Leitura de código de barras EAN", "PDV rápido com preço automático", "Controle de caixa e troco", "Relatório de vendas por turno"],
      pro:        ["Controle de validade e lote de produtos", "Estoque com alerta de reposição", "Relatório de curva ABC por item", "Multi-forma de pagamento integrada"],
      enterprise: ["Multi-lojas com estoque central", "Relatório de giro por prateleira", "Integração com fornecedores", "BI de margem por categoria"],
    },
  },
  Mercados: {
    emoji: "🛒",
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=280&fit=crop&q=80",
    features: {
      basic:      ["Scanner EAN na frente de caixa", "PDV com busca rápida por código/nome", "Controle de caixa e fechamento", "Cardápio online para delivery local"],
      pro:        ["Gestão de estoque com validade e lote", "Alerta automático de ruptura de prateleira", "Programa de fidelidade por compra", "Relatório de produtos mais vendidos"],
      enterprise: ["Multi-filiais com estoque centralizado", "BI de margem por departamento", "Integração com distribuidor", "Gestão de promotores por setor"],
    },
  },
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

// ─── Hero Device Mockup (iMac monitor) ──────────────────────────────────────
// (defined below, referenced here to avoid forward-reference issues)

// ─── Mockup: PDV ──────────────────────────────────────────────────────────────
function PdvMockup() {
  const products = [
    { name: "Pizza Margherita", price: "R$ 52", bg: "from-orange-600 to-red-700",    emoji: "🍕" },
    { name: "Burger Classic",   price: "R$ 34", bg: "from-amber-500 to-orange-600",  emoji: "🍔" },
    { name: "Batata Frita P.",  price: "R$ 18", bg: "from-yellow-500 to-amber-600",  emoji: "🍟" },
    { name: "Coca-Cola 350ml",  price: "R$ 8",  bg: "from-red-700 to-rose-900",      emoji: "🥤" },
    { name: "Pizza Frango",     price: "R$ 48", bg: "from-purple-600 to-indigo-700", emoji: "🍕" },
    { name: "Milk Shake",       price: "R$ 22", bg: "from-pink-500 to-rose-600",     emoji: "🥛" },
  ];
  return (
    <div className="rounded-2xl bg-[#0a0d14] border border-white/[0.08] overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] font-bold text-white/80">PDV — Balcão</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-md">Pizzas</span>
          <span className="text-[10px] text-white/30 font-mono">12:34</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3">
        {products.map((p) => (
          <div key={p.name} className="rounded-xl overflow-hidden border border-white/[0.06] flex flex-col cursor-default group">
            <div className={`bg-gradient-to-br ${p.bg} h-12 flex items-center justify-center text-2xl select-none group-hover:scale-105 transition-transform duration-200`}>
              {p.emoji}
            </div>
            <div className="p-2 bg-white/[0.03]">
              <p className="text-[9px] font-bold text-white/90 leading-tight truncate">{p.name}</p>
              <p className="text-[11px] font-black text-orange-400 mt-0.5">{p.price}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.06] px-3.5 py-2.5 flex items-center justify-between">
        <div>
          <p className="text-[9px] text-white/40">3 itens · Pedido #0042</p>
          <p className="text-sm font-black text-white">R$ 86,00</p>
        </div>
        <div className="rounded-xl bg-orange-500 px-3 py-1.5 shadow-lg shadow-orange-500/30">
          <p className="text-[10px] font-black text-white">Fechar pedido</p>
        </div>
      </div>
    </div>
  );
}

// ─── Mockup: Dashboard ────────────────────────────────────────────────────────
function DashboardMockup() {
  const values = [42, 68, 55, 90, 73, 88, 61];
  const days   = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const max    = Math.max(...values);
  const highIdx = values.indexOf(max);

  // SVG bezier area chart
  const W = 240, H = 58, padL = 2, padR = 2, padT = 6, padB = 4;
  const pts = values.map((v, i) => ({
    x: padL + (i / (values.length - 1)) * (W - padL - padR),
    y: padT + (1 - v / max) * (H - padT - padB),
  }));
  const linePath = pts.reduce((acc, pt, i) => {
    if (i === 0) return `M${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    const prev = pts[i - 1];
    const cpx = ((prev.x + pt.x) / 2).toFixed(1);
    return acc + ` C${cpx},${prev.y.toFixed(1)} ${cpx},${pt.y.toFixed(1)} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
  }, "");
  const areaPath = `${linePath} L${pts[pts.length - 1].x},${H} L${pts[0].x},${H} Z`;

  return (
    <div className="rounded-2xl bg-[#0a0d14] border border-white/[0.08] overflow-hidden shadow-2xl">
      <div className="px-4 pt-4 pb-0">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[9px] text-white/35 font-semibold uppercase tracking-widest mb-0.5">Faturamento — 7 dias</p>
            <p className="text-xl font-black text-white leading-none">R$ 18.240</p>
          </div>
          <div className="flex items-center gap-1 bg-green-500/10 border border-green-500/20 rounded-lg px-2 py-1">
            <TrendingUp size={9} className="text-green-400" />
            <span className="text-[9px] font-black text-green-400">+12,4%</span>
          </div>
        </div>
        {/* SVG bezier area chart */}
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: 58 }}>
          <defs>
            <linearGradient id="dash-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#f97316" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.00" />
            </linearGradient>
          </defs>
          {[0.33, 0.66].map((r) => (
            <line key={r} x1={padL} y1={padT + r * (H - padT - padB)} x2={W - padR} y2={padT + r * (H - padT - padB)}
              stroke="rgba(255,255,255,0.05)" strokeWidth={0.8} />
          ))}
          <path d={areaPath} fill="url(#dash-area)" />
          <path d={linePath} fill="none" stroke="#f97316" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {/* Peak highlight */}
          <circle cx={pts[highIdx].x} cy={pts[highIdx].y} r={5} fill="#f97316" opacity={0.18} />
          <circle cx={pts[highIdx].x} cy={pts[highIdx].y} r={3} fill="#f97316" />
        </svg>
        <div className="flex justify-between pb-2 mt-1">
          {days.map((d, i) => (
            <span key={i} className={`text-[7px] font-mono ${i === highIdx ? "text-orange-400 font-black" : "text-white/20"}`}>{d}</span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px bg-white/[0.04] border-t border-white/[0.06]">
        {[
          { label: "Hoje",        value: "R$2.847", delta: "↑ 8%",  up: true  },
          { label: "Pedidos",     value: "47",       delta: "↑ 3",   up: true  },
          { label: "Ticket Méd.", value: "R$60,57",  delta: "↓ 2%",  up: false },
        ].map((k) => (
          <div key={k.label} className="bg-[#0a0d14] p-3">
            <p className="text-[8px] text-white/30 font-semibold uppercase tracking-wide">{k.label}</p>
            <p className="text-[13px] font-black text-white mt-0.5 leading-tight">{k.value}</p>
            <p className={`text-[8px] font-bold mt-0.5 ${k.up ? "text-green-400" : "text-red-400"}`}>{k.delta}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Mockup: Menu ─────────────────────────────────────────────────────────────
function MenuMockup() {
  const items = [
    { name: "Pizza Quatro Queijos", sub: "Muçarela, parmesão, catupiry, gorgonzola", price: "R$ 62,00", emoji: "🍕", bg: "from-orange-600 to-red-700",   badge: "Mais pedido", stars: 4.9 },
    { name: "Combo Família",        sub: "2 pizzas grandes + 2 refris 2L",           price: "R$ 119,00", emoji: "🎉", bg: "from-purple-600 to-indigo-700", badge: null,          stars: 4.7 },
    { name: "Esfiha de Carne",      sub: "Massa leve, recheio generoso",              price: "R$ 8,00",   emoji: "🥙", bg: "from-amber-500 to-orange-600",  badge: null,          stars: 4.5 },
  ];
  return (
    <div className="rounded-2xl bg-white overflow-hidden shadow-2xl border border-black/5">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-black/5 bg-orange-500">
        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-sm">🍕</div>
        <div>
          <p className="text-sm font-black text-white leading-tight">Pizzaria Bella Napoli</p>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
            <p className="text-[9px] text-white/80 font-semibold">Aberto · Entrega ~35 min</p>
          </div>
        </div>
      </div>
      {/* Category pills */}
      <div className="flex gap-2 px-4 py-2 overflow-x-hidden border-b border-black/5 bg-orange-50">
        {["🍕 Pizzas", "🥙 Esfihas", "🥤 Bebidas"].map((c, i) => (
          <span key={c} className={`text-[9px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${i === 0 ? "bg-orange-500 text-white" : "bg-white text-gray-600 border border-black/[0.08]"}`}>
            {c}
          </span>
        ))}
      </div>
      <div className="divide-y divide-black/5">
        {items.map((item) => (
          <div key={item.name} className="flex items-start gap-3 px-4 py-3">
            <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${item.bg} flex items-center justify-center text-xl relative`}>
              {item.emoji}
              {item.badge && (
                <div className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full leading-none">
                  {item.badge}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-gray-900 leading-tight">{item.name}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-tight truncate">{item.sub}</p>
              <div className="flex items-center gap-1 mt-1">
                <Star size={9} fill="#f59e0b" className="text-amber-400" />
                <span className="text-[9px] font-bold text-gray-500">{item.stars}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <p className="text-[11px] font-black text-gray-900">{item.price}</p>
              <div className="rounded-full bg-orange-500 w-5 h-5 flex items-center justify-center shadow-md shadow-orange-500/40">
                <span className="text-[10px] font-black text-white leading-none">+</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Mockup: Chat ─────────────────────────────────────────────────────────────
function ChatMockup() {
  const messages = [
    { from: "user", text: "Oi! Quero uma pizza grande de frango com catupiry", time: "12:31" },
    { from: "bot",  text: "Ótima escolha! 🍕 Pizza Grande Frango com Catupiry — R$ 62,00.\nQuer adicionar borda recheada? Temos catupiry, cheddar e cream cheese!", time: "12:31" },
    { from: "user", text: "Borda de catupiry, sim!", time: "12:32" },
    { from: "bot",  text: "Perfeito! 🎉 Pedido confirmado:\n• Pizza G. Frango + Borda Catupiry — R$ 72,00\n\nEndereço de entrega?", time: "12:32" },
  ];
  return (
    <div className="rounded-2xl bg-[#0f1218] border border-white/[0.08] overflow-hidden shadow-2xl">
      <style>{`@keyframes typingBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}`}</style>
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
          <span className="text-[10px] font-black text-white">K</span>
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold text-white/90 leading-tight">Kely · Atendente IA</p>
          <p className="text-[8px] text-green-400 font-semibold">● online agora</p>
        </div>
        <span className="text-[8px] text-white/20 font-mono">WhatsApp</span>
      </div>
      <div className="p-3 space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
              m.from === "user"
                ? "bg-green-500/90 text-white rounded-br-sm"
                : "bg-white/[0.07] text-white/85 rounded-bl-sm"
            }`}>
              <p className="text-[10px] leading-relaxed whitespace-pre-line">{m.text}</p>
              <p className={`text-[8px] mt-0.5 ${m.from === "user" ? "text-white/60 text-right" : "text-white/30"}`}>{m.time} ✓✓</p>
            </div>
          </div>
        ))}
        {/* Typing indicator */}
        <div className="flex justify-start">
          <div className="bg-white/[0.07] rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1">
            {[0, 0.15, 0.3].map((delay, i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/40"
                style={{ animation: `typingBounce 1.2s ease-in-out ${delay}s infinite` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mockup: Loyalty ──────────────────────────────────────────────────────────
function LoyaltyMockup() {
  const progress = 0.62;
  const R = 28, CX = 36, CY = 36;
  const circ = 2 * Math.PI * R;
  const dashOff = circ * (1 - progress);

  return (
    <div className="rounded-2xl bg-[#0a0d14] border border-white/[0.08] overflow-hidden shadow-2xl">
      <div className="px-4 py-4 bg-gradient-to-b from-orange-500/15 to-transparent border-b border-white/[0.06]">
        <div className="flex items-center gap-4">
          {/* SVG ring progress */}
          <div className="flex-shrink-0">
            <svg width={72} height={72}>
              <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
              <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f97316" strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={dashOff}
                transform={`rotate(-90 ${CX} ${CY})`}
                style={{ filter: "drop-shadow(0 0 5px #f97316bb)" }}
              />
              <text x={CX} y={CY + 1} textAnchor="middle" dominantBaseline="middle"
                fontSize={10} fontWeight="900" fill="white">62%</text>
            </svg>
          </div>
          <div>
            <p className="text-[9px] text-orange-400 font-bold uppercase tracking-wider mb-1">Programa de Fidelidade</p>
            <p className="text-base font-black text-white">1.240 pts</p>
            <p className="mt-1 text-[9px] text-white/40">760 pts → Borda Grátis 🎁</p>
          </div>
        </div>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {[
          { desc: "Pizza Quatro Queijos",   pts: "+120 pts", color: "text-green-400", icon: "↑" },
          { desc: "Resgate — Borda grátis", pts: "-80 pts",  color: "text-red-400",   icon: "↓" },
          { desc: "Burger Clássico",         pts: "+60 pts",  color: "text-green-400", icon: "↑" },
        ].map((t) => (
          <div key={t.desc} className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black ${t.color}`}>{t.icon}</span>
              <p className="text-[10px] text-white/70 font-medium">{t.desc}</p>
            </div>
            <p className={`text-[10px] font-black ${t.color}`}>{t.pts}</p>
          </div>
        ))}
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

        {/* Screen */}
        <div
          className="relative overflow-hidden rounded-[12px] bg-[#07090f]"
          style={{ aspectRatio: "8 / 5" }}
        >
          {/* Navbar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-orange-500/20 flex items-center justify-center">
                <UtensilsCrossed className="w-2.5 h-2.5 text-orange-400" />
              </div>
              <span className="text-[8px] font-black text-white/90">R_FoodSaaS ERP</span>
            </div>
            <div className="flex-1" />
            <div className="flex gap-1.5">
              {["PDV", "Pedidos", "Cozinha", "Financeiro"].map((t) => (
                <span key={t} className="text-[6px] text-white/35 font-semibold px-2 py-0.5 rounded-md bg-white/[0.04]">{t}</span>
              ))}
            </div>
          </div>

          {/* Body: split layout */}
          <div className="flex h-full">
            {/* Sidebar */}
            <div className="w-12 border-r border-white/[0.05] bg-white/[0.01] py-3 flex flex-col gap-2 items-center">
              {["🍕", "📦", "👨‍🍳", "💰", "📊"].map((e, i) => (
                <div key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center text-[12px] ${i === 0 ? "bg-orange-500/20" : "bg-white/[0.04]"}`}>
                  {e}
                </div>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 p-3 flex flex-col gap-2">
              {/* Stats row */}
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: "Faturamento", val: "R$2.847" },
                  { label: "Pedidos",     val: "47" },
                  { label: "Ticket",      val: "R$60" },
                  { label: "CMV",         val: "28%" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-white/[0.04] border border-white/[0.05] p-1.5">
                    <p className="text-[5.5px] text-white/35 font-semibold">{s.label}</p>
                    <p className="text-[9px] font-black text-white mt-0.5">{s.val}</p>
                  </div>
                ))}
              </div>

              {/* PDV area label */}
              <div className="flex items-center gap-2">
                <span className="text-[6px] text-orange-400 font-bold uppercase tracking-wider">PDV AGILIZADO</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              {/* Product grid */}
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { name: "Pizza Margherita", price: "R$52", c: "bg-orange-500/15" },
                  { name: "Burger Classic",   price: "R$34", c: "bg-blue-500/15" },
                  { name: "Coca-Cola 2L",     price: "R$12", c: "bg-red-500/15" },
                  { name: "Pizza Frango",     price: "R$48", c: "bg-purple-500/15" },
                  { name: "Batata Frita",     price: "R$18", c: "bg-amber-500/15" },
                  { name: "Milk Shake",       price: "R$22", c: "bg-green-500/15" },
                ].map((p) => (
                  <div key={p.name} className={`${p.c} border border-white/[0.05] rounded-lg p-2`}>
                    <p className="text-[7px] font-bold text-white/85 leading-tight">{p.name}</p>
                    <p className="text-[9px] font-black text-orange-400 mt-0.5">{p.price}</p>
                  </div>
                ))}
              </div>

              {/* Cart strip */}
              <div className="mt-auto flex items-center justify-between rounded-xl bg-orange-500/10 border border-orange-500/20 px-3 py-2">
                <div>
                  <p className="text-[6px] text-white/40">Pedido em aberto · 3 itens</p>
                  <p className="text-[10px] font-black text-white">R$ 86,00</p>
                </div>
                <div className="rounded-lg bg-orange-500 px-2.5 py-1">
                  <span className="text-[7px] font-black text-white">Finalizar</span>
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

          {/* Right: iMac real photo */}
          <div className="p-6 sm:p-8 lg:p-10 flex items-center justify-center bg-white/[0.01] border-t border-white/[0.06] lg:border-t-0 lg:border-l lg:border-white/[0.06]">
            <div className="w-full max-w-lg">
              <Image
                src="/demo-assets/imac-real.png"
                alt="R_FoodSaaS ERP no iMac"
                width={640}
                height={480}
                className="w-full h-auto object-contain drop-shadow-2xl"
                priority
              />
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
  const { setAuth } = useAuthStore();
  const [selectedNiche, setSelectedNiche] = useState<string>("Restaurantes");
  const [selectedThemeIdx, setSelectedThemeIdx] = useState(0);
  const [entering, setEntering] = useState<string | null>(null);
  const [modalDemo, setModalDemo] = useState<DemoAccount | null>(null);
  const demoSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Registra visita no backend
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
    fetch(`${apiBase}/visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: "/demo" }),
    }).catch(() => {});

    // Evento de audiência: visitante da página de demonstração
    // Permite criar público personalizado "interessados em demo" no Meta Ads e GA4
    try {
      const w = window as any;
      if (w.fbq) {
        w.fbq("track", "ViewContent", {
          content_name: "Página de Demonstrações FoodSaaS",
          content_category: "demo",
          content_type: "product",
        });
      }
      if (w.gtag) {
        w.gtag("event", "page_view_demo", {
          event_category: "engajamento",
          event_label: "demo_page",
        });
      }
    } catch {}
  }, []);

  async function enterDemoWithLead(demo: DemoAccount, form: LeadForm) {
    setEntering(demo.id);
    // Dispara evento Lead no Meta Pixel e GA4 para remarketing
    try {
      const w = window as any;
      if (w.fbq) w.fbq("track", "Lead", { content_name: `Demo ${demo.plan}`, currency: "BRL" });
      if (w.gtag) w.gtag("event", "generate_lead", { event_category: "demo", event_label: demo.plan });
    } catch {}
    try {
      const { data } = await api.post("auth/demo-access", {
        name: form.name, email: form.email, whatsapp: form.whatsapp,
        restaurantName: form.restaurantName,
        plan: demo.plan.toLowerCase() as "basic" | "pro" | "enterprise" | "delivery",
      });
      const { accessToken, user } = data;
      if (!accessToken) { toast.error("Demonstração indisponível."); return; }
      setAuth(accessToken, user);
      document.cookie = `token=${accessToken}; path=/`;
      localStorage.setItem("token", accessToken);
      localStorage.setItem("user", JSON.stringify(user));
      // Aplica o tema escolhido pelo visitante antes de entrar no PDV
      const chosenPreset = PDV_THEME_PRESETS[selectedThemeIdx];
      if (chosenPreset) savePdvTheme({ ...PDV_THEME_DEFAULT, ...chosenPreset.config });
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
              <span className="text-base font-black tracking-tight">R_FoodSaaS ERP</span>
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
          <div className="flex flex-col items-center text-center">

            {/* Copy — centered */}
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-orange-400">
                Demonstrações ao vivo
              </span>

              <h1 className="mt-7 text-5xl font-black leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
                R_FoodSaaS{" "}
                <span className="bg-gradient-to-r from-orange-400 via-orange-300 to-amber-400 bg-clip-text text-transparent">
                  ERP
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-relaxed text-white/50 sm:text-lg mx-auto">
                Sistema completo e inteligente para{" "}
                <span className="text-white/80 font-semibold">pizzarias, restaurantes, hamburguerias</span>,{" "}
                <span className="text-white/80 font-semibold">delivery & dark kitchens</span>,{" "}
                <span className="text-white/80 font-semibold">conveniências, marmitarias</span>{" "}
                e muito mais.
              </p>

              <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
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

          </div>
        </section>

        {/* ── TRUST METRICS ── */}
        <div className="border-y border-white/[0.06] bg-white/[0.02] backdrop-blur">
          <div className="mx-auto max-w-5xl px-5 sm:px-8">
            <div className="grid grid-cols-2 divide-x divide-white/[0.06] md:grid-cols-4">
              {[
                { icon: <Users className="h-4 w-4" />, value: "150+", label: "restaurantes ativos" },
                { icon: <BarChart3 className="h-4 w-4" />, value: "50 mil", label: "pedidos por mês" },
                { icon: <ShieldCheck className="h-4 w-4" />, value: "99.9%", label: "uptime garantido" },
                { icon: <Clock className="h-4 w-4" />, value: "7 dias", label: "de trial grátis" },
              ].map((m, i) => (
                <div key={i} className="flex items-center gap-3 px-6 py-5 md:justify-center">
                  <span className="text-orange-400/70">{m.icon}</span>
                  <div>
                    <div className="text-base font-black text-white">{m.value}</div>
                    <div className="text-[11px] text-white/40">{m.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── PILLARS (interactive tabs) ── */}
        <PillarsSection />

        {/* ── COMO FUNCIONA ── */}
        <section className="mx-auto max-w-5xl px-5 py-20 sm:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Como funciona?
            </h2>
            <p className="mt-3 text-sm text-white/50">
              Do cadastro ao primeiro pedido em menos de 10 minutos
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: "01", icon: <Store className="h-6 w-6" />, title: "Crie sua conta", desc: "Preencha o nome do restaurante e segmento. Cardápio de exemplo já incluso." },
              { step: "02", icon: <Smartphone className="h-6 w-6" />, title: "Configure o PDV", desc: "Adicione seus produtos, preços e fotos. Interface simples, sem treinamento." },
              { step: "03", icon: <Zap className="h-6 w-6" />, title: "Receba pedidos", desc: "PDV, cardápio digital e cozinha em tempo real funcionando no mesmo instante." },
              { step: "04", icon: <TrendingUp className="h-6 w-6" />, title: "Acompanhe o BI", desc: "Relatórios automáticos de CMV, faturamento e ticket médio — sem planilhas." },
            ].map((s) => (
              <div key={s.step} className="relative flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6">
                <span className="absolute right-5 top-4 text-4xl font-black text-white/[0.04] select-none">{s.step}</span>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/20">
                  {s.icon}
                </div>
                <h3 className="mb-2 text-sm font-black text-white">{s.title}</h3>
                <p className="text-xs leading-relaxed text-white/45">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <a href={SPECIALIST_WA_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-green-500/30 bg-green-500/10 px-6 py-3 text-sm font-semibold text-green-400 transition hover:bg-green-500/15">
              <MessageCircle className="h-4 w-4" />
              Dúvidas? Fale com um consultor agora
            </a>
          </div>
        </section>

        {/* ── ESCOLHA UMA DEMONSTRAÇÃO ── */}
        <section id="demos" ref={demoSectionRef} className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Escolha uma demonstração
            </h2>
            <p className="mt-3 text-sm text-white/50">
              Selecione seu segmento — os 3 planos se atualizam automaticamente
            </p>
          </div>

          {/* ── Unified niche selector ── */}
          <div className="mb-8 flex flex-wrap justify-center gap-2">
            {ALL_NICHES.map((niche) => {
              const info = NICHES_DATA[niche];
              const isActive = selectedNiche === niche;
              return (
                <button
                  key={niche}
                  onClick={() => setSelectedNiche(niche)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? "bg-white text-black shadow-lg scale-105"
                      : "bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white"
                  }`}
                >
                  <span>{info?.emoji ?? "🍽️"}</span>
                  {niche}
                </button>
              );
            })}
          </div>

          {/* ── Theme picker ── */}
          <div className="mb-10 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-bold text-white">Como prefere ver o sistema?</p>
                <p className="text-xs text-white/40 mt-0.5">
                  Escolha o visual da demonstração — você pode personalizar as cores para a cara do seu estabelecimento depois, nas configurações.
                </p>
              </div>
              <span className="text-[10px] font-semibold rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 px-3 py-1">
                Pode mudar depois
              </span>
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              {PDV_THEME_PRESETS.map((preset, i) => {
                const isOn = selectedThemeIdx === i;
                return (
                  <button
                    key={preset.name}
                    onClick={() => setSelectedThemeIdx(i)}
                    className={`group flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                      isOn
                        ? "border-white/30 bg-white/10 text-white scale-105"
                        : "border-white/[0.06] bg-white/[0.03] text-white/60 hover:border-white/15 hover:text-white/90"
                    }`}
                  >
                    {/* color swatch */}
                    <span
                      className="w-4 h-4 rounded-full shrink-0 ring-2 ring-white/10"
                      style={{ background: preset.config.primary as string }}
                    />
                    <span>{preset.emoji} {preset.name}</span>
                    {isOn && <span className="ml-1 text-xs text-white/50">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Plan cards ── */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PLAN_CARDS.map((card) => {
              const demo = DEMO_ACCOUNTS.find((d) => d.plan.toUpperCase() === card.plan) ?? DEMO_ACCOUNTS[0];
              const nicheInfo = NICHES_DATA[selectedNiche] ?? NICHES_DATA["Restaurantes"];
              const planKey = card.plan.toLowerCase() as "basic" | "pro" | "enterprise" | "delivery";
              const features = (nicheInfo.features as any)[planKey] ?? demo.features ?? [];

              return (
                <div
                  key={card.plan}
                  className="flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0d1117] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]"
                >
                  {/* Dynamic image */}
                  <div className="relative mx-4 mt-4 h-40 overflow-hidden rounded-2xl">
                    <Image
                      src={nicheInfo.image}
                      alt={selectedNiche}
                      fill
                      className="object-cover transition-all duration-500"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    {/* Plan label overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <span className="absolute bottom-3 left-3 text-xs font-black text-white drop-shadow">
                      {card.label}
                    </span>
                  </div>

                  {/* Features */}
                  <div className="flex-1 px-5 py-4">
                    <ul className="space-y-2">
                      {features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-white/70">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          {feat}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA */}
                  <div className="p-5 pt-0">
                    <button
                      onClick={() => setModalDemo(demo)}
                      disabled={entering !== null}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${card.btnClass}`}
                    >
                      {entering === demo.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Testar {card.plan.charAt(0) + card.plan.slice(1).toLowerCase()}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── TESTIMONIALS ── */}
        <section className="mx-auto max-w-5xl px-5 pb-20 sm:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">O que nossos clientes dizem</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              { name: "Carlos M.", role: "Dono — Pizzaria Bella", rating: 5, text: "Em 1 semana substituí 3 sistemas diferentes pelo FoodSaaS. A cozinha, o PDV e o delivery — tudo num lugar só." },
              { name: "Fernanda L.", role: "Gerente — Burger House", rating: 5, text: "O WhatsApp IA da Kely vende sozinha à noite. Acordo com pedidos confirmados sem precisar de atendente." },
              { name: "Roberto S.", role: "Sócio — Churrascaria Don", rating: 5, text: "Os relatórios de CMV me fizeram enxergar onde eu perdia dinheiro. Reduzi custos em 18% no primeiro mês." },
            ].map((t) => (
              <div key={t.name} className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6">
                <div className="flex gap-0.5">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-white/70">&ldquo;{t.text}&rdquo;</p>
                <div className="mt-auto border-t border-white/[0.05] pt-3">
                  <div className="text-xs font-bold text-white">{t.name}</div>
                  <div className="text-[11px] text-white/40">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

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
          <div className="rounded-3xl border border-orange-500/20 bg-gradient-to-b from-orange-500/[0.07] to-transparent p-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_60px_-20px_rgba(249,115,22,0.15)]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-orange-400 mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
              Trial gratuito — vagas limitadas
            </span>
            <p className="text-2xl font-black sm:text-3xl">
              Experimente o sistema completo
              <br />
              <span className="text-white/50">antes de contratar.</span>
            </p>
            <p className="mt-3 text-sm text-white/45">7 dias grátis. Sem cartão. Cancele quando quiser.</p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button onClick={scrollToDemo}
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-6 py-3.5 text-sm font-black text-white shadow-[0_8px_24px_-6px_rgba(249,115,22,0.5),inset_0_1px_0_rgba(255,255,255,0.15)] transition hover:bg-orange-600">
                Testar agora — é grátis
                <ArrowRight className="h-4 w-4" />
              </button>
              <a href={SPECIALIST_WA_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-green-500/25 bg-green-500/8 px-6 py-3.5 text-sm font-semibold text-green-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:bg-green-500/15">
                <MessageCircle className="h-4 w-4" />
                WhatsApp · Consultor online agora
              </a>
            </div>
            <p className="mt-5 text-[11px] text-white/25">
              Mais de 150 restaurantes confiam no R_FoodSaaS · Suporte em português
            </p>
            <a
              href="https://instagram.com/mestragenciadigital"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-white/35 hover:text-pink-400 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
              @mestragenciadigital
            </a>
          </div>
        </section>

        <footer className="border-t border-white/[0.05] py-8 text-center text-xs text-white/25">
          © {new Date().getFullYear()} R_FoodSaaS ERP — Demonstração pública
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
