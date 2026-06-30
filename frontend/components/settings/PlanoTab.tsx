"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2, Clock, XCircle, Zap, Star, Loader2,
  MessageCircle, ArrowUpCircle, Sparkles,
  RefreshCw, X, AlertTriangle, ChevronRight,
  Map, ShoppingBag, Wifi, FileText, Bot, Gift,
  Play, Settings, BarChart3, Shield, Headphones,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

type ModStatus = "ACTIVE" | "TRIAL" | "INACTIVE" | "EXPIRED";

interface BackendMod {
  moduleSlug?: string;
  slug?: string;
  module?: string;
  status?: ModStatus;
  active?: boolean;
  trialEndsAt?: string | null;
  activatedAt?: string | null;
}

interface Feature { icon: React.ReactNode; title: string; desc: string; }

// ─────────────────────────────────────────────
// Ícones de marca (SVG inline)
// ─────────────────────────────────────────────

const GtmIcon = () => (
  <svg viewBox="0 0 64 64" width="26" height="26" fill="none">
    <path d="M32 4L4 32l28 28 28-28L32 4z" fill="#4285F4"/>
    <path d="M32 12L14 30l8 8 10-10 10 10 8-8L32 12z" fill="#80B3F5"/>
    <path d="M22 32l10 10 10-10-10-10-10 10z" fill="white"/>
    <rect x="29" y="20" width="6" height="14" rx="1" fill="white"/>
  </svg>
);

const Ga4Icon = () => (
  <svg viewBox="0 0 64 64" width="26" height="26" fill="none">
    <rect x="6"  y="34" width="12" height="22" rx="3" fill="#F9AB00"/>
    <rect x="22" y="20" width="12" height="36" rx="3" fill="#F9AB00"/>
    <rect x="38" y="28" width="12" height="28" rx="3" fill="#E37400"/>
    <circle cx="56" cy="54" r="5" fill="#E37400"/>
  </svg>
);

const PixelIcon = () => (
  <svg viewBox="0 0 64 64" width="26" height="26" fill="none">
    <rect width="64" height="64" rx="10" fill="#1C2B4B"/>
    <path d="M14 22l-8 10 8 10M50 22l8 10-8 10" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M38 16L26 48" stroke="#1877F2" strokeWidth="4" strokeLinecap="round"/>
  </svg>
);


// ─────────────────────────────────────────────
// Ferramentas de Analytics (integração gratuita)
// ─────────────────────────────────────────────

interface AnalyticsTool {
  slug:        string;
  name:        string;
  subtitle:    string;
  icon:        React.ReactNode;
  iconBg:      string;
  configPath:  string;   // onde o usuário configura
  fieldKey:    string;   // campo da company que indica se está ativo
  description: string;
  howToGet:    string;   // onde obter o ID/código
}

const ANALYTICS_TOOLS: AnalyticsTool[] = [
  {
    slug:       "gtm",
    name:       "Google Tag Manager",
    subtitle:   "Ferramenta de rastreamento de eventos",
    icon:       <GtmIcon />,
    iconBg:     "bg-blue-50",
    configPath: "/configuracoes?tab=aparencia",
    fieldKey:   "googleTagManagerId",
    description: "Gerencie todos os seus scripts de rastreamento (GA4, Pixel, etc.) em um único lugar, sem precisar editar código.",
    howToGet:   "Acesse tagmanager.google.com → crie uma conta → copie o ID do contêiner (ex: GTM-XXXXXXX).",
  },
  {
    slug:       "ga4",
    name:       "Google Analytics 4",
    subtitle:   "Ferramenta de análise de dados",
    icon:       <Ga4Icon />,
    iconBg:     "bg-amber-50",
    configPath: "/configuracoes?tab=aparencia",
    fieldKey:   "googleAnalyticsId",
    description: "Acompanhe visitantes, conversões e comportamento de usuários no seu cardápio digital e site.",
    howToGet:   "Acesse analytics.google.com → crie uma propriedade GA4 → copie o ID de medição (ex: G-XXXXXXXXXX).",
  },
  {
    slug:       "facebook-pixel",
    name:       "Facebook Pixel",
    subtitle:   "Ferramenta de rastreamento de eventos",
    icon:       <PixelIcon />,
    iconBg:     "bg-blue-50",
    configPath: "/configuracoes?tab=aparencia",
    fieldKey:   "metaPixelId",
    description: "Rastreie conversões do cardápio digital, otimize anúncios no Facebook e Instagram e crie públicos personalizados.",
    howToGet:   "Acesse business.facebook.com → Gerenciador de Eventos → crie um Pixel → copie o ID numérico.",
  },
];

interface ModuleDef {
  slug: string;
  name: string;
  category: "Operação" | "Financeiro" | "Automação" | "Marketing";
  price: number;
  description: string;          // curta — aparece no card
  longDescription: string;       // completa — aparece no modal de detalhes
  howToUse: string[];            // passo a passo
  features: Feature[];           // cards de funcionalidades
  terms: string;
  icon: React.ReactNode;
  highlighted?: boolean;
  isFree?: boolean;
}

// ─────────────────────────────────────────────
// Catálogo de módulos
// ─────────────────────────────────────────────

