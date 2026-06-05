"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { applyDemoTheme, clearDemoTheme, DEMO_IDS } from "@/lib/demoThemes";

import {
  LayoutDashboard,
  ShoppingCart,
  CookingPot,
  Store,
  DollarSign,
  Package,
  FolderKanban,
  FlaskConical,
  BookOpen,
  Layers,
  Palette,
  QrCode,
  LogOut,
  ExternalLink,
  ArrowLeft,
  Menu,
  X,
  UtensilsCrossed,
  ChevronRight,
  Sparkles,
  Puzzle,
  Bot,
  Bike,
  MapPin,
  Landmark,
  CreditCard,
  Megaphone,
  BarChart2,
  Eye,
  MessageCircle,
  History,
} from "lucide-react";

import toast, { Toaster } from "react-hot-toast";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/services/api";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/landing",
  "/menu",
  "/pagamento",
  "/pedido",
  "/order-status",
  "/super-admin",
  "/demo",
];

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
  moduleSlug?: string;
  activeColor?: "green" | "blue"; // força cor do item ativo independente de --color-primary
};

// Module slug → nav item(s) shown below Módulos de Integração when active
const MODULE_NAV: Record<string, NavItem> = {
  "cardapio-ia": {
    href: "/atendimento-ia",
    label: "Atendimento de IA",
    icon: <Bot size={16} />,
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
  },
  "delivery": {
    href: "/entregadores",
    label: "Entregadores",
    icon: <Bike size={16} />,
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
  },
  "whatsapp": {
    href: "/whatsapp-ia",
    label: "WhatsApp IA",
    icon: <MessageCircle size={16} />,
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
  },
};

// Ícone WhatsApp com efeito 3D (gradiente verde + sombra)
function WaIcon3D() {
  return (
    <span
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        justifyContent: "center",
        width:          18,
        height:         18,
        borderRadius:   5,
        background:     "linear-gradient(145deg,#25D366 0%,#128C7E 55%,#075E54 100%)",
        boxShadow:      "0 2px 6px rgba(37,211,102,0.55),inset 0 1px 0 rgba(255,255,255,0.25)",
        flexShrink:     0,
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    </span>
  );
}

