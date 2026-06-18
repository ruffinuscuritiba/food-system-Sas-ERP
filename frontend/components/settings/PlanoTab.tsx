"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Star, Loader2, CheckCircle2, Clock, XCircle, Zap,
  ArrowUpCircle, MessageCircle, Package, RefreshCw, Sparkles,
  Monitor, Bike, Receipt, ChefHat, Building2,
  BarChart3, TrendingUp, Ticket, DollarSign, FileText,
  ClipboardList, Bot, ShoppingBag, Car, Rocket, Link2, BarChart2,
  UtensilsCrossed, QrCode, Tv2, Truck, Wifi,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type ModuleStatus   = "ACTIVE" | "TRIAL" | "INACTIVE" | "EXPIRED";
type ModuleCategory = "OPERACAO" | "MARKETING" | "FINANCEIRO" | "AUTOMACAO";

interface ModuleItem {
  id?: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: ModuleCategory;
  price: number | null;
  isFree: boolean;
  badge: string | null;
  badgeColor: string | null;
  benefits: string[];
  isHighlighted: boolean;
  status: ModuleStatus;
  trialEndsAt: string | null;
  activatedAt: string | null;
  companyModuleId: string | null;
}

interface SubscriptionData {
  plan: string;
  subscriptionStatus: string;
  dueDate: string | null;
  modules: ModuleItem[];
  planPrices: Record<string, { price: number; label: string; tagline: string }>;
}

// ── Catálogo local de módulos ─────────────────────────────────────────────────
// Enriquece o dado do backend com nome, preço, descrição e termos reais.

interface CatalogEntry {
  name: string;
  shortDesc: string;
  longDesc: string;
  price: number | null;       // null = gratuito / incluso
  isFree: boolean;
  icon: React.ReactNode;
  category: ModuleCategory;
  terms: string;
  highlighted?: boolean;
}