const MODULES: ModuleDef[] = [

  // ══════════════════════════════════════════════
  // OPERAÇÃO
  // ══════════════════════════════════════════════

  // ── PDV & Caixa (gratuito) ────────────────────
  {
    slug: "pdv",
    name: "PDV & Caixa",
    category: "Operação",
    price: 0,
    isFree: true,
    icon: <ShoppingBag size={20} />,
    description: "Frente de caixa completa: lançamento de pedidos, cartão, PIX e fechamento de caixa inclusos no plano.",
    longDescription:
      "O PDV FoodSaaS é o coração do sistema. Lance pedidos em segundos, controle o caixa diário, registre entradas e saídas e encerre o caixa com um clique. Incluso em todos os planos sem custo adicional.",
    howToUse: [
      "Acesse 'PDV' no menu lateral.",
      "Selecione produtos por categoria ou busque pelo nome.",
      "Adicione ao carrinho, escolha a forma de pagamento e confirme.",
      "O pedido vai automaticamente para a cozinha (se KDS ativo).",
      "Feche o caixa ao fim do dia em 'Financeiro → Caixa'.",
    ],
    features: [
      { icon: <Zap size={16} />,       title: "Lançamento rápido",    desc: "Adicione produtos ao carrinho em 2 cliques." },
      { icon: <Shield size={16} />,    title: "Múltiplas formas",      desc: "PIX, cartão crédito/débito, dinheiro e voucher." },
      { icon: <BarChart3 size={16} />, title: "Fechamento de caixa",   desc: "Relatório automático de entradas e saídas." },
      { icon: <CheckCircle2 size={16} />, title: "Gratuito",           desc: "Incluso em todos os planos sem custo extra." },
    ],
    terms: `O módulo PDV & Caixa está incluso em todos os planos FoodSaaS sem custo adicional. Não há cobrança extra para ativação ou uso.`,
  },

  // ── Gestão de Entregas ────────────────────────
  {
    slug: "delivery",
    name: "Gestão de Entregas",
    category: "Operação",
    price: 48,
    icon: <Map size={20} />,
    description: "Zonas de entrega por bairro, taxa automática por localização e painel de despacho de motoboys.",
    longDescription:
      "Configure zonas de entrega com taxa por bairro ou raio, defina taxa mínima e valor de frete grátis. O sistema calcula e aplica a taxa automaticamente ao pedido. Painel de despacho mostra pedidos prontos aguardando motoboy.",
    howToUse: [
      "Acesse 'Configurações → Entrega' e clique em 'Nova zona'.",
      "Defina o bairro (ou raio em km) e a taxa de entrega.",
      "O sistema aplicará a taxa automaticamente nos pedidos do cardápio digital.",
      "No painel 'Entregadores', despache pedidos prontos para o motoboy.",
    ],
    features: [
      { icon: <Map size={16} />,        title: "Zonas por bairro",     desc: "Taxa diferenciada por bairro ou raio em km." },
      { icon: <Zap size={16} />,        title: "Taxa automática",       desc: "Aplicada sem o operador precisar digitar." },
      { icon: <Shield size={16} />,     title: "Frete grátis",         desc: "Configure valor mínimo para isenção." },
      { icon: <BarChart3 size={16} />,  title: "Painel de despacho",   desc: "Veja pedidos prontos e despache motoboys." },
    ],
    terms: `Ao ativar o módulo "Gestão de Entregas", o contratante concorda com a cobrança adicional recorrente de R$ 48,00/mês adicionada ao plano atual. O cancelamento encerra o módulo no próximo ciclo.`,
  },

  // ── Emissão de Nota Fiscal ────────────────────
  {
    slug: "fiscal",
    name: "Emissão de Nota Fiscal",
    category: "Operação",
    price: 79,
    highlighted: true,
    icon: <FileText size={20} />,
    description: "Emita NFS-e e NFC-e direto pelo sistema de forma automatizada e sem burocracia.",
    longDescription:
      "Chega de acessar sites de prefeitura ou programas separados. Com o módulo Fiscal, a emissão de Nota Fiscal de Consumidor (NFC-e) e Nota Fiscal de Serviço (NFS-e) é feita com um clique dentro do FoodSaaS — automaticamente após cada venda, se você quiser. O certificado digital é configurado uma única vez e tudo o mais é automático.",
    howToUse: [
      "Acesse 'Configurações → Fiscal' e preencha os dados do seu CNPJ.",
      "Faça o upload do seu certificado digital A1 (arquivo .pfx).",
      "Escolha o regime tributário (Simples Nacional, Lucro Presumido, etc.).",
      "Ative 'Emissão automática' para gerar NFC-e após cada venda confirmada.",
      "Notas emitidas ficam disponíveis para download em PDF e XML.",
    ],
    features: [
      { icon: <Zap size={16} />,       title: "Emissão automática",    desc: "NFC-e gerada sozinha ao confirmar o pedido." },
      { icon: <FileText size={16} />,  title: "NFS-e e NFC-e",         desc: "Suporte a nota de serviço e de consumidor." },
      { icon: <Shield size={16} />,    title: "SEFAZ homologado",      desc: "Integração direta com a SEFAZ de cada estado." },
      { icon: <BarChart3 size={16} />, title: "Histórico e reemissão", desc: "Consulte e cancele notas emitidas com facilidade." },
    ],
    terms: `Ao ativar o módulo "Emissão de Nota Fiscal (NFS-e / NFC-e)", o contratante concorda com a cobrança adicional recorrente de R$ 79,00/mês adicionada ao plano atual. A ativação do recurso é imediata e a cobrança será proporcional ou inclusa no próximo ciclo do Mercado Pago.\n\nCONDIÇÕES ESPECÍFICAS:\n• O contratante é responsável por manter seus dados fiscais atualizados.\n• A FoodSaaS não se responsabiliza por notas emitidas com dados incorretos.\n• O cancelamento do módulo não cancela notas já emitidas.`,
  },

  // ── Controle de Estoque ───────────────────────
  {
    slug: "stock",
    name: "Controle de Estoque",
    category: "Operação",
    price: 29,
    icon: <Settings size={20} />,
    description: "Fichas técnicas, baixa automática de ingredientes a cada venda e alertas de estoque mínimo.",
    longDescription:
      "Saiba em tempo real quanto de cada ingrediente você tem em estoque. Configure fichas técnicas por produto e o sistema baixa automaticamente ao confirmar cada pedido. Alertas automáticos quando o estoque chegar ao mínimo configurado.",
    howToUse: [
      "Cadastre seus ingredientes em 'Estoque → Ingredientes'.",
      "Em 'Receitas', crie a ficha técnica de cada produto com as quantidades.",
      "Ao confirmar pedidos, o estoque é baixado automaticamente.",
      "Configure o estoque mínimo para receber alertas de reposição.",
    ],
    features: [
      { icon: <Zap size={16} />,        title: "Baixa automática",     desc: "Estoque descontado a cada pedido confirmado." },
      { icon: <AlertTriangle size={16} />, title: "Alertas de mínimo", desc: "Notificação quando o estoque cair abaixo do limite." },
      { icon: <FileText size={16} />,   title: "Ficha técnica",        desc: "CMV real calculado por ingrediente e produto." },
      { icon: <BarChart3 size={16} />,  title: "Relatório de perdas",  desc: "Controle de desperdício e ajuste de inventário." },
    ],
    terms: `Ao ativar o módulo "Controle de Estoque", o contratante concorda com a cobrança adicional recorrente de R$ 29,00/mês adicionada ao plano atual. O cancelamento encerra o módulo no próximo ciclo.`,
  },

  // ── Sistema de Cozinha (KDS) ──────────────────
  {
    slug: "kitchen",
    name: "Sistema de Cozinha (KDS)",
    category: "Operação",
    price: 29,
    icon: <Play size={20} />,
    description: "Tela de cozinha em tempo real com pedidos organizados por tempo de espera e por setor (bar, fritadeira).",
    longDescription:
      "Elimine o papel na cozinha. O KDS exibe os pedidos em tempo real na tela da cozinha, com temporizador por pedido, roteamento por setor (bebidas no bar, frituras na fritadeira) e impressão automática. Quando o prato fica pronto, o operador muda o status e o salão é avisado.",
    howToUse: [
      "Instale o KDS em um tablet ou TV conectada ao Wi-Fi.",
      "Acesse /kitchen no navegador — sem instalar app.",
      "Pedidos chegam automaticamente assim que confirmados no PDV.",
      "Toque em 'Preparando' → 'Pronto' à medida que cada prato fica pronto.",
    ],
    features: [
      { icon: <Zap size={16} />,        title: "Tempo real",          desc: "Pedidos chegam instantaneamente na tela da cozinha." },
      { icon: <Play size={16} />,       title: "Sem instalação",       desc: "Funciona em qualquer navegador (tablet, TV, PC)." },
      { icon: <Shield size={16} />,     title: "Por setor",            desc: "Roteamento: bebidas no bar, pratos na cozinha." },
      { icon: <BarChart3 size={16} />,  title: "Temporizador",         desc: "Alertas de pedidos há mais de X minutos em espera." },
    ],
    terms: `Ao ativar o módulo "Sistema de Cozinha (KDS)", o contratante concorda com a cobrança adicional recorrente de R$ 29,00/mês adicionada ao plano atual. O cancelamento encerra o módulo no próximo ciclo.`,
  },

  // ── Multi-Loja ────────────────────────────────
  {
    slug: "multi-store",
    name: "Multi-Loja",
    category: "Operação",
    price: 149,
    icon: <Sparkles size={20} />,
    description: "Gerencie múltiplas unidades em um único painel com dashboards consolidados e cardápio centralizado.",
    longDescription:
      "Para redes e franquias. Acesse todas as unidades em um único login, compare faturamento entre lojas, replique o cardápio de uma unidade para outras e consolide relatórios em um painel executivo único.",
    howToUse: [
      "Contrate o módulo Multi-Loja e informe o CNPJ de cada unidade.",
      "Cada unidade recebe seu próprio acesso e cardápio digital.",
      "No painel principal, acesse 'Relatórios → Consolidado' para ver todas as unidades.",
      "Replique promoções e cardápio de uma unidade para outras com um clique.",
    ],
    features: [
      { icon: <BarChart3 size={16} />, title: "Dashboard consolidado", desc: "Faturamento de todas as unidades em tempo real." },
      { icon: <RefreshCw size={16} />, title: "Replicação de cardápio", desc: "Propague atualizações para todas as unidades." },
      { icon: <Shield size={16} />,    title: "Acesso por unidade",     desc: "Equipe de cada loja acessa apenas a sua unidade." },
      { icon: <Sparkles size={16} />,  title: "Franquias",              desc: "Ideal para redes com múltiplos CNPJ." },
    ],
    terms: `Ao ativar o módulo "Multi-Loja", o contratante concorda com a cobrança adicional recorrente de R$ 149,00/mês adicionada ao plano atual. O cancelamento encerra o módulo no próximo ciclo.`,
  },

  // ══════════════════════════════════════════════
  // MARKETING
  // ══════════════════════════════════════════════

  // ── Fidelidade & Cupons ───────────────────────
  {
    slug: "loyalty",
    name: "Fidelidade & Cupons",
    category: "Marketing",
    price: 39,
    icon: <Gift size={20} />,
    description: "Crie programas de pontos, cashback e campanhas de cupons para reter seus clientes.",
    longDescription:
      "Transforme clientes eventuais em clientes fiéis. Configure regras de pontuação (ex: 1 ponto a cada R$1 gasto), cashback automático e cupons de desconto com validade e limite de uso. Os clientes visualizam seu saldo pelo cardápio digital e escolhem como resgatar.",
    howToUse: [
      "Acesse 'Fidelidade' no menu lateral e clique em 'Configurar programa'.",
      "Defina a regra de acúmulo (ex: 1 ponto por R$1 gasto ou por pedido).",
      "Configure o valor de resgate (ex: 100 pontos = R$5 de desconto).",
      "Crie cupons em 'Cupons → Novo Cupom' com desconto %, fixo ou frete grátis.",
      "Compartilhe o código do cupom via WhatsApp ou exiba no cardápio digital.",
    ],
    features: [
      { icon: <Star size={16} />,      title: "Pontos por compra",       desc: "Regras flexíveis de acúmulo por valor ou por pedido." },
      { icon: <Gift size={16} />,      title: "Cashback automático",      desc: "Percentual de volta direto na conta do cliente." },
      { icon: <Zap size={16} />,       title: "Cupons de desconto",       desc: "%, valor fixo ou frete grátis com limite de uso." },
      { icon: <BarChart3 size={16} />, title: "Ranking de clientes",      desc: "Identifique e recompense os melhores clientes." },
    ],
    terms: `Ao ativar o módulo "Fidelidade & Cupons", o contratante concorda com a cobrança adicional recorrente de R$ 39,00/mês adicionada ao plano atual. A ativação do recurso é imediata e a cobrança será proporcional ou inclusa no próximo ciclo do Mercado Pago.\n\nCONDIÇÕES ESPECÍFICAS:\n• As regras de pontuação, cashback e validade são de responsabilidade exclusiva do contratante.\n• Ao desativar o módulo, pontos acumulados ficam preservados até a reativação.`,
  },

  // ── Cupons Avançados ──────────────────────────
  {
    slug: "coupons",
    name: "Cupons & Promoções",
    category: "Marketing",
    price: 39,
    icon: <Zap size={20} />,
    description: "Motor de cupons avançado com combos, promoções relâmpago e campanhas por segmento de cliente.",
    longDescription:
      "Crie cupons com regras avançadas: desconto por categoria, valor mínimo de pedido, uso por CPF, validade por data e hora, quantidade máxima de resgates. Lance promoções relâmpago (ex: 20% de desconto das 12h às 14h) e notifique seus clientes automaticamente.",
    howToUse: [
      "Acesse 'Cupons → Novo Cupom' e defina o tipo (%, fixo, frete grátis).",
      "Configure restrições: valor mínimo, validade, limite de usos, categorias elegíveis.",
      "Compartilhe o código via WhatsApp, redes sociais ou QR Code.",
      "Acompanhe resgates e conversão em tempo real no painel.",
    ],
    features: [
      { icon: <Zap size={16} />,        title: "Promoções relâmpago",   desc: "Cupons com janela de horário configurável." },
      { icon: <Shield size={16} />,     title: "Regras avançadas",      desc: "Limite por CPF, categoria de produto ou valor mínimo." },
      { icon: <BarChart3 size={16} />,  title: "Relatório de conversão", desc: "Veja quais cupons geraram mais vendas." },
      { icon: <MessageCircle size={16} />, title: "QR Code para o cupom", desc: "Geração automática de QR para exibição física." },
    ],
    terms: `Ao ativar o módulo "Cupons & Promoções", o contratante concorda com a cobrança adicional recorrente de R$ 39,00/mês adicionada ao plano atual. O cancelamento encerra o módulo no próximo ciclo.`,
  },

  // ── Robô WhatsApp IA ──────────────────────────
  {
    slug: "whatsapp-ia",
    name: "Robô de Atendimento WhatsApp IA",
    category: "Marketing",
    price: 55,
    highlighted: true,
    icon: <Bot size={20} />,
    description: "Atendente virtual com IA que responde clientes e anota pedidos sozinho no WhatsApp.",
    longDescription:
      "Atenda centenas de clientes simultaneamente, 24 horas por dia, sem contratar mais atendentes. A Kely — IA da FoodSaaS — responde dúvidas, apresenta o cardápio, anota pedidos, confirma endereço e encaminha para pagamento, tudo pelo WhatsApp. Quando o cliente pede para falar com uma pessoa, ela transfere automaticamente.",
    howToUse: [
      "Acesse 'Configurar IA → Conexões' e clique em 'Nova Conexão'.",
      "Escolha o provedor (WhatsApp Business / Evolution API / Meta Cloud API).",
      "Conecte seu número escaneando o QR Code.",
      "Em 'Configurar IA', defina o horário de atendimento e modo (Auto/Híbrido/Manual).",
      "Personalize a saudação e o comportamento da Kely no campo 'Prompt personalizado'.",
    ],
    features: [
      { icon: <Bot size={16} />,         title: "IA humanizada (Kely)",     desc: "Conversa natural, entende contexto e variações." },
      { icon: <Zap size={16} />,         title: "Pedidos automáticos",      desc: "Anota e confirma pedidos sem intervenção humana." },
      { icon: <Headphones size={16} />,  title: "Transferência inteligente", desc: "Encaminha para atendente quando necessário." },
      { icon: <Clock size={16} />,       title: "24/7 sem pausas",           desc: "Atende fora do horário comercial sem custo extra." },
    ],
    terms: `Ao ativar o módulo "Robô de Atendimento WhatsApp IA", o contratante concorda com a cobrança adicional recorrente de R$ 55,00/mês adicionada ao plano atual. O cancelamento encerra o módulo no próximo ciclo.`,
  },

  // ── Recuperação de Clientes ───────────────────
  {
    slug: "customer-recovery",
    name: "Recuperação de Clientes",
    category: "Marketing",
    price: 45,
    icon: <RefreshCw size={20} />,
    description: "Envio automático de mensagens para clientes inativos com cupons personalizados de reativação.",
    longDescription:
      "Identifique automaticamente clientes que não pedem há 7, 14 ou 30 dias e dispare campanhas de reativação via WhatsApp com cupons personalizados. Configure gatilhos por tempo de inatividade e veja a taxa de reativação em tempo real.",
    howToUse: [
      "Acesse 'Marketing → Recuperação' e defina o prazo de inatividade (ex: 14 dias).",
      "Configure o cupom de reativação (ex: 15% de desconto).",
      "Ative a campanha — o sistema enviará automaticamente via WhatsApp.",
      "Acompanhe clientes reativados e ROI da campanha no painel.",
    ],
    features: [
      { icon: <RefreshCw size={16} />, title: "Disparo automático",    desc: "Mensagens enviadas sozinhas quando o cliente some." },
      { icon: <Gift size={16} />,      title: "Cupom personalizado",   desc: "Desconto exclusivo para incentivar o retorno." },
      { icon: <BarChart3 size={16} />, title: "Taxa de reativação",    desc: "Veja quantos voltaram a pedir após a campanha." },
      { icon: <MessageCircle size={16} />, title: "Via WhatsApp",      desc: "Mensagens enviadas pelo número da sua loja." },
    ],
    terms: `Ao ativar o módulo "Recuperação de Clientes", o contratante concorda com a cobrança adicional recorrente de R$ 45,00/mês adicionada ao plano atual. O cancelamento encerra o módulo no próximo ciclo.`,
  },

  // ══════════════════════════════════════════════
  // FINANCEIRO
  // ══════════════════════════════════════════════

  // ── Controle de Caixa (gratuito) ─────────────
  {
    slug: "cash",
    name: "Controle de Caixa",
    category: "Financeiro",
    price: 0,
    isFree: true,
    icon: <Shield size={20} />,
    description: "Abertura e fechamento de caixa, registro de sangrias e suprimentos. Incluso em todos os planos.",
    longDescription:
      "Abra o caixa com o valor inicial, registre entradas e saídas ao longo do dia, faça sangrias e feche o caixa com relatório completo. Histórico de todos os movimentos disponível para auditoria.",
    howToUse: [
      "Acesse 'Financeiro → Caixa' e clique em 'Abrir Caixa'.",
      "Informe o valor inicial em espécie.",
      "Durante o dia, registre sangrias e suprimentos conforme necessário.",
      "No fim do dia, clique em 'Fechar Caixa' e confira o relatório.",
    ],
    features: [
      { icon: <Shield size={16} />,     title: "Abertura/fechamento",   desc: "Controle rigoroso com conferência de diferença." },
      { icon: <BarChart3 size={16} />,  title: "Sangrias e suprimentos", desc: "Registro de todas as movimentações manuais." },
      { icon: <CheckCircle2 size={16} />, title: "Gratuito",            desc: "Incluso em todos os planos sem custo extra." },
      { icon: <FileText size={16} />,   title: "Relatório diário",       desc: "Extrato completo ao fechar o caixa." },
    ],
    terms: `O módulo "Controle de Caixa" está incluso em todos os planos FoodSaaS sem custo adicional.`,
  },

  // ── Dashboard Financeiro ──────────────────────
  {
    slug: "financial-dashboard",
    name: "Dashboard Financeiro",
    category: "Financeiro",
    price: 39,
    icon: <BarChart3 size={20} />,
    description: "Visão unificada de receitas, despesas, CMV e margem bruta em gráficos interativos.",
    longDescription:
      "Acompanhe a saúde financeira do seu negócio em um único painel. Veja receitas vs despesas por período, CMV por categoria, margem bruta por produto e evolução do ticket médio — tudo em gráficos interativos com filtros por data.",
    howToUse: [
      "Acesse 'BI / Dashboard' no menu lateral.",
      "Selecione o período desejado (dia, semana, mês, período personalizado).",
      "Analise os KPIs: receita, CMV, margem bruta, ticket médio.",
      "Exporte o relatório em PDF ou CSV para apresentações.",
    ],
    features: [
      { icon: <BarChart3 size={16} />, title: "KPIs em tempo real",    desc: "Receita, CMV e margem sempre atualizados." },
      { icon: <Zap size={16} />,       title: "Gráficos interativos",  desc: "Filtros por data, categoria e forma de pagamento." },
      { icon: <FileText size={16} />,  title: "Exportação",            desc: "Relatórios em PDF e CSV com um clique." },
      { icon: <Shield size={16} />,    title: "Comparativo",           desc: "Compare períodos e veja tendências de crescimento." },
    ],
    terms: `Ao ativar o módulo "Dashboard Financeiro", o contratante concorda com a cobrança adicional recorrente de R$ 39,00/mês adicionada ao plano atual. O cancelamento encerra o módulo no próximo ciclo.`,
  },

  // ── DRE Gerencial ─────────────────────────────
  {
    slug: "dre",
    name: "DRE Gerencial",
    category: "Financeiro",
    price: 59,
    icon: <FileText size={20} />,
    description: "Demonstrativo de Resultado do Exercício automático com receitas, custos, despesas e lucro líquido.",
    longDescription:
      "Gere o DRE completo do seu restaurante automaticamente. Receitas brutas, deduções, CMV, despesas operacionais fixas e variáveis, resultado operacional e lucro líquido calculados e apresentados em formato padrão contábil — sem precisar de planilha.",
    howToUse: [
      "Cadastre suas despesas fixas em 'Financeiro → Custos Operacionais'.",
      "Acesse 'Relatórios → DRE' e selecione o período.",
      "O sistema compila automaticamente receitas, CMV e despesas.",
      "Exporte o DRE em PDF ou CSV para o contador.",
    ],
    features: [
      { icon: <FileText size={16} />,  title: "DRE automático",        desc: "Compilado a partir dos dados reais do sistema." },
      { icon: <BarChart3 size={16} />, title: "Custos fixos/variáveis", desc: "Cadastre despesas e veja o impacto no resultado." },
      { icon: <Shield size={16} />,    title: "Padrão contábil",       desc: "Formato reconhecido por contadores e bancos." },
      { icon: <Zap size={16} />,       title: "Exportação PDF/CSV",    desc: "Pronto para enviar ao contador com um clique." },
    ],
    terms: `Ao ativar o módulo "DRE Gerencial", o contratante concorda com a cobrança adicional recorrente de R$ 59,00/mês adicionada ao plano atual. O cancelamento encerra o módulo no próximo ciclo.`,
  },

  // ── PIX Automático ────────────────────────────
  {
    slug: "pix-auto",
    name: "PIX Automático",
    category: "Financeiro",
    price: 29,
    icon: <Zap size={20} />,
    description: "Gere QR Code PIX automaticamente a cada pedido e confirme o pagamento sem intervenção manual.",
    longDescription:
      "Elimine a conferência manual de PIX. O sistema gera um QR Code único por pedido, detecta o pagamento automaticamente via API do banco e confirma o pedido — sem o atendente precisar checar o celular.",
    howToUse: [
      "Configure sua chave PIX em 'Configurações → Pagamentos'.",
      "Selecione PIX como forma de pagamento ao finalizar o pedido.",
      "Um QR Code único é gerado e exibido na tela.",
      "Após o pagamento, o sistema confirma automaticamente e avisa a cozinha.",
    ],
    features: [
      { icon: <Zap size={16} />,        title: "QR Code por pedido",   desc: "Cada pedido tem seu próprio QR Code único." },
      { icon: <CheckCircle2 size={16} />, title: "Confirmação auto",   desc: "Pagamento detectado sem conferência manual." },
      { icon: <Shield size={16} />,     title: "Anti-fraude",          desc: "Cada QR Code expira após o pagamento ou timeout." },
      { icon: <BarChart3 size={16} />,  title: "Conciliação",          desc: "Todos os PIX reconciliados no extrato financeiro." },
    ],
    terms: `Ao ativar o módulo "PIX Automático", o contratante concorda com a cobrança adicional recorrente de R$ 29,00/mês adicionada ao plano atual. O cancelamento encerra o módulo no próximo ciclo.`,
  },

  // ── Relatórios Avançados ──────────────────────
  {
    slug: "reports",
    name: "Relatórios Avançados",
    category: "Financeiro",
    price: 45,
    icon: <BarChart3 size={20} />,
    description: "Relatórios de lucratividade por produto, ranking de vendas, CMV por receita e análise de mesas.",
    longDescription:
      "Descubra quais produtos dão mais lucro (não só mais vendas), quais horários têm mais movimento, quais mesas ficam mais tempo ocupadas e como o CMV varia ao longo do tempo. Relatórios exportáveis em PDF e Excel.",
    howToUse: [
      "Acesse 'Relatórios' no menu lateral e escolha o tipo de relatório.",
      "Filtre por produto, categoria, período ou forma de pagamento.",
      "Analise margem bruta, ticket médio e ranking de produtos.",
      "Exporte em PDF ou Excel para análise externa.",
    ],
    features: [
      { icon: <BarChart3 size={16} />, title: "Margem por produto",    desc: "Saiba quais produtos realmente lucram mais." },
      { icon: <Zap size={16} />,       title: "Análise de horários",   desc: "Identifique picos e vales de movimento." },
      { icon: <FileText size={16} />,  title: "Exportação Excel",      desc: "Relatórios prontos para planilhas e BI externo." },
      { icon: <Star size={16} />,      title: "Ranking de produtos",   desc: "Top vendas, top lucro e top ticket por item." },
    ],
    terms: `Ao ativar o módulo "Relatórios Avançados", o contratante concorda com a cobrança adicional recorrente de R$ 45,00/mês adicionada ao plano atual. O cancelamento encerra o módulo no próximo ciclo.`,
  },

  // ══════════════════════════════════════════════
  // AUTOMAÇÃO
  // ══════════════════════════════════════════════

  // ── IA no Cardápio ────────────────────────────
  {
    slug: "ai-menu",
    name: "IA no Cardápio",
    category: "Automação",
    price: 39,
    icon: <Sparkles size={20} />,
    description: "Sugestões inteligentes de produtos baseadas no histórico do cliente e no perfil do pedido.",
    longDescription:
      "A IA analisa o histórico de pedidos do cliente, o horário, o clima e o perfil de consumo para sugerir produtos no cardápio digital. Aumente o ticket médio com upsell automático sem intervenção humana.",
    howToUse: [
      "Ative 'IA no Cardápio' em Configurações → Módulos.",
      "Defina quais produtos entram nas sugestões automáticas.",
      "No cardápio digital, a IA exibirá sugestões personalizadas para cada cliente.",
      "Acompanhe o impacto no ticket médio em Relatórios → IA.",
    ],
    features: [
      { icon: <Sparkles size={16} />,  title: "Sugestões personalizadas", desc: "Baseadas no histórico e preferências de cada cliente." },
      { icon: <Zap size={16} />,       title: "Upsell automático",       desc: "Aumento de ticket médio sem ação do operador." },
      { icon: <BarChart3 size={16} />, title: "A/B testing",             desc: "Compare sugestões e veja qual converte mais." },
      { icon: <Bot size={16} />,       title: "Atualização contínua",    desc: "A IA aprende com cada pedido e melhora as sugestões." },
    ],
    terms: `Ao ativar o módulo "IA no Cardápio", o contratante concorda com a cobrança adicional recorrente de R$ 39,00/mês adicionada ao plano atual. O cancelamento encerra o módulo no próximo ciclo.`,
  },

  // ── iFood Integrado ───────────────────────────
  {
    slug: "ifood",
    name: "iFood Integrado",
    category: "Automação",
    price: 89,
    highlighted: true,
    icon: (
      <img
        src="https://logo.clearbit.com/ifood.com.br"
        width="28" height="28"
        className="rounded-lg object-contain"
        alt="iFood"
        onError={(e) => { (e.target as HTMLImageElement).replaceWith(Object.assign(document.createElement('span'), { textContent: '🛵', style: 'font-size:20px' })); }}
      />
    ),
    description: "Sincronize seu cardápio, receba e gerencie pedidos do iFood direto no nosso PDV.",
    longDescription:
      "Pare de alternar entre aplicativos. Com o módulo iFood Integrado, todos os pedidos recebidos pelo iFood aparecem automaticamente no seu painel FoodSaaS em tempo real — prontos para serem aceitos, preparados e entregues sem que o operador precise digitar nada manualmente.",
    howToUse: [
      "Acesse 'Configurações → Integrações' e clique em 'Conectar iFood'.",
      "Insira suas credenciais de parceiro iFood (Client ID e Client Secret).",
      "Aguarde a sincronização inicial do cardápio (até 5 minutos).",
      "A partir de agora, novos pedidos iFood aparecem automaticamente na tela de Pedidos.",
      "Confirme, prepare e atualize o status — o cliente recebe notificações em tempo real.",
    ],
    features: [
      { icon: <Zap size={16} />,      title: "Pedidos em tempo real",       desc: "Novos pedidos chegam instantaneamente na cozinha." },
      { icon: <RefreshCw size={16} />, title: "Cardápio sincronizado",       desc: "Preços e disponibilidade atualizados automaticamente." },
      { icon: <BarChart3 size={16} />, title: "Relatórios unificados",       desc: "Faturamento iFood consolidado no BI do FoodSaaS." },
      { icon: <Shield size={16} />,    title: "Sem dupla digitação",         desc: "Elimine erros causados por pedidos digitados manualmente." },
    ],
    terms: `Ao ativar o módulo "iFood Integrado", o contratante concorda com a cobrança adicional recorrente de R$ 89,00/mês adicionada ao plano atual. A ativação do recurso é imediata e a cobrança será proporcional ou inclusa no próximo ciclo do Mercado Pago.\n\nCONDIÇÕES ESPECÍFICAS:\n• A integração requer credenciais de API liberadas pelo iFood para parceiros técnicos.\n• Comissões e taxas do iFood são cobradas diretamente pelo marketplace.\n• O cancelamento do módulo encerra a sincronização no próximo ciclo.`,
  },

  // ── 99 Food ───────────────────────────────────
  {
    slug: "99food",
    name: "99 Food",
    category: "Automação",
    price: 15,
    icon: (
      <img
        src="https://logo.clearbit.com/99app.com"
        width="28" height="28"
        className="rounded-lg object-contain"
        alt="99Food"
        onError={(e) => { (e.target as HTMLImageElement).replaceWith(Object.assign(document.createElement('span'), { textContent: '🛵', style: 'font-size:20px' })); }}
      />
    ),
    description: "Integração direta com a plataforma 99 Food para recebimento automático de pedidos.",
    longDescription:
      "Expanda seus canais de venda sem aumentar a equipe. Com a integração 99 Food, pedidos feitos pelos clientes na plataforma chegam direto no FoodSaaS — sem intermediários humanos.",
    howToUse: [
      "Acesse 'Configurações → Integrações' e selecione '99 Food'.",
      "Insira o token de API fornecido pela 99 Food no seu painel de parceiro.",
      "Confirme a sincronização do cardápio.",
      "Pedidos recebidos aparecem automaticamente na fila de Pedidos.",
    ],
    features: [
      { icon: <Zap size={16} />,       title: "Integração automática",   desc: "Pedidos chegam sem nenhuma ação do operador." },
      { icon: <Settings size={16} />,  title: "Gestão centralizada",     desc: "Um único painel para todos os seus marketplaces." },
      { icon: <Shield size={16} />,    title: "Zero retrabalho",         desc: "Elimine anotações em papel e digitação manual." },
      { icon: <BarChart3 size={16} />, title: "Faturamento consolidado", desc: "Receitas da 99 Food no relatório financeiro unificado." },
    ],
    terms: `Ao ativar o módulo "99 Food", o contratante concorda com a cobrança adicional recorrente de R$ 15,00/mês adicionada ao plano atual. O cancelamento do módulo encerra a sincronização no próximo ciclo.`,
  },

  // ── Automação de Marketing ────────────────────
  {
    slug: "marketing-automation",
    name: "Automação de Marketing",
    category: "Automação",
    price: 69,
    icon: <MessageCircle size={20} />,
    description: "Régua de e-mail e WhatsApp automatizada: boas-vindas, aniversário, reativação e pesquisa de satisfação.",
    longDescription:
      "Configure fluxos automáticos de comunicação: mensagem de boas-vindas ao novo cliente, cupom de aniversário, pesquisa de satisfação pós-pedido e campanhas sazonais. Tudo enviado automaticamente no momento certo.",
    howToUse: [
      "Acesse 'Marketing → Automação' e escolha um fluxo (ex: Boas-vindas).",
      "Configure o gatilho (ex: primeiro pedido) e o canal (WhatsApp ou e-mail).",
      "Personalize a mensagem com o nome do cliente e um cupom.",
      "Ative o fluxo — ele roda automaticamente a partir daí.",
    ],
    features: [
      { icon: <Zap size={16} />,        title: "Fluxos automáticos",     desc: "Mensagens disparadas no momento exato." },
      { icon: <MessageCircle size={16} />, title: "WhatsApp + e-mail",   desc: "Multi-canal em um único painel." },
      { icon: <Gift size={16} />,       title: "Cupons no fluxo",        desc: "Insira cupons de desconto nas mensagens automáticas." },
      { icon: <BarChart3 size={16} />,  title: "Métricas de engajamento", desc: "Taxa de abertura, cliques e conversão por fluxo." },
    ],
    terms: `Ao ativar o módulo "Automação de Marketing", o contratante concorda com a cobrança adicional recorrente de R$ 69,00/mês adicionada ao plano atual. O cancelamento encerra o módulo no próximo ciclo.`,
  },

  // ── Webhooks & API ────────────────────────────
  {
    slug: "webhooks",
    name: "Webhooks & API",
    category: "Automação",
    price: 45,
    icon: <Wifi size={20} />,
    description: "Acesso à API REST do FoodSaaS e webhooks para integrar com ERP, CRM ou qualquer sistema externo.",
    longDescription:
      "Conecte o FoodSaaS ao seu ecossistema de ferramentas. Receba notificações em tempo real via webhook quando um pedido é criado ou tem o status alterado. Use a API REST para consultar pedidos, produtos, estoque e clientes de sistemas externos.",
    howToUse: [
      "Acesse 'Configurações → Webhooks' e clique em 'Novo Webhook'.",
      "Informe a URL do seu sistema que vai receber as notificações.",
      "Escolha os eventos que deseja receber (pedido criado, pago, entregue, etc.).",
      "Teste o webhook com o botão 'Enviar teste' antes de ativar.",
    ],
    features: [
      { icon: <Wifi size={16} />,       title: "Webhooks em tempo real",  desc: "Notificações instantâneas ao seu sistema externo." },
      { icon: <Shield size={16} />,     title: "API REST documentada",    desc: "Endpoints para pedidos, produtos, clientes e estoque." },
      { icon: <Zap size={16} />,        title: "Assinatura HMAC",        desc: "Segurança via assinatura criptográfica em cada evento." },
      { icon: <BarChart3 size={16} />,  title: "Log de eventos",         desc: "Histórico de todos os webhooks enviados e falhas." },
    ],
    terms: `Ao ativar o módulo "Webhooks & API", o contratante concorda com a cobrança adicional recorrente de R$ 45,00/mês adicionada ao plano atual. O cancelamento encerra o módulo no próximo ciclo.`,
  },

  // ── Rastreamento de Entregadores ──────────────
  {
    slug: "tracking",
    name: "Rastreamento de Entregadores",
    category: "Automação",
    price: 29,
    icon: <Map size={20} />,
    description: "Acompanhe seus motoboys em tempo real no mapa e envie atualizações automáticas de rota para o cliente.",
    longDescription:
      "Dê transparência total para o processo de entrega. O entregador usa o app PWA FoodSaaS no celular — sem precisar instalar nada. Sua posição GPS é transmitida ao painel administrativo em tempo real. O cliente recebe um link de rastreamento e acompanha a entrega no mapa.",
    howToUse: [
      "Cadastre o entregador em 'Entregadores' e informe o celular dele.",
      "O entregador acessa /driver no navegador do celular (PWA, sem instalação).",
      "Ao aceitar um pedido, o GPS é ativado automaticamente.",
      "No painel 'Rastreamento', você vê todos os entregadores em rota no mapa.",
    ],
    features: [
      { icon: <Map size={16} />,         title: "Mapa ao vivo",              desc: "Posição GPS atualizada a cada 5 segundos no painel." },
      { icon: <Headphones size={16} />,  title: "Link para o cliente",       desc: "Página pública de rastreamento sem precisar de app." },
      { icon: <Play size={16} />,        title: "PWA sem instalação",        desc: "Entregador acessa pelo navegador do celular." },
      { icon: <BarChart3 size={16} />,   title: "Painel de entregas",        desc: "Histórico de rotas e tempo médio por entregador." },
    ],
    terms: `Ao ativar "Rastreamento de Entregadores", o contratante concorda com cobrança adicional recorrente de R$ 29,00/mês. O cancelamento encerra o módulo no próximo ciclo.`,
  },
];