const NAV_SECTIONS: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", label: "Dashboard", icon: <LayoutDashboard size={16} />, roles: [], activeColor: "green" },
    ],
  },
  {
    title: "Operação",
    items: [
      { href: "/pdv",     label: "PDV / Caixa", icon: <DollarSign size={16} />,   roles: ["SUPER_ADMIN","ADMIN","MANAGER","CASHIER"], activeColor: "blue" },
      { href: "/orders",  label: "Pedidos",     icon: <ShoppingCart size={16} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER","DELIVERY"] },
      { href: "/kitchen", label: "Cozinha",     icon: <CookingPot size={16} />,   roles: ["SUPER_ADMIN","ADMIN","MANAGER","KITCHEN"] },
      { href: "/tables",  label: "Mesas",       icon: <Store size={16} />,        roles: ["SUPER_ADMIN","ADMIN","MANAGER","CASHIER"], moduleSlug: "tables" },
    ],
  },
  {
    title: "Cardápio",
    items: [
      { href: "/products",      label: "Produtos",         icon: <Package size={16} />,         roles: ["SUPER_ADMIN","ADMIN","MANAGER"] },
      { href: "/categories",    label: "Categorias",       icon: <FolderKanban size={16} />,    roles: ["SUPER_ADMIN","ADMIN","MANAGER"] },
      { href: "/complements",   label: "Complementos",     icon: <Layers size={16} />,          roles: ["SUPER_ADMIN","ADMIN","MANAGER"] },
      { href: "/pizza-borders", label: "Pizza / Bordas",   icon: <UtensilsCrossed size={16} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER"] },
    ],
  },
  {
    title: "Estoque",
    items: [
      { href: "/stock",       label: "Movimentações", icon: <Layers size={16} />,       roles: ["SUPER_ADMIN","ADMIN","MANAGER"], moduleSlug: "stock" },
      { href: "/ingredients", label: "Ingredientes",  icon: <FlaskConical size={16} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER"], moduleSlug: "stock" },
      { href: "/recipes",     label: "Receitas",      icon: <BookOpen size={16} />,     roles: ["SUPER_ADMIN","ADMIN","MANAGER"], moduleSlug: "recipes" },
    ],
  },
  {
    title: "IA",
    items: [
      { href: "/cadastro-inteligente", label: "Cadastro por Imagem",  icon: <Sparkles size={16} />,  roles: ["SUPER_ADMIN","ADMIN","MANAGER"], moduleSlug: "smart_import" },
      { href: "/marketing",            label: "Marketing Digital",    icon: <Megaphone size={16} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER"], moduleSlug: "marketing" },
    ],
  },
  {
    title: "Atendimento",
    items: [
      {
        href:  "/whatsapp-ia",
        label: "Configurar IA",
        icon:  <WaIcon3D />,
        roles: ["SUPER_ADMIN","ADMIN","MANAGER"],
      },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { href: "/modulos", label: "Módulos de Integração", icon: <Puzzle size={16} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER"] },
    ],
  },
  {
    title: "Configurações",
    items: [
      { href: "/financeiro",         label: "Financeiro",           icon: <Landmark size={16} />,   roles: ["SUPER_ADMIN","ADMIN","MANAGER"], moduleSlug: "financial" },
      { href: "/bi",                 label: "Relatórios / BI",      icon: <BarChart2 size={16} />,  roles: ["SUPER_ADMIN","ADMIN","MANAGER"], moduleSlug: "bi" },
      { href: "/theme",              label: "Tema / Visual",        icon: <Palette size={16} />,    roles: ["SUPER_ADMIN","ADMIN"] },
      { href: "/tables/qrcode",      label: "QR Code Mesas",        icon: <QrCode size={16} />,     roles: ["SUPER_ADMIN","ADMIN"],           moduleSlug: "tables" },
      { href: "/historico-pedidos",  label: "Histórico de Pedidos", icon: <History size={16} />,    roles: ["SUPER_ADMIN","ADMIN","MANAGER"] },
      { href: "/assinatura",         label: "Assinatura",           icon: <CreditCard size={16} />, roles: ["SUPER_ADMIN","ADMIN"] },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN:       "Administrador",
  MANAGER:     "Gerente",
  CASHIER:     "Caixa",
  KITCHEN:     "Cozinha",
  DELIVERY:    "Entregador",
  DEMO:        "Demonstração",
};

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPage = PUBLIC_ROUTES.some((r) => pathname?.startsWith(r));

  const { loadAuth, user } = useAuthStore();
  const [companyName, setCompanyName] = useState("FoodSaaS ERP");
  const [impersonating, setImpersonating] = useState<{ companyName: string; companyId?: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSlugs, setActiveSlugs] = useState<string[]>([]);

  useEffect(() => {
    loadAuth();
    const imp = localStorage.getItem("impersonating");
    if (imp) { try { setImpersonating(JSON.parse(imp)); } catch {} }
  }, [loadAuth]);

  // Mantém o backend do Render acordado enquanto o app está aberto (pinga a cada 13 min)
  useEffect(() => {
    const ping = () => fetch("/api/warmup", { cache: "no-store" }).catch(() => {});
    ping();
    const id = setInterval(ping, 13 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user?.companyId) return;
    const cid = user.companyId;

    // Demo companies: apply hardcoded visual identity immediately,
    // bypassing whatever primaryColor the API might return.
    if (DEMO_IDS.has(cid)) {
      applyDemoTheme(cid);
    }

    api.get(`/company/${cid}`)
      .then((r) => {
        if (r.data?.name) setCompanyName(r.data.name);
        const modules: any[] = Array.isArray(r.data?.modules) ? r.data.modules : [];
        const slugs = modules
          .filter((m: any) => m.status === "ACTIVE" || m.status === "TRIAL" || m.active)
          .map((m: any) => (m.moduleSlug ?? m.slug ?? m.module) as string)
          .filter(Boolean);
        setActiveSlugs(slugs);
      })
      .catch(() => {});

    api.get(`/themes/${cid}`)
      .then((r) => {
        // Real companies: honour their configured primaryColor.
        // Demo companies: re-apply demo theme so API response cannot override it.
        if (DEMO_IDS.has(cid)) {
          applyDemoTheme(cid);
        } else {
          const color = r.data?.primaryColor;
          if (color) document.documentElement.style.setProperty("--color-primary", color);
        }
      })
      .catch(() => {});

    return () => { if (DEMO_IDS.has(cid)) clearDemoTheme(); };
  }, [user?.companyId]);

  function stopImpersonating() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("impersonating");
    document.cookie = "token=; Max-Age=0; path=/";
    router.push("/super-admin/dashboard");
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie = "token=; Max-Age=0; path=/";
    toast.success("Logout realizado");
    router.push("/login");
  }

  function canSee(roles: string[]) {
    if (roles.length === 0) return true;
    // DEMO herda visibilidade de ADMIN — escrita bloqueada pelo backend (DemoGuard + RolesGuard)
    const effectiveRole = user?.role === "DEMO" ? "ADMIN" : (user?.role || "");
    return roles.includes(effectiveRole);
  }

  // Filtragem adicional por módulo — só ativa para DEMO, transparente para demais roles.
  // Garante que itens com moduleSlug só aparecem quando o módulo está em activeSlugs.
  function canAccessModule(moduleSlug?: string): boolean {
    if (!moduleSlug) return true;
    if (user?.role !== "DEMO") return true;
    return activeSlugs.includes(moduleSlug);
  }

  const isPdv = pathname === "/pdv";

  if (isPublicPage) {
    // Páginas públicas (login, cardápio digital, etc.) — ThemeProvider sem companyId
    // (cardápio digital tem próprio fetch de tema via param da URL)
    return (
      <ThemeProvider>
        <Toaster position="top-right" />
        {children}
      </ThemeProvider>
    );
  }

  return (
    // Wrapper White Label — aplica CompanyTheme via CSS variables em <html>
    <ThemeProvider>
      <Toaster position="top-right" />

      {/* Mobile top bar */}
      <div
        className={`md:hidden fixed inset-x-0 z-40 px-4 py-3 flex items-center justify-between ${impersonating ? "top-9" : "top-0"} ${isPdv ? "border-b" : "bg-white border-b border-gray-100 shadow-sm"}`}
        style={isPdv ? { background: "var(--pdv-header-bg,#050816)", borderColor: "var(--pdv-border,#161b2d)" } : undefined}
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isPdv ? "bg-blue-600" : "bg-orange-500 shadow-md shadow-orange-200"}`}>
            <UtensilsCrossed size={15} className="text-white" />
          </div>
          <span className={`font-bold text-sm truncate max-w-[180px] ${isPdv ? "text-white" : "text-gray-900"}`}>{companyName}</span>
        </div>
        <button
          onClick={() => setSidebarOpen(true)}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${isPdv ? "text-zinc-300" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          style={isPdv ? { background: "var(--pdv-card-hover,#0c101d)" } : undefined}
        >
          <Menu size={18} />
        </button>
      </div>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={() => setSidebarOpen(false)} />
      )}

      <div className={`flex h-screen overflow-hidden ${isPdv ? "bg-[#030712]" : "bg-[#F5F3EF]"} ${impersonating ? "md:pt-9 pt-[5.75rem]" : "md:pt-0 pt-14"}`}>

        {/* ─── Sidebar ──────────────────────────────────────────────── */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-50 w-60 border-r flex flex-col shrink-0
            transition-transform duration-300 ease-in-out
            md:relative md:translate-x-0 md:z-auto md:h-screen
            ${sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:shadow-sm"}
            top-0
          `}
          style={{ background: "var(--app-sidebar,#0f172a)", borderColor: "var(--app-border-ui,#1e293b)" }}
        >

          {/* Brand */}
          <div className="px-4 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--app-border-ui,#1e293b)" }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-primary/30">
                <UtensilsCrossed size={16} className="text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h1 className="text-[13px] font-black text-white leading-tight truncate">{companyName}</h1>
                  <span className="text-[9px] font-mono text-slate-500 px-1.5 py-0.5 rounded-md shrink-0 select-none" style={{ background: "rgba(255,255,255,0.04)" }}>
                    {process.env.NEXT_PUBLIC_COMMIT_SHA || "dev"}
                  </span>
                </div>
                <p className="text-gray-400 text-[11px] mt-0.5 font-medium">
                  {ROLE_LABELS[user?.role || ""] || "Gestão"}
                </p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 transition">
              <X size={15} />
            </button>
          </div>

          {/* Nav */}
          <nav
            className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-3 py-3 space-y-0.5"
            style={{ scrollbarWidth: "none" }}
          >
            {NAV_SECTIONS.map((section, si) => {
              const visible = section.items.filter((item) => canSee(item.roles) && canAccessModule(item.moduleSlug));
              if (visible.length === 0) return null;
              const isMarketplace = section.title === "Marketplace";
              // Module-based items unlocked by contracted modules
              const moduleItems = isMarketplace
                ? activeSlugs
                    .filter((slug) => MODULE_NAV[slug] && canSee(MODULE_NAV[slug].roles))
                    .map((slug) => MODULE_NAV[slug])
                : [];
              return (
                <div key={si} className={si > 0 ? "pt-3" : ""}>
                  {section.title && (
                    <p className="px-2.5 pb-1 pt-0.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {section.title}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {visible.map((item) => (
                      <MenuItem
                        key={item.href}
                        href={item.href}
                        icon={item.icon}
                        label={item.label}
                        active={pathname === item.href}
                        activeColor={item.activeColor}
                        onClick={() => setSidebarOpen(false)}
                      />
                    ))}
                    {moduleItems.map((item) => (
                      <MenuItem
                        key={item.href}
                        href={item.href}
                        icon={item.icon}
                        label={item.label}
                        active={pathname === item.href}
                        onClick={() => setSidebarOpen(false)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Ver Cardápio */}
          {user?.companyId && (
            <div className="px-3 pb-2">
              <a
                href={`/menu/${user.companyId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-primary hover:bg-primary/5 transition font-semibold text-[12px] border border-primary/20 group"
              >
                <ExternalLink size={13} />
                Ver Cardápio Online
                <ChevronRight size={12} className="ml-auto group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
          )}

          {/* Logout */}
          <div className="px-3 py-3 border-t" style={{ borderColor: "var(--app-border-ui,#1e293b)" }}>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-slate-400 hover:bg-red-900/20 hover:text-red-400 transition font-medium text-[12px] group"
            >
              <LogOut size={14} className="group-hover:scale-110 transition-transform" />
              Sair
            </button>
          </div>
        </aside>

        {/* ─── Content ──────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto min-w-0 h-full">
          {children}
        </main>
      </div>

      {/* ─── DEMO read-only banner ─────────────────────────────────── */}
      {user?.role === "DEMO" && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-violet-600 text-white flex items-center justify-center px-4 py-1.5 shadow-md">
          <Sparkles size={13} className="shrink-0 mr-2" />
          <span className="text-xs font-bold">
            Conta de Demonstração — somente leitura. Alterações não são salvas.
          </span>
          <span className="mx-3 opacity-40">|</span>
          <span className="text-xs opacity-80 capitalize">{user.companyId?.includes("enterprise") ? "Enterprise" : user.companyId?.includes("pro") ? "Pro" : "Basic"}</span>
        </div>
      )}

      {/* ─── Impersonation top bar — visible at all times during demo ─── */}
      {impersonating && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white flex items-center justify-between px-4 py-2 shadow-md">
          <div className="flex items-center gap-2 min-w-0">
            <Eye size={15} className="shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80 hidden sm:inline">
              Visualizando:
            </span>
            <span className="font-bold text-sm truncate max-w-[160px] sm:max-w-xs">
              {impersonating.companyName}
            </span>
            {user?.companyId && (
              <a
                href={`/menu/${user.companyId}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir cardápio"
                className="hidden sm:flex items-center gap-1 text-xs opacity-80 hover:opacity-100 transition ml-1"
              >
                <ExternalLink size={12} />
                Cardápio
              </a>
            )}
          </div>
          <button
            onClick={stopImpersonating}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap shrink-0"
          >
            <ArrowLeft size={13} />
            Voltar ao Painel Master
          </button>
        </div>
      )}
    </ThemeProvider>
  );
}

function MenuItem({
  href, icon, label, active, activeColor, onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  activeColor?: "green" | "blue";
  onClick?: () => void;
}) {
  const activeCls = activeColor === "blue"
    ? "bg-blue-600 text-white shadow-md shadow-blue-900/40"
    : activeColor === "green"
      ? "bg-[#16a34a] text-white shadow-md shadow-green-900/40"
      : "bg-primary text-white shadow-md shadow-primary/30";

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`demo-nav-item flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all text-[13px] font-semibold group ${
        active ? `${activeCls} demo-active` : "text-slate-300 hover:bg-slate-800 hover:text-white"
      }`}
    >
      <span className={`shrink-0 transition-transform group-hover:scale-110 ${active ? "" : "text-slate-500 group-hover:text-slate-200"}`}>
        {icon}
      </span>
      {label}
    </Link>
  );
}
