"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { api } from "@/services/api";
import {
  Monitor, Bike, Receipt, Package, ChefHat, Building2,
  BarChart3, TrendingUp, Star, Ticket, MessageCircle, RefreshCw,
  DollarSign, BarChart2, FileText, Zap, ClipboardList,
  Bot, ShoppingBag, Car, Rocket, Link2,
  CheckCircle2, Clock, XCircle, ArrowLeft, Sparkles,
} from "lucide-react";

type ModuleStatus = "ACTIVE" | "TRIAL" | "INACTIVE" | "EXPIRED";
type ModuleCategory = "OPERACAO" | "MARKETING" | "FINANCEIRO" | "AUTOMACAO";

interface ModuleItem {
  id: string;
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

const ICON_MAP: Record<string, React.ReactNode> = {
  "🖥️": <Monitor size={22} />, "🛵": <Bike size={22} />, "🧾": <Receipt size={22} />,
  "📦": <Package size={22} />, "👨‍🍳": <ChefHat size={22} />, "🏢": <Building2 size={22} />,
  "📊": <BarChart3 size={22} />, "📈": <TrendingUp size={22} />, "⭐": <Star size={22} />,
  "🎟️": <Ticket size={22} />, "💬": <MessageCircle size={22} />, "🔄": <RefreshCw size={22} />,
  "💰": <DollarSign size={22} />, "💹": <BarChart2 size={22} />, "📑": <FileText size={22} />,
  "⚡": <Zap size={22} />, "📋": <ClipboardList size={22} />, "🤖": <Bot size={22} />,
  "🍔": <ShoppingBag size={22} />, "🛺": <Car size={22} />, "🚀": <Rocket size={22} />,
  "🔗": <Link2 size={22} />,
};

const CATEGORY_CONFIG: Record<ModuleCategory, { label: string; color: string; bg: string; border: string }> = {
  OPERACAO:   { label: "Operação",   color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30" },
  MARKETING:  { label: "Marketing",  color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/30" },
  FINANCEIRO: { label: "Financeiro", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  AUTOMACAO:  { label: "Automação",  color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30" },
};

const BADGE_COLOR: Record<string, string> = {
  green:  "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  red:    "bg-red-500/20 text-red-400 border-red-500/30",
  blue:   "bg-blue-500/20 text-blue-400 border-blue-500/30",
  purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const STATUS_CONFIG: Record<ModuleStatus, { label: string; icon: React.ReactNode; cls: string }> = {
  ACTIVE:   { label: "Ativo",          icon: <CheckCircle2 size={13} />, cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  TRIAL:    { label: "Trial ativo",    icon: <Clock size={13} />,        cls: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" },
  EXPIRED:  { label: "Trial expirado", icon: <XCircle size={13} />,      cls: "text-red-400 bg-red-500/10 border-red-500/30" },
  INACTIVE: { label: "",               icon: null,                        cls: "" },
};

const CATEGORIES: Array<ModuleCategory | "TODOS"> = ["TODOS", "OPERACAO", "MARKETING", "FINANCEIRO", "AUTOMACAO"];

export default function PlanosPage() {
  const router = useRouter();
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<ModuleCategory | "TODOS">("TODOS");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string>("");

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) { router.push("/login"); return; }
    const user = JSON.parse(userStr);
    setCompanyId(user.companyId);
    loadModules(user.companyId);
  }, []);

  async function loadModules(cid: string) {
    try {
      const res = await api.get(`/company-module/company/${cid}`);
      setModules(res.data);
    } catch {
      toast.error("Erro ao carregar módulos.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTrial(slug: string) {
    setActionLoading(slug + "-trial");
    try {
      await api.post("/company-module/trial", { companyId, moduleSlug: slug });
      toast.success("Trial de 14 dias ativado! Explore à vontade.");
      await loadModules(companyId);
    } catch { toast.error("Erro ao iniciar trial."); }
    finally { setActionLoading(null); }
  }

  async function handleActivate(slug: string) {
    setActionLoading(slug + "-activate");
    try {
      await api.post("/company-module/activate", { companyId, moduleSlug: slug });
      toast.success("Módulo ativado com sucesso!");
      await loadModules(companyId);
    } catch { toast.error("Erro ao ativar módulo."); }
    finally { setActionLoading(null); }
  }

  async function handleDeactivate(slug: string) {
    setActionLoading(slug + "-deactivate");
    try {
      await api.delete(`/company-module/${companyId}/${slug}`);
      toast.success("Módulo desativado.");
      await loadModules(companyId);
    } catch { toast.error("Erro ao desativar módulo."); }
    finally { setActionLoading(null); }
  }

  const filtered = activeCategory === "TODOS"
    ? modules
    : modules.filter((m) => m.category === activeCategory);

  const activeCount = modules.filter((m) => m.status === "ACTIVE" || m.status === "TRIAL").length;
  const trialCount  = modules.filter((m) => m.status === "TRIAL").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Carregando módulos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Toaster position="top-right" toastOptions={{ style: { background: "#1e293b", color: "#fff", border: "1px solid #334155" } }} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg hover:bg-slate-800 transition text-slate-400 hover:text-white">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Sparkles size={20} className="text-orange-400" /> Módulos & Expansões
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Expanda seu sistema conforme seu negócio cresce</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-400">{activeCount}</p>
                <p className="text-xs text-slate-500">módulos ativos</p>
              </div>
              {trialCount > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-400">{trialCount}</p>
                  <p className="text-xs text-slate-500">em trial</p>
                </div>
              )}
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-300">{modules.length}</p>
                <p className="text-xs text-slate-500">disponíveis</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* ── Hero Banner ────────────────────────────────────────────────────── */}
        <div className="mb-8 rounded-2xl bg-gradient-to-r from-orange-500/20 via-orange-500/10 to-transparent border border-orange-500/20 p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-1">Seu sistema, do seu jeito</h2>
              <p className="text-slate-400 text-sm max-w-xl">
                Ative apenas o que você precisa. Cada módulo foi criado para resolver um problema real do seu negócio — sem complicação, sem contrato longo.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-xl bg-slate-800/60 border border-slate-700 px-4 py-3 text-center min-w-[80px]">
                <p className="text-lg font-bold text-emerald-400">14</p>
                <p className="text-xs text-slate-500">dias grátis</p>
              </div>
              <div className="rounded-xl bg-slate-800/60 border border-slate-700 px-4 py-3 text-center min-w-[80px]">
                <p className="text-lg font-bold text-orange-400">Cancele</p>
                <p className="text-xs text-slate-500">a qualquer hora</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Category Filter ────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat;
            const cfg = cat !== "TODOS" ? CATEGORY_CONFIG[cat] : null;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  active
                    ? cat === "TODOS"
                      ? "bg-orange-500 border-orange-500 text-white"
                      : `${cfg?.bg} ${cfg?.border} ${cfg?.color}`
                    : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                }`}
              >
                {cat === "TODOS" ? "Todos os módulos" : cfg?.label}
                {cat !== "TODOS" && (
                  <span className="ml-2 text-xs opacity-60">
                    {modules.filter((m) => m.category === cat).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Module Grid ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((mod) => {
            const catCfg = CATEGORY_CONFIG[mod.category];
            const statusCfg = STATUS_CONFIG[mod.status];
            const isActive = mod.status === "ACTIVE";
            const isTrial  = mod.status === "TRIAL";
            const isLoading = (s: string) => actionLoading === mod.slug + "-" + s;

            return (
              <div
                key={mod.id}
                className={`relative rounded-2xl border bg-slate-900 flex flex-col transition-all duration-200 hover:translate-y-[-2px] hover:shadow-xl hover:shadow-black/30 ${
                  isActive ? "border-emerald-500/40 shadow-emerald-500/5 shadow-lg" :
                  isTrial  ? "border-yellow-500/30" :
                  mod.isHighlighted ? "border-slate-600" : "border-slate-800"
                }`}
              >
                {/* Highlighted glow */}
                {mod.isHighlighted && !isActive && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-orange-500/5 to-transparent pointer-events-none" />
                )}

                <div className="p-5 flex flex-col flex-1">
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${catCfg.bg} ${catCfg.color} border ${catCfg.border} text-lg`}>
                      {ICON_MAP[mod.icon] ?? mod.icon}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {mod.badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${BADGE_COLOR[mod.badgeColor ?? "blue"] ?? BADGE_COLOR.blue}`}>
                          {mod.badge.toUpperCase()}
                        </span>
                      )}
                      {mod.status !== "INACTIVE" && (
                        <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusCfg.cls}`}>
                          {statusCfg.icon} {statusCfg.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Name + description */}
                  <h3 className="font-bold text-base mb-1.5">{mod.name}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-4">{mod.description}</p>

                  {/* Benefits */}
                  <ul className="space-y-1.5 mb-5 flex-1">
                    {mod.benefits.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-xs text-slate-300">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${catCfg.color.replace("text-", "bg-")}`} />
                        {b}
                      </li>
                    ))}
                  </ul>

                  {/* Trial ends info */}
                  {isTrial && mod.trialEndsAt && (
                    <p className="text-xs text-yellow-400/70 mb-3 flex items-center gap-1">
                      <Clock size={11} />
                      Trial até {new Date(mod.trialEndsAt).toLocaleDateString("pt-BR")}
                    </p>
                  )}

                  {/* Price + CTAs */}
                  <div className="border-t border-slate-800 pt-4 mt-auto">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        {mod.isFree ? (
                          <span className="text-emerald-400 font-bold text-sm">Incluso no plano</span>
                        ) : (
                          <div>
                            <span className="text-white font-bold">
                              R$ {(mod.price ?? 0).toFixed(2).replace(".", ",")}
                            </span>
                            <span className="text-slate-500 text-xs">/mês</span>
                          </div>
                        )}
                      </div>
                      {isActive && (
                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Ativo
                        </span>
                      )}
                    </div>

                    {isActive ? (
                      <button
                        onClick={() => handleDeactivate(mod.slug)}
                        disabled={!!isLoading("deactivate")}
                        className="w-full py-2.5 rounded-xl border border-slate-700 text-slate-400 text-sm hover:border-red-500/50 hover:text-red-400 transition disabled:opacity-50"
                      >
                        {isLoading("deactivate") ? "Desativando..." : "Desativar módulo"}
                      </button>
                    ) : isTrial ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleActivate(mod.slug)}
                          disabled={!!isLoading("activate")}
                          className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition disabled:opacity-50"
                        >
                          {isLoading("activate") ? "Ativando..." : "Ativar agora"}
                        </button>
                        <button
                          onClick={() => handleDeactivate(mod.slug)}
                          disabled={!!isLoading("deactivate")}
                          className="px-3 py-2.5 rounded-xl border border-slate-700 text-slate-500 text-sm hover:text-red-400 transition disabled:opacity-50"
                        >
                          ✕
                        </button>
                      </div>
                    ) : mod.isFree ? (
                      <button
                        onClick={() => handleActivate(mod.slug)}
                        disabled={!!isLoading("activate")}
                        className="w-full py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-bold hover:bg-emerald-500/30 transition disabled:opacity-50"
                      >
                        {isLoading("activate") ? "Ativando..." : "Ativar grátis"}
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleTrial(mod.slug)}
                          disabled={!!isLoading("trial")}
                          className="flex-1 py-2.5 rounded-xl border border-orange-500/40 text-orange-400 text-sm font-semibold hover:bg-orange-500/10 transition disabled:opacity-50"
                        >
                          {isLoading("trial") ? "..." : "Testar 14 dias"}
                        </button>
                        <button
                          onClick={() => handleActivate(mod.slug)}
                          disabled={!!isLoading("activate")}
                          className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition disabled:opacity-50"
                        >
                          {isLoading("activate") ? "..." : "Ativar"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 text-slate-500">
            <p className="text-4xl mb-3">🔍</p>
            <p>Nenhum módulo encontrado nessa categoria.</p>
          </div>
        )}

        {/* ── Footer note ─────────────────────────────────────────────────── */}
        <p className="text-center text-xs text-slate-600 mt-12">
          Todos os módulos incluem suporte técnico. Cancele a qualquer momento sem burocracia.
        </p>
      </div>
    </div>
  );
}
