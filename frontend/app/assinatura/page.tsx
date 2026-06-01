"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";
import {
  Check, Zap, Crown, Star, Lock, Unlock, Loader2,
  Package, DollarSign, FlaskConical, BookOpen, Bike,
  BarChart2, Brain, Gift, CreditCard, Shield,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Plan = "BASIC" | "PRO" | "ENTERPRISE";

interface Subscription {
  plan:               Plan;
  subscriptionStatus: string;
  dueDate:            string | null;
  modules:            { moduleSlug: string; status: string; active: boolean }[];
}

// ─── Plan config ──────────────────────────────────────────────────────────────

const PLAN_ORDER: Plan[] = ["BASIC", "PRO", "ENTERPRISE"];

const PLAN_CONFIG: Record<Plan, {
  label:    string;
  icon:     React.ReactNode;
  color:    string;
  border:   string;
  bg:       string;
  price:    string;
  tagline:  string;
  features: string[];
}> = {
  BASIC: {
    label:   "Basic",
    icon:    <Package size={20} />,
    color:   "text-slate-600",
    border:  "border-slate-300",
    bg:      "bg-slate-50",
    price:   "Gratuito",
    tagline: "Para começar com o essencial",
    features: [
      "PDV / Caixa",
      "Pedidos",
      "Produtos & Categorias",
      "Complementos",
      "Estoque",
    ],
  },
  PRO: {
    label:   "Pro",
    icon:    <Star size={20} />,
    color:   "text-blue-600",
    border:  "border-blue-400",
    bg:      "bg-blue-50",
    price:   "R$ 79/mês",
    tagline: "Para operações em crescimento",
    features: [
      "Tudo do Basic",
      "Financeiro completo",
      "Receitas & Fichas técnicas",
      "Ingredientes",
      "QR Code de Mesas",
      "Entregadores & Delivery",
    ],
  },
  ENTERPRISE: {
    label:   "Enterprise",
    icon:    <Crown size={20} />,
    color:   "text-amber-600",
    border:  "border-amber-400",
    bg:      "bg-amber-50",
    price:   "R$ 149/mês",
    tagline: "Tudo liberado, sem limites",
    features: [
      "Tudo do Pro",
      "BI & Relatórios Avançados",
      "IA & Chatbot",
      "WhatsApp IA",
      "Fidelidade & Cashback",
      "Integrações Premium",
      "Suporte prioritário",
    ],
  },
};

// ─── Módulos avulsos (disponíveis em qualquer plano) ─────────────────────────

const ADDON_MODULES = [
  { slug: "FINANCIAL",  label: "Financeiro",       icon: <DollarSign size={15} />,  price: "R$ 29/mês" },
  { slug: "RECIPES",    label: "Receitas",          icon: <FlaskConical size={15} />, price: "R$ 19/mês" },
  { slug: "DELIVERY",   label: "Delivery",          icon: <Bike size={15} />,         price: "R$ 29/mês" },
  { slug: "BI",         label: "BI / Relatórios",   icon: <BarChart2 size={15} />,    price: "R$ 29/mês" },
  { slug: "AI",         label: "IA Assistente",     icon: <Brain size={15} />,        price: "R$ 49/mês" },
  { slug: "LOYALTY",    label: "Fidelidade",        icon: <Gift size={15} />,         price: "R$ 19/mês" },
];

// Quais slugs o plano inclui nativamente (sem módulo avulso)
const PLAN_INCLUDES: Record<Plan, string[]> = {
  BASIC:      [],
  PRO:        ["FINANCIAL", "RECIPES", "DELIVERY"],
  ENTERPRISE: ["FINANCIAL", "RECIPES", "DELIVERY", "BI", "AI", "LOYALTY"],
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssinaturaPage() {
  const { user } = useAuthStore();
  const companyId  = user?.companyId ?? "";
  /** Somente SUPER_ADMIN pode alterar plano e módulos */
  const canEdit    = user?.role === "SUPER_ADMIN";

  const [sub,      setSub]      = useState<Subscription | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!companyId) return;
    load();
  }, [companyId]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<Subscription>(`/company/${companyId}/subscription`);
      // Normalize: planos legados (ex: 'DELIVERY') viram 'BASIC'
      const validPlans: Plan[] = ["BASIC", "PRO", "ENTERPRISE"];
      const plan = validPlans.includes(data.plan as Plan) ? data.plan : "BASIC";
      setSub({ ...data, plan });
    } catch {
      toast.error("Erro ao carregar assinatura");
    } finally {
      setLoading(false);
    }
  }

  async function upgradePlan(plan: Plan) {
    if (!canEdit) { toast.error("Apenas Super Admin pode alterar o plano."); return; }
    setBusy((b) => ({ ...b, [`plan-${plan}`]: true }));
    try {
      await api.patch(`/company/${companyId}/plan`, { plan });
      toast.success(`Migrado para o plano ${PLAN_CONFIG[plan].label}!`);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao atualizar plano");
    } finally {
      setBusy((b) => ({ ...b, [`plan-${plan}`]: false }));
    }
  }

  async function toggleModule(slug: string, currentlyActive: boolean) {
    if (!canEdit) { toast.error("Apenas Super Admin pode ativar/desativar módulos."); return; }
    setBusy((b) => ({ ...b, [slug]: true }));
    try {
      if (currentlyActive) {
        await api.delete(`/company-module/${companyId}/${slug.toLowerCase()}`);
        toast.success("Módulo desativado");
      } else {
        await api.post("/company-module/activate", { companyId, moduleSlug: slug.toLowerCase() });
        toast.success("Módulo ativado!");
      }
      load();
    } catch {
      toast.error("Erro ao alterar módulo");
    } finally {
      setBusy((b) => ({ ...b, [slug]: false }));
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function isModuleActive(slug: string): boolean {
    if (!sub) return false;
    // Plano inclui nativamente
    if (PLAN_INCLUDES[sub.plan].includes(slug)) return true;
    // Módulo avulso ativo
    return sub.modules.some(
      (m) =>
        (m.moduleSlug.toUpperCase() === slug || m.moduleSlug.toLowerCase() === slug.toLowerCase()) &&
        (m.status === "ACTIVE" || m.status === "TRIAL" || m.active),
    );
  }

  function isAddonIncludedByPlan(slug: string): boolean {
    return sub ? PLAN_INCLUDES[sub.plan].includes(slug) : false;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!sub) return null;

  const currentIdx = PLAN_ORDER.indexOf(sub.plan);

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-900">Assinatura</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie seu plano e módulos avulsos</p>
          {!canEdit && (
            <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
              <Shield size={11} /> Visualização — apenas Super Admin pode alterar plano e módulos
            </span>
          )}
        </div>

        {/* Plano atual */}
        <div className={`rounded-2xl border-2 p-5 mb-8 ${PLAN_CONFIG[sub.plan].border} ${PLAN_CONFIG[sub.plan].bg}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm ${PLAN_CONFIG[sub.plan].color}`}>
                {PLAN_CONFIG[sub.plan].icon}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Plano atual</p>
                <p className={`text-xl font-black ${PLAN_CONFIG[sub.plan].color}`}>
                  {PLAN_CONFIG[sub.plan].label}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                sub.subscriptionStatus === "ACTIVE"
                  ? "bg-green-100 text-green-700 border-green-200"
                  : "bg-red-100 text-red-600 border-red-200"
              }`}>
                {sub.subscriptionStatus === "ACTIVE" ? "Ativo" : sub.subscriptionStatus}
              </span>
              {sub.dueDate && (
                <span className="text-xs text-gray-500">
                  Vence: {new Date(sub.dueDate).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Cards de plano */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {PLAN_ORDER.map((plan, idx) => {
            const cfg        = PLAN_CONFIG[plan];
            const isCurrent  = sub.plan === plan;
            const isUpgrade  = idx > currentIdx;
            const isDowngrade= idx < currentIdx;
            const isBusy     = !!busy[`plan-${plan}`];

            return (
              <div
                key={plan}
                className={`rounded-2xl border-2 p-5 flex flex-col transition-shadow ${
                  isCurrent
                    ? `${cfg.border} ${cfg.bg} shadow-md`
                    : "border-gray-200 bg-white hover:shadow-sm"
                }`}
              >
                {/* Plan header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isCurrent ? `${cfg.bg} ${cfg.color}` : "bg-gray-100 text-gray-500"}`}>
                    {cfg.icon}
                  </div>
                  <div>
                    <h3 className={`font-black text-base ${isCurrent ? cfg.color : "text-gray-700"}`}>
                      {cfg.label}
                    </h3>
                    <p className="text-xs text-gray-400">{cfg.tagline}</p>
                  </div>
                </div>

                <p className="font-black text-lg text-gray-900 mb-4">{cfg.price}</p>

                <ul className="space-y-1.5 flex-1 mb-5">
                  {cfg.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                      <Check size={13} className={isCurrent ? "text-green-500" : "text-gray-300"} />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className={`text-center text-xs font-black py-2 rounded-xl ${cfg.color} ${cfg.bg}`}>
                    Plano atual
                  </div>
                ) : isUpgrade ? (
                  <button
                    onClick={() => upgradePlan(plan)}
                    disabled={isBusy}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2 ${
                      plan === "ENTERPRISE"
                        ? "bg-amber-500 hover:bg-amber-600"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                    Migrar para {cfg.label}
                  </button>
                ) : (
                  <button
                    onClick={() => upgradePlan(plan)}
                    disabled={isBusy}
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-gray-500 border border-gray-200 bg-gray-50 hover:bg-gray-100 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isBusy ? <Loader2 size={14} className="animate-spin" /> : null}
                    Migrar para {cfg.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Módulos Avulsos */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-black text-gray-900">Módulos Avulsos</h2>
            <span className="text-xs text-gray-400 font-medium">— ativáveis em qualquer plano</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ADDON_MODULES.map(({ slug, label, icon, price }) => {
              const active        = isModuleActive(slug);
              const includedByPlan= isAddonIncludedByPlan(slug);
              const isBusy        = !!busy[slug];

              return (
                <div
                  key={slug}
                  className={`rounded-xl border p-4 flex items-center gap-3 transition ${
                    active ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    active ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                  }`}>
                    {icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900">{label}</p>
                    <p className="text-xs text-gray-400">
                      {includedByPlan ? "Incluído no plano" : price}
                    </p>
                  </div>

                  {includedByPlan ? (
                    <div className="flex items-center gap-1.5 text-green-600 text-xs font-bold shrink-0">
                      <Shield size={13} /> Incluído
                    </div>
                  ) : (
                    <button
                      onClick={() => toggleModule(slug, active)}
                      disabled={isBusy}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50 ${
                        active
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {isBusy ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : active ? (
                        <><Unlock size={12} /> Ativo</>
                      ) : (
                        <><Lock size={12} /> Ativar</>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
          <CreditCard size={16} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed">
            Ao migrar de plano, todos os seus dados, pedidos e módulos avulsos permanecem intactos.
            O upgrade é instantâneo e não exclui nenhuma configuração existente.
          </p>
        </div>

      </div>
    </main>
  );
}
