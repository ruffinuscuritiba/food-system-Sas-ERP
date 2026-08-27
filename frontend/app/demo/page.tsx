"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Cpu,
  FileText,
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
import { trackClick } from "@/lib/track";
import { getDemoNicheSlug } from "./_enterDemo";

const SPECIALIST_WA_URL = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
  "Olá! Gostaria de falar com um especialista da Ruffinu's R_FoodSaaS ERP.",
)}`;

// ─── Comparison table ─────────────────────────────────────────────────────────
// Modelo de plano simplificado (achado real, item 187/188 do CLAUDE.md): o
// cadastro (app/signup/page.tsx BUSINESS_TYPES) não usa mais 4 tiers de
// preço (Basic/Pro/Enterprise/Delivery) — só 2 modelos operacionais reais,
// "Delivery" (sem mesa/balcão) e "Completo" (PDV+mesas+cozinha+delivery).
// A demo precisa espelhar exatamente isso, não uma escada de preço que não
// existe mais no cadastro de verdade.
type PlanKey = "delivery" | "completo";
interface Feature { label: string; delivery: boolean; completo: boolean; }

const COMPARISON: Feature[] = [
  { label: "PDV / Fila de Pedidos", delivery: true,  completo: true  },
  { label: "Cozinha (KDS)",         delivery: true,  completo: true  },
  { label: "Mesas / Comandas",      delivery: false, completo: true  },
  { label: "Cardápio Online",       delivery: true,  completo: true  },
  { label: "Cupons",                delivery: true,  completo: true  },
  { label: "Relatórios",            delivery: true,  completo: true  },
  { label: "WhatsApp IA",           delivery: true,  completo: true  },
  { label: "Multiunidades",         delivery: true,  completo: true  },
];

function planKey(plan: string): PlanKey { return plan.toLowerCase() as PlanKey; }

// ─── Plan cards data ──────────────────────────────────────────────────────────
// Mesmo rótulo/descrição do BUSINESS_TYPES em app/signup/page.tsx — a demo
// tem que oferecer exatamente as 2 opções que existem no cadastro real, nem
// mais nem menos.
const PLAN_CARDS = [
  {
    plan: "DELIVERY" as const,
    label: "FoodSaaS Delivery",
    desc: "Vende por WhatsApp e cardápio digital. Sem mesa, sem balcão.",
    btnClass:
      "bg-orange-600 hover:bg-orange-700 shadow-[0_8px_24px_-8px_rgba(234,88,12,0.7),inset_0_1px_0_rgba(255,255,255,0.15)]",
  },
  {
    plan: "COMPLETO" as const,
    label: "FoodSaaS Completo",
    desc: "PDV, mesas, cozinha e delivery — a operação inteira num só lugar.",
    btnClass:
      "bg-purple-600 hover:bg-purple-700 shadow-[0_8px_24px_-8px_rgba(124,58,237,0.7),inset_0_1px_0_rgba(255,255,255,0.15)]",
  },
];

// ─── Palavra rotativa da hero — o produto exibido nesta página é sempre o
// Food (R_FoodSaaS ERP), mas a seção "Segmentos Atendidos" logo abaixo já
// linka pros produtos irmãos (Oficina/Estética/Moda). A hero rotaciona o
// substantivo pra sinalizar isso de cara, sem precisar rolar a página —
// pedido explícito do usuário ("seu delivery/loja/clínica/oficina vende").
// "delivery" é masculino ("o/seu delivery") e loja/clínica/oficina são
// femininos ("a/sua loja") — cada palavra carrega o próprio artigo pra
// nunca virar "Sua delivery" (concordância errada).
const HERO_WORDS: { article: string; word: string }[] = [
  { article: "Seu", word: "delivery" },
  { article: "Sua", word: "loja" },
  { article: "Sua", word: "clínica" },
  { article: "Sua", word: "oficina" },
];

// ─── Niches unified data ──────────────────────────────────────────────────────
const ALL_NICHES = [
  "Restaurantes", "Pizzaria", "Hamburgueria", "Lanchonetes",
  "Churrascaria", "Hotdogs", "Marmitarias", "Padaria",
  "Confeitaria", "Pastelaria", "Açaí", "Conveniências", "Mercados",
];

// Slug do link mágico /demo/[niche] por nicho (ver app/demo/[niche]/page.tsx)
// — usado pelo botão "Copiar link desta demo" pra gerar um link que já loga
// sozinho na conta certa, em vez do visitante ter que clicar em "Testar X" e
// depois copiar a URL genérica /pdv da barra de endereço (que não funciona
// pra ninguém além de quem já está logado no mesmo navegador de quem clicou).
const NICHE_TO_MAGIC_SLUG: Record<string, string> = {
  Restaurantes: "restaurantes",
  Pizzaria: "pizzaria",
  Hamburgueria: "hamburgueria",
  Lanchonetes: "lanchonetes",
  Churrascaria: "churrascaria",
  Hotdogs: "hotdog",
  Marmitarias: "marmitaria",
  Padaria: "padaria",
  Confeitaria: "confeitaria",
  Pastelaria: "pastelaria",
  "Açaí": "acai",
  "Conveniências": "conveniencia",
  Mercados: "mercado",
};

// Catálogos reais de demo hoje: 3 pizzarias (Bella Napoli/Don Corleone/Milano,
// plano Basic/Pro/Enterprise), 1 marmitaria (Marmita Express, plano Delivery)
// e 1 conveniência (Adega & Conveniência Point) — ver DEMO_ACCOUNTS em
// lib/demoThemes.ts. Por nicho, mapeia qual conta REAL cada botão de plano
// deve abrir; um plano ausente do mapa cai no default (a conta do próprio
// plano, ex.: Basic → Bella Napoli) — é assim que Pizzaria continua correto
// pros 3 primeiros botões sem precisar de entrada explícita pra cada um.
// Chave = nome do nicho como em ALL_NICHES; valor = id de DEMO_ACCOUNTS por
// botão de plano.
const NICHE_DEMO_OVERRIDE: Record<string, Partial<Record<"BASIC" | "PRO" | "ENTERPRISE" | "DELIVERY", string>>> = {
  // Só existe 1 catálogo de marmitaria — os 4 botões abrem a mesma conta.
  // Sem isso, "Testar Basic/Pro/Enterprise" pra um prospect de marmitaria
  // caía direto numa pizzaria com produtos de pizza (já aconteceu ao vivo
  // numa venda real).
  Marmitarias: {
    BASIC: "demo-delivery-001", PRO: "demo-delivery-001",
    ENTERPRISE: "demo-delivery-001", DELIVERY: "demo-delivery-001",
  },
  // Basic/Pro/Enterprise já são pizzarias de verdade — só o botão Delivery
  // (que sem override cairia na marmitaria) precisa ser redirecionado pra
  // uma das pizzarias existentes.
  Pizzaria: { DELIVERY: "demo-basic-001" },
  Conveniências: {
    BASIC: "demo-conveniencia-001", PRO: "demo-conveniencia-001",
    ENTERPRISE: "demo-conveniencia-001", DELIVERY: "demo-conveniencia-001",
  },
  Hamburgueria: {
    BASIC: "demo-hamburgueria-001", PRO: "demo-hamburgueria-001",
    ENTERPRISE: "demo-hamburgueria-001", DELIVERY: "demo-hamburgueria-001",
  },
  Lanchonetes: {
    BASIC: "demo-lanchonete-001", PRO: "demo-lanchonete-001",
    ENTERPRISE: "demo-lanchonete-001", DELIVERY: "demo-lanchonete-001",
  },
  Churrascaria: {
    BASIC: "demo-churrascaria-001", PRO: "demo-churrascaria-001",
    ENTERPRISE: "demo-churrascaria-001", DELIVERY: "demo-churrascaria-001",
  },
  Hotdogs: {
    BASIC: "demo-hotdog-001", PRO: "demo-hotdog-001",
    ENTERPRISE: "demo-hotdog-001", DELIVERY: "demo-hotdog-001",
  },
  Padaria: {
    BASIC: "demo-padaria-001", PRO: "demo-padaria-001",
    ENTERPRISE: "demo-padaria-001", DELIVERY: "demo-padaria-001",
  },
  Confeitaria: {
    BASIC: "demo-confeitaria-001", PRO: "demo-confeitaria-001",
    ENTERPRISE: "demo-confeitaria-001", DELIVERY: "demo-confeitaria-001",
  },
  Pastelaria: {
    BASIC: "demo-pastelaria-001", PRO: "demo-pastelaria-001",
    ENTERPRISE: "demo-pastelaria-001", DELIVERY: "demo-pastelaria-001",
  },
  Açaí: {
    BASIC: "demo-acai-001", PRO: "demo-acai-001",
    ENTERPRISE: "demo-acai-001", DELIVERY: "demo-acai-001",
  },
  Mercados: {
    BASIC: "demo-mercado-001", PRO: "demo-mercado-001",
    ENTERPRISE: "demo-mercado-001", DELIVERY: "demo-mercado-001",
  },
};

// Slugs sem acento pra link de prospecção (?niche=marmitaria) — fácil de
// digitar/compartilhar no WhatsApp. Abre a demo já com o nicho pré-selecionado.
const NICHE_SLUGS: Record<string, string> = {
  restaurantes: "Restaurantes",
  pizzaria: "Pizzaria",
  hamburgueria: "Hamburgueria",
  lanchonetes: "Lanchonetes",
  lanchonete: "Lanchonetes",
  churrascaria: "Churrascaria",
  hotdogs: "Hotdogs",
  hotdog: "Hotdogs",
  marmitarias: "Marmitarias",
  marmitaria: "Marmitarias",
  padaria: "Padaria",
  confeitaria: "Confeitaria",
  pastelaria: "Pastelaria",
  acai: "Açaí",
  convenencias: "Conveniências",
  conveniencias: "Conveniências",
  mercados: "Mercados",
};

function resolveNicheFromSlug(raw: string | null): string {
  if (!raw) return "Restaurantes";
  const normalized = raw.toLowerCase().trim();
  return NICHE_SLUGS[normalized] ?? "Restaurantes";
}

// ─── Macro-segmentos (ecossistema) — tabs no topo da seção "Segmentos
// Atendidos" ── clicar num macro filtra as tags de subsegmento abaixo, sem
// poluir a página com as 13 tags de Food pra quem é de Oficina/Estética/Moda.
// FOOD é o único com `href:null` — é o produto desta própria página; os
// outros 3 abrem a demo real do respectivo sistema (mesmos links já usados
// já usadas na tela de segmentos, nunca uma URL nova/inventada).
interface MacroSegment {
  key: "FOOD" | "OFICINA" | "ESTETICA" | "MODA";
  emoji: string;
  label: string;
  subtitle: string;
  image: string;
  color: string; // cor de identidade do macro-segmento — tinge o card ativo e as tags
  tags: string[];
  href: string | null;
}

const MACRO_SEGMENTS: MacroSegment[] = [
  {
    key: "FOOD",
    emoji: "🍔",
    label: "Food / Gastronomia",
    subtitle: "R_FoodSaaS ERP",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&h=280&fit=crop&q=80",
    color: "#f97316",
    tags: ALL_NICHES,
    href: null,
  },
  {
    key: "OFICINA",
    emoji: "🚗",
    label: "Oficinas & Automotivo",
    subtitle: "Oficina & Elétrica ERP",
    image: "https://images.unsplash.com/photo-1493238792000-8113da705763?w=500&h=280&fit=crop&q=80",
    color: "#3b82f6",
    tags: [
      "Auto Elétrica", "Mecânica Geral", "Retífica de Motores", "Centro Automotivo",
      "Funilaria & Pintura", "Lava-Rápido / Estética Automotiva", "Troca de Óleo",
    ],
    href: "https://sistema-oficina-eletrica-erp.vercel.app/demo",
  },
  {
    key: "ESTETICA",
    emoji: "✂️",
    label: "Estética & Beleza",
    subtitle: "Saúde & Beleza ERP",
    image: "https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=500&h=280&fit=crop&q=80",
    color: "#ec4899",
    tags: [
      "Cabeleireiro", "Manicure / Pedicure", "Barbearia", "Salão de Beleza",
      "Clínica de Estética", "Design de Sobrancelhas", "Studio de Tatuagem",
    ],
    href: "https://sistema-saude-beleza-erp-frontend.vercel.app/demo",
  },
  {
    key: "MODA",
    emoji: "🛍️",
    label: "Moda & Varejo",
    subtitle: "Sistema Moda ERP",
    image: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=500&h=280&fit=crop&q=80",
    color: "#8b5cf6",
    tags: [
      "Loja de Roupas", "Loja de Calçados", "Lingerie & Peças Íntimas", "Modas Infantil",
      "Acessórios & Bijouterias", "Boutique", "Ótica",
    ],
    href: "https://sistema-moda-erp-frontend.vercel.app/demo",
  },
];

// ─── Ícone por subsegmento — cada tag tem cara própria (emoji temático), em
// TODOS os macro-segmentos, não só um. Food já tem o próprio NICHES_DATA
// (emoji por nicho); este mapa cobre os outros 3. Chave = texto exato da tag.
const SUBTAG_EMOJI: Record<string, string> = {
  // Oficinas & Automotivo
  "Auto Elétrica": "⚡",
  "Mecânica Geral": "🔧",
  "Retífica de Motores": "⚙️",
  "Centro Automotivo": "🏢",
  "Funilaria & Pintura": "🎨",
  "Lava-Rápido / Estética Automotiva": "🚿",
  "Troca de Óleo": "🛢️",
  // Estética & Beleza
  "Cabeleireiro": "💇",
  "Manicure / Pedicure": "💅",
  "Barbearia": "💈",
  "Salão de Beleza": "✨",
  "Clínica de Estética": "🧖",
  "Design de Sobrancelhas": "👁️",
  "Studio de Tatuagem": "🖋️",
  // Moda & Varejo
  "Loja de Roupas": "👕",
  "Loja de Calçados": "👟",
  "Lingerie & Peças Íntimas": "👙",
  "Modas Infantil": "🧸",
  "Acessórios & Bijouterias": "💍",
  "Boutique": "👗",
  "Ótica": "👓",
};

// ─── Cor própria por subsegmento — cada tag com identidade visual "a
// caráter" (Lingerie em rosa, Ótica em azul-claro, Barbearia em vermelho
// clássico, etc.), em vez de todas herdarem a mesma cor lisa do macro-
// segmento pai. Fallback pra macro.color cobre qualquer tag futura sem
// entrada aqui. Chave = texto exato da tag.
const SUBTAG_COLOR: Record<string, string> = {
  // Oficinas & Automotivo
  "Auto Elétrica": "#eab308",
  "Mecânica Geral": "#64748b",
  "Retífica de Motores": "#78716c",
  "Centro Automotivo": "#3b82f6",
  "Funilaria & Pintura": "#fb923c",
  "Lava-Rápido / Estética Automotiva": "#06b6d4",
  "Troca de Óleo": "#a16207",
  // Estética & Beleza
  "Cabeleireiro": "#d946ef",
  "Manicure / Pedicure": "#f43f5e",
  "Barbearia": "#dc2626",
  "Salão de Beleza": "#f59e0b",
  "Clínica de Estética": "#14b8a6",
  "Design de Sobrancelhas": "#a855f7",
  "Studio de Tatuagem": "#4c1d95",
  // Moda & Varejo
  "Loja de Roupas": "#6366f1",
  "Loja de Calçados": "#a16207",
  "Lingerie & Peças Íntimas": "#f43f5e",
  "Modas Infantil": "#facc15",
  "Acessórios & Bijouterias": "#eab308",
  "Boutique": "#c026d3",
  "Ótica": "#0ea5e9",
};

// ─── Slug de demo temática por tag — o Sistema Moda ERP tem uma conta
// dedicada por nicho (nome/cor/catálogo próprios, ver DEMO_NICHES no
// backend dele); sem isso, TODA tag de Moda caía na mesma conta genérica
// "Loja Demo Moda" não importa qual fosse clicada. Cada slug aqui casa
// exatamente com uma chave de DEMO_NICHES lá — mudar um lado sem o outro
// quebra a demo daquele nicho (cai no fallback genérico, silencioso).
// Oficina/Estética ainda não têm esse motor de demo por nicho — tag sem
// entrada aqui cai no link genérico do macro, comportamento de sempre.
const TAG_DEMO_NICHE_SLUG: Record<string, string> = {
  "Loja de Roupas": "roupas",
  "Loja de Calçados": "calcados",
  "Lingerie & Peças Íntimas": "lingerie",
  "Modas Infantil": "infantil",
  "Acessórios & Bijouterias": "acessorios",
  "Boutique": "boutique",
  "Ótica": "otica",
};

// ─── FAQ ────────────────────────────────────────────────────────────────────
const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "Preciso de impressora pra usar o sistema?",
    a: "Não. Você pode operar 100% pela tela — PDV, cozinha e cardápio digital funcionam sem nenhuma impressora. Se quiser imprimir comandas/tickets automaticamente na cozinha ou no caixa, dá pra conectar uma impressora térmica depois — é opcional, não obrigatório pra começar a vender.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim. O cardápio digital (onde seu cliente faz o pedido) é feito pra celular. O painel administrativo e o PDV também são responsivos e funcionam em tablet ou celular — mas pra frente de caixa no dia a dia, tablet ou computador dá mais conforto.",
  },
  {
    q: "Como eu importo o cardápio que já uso hoje?",
    a: "Pelo Cadastro Inteligente: você manda uma foto, PDF ou XML de nota do seu cardápio atual e o sistema já cadastra os produtos com nome e preço pra você — não precisa digitar item por item do zero.",
  },
  {
    q: "Tem fidelidade ou multa se eu cancelar?",
    a: "Não. Sem fidelidade e sem multa de cancelamento — você pode encerrar quando quiser, direto nas configurações da sua conta.",
  },
  {
    q: "O que acontece quando o teste grátis de 10 dias acaba?",
    a: "Nada é cobrado automaticamente. Ao vencer o trial, você escolhe um dos 2 planos (Delivery ou Completo) pra continuar — sem escolher, a conta fica pausada até você decidir, mas seus dados e cardápio continuam salvos.",
  },
];

interface NicheInfo {
  emoji: string;
  image: string;
  features: { basic: string[]; pro: string[]; enterprise: string[] };
  // Rótulo do módulo "Atributos do Produto" adaptado por nicho — mostrado
  // como badge no Passo 2 e refletido dentro do próprio produto (sidebar +
  // título de /complements, ver lib/segmentLabels.ts) pra quem tem esse
  // businessSegment configurado.
  moduleLabel: string;
}

const NICHES_DATA: Record<string, NicheInfo> = {
  Restaurantes: {
    emoji: "🍽️",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=280&fit=crop&q=80",
    moduleLabel: "Cardápio e Fichas Técnicas",
    features: {
      basic:      ["PDV rápido por mesa ou balcão", "Cardápio digital sem comissão", "Cozinha integrada em tempo real", "Controle de caixa diário"],
      pro:        ["Cupons e programa de fidelidade", "Relatórios de CMV por produto", "Ficha técnica e controle de estoque", "Relatórios de lucratividade"],
      enterprise: ["Multi-unidades em dashboard único", "WhatsApp IA 24h no cardápio", "Usuários ilimitados com papéis", "BI com metas e benchmarks"],
    },
  },
  Pizzaria: {
    emoji: "🍕",
    image: "/demo-assets/banners/combos.jpg",
    moduleLabel: "Regras de Sabores e Bordas",
    features: {
      basic:      ["Montagem de pizza com meio a meio", "Bordas recheadas por tamanho", "Impressão automática na produção", "PDV de balcão e delivery"],
      pro:        ["Controle de insumos por ingrediente", "Cupons de Sexta e Sábado à noite", "Fidelidade e cashback por pedido", "Relatório de CMV por sabor"],
      enterprise: ["Gestão de múltiplas unidades", "WhatsApp IA fecha pedidos às 2h", "iFood e Rappi integrados", "Suporte VIP com SLA gerencial"],
    },
  },
  Hamburgueria: {
    emoji: "🍔",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=280&fit=crop&q=80",
    moduleLabel: "Ponto da Carne e Combos",
    features: {
      basic:      ["Montagem com complementos (bacon, queijo...)", "PDV tátil para alta rotatividade", "KDS na cozinha sem papel", "Impressão de senha para retirada"],
      pro:        ["Combos automáticos com batata e bebida", "Controle de estoque de pães e carnes", "WhatsApp notifica quando o lanche saiu", "Fidelidade por carimbo digital"],
      enterprise: ["Múltiplos caixas simultâneos", "BI de conversão por combo", "Robô WhatsApp atende e fecha pedido", "Integração com iFood e Rappi"],
    },
  },
  Lanchonetes: {
    emoji: "🥪",
    image: "https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=600&h=280&fit=crop&q=80",
    moduleLabel: "Adicionais e Combos",
    features: {
      basic:      ["Frente de caixa veloz para balcão", "Cardápio digital com link próprio", "Controle de caixa e sangria", "Impressão automática na cozinha"],
      pro:        ["Complementos e adicionais por item", "Cupons e promoções do dia", "Controle de estoque por ingrediente", "Relatórios de lucro por produto"],
      enterprise: ["Franquias e múltiplos terminais", "WhatsApp IA atende 24h", "Painéis consolidados multi-unidade", "Suporte VIP e SLA gerencial"],
    },
  },
  Churrascaria: {
    emoji: "🥩",
    image: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600&h=280&fit=crop&q=80",
    moduleLabel: "Cortes e Rodízio",
    features: {
      basic:      ["Comanda por mesa com totalizador", "Rodízio: controle de saídas por corte", "Impressão de pedido para o churrasqueiro", "Caixa com fechamento por grupo"],
      pro:        ["Controle de peso e rendimento do corte", "Reservas e lista de espera digital", "Cupons para datas especiais", "Relatório de consumo médio por pessoa"],
      enterprise: ["Multi-salões e galpões integrados", "Gestão de brigadistas por setor", "WhatsApp IA para reservas", "BI de ocupação e giro de mesa"],
    },
  },
  Hotdogs: {
    emoji: "🌭",
    image: "https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=600&h=280&fit=crop&q=80",
    moduleLabel: "Grade de Complementos",
    features: {
      basic:      ["Grade de complementos (milho, queijo, vinagrete...)", "KDS na chapa sem papelzinho sumindo", "PDV rápido para fila de balcão", "Controle de caixa simplificado"],
      pro:        ["Cardápio digital com foto e complementos", "Controle de estoque de pão e salsicha", "Cupons e combo promoção", "Relatório de itens mais vendidos"],
      enterprise: ["Multi-caixas em pico noturno", "WhatsApp IA atende pedidos online", "BI de produto por horário", "Suporte prioritário nos picos"],
    },
  },
  Marmitarias: {
    emoji: "🍱",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=280&fit=crop&q=80",
    moduleLabel: "Cardápio do Dia / Acompanhamentos Fixos",
    features: {
      basic:      ["PDV de montagem rápida (P/M/G)", "Link de pedidos online sem comissão", "Aviso automático de PIX recebido", "Impressão automática na cozinha"],
      pro:        ["Agrupamento de entregadores por bairro", "Programa de fidelidade integrado", "Controle de insumos (arroz, proteína, salada)", "Relatório de marmitas por período"],
      enterprise: ["Múltiplos terminais de produção", "WhatsApp IA para pedidos de almoço", "Dashboards em tempo real", "API para logística de entrega"],
    },
  },
  Padaria: {
    emoji: "🥐",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&h=280&fit=crop&q=80",
    moduleLabel: "Venda por Peso, Unidade e Dúzia",
    features: {
      basic:      ["PDV rápido para balcão e caixa", "Venda por unidade, kg ou dúzia", "Controle de caixa de abertura às 6h", "Cardápio digital para delivery local"],
      pro:        ["Controle de estoque de farinha e insumos", "Cupons de café da manhã e promoção", "Programa de pontos para clientes fiéis", "Relatório de curva ABC por produto"],
      enterprise: ["Múltiplas lojas com estoque central", "WhatsApp IA para pedidos antecipados", "BI de desperdício e perda", "Gestão de produção por turno"],
    },
  },
  Confeitaria: {
    emoji: "🎂",
    image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&h=280&fit=crop&q=80",
    moduleLabel: "Montagem por Camadas / Peso",
    features: {
      basic:      ["Pedidos personalizados com observações", "Cardápio visual com fotos dos bolos", "Controle de agenda de retiradas", "Caixa com formas de pagamento variadas"],
      pro:        ["Controle de ingredientes e custo por bolo", "Cupons de aniversário e datas especiais", "Fidelidade com pontos por valor gasto", "Relatório de lucro por categoria"],
      enterprise: ["Multi-lojas com produção central", "WhatsApp IA para orçamentos 24h", "BI de sazonalidade e picos de demanda", "Suporte VIP e gerente dedicado"],
    },
  },
  Pastelaria: {
    emoji: "🥟",
    image: "https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=600&h=280&fit=crop&q=80",
    moduleLabel: "Grade de Recheios",
    features: {
      basic:      ["Grade de recheios sem erro de comanda", "Impressão setorizada para fritadeira", "Painel de senhas para retirada", "PDV tátil de alta velocidade"],
      pro:        ["Controle de insumos por gramatura de recheio", "Cupons de fim de semana", "Cardápio digital com foto de cada pastel", "Upsell automático de bebidas"],
      enterprise: ["Franquias com cardápio central", "WhatsApp IA fecha pedidos online", "BI de rendimento por kg de massa", "Multi-caixas no pico de feira"],
    },
  },
  Açaí: {
    emoji: "🫐",
    image: "https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=600&h=280&fit=crop&q=80",
    moduleLabel: "Montagem por Camadas / Peso",
    features: {
      basic:      ["Grade de complementos (granola, morango, leite condensado...)", "Tamanhos de copo (300ml/500ml/700ml)", "PDV rápido para fila de balcão", "Cardápio digital com link próprio"],
      pro:        ["Controle de ficha técnica por tamanho", "Cupons e combos de açaí + crepe", "Programa de fidelidade por copo", "Controle de estoque de frutas e complementos"],
      enterprise: ["Multi-unidades com estoque central", "WhatsApp IA para pedidos delivery", "BI de consumo por complemento", "Integração iFood e Rappi"],
    },
  },
  Conveniências: {
    emoji: "🏪",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&h=280&fit=crop&q=80",
    moduleLabel: "Código de Barras e Validade",
    features: {
      basic:      ["Leitura de código de barras EAN", "PDV rápido com preço automático", "Controle de caixa e troco", "Relatório de vendas por turno"],
      pro:        ["Controle de validade e lote de produtos", "Estoque com alerta de reposição", "Relatório de curva ABC por item", "Multi-forma de pagamento integrada"],
      enterprise: ["Multi-lojas com estoque central", "Relatório de giro por prateleira", "Integração com fornecedores", "BI de margem por categoria"],
    },
  },
  Mercados: {
    emoji: "🛒",
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=280&fit=crop&q=80",
    moduleLabel: "Código de Barras e Prateleiras",
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

// ─── Menu Phone Showcase ─────────────────────────────────────────────────────
function PhoneFrame({
  children, tilt = 0, width = 160, height = 300, highlight = false,
}: {
  children: React.ReactNode; tilt?: number; width?: number; height?: number; highlight?: boolean;
}) {
  const shadow = highlight
    ? "0_0_0_2px_rgba(249,115,22,0.35),0_32px_64px_-12px_rgba(0,0,0,0.9),0_0_80px_-20px_rgba(249,115,22,0.28)"
    : "0_0_0_1px_rgba(255,255,255,0.07),0_24px_48px_-10px_rgba(0,0,0,0.85)";
  return (
    <div
      className="relative select-none"
      style={{
        width,
        transform: tilt !== 0 ? `perspective(900px) rotateY(${tilt}deg) rotate(${tilt > 0 ? -3 : 3}deg)` : undefined,
        transformOrigin: "bottom center",
      }}
    >
      <div className={`rounded-[26px] bg-[#1c1d22] p-[2.5px]`} style={{ boxShadow: shadow }}>
        <div className="rounded-[24px] overflow-hidden" style={{ height }}>
          {/* Notch */}
          <div className="relative bg-[#0a0a0b] flex justify-center items-end pb-1" style={{ height: 22 }}>
            <div className="w-10 h-[13px] rounded-full bg-[#060607] border border-white/[0.05]" />
          </div>
          {children}
        </div>
      </div>
      {/* Home bar */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-white/[0.18]" />
    </div>
  );
}

