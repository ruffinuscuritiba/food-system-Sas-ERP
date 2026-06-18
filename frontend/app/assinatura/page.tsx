"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { SUPPORT_WHATSAPP } from "@/config/support";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";
import {
  Check, Zap, Crown, Star, Lock, Unlock, Loader2,
  Package, DollarSign, FlaskConical, BookOpen, Bike,
  BarChart2, Brain, Gift, CreditCard, Shield, X,
  Info, ChevronRight, MessageCircle, ArrowRight, UtensilsCrossed, ShieldCheck, LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";

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

// ─── Checkout gate plan cards (used when PENDING_PAYMENT) ─────────────────────
const CHECKOUT_PLANS = [
  {
    plan: "BASIC", label: "Básico", price: 97, color: "#16a34a", popular: false,
    features: ["PDV completo", "Pedidos e cozinha", "Mesas e comanda", "Cardápio digital", "Estoque básico"],
  },
  {
    plan: "DELIVERY", label: "Profissional", price: 197, color: "#2563eb", popular: true,
    features: ["Tudo do Básico", "Delivery com entregadores", "WhatsApp IA 24h", "Cupons e fidelidade", "Relatórios avançados"],
  },
  {
    plan: "ENTERPRISE", label: "Enterprise", price: 397, color: "#7c3aed", popular: false,
    features: ["Tudo do Profissional", "Múltiplas unidades", "White label", "BI avançado", "Suporte prioritário"],
  },
];

export default function AssinaturaPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const companyId  = user?.companyId ?? "";
  const canEdit    = user?.role === "SUPER_ADMIN";
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const [sub,             setSub]             = useState<Subscription | null>(null);
  const [catalog,         setCatalog]         = useState<CatalogModule[]>([]);
  const [selectedModule,  setSelectedModule]  = useState<CatalogModule | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [busy,            setBusy]            = useState<Record<string, boolean>>({});
  const [companyName,     setCompanyName]     = useState<string>("");

  useEffect(() => {
    if (!companyId) return;
    load();
  }, [companyId]);

  async function load() {
    setLoading(true);
    try {
      const [subRes, catRes, companyRes] = await Promise.all([
        api.get<Subscription>(`/company/${companyId}/subscription`),
        api.get<CatalogModule[]>("/company-module/catalog").catch(() => ({ data: [] })),
        api.get<{ name: string }>(`/company/${companyId}`).catch(() => ({ data: { name: "" } })),
      ]);
      const validPlans: Plan[] = ["BASIC", "PRO", "ENTERPRISE"];
      const plan = validPlans.includes(subRes.data.plan as Plan) ? subRes.data.plan : "BASIC";
      setSub({ ...subRes.data, plan });
      setCatalog(Array.isArray(catRes.data) ? catRes.data : []);
      setCompanyName(companyRes.data?.name || companyId);
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

  function buildWaUrl(moduleName: string): string {
    const msg = `Olá, sou da empresa ${companyName}.\n\nGostaria de ativar o módulo:\n\n• ${moduleName}\n\nAguardo contato.`;
    return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(msg)}`;
  }

  async function handleCheckout(plan: string) {
    if (!companyId) { toast.error("Sessão expirada — faça login novamente."); return; }
    setCheckoutLoading(plan);
    try {
      const { data } = await api.post("/payments/checkout", {
        companyId,
        plan,
        provider: "MERCADO_PAGO",
      });
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.error("Não foi possível gerar o link de pagamento.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao criar checkout.");
    } finally {
      setCheckoutLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!sub) return null;

  // ── Checkout gate — shown for new companies that haven't paid yet ──────────
  if (sub.subscriptionStatus === "PENDING_PAYMENT") {
    const supportUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent("Olá! Acabei de criar minha conta no FoodSaaS ERP e gostaria de ajuda para escolher o plano certo.")}`;
    return (
      <div className="min-h-screen bg-[#07090f] text-white">
        {/* glows */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-60 left-1/3 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-blue-600/8 blur-[180px]" />
          <div className="absolute top-1/2 -right-40 h-[400px] w-[600px] rounded-full bg-violet-600/8 blur-[160px]" />
        </div>

        <div className="relative z-10">
          {/* header */}
          <header className="sticky top-0 z-50 border-b border-white/5 bg-[#07090f]/80 backdrop-blur-xl">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-orange-500/15 p-2 ring-1 ring-orange-500/30">
                  <UtensilsCrossed className="h-4 w-4 text-orange-400" />
                </div>
                <span className="text-base font-black tracking-tight">FoodSaaS ERP</span>
              </div>
              <div className="flex items-center gap-2">
                <a href={supportUrl} target="_blank" rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10">
                  <MessageCircle className="h-3.5 w-3.5" />Falar com consultor
                </a>
                <button onClick={() => logout()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/60 transition hover:text-white/90">
                  <LogOut className="h-3.5 w-3.5" /><span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            </div>
          </header>

          {/* hero */}
          <section className="mx-auto max-w-5xl px-5 pb-10 pt-16 text-center sm:px-8 sm:pt-20">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-orange-400">
              <Zap className="h-3 w-3" /> Conta criada com sucesso!
            </span>
            <h1 className="mx-auto mt-6 max-w-2xl text-4xl font-black leading-[1.1] tracking-tight sm:text-5xl">
              Escolha o plano{" "}
              <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">perfeito</span>{" "}
              para o seu negócio
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/50">
              Pagamento seguro pelo Mercado Pago. Cancele quando quiser.
            </p>
          </section>

          {/* plan cards */}
          <section className="mx-auto max-w-5xl px-5 pb-20 sm:px-8">
            <div className="grid gap-6 md:grid-cols-3">
              {CHECKOUT_PLANS.map((p) => (
                <article
                  key={p.plan}
                  className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0b0e18] transition-all duration-300 hover:-translate-y-1"
                  style={{ boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 24px 60px -20px ${p.color}33` }}
                >
                  {p.popular && (
                    <div className="absolute top-0 inset-x-0 py-1.5 text-center text-[10px] font-black uppercase tracking-widest" style={{ backgroundColor: p.color }}>
                      Mais popular
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-20" style={{ background: `radial-gradient(ellipse at 50% 0%, ${p.color}88, transparent 70%)` }} aria-hidden />
                  <div className={`relative flex flex-1 flex-col p-7 ${p.popular ? "pt-10" : ""}`}>
                    <span className="inline-block self-start rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: p.color, backgroundColor: `${p.color}22`, border: `1px solid ${p.color}44` }}>
                      {p.label}
                    </span>
                    <div className="flex items-end gap-1 mb-6">
                      <span className="text-4xl font-black">R$ {p.price}</span>
                      <span className="text-white/35 text-sm pb-1">/mês</span>
                    </div>
                    <ul className="space-y-2.5 flex-1 mb-7">
                      {p.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5 text-sm text-white/70">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${p.color}22` }}>
                            <Check className="h-3 w-3" style={{ color: p.color }} strokeWidth={3} />
                          </span>
                          {feat}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => handleCheckout(p.plan)}
                      disabled={checkoutLoading !== null}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ backgroundColor: p.color, boxShadow: `0 8px 24px -8px ${p.color}bb, inset 0 1px 0 rgba(255,255,255,0.15)` }}
                    >
                      {checkoutLoading === p.plan ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Abrindo pagamento…</>
                      ) : (
                        <>Contratar {p.label} <ArrowRight className="h-4 w-4" /></>
                      )}
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {/* trust + consultant */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-white/35">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Pagamento seguro</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Cancele quando quiser</span>
            </div>
            <div className="mt-8 text-center">
              <p className="text-sm text-white/35 mb-3">Dúvidas sobre qual plano escolher?</p>
              <a href={supportUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/75 transition hover:bg-white/10">
                <MessageCircle className="h-4 w-4" />Falar com um consultor pelo WhatsApp
              </a>
            </div>
          </section>
        </div>
      </div>
    );
  }

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
            <div className="p-6 border-t border-gray-100 flex flex-col gap-3">
              {/* Super Admin: toggle rápido */}
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

              {/* Módulo incluído no plano */}
              {PLAN_INCLUDES[sub.plan].includes(selectedModule.slug.toUpperCase()) && (
                <div className="flex items-center justify-center gap-2 text-sm text-green-600 font-semibold py-2">
                  <Shield size={14} /> Incluído no seu plano atual
                </div>
              )}

              {/* Solicitar Ativação via WhatsApp — visível quando módulo não está ativo */}
              {!PLAN_INCLUDES[sub.plan].includes(selectedModule.slug.toUpperCase()) &&
               !isModuleActive(selectedModule.slug.toUpperCase()) && (
                <a
                  href={buildWaUrl(selectedModule.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition hover:brightness-110"
                  style={{ background: "linear-gradient(135deg,#25D366 0%,#128C7E 100%)" }}
                >
                  <MessageCircle size={16} />
                  Solicitar Ativação via WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