const MODULE_CATALOG: Record<string, CatalogEntry> = {
  // ── Operação (incluídos / básicos) ────────────────────────────────────────
  tables: {
    name: "Controle de Mesas",
    shortDesc: "Gerencie mesas, comandas e status em tempo real.",
    longDesc:  "Abre e fecha mesas, registra itens por mesa, visualiza status (livre / ocupada / reservada) e envia para cozinha com um toque.",
    price: null, isFree: true, icon: <UtensilsCrossed size={20} />,
    category: "OPERACAO",
    terms: "Este módulo está incluso no seu plano e não gera cobrança adicional. O uso é ilimitado e a ativação é imediata.",
  },
  cash: {
    name: "Controle de Caixa",
    shortDesc: "Abra, feche e audite o caixa diário com precisão.",
    longDesc:  "Registra sangrias, suprimentos e fechamento de caixa. Histórico completo por turno com impressão de relatório.",
    price: null, isFree: true, icon: <Receipt size={20} />,
    category: "FINANCEIRO",
    terms: "Este módulo está incluso no seu plano e não gera cobrança adicional.",
  },
  financial: {
    name: "Financeiro Básico",
    shortDesc: "Controle receitas, despesas e fluxo de caixa.",
    longDesc:  "Lançamentos de entrada e saída, categorias financeiras, extrato por período e exportação CSV para contabilidade.",
    price: null, isFree: true, icon: <DollarSign size={20} />,
    category: "FINANCEIRO",
    terms: "Este módulo está incluso no seu plano e não gera cobrança adicional.",
  },
  stock: {
    name: "Controle de Estoque",
    shortDesc: "Entradas, saídas e alertas de estoque mínimo.",
    longDesc:  "Movimentações de ingredientes com histórico completo. Alertas automáticos de estoque baixo. Inventário com ajuste de saldo.",
    price: null, isFree: true, icon: <Package size={20} />,
    category: "OPERACAO",
    terms: "Este módulo está incluso no seu plano e não gera cobrança adicional.",
  },
  recipes: {
    name: "Fichas Técnicas",
    shortDesc: "Cadastre receitas e calcule CMV automaticamente.",
    longDesc:  "Vincule ingredientes às receitas dos produtos. O sistema calcula o CMV (Custo de Mercadoria Vendida) por item e desconta o estoque ao confirmar pedidos.",
    price: null, isFree: true, icon: <ClipboardList size={20} />,
    category: "OPERACAO",
    terms: "Este módulo está incluso no seu plano e não gera cobrança adicional.",
  },
  delivery: {
    name: "Delivery & Entregadores",
    shortDesc: "Rastreamento de entregadores e zonas de entrega.",
    longDesc:  "Gestão completa de entregadores próprios: app PWA para o motoboy, rastreamento GPS em tempo real, zonas de entrega por bairro com taxa automática e painel de repasses.",
    price: 49.90, isFree: false, icon: <Bike size={20} />,
    category: "OPERACAO", highlighted: true,
    terms: `AO ATIVAR O MÓDULO "DELIVERY & ENTREGADORES", VOCÊ CONCORDA COM OS SEGUINTES TERMOS:

1. COBRANÇA
   O valor de R$ 49,90/mês será acrescentado à sua fatura mensal a partir da data de ativação, sendo cobrado no próximo ciclo de renovação.

2. FUNCIONALIDADES INCLUSAS
   Estão inclusos: app PWA para entregadores, rastreamento GPS, cadastro ilimitado de entregadores, zonas de entrega por bairro ou raio, cálculo automático de taxa para o cliente e painel de repasses ao entregador.

3. CANCELAMENTO
   O módulo pode ser desativado a qualquer momento pelo painel. O cancelamento é válido para o próximo ciclo — não há reembolso proporcional do período em curso.

4. RESPONSABILIDADE
   A FoodSaaS não é responsável por disputas entre o estabelecimento e os entregadores. O rastreamento GPS depende do entregador ter o app aberto com GPS ativo.

5. ACEITAÇÃO
   Ao clicar em "Confirmar Ativação", você declara ter lido e aceito integralmente estes termos.`,
  },

  // ── Módulos extras pagos ──────────────────────────────────────────────────
  "whatsapp-ia": {
    name: "WhatsApp IA — Kely",
    shortDesc: "Atendimento automático por WhatsApp com IA.",
    longDesc:  "Robô de atendimento com inteligência artificial que recebe pedidos, responde dúvidas, envia status e finaliza vendas automaticamente pelo WhatsApp — 24 horas por dia, 7 dias por semana.",
    price: 79.90, isFree: false, icon: <Bot size={20} />,
    category: "AUTOMACAO", highlighted: true,
    terms: `AO ATIVAR O MÓDULO "WHATSAPP IA — KELY", VOCÊ CONCORDA COM OS SEGUINTES TERMOS:

1. COBRANÇA
   O valor de R$ 79,90/mês será acrescentado à sua fatura mensal a partir da data de ativação.

2. FUNCIONAMENTO
   A IA opera com base nos produtos, preços e configurações cadastrados no sistema. Alterações no cardápio levam até 5 minutos para refletir no atendimento da IA.

3. NÚMERO WHATSAPP
   Você precisa de um número WhatsApp Business próprio. A FoodSaaS não fornece o número — apenas integra via Evolution API ou Meta Cloud API.

4. LIMITAÇÕES
   A IA não substitui atendimento humano em situações complexas como reclamações, devoluções ou pagamentos com problema. Nesses casos, o sistema transfere automaticamente para um atendente.

5. CUSTO DE API
   O custo de uso da API WhatsApp (Meta Cloud API) é cobrado diretamente pela Meta ao titular da conta. A FoodSaaS não tem controle sobre essa cobrança.

6. CANCELAMENTO
   O módulo pode ser desativado a qualquer momento. O cancelamento é válido para o próximo ciclo.

7. ACEITAÇÃO
   Ao clicar em "Confirmar Ativação", você declara ter lido e aceito integralmente estes termos.`,
  },

  integrations: {
    name: "Integrações — iFood & Marketplaces",
    shortDesc: "Receba pedidos do iFood direto no painel.",
    longDesc:  "Integração com iFood e outros marketplaces (Rappi em breve). Pedidos chegam automaticamente no painel e na cozinha, sem necessidade de digitar manualmente.",
    price: 99.90, isFree: false, icon: <Link2 size={20} />,
    category: "AUTOMACAO", highlighted: true,
    terms: `AO ATIVAR O MÓDULO "INTEGRAÇÕES — IFOOD & MARKETPLACES", VOCÊ CONCORDA COM OS SEGUINTES TERMOS:

1. COBRANÇA
   O valor de R$ 99,90/mês será acrescentado à sua fatura mensal.

2. PRÉ-REQUISITO
   Você precisa de conta ativa no iFood com credenciais de API liberadas pelo iFood para parceiros técnicos. A FoodSaaS não garante aprovação pelo iFood.

3. RESPONSABILIDADE
   As comissões e taxas do iFood são cobradas diretamente pelo marketplace e não estão incluídas neste módulo.

4. SINCRONIZAÇÃO
   Cardápio, preços e disponibilidade são sincronizados periodicamente. Alterações urgentes devem ser feitas também diretamente no app do iFood.

5. CANCELAMENTO
   O módulo pode ser desativado a qualquer momento. Cancelamento válido para o próximo ciclo.

6. ACEITAÇÃO
   Ao clicar em "Confirmar Ativação", você declara ter lido e aceito integralmente estes termos.`,
  },

  bi: {
    name: "Business Intelligence — BI",
    shortDesc: "Relatórios avançados e dashboards de desempenho.",
    longDesc:  "Análise de faturamento por período, CMV, margem bruta, ticket médio, ranking de produtos, comparativos diários/semanais/mensais e exportação de relatórios em PDF e Excel.",
    price: 39.90, isFree: false, icon: <BarChart2 size={20} />,
    category: "FINANCEIRO",
    terms: `AO ATIVAR O MÓDULO "BUSINESS INTELLIGENCE — BI", VOCÊ CONCORDA COM OS SEGUINTES TERMOS:

1. COBRANÇA
   O valor de R$ 39,90/mês será acrescentado à sua fatura mensal.

2. DADOS
   Os relatórios são gerados com base nos dados inseridos no sistema. A precisão depende da correta alimentação de pedidos, custos e movimentações financeiras.

3. EXPORTAÇÃO
   Os relatórios exportados em PDF/Excel são de responsabilidade do usuário. A FoodSaaS não se responsabiliza pelo uso dessas informações por terceiros.

4. CANCELAMENTO
   O módulo pode ser desativado a qualquer momento. Cancelamento válido para o próximo ciclo.

5. ACEITAÇÃO
   Ao clicar em "Confirmar Ativação", você declara ter lido e aceito integralmente estes termos.`,
  },

  loyalty: {
    name: "Fidelidade & Cashback",
    shortDesc: "Programa de pontos e cashback para clientes.",
    longDesc:  "Acumule pontos por compra, resgate como desconto ou cashback. Crie cupons exclusivos, configure regras de pontuação e visualize o histórico de cada cliente.",
    price: 29.90, isFree: false, icon: <Star size={20} />,
    category: "MARKETING",
    terms: `AO ATIVAR O MÓDULO "FIDELIDADE & CASHBACK", VOCÊ CONCORDA COM OS SEGUINTES TERMOS:

1. COBRANÇA
   O valor de R$ 29,90/mês será acrescentado à sua fatura mensal.

2. RESPONSABILIDADE
   As regras de pontuação, cashback e validade de pontos são definidas pelo estabelecimento. A FoodSaaS não se responsabiliza por disputas entre o estabelecimento e clientes quanto ao resgate de pontos.

3. PONTOS EXPIRADOS
   Pontos expirados não podem ser recuperados. Configure os prazos com atenção.

4. CANCELAMENTO
   Ao desativar o módulo, os pontos acumulados pelos clientes são preservados no banco de dados mas ficam inacessíveis até a reativação.

5. ACEITAÇÃO
   Ao clicar em "Confirmar Ativação", você declara ter lido e aceito integralmente estes termos.`,
  },

  coupons: {
    name: "Cupons de Desconto",
    shortDesc: "Crie cupons de desconto por valor, % ou frete grátis.",
    longDesc:  "Gere cupons com desconto fixo, percentual ou frete grátis. Defina validade, limite de uso, pedido mínimo e uso por cliente. Compartilhe via link ou QR Code.",
    price: 19.90, isFree: false, icon: <Ticket size={20} />,
    category: "MARKETING",
    terms: `AO ATIVAR O MÓDULO "CUPONS DE DESCONTO", VOCÊ CONCORDA COM OS SEGUINTES TERMOS:

1. COBRANÇA
   O valor de R$ 19,90/mês será acrescentado à sua fatura mensal.

2. RESPONSABILIDADE
   O estabelecimento é responsável pela configuração correta dos cupons, incluindo validade, limite de uso e valor de desconto. A FoodSaaS não se responsabiliza por erros de configuração que causem prejuízo financeiro.

3. CANCELAMENTO
   Ao desativar o módulo, cupons existentes são desabilitados automaticamente.

4. ACEITAÇÃO
   Ao clicar em "Confirmar Ativação", você declara ter lido e aceito integralmente estes termos.`,
  },

  "smart-import": {
    name: "Cadastro Inteligente por IA",
    shortDesc: "Importe cardápio por foto, PDF ou XML com IA.",
    longDesc:  "Tire uma foto do cardápio impresso, faça upload de um PDF ou XML de nota fiscal e a IA extrai e cadastra automaticamente categorias, produtos e preços. Revisão antes de confirmar.",
    price: 49.90, isFree: false, icon: <Sparkles size={20} />,
    category: "AUTOMACAO",
    terms: `AO ATIVAR O MÓDULO "CADASTRO INTELIGENTE POR IA", VOCÊ CONCORDA COM OS SEGUINTES TERMOS:

1. COBRANÇA
   O valor de R$ 49,90/mês será acrescentado à sua fatura mensal.

2. PRECISÃO DA IA
   A extração por IA tem alta precisão mas não é infalível. Sempre revise os itens extraídos antes de confirmar o cadastro. A FoodSaaS não se responsabiliza por dados incorretos cadastrados sem revisão.

3. CUSTO DE API
   O processamento usa APIs de inteligência artificial externas (Google Gemini / Anthropic). O custo dessas APIs está incluso no valor do módulo para o uso padrão.

4. CANCELAMENTO
   O módulo pode ser desativado a qualquer momento. Cancelamento válido para o próximo ciclo.

5. ACEITAÇÃO
   Ao clicar em "Confirmar Ativação", você declara ter lido e aceito integralmente estes termos.`,
  },

  printers: {
    name: "Impressão Profissional",
    shortDesc: "Impressora de 80mm em rede ou USB no estabelecimento.",
    longDesc:  "Conecte impressoras térmicas de 80mm via rede TCP/IP ou USB. Impressão automática ao confirmar pedido: via de cozinha, bar e balcão em setores separados. Agente local incluso.",
    price: 29.90, isFree: false, icon: <FileText size={20} />,
    category: "OPERACAO",
    terms: `AO ATIVAR O MÓDULO "IMPRESSÃO PROFISSIONAL", VOCÊ CONCORDA COM OS SEGUINTES TERMOS:

1. COBRANÇA
   O valor de R$ 29,90/mês será acrescentado à sua fatura mensal.

2. HARDWARE
   O módulo requer impressora térmica compatível com protocolo ESC/POS. A FoodSaaS não fornece o hardware — apenas o software de integração.

3. AGENTE LOCAL
   A impressão em rede/USB requer a instalação do FoodSaaS Printer Agent no computador do estabelecimento. O agente é gratuito e está incluso no módulo.

4. SUPORTE
   Problemas de hardware (impressora, cabo, rede) não são cobertos pelo suporte da FoodSaaS.

5. CANCELAMENTO
   O módulo pode ser desativado a qualquer momento. Cancelamento válido para o próximo ciclo.

6. ACEITAÇÃO
   Ao clicar em "Confirmar Ativação", você declara ter lido e aceito integralmente estes termos.`,
  },

  tracking: {
    name: "Rastreamento em Tempo Real",
    shortDesc: "Mapa ao vivo com posição dos entregadores.",
    longDesc:  "Painel de mapa interativo com localização GPS dos entregadores em rota. Clientes acompanham o pedido em página pública. Requer o módulo Delivery ativo.",
    price: 19.90, isFree: false, icon: <Truck size={20} />,
    category: "OPERACAO",
    terms: `AO ATIVAR O MÓDULO "RASTREAMENTO EM TEMPO REAL", VOCÊ CONCORDA COM OS SEGUINTES TERMOS:

1. COBRANÇA
   O valor de R$ 19,90/mês será acrescentado à sua fatura mensal.

2. PRÉ-REQUISITO
   Este módulo requer o módulo "Delivery & Entregadores" ativo para funcionar corretamente.

3. GPS
   A precisão do rastreamento depende do sinal de GPS do celular do entregador e da qualidade da conexão com a internet. A FoodSaaS não garante precisão em locais com sinal fraco.

4. PRIVACIDADE
   A localização do entregador é compartilhada apenas durante entregas ativas. Ao encerrar a entrega, o rastreamento é pausado automaticamente.

5. CANCELAMENTO
   O módulo pode ser desativado a qualquer momento. Cancelamento válido para o próximo ciclo.

6. ACEITAÇÃO
   Ao clicar em "Confirmar Ativação", você declara ter lido e aceito integralmente estes termos.`,
  },
};