function MenuPhoneShowcase() {
  const appCircles = [
    { label: "Pizzas",  emoji: "🍕" },
    { label: "Combos",  emoji: "🍱" },
    { label: "Bebidas", emoji: "🥤" },
    { label: "Doces",   emoji: "🍮" },
  ];

  const darkItems = [
    { name: "Pizza Quatro Queijos", desc: "Muçarela, parmesão, catupiry", price: "R$ 62" },
    { name: "Pizza Calabresa",      desc: "Calabresa fatiada, cebola e orégano", price: "R$ 44" },
    { name: "Pizza Pepperoni",      desc: "Pepperoni importado e muçarela",  price: "R$ 52" },
    { name: "Combo Família",        desc: "2 pizzas grandes + 2 refris 2L", price: "R$ 119" },
  ];

  const gridItems = [
    { name: "Quatro Queijos",     price: "R$52" },
    { name: "Pizza Portuguesa",   price: "R$50" },
    { name: "Calabresa Especial", price: "R$44" },
    { name: "Frango c/ Catupiry", price: "R$48" },
    { name: "Bacon Especial",     price: "R$54" },
    { name: "Coca-Cola",          price: "R$8" },
  ];

  const classicSections = [
    { title: "Bebidas",   items: [{ name: "Água", price: "R$ 6" }, { name: "Cerveja", price: "R$ 10" }] },
    { title: "Pizzas",    items: [{ name: "Pizza Portuguesa", price: "R$ 52" }, { name: "Pizza Calabresa", price: "R$ 44" }, { name: "Pizza Bacon Especial", price: "R$ 54" }] },
    { title: "Sobremesas", items: [{ name: "Pudim de Leite", price: "R$ 18" }] },
  ];

  return (
    <section className="relative overflow-hidden py-24">
      {/* Dark background */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 60%, #0f1218 0%, #060709 100%)" }} />
      {/* Dot grid */}
      <div className="absolute inset-0 opacity-[0.035]"
        style={{ backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      {/* Network SVG */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.06]" preserveAspectRatio="xMidYMid slice">
        {([[8,8,92,35],[92,35,55,82],[55,82,8,62],[8,62,8,8],[92,35,98,15],[55,82,75,96],[25,50,55,82],[92,35,75,96]] as number[][]).map(([x1,y1,x2,y2],i)=>(
          <line key={i} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} stroke="#f97316" strokeWidth="1" />
        ))}
        {([[8,8],[92,35],[55,82],[8,62],[98,15],[75,96],[25,50]] as number[][]).map(([x,y],i)=>(
          <circle key={i} cx={`${x}%`} cy={`${y}%`} r={i===0||i===1?"4":"2.5"} fill="#f97316" />
        ))}
      </svg>
      {/* Ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-orange-500/[0.05] blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-orange-400 mb-5">
            Cardápio Digital
          </span>
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            3 layouts, 1 sistema.
          </h2>
          <p className="mt-3 text-white/40 text-base">Você escolhe como seus clientes veem o cardápio — sem reconfigurar nada.</p>
        </div>

        {/* Phones row */}
        <div className="flex items-end justify-center gap-4 sm:gap-8 lg:gap-12">

          {/* ── Phone 1: Estilo App ── */}
          <div className="flex flex-col items-center gap-3 hidden sm:flex">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/35">Estilo App</span>
              <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 text-[8px] font-bold text-white/50">Categorias + fotos</span>
            </div>
            <PhoneFrame tilt={11} width={152} height={295}>
              <div className="h-full bg-white overflow-hidden flex flex-col">
                {/* Categorias em avatar circular */}
                <div className="flex gap-2.5 px-2.5 py-2.5 border-b border-gray-100 flex-shrink-0">
                  {appCircles.map((cat, i) => (
                    <div key={cat.label} className="flex flex-col items-center gap-1 flex-shrink-0">
                      <div className={`w-6 h-6 rounded-full bg-orange-50 flex items-center justify-center text-[10px] ${i===0 ? "ring-2 ring-orange-500" : ""}`}>{cat.emoji}</div>
                    </div>
                  ))}
                </div>
                {/* Cards com informação só (sem foto) */}
                <div className="flex-1 overflow-hidden p-2 space-y-1.5">
                  {darkItems.map((item) => (
                    <div key={item.name} className="relative rounded-xl overflow-hidden bg-[#14161c] px-2.5 py-2" style={{ minHeight: 54 }}>
                      <p className="text-[8px] font-black text-white leading-tight truncate">{item.name}</p>
                      <p className="text-[7px] text-white/40 leading-tight truncate mt-0.5">{item.desc}</p>
                      <p className="text-[9px] font-black text-orange-400 mt-1">{item.price}</p>
                    </div>
                  ))}
                </div>
              </div>
            </PhoneFrame>
          </div>

          {/* ── Phone 2: Grid (center, taller, highlighted) ── */}
          <div className="flex flex-col items-center gap-3" style={{ marginBottom: -20 }}>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">Modo Grade</span>
              <span className="rounded-full bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 text-[8px] font-bold text-orange-400">Recomendado</span>
            </div>
            <PhoneFrame tilt={0} width={168} height={328} highlight>
              <div className="h-full bg-[#0d1117] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.05] flex-shrink-0">
                  <div>
                    <p className="text-[9px] font-black text-white leading-tight">Bella Napoli</p>
                    <p className="text-[7px] text-white/40">🍕 Pizzaria · Campo Belo</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[7px] text-green-400 font-bold">Aberto</span>
                  </div>
                </div>
                {/* Category pill */}
                <div className="flex gap-1.5 px-2 py-1.5 border-b border-white/[0.04] flex-shrink-0">
                  {["🍕 Pizzas", "🍗 Pratos", "🥤 Bebidas"].map((c, i) => (
                    <span key={c} className={`text-[7px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${i===0 ? "bg-orange-500 text-white" : "bg-white/[0.05] text-white/40"}`}>{c}</span>
                  ))}
                </div>
                {/* 2-col grid — informação só, sem foto */}
                <div className="flex-1 overflow-hidden p-2 grid grid-cols-2 gap-1.5 content-start">
                  {gridItems.map((item) => (
                    <div key={item.name} className="relative rounded-xl overflow-hidden bg-white/[0.04] border border-white/[0.06] flex flex-col justify-end px-2 py-1.5" style={{ aspectRatio: "1/1" }}>
                      <p className="text-[7.5px] font-bold text-white leading-tight truncate">{item.name}</p>
                      <p className="text-[9px] font-black text-orange-400 leading-tight">{item.price}</p>
                    </div>
                  ))}
                </div>
                {/* Cart CTA */}
                <div className="flex-shrink-0 mx-2 mb-2 rounded-xl bg-orange-500 px-3 py-2 flex items-center justify-between">
                  <span className="text-[8px] font-black text-white">Ver pedido · 3 itens</span>
                  <span className="text-[8px] font-black text-white">R$ 86,00 →</span>
                </div>
              </div>
            </PhoneFrame>
          </div>

          {/* ── Phone 3: Classic Light ── */}
          <div className="flex flex-col items-center gap-3 hidden sm:flex">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/35">Lista Clássica</span>
              <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 text-[8px] font-bold text-white/50">Impresso</span>
            </div>
            <PhoneFrame tilt={-11} width={152} height={295}>
              <div className="h-full bg-white overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-orange-500 flex-shrink-0">
                  <span className="text-[10px] font-black text-white leading-tight">🍕 Bella Napoli</span>
                </div>
                {/* Sections */}
                <div className="flex-1 overflow-hidden">
                  {classicSections.map((section) => (
                    <div key={section.title}>
                      <div className="px-3 py-1.5 bg-orange-50 border-y border-orange-100/80">
                        <p className="text-[7px] font-black uppercase tracking-widest text-orange-600">{section.title}</p>
                      </div>
                      {section.items.map((item) => (
                        <div key={item.name} className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                          <p className="text-[9px] font-semibold text-gray-800 leading-tight">{item.name}</p>
                          <p className="text-[9px] font-black text-gray-900 flex-shrink-0 ml-2">{item.price}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </PhoneFrame>
          </div>

        </div>

        {/* Bottom labels & CTA */}
        <div className="flex justify-center gap-8 sm:gap-20 mt-10 mb-6">
          {[
            { label: "Estilo App", desc: "Categorias + fotos", visible: "hidden sm:flex" },
            { label: "Modo Grade",   desc: "Visual mosaic · padrão",   visible: "flex" },
            { label: "Lista Clássica", desc: "Tipografia limpa",        visible: "hidden sm:flex" },
          ].map(({ label, desc, visible }) => (
            <div key={label} className={`flex-col items-center text-center ${visible}`}>
              <p className="text-[10px] font-bold text-white/50">{label}</p>
              <p className="text-[9px] text-white/25 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <a href="/menu/demo-pro-001" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.05] border border-white/[0.08] px-5 py-2.5 text-sm font-bold text-white/60 hover:bg-white/[0.09] hover:text-white transition-all">
            Abrir cardápio ao vivo →
          </a>
        </div>
      </div>
    </section>
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
    if (!form.restaurantName.trim()) { toast.error("Informe o nome do estabelecimento."); return; }
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
            { label: "E-mail *", type: "email", Icon: Mail, key: "email", placeholder: "joao@meuemail.com.br" },
            { label: "WhatsApp (opcional)", type: "tel", Icon: Phone, key: "whatsapp", placeholder: "(11) 99999-9999" },
            { label: "Nome do estabelecimento *", type: "text", Icon: Store, key: "restaurantName", placeholder: "Ex: Bella Napoli" },
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

// ─── Exit-Intent Popup ─────────────────────────────────────────────────────────
interface ExitIntentForm { name: string; whatsapp: string; }

function ExitIntentModal({ niche, onClose, onConfirm, loading }: {
  niche: string;
  onClose: () => void;
  onConfirm: (form: ExitIntentForm) => Promise<void>;
  loading: boolean;
}) {
  const nicheLower = niche.toLowerCase();
  const [form, setForm] = useState<ExitIntentForm>({ name: "", whatsapp: "" });

  function formatPhone(raw: string) {
    const d = raw.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Informe seu nome."); return; }
    if (form.whatsapp.replace(/\D/g, "").length < 10) { toast.error("Informe um WhatsApp válido."); return; }
    await onConfirm(form);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-3xl border border-orange-500/20 bg-[#0d1117] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-25"
          style={{ background: "radial-gradient(ellipse at 50% 0%, #f97316, transparent 70%)" }} aria-hidden />
        <div className="relative flex items-start justify-between px-7 pt-7 pb-0">
          <div>
            <span className="inline-block rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest mb-3 text-orange-400 bg-orange-500/10 border border-orange-500/30">
              Antes de sair
            </span>
            <h2 className="text-xl font-black text-white leading-tight">Ganhe um diagnóstico grátis para o seu negócio</h2>
            <p className="mt-1.5 text-sm text-white/50">Fale agora com um especialista em {nicheLower} e descubra o que a FoodSaaS pode automatizar no seu negócio — sem compromisso.</p>
          </div>
          <button onClick={onClose} className="shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition">
            <X size={14} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="relative px-7 py-6 space-y-4">
          {[
            { label: "Seu nome", type: "text", Icon: User, key: "name" as const, placeholder: "João Silva" },
            { label: "WhatsApp", type: "tel", Icon: Phone, key: "whatsapp" as const, placeholder: "(11) 99999-9999" },
          ].map(({ label, type, Icon, key, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-white/60 mb-1.5">{label}</label>
              <div className="relative">
                <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => {
                    const v = key === "whatsapp" ? formatPhone(e.target.value) : e.target.value;
                    setForm((f) => ({ ...f, [key]: v }));
                  }}
                  placeholder={placeholder}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-orange-500/40 transition"
                  autoFocus={key === "name"}
                />
              </div>
            </div>
          ))}
          <button type="submit" disabled={loading}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed bg-orange-600"
            style={{ boxShadow: "0 8px 24px -8px #f97316cc, inset 0 1px 0 rgba(255,255,255,0.15)" }}>
            {loading ? (<><Loader2 className="h-4 w-4 animate-spin" />Enviando…</>) : (<><MessageCircle className="h-4 w-4" />Falar no WhatsApp agora</>)}
          </button>
          <p className="text-center text-[11px] text-white/25 pt-1">Sem custo. Sem compromisso. Resposta em minutos.</p>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function DemoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [selectedNiche, setSelectedNiche] = useState<string>(() =>
    resolveNicheFromSlug(searchParams.get("niche")),
  );
  const [selectedThemeIdx, setSelectedThemeIdx] = useState(0);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [selectedMacro, setSelectedMacro] = useState<MacroSegment["key"]>(() => {
    const raw = (searchParams.get("macro") ?? "").toUpperCase();
    return MACRO_SEGMENTS.some((m) => m.key === raw) ? (raw as MacroSegment["key"]) : "FOOD";
  });
  const [heroWordIdx, setHeroWordIdx] = useState(0);
  const [heroWordFading, setHeroWordFading] = useState(false);
  const [entering, setEntering] = useState<string | null>(null);
  const [modalDemo, setModalDemo] = useState<DemoAccount | null>(null);
  const [showExitIntent, setShowExitIntent] = useState(false);
  const [exitIntentSending, setExitIntentSending] = useState(false);
  const demoSectionRef = useRef<HTMLElement>(null);
  const segmentsSectionRef = useRef<HTMLElement>(null);
  const recordedNiches = useRef<Set<string>>(new Set());
  const exitIntentTriggeredRef = useRef(false);
  const leadCapturedRef = useRef(false);

  // Marketing: registra interesse por nicho (qual categoria atacar no anúncio).
  // Dedupe por sessão; keepalive garante o envio mesmo ao navegar pro /pdv.
  function recordNicheVisit(niche: string) {
    if (!niche || recordedNiches.current.has(niche)) return;
    recordedNiches.current.add(niche);
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
    fetch(`${apiBase}/visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: `demo:${niche}` }),
      keepalive: true,
    }).catch(() => {});
  }

  useEffect(() => {
    // Registra visita no backend
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
    fetch(`${apiBase}/visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: "/demo" }),
    }).catch(() => {});

    // Link de prospecção (?niche=marmitaria) — registra o nicho já na entrada,
    // não só quando o visitante clica numa pill (mede efetividade do link).
    const nicheParam = searchParams.get("niche");
    if (nicheParam) recordNicheVisit(resolveNicheFromSlug(nicheParam));

    // Link de prospecção por ecossistema (?macro=OFICINA/ESTETICA/MODA) —
    // usado pra mandar direto pro cliente certo (dono de oficina não precisa
    // ver o card de Moda primeiro). selectedMacro já inicializa correto (lazy
    // initializer acima); aqui só rola até a seção pra quem chegou por esse
    // link não precisar passar pela hero de Food pra achar o card dele.
    const macroParam = (searchParams.get("macro") ?? "").toUpperCase();
    if (MACRO_SEGMENTS.some((m) => m.key === macroParam) && macroParam !== "FOOD") {
      trackClick("/demo", `link_macro_${macroParam.toLowerCase()}`);
      // behavior:"auto" (salto direto, sem animação) — "smooth" fica preso em
      // 0 nesta página (testado ao vivo; suspeita de scroll-behavior global
      // ou layout shift das imagens do hero competindo com a animação).
      // Também é a UX certa aqui: quem abriu o link já quer ver o card, não
      // assistir a rolagem.
      setTimeout(() => segmentsSectionRef.current?.scrollIntoView({ behavior: "auto", block: "start" }), 300);
    }

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

  // Exit-intent: captura visitantes que estão saindo sem converter.
  // Desktop — dispara quando o mouse sai pela borda superior da viewport
  // (comportamento clássico de "vai fechar a aba"). Mobile não tem mouse,
  // então usamos um fallback por tempo de permanência (45s sem converter).
  useEffect(() => {
    const alreadyShown = sessionStorage.getItem("exit_intent_shown");
    if (alreadyShown) return;

    function trigger() {
      if (exitIntentTriggeredRef.current || leadCapturedRef.current || modalDemo) return;
      exitIntentTriggeredRef.current = true;
      sessionStorage.setItem("exit_intent_shown", "1");
      setShowExitIntent(true);
    }

    function onMouseOut(e: MouseEvent) {
      if (e.clientY <= 0 && !e.relatedTarget) trigger();
    }

    document.addEventListener("mouseout", onMouseOut);
    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const mobileTimer = isTouchDevice ? setTimeout(trigger, 45_000) : null;

    return () => {
      document.removeEventListener("mouseout", onMouseOut);
      if (mobileTimer) clearTimeout(mobileTimer);
    };
  }, [modalDemo]);

  async function handleExitIntentConfirm(form: ExitIntentForm) {
    setExitIntentSending(true);
    leadCapturedRef.current = true;
    try {
      const w = window as any;
      if (w.fbq) w.fbq("track", "Lead", { content_name: "Exit Intent Popup", currency: "BRL" });
      if (w.gtag) w.gtag("event", "generate_lead", { event_category: "exit_intent", event_label: "demo_page" });
    } catch {}
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken: `exit-intent-${crypto.randomUUID()}`,
          name: form.name,
          whatsapp: form.whatsapp,
          conversationSummary: "Capturado via pop-up de saída (exit-intent) na /demo",
          waClicked: true,
        }),
        keepalive: true,
      });
    } catch {}
    setShowExitIntent(false);
    setExitIntentSending(false);
    window.open(SPECIALIST_WA_URL, "_blank", "noopener,noreferrer");
  }

  async function enterDemoWithLead(demo: DemoAccount, form: LeadForm) {
    trackClick("/demo", `demo_entered_${demo.plan.toLowerCase()}`);
    setEntering(demo.id);
    // NÃO marca leadCapturedRef aqui — sem formulário, nenhum dado real foi
    // capturado; o exit-intent continua podendo aparecer depois se o
    // visitante sair sem converter (é o único jeito de capturar esse lead
    // agora que "Testar X" entra direto, sem gate).
    recordNicheVisit(selectedNiche); // marketing: nicho no momento da conversão
    // Evento custom (não "Lead" — sem dado capturado, "Lead" real fica só no exit-intent)
    try {
      const w = window as any;
      if (w.fbq) w.fbq("trackCustom", "DemoEntered", { content_name: `Demo ${demo.plan}` });
      if (w.gtag) w.gtag("event", "demo_entered", { event_category: "demo", event_label: demo.plan });
    } catch {}
    try {
      const { data } = await api.post("auth/demo-access", {
        name: form.name, email: form.email, whatsapp: form.whatsapp,
        restaurantName: form.restaurantName,
        plan: demo.plan.toLowerCase(),
        demoAccountId: demo.id,
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
    trackClick("/demo", "scroll_to_demo");
    demoSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  // Link pronto pra mandar pro cliente certo — abre esta mesma página já
  // com o card do ecossistema dele selecionado (?macro=OFICINA/ESTETICA/
  // MODA), sem precisar explicar "role até achar seu segmento". Food usa a
  // própria home (comportamento padrão, sem macro na URL).
  function copyMacroLink(m: MacroSegment) {
    // Para os produtos irmãos, o link compartilhável precisa sair do hub e
    // abrir a demo real daquele sistema. O filtro ?macro= continua sendo
    // usado apenas na navegação interna do hub.
    const url = m.href ?? `${window.location.origin}/demo`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        trackClick("/demo", `copy_link_${m.key.toLowerCase()}`);
        toast.success(`Link de ${m.label} copiado!`);
      })
      .catch(() => toast.error("Não foi possível copiar o link."));
  }

  // Rotaciona a palavra da hero (delivery/loja/clínica/oficina) a cada 2.4s,
  // com um crossfade curto — nunca troca de golpe.
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroWordFading(true);
      setTimeout(() => {
        setHeroWordIdx((i) => (i + 1) % HERO_WORDS.length);
        setHeroWordFading(false);
      }, 220);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

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

      {showExitIntent && (
        <ExitIntentModal
          niche={selectedNiche}
          loading={exitIntentSending}
          onClose={() => setShowExitIntent(false)}
          onConfirm={handleExitIntentConfirm}
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
              <a href={SPECIALIST_WA_URL} target="_blank" rel="noopener noreferrer" onClick={() => trackClick("/demo", "whatsapp_consultor")}
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

            {/* Copy — centered; a prova visual vem logo abaixo (Trust Metrics
                + Showcase de telas), sem mockup espremido/cortado na hero */}
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-orange-400">
                O ERP que transforma pedido em lucro
              </span>

              <h1 className="mt-7 text-5xl font-black leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
                <span
                  className={`inline-block transition-opacity duration-200 ${heroWordFading ? "opacity-0" : "opacity-100"}`}
                >
                  {HERO_WORDS[heroWordIdx].article} {HERO_WORDS[heroWordIdx].word}
                </span>{" "}
                vende.{" "}
                <br className="hidden sm:block" />
                Mas você sabe{" "}
                <span className="bg-gradient-to-r from-orange-400 via-orange-300 to-amber-400 bg-clip-text text-transparent">
                  quanto sobra?
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-relaxed text-white/50 sm:text-lg mx-auto">
                PDV, cozinha e cardápio próprio andando juntos — e o{" "}
                <span className="text-white/80 font-semibold">custo real de cada prato</span>{" "}
                ao lado do preço de venda. Para{" "}
                <span className="text-white/80 font-semibold">pizzarias, restaurantes, hamburguerias</span>,{" "}
                <span className="text-white/80 font-semibold">delivery & dark kitchens</span> e mais.
              </p>

              <div className="mt-10 flex flex-col items-center gap-4">
                <button onClick={scrollToDemo}
                  className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-8 py-4 text-sm font-black text-white shadow-[0_8px_24px_-6px_rgba(249,115,22,0.6),inset_0_1px_0_rgba(255,255,255,0.15)] transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-[0_12px_30px_-6px_rgba(249,115,22,0.7)]">
                  Começar Teste Grátis de 10 Dias
                  <ArrowRight className="h-4 w-4" />
                </button>
                <a href={SPECIALIST_WA_URL} target="_blank" rel="noopener noreferrer" onClick={() => trackClick("/demo", "whatsapp_consultor")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/45 transition hover:text-white/75">
                  <MessageCircle className="h-3.5 w-3.5" />
                  ou fale com um especialista pelo WhatsApp
                </a>
              </div>
            </div>

          </div>
        </section>

        {/* ── SEGMENTOS ATENDIDOS — logo após a hero, ainda na "primeira
             dobra" de contexto: quem chega precisa ver de cara que o
             ecossistema cobre Food/Oficina/Estética/Moda, não só descobrir
             isso depois de rolar por conteúdo 100% food-specific. Macro
             (Food/Oficina/Estética/Moda) com subsegmentos filtrados
             dinamicamente. Só Food tem catálogo/demo real dentro desta
             própria página; os outros 3 são produtos separados (repo/banco/
             deploy próprios) — clicar num macro diferente nunca finge ter
             demo aqui, sempre linka pro sistema de verdade dele. ── */}
        <section ref={segmentsSectionRef} className="mx-auto max-w-6xl px-5 pb-20 pt-2 sm:px-8">
          <div className="mb-8 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-orange-400">
              Segmentos atendidos
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Feito sob medida pro seu negócio
            </h2>
            <p className="mt-3 text-sm text-white/50">
              Escolha sua área — as telas e recursos se ajustam pro seu tipo de operação
            </p>
            <p className="mt-1 text-[11px] text-white/30">
              Vai mandar pra um cliente específico? Use o botão <Copy className="inline h-3 w-3 align-[-1px]" /> no card certo — abre direto no segmento dele
            </p>
          </div>

          {/* ── Macro cards (com foto) — o card ativo é tingido com a cor
               própria daquele macro-segmento (laranja Food, azul Oficina,
               rosa Estética, roxo Moda), não sempre laranja igual antes.
               Div (não button) pra caber o botão real de "copiar link" sem
               aninhar button-dentro-de-button. ── */}
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {MACRO_SEGMENTS.map((m) => {
              const isActive = selectedMacro === m.key;
              return (
                <div
                  key={m.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    trackClick("/demo", `macro_${m.key.toLowerCase()}`);
                    if (m.href) {
                      window.location.assign(m.href);
                      return;
                    }
                    setSelectedMacro(m.key);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      trackClick("/demo", `macro_${m.key.toLowerCase()}`);
                      if (m.href) {
                        window.location.assign(m.href);
                        return;
                      }
                      setSelectedMacro(m.key);
                    }
                  }}
                  className="group cursor-pointer rounded-2xl border p-2.5 text-left transition-all hover:border-white/20 hover:bg-white/[0.05]"
                  style={
                    isActive
                      ? { borderColor: `${m.color}80`, background: `${m.color}14`, boxShadow: `0 8px 24px -8px ${m.color}66` }
                      : { borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-white">{m.emoji} {m.label.split(" / ")[0].split(" & ")[0]}</p>
                      <p className="truncate text-[10px] leading-tight text-white/40">{m.subtitle}</p>
                    </div>
                    {m.href === null && (
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black text-white" style={{ background: m.color }}>
                        Você está aqui
                      </span>
                    )}
                  </div>
                  <div className="relative mt-2 h-20 overflow-hidden rounded-xl sm:h-24">
                    <Image src={m.image} alt={m.label} fill className="object-cover" sizes="200px" />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); copyMacroLink(m); }}
                      title={`Copiar link de demonstração — ${m.label}`}
                      className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[9px] font-black text-white backdrop-blur transition hover:bg-black/90"
                    >
                      <Copy className="h-3 w-3" />
                      Copiar link
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Subsegmentos dinâmicos (filtrados pelo macro selecionado) ──
               Cada tag tem ícone (SUBTAG_EMOJI/NICHES_DATA) E cor (SUBTAG_COLOR)
               próprios, "a caráter" — Lingerie em rosa, Ótica em azul, Barbearia
               em vermelho clássico — nunca todas herdando a mesma cor lisa do
               macro pai. Fallback pra macro.color cobre tag sem entrada no mapa.
               Food: clicar seleciona o nicho e rola pra pricing (dentro desta
               própria página). Outros macros: cada tag é um link real (abre a
               demo do produto daquele nicho numa aba nova). ── */}
          <div className="mb-8 flex flex-wrap justify-center gap-2">
            {(MACRO_SEGMENTS.find((m) => m.key === selectedMacro) ?? MACRO_SEGMENTS[0]).tags.map((tag) => {
              const isFood = selectedMacro === "FOOD";
              const macro = MACRO_SEGMENTS.find((m) => m.key === selectedMacro) ?? MACRO_SEGMENTS[0];
              const isActive = isFood && selectedNiche === tag;
              const emoji = isFood ? (NICHES_DATA[tag]?.emoji ?? "🍽️") : (SUBTAG_EMOJI[tag] ?? "•");
              const tagColor = isFood ? macro.color : (SUBTAG_COLOR[tag] ?? macro.color);
              const pillClass = "flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 cursor-pointer";
              const pillStyle = isActive
                ? { background: "#fff", color: "#000", boxShadow: `0 6px 18px -6px ${tagColor}aa`, transform: "scale(1.05)" }
                : { background: `${tagColor}1f`, color: `${tagColor}`, border: `1px solid ${tagColor}33` };
              if (isFood) {
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      setSelectedNiche(tag);
                      recordNicheVisit(tag);
                      scrollToDemo();
                    }}
                    className={pillClass}
                    style={pillStyle}
                  >
                    <span>{emoji}</span>
                    {tag}
                  </button>
                );
              }
              const nicheSlug = TAG_DEMO_NICHE_SLUG[tag];
              const tagHref = macro.href ? (nicheSlug ? `${macro.href}?niche=${nicheSlug}` : macro.href) : "#";
              return (
                <a
                  key={tag}
                  href={tagHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackClick("/demo", `tag_${selectedMacro.toLowerCase()}`)}
                  className={`${pillClass} hover:brightness-125`}
                  style={pillStyle}
                >
                  <span>{emoji}</span>
                  {tag}
                </a>
              );
            })}
          </div>

          <div className="flex justify-center">
            {selectedMacro === "FOOD" ? (
              <button onClick={scrollToDemo}
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-orange-600">
                Ver planos para {selectedNiche}
                <ChevronDown className="h-4 w-4" />
              </button>
            ) : (
              <a
                href={MACRO_SEGMENTS.find((m) => m.key === selectedMacro)?.href ?? "#"}
                target="_blank" rel="noopener noreferrer"
                onClick={() => trackClick("/demo", `ver_demo_${selectedMacro.toLowerCase()}`)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-6 py-3 text-sm font-black text-white transition hover:bg-white/[0.1]"
              >
                Ver demonstração de {MACRO_SEGMENTS.find((m) => m.key === selectedMacro)?.label}
                <ArrowRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </section>

        {/* ── TRUST METRICS ── */}
        <div className="border-y border-white/[0.06] bg-white/[0.02] backdrop-blur">
          <div className="mx-auto max-w-5xl px-5 sm:px-8">
            <div className="grid grid-cols-2 divide-x divide-white/[0.06] md:grid-cols-4">
              {[
                { icon: <Clock className="h-4 w-4" />, value: "10 dias", label: "de trial com tudo liberado" },
                { icon: <ShieldCheck className="h-4 w-4" />, value: "0%", label: "de comissão no cardápio" },
                { icon: <Zap className="h-4 w-4" />, value: "10 min", label: "para começar a vender" },
                { icon: <MessageCircle className="h-4 w-4" />, value: "WhatsApp", label: "suporte direto com o time" },
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

        {/* ── DEMONSTRAÇÃO DO PRODUTO (prova de valor, depois de já saber
             que o ecossistema cobre a área dele) ── */}

        {/* ── PILLARS (interactive tabs) ── */}
        <PillarsSection />

        {/* ── 3-PHONE MENU SHOWCASE ── */}
        <MenuPhoneShowcase />

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

        {/* ── PLANOS E PREÇOS — ponto único de decisão, penúltimo antes do
             rodapé. Antes esta seção existia 2x (uma logo após a hero, outra
             aqui) — unificada: cartões de plano + tabela comparativa +
             diferenciais, tudo num lugar só. ── */}
        <section id="demos" ref={demoSectionRef} className="mx-auto max-w-6xl px-5 pt-4 pb-28 sm:px-8">
          <div className="mb-8 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-orange-400">
              Planos
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Teste grátis, escolha depois
            </h2>
            <p className="mt-3 text-sm text-white/50">
              Segmento selecionado: <span className="font-semibold text-white/80">{selectedNiche}</span> — o módulo de atributos do produto vira{" "}
              <span className="font-semibold text-white/70">
                &ldquo;{(NICHES_DATA[selectedNiche] ?? NICHES_DATA["Restaurantes"]).moduleLabel}&rdquo;
              </span>
            </p>
          </div>

          {/* ── Link mágico do nicho selecionado (pra mandar pro prospect) ── */}
          <div className="mb-6 flex justify-center">
            <button
              onClick={() => {
                const slug = NICHE_TO_MAGIC_SLUG[selectedNiche] ?? "restaurantes";
                const url = `${window.location.origin}/demo/${slug}`;
                navigator.clipboard.writeText(url)
                  .then(() => toast.success(`Link copiado: /demo/${slug}`))
                  .catch(() => toast.error("Não foi possível copiar — copie manualmente da barra de endereço."));
                trackClick("/demo", `copy_magic_link_${slug}`);
              }}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/70 transition-all hover:bg-white/[0.09] hover:text-white"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar link desta demo (abre e loga sozinho pro cliente)
            </button>
          </div>

          {/* ── Personalização de cor (opcional, colapsado por padrão) ── */}
          <div className="mb-10 flex justify-center">
            <div className="w-full max-w-2xl rounded-2xl border border-white/[0.07] bg-white/[0.02]">
              <button
                onClick={() => setShowThemePicker((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left"
              >
                <span className="text-xs font-semibold text-white/60">
                  🎨 Personalizar a cor da demonstração <span className="text-white/30 font-normal">(opcional)</span>
                </span>
                <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${showThemePicker ? "rotate-180" : ""}`} />
              </button>
              {showThemePicker && (
                <div className="px-5 pb-5">
                  <p className="text-xs text-white/40 mb-3">
                    Você pode personalizar as cores pra cara do seu estabelecimento depois, nas configurações.
                  </p>
                  <div className="flex flex-wrap gap-3">
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
              )}
            </div>
          </div>

          {/* ── Plan cards ── */}
          <div className="mx-auto grid max-w-2xl gap-6 sm:grid-cols-2 mb-16">
            {PLAN_CARDS.map((card) => {
              // "Completo" reaproveita a conta/override que ANTES era
              // "Enterprise" (full-featured — PDV+mesas+cozinha+delivery, a
              // mesma coisa que o cadastro real chama de "Completo" hoje) em
              // vez de reescrever o mapa de contas por nicho do zero.
              const lookupPlan = card.plan === "COMPLETO" ? "ENTERPRISE" : card.plan;
              const baseDemo = DEMO_ACCOUNTS.find((d) => d.plan.toUpperCase() === lookupPlan) ?? DEMO_ACCOUNTS[0];
              const overrideId = NICHE_DEMO_OVERRIDE[selectedNiche]?.[lookupPlan as "BASIC" | "PRO" | "ENTERPRISE" | "DELIVERY"];
              // Override troca a CONTA (evita catálogo do nicho errado); o
              // texto do card continua o do plano clicado — só o catálogo
              // real dentro da demo muda.
              const demo = overrideId ? (DEMO_ACCOUNTS.find((d) => d.id === overrideId) ?? baseDemo) : baseDemo;
              const nicheInfo = NICHES_DATA[selectedNiche] ?? NICHES_DATA["Restaurantes"];
              const planKey = card.plan === "COMPLETO" ? "enterprise" : "delivery";
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
                    <p className="mb-3 text-xs text-white/50">{card.desc}</p>
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
                      onClick={() => {
                        trackClick("/demo", `plan_cta_${card.plan.toLowerCase()}`);
                        const nicheSlug = getDemoNicheSlug(demo.id);
                        if (nicheSlug) {
                          window.location.assign(`/demo/${nicheSlug}`);
                          return;
                        }
                        // Sem gate de formulário — "Testar X" entra direto na demo,
                        // como o botão promete. Captura de lead fica só no
                        // exit-intent (secundária, não bloqueia quem quer só ver).
                        enterDemoWithLead(demo, { name: "", email: "", whatsapp: "", restaurantName: "" });
                      }}
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

          <div className="mb-10 text-center">
            <h3 className="text-xl font-black tracking-tight text-white sm:text-2xl">Comparativo completo</h3>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr] lg:items-start">
            {/* Tabela compacta */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur">
              <div className="grid grid-cols-3 border-b border-white/[0.07] bg-white/[0.03]">
                <div className="p-3" />
                {(["DELIVERY", "COMPLETO"] as const).map((plan, i) => {
                  const colors = ["#ea580c", "#7c3aed"];
                  return (
                    <div key={plan} className="border-l border-white/[0.07] p-2.5 text-center">
                      <span className="inline-block rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest"
                        style={{ color: colors[i], backgroundColor: `${colors[i]}22`, border: `1px solid ${colors[i]}44` }}>
                        {plan}
                      </span>
                    </div>
                  );
                })}
              </div>
              {COMPARISON.map((feat, idx) => (
                <div key={feat.label}
                  className={`grid grid-cols-3 border-b border-white/[0.05] transition hover:bg-white/[0.02] ${idx === COMPARISON.length - 1 ? "border-b-0" : ""}`}>
                  <div className="flex items-center px-3 py-2.5 text-xs font-medium text-white/75">{feat.label}</div>
                  {(["delivery", "completo"] as PlanKey[]).map((key, i) => {
                    const colors = ["#ea580c", "#7c3aed"];
                    const val = feat[key];
                    return (
                      <div key={key} className="flex items-center justify-center border-l border-white/[0.05] py-2.5">
                        {val ? (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: `${colors[i]}22` }}>
                            <Check className="h-3 w-3" style={{ color: colors[i] }} strokeWidth={3} />
                          </span>
                        ) : (
                          <Minus className="h-3.5 w-3.5 text-white/20" strokeWidth={2} />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Grid de diferenciais — divide o espaço com detalhes */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { icon: Smartphone, title: "Sem limite de dispositivos", desc: "PDV, celular e tablet sem taxa extra por aparelho." },
                { icon: Users, title: "Sem limite de usuários", desc: "Toda a equipe cadastrada sem cobrança adicional." },
                { icon: MessageCircle, title: "WhatsApp com IA", desc: "Atendimento automático que fecha pedidos sozinho." },
                { icon: Store, title: "Cardápio digital próprio", desc: "Loja online no seu domínio, sem comissão de app." },
                { icon: TrendingUp, title: "Relatórios em tempo real", desc: "Vendas, CMV e ticket médio sempre atualizados." },
                { icon: ShieldCheck, title: "Suporte em português", desc: "Time local, resposta rápida, sem tradutor automático." },
              ].map((h) => (
                <div key={h.title}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-center transition hover:bg-white/[0.04]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10">
                    <h.icon className="h-4.5 w-4.5 text-orange-400" strokeWidth={2} />
                  </div>
                  <div className="text-xs font-bold leading-tight">{h.title}</div>
                  <div className="text-[10px] leading-snug text-white/45">{h.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-8 text-center text-[11px] text-white/30">
            Sem fidelidade · Cancele quando quiser · Suporte em português
          </p>
        </section>

        {/* ── FAQ ── */}
        <section className="mx-auto max-w-3xl px-5 pb-20 sm:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Perguntas frequentes</h2>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 open:border-white/[0.15] open:bg-white/[0.05]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-white">
                  {f.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-white/40 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{f.a}</p>
              </details>
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
            <p className="mt-3 text-sm text-white/45">10 dias grátis, com todos os módulos liberados. Sem cartão.</p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/signup" onClick={() => trackClick("/demo", "signup_footer_cta")}
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-6 py-3.5 text-sm font-black text-white shadow-[0_8px_24px_-6px_rgba(249,115,22,0.5),inset_0_1px_0_rgba(255,255,255,0.15)] transition hover:bg-orange-600">
                Criar minha conta grátis
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button onClick={scrollToDemo}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-white/70 transition hover:bg-white/[0.06]">
                Só quero explorar uma demo
              </button>
              <a href={SPECIALIST_WA_URL} target="_blank" rel="noopener noreferrer" onClick={() => trackClick("/demo", "whatsapp_consultor")}
                className="inline-flex items-center gap-2 rounded-2xl border border-green-500/25 bg-green-500/8 px-6 py-3.5 text-sm font-semibold text-green-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:bg-green-500/15">
                <MessageCircle className="h-4 w-4" />
                WhatsApp · Consultor online agora
              </a>
            </div>
            <p className="mt-5 text-[11px] text-white/25">
              Sem fidelidade · Cancele quando quiser · Suporte em português
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
          <p>© {new Date().getFullYear()} R_FoodSaaS ERP — Demonstração pública</p>
          <Link href="/termos" className="mt-2 inline-flex items-center gap-1 text-orange-400/80 underline decoration-orange-400/30 underline-offset-4 hover:text-orange-400 hover:decoration-orange-400/60 transition-colors">
            <FileText className="h-3 w-3" />
            Termos, Privacidade e Suporte
          </Link>
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
