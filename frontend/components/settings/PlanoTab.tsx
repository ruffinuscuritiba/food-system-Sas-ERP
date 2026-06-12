"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Star, Loader2, CheckCircle2, Clock, XCircle, Zap,
  ArrowUpCircle, MessageCircle, Package, RefreshCw, Sparkles,
  Monitor, Bike, Receipt, ChefHat, Building2,
  BarChart3, TrendingUp, Ticket, DollarSign, FileText,
  ClipboardList, Bot, ShoppingBag, Car, Rocket, Link2, BarChart2,
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

// ── Mapas de ícones e cores ───────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  "🖥️": <Monitor size={20} />, "🛵": <Bike size={20} />, "🧾": <Receipt size={20} />,
  "📦": <Package size={20} />, "👨‍🍳": <ChefHat size={20} />, "🏢": <Building2 size={20} />,
  "📊": <BarChart3 size={20} />, "📈": <TrendingUp size={20} />, "⭐": <Star size={20} />,
  "🎟️": <Ticket size={20} />, "💬": <MessageCircle size={20} />, "🔄": <RefreshCw size={20} />,
  "💰": <DollarSign size={20} />, "💹": <BarChart2 size={20} />, "📑": <FileText size={20} />,
  "⚡": <Zap size={20} />, "📋": <ClipboardList size={20} />, "🤖": <Bot size={20} />,
  "🍔": <ShoppingBag size={20} />, "🛺": <Car size={20} />, "🚀": <Rocket size={20} />,
  "🔗": <Link2 size={20} />,
};

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