// ─────────────────────────────────────────────
// Constantes visuais
// ─────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Operação":   { bg: "bg-orange-100", text: "text-orange-700" },
  "Financeiro": { bg: "bg-emerald-100", text: "text-emerald-700" },
  "Automação":  { bg: "bg-blue-100", text: "text-blue-700" },
  "Marketing":  { bg: "bg-purple-100", text: "text-purple-700" },
};

const CATEGORIES = ["Todos", "Operação", "Financeiro", "Automação", "Marketing"] as const;

const PLAN_COLORS: Record<string, { gradient: string; label: string }> = {
  BASIC:      { gradient: "from-green-500 to-teal-500",    label: "Basic" },
  PRO:        { gradient: "from-blue-500 to-indigo-600",   label: "Pro" },
  ENTERPRISE: { gradient: "from-purple-500 to-violet-600", label: "Enterprise" },
};

const PLAN_PRICES: Record<string, number> = { BASIC: 97, PRO: 197, ENTERPRISE: 397 };

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function fmt(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

// ─────────────────────────────────────────────
// Modal de Contrato
// ─────────────────────────────────────────────

function ContractModal({
  mod, onClose, onConfirm, loading,
}: {
  mod: ModuleDef;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-gray-100">
          <div className="w-11 h-11 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
            {mod.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-0.5">Confirmar contratação</p>
            <h2 className="text-base font-bold text-gray-900 leading-tight">{mod.name}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Alerta de cobrança */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              <strong>{fmt(mod.price)}/mês</strong> será adicionado à sua fatura no próximo ciclo do Mercado Pago.
            </p>
          </div>
        </div>

        {/* Termos com scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Termos e contrato de uso</p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap font-mono">
            {mod.terms}
          </div>
        </div>

        {/* Checkbox + botões */}
        <div className="px-6 pb-6 pt-4 border-t border-gray-100 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-orange-500 cursor-pointer shrink-0"
            />
            <span className="text-xs text-gray-600 leading-relaxed group-hover:text-gray-800 transition-colors">
              Declaro que li e aceito as condições e termos do contrato para ativação deste módulo.
            </span>
          </label>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={!accepted || loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading
                ? <><Loader2 size={14} className="animate-spin" /> Ativando...</>
                : <><CheckCircle2 size={14} /> Confirmar Ativação</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Modal de Detalhes do Módulo
// ─────────────────────────────────────────────

function DetailModal({
  mod,
  status,
  onClose,
  onContract,
  onDeactivate,
  actionLoading,
}: {
  mod: ModuleDef;
  status: ModStatus;
  onClose: () => void;
  onContract: () => void;
  onDeactivate: () => void;
  actionLoading: boolean;
}) {
  const cat  = CATEGORY_COLORS[mod.category] ?? { bg: "bg-gray-100", text: "text-gray-600" };
  const isOn = status === "ACTIVE" || status === "TRIAL";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">

        {/* Header com gradiente */}
        <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
          >
            <X size={18} />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-white shrink-0">
              {mod.icon}
            </div>
            <div className="flex-1 min-w-0 pr-8">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${cat.bg} ${cat.text}`}>
                  {mod.category}
                </span>
                {isOn && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ✓ Módulo Ativo
                  </span>
                )}
                {mod.highlighted && !isOn && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                    ✦ Recomendado
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black leading-tight">{mod.name}</h2>
              <p className="text-white/70 text-sm mt-1 leading-relaxed">{mod.description}</p>
            </div>
          </div>

          {/* Preço */}
          <div className="mt-5 flex items-end gap-3">
            <div>
              <p className="text-white/50 text-[10px] uppercase font-semibold tracking-wide">Valor mensal</p>
              {mod.isFree ? (
                <p className="text-3xl font-black text-emerald-300">Grátis <span className="text-base font-normal text-white/50">— incluso no plano</span></p>
              ) : (
                <p className="text-3xl font-black">{fmt(mod.price)}<span className="text-base font-normal text-white/50">/mês</span></p>
              )}
            </div>
          </div>
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto">
          {/* Sobre o módulo */}
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-2">O que é este módulo?</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{mod.longDescription}</p>
          </div>

          {/* Funcionalidades */}
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Funcionalidades incluídas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mod.features.map((f, i) => (
                <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">{f.title}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Como usar */}
          <div className="p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Como ativar e usar</h3>
            <ol className="space-y-3">
              {mod.howToUse.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-gray-600 leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Rodapé com ações */}
        <div className="p-5 border-t border-gray-100 bg-gray-50">
          {status === "INACTIVE" && (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-100 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={onContract}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors"
              >
                <Zap size={15} />Contratar — {fmt(mod.price)}/mês
              </button>
            </div>
          )}
          {status === "TRIAL" && (
            <div className="flex gap-3">
              <button
                onClick={() => { onDeactivate(); onClose(); }}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancelar trial
              </button>
              <button
                onClick={onContract}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors"
              >
                <CheckCircle2 size={15} />Contratar agora
              </button>
            </div>
          )}
          {status === "ACTIVE" && (
            <div className="flex gap-3">
              <button
                onClick={() => { onDeactivate(); onClose(); }}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {actionLoading ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
                Desativar módulo
              </button>
              <button
                onClick={onClose}
                className="flex-[2] py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                Fechar — módulo ativo ✓
              </button>
            </div>
          )}
          {status === "EXPIRED" && (
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-100 transition-colors">
                Fechar
              </button>
              <button
                onClick={onContract}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors"
              >
                <RefreshCw size={15} />Reativar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Card de módulo (abre DetailModal ao clicar)
// ─────────────────────────────────────────────

function ModuleCard({
  def, status, trialEndsAt, companyId, onRefresh,
}: {
  def: ModuleDef;
  status: ModStatus;
  trialEndsAt?: string | null;
  companyId: string;
  onRefresh: () => void;
}) {
  const [showDetail,   setShowDetail]   = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [loading,      setLoading]      = useState(false);

  const isOn = status === "ACTIVE" || status === "TRIAL";
  const cat  = CATEGORY_COLORS[def.category] ?? { bg: "bg-gray-100", text: "text-gray-600" };

  async function activate() {
    setLoading(true);
    try {
      await api.post("/company-module/activate", { companyId, moduleSlug: def.slug });
      toast.success(`${def.name} ativado com sucesso!`);
      setShowContract(false);
      setShowDetail(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Erro ao ativar módulo");
    } finally {
      setLoading(false);
    }
  }

  async function deactivate() {
    setLoading(true);
    try {
      await api.delete(`/company-module/${companyId}/${def.slug}`);
      toast.success(`${def.name} desativado.`);
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Erro ao desativar módulo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Card clicável */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setShowDetail(true)}
        onKeyDown={(e) => e.key === "Enter" && setShowDetail(true)}
        className={`relative rounded-xl border transition-all bg-white cursor-pointer group ${
          isOn
            ? "border-orange-200 shadow-sm hover:shadow-md hover:border-orange-300"
            : "border-gray-200 hover:border-orange-300 hover:shadow-md"
        }`}
      >
        {def.highlighted && !isOn && (
          <span className="absolute -top-2.5 left-4 text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white">
            ✦ Recomendado
          </span>
        )}

        <div className="p-5">
          {/* Ícone + nome */}
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isOn ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500 group-hover:bg-orange-50 group-hover:text-orange-500"
            } transition-colors`}>
              {def.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-gray-900 leading-tight">{def.name}</p>
                {status === "ACTIVE"  && <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-200 bg-emerald-100 text-emerald-700 shrink-0"><CheckCircle2 size={9} />Ativo</span>}
                {status === "TRIAL"   && <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-200 bg-amber-100 text-amber-700 shrink-0"><Clock size={9} />Trial</span>}
                {status === "EXPIRED" && <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-red-200 bg-red-100 text-red-700 shrink-0"><XCircle size={9} />Expirado</span>}
              </div>
              <span className={`inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1 ${cat.bg} ${cat.text}`}>
                {def.category}
              </span>
            </div>
          </div>

          {/* Descrição */}
          <p className="text-[11px] text-gray-500 leading-relaxed mb-4 min-h-[40px] line-clamp-3">
            {def.description}
          </p>

          {/* Preço + Toggle + CTA */}
          <div className="flex items-center justify-between gap-2">
            <div>
              {def.isFree ? (
                <span className="text-sm font-black text-emerald-600">Grátis</span>
              ) : (
                <>
                  <span className="text-lg font-black text-gray-900">{fmt(def.price)}</span>
                  <span className="text-xs text-gray-400 font-medium">/mês</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Toggle rápido */}
              <button
                type="button"
                title={isOn ? "Desativar módulo" : def.isFree ? "Ativar módulo" : "Contratar módulo"}
                disabled={loading}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isOn) { deactivate(); }
                  else if (def.isFree) { activate(); }
                  else { setShowContract(true); }
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                  isOn ? "bg-emerald-500 border-emerald-500" : "bg-gray-200 border-gray-200"
                }`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
                  isOn ? "translate-x-4" : "translate-x-0"
                }`} />
              </button>
              <div className="flex items-center gap-1 text-xs font-semibold text-orange-500 group-hover:gap-2 transition-all">
                Ver <ChevronRight size={13} />
              </div>
            </div>
          </div>

          {trialEndsAt && status === "TRIAL" && (
            <p className="mt-2 text-[10px] text-center text-amber-600">Trial até {fmtDate(trialEndsAt)}</p>
          )}
        </div>
      </div>

      {/* Modal de detalhes */}
      {showDetail && (
        <DetailModal
          mod={def}
          status={status}
          actionLoading={loading}
          onClose={() => setShowDetail(false)}
          onContract={() => { setShowDetail(false); setShowContract(true); }}
          onDeactivate={deactivate}
        />
      )}

      {/* Modal de contrato */}
      {showContract && (
        <ContractModal
          mod={def}
          loading={loading}
          onClose={() => setShowContract(false)}
          onConfirm={activate}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// Card de Analytics (design da screenshot)
// ─────────────────────────────────────────────

function AnalyticsCard({
  tool,
  isActive,
}: {
  tool: AnalyticsTool;
  isActive: boolean;
}) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <>
      <div
        className={`rounded-xl border bg-white transition-all cursor-pointer group hover:shadow-md ${
          isActive ? "border-blue-200 shadow-sm" : "border-gray-200 hover:border-blue-200"
        }`}
        role="button"
        tabIndex={0}
        onClick={() => setShowDetail(true)}
        onKeyDown={(e) => e.key === "Enter" && setShowDetail(true)}
      >
        <div className="p-4">
          <div className="flex items-start gap-3 mb-3">
            {/* Ícone de marca */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${tool.iconBg}`}>
              {tool.icon}
            </div>
            {/* Link externo no canto */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 leading-tight">{tool.name}</p>
              <p className="text-[11px] text-blue-600 font-medium mt-0.5">{tool.subtitle}</p>
            </div>
            <div className="text-gray-300 group-hover:text-gray-400 transition-colors">
              <ChevronRight size={16} />
            </div>
          </div>

          {/* Botão + status — igual à screenshot */}
          <div className="flex items-center justify-between mt-1">
            <Link
              href={tool.configPath}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors"
            >
              <Settings size={12} />Configurar
            </Link>
            {isActive ? (
              <span className="text-xs font-semibold text-emerald-600">Ativa</span>
            ) : (
              <span className="text-xs text-gray-400">Não configurado</span>
            )}
          </div>
        </div>
      </div>

      {/* Modal de detalhes simples */}
      {showDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDetail(false); }}
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-white">
              <button
                onClick={() => setShowDetail(false)}
                className="absolute right-4 top-4 text-white/60 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${tool.iconBg}`}>
                  {tool.icon}
                </div>
                <div>
                  <p className="text-xs text-white/60 font-semibold uppercase tracking-wide mb-0.5">Analytics e Marketing</p>
                  <h2 className="text-xl font-black">{tool.name}</h2>
                  <p className="text-sm text-white/60 mt-0.5">{tool.subtitle}</p>
                </div>
              </div>
              <div className="mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                <span className="text-[10px] font-bold text-emerald-300">✓ Integração gratuita — inclusa em todos os planos</span>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">O que faz</p>
                <p className="text-sm text-gray-600 leading-relaxed">{tool.description}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Como obter o ID</p>
                <p className="text-sm text-gray-600 leading-relaxed">{tool.howToGet}</p>
              </div>
              <div className={`flex items-center gap-2 p-3 rounded-xl ${isActive ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
                {isActive
                  ? <><CheckCircle2 size={15} className="text-emerald-600 shrink-0"/><p className="text-xs text-emerald-700 font-semibold">Integração configurada e ativa</p></>
                  : <><AlertTriangle size={15} className="text-amber-500 shrink-0"/><p className="text-xs text-amber-700">Cole o ID em <strong>Aparência → Analytics</strong> para ativar.</p></>
                }
              </div>
            </div>

            <div className="px-6 pb-6">
              <Link
                href={tool.configPath}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors"
              >
                <Settings size={15} />Abrir Configurações
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// Card de plano atual
// ─────────────────────────────────────────────

function PlanCard({
  plan, status, dueDate, onUpgrade,
}: {
  plan: string; status: string; dueDate: string | null; onUpgrade: () => void;
}) {
  const pc = PLAN_COLORS[plan] ?? PLAN_COLORS.BASIC;
  const price = PLAN_PRICES[plan];

  const STATUS_LABEL: Record<string, string> = {
    ACTIVE: "Ativa", TRIAL: "Trial", PENDING_PAYMENT: "Pendente", CANCELLED: "Cancelada",
  };

  return (
    <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${pc.gradient} shadow-lg`}>
      <div className="p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Star size={15} className="fill-white/70 text-white/70" />
              <span className="text-xs font-semibold tracking-wide uppercase opacity-75">Plano atual</span>
            </div>
            <h3 className="text-3xl font-black tracking-tight">{pc.label}</h3>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/20 text-white">
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <p className="text-white/60 text-[10px] uppercase font-semibold tracking-wide">Valor mensal</p>
            <p className="text-2xl font-bold mt-0.5">{price ? fmt(price) : "—"}</p>
          </div>
          <div>
            <p className="text-white/60 text-[10px] uppercase font-semibold tracking-wide">Próxima renovação</p>
            <p className="text-sm font-semibold mt-1">{fmtDate(dueDate)}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {plan !== "ENTERPRISE" && (
            <button
              onClick={onUpgrade}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-gray-900 text-xs font-bold hover:bg-white/90 transition-colors"
            >
              <ArrowUpCircle size={13} />Fazer Upgrade
            </button>
          )}
          <a
            href="https://wa.me/5541988729370?text=Olá, preciso de suporte com meu plano FoodSaaS"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20 text-white text-xs font-semibold hover:bg-white/30 transition-colors border border-white/30"
          >
            <MessageCircle size={13} />Suporte
          </a>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Modal de upgrade de plano
// ─────────────────────────────────────────────

function UpgradeModal({ currentPlan, onClose }: { currentPlan: string; onClose: () => void }) {
  const PLANS = [
    { key: "PRO",        label: "Pro",        price: 197, gradient: "from-blue-500 to-indigo-600",   tagline: "Para quem quer escalar" },
    { key: "ENTERPRISE", label: "Enterprise", price: 397, gradient: "from-purple-500 to-violet-600", tagline: "Para múltiplas unidades" },
  ].filter((p) => p.key !== currentPlan);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-orange-500" />
              <h3 className="text-base font-bold text-gray-900">Fazer Upgrade</h3>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Você está no plano <strong>{currentPlan}</strong>. Escolha o próximo nível.
          </p>
          <div className="space-y-3">
            {PLANS.map((p) => (
              <div key={p.key} className={`rounded-xl p-4 bg-gradient-to-r ${p.gradient} text-white`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold">{p.label}</span>
                  <span className="text-sm font-bold">{fmt(p.price)}/mês</span>
                </div>
                <p className="text-white/70 text-[11px] mb-3">{p.tagline}</p>
                <a
                  href={`https://wa.me/5541988729370?text=Quero fazer upgrade para o plano ${p.label} FoodSaaS`}
                  target="_blank" rel="noopener noreferrer"
                  className="block text-center py-1.5 rounded-lg bg-white text-gray-900 text-[11px] font-bold hover:bg-white/90 transition-colors"
                  onClick={onClose}
                >
                  Solicitar upgrade →
                </a>
              </div>
            ))}
          </div>
          <button onClick={onClose} className="mt-4 w-full py-2 rounded-xl border border-gray-200 text-gray-400 text-xs hover:bg-gray-50 transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

export default function PlanoTab() {
  const { user } = useAuthStore();
  const companyId = (user as any)?.companyId ?? "";

  const [plan,          setPlan]          = useState("BASIC");
  const [subStatus,     setSubStatus]     = useState("ACTIVE");
  const [dueDate,       setDueDate]       = useState<string | null>(null);
  const [modStatuses,   setModStatuses]   = useState<Record<string, { status: ModStatus; trialEndsAt?: string | null }>>({});
  const [companyFields, setCompanyFields] = useState<Record<string, string | null>>({});
  const [loading,       setLoading]       = useState(true);
  const [category,      setCategory]      = useState<typeof CATEGORIES[number]>("Todos");
  const [showUpgrade,   setShowUpgrade]   = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [subRes, compRes] = await Promise.all([
        api.get(`/company/${companyId}/subscription`).catch(() => ({ data: {} })),
        api.get(`/company/${companyId}`).catch(() => ({ data: {} })),
      ]);

      const sub = subRes.data ?? {};
      setPlan(sub.plan ?? "BASIC");
      setSubStatus(sub.subscriptionStatus ?? "ACTIVE");
      setDueDate(sub.dueDate ?? null);

      const backendMods: BackendMod[] = compRes.data?.modules ?? [];
      const statusMap: Record<string, { status: ModStatus; trialEndsAt?: string | null }> = {};
      for (const m of backendMods) {
        const slug = (m.moduleSlug ?? m.slug ?? m.module ?? "").toLowerCase();
        if (!slug) continue;
        statusMap[slug] = {
          status: m.status ?? (m.active ? "ACTIVE" : "INACTIVE"),
          trialEndsAt: m.trialEndsAt ?? null,
        };
      }
      setModStatuses(statusMap);

      // Campos de analytics da empresa (metaPixelId, googleAnalyticsId, etc.)
      const cd = compRes.data ?? {};
      setCompanyFields({
        metaPixelId:        cd.metaPixelId        ?? null,
        googleAnalyticsId:  cd.googleAnalyticsId  ?? null,
        googleTagManagerId: cd.googleTagManagerId  ?? null,
      });
    } catch {
      toast.error("Erro ao carregar dados do plano");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const filtered = MODULES.filter((m) => category === "Todos" || m.category === category);

  const activeCount = MODULES.filter((m) => {
    const s = modStatuses[m.slug]?.status;
    return s === "ACTIVE" || s === "TRIAL";
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin text-orange-500" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PlanCard plan={plan} status={subStatus} dueDate={dueDate} onUpgrade={() => setShowUpgrade(true)} />

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Módulos do ecossistema</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {activeCount} {activeCount === 1 ? "módulo ativo" : "módulos ativos"} · clique em um card para ver detalhes e contratar
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                category === cat ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((mod) => {
            const st = modStatuses[mod.slug] ?? { status: "INACTIVE" as ModStatus };
            return (
              <ModuleCard
                key={mod.slug}
                def={mod}
                status={st.status}
                trialEndsAt={st.trialEndsAt}
                companyId={companyId}
                onRefresh={load}
              />
            );
          })}
        </div>
      </section>

      {/* Seção Analytics e Marketing */}
      <section>
        <div className="mb-4">
          <h2 className="text-sm font-bold text-gray-900">Analytics e Marketing</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Integrações gratuitas — incluso em todos os planos. Cole seu ID em Aparência para ativar.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ANALYTICS_TOOLS.map((tool) => (
            <AnalyticsCard
              key={tool.slug}
              tool={tool}
              isActive={!!companyFields[tool.fieldKey]}
            />
          ))}
        </div>
      </section>

      {showUpgrade && <UpgradeModal currentPlan={plan} onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
