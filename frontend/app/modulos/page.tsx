"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Search, LayoutGrid, ShoppingBag, Megaphone, DollarSign,
  Sparkles, Puzzle, Check, MoreHorizontal, Download,
  Package, Clock, AlertCircle, ChevronRight, TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/services/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type ModuleStatus = "ACTIVE" | "INACTIVE" | "TRIAL" | "EXPIRED";

interface Mod {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  price: number | null;
  isFree: boolean;
  badge: string | null;
  badgeColor: string | null;
  benefits: string[];
  isHighlighted: boolean;
  sortOrder: number;
  companyModuleId: string | null;
  status: ModuleStatus;
  trialEndsAt: string | null;
  activatedAt: string | null;
}

// ─── Visual helpers ───────────────────────────────────────────────────────────

const GRADIENT: Record<string, string> = {
  "pdv":                   "from-blue-400 to-blue-600",
  "delivery":              "from-emerald-400 to-green-600",
  "nfce":                  "from-red-400 to-rose-600",
  "estoque":               "from-amber-400 to-orange-500",
  "cozinha":               "from-orange-400 to-red-500",
  "multi-loja":            "from-purple-400 to-violet-600",
  "meta-pixel":            "from-blue-500 to-indigo-600",
  "google-analytics":      "from-green-400 to-teal-500",
  "fidelidade":            "from-teal-400 to-cyan-600",
  "cupons":                "from-yellow-400 to-amber-500",
  "crm-whatsapp":          "from-green-500 to-emerald-600",
  "recuperacao-clientes":  "from-sky-400 to-blue-500",
  "fluxo-caixa":           "from-emerald-400 to-green-600",
  "dashboard-financeiro":  "from-blue-400 to-indigo-500",
  "dre":                   "from-purple-400 to-violet-500",
  "pix-automatico":        "from-teal-400 to-cyan-500",
  "relatorios-avancados":  "from-orange-400 to-amber-500",
  "cardapio-ia":           "from-violet-400 to-purple-600",
  "ifood":                 "from-red-400 to-rose-600",
  "99food":                "from-amber-400 to-yellow-500",
  "automacao-marketing":   "from-pink-400 to-rose-500",
  "webhooks":              "from-slate-400 to-slate-600",
};

const BADGE_STYLE: Record<string, string> = {
  green:  "bg-green-100 text-green-700",
  orange: "bg-orange-100 text-orange-700",
  red:    "bg-red-100 text-red-700",
  blue:   "bg-blue-100 text-blue-700",
  yellow: "bg-amber-100 text-amber-700",
  purple: "bg-purple-100 text-purple-700",
};

// ─── Category filters ─────────────────────────────────────────────────────────

const IA_SLUGS   = ["cardapio-ia", "automacao-marketing"];
const INT_SLUGS  = ["ifood", "99food", "webhooks"];

type CatFilter = { label: string; icon: ReactNode; match: (m: Mod) => boolean };

