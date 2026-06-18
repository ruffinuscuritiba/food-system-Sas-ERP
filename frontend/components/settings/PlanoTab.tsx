"use client";

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
}

// ─────────────────────────────────────────────
// Catálogo de módulos
// ─────────────────────────────────────────────

const MODULES: ModuleDef[] = [
  // ── iFood ────────────────────────────────────────────────────────────────
  {
    slug: "ifood",
    name: "iFood Integrado",
    category: "Operação",
    price: 49.90,
    highlighted: true,
    icon: <ShoppingBag size={20} />,
    description: "Sincronize seu cardápio, receba e gerencie pedidos do iFood direto no nosso PDV.",
    longDescription:
      "Pare de alternar entre aplicativos. Com o módulo iFood Integrado, todos os pedidos recebidos pelo iFood aparecem automaticamente no seu painel FoodSaaS em tempo real — prontos para serem aceitos, preparados e entregues sem que o operador precise digitar nada manualmente. O cardápio é sincronizado bidiretivamente: alterações feitas no FoodSaaS refletem no iFood em minutos.",
    howToUse: [
      "Acesse 'Configurações → Integrações' e clique em 'Conectar iFood'.",
      "Insira suas credenciais de parceiro iFood (Client ID e Client Secret).",
      "Aguarde a sincronização inicial do cardápio (até 5 minutos).",
      "A partir de agora, novos pedidos iFood aparecem automaticamente na tela de Pedidos.",
      "Confirme, prepare e atualize o status — o cliente recebe notificações em tempo real.",
    ],
    features: [
      { icon: <Zap size={16} />,      title: "Pedidos em tempo real",       desc: "Novos pedidos chegam instantaneamente na cozinha." },
      { icon: <RefreshCw size={16} />, title: "Cardápio sincronizado",        desc: "Preços e disponibilidade atualizados automaticamente." },
      { icon: <BarChart3 size={16} />, title: "Relatórios unificados",        desc: "Faturamento iFood consolidado no BI do FoodSaaS." },
      { icon: <Shield size={16} />,    title: "Sem dupla digitação",          desc: "Elimine erros causados por pedidos digitados manualmente." },
    ],
    terms:
      `Ao ativar o módulo "iFood Integrado", o contratante concorda com a cobrança adicional recorrente de R$ 49,90/mês adicionada ao plano atual. A ativação do recurso é imediata e a cobrança será proporcional ou inclusa no próximo ciclo do Mercado Pago.\n\nCONDIÇÕES ESPECÍFICAS:\n• A integração requer credenciais de API liberadas pelo iFood para parceiros técnicos.\n• Comissões e taxas do iFood são cobradas diretamente pelo marketplace.\n• Alterações urgentes de cardápio devem ser feitas também no app iFood.\n• O cancelamento do módulo encerra a sincronização no próximo ciclo — sem reembolso proporcional do período em curso.`,
  },

  // ── 99 Food ───────────────────────────────────────────────────────────────
  {
    slug: "99food",
    name: "99 Food",
    category: "Operação",
    price: 39.90,
    icon: <Wifi size={20} />,
    description: "Integração direta com a plataforma 99 Food para recebimento automático de pedidos.",
    longDescription:
      "Expanda seus canais de venda sem aumentar a equipe. Com a integração 99 Food, pedidos feitos pelos clientes na plataforma chegam direto no FoodSaaS — sem intermediários humanos. Seu cardápio, preços e horário de funcionamento são gerenciados de um único lugar.",
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
    terms:
      `Ao ativar o módulo "99 Food", o contratante concorda com a cobrança adicional recorrente de R$ 39,90/mês adicionada ao plano atual. A ativação do recurso é imediata e a cobrança será proporcional ou inclusa no próximo ciclo do Mercado Pago.\n\nCONDIÇÕES ESPECÍFICAS:\n• A integração requer credenciais de API ativas na plataforma 99 Food.\n• Taxas e comissões da 99 Food são cobradas diretamente pelo marketplace.\n• O cancelamento do módulo encerra a sincronização no próximo ciclo.`,
  },

  // ── Rastreamento ──────────────────────────────────────────────────────────
  {
    slug: "tracking",
    name: "Rastreamento de Entregadores",
    category: "Operação",
    price: 29.90,
    icon: <Map size={20} />,
    description: "Acompanhe seus motoboys em tempo real no mapa e envie atualizações automáticas de rota para o cliente.",
    longDescription:
      "Dê transparência total para o processo de entrega. O entregador usa o app PWA FoodSaaS no celular — sem precisar instalar nada. Sua posição GPS é transmitida ao painel administrativo em tempo real. O cliente recebe um link de rastreamento e acompanha a entrega no mapa, sem precisar ligar para o estabelecimento.",
    howToUse: [
      "Cadastre o entregador em 'Entregadores' e informe o celular dele.",
      "O entregador acessa /driver no navegador do celular (PWA, sem instalação).",
      "Ao aceitar um pedido, o GPS é ativado automaticamente.",
      "No painel 'Rastreamento', você vê todos os entregadores em rota no mapa.",
      "O cliente recebe link público de rastreamento via WhatsApp.",
    ],
    features: [
      { icon: <Map size={16} />,         title: "Mapa ao vivo",              desc: "Posição GPS atualizada a cada 5 segundos no painel." },
      { icon: <Headphones size={16} />,  title: "Link para o cliente",       desc: "Página pública de rastreamento sem precisar de app." },
      { icon: <Play size={16} />,        title: "PWA sem instalação",        desc: "Entregador acessa pelo navegador do celular." },
      { icon: <BarChart3 size={16} />,   title: "Painel de entregas",        desc: "Histórico de rotas e tempo médio por entregador." },
    ],
    terms:
      `Ao ativar o módulo "Rastreamento de Entregadores", o contratante concorda com a cobrança adicional recorrente de R$ 29,90/mês adicionada ao plano atual. A ativação do recurso é imediata e a cobrança será proporcional ou inclusa no próximo ciclo do Mercado Pago.\n\nCONDIÇÕES ESPECÍFICAS:\n• O rastreamento GPS depende do entregador manter o app aberto com GPS ativo.\n• A precisão varia conforme qualidade de sinal do celular do entregador.\n• A FoodSaaS não se responsabiliza por disputas decorrentes de divergências de rota.\n• O cancelamento encerra o rastreamento no próximo ciclo.`,
  },

  // ── Nota Fiscal ───────────────────────────────────────────────────────────
  {
    slug: "fiscal",
    name: "Emissão de Nota Fiscal",
    category: "Financeiro",
    price: 59.90,
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
    terms:
      `Ao ativar o módulo "Emissão de Nota Fiscal (NFS-e / NFC-e)", o contratante concorda com a cobrança adicional recorrente de R$ 59,90/mês adicionada ao plano atual. A ativação do recurso é imediata e a cobrança será proporcional ou inclusa no próximo ciclo do Mercado Pago.\n\nCONDIÇÕES ESPECÍFICAS:\n• O contratante é responsável por manter seus dados fiscais (CNPJ, certificado digital, regime tributário) atualizados.\n• A FoodSaaS não se responsabiliza por notas emitidas com dados incorretos fornecidos pelo contratante.\n• A validade das notas está sujeita às regras da prefeitura/SEFAZ de cada município.\n• O cancelamento do módulo não cancela notas já emitidas.`,
  },

  // ── WhatsApp IA ───────────────────────────────────────────────────────────
  {
    slug: "whatsapp-ia",
    name: "Robô de Atendimento WhatsApp IA",
    category: "Automação",
    price: 79.90,
    highlighted: true,
    icon: <Bot size={20} />,
    description: "Atendente virtual com IA que responde clientes e anota pedidos sozinho no WhatsApp.",
    longDescription:
      "Atenda centenas de clientes simultaneamente, 24 horas por dia, sem contratar mais atendentes. A Kely — IA da FoodSaaS — responde dúvidas, apresenta o cardápio, anota pedidos, confirma endereço e encaminha para pagamento, tudo pelo WhatsApp. Quando o cliente pede para falar com uma pessoa, ela transfere automaticamente. Você configura o horário de atendimento, mensagem de boas-vindas e estilo de comunicação.",
    howToUse: [
      "Acesse 'Configurar IA → Conexões' e clique em 'Nova Conexão'.",
      "Escolha o provedor (WhatsApp Business / Evolution API / Meta Cloud API).",
      "Conecte seu número escaneando o QR Code.",
      "Em 'Configurar IA', defina o horário de atendimento e modo (Auto/Híbrido/Manual).",
      "Personalize a saudação e o comportamento da Kely no campo 'Prompt personalizado'.",
      "Pronto — a Kely já começa a atender automaticamente.",
    ],
    features: [
      { icon: <Bot size={16} />,         title: "IA humanizada (Kely)",     desc: "Conversa natural, entende contexto e variações de texto." },
      { icon: <Zap size={16} />,         title: "Pedidos automáticos",      desc: "Anota e confirma pedidos sem intervenção humana." },
      { icon: <Headphones size={16} />,  title: "Transferência inteligente", desc: "Encaminha para atendente quando necessário." },
      { icon: <Clock size={16} />,       title: "24/7 sem pausas",           desc: "Atende fora do horário comercial sem custo extra." },
    ],
    terms:
      `Ao ativar o módulo "Robô de Atendimento WhatsApp IA", o contratante concorda com a cobrança adicional recorrente de R$ 79,90/mês adicionada ao plano atual. A ativação do recurso é imediata e a cobrança será proporcional ou inclusa no próximo ciclo do Mercado Pago.\n\nCONDIÇÕES ESPECÍFICAS:\n• O contratante é responsável por fornecer um número WhatsApp Business ativo. A FoodSaaS não fornece o número.\n• O custo de uso da API WhatsApp (Meta Cloud API) é cobrado diretamente pela Meta ao titular da conta.\n• A IA opera com base nos dados do cardápio cadastrado. Alterações levam até 5 minutos para refletir.\n• A IA não substitui atendimento humano em situações complexas.\n• O cancelamento do módulo desativa o robô no próximo ciclo.`,
  },

  // ── Fidelidade ────────────────────────────────────────────────────────────
  {
    slug: "loyalty",
    name: "Fidelidade & Cupons",
    category: "Marketing",
    price: 19.90,
    icon: <Gift size={20} />,
    description: "Crie programas de pontos, cashback e campanhas de cupons para reter seus clientes.",
    longDescription:
      "Transforme clientes eventuais em clientes fiéis. Configure regras de pontuação (ex: 1 ponto a cada R$1 gasto), cashback automático e cupons de desconto com validade e limite de uso. Os clientes visualizam seu saldo pelo cardápio digital e escolhem como resgatar. Você acompanha tudo pelo painel de fidelidade com ranking de melhores clientes.",
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
    terms:
      `Ao ativar o módulo "Fidelidade & Cupons", o contratante concorda com a cobrança adicional recorrente de R$ 19,90/mês adicionada ao plano atual. A ativação do recurso é imediata e a cobrança será proporcional ou inclusa no próximo ciclo do Mercado Pago.\n\nCONDIÇÕES ESPECÍFICAS:\n• As regras de pontuação, cashback e validade são definidas e de responsabilidade exclusiva do contratante.\n• A FoodSaaS não se responsabiliza por disputas entre o estabelecimento e clientes quanto ao resgate.\n• Pontos expirados não podem ser recuperados após o prazo configurado.\n• Ao desativar o módulo, pontos acumulados ficam preservados até a reativação.`,
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
              <p className="text-3xl font-black">{fmt(mod.price)}<span className="text-base font-normal text-white/50">/mês</span></p>
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

          {/* Preço + CTA */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-lg font-black text-gray-900">{fmt(def.price)}</span>
              <span className="text-xs text-gray-400 font-medium">/mês</span>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-orange-500 group-hover:gap-2 transition-all">
              Ver detalhes <ChevronRight size={13} />
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
            href="https://wa.me/554188888888?text=Olá, preciso de suporte com meu plano FoodSaaS"
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
                  href={`https://wa.me/554188888888?text=Quero fazer upgrade para o plano ${p.label} FoodSaaS`}
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

  const [plan,        setPlan]        = useState("BASIC");
  const [subStatus,   setSubStatus]   = useState("ACTIVE");
  const [dueDate,     setDueDate]     = useState<string | null>(null);
  const [modStatuses, setModStatuses] = useState<Record<string, { status: ModStatus; trialEndsAt?: string | null }>>({});
  const [loading,     setLoading]     = useState(true);
  const [category,    setCategory]    = useState<typeof CATEGORIES[number]>("Todos");
  const [showUpgrade, setShowUpgrade] = useState(false);

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

      {showUpgrade && <UpgradeModal currentPlan={plan} onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