// Fallback para slugs não mapeados no catálogo
function getCatalogEntry(slug: string): CatalogEntry {
  return MODULE_CATALOG[slug] ?? {
    name:      slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    shortDesc: "Módulo adicional para o seu estabelecimento.",
    longDesc:  "Módulo adicional disponível no seu plano FoodSaaS.",
    price:     null,
    isFree:    false,
    icon:      <Package size={20} />,
    category:  "OPERACAO" as ModuleCategory,
    terms:     `AO ATIVAR ESTE MÓDULO, VOCÊ CONCORDA QUE:\n\n1. O valor do módulo será acrescentado à sua fatura mensal.\n2. A ativação é imediata após a confirmação.\n3. O cancelamento é válido para o próximo ciclo de cobrança.\n4. Ao clicar em "Confirmar Ativação", você declara ter lido e aceito estes termos.`,
    highlighted: false,
  };
}

// ── Mapas de ícones e cores ───────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<ModuleCategory, { label: string; color: string; bg: string }> = {
  OPERACAO:   { label: "Operação",   color: "text-orange-600",  bg: "bg-orange-100 dark:bg-orange-900/30" },
  MARKETING:  { label: "Marketing",  color: "text-purple-600",  bg: "bg-purple-100 dark:bg-purple-900/30" },
  FINANCEIRO: { label: "Financeiro", color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  AUTOMACAO:  { label: "Automação",  color: "text-blue-600",    bg: "bg-blue-100 dark:bg-blue-900/30" },
};