const CATS: CatFilter[] = [
  { label: "Todos",        icon: <LayoutGrid size={14}/>,     match: () => true },
  { label: "Operação",     icon: <ShoppingBag size={14}/>,    match: m => m.category === "OPERACAO" },
  { label: "Marketing",    icon: <Megaphone size={14}/>,      match: m => m.category === "MARKETING" && !IA_SLUGS.includes(m.slug) },
  { label: "Financeiro",   icon: <DollarSign size={14}/>,     match: m => m.category === "FINANCEIRO" },
  { label: "IA",           icon: <Sparkles size={14}/>,       match: m => IA_SLUGS.includes(m.slug) },
  { label: "Integrações",  icon: <Puzzle size={14}/>,         match: m => INT_SLUGS.includes(m.slug) },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ModulosPage() {
  const [modules, setModules]         = useState<Mod[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [activeCat, setActiveCat]     = useState("Todos");
  const [busy, setBusy]               = useState<Record<string, boolean>>({});
  const [openMenu, setOpenMenu]       = useState<string | null>(null);
  const companyId                     = useRef("");

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      companyId.current = u.companyId || "";
      if (u.companyId) load(u.companyId);
    } catch { setLoading(false); }
  }, []);

  async function load(cid: string) {
    setLoading(true);
    try {
      const { data } = await api.get(`/company-module/company/${cid}`);
      setModules(data);
    } catch { toast.error("Erro ao carregar módulos"); }
    finally  { setLoading(false); }
  }

  function withBusy(slug: string, fn: () => Promise<void>) {
    return async () => {
      setBusy(p => ({ ...p, [slug]: true }));
      try { await fn(); } finally { setBusy(p => ({ ...p, [slug]: false })); }
    };
  }

  async function handleTrial(slug: string) {
    try {
      await api.post("/company-module/trial", { companyId: companyId.current, moduleSlug: slug });
      toast.success("🎉 Teste grátis de 5 dias ativado!");
      load(companyId.current);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Você já utilizou o teste grátis para este módulo.");
    }
  }

  async function handleActivate(slug: string) {
    try {
      await api.post("/company-module/activate", { companyId: companyId.current, moduleSlug: slug });
      toast.success("Módulo ativado com sucesso!");
      load(companyId.current);
    } catch { toast.error("Erro ao ativar módulo"); }
  }

  async function handleDeactivate(slug: string) {
    try {
      await api.delete(`/company-module/${companyId.current}/${slug}`);
      toast.success("Módulo desativado.");
      load(companyId.current);
    } catch { toast.error("Erro ao desativar módulo"); }
  }

  const cat = CATS.find(c => c.label === activeCat) ?? CATS[0];

  const filtered = modules.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !search
      || m.name.toLowerCase().includes(q)
      || m.description.toLowerCase().includes(q);
    return matchSearch && cat.match(m);
  });

  const installed = modules.filter(m => m.status === "ACTIVE" || m.status === "TRIAL");

  return (
    <div className="min-h-screen bg-[#f8f6f2]" onClick={() => setOpenMenu(null)}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-8 py-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">

          {/* Title */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/25">
              <Package size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Módulos Adicionais</h1>
              <p className="text-gray-500 text-sm mt-0.5">Expanda seu restaurante com recursos avançados e automações.</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar módulos..."
              className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm placeholder-gray-400 text-gray-900 focus:outline-none focus:border-primary/40 focus:bg-white transition w-60"
            />
          </div>
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-2 mt-5 flex-wrap">
          {CATS.map(c => (
            <button
              key={c.label}
              onClick={() => setActiveCat(c.label)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                activeCat === c.label
                  ? "bg-primary text-white shadow-md shadow-primary/25"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-primary/30 hover:text-primary"
              }`}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid ───────────────────────────────────────────────────────────── */}
      <div className="p-8">

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-3xl h-72 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Package size={52} className="mb-4 opacity-30" />
            <p className="text-lg font-semibold">Nenhum módulo encontrado</p>
            <p className="text-sm mt-1">Tente outro filtro ou busca</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map(m => (
              <ModuleCard
                key={m.slug}
                mod={m}
                loading={!!busy[m.slug]}
                menuOpen={openMenu === m.slug}
                onToggleMenu={e => { e.stopPropagation(); setOpenMenu(p => p === m.slug ? null : m.slug); }}
                onTrial={withBusy(m.slug, () => handleTrial(m.slug))}
                onActivate={withBusy(m.slug, () => handleActivate(m.slug))}
                onDeactivate={withBusy(m.slug, () => handleDeactivate(m.slug))}
              />
            ))}
          </div>
        )}

        {/* ── Bottom panels ────────────────────────────────────────────────── */}
        {!loading && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-8">

            {/* CTA banner */}
            <div className="xl:col-span-2 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 border border-orange-100 rounded-3xl p-8 flex items-center justify-between gap-6 overflow-hidden relative">
              <div className="relative z-10">
                <p className="text-xs font-black text-primary uppercase tracking-widest mb-2">Potencialize seu restaurante</p>
                <h3 className="text-xl font-black text-gray-900 mb-2 max-w-xs leading-snug">
                  Os módulos certos aumentam suas vendas e produtividade.
                </h3>
                <p className="text-gray-500 text-sm max-w-sm mb-5">
                  Explore a biblioteca completa e expanda seu sistema com as ferramentas que fazem diferença real.
                </p>
                <button
                  onClick={() => setActiveCat("Todos")}
                  className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary/90 transition shadow-lg shadow-primary/20"
                >
                  Explorar todos os módulos <ChevronRight size={15} />
                </button>
              </div>
              <div className="hidden md:flex gap-3 shrink-0">
                {(["📱","🚀","⭐","📊"] as const).map((e, i) => (
                  <div
                    key={i}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${
                      ["bg-orange-200","bg-teal-200","bg-purple-200","bg-blue-200"][i]
                    }`}
                  >{e}</div>
                ))}
              </div>
            </div>

            {/* Installed panel */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-black text-gray-900 text-sm">Seus módulos instalados</h3>
                {installed.length > 0 && (
                  <span className="text-xs text-gray-400 font-semibold">{installed.length} ativo{installed.length !== 1 ? "s" : ""}</span>
                )}
              </div>

              {installed.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-gray-300">
                  <TrendingUp size={36} className="mb-2" />
                  <p className="text-xs text-center">Ative um módulo para vê-lo aqui</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {installed.slice(0, 5).map(m => (
                    <div
                      key={m.slug}
                      title={m.name}
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${GRADIENT[m.slug] ?? "from-gray-400 to-gray-600"} flex items-center justify-center text-xl shadow-sm cursor-default`}
                    >
                      {m.icon}
                    </div>
                  ))}
                  {installed.length > 5 && (
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-xs font-black text-gray-500">
                      +{installed.length - 5}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ModuleCard ───────────────────────────────────────────────────────────────

function ModuleCard({
  mod, loading, menuOpen, onToggleMenu, onTrial, onActivate, onDeactivate,
}: {
  mod: Mod;
  loading: boolean;
  menuOpen: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
  onTrial: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const gradient = GRADIENT[mod.slug] ?? "from-gray-400 to-gray-600";

  const daysLeft = mod.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(mod.trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : 0;

  const canTrial = mod.status === "INACTIVE" && !mod.trialEndsAt && !mod.isFree;

  function StatusBadge() {
    if (mod.status === "ACTIVE")
      return <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-green-100 text-green-700"><Check size={10}/> ATIVO</span>;
    if (mod.status === "TRIAL")
      return <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-100 text-blue-700"><Clock size={10}/> TESTE</span>;
    if (mod.status === "EXPIRED")
      return <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-100 text-red-700"><AlertCircle size={10}/> EXPIRADO</span>;
    if (mod.badge)
      return <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${BADGE_STYLE[mod.badgeColor ?? "blue"] ?? "bg-gray-100 text-gray-700"}`}>{mod.badge}</span>;
    return null;
  }

  function Footer() {
    /* ACTIVE */
    if (mod.status === "ACTIVE") return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-green-600 font-bold text-sm">
          <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
            <Check size={11} className="text-green-600" />
          </div>
          Ativado
        </div>
        <MenuBtn menuOpen={menuOpen} onToggle={onToggleMenu}>
          <MenuOption label="Assinar módulo" onClick={onActivate} variant="primary" />
          <MenuOption label="Desativar módulo" onClick={onDeactivate} variant="danger" />
        </MenuBtn>
      </div>
    );

    /* TRIAL */
    if (mod.status === "TRIAL") return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-blue-600 flex items-center gap-1.5">
            <Clock size={13}/> Teste grátis ativo
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {daysLeft} dia{daysLeft !== 1 ? "s" : ""} restante{daysLeft !== 1 ? "s" : ""}
          </p>
        </div>
        <MenuBtn menuOpen={menuOpen} onToggle={onToggleMenu}>
          <MenuOption label="Assinar módulo" onClick={onActivate} variant="primary" />
          <MenuOption label="Cancelar teste" onClick={onDeactivate} variant="danger" />
        </MenuBtn>
      </div>
    );

    /* EXPIRED */
    if (mod.status === "EXPIRED") return (
      <div className="flex items-center justify-between">
        <p className="text-sm text-red-500 font-semibold flex items-center gap-1.5">
          <AlertCircle size={13}/> Teste expirado
        </p>
        <button
          onClick={onActivate}
          disabled={loading}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-bold transition shadow-md shadow-primary/20 disabled:opacity-50"
        >
          {loading ? "..." : "Assinar módulo"}
        </button>
      </div>
    );

    /* INACTIVE - free */
    if (mod.isFree) return (
      <div className="flex items-center justify-between">
        <span className="text-green-600 font-black text-sm">Gratuito</span>
        <button
          onClick={onActivate}
          disabled={loading}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition disabled:opacity-50"
        >
          {loading ? "..." : "Ativar Grátis"}
        </button>
      </div>
    );

    /* INACTIVE - paid */
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-primary font-black text-lg leading-none">
            R$ {Number(mod.price).toFixed(2).replace(".", ",")}
          </p>
          <p className="text-gray-400 text-xs">/mês</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button
            onClick={onActivate}
            disabled={loading}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-bold transition shadow-md shadow-primary/20 disabled:opacity-50"
          >
            <Download size={13}/> {loading ? "..." : "Instalar"}
          </button>
          {canTrial && (
            <button
              onClick={onTrial}
              disabled={loading}
              className="text-xs text-primary hover:underline font-semibold disabled:opacity-50"
            >
              Testar 5 dias grátis
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative bg-white rounded-3xl p-6 border shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group flex flex-col ${
        mod.isHighlighted ? "border-primary/20 ring-1 ring-primary/10" : "border-gray-100"
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div
          className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl shrink-0 shadow-lg group-hover:scale-105 transition-transform duration-200`}
        >
          {mod.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <h3 className="font-black text-gray-900 text-[15px] leading-tight">{mod.name}</h3>
            <StatusBadge />
          </div>
          <p className="text-gray-400 text-[12px] mt-1 leading-relaxed line-clamp-2">
            {mod.description}
          </p>
        </div>
      </div>

      {/* Benefits */}
      <ul className="space-y-1.5 flex-1 mb-5">
        {mod.benefits.slice(0, 3).map(b => (
          <li key={b} className="flex items-center gap-2 text-[13px] text-gray-600">
            <Check size={12} className="text-green-500 shrink-0" />
            {b}
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className="border-t border-gray-100 pt-4">
        <Footer />
      </div>
    </div>
  );
}

// ─── Dropdown menu helpers ────────────────────────────────────────────────────

function MenuBtn({ menuOpen, onToggle, children }: { menuOpen: boolean; onToggle: (e: React.MouseEvent) => void; children: ReactNode }) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition"
      >
        <MoreHorizontal size={16} />
      </button>
      {menuOpen && (
        <div className="absolute right-0 bottom-10 bg-white border border-gray-100 shadow-2xl rounded-2xl py-2 w-48 z-30">
          {children}
        </div>
      )}
    </div>
  );
}

function MenuOption({ label, onClick, variant }: { label: string; onClick: () => void; variant: "primary" | "danger" }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition ${
        variant === "danger"
          ? "text-red-500 hover:bg-red-50"
          : "text-primary hover:bg-primary/5"
      }`}
    >
      {label}
    </button>
  );
}
