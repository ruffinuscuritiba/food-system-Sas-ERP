"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";
import {
  Check, Zap, Crown, Star, Lock, Unlock, Loader2,
  Package, DollarSign, FlaskConical, BookOpen, Bike,
  BarChart2, Brain, Gift, CreditCard, Shield, X,
  Info, ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Plan = "BASIC" | "PRO" | "ENTERPRISE";

interface PlanPrice {
  price: number;
  label: string;
  tagline: string | null;
}

interface CatalogModule {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription?: string;
  category: string;
  price: number | null;
  isFree: boolean;
  benefits: string[];
  badge?: string | null;
  icon?: string;
}

interface Subscription {
  plan:               Plan;
  subscriptionStatus: string;
  dueDate:            string | null;
  modules:            { moduleSlug: string; status: string; active: boolean }[];
  planPrices?:        Record<string, PlanPrice>;
}

// ─── Plan static config (não inclui preço — vem do backend) ──────────────────

const PLAN_ORDER: Plan[] = ["BASIC", "PRO", "ENTERPRISE"];

const PLAN_STATIC: Record<Plan, {
  label: string; icon: React.ReactNode; color: string;
  border: string; bg: string; tagline: string; features: string[];
}> = {
  BASIC: {
    label:   "Basic",
    icon:    <Package size={20} />,
    color:   "text-slate-600",
    border:  "border-slate-300",
    bg:      "bg-slate-50",
    tagline: "Para começar com o essencial",
    features: ["PDV / Caixa", "Pedidos", "Produtos & Categorias", "Complementos", "Mesas"],
  },
  PRO: {
    label:   "Pro",
    icon:    <Star size={20} />,
    color:   "text-blue-600",
    border:  "border-blue-400",
    bg:      "bg-blue-50",
    tagline: "Para operações em crescimento",
    features: ["Tudo do Basic", "Financeiro completo", "Receitas & Fichas técnicas", "Ingredientes", "QR Code de Mesas", "Entregadores & Delivery"],
  },
  ENTERPRISE: {
    label:   "Enterprise",
    icon:    <Crown size={20} />,
    color:   "text-amber-600",
    border:  "border-amber-400",
    bg:      "bg-amber-50",
    tagline: "Tudo liberado, sem limites",
    features: ["Tudo do Pro", "BI & Relatórios Avançados", "IA & Chatbot", "WhatsApp IA", "Fidelidade & Cashback", "Integrações Premium", "Suporte prioritário"],
  },
};

// Preços de fallback (sobrescritos pelo backend quando disponível)
const PRICE_FALLBACK: Record<Plan, number> = { BASIC: 149, PRO: 249, ENTERPRISE: 399 };

// ─── Módulos avulsos (estáticos — preço e detalhes vêm do catálogo) ───────────

const ADDON_SLUGS = ["FINANCIAL", "RECIPES", "DELIVERY", "BI", "AI", "LOYALTY"];

const ADDON_ICON: Record<string, React.ReactNode> = {
  FINANCIAL: <DollarSign size={15} />,
  RECIPES:   <FlaskConical size={15} />,
  DELIVERY:  <Bike size={15} />,
  BI:        <BarChart2 size={15} />,
  AI:        <Brain size={15} />,
  LOYALTY:   <Gift size={15} />,
};

const PLAN_INCLUDES: Record<Plan, string[]> = {
  BASIC:      [],
  PRO:        ["FINANCIAL", "RECIPES", "DELIVERY"],
  ENTERPRISE: ["FINANCIAL", "RECIPES", "DELIVERY", "BI", "AI", "LOYALTY"],
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssinaturaPage() {
  const { user } = useAuthStore();
  const companyId  = user?.companyId ?? "";
  const canEdit    = user?.role === "SUPER_ADMIN";

  const [sub,             setSub]             = useState<Subscription | null>(null);
  const [catalog,         setCatalog]         = useState<CatalogModule[]>([]);
  const [selectedModule,  setSelectedModule]  = useState<CatalogModule | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [busy,            setBusy]            = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!companyId) return;
    load();
  }, [companyId]);

  async function load() {
    setLoading(true);
    try {
      const [subRes, catRes] = await Promise.all([
        api.get<Subscription>(`/company/${companyId}/subscription`),
        api.get<CatalogModule[]>("/company-module/catalog").catch(() => ({ data: [] })),
      ]);
      const validPlans: Plan[] = ["BASIC", "PRO", "ENTERPRISE"];
      const plan = validPlans.includes(subRes.data.plan as Plan) ? subRes.data.plan : "BASIC";
      setSub({ ...subRes.data, plan });
      setCatalog(Array.isArray(catRes.data) ? catRes.data : []);
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
      toast.success(`Migrado para o plano ${PLAN_STATIC[plan].label}!`);
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

  function planPrice(plan: Plan): string {
    const backendPrice = sub?.planPrices?.[plan]?.price;
    const price = backendPrice ?? PRICE_FALLBACK[plan];
    return `R$ ${price.toLocaleString("pt-BR")}/mês`;
  }

  function isModuleActive(slug: string): boolean {
    if (!sub) return false;
    if (PLAN_INCLUDES[sub.plan].includes(slug)) return true;
    return sub.modules.some(
      (m) => m.moduleSlug.toUpperCase() === slug && (m.status === "ACTIVE" || m.status === "TRIAL" || m.active),
    );
  }

  function modulePrice(slug: string): string {
    const fromCatalog = catalog.find((c) => c.slug.toUpperCase() === slug);
    if (fromCatalog?.isFree) return "Incluso no plano";
    if (fromCatalog?.price != null) return `R$ ${Number(fromCatalog.price).toLocaleString("pt-BR")}/mês`;
    return "Consultar";
  }

  function getCatalogModule(slug: string): CatalogModule | undefined {
    return catalog.find((c) => c.slug.toUpperCase() === slug || c.slug === slug);
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
        <div className={`rounded-2xl border-2 p-5 mb-8 ${PLAN_STATIC[sub.plan].border} ${PLAN_STATIC[sub.plan].bg}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm ${PLAN_STATIC[sub.plan].color}`}>
                {PLAN_STATIC[sub.plan].icon}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Plano atual</p>
                <p className={`text-xl font-black ${PLAN_STATIC[sub.plan].color}`}>
                  {sub.planPrices?.[sub.plan]?.label ?? PLAN_STATIC[sub.plan].label}
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
              <span className={`px-3 py-1 rounded-full text-xs font-bold border bg-gray-100 text-gray-700 border-gray-200`}>
                {planPrice(sub.plan)}
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
            const cfg        = PLAN_STATIC[plan];
            const isCurrent  = sub.plan === plan;
            const isUpgrade  = idx > currentIdx;
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
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isCurrent ? `${cfg.bg} ${cfg.color}` : "bg-gray-100 text-gray-500"}`}>
                    {cfg.icon}
                  </div>
                  <div>
                    <h3 className={`font-black text-base ${isCurrent ? cfg.color : "text-gray-700"}`}>
                      {sub.planPrices?.[plan]?.label ?? cfg.label}
                    </h3>
                    <p className="text-xs text-gray-400">
                      {sub.planPrices?.[plan]?.tagline ?? cfg.tagline}
                    </p>
                  </div>
                </div>

                <p className="font-black text-lg text-gray-900 mb-4">{planPrice(plan)}</p>

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
                    disabled={isBusy || !canEdit}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2 ${
                      plan === "ENTERPRISE" ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                    Migrar para {cfg.label}
                  </button>
                ) : (
                  <button
                    onClick={() => upgradePlan(plan)}
                    disabled={isBusy || !canEdit}
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
            <span className="text-xs text-gray-400 font-medium">— clique para ver detalhes</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ADDON_SLUGS.map((slug) => {
              const active         = isModuleActive(slug);
              const includedByPlan = PLAN_INCLUDES[sub.plan].includes(slug);
              const isBusy         = !!busy[slug];
              const catMod         = getCatalogModule(slug);
              const label          = catMod?.name ?? slug;

              return (
                <div
                  key={slug}
                  className={`rounded-xl border p-4 flex items-center gap-3 transition cursor-pointer hover:shadow-sm ${
                    active ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"
                  }`}
                  onClick={() => catMod && setSelectedModule(catMod)}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    active ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                  }`}>
                    {ADDON_ICON[slug]}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900">{label}</p>
                    <p className="text-xs text-gray-400">
                      {includedByPlan ? "Incluído no plano" : modulePrice(slug)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {includedByPlan ? (
                      <span className="flex items-center gap-1 text-green-600 text-xs font-bold">
                        <Shield size={13} /> Incluído
                      </span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleModule(slug, active); }}
                        disabled={isBusy || !canEdit}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50 ${
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
                    <ChevronRight size={14} className="text-gray-300" />
                  </div>
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

      {/* ── Modal de detalhes do módulo ────────────────────────────────────── */}
      {selectedModule && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedModule(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  {ADDON_ICON[selectedModule.slug.toUpperCase()] ?? <Package size={20} />}
                </div>
                <div>
                  <h3 className="font-black text-lg text-gray-900">{selectedModule.name}</h3>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {selectedModule.category}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedModule(null)}
                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
              >
                <X size={15} className="text-gray-500" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-gray-600 text-sm leading-relaxed mb-5">
                {selectedModule.longDescription || selectedModule.description}
              </p>

              {Array.isArray(selectedModule.benefits) && selectedModule.benefits.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">
                    O que está incluído
                  </p>
                  <ul className="space-y-2">
                    {selectedModule.benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <Check size={14} className="text-green-500 shrink-0 mt-0.5" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Preço mensal</p>
                  <p className="font-black text-lg text-gray-900">
                    {selectedModule.isFree
                      ? "Incluído no plano"
                      : selectedModule.price != null
                        ? `R$ ${Number(selectedModule.price).toLocaleString("pt-BR")}/mês`
                        : "Consultar"}
                  </p>
                </div>
                {isModuleActive(selectedModule.slug.toUpperCase()) && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 text-green-700 text-xs font-bold">
                    <Check size={12} /> Ativo
                  </span>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-6 border-t border-gray-100">
              {canEdit && !PLAN_INCLUDES[sub.plan].includes(selectedModule.slug.toUpperCase()) && (
                <button
                  onClick={() => {
                    const active = isModuleActive(selectedModule.slug.toUpperCase());
                    toggleModule(selectedModule.slug.toUpperCase(), active);
                    setSelectedModule(null);
                  }}
                  disabled={!!busy[selectedModule.slug.toUpperCase()]}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition disabled:opacity-50 ${
                    isModuleActive(selectedModule.slug.toUpperCase())
                      ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      : "bg-primary text-white hover:opacity-90"
                  }`}
                >
                  {isModuleActive(selectedModule.slug.toUpperCase()) ? "Desativar módulo" : "Ativar módulo"}
                </button>
              )}
              {PLAN_INCLUDES[sub.plan].includes(selectedModule.slug.toUpperCase()) && (
                <div className="flex items-center justify-center gap-2 text-sm text-green-600 font-semibold py-2">
                  <Shield size={14} /> Incluído no seu plano atual
                </div>
              )}
              {!canEdit && (
                <p className="text-center text-xs text-gray-400 py-2">
                  Apenas Super Admin pode ativar módulos
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