const STATUS_CONFIG: Record<ModuleStatus, { label: string; icon: React.ReactNode; cls: string }> = {
  ACTIVE:   { label: "Ativo",          icon: <CheckCircle2 size={11} />, cls: "text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700" },
  TRIAL:    { label: "Trial",          icon: <Clock size={11} />,        cls: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700" },
  EXPIRED:  { label: "Trial expirado", icon: <XCircle size={11} />,      cls: "text-red-700 bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-700" },
  INACTIVE: { label: "",               icon: null,                        cls: "" },
};

const PLAN_COLORS: Record<string, { accent: string; glow: string; label: string }> = {
  BASIC:      { accent: "from-green-500 to-teal-500",    glow: "shadow-green-200 dark:shadow-green-900",    label: "Basic" },
  PRO:        { accent: "from-blue-500 to-indigo-600",   glow: "shadow-blue-200 dark:shadow-blue-900",      label: "Pro" },
  ENTERPRISE: { accent: "from-purple-500 to-violet-600", glow: "shadow-purple-200 dark:shadow-purple-900",  label: "Enterprise" },
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: "Ativa",      cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  TRIAL:     { label: "Trial",      cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  CANCELLED: { label: "Cancelada",  cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  PENDING:   { label: "Pendente",   cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  SUSPENDED: { label: "Suspensa",   cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

const CATEGORIES: Array<{ id: ModuleCategory | "TODOS"; label: string }> = [
  { id: "TODOS",      label: "Todos" },
  { id: "OPERACAO",   label: "Operação" },
  { id: "MARKETING",  label: "Marketing" },
  { id: "FINANCEIRO", label: "Financeiro" },
  { id: "AUTOMACAO",  label: "Automação" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatCurrency(v: number | string | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  if (isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Modal de Contrato ─────────────────────────────────────────────────────────

function ContractModal({
  mod,
  action,
  onClose,
  onConfirm,
  loading,
}: {
  mod: ModuleItem;
  action: "trial" | "activate";
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const [accepted, setAccepted] = useState(false);
  const entry = getCatalogEntry(mod.slug);
  const isTrial = action === "trial";
  const price: number | null = entry.price != null ? entry.price : (mod.price != null ? Number(mod.price) : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-orange-100 dark:bg-orange-900/40 text-orange-600`}>
              {entry.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {isTrial ? "Iniciar Trial Gratuito — " : "Contratar — "}{entry.name}
              </h3>
              <p className="text-xs text-gray-500 mt-1">{entry.longDesc}</p>
              {price && (
                <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${
                  isTrial
                    ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700"
                    : "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-700"
                }`}>
                  {isTrial ? (
                    <>
                      <Clock size={13} />
                      14 dias grátis · depois {formatCurrency(price)}/mês
                    </>
                  ) : (
                    <>
                      <Zap size={13} />
                      {formatCurrency(price)}/mês adicionado à sua fatura
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Termos com scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Termos de uso do módulo</p>
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap font-mono">
            {entry.terms}
          </div>
        </div>

        {/* Footer com checkbox e botões */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 shrink-0 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={accepted}
              onChange={e => setAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-orange-500 cursor-pointer shrink-0"
            />
            <span className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">
              Li e aceito os termos do contrato para{" "}
              <strong>{isTrial ? "iniciar o trial" : "ativar"}</strong> do módulo{" "}
              <strong>{entry.name}</strong>.
            </span>
          </label>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={!accepted || loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <><Loader2 size={14} className="animate-spin" />Processando...</>
              ) : isTrial ? (
                <><Clock size={14} />Iniciar Trial Gratuito</>
              ) : (
                <><CheckCircle2 size={14} />Confirmar Ativação</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card de módulo ────────────────────────────────────────────────────────────

function ModuleCard({
  mod,
  companyId,
  onRefresh,
}: {
  mod: ModuleItem;
  companyId: string;
  onRefresh: () => void;
}) {
  const [pendingAction, setPendingAction] = useState<"trial" | "activate" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const entry = getCatalogEntry(mod.slug);
  const cat   = CATEGORY_CONFIG[entry.category] ?? CATEGORY_CONFIG.OPERACAO;
  const sc    = STATUS_CONFIG[mod.status];
  const isOn  = mod.status === "ACTIVE" || mod.status === "TRIAL";
  const price: number | null = entry.price != null ? entry.price : (mod.price != null ? Number(mod.price) : null);

  async function execAction(action: "trial" | "activate" | "deactivate") {
    setActionLoading(true);
    try {
      if (action === "trial") {
        await api.post("/company-module/trial", { companyId, moduleSlug: mod.slug });
        toast.success("Trial de 14 dias ativado!");
      } else if (action === "activate") {
        await api.post("/company-module/activate", { companyId, moduleSlug: mod.slug });
        toast.success("Módulo ativado com sucesso!");
      } else {
        await api.delete(`/company-module/${companyId}/${mod.slug}`);
        toast.success("Módulo desativado.");
      }
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Erro ao alterar módulo");
    } finally {
      setActionLoading(false);
      setPendingAction(null);
    }
  }

  return (
    <>
      <div className={`relative bg-white dark:bg-gray-900 rounded-xl border transition-all ${
        isOn
          ? "border-orange-200 dark:border-orange-800 shadow-sm"
          : "border-gray-200 dark:border-gray-800"
      }`}>
        {/* Badge recomendado */}
        {entry.highlighted && !isOn && (
          <div className="absolute -top-2 left-4">
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white">
              ✦ Recomendado
            </span>
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start gap-3 mb-3">
            {/* Ícone */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isOn ? "bg-orange-100 dark:bg-orange-900/40 text-orange-600" : "bg-gray-100 dark:bg-gray-800 text-gray-500"
            }`}>
              {entry.icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                  {entry.name}
                </p>
                {sc.label && (
                  <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${sc.cls}`}>
                    {sc.icon}{sc.label}
                  </span>
                )}
              </div>
              <span className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${cat.bg} ${cat.color}`}>
                {cat.label}
              </span>
            </div>
          </div>

          {/* Descrição */}
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed mb-3 line-clamp-2">
            {entry.shortDesc}
          </p>

          {/* Preço */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
              {entry.isFree || price == null
                ? <span className="text-emerald-600 dark:text-emerald-400">Incluso no plano</span>
                : <>{formatCurrency(price)}<span className="font-normal text-gray-400">/mês</span></>
              }
            </p>
          </div>

          {/* Botões */}
          <div className="flex gap-1.5">
            {mod.status === "INACTIVE" && (
              <>
                {!entry.isFree && price !== null && (
                  <button
                    onClick={() => setPendingAction("trial")}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 text-[10px] font-semibold hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
                  >
                    <Clock size={10} />Trial 14d
                  </button>
                )}
                <button
                  onClick={() => entry.isFree ? execAction("activate") : setPendingAction("activate")}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-orange-500 text-white text-[10px] font-bold hover:bg-orange-600 transition-colors"
                >
                  <Zap size={10} />
                  {entry.isFree ? "Ativar" : "Contratar"}
                </button>
              </>
            )}

            {mod.status === "TRIAL" && (
              <>
                <button
                  onClick={() => setPendingAction("activate")}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-orange-500 text-white text-[10px] font-bold hover:bg-orange-600 transition-colors"
                >
                  <CheckCircle2 size={10} />Contratar
                </button>
                <button
                  onClick={() => execAction("deactivate")}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 text-[10px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <XCircle size={10} />Cancelar trial
                </button>
              </>
            )}

            {mod.status === "ACTIVE" && (
              <button
                onClick={() => execAction("deactivate")}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 text-[10px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <XCircle size={10} />Desativar
              </button>
            )}

            {mod.status === "EXPIRED" && (
              <button
                onClick={() => setPendingAction("activate")}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-orange-500 text-white text-[10px] font-bold hover:bg-orange-600 transition-colors"
              >
                <RefreshCw size={10} />Reativar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de contrato */}
      {pendingAction && (
        <ContractModal
          mod={mod}
          action={pendingAction}
          loading={actionLoading}
          onClose={() => setPendingAction(null)}
          onConfirm={() => execAction(pendingAction)}
        />
      )}
    </>
  );
}

// ── Card de plano atual ───────────────────────────────────────────────────────

function PlanCard({ data, onUpgrade }: {
  data: SubscriptionData;
  onUpgrade: () => void;
}) {
  const plan = data.plan || "BASIC";
  const pc   = PLAN_COLORS[plan] ?? PLAN_COLORS.BASIC;
  const sc   = STATUS_LABEL[data.subscriptionStatus] ?? STATUS_LABEL.ACTIVE;
  const pp   = data.planPrices?.[plan];

  return (
    <div className={`relative rounded-2xl overflow-hidden shadow-lg ${pc.glow}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${pc.accent} opacity-90`} />
      <div className="relative p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Star size={16} className="fill-white/80 text-white/80" />
              <span className="text-xs font-semibold tracking-wide uppercase opacity-80">Plano atual</span>
            </div>
            <h3 className="text-3xl font-black tracking-tight">{pp?.label ?? plan}</h3>
            {pp?.tagline && <p className="text-white/70 text-sm mt-0.5">{pp.tagline}</p>}
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${sc.cls}`}>{sc.label}</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <p className="text-white/60 text-[10px] uppercase font-semibold tracking-wide">Valor mensal</p>
            <p className="text-2xl font-bold mt-0.5">{pp ? formatCurrency(pp.price) : "—"}</p>
          </div>
          <div>
            <p className="text-white/60 text-[10px] uppercase font-semibold tracking-wide">Próxima renovação</p>
            <p className="text-sm font-semibold mt-1">{formatDate(data.dueDate)}</p>
          </div>
        </div>
        <div className="mt-5 flex gap-2 flex-wrap">
          {plan !== "ENTERPRISE" && (
            <button
              onClick={onUpgrade}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-gray-900 text-xs font-bold hover:bg-white/90 transition-colors"
            >
              <ArrowUpCircle size={13} />Fazer Upgrade
            </button>
          )}
          <a
            href="https://wa.me/554188888888?text=Olá, preciso de ajuda com meu plano FoodSaaS"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20 text-white text-xs font-semibold hover:bg-white/30 transition-colors border border-white/30"
          >
            <MessageCircle size={13} />Falar com suporte
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Modal de upgrade ──────────────────────────────────────────────────────────

function UpgradeModal({ data, onClose }: { data: SubscriptionData; onClose: () => void }) {
  const currentPlan = data.plan || "BASIC";
  const plans = ["BASIC", "PRO", "ENTERPRISE"].filter((p) => p !== currentPlan);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles size={18} className="text-orange-500" />
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Fazer Upgrade</h3>
          </div>
          <p className="text-xs text-gray-500 mb-5">
            Você está atualmente no plano <strong>{currentPlan}</strong>. Escolha o próximo nível para desbloquear mais recursos.
          </p>
          <div className="space-y-3">
            {plans.map((p) => {
              const pc = PLAN_COLORS[p];
              const pp = data.planPrices?.[p];
              return (
                <div key={p} className={`rounded-xl p-4 bg-gradient-to-r ${pc.accent} text-white`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">{pp?.label ?? p}</span>
                    <span className="text-xs font-bold">{pp ? formatCurrency(pp.price) + "/mês" : "Consultar"}</span>
                  </div>
                  <p className="text-white/70 text-[11px] mb-3">{pp?.tagline ?? ""}</p>
                  <a
                    href={`https://wa.me/554188888888?text=Quero fazer upgrade para o plano ${p}`}
                    target="_blank" rel="noopener noreferrer"
                    className="block text-center py-1.5 rounded-lg bg-white text-gray-900 text-[11px] font-bold hover:bg-white/90 transition-colors"
                    onClick={onClose}
                  >
                    Solicitar upgrade →
                  </a>
                </div>
              );
            })}
          </div>
          <button
            onClick={onClose}
            className="mt-4 w-full py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function PlanoTab() {
  const { user }    = useAuthStore();
  const companyId   = (user as any)?.companyId ?? "";

  const [subData, setSubData]         = useState<SubscriptionData | null>(null);
  const [modules, setModules]         = useState<ModuleItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeCategory, setCategory] = useState<ModuleCategory | "TODOS">("TODOS");
  const [showUpgrade, setShowUpgrade] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [subRes, compRes] = await Promise.all([
        api.get<SubscriptionData>(`/company/${companyId}/subscription`),
        api.get<{ modules: any[] }>(`/company/${companyId}`),
      ]);
      setSubData(subRes.data);
      const mods: ModuleItem[] = (compRes.data?.modules ?? []).map((m: any) => ({
        ...m,
        slug:   m.moduleSlug ?? m.slug ?? m.module ?? "",
        status: m.status ?? (m.active ? "ACTIVE" : "INACTIVE"),
      }));
      setModules(mods);
    } catch {
      toast.error("Erro ao carregar dados do plano");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const filtered =
    activeCategory === "TODOS"
      ? modules
      : modules.filter((m) => {
          const entry = getCatalogEntry(m.slug);
          return entry.category === activeCategory;
        });

  const activeCount = modules.filter((m) => m.status === "ACTIVE" || m.status === "TRIAL").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin text-orange-500" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {subData && <PlanCard data={subData} onUpgrade={() => setShowUpgrade(true)} />}

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Módulos disponíveis</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {activeCount} {activeCount === 1 ? "módulo ativo" : "módulos ativos"} · Trial gratuito de 14 dias em módulos pagos
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mb-5">
          {CATEGORIES.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setCategory(id as ModuleCategory | "TODOS")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeCategory === id
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum módulo nesta categoria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((mod) => (
              <ModuleCard key={mod.slug} mod={mod} companyId={companyId} onRefresh={load} />
            ))}
          </div>
        )}
      </section>

      {showUpgrade && subData && (
        <UpgradeModal data={subData} onClose={() => setShowUpgrade(false)} />
      )}
    </div>
  );
}