function formatCurrency(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
      {/* Gradiente de fundo */}
      <div className={`absolute inset-0 bg-gradient-to-br ${pc.accent} opacity-90`} />

      {/* Conteúdo */}
      <div className="relative p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Star size={16} className="fill-white/80 text-white/80" />
              <span className="text-xs font-semibold tracking-wide uppercase opacity-80">Plano atual</span>
            </div>
            <h3 className="text-3xl font-black tracking-tight">
              {pp?.label ?? plan}
            </h3>
            {pp?.tagline && (
              <p className="text-white/70 text-sm mt-0.5">{pp.tagline}</p>
            )}
          </div>

          {/* Status badge */}
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${sc.cls}`}>
            {sc.label}
          </span>
        </div>

        {/* Preço e vencimento */}
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <p className="text-white/60 text-[10px] uppercase font-semibold tracking-wide">Valor mensal</p>
            <p className="text-2xl font-bold mt-0.5">
              {pp ? formatCurrency(pp.price) : "—"}
            </p>
          </div>
          <div>
            <p className="text-white/60 text-[10px] uppercase font-semibold tracking-wide">Próxima renovação</p>
            <p className="text-sm font-semibold mt-1">{formatDate(data.dueDate)}</p>
          </div>
        </div>

        {/* Botões */}
        <div className="mt-5 flex gap-2 flex-wrap">
          {plan !== "ENTERPRISE" && (
            <button
              onClick={onUpgrade}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-gray-900 text-xs font-bold hover:bg-white/90 transition-colors"
            >
              <ArrowUpCircle size={13} />
              Fazer Upgrade
            </button>
          )}
          <a
            href="https://wa.me/554188888888?text=Olá, preciso de ajuda com meu plano FoodSaaS"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20 text-white text-xs font-semibold hover:bg-white/30 transition-colors border border-white/30"
          >
            <MessageCircle size={13} />
            Falar com suporte
          </a>
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
  const [loading, setLoading] = useState<string | null>(null);
  const cat  = CATEGORY_CONFIG[mod.category] ?? CATEGORY_CONFIG.OPERACAO;
  const icon = ICON_MAP[mod.icon] ?? <Package size={20} />;
  const sc   = STATUS_CONFIG[mod.status];
  const isOn = mod.status === "ACTIVE" || mod.status === "TRIAL";

  async function handleAction(action: "trial" | "activate" | "deactivate") {
    setLoading(action);
    try {
      if (action === "trial") {
        await api.post("/company-module/trial", { companyId, moduleSlug: mod.slug });
        toast.success("Trial de 14 dias ativado!");
      } else if (action === "activate") {
        await api.post("/company-module/activate", { companyId, moduleSlug: mod.slug });
        toast.success("Módulo ativado!");
      } else {
        await api.delete(`/company-module/${companyId}/${mod.slug}`);
        toast.success("Módulo desativado.");
      }
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Erro ao alterar módulo");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className={`relative bg-white dark:bg-gray-900 rounded-xl border transition-all ${
      isOn
        ? "border-orange-200 dark:border-orange-800 shadow-sm"
        : "border-gray-200 dark:border-gray-800"
    }`}>
      {/* Destaque */}
      {mod.isHighlighted && !isOn && (
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
            {icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{mod.name}</p>
              {/* Status badge */}
              {sc.label && (
                <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${sc.cls}`}>
                  {sc.icon}
                  {sc.label}
                </span>
              )}
            </div>

            {/* Categoria */}
            <span className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${cat.bg} ${cat.color}`}>
              {cat.label}
            </span>
          </div>
        </div>

        {/* Descrição */}
        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed mb-3 line-clamp-2">
          {mod.description}
        </p>

        {/* Preço */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
            {mod.isFree ? "Gratuito" : mod.price ? formatCurrency(mod.price) + "/mês" : "Consultar"}
          </p>
          {mod.badge && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              {mod.badge}
            </span>
          )}
        </div>

        {/* Botões de ação */}
        <div className="flex gap-1.5">
          {mod.status === "INACTIVE" && (
            <>
              {!mod.isFree && (
                <button
                  onClick={() => handleAction("trial")}
                  disabled={!!loading}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 text-[10px] font-semibold hover:bg-orange-50 dark:hover:bg-orange-950/30 disabled:opacity-50 transition-colors"
                >
                  {loading === "trial" ? <Loader2 size={10} className="animate-spin" /> : <Clock size={10} />}
                  Trial 14d
                </button>
              )}
              <button
                onClick={() => handleAction("activate")}
                disabled={!!loading}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-orange-500 text-white text-[10px] font-bold hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {loading === "activate" ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                {mod.isFree ? "Ativar" : "Contratar"}
              </button>
            </>
          )}

          {mod.status === "TRIAL" && (
            <>
              <button
                onClick={() => handleAction("activate")}
                disabled={!!loading}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-orange-500 text-white text-[10px] font-bold hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {loading === "activate" ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                Contratar
              </button>
              <button
                onClick={() => handleAction("deactivate")}
                disabled={!!loading}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 text-[10px] hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {loading === "deactivate" ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />}
                Cancelar trial
              </button>
            </>
          )}

          {mod.status === "ACTIVE" && (
            <button
              onClick={() => handleAction("deactivate")}
              disabled={!!loading}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 text-[10px] hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {loading === "deactivate" ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />}
              Desativar
            </button>
          )}

          {mod.status === "EXPIRED" && (
            <button
              onClick={() => handleAction("activate")}
              disabled={!!loading}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-orange-500 text-white text-[10px] font-bold hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {loading === "activate" ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
              Reativar
            </button>
          )}
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
              const pc  = PLAN_COLORS[p];
              const pp  = data.planPrices?.[p];
              return (
                <div key={p} className={`rounded-xl p-4 bg-gradient-to-r ${pc.accent} text-white`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">{pp?.label ?? p}</span>
                    <span className="text-xs font-bold">{pp ? formatCurrency(pp.price) + "/mês" : "Consultar"}</span>
                  </div>
                  <p className="text-white/70 text-[11px] mb-3">{pp?.tagline ?? ""}</p>
                  <a
                    href={`https://wa.me/554188888888?text=Quero fazer upgrade para o plano ${p}`}
                    target="_blank"
                    rel="noopener noreferrer"
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
      : modules.filter((m) => m.category === activeCategory);

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
      {/* ── Seção 1: Plano atual ───────────────────────────────────────── */}
      {subData && (
        <PlanCard data={subData} onUpgrade={() => setShowUpgrade(true)} />
      )}

      {/* ── Seção 2: Módulos ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Módulos disponíveis
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {activeCount} {activeCount === 1 ? "módulo ativo" : "módulos ativos"} · Ative trial gratuito de 14 dias em módulos pagos
            </p>
          </div>
        </div>

        {/* Filtros de categoria */}
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
              <ModuleCard
                key={mod.slug}
                mod={mod}
                companyId={companyId}
                onRefresh={load}
              />
            ))}
          </div>
        )}
      </section>

      {/* Modal de upgrade */}
      {showUpgrade && subData && (
        <UpgradeModal data={subData} onClose={() => setShowUpgrade(false)} />
      )}
    </div>
  );
}
