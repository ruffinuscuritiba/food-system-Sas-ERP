"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2, Clock, XCircle, Zap, Star, Loader2,
  MessageCircle, ArrowUpCircle, Sparkles, Package,
  RefreshCw, X, AlertTriangle,
  Map, ShoppingBag, Wifi, FileText, Bot, Gift,
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

interface ModuleDef {
  slug: string;
  name: string;
  category: "Operação" | "Financeiro" | "Automação" | "Marketing";
  price: number;
  description: string;
  terms: string;
  icon: React.ReactNode;
  highlighted?: boolean;
}

// ─────────────────────────────────────────────
// Lista oficial de módulos do ecossistema
// ─────────────────────────────────────────────

const MODULES: ModuleDef[] = [
  {
    slug: "ifood",
    name: "iFood Integrado",
    category: "Operação",
    price: 49.90,
    description: "Sincronize seu cardápio, receba e gerencie pedidos do iFood direto no nosso PDV.",
    icon: <ShoppingBag size={20} />,
    highlighted: true,
    terms:
      `Ao ativar o módulo "iFood Integrado", o contratante concorda com a cobrança adicional recorrente de R$ 49,90/mês adicionada ao plano atual. A ativação do recurso é imediata e a cobrança será proporcional ou inclusa no próximo ciclo do Mercado Pago.

CONDIÇÕES ESPECÍFICAS:
• A integração requer credenciais de API liberadas pelo iFood para parceiros técnicos.
• Comissões e taxas do iFood são cobradas diretamente pelo marketplace.
• Alterações urgentes de cardápio devem ser feitas também no app iFood.
• O cancelamento do módulo encerra a sincronização no próximo ciclo — sem reembolso proporcional do período em curso.`,
  },
  {
    slug: "99food",
    name: "99 Food",
    category: "Operação",
    price: 39.90,
    description: "Integração direta com a plataforma 99 Food para recebimento automático de pedidos.",
    icon: <Wifi size={20} />,
    terms:
      `Ao ativar o módulo "99 Food", o contratante concorda com a cobrança adicional recorrente de R$ 39,90/mês adicionada ao plano atual. A ativação do recurso é imediata e a cobrança será proporcional ou inclusa no próximo ciclo do Mercado Pago.

CONDIÇÕES ESPECÍFICAS:
• A integração requer credenciais de API ativas na plataforma 99 Food.
• Taxas e comissões da 99 Food são cobradas diretamente pelo marketplace.
• O cancelamento do módulo encerra a sincronização no próximo ciclo.`,
  },
  {
    slug: "tracking",
    name: "Rastreamento de Entregadores",
    category: "Operação",
    price: 29.90,
    description:
      "Acompanhe seus motoboys em tempo real no mapa e envie atualizações automáticas de rota para o cliente.",
    icon: <Map size={20} />,
    terms:
      `Ao ativar o módulo "Rastreamento de Entregadores", o contratante concorda com a cobrança adicional recorrente de R$ 29,90/mês adicionada ao plano atual. A ativação do recurso é imediata e a cobrança será proporcional ou inclusa no próximo ciclo do Mercado Pago.

CONDIÇÕES ESPECÍFICAS:
• O rastreamento GPS depende do entregador manter o app aberto com GPS ativo.
• A precisão varia conforme qualidade de sinal do celular do entregador.
• A FoodSaaS não se responsabiliza por disputas decorrentes de divergências de rota.
• O cancelamento encerra o rastreamento no próximo ciclo.`,
  },
  {
    slug: "fiscal",
    name: "Emissão de Nota Fiscal (NFS-e / NFC-e)",
    category: "Financeiro",
    price: 59.90,
    description:
      "Emita notas fiscais de serviço e de consumidor direto pelo sistema de forma automatizada e sem burocracia.",
    icon: <FileText size={20} />,
    highlighted: true,
    terms:
      `Ao ativar o módulo "Emissão de Nota Fiscal (NFS-e / NFC-e)", o contratante concorda com a cobrança adicional recorrente de R$ 59,90/mês adicionada ao plano atual. A ativação do recurso é imediata e a cobrança será proporcional ou inclusa no próximo ciclo do Mercado Pago.

CONDIÇÕES ESPECÍFICAS:
• O contratante é responsável por manter seus dados fiscais (CNPJ, certificado digital, regime tributário) atualizados no sistema.
• A FoodSaaS não se responsabiliza por notas emitidas com dados incorretos fornecidos pelo contratante.
• A validade das notas emitidas está sujeita às regras da prefeitura/SEFAZ de cada município/estado.
• O cancelamento do módulo não cancela notas já emitidas.`,
  },
  {
    slug: "whatsapp-ia",
    name: "Robô de Atendimento WhatsApp IA",
    category: "Automação",
    price: 79.90,
    description:
      "Atendente virtual com Inteligência Artificial que responde clientes e anota pedidos sozinho no WhatsApp.",
    icon: <Bot size={20} />,
    highlighted: true,
    terms:
      `Ao ativar o módulo "Robô de Atendimento WhatsApp IA", o contratante concorda com a cobrança adicional recorrente de R$ 79,90/mês adicionada ao plano atual. A ativação do recurso é imediata e a cobrança será proporcional ou inclusa no próximo ciclo do Mercado Pago.

CONDIÇÕES ESPECÍFICAS:
• O contratante é responsável por fornecer um número WhatsApp Business ativo. A FoodSaaS não fornece o número.
• O custo de uso da API WhatsApp (Meta Cloud API) é cobrado diretamente pela Meta ao titular da conta.
• A IA opera com base nos dados do cardápio cadastrado. Alterações levam até 5 minutos para refletir no atendimento.
• A IA não substitui atendimento humano em situações complexas (reclamações, devoluções, pagamentos com falha).
• O cancelamento do módulo desativa o robô no próximo ciclo.`,
  },
  {
    slug: "loyalty",
    name: "Fidelidade & Cupons",
    category: "Marketing",
    price: 19.90,
    description:
      "Crie programas de pontos, cashback e campanhas de cupons para reter seus clientes.",
    icon: <Gift size={20} />,
    terms:
      `Ao ativar o módulo "Fidelidade & Cupons", o contratante concorda com a cobrança adicional recorrente de R$ 19,90/mês adicionada ao plano atual. A ativação do recurso é imediata e a cobrança será proporcional ou inclusa no próximo ciclo do Mercado Pago.

CONDIÇÕES ESPECÍFICAS:
• As regras de pontuação, cashback e validade de pontos são definidas e de responsabilidade exclusiva do contratante.
• A FoodSaaS não se responsabiliza por disputas entre o estabelecimento e clientes quanto ao resgate de pontos ou cupons.
• Pontos expirados não podem ser recuperados após o prazo configurado.
• Ao desativar o módulo, pontos acumulados ficam preservados no banco até a reativação.`,
  },
];

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
  mod,
  onClose,
  onConfirm,
  loading,
}: {
  mod: ModuleDef;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-gray-100">
          <div className="w-11 h-11 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
            {mod.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-orange-500 uppercase tracking-wide mb-0.5">
              Contratar Módulo
            </p>
            <h2 className="text-base font-bold text-gray-900 leading-tight">{mod.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Resumo comercial */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 flex-1 pr-4">{mod.description}</p>
            <div className="text-right shrink-0">
              <p className="text-xl font-black text-gray-900">{fmt(mod.price)}</p>
              <p className="text-[11px] text-gray-400 font-medium">/mês</p>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Ao confirmar, <strong>R$ {mod.price.toFixed(2).replace(".", ",")}/mês</strong> será adicionado à sua fatura mensal no próximo ciclo do Mercado Pago.
            </p>
          </div>
        </div>

        {/* Termos — scrollável */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            Termos e contrato de uso
          </p>
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
              {loading ? (
                <><Loader2 size={14} className="animate-spin" /> Ativando...</>
              ) : (
                <><CheckCircle2 size={14} /> Confirmar Ativação</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Card de módulo
// ─────────────────────────────────────────────

function ModuleCard({
  def,
  status,
  trialEndsAt,
  companyId,
  onRefresh,
}: {
  def: ModuleDef;
  status: ModStatus;
  trialEndsAt?: string | null;
  companyId: string;
  onRefresh: () => void;
}) {
  const [showContract, setShowContract] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const isOn = status === "ACTIVE" || status === "TRIAL";
  const cat  = CATEGORY_COLORS[def.category] ?? { bg: "bg-gray-100", text: "text-gray-600" };

  async function activate() {
    setActionLoading(true);
    try {
      await api.post("/company-module/activate", { companyId, moduleSlug: def.slug });
      toast.success(`${def.name} ativado com sucesso!`);
      setShowContract(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Erro ao ativar módulo");
    } finally {
      setActionLoading(false);
    }
  }

  async function deactivate() {
    setActionLoading(true);
    try {
      await api.delete(`/company-module/${companyId}/${def.slug}`);
      toast.success(`${def.name} desativado.`);
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Erro ao desativar módulo");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <>
      <div className={`relative rounded-xl border transition-all bg-white ${
        isOn ? "border-orange-200 shadow-sm" : "border-gray-200 hover:border-gray-300"
      }`}>

        {def.highlighted && !isOn && (
          <span className="absolute -top-2.5 left-4 text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white">
            ✦ Recomendado
          </span>
        )}

        <div className="p-5">
          {/* Ícone + nome */}
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isOn ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500"
            }`}>
              {def.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-gray-900 leading-tight">{def.name}</p>
                {/* Status badge */}
                {status === "ACTIVE" && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-200 bg-emerald-100 text-emerald-700 shrink-0">
                    <CheckCircle2 size={9} />Ativo
                  </span>
                )}
                {status === "TRIAL" && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-200 bg-amber-100 text-amber-700 shrink-0">
                    <Clock size={9} />Trial
                  </span>
                )}
                {status === "EXPIRED" && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-red-200 bg-red-100 text-red-700 shrink-0">
                    <XCircle size={9} />Expirado
                  </span>
                )}
              </div>
              <span className={`inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1 ${cat.bg} ${cat.text}`}>
                {def.category}
              </span>
            </div>
          </div>

          {/* Descrição */}
          <p className="text-[11px] text-gray-500 leading-relaxed mb-4 min-h-[44px]">
            {def.description}
          </p>

          {/* Preço */}
          <div className="flex items-baseline gap-1 mb-4">
            <span className="text-lg font-black text-gray-900">{fmt(def.price)}</span>
            <span className="text-xs text-gray-400 font-medium">/mês</span>
          </div>

          {/* Ações */}
          {status === "INACTIVE" && (
            <button
              onClick={() => setShowContract(true)}
              disabled={actionLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              <Zap size={14} />Contratar
            </button>
          )}

          {status === "TRIAL" && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowContract(true)}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 size={12} />Contratar
              </button>
              <button
                onClick={deactivate}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <XCircle size={12} />Cancelar trial
              </button>
            </div>
          )}

          {status === "ACTIVE" && (
            <button
              onClick={deactivate}
              disabled={actionLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
              Desativar módulo
            </button>
          )}

          {status === "EXPIRED" && (
            <button
              onClick={() => setShowContract(true)}
              disabled={actionLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} />Reativar
            </button>
          )}

          {trialEndsAt && status === "TRIAL" && (
            <p className="mt-2 text-[10px] text-center text-amber-600">
              Trial até {fmtDate(trialEndsAt)}
            </p>
          )}
        </div>
      </div>

      {showContract && (
        <ContractModal
          mod={def}
          loading={actionLoading}
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
  plan,
  status,
  dueDate,
  onUpgrade,
}: {
  plan: string;
  status: string;
  dueDate: string | null;
  onUpgrade: () => void;
}) {
  const pc = PLAN_COLORS[plan] ?? PLAN_COLORS.BASIC;
  const PLAN_PRICES: Record<string, number> = { BASIC: 97, PRO: 197, ENTERPRISE: 397 };
  const price = PLAN_PRICES[plan];

  const statusLabel: Record<string, { label: string; cls: string }> = {
    ACTIVE:          { label: "Ativa",     cls: "bg-white/20 text-white" },
    TRIAL:           { label: "Trial",     cls: "bg-white/20 text-white" },
    PENDING_PAYMENT: { label: "Pendente",  cls: "bg-white/20 text-white" },
    CANCELLED:       { label: "Cancelada", cls: "bg-white/20 text-white" },
  };
  const sl = statusLabel[status] ?? statusLabel.ACTIVE;

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
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${sl.cls}`}>{sl.label}</span>
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
          <button
            onClick={onClose}
            className="mt-4 w-full py-2 rounded-xl border border-gray-200 text-gray-400 text-xs hover:bg-gray-50 transition-colors"
          >
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

      // Mapear slugs do backend → status por slug
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

  const filtered = MODULES.filter(
    (m) => category === "Todos" || m.category === category
  );

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
      {/* Plano atual */}
      <PlanCard
        plan={plan}
        status={subStatus}
        dueDate={dueDate}
        onUpgrade={() => setShowUpgrade(true)}
      />

      {/* Grade de módulos */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Módulos do ecossistema</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {activeCount} {activeCount === 1 ? "módulo ativo" : "módulos ativos"} · adicione recursos ao seu plano
            </p>
          </div>
        </div>

        {/* Filtros de categoria */}
        <div className="flex flex-wrap gap-2 mb-5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                category === cat
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Cards */}
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

      {showUpgrade && (
        <UpgradeModal currentPlan={plan} onClose={() => setShowUpgrade(false)} />
      )}
    </div>
  );
}
