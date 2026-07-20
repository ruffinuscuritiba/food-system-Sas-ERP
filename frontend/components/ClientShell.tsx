"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { applyDemoTheme, clearDemoTheme, DEMO_IDS } from "@/lib/demoThemes";
import { PDV_THEME_DEFAULT, savePdvTheme, applyPdvVars } from "@/lib/pdv-theme";

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
  MapPinned,
  Landmark,
  CreditCard,
  Megaphone,
  BarChart2,
  Eye,
  MessageCircle,
  History,
  Cable,
  Printer,
  Settings,
  ChevronDown,
  TrendingUp,
} from "lucide-react";

import toast, { Toaster } from "react-hot-toast";
import { useAuthStore } from "@/stores/auth.store";
import { useCompanyStore } from "@/stores/company.store";
import { api } from "@/services/api";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { buildSupportUrl } from "@/config/support";
import { QrLinksModal } from "@/components/shared/QrLinksModal";

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
  "/ia-demo",
  "/tracking",
  "/r",        // QR redirect de recuperação de clientes
  "/termos",
];

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
  moduleSlug?: string;
  activeColor?: "green" | "blue"; // força cor do item ativo independente de --color-primary
  navKey?: string; // chave para personalização da sidebar (sidebarConfig)
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
      { href: "/pdv",            label: "PDV / Caixa", icon: <DollarSign size={16} />,  roles: ["SUPER_ADMIN","ADMIN","MANAGER","CASHIER"], activeColor: "blue", navKey: "pdv" },
      { href: "/orders",         label: "Pedidos",     icon: <ShoppingCart size={16} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER","DELIVERY"], navKey: "orders" },
      { href: "/kitchen",        label: "Cozinha",     icon: <CookingPot size={16} />,   roles: ["SUPER_ADMIN","ADMIN","MANAGER","KITCHEN"], navKey: "kitchen" },
      { href: "/delivery-tracking", label: "Rastreamento", icon: <MapPinned size={16} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER"], moduleSlug: "delivery", navKey: "delivery-tracking" },
      { href: "/tables",         label: "Mesas",       icon: <Store size={16} />,        roles: ["SUPER_ADMIN","ADMIN","MANAGER","CASHIER"], moduleSlug: "tables", navKey: "tables" },
    ],
  },
  {
    title: "Cardápio",
    items: [
      { href: "/products",      label: "Produtos",       icon: <Package size={16} />,         roles: ["SUPER_ADMIN","ADMIN","MANAGER"], navKey: "products" },
      { href: "/categories",    label: "Categorias",     icon: <FolderKanban size={16} />,    roles: ["SUPER_ADMIN","ADMIN","MANAGER"], navKey: "categories" },
      { href: "/complements",   label: "Complementos",   icon: <Layers size={16} />,          roles: ["SUPER_ADMIN","ADMIN","MANAGER"], navKey: "complements" },
      { href: "/pizza-borders", label: "Pizza / Bordas", icon: <UtensilsCrossed size={16} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER"], navKey: "pizza-borders" },
    ],
  },
  {
    title: "Estoque",
    items: [
      { href: "/stock",       label: "Movimentações", icon: <Layers size={16} />,       roles: ["SUPER_ADMIN","ADMIN","MANAGER"], moduleSlug: "stock",    navKey: "stock" },
      { href: "/ingredients", label: "Ingredientes",  icon: <FlaskConical size={16} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER"], moduleSlug: "stock",    navKey: "ingredients" },
      { href: "/recipes",     label: "Receitas",      icon: <BookOpen size={16} />,     roles: ["SUPER_ADMIN","ADMIN","MANAGER"], moduleSlug: "recipes",  navKey: "recipes" },
    ],
  },
  {
    title: "IA",
    items: [
      { href: "/cadastro-inteligente", label: "Cadastro por Imagem", icon: <Sparkles size={16} />,  roles: ["SUPER_ADMIN","ADMIN","MANAGER"], navKey: "smart-import" },
      { href: "/marketing",            label: "Marketing Digital",   icon: <Megaphone size={16} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER"], moduleSlug: "marketing",    navKey: "marketing" },
      { href: "/campanhas",            label: "QR Recuperação",      icon: <QrCode size={16} />,    roles: ["SUPER_ADMIN","ADMIN","MANAGER"], navKey: "campanhas" },
      { href: "/trafego-pago",         label: "Tráfego Pago",        icon: <TrendingUp size={16} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER"], navKey: "trafego-pago" },
    ],
  },
  {
    title: "Atendimento",
    items: [
      { href: "/whatsapp-ia", label: "Configurar IA", icon: <WaIcon3D />, roles: ["SUPER_ADMIN","ADMIN","MANAGER"], navKey: "whatsapp-ia" },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { href: "/modulos",                      label: "Módulos de Integração", icon: <Puzzle size={16} />,  roles: ["SUPER_ADMIN","ADMIN","MANAGER"], navKey: "modulos" },
      { href: "/configuracoes?tab=integracoes", label: "Integrações",          icon: <Cable size={16} />,   roles: ["SUPER_ADMIN","ADMIN","MANAGER"], navKey: "integracoes" },
      { href: "/configuracoes?tab=impressao",   label: "Impressoras",          icon: <Printer size={16} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER"], navKey: "impressao" },
    ],
  },
  {
    title: "Configurações",
    items: [
      { href: "/financeiro",                    label: "Financeiro",           icon: <Landmark size={16} />,  roles: ["SUPER_ADMIN","ADMIN","MANAGER"], moduleSlug: "financial", navKey: "financeiro" },
      { href: "/bi",                            label: "Relatórios / BI",      icon: <BarChart2 size={16} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER"], moduleSlug: "bi",        navKey: "bi" },
      { href: "/configuracoes?tab=aparencia",   label: "Tema / Visual",        icon: <Palette size={16} />,   roles: ["SUPER_ADMIN","ADMIN"],                                   navKey: "tema" },
      { href: "/tables/qrcode",                 label: "QR Code Mesas",        icon: <QrCode size={16} />,    roles: ["SUPER_ADMIN","ADMIN"], moduleSlug: "tables",             navKey: "qrcode-mesas" },
      { href: "/historico-pedidos",             label: "Histórico de Pedidos", icon: <History size={16} />,   roles: ["SUPER_ADMIN","ADMIN","MANAGER"],                          navKey: "historico" },
      { href: "/configuracoes",                 label: "Configurações",        icon: <Settings size={16} />,  roles: ["SUPER_ADMIN","ADMIN"] },
      { href: "/assinatura",                    label: "Assinatura",           icon: <CreditCard size={16} />, roles: ["SUPER_ADMIN","ADMIN"] },
    ],
  },
];

// ─── Matrix / Feature-flag constants ──────────────────────────────────────────
const MATRIX_COMPANY_ID = process.env.NEXT_PUBLIC_MATRIX_COMPANY_ID ?? "cmq7d3dxs0006gw5pabsljy87";

// Mapa estático pathname → moduleSlug (usado no badge de status por página).
// Construído uma vez a partir de NAV_SECTIONS + MODULE_NAV.
const PATHNAME_TO_SLUG: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  NAV_SECTIONS.forEach(sec => sec.items.forEach(item => {
    if (item.moduleSlug) m[item.href] = item.moduleSlug;
  }));
  Object.entries(MODULE_NAV).forEach(([slug, item]) => { m[item.href] = slug; });
  return m;
})();

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN:       "Administrador",
  MANAGER:     "Gerente",
  CASHIER:     "Caixa",
  KITCHEN:     "Cozinha",
  DELIVERY:    "Entregador",
  DEMO:        "Demonstração",
};

function ClientShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  // Reconstrói a URL atual para comparar com hrefs que incluem query string
  const currentHref = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
  const isPublicPage = PUBLIC_ROUTES.some((r) => pathname?.startsWith(r));

  const { loadAuth, user } = useAuthStore();
  const { setSidebarConfig: setStoreSidebarConfig } = useCompanyStore();
  const [companyName, setCompanyName] = useState("R_FoodSaaS ERP");
  const [companyPlan, setCompanyPlan] = useState("");
  const [impersonating, setImpersonating] = useState<{ companyName: string; companyId?: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSlugs, setActiveSlugs] = useState<string[]>([]);
  const [sidebarConfig, setSidebarConfig] = useState<Record<string, boolean>>({});
  const [qrLinksOpen, setQrLinksOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem("sidebar_collapsed_sections");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  function toggleSection(title: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      try { localStorage.setItem("sidebar_collapsed_sections", JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  const isDemoUser = user?.role === "DEMO";
  const planLabel = isDemoUser
    ? user.companyId?.includes("enterprise") ? "Enterprise"
      : user.companyId?.includes("pro") ? "Pro"
      : "Basic"
    : "";

  useEffect(() => {
    loadAuth();
    const imp = localStorage.getItem("impersonating");
    if (imp) { try { setImpersonating(JSON.parse(imp)); } catch {} }
  }, [loadAuth]);

  // Mantém o backend Render acordado: pinga a cada 5 min (hiberna em 15 min).
  // Também pinga ao recuperar visibilidade (tab voltando ao foco após inatividade).
  useEffect(() => {
    const ping = () => fetch("/api/warmup", { cache: "no-store" }).catch(() => {});
    ping(); // ping imediato ao carregar
    const id = setInterval(ping, 5 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
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
        if (r.data?.plan) setCompanyPlan(r.data.plan);
        const modules: any[] = Array.isArray(r.data?.modules) ? r.data.modules : [];
        const slugs = modules
          .filter((m: any) => m.status === "ACTIVE" || m.status === "TRIAL" || m.active)
          // `||` (not `??`) because moduleSlug has @default("") — empty string is falsy
          .map((m: any) => ((m.moduleSlug || m.slug || m.module) as string).toLowerCase())
          .filter(Boolean);
        setActiveSlugs(slugs);
      })
      .catch(() => {});

    api.get("/company/settings")
      .then((r) => {
        if (r.data?.sidebarConfig && typeof r.data.sidebarConfig === "object") {
          const cfg = r.data.sidebarConfig as Record<string, boolean>;
          setSidebarConfig(cfg);
          setStoreSidebarConfig(cfg); // expõe para useNavKeyGuard
        }
      })
      .catch(() => {});

    api.get(`/themes/${cid}`)
      .then((r) => {
        // Real companies: honour their configured primaryColor.
        // Demo companies: re-apply demo theme so API response cannot override it.
        if (DEMO_IDS.has(cid)) {
          applyDemoTheme(cid);
        } else {
          const root = document.documentElement;
          const color = r.data?.primaryColor;
          if (color) root.style.setProperty("--color-primary", color);
          // Aplica cores de fundo/sidebar salvas pelo seletor de preset
          const bg = r.data?.backgroundColor;
          const sidebar = r.data?.secondaryColor;
          if (bg && bg !== "#020617") {
            root.style.setProperty("--surface-0",   bg);
            root.style.setProperty("--app-page-bg", bg);
          }
          if (sidebar && sidebar !== "#0f172a") {
            root.style.setProperty("--surface-1",  sidebar);
            root.style.setProperty("--app-sidebar", sidebar);
          }
          // Sincroniza o preset PDV salvo no banco (cross-device) para o
          // localStorage local + CSS vars --pdv-* antes de o /pdv montar.
          if (r.data?.pdvThemeConfig && typeof r.data.pdvThemeConfig === "object") {
            const merged = { ...PDV_THEME_DEFAULT, ...r.data.pdvThemeConfig };
            savePdvTheme(merged);
            applyPdvVars(merged);
          }
        }
        // Padrão = claro (mármore). Só adiciona .theme-dark quando a loja
        // escolheu explicitamente o modo escuro (CompanyTheme.darkMode = true).
        const isDark = r.data?.darkMode === true;
        const root = document.documentElement;
        root.classList.toggle("theme-dark", isDark);

        // Imagem de fundo textura (ex: mármore) — aplicada via CSS variable
        const bgImg = r.data?.backgroundImageUrl;
        root.classList.toggle("has-bg-texture", !!bgImg);
        if (bgImg) {
          root.style.setProperty("--bg-texture-url", `url('${bgImg}')`);
        } else {
          root.style.removeProperty("--bg-texture-url");
        }
      })
      .catch(() => {});

    return () => {
      if (DEMO_IDS.has(cid)) clearDemoTheme();
      document.documentElement.classList.remove("theme-dark");
    };
  }, [user?.companyId]);

  // Páginas /super-admin são dark-only (hardcoded text-white) e não passam
  // pelo fluxo de tema da empresa (são PUBLIC_ROUTES, sem user.companyId).
  // Força .theme-dark aqui para não herdar o mármore claro (padrão global).
  useEffect(() => {
    if (!pathname?.startsWith("/super-admin")) return;
    document.documentElement.classList.add("theme-dark");
    return () => {
      document.documentElement.classList.remove("theme-dark");
    };
  }, [pathname]);

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

  // ── Controle de acesso por módulo ─────────────────────────────────────────
  // Regra 1: empresa matriz (R_FoodSaaS) — todos os módulos SEMPRE liberados (catch-all).
  // Regra 2: SUPER_ADMIN — acesso irrestrito.
  // Regra 3: DEMO — mostra todos os módulos como vitrine (escrita bloqueada no backend).
  // Regra 4: demais roles — verifica activeSlugs carregados do banco.
  const isMatrix = user?.companyId === MATRIX_COMPANY_ID || user?.role === "SUPER_ADMIN";

  function canAccessModule(moduleSlug?: string): boolean {
    if (!moduleSlug) return true;
    if (isMatrix) return true;        // catch-all: matriz vê tudo sempre
    if (user?.role === "DEMO") return true;
    return activeSlugs.includes(moduleSlug);
  }

  // Badge de status do módulo da página atual (só visível para a matriz).
  const currentPageSlug: string | undefined = PATHNAME_TO_SLUG[pathname ?? ""];
  const currentPageInDb: boolean = currentPageSlug ? activeSlugs.includes(currentPageSlug) : false;

  const isPdv = pathname === "/pdv";
  const isDriverPage = pathname?.startsWith("/driver");
  const isGarcomPage = pathname?.startsWith("/garcom");

  // Redirect DELIVERY role → driver PWA
  useEffect(() => {
    if (user?.role === "DELIVERY" && !isDriverPage) {
      router.replace("/driver");
    }
  }, [user?.role, isDriverPage, router]);

  // Redirect WAITER role → garçom PWA
  useEffect(() => {
    if (user?.role === "WAITER" && !isGarcomPage) {
      router.replace("/garcom");
    }
  }, [user?.role, isGarcomPage, router]);

  // Block expired trials — redirect to checkout wall only when dueDate is past
  const isAssinaturaPage = pathname?.startsWith("/assinatura");
  const isPagamentoPage  = pathname?.startsWith("/pagamento");
  useEffect(() => {
    if (!user?.companyId || isDemoUser) return;
    api.get(`/company/${user.companyId}/subscription`)
      .then((r) => {
        const status  = r.data?.subscriptionStatus as string | undefined;
        const dueDate = r.data?.dueDate as string | null | undefined;
        if (
          status === "PENDING_PAYMENT" &&
          dueDate &&
          new Date() >= new Date(dueDate) &&
          !isAssinaturaPage &&
          !isPagamentoPage
        ) {
          router.replace("/assinatura");
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.companyId]);

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

  // Driver PWA — auth required but no admin sidebar; driver layout owns its own shell
  if (isDriverPage) {
    return (
      <ThemeProvider>
        <Toaster position="top-right" />
        {children}
      </ThemeProvider>
    );
  }

  // Garçom PWA — auth required but no admin sidebar
  if (isGarcomPage) {
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
        className={`md:hidden fixed inset-x-0 z-40 px-4 py-3 flex items-center justify-between ${isDemoUser ? "top-8" : "top-0"} ${isPdv ? "border-b" : "bg-white border-b border-gray-100 shadow-sm"}`}
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

      <div className={`flex h-screen overflow-hidden ${isPdv ? "bg-[var(--pdv-bg,#030712)]" : "bg-[var(--app-page-bg,#F5F3EF)]"} ${isDemoUser ? "md:pt-8 pt-[5.5rem]" : "md:pt-0 pt-14"}`}>

        {/* ─── Sidebar ──────────────────────────────────────────────── */}
        <aside
          className={`
            app-sidebar-nav
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
              const visible = section.items.filter((item) =>
                canSee(item.roles) &&
                canAccessModule(item.moduleSlug) &&
                // sidebarConfig: false = hidden; undefined/true = show. Matriz nunca oculta.
                (isMatrix || !item.navKey || sidebarConfig[item.navKey] !== false)
              );
              if (visible.length === 0) return null;
              const isMarketplace = section.title === "Marketplace";
              // Module-based items unlocked by contracted modules
              const moduleItems = isMarketplace
                ? activeSlugs
                    .filter((slug) => MODULE_NAV[slug] && canSee(MODULE_NAV[slug].roles))
                    .map((slug) => MODULE_NAV[slug])
                : [];
              const hasActiveItem = [...visible, ...moduleItems].some((item) => currentHref === item.href);
              const isCollapsed = !!section.title && collapsedSections.has(section.title) && !hasActiveItem;
              return (
                <div key={si} className={si > 0 ? "pt-3" : ""}>
                  {section.title && (
                    <button
                      type="button"
                      onClick={() => toggleSection(section.title!)}
                      className="w-full flex items-center justify-between px-2.5 pb-1 pt-0.5 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-300 transition"
                    >
                      <span>{section.title}</span>
                      <ChevronDown size={12} className={`transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                    </button>
                  )}
                  <div className={`space-y-0.5 ${isCollapsed ? "hidden" : ""}`}>
                    {visible.map((item) => {
                      const badge = isMatrix && item.moduleSlug
                        ? activeSlugs.includes(item.moduleSlug) ? "active" : "homologation"
                        : undefined;
                      return (
                        <MenuItem
                          key={item.href}
                          href={item.href}
                          icon={item.icon}
                          label={item.label}
                          active={currentHref === item.href}
                          activeColor={item.activeColor}
                          badge={badge as "active" | "homologation" | undefined}
                          onClick={() => setSidebarOpen(false)}
                        />
                      );
                    })}
                    {moduleItems.map((item) => {
                      const slug = PATHNAME_TO_SLUG[item.href];
                      const badge = isMatrix && slug
                        ? activeSlugs.includes(slug) ? "active" : "homologation"
                        : undefined;
                      return (
                        <MenuItem
                          key={item.href}
                          href={item.href}
                          icon={item.icon}
                          label={item.label}
                          active={currentHref === item.href}
                          badge={badge as "active" | "homologation" | undefined}
                          onClick={() => setSidebarOpen(false)}
                        />
                      );
                    })}
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

          {/* QR Code e Links do Cardápio */}
          {user?.companyId && (
            <div className="px-3 pb-2">
              <button
                onClick={() => setQrLinksOpen(true)}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-primary hover:bg-primary/5 transition font-semibold text-[12px] border border-primary/20 group"
              >
                <QrCode size={13} />
                QR Code e Links
                <ChevronRight size={12} className="ml-auto group-hover:translate-x-0.5 transition-transform" />
              </button>
              <QrLinksModal
                companyId={user.companyId}
                companyName={companyName}
                isOpen={qrLinksOpen}
                onClose={() => setQrLinksOpen(false)}
              />
            </div>
          )}

          {/* Suporte */}
          <div className="px-3 pb-2">
            <a
              href={buildSupportUrl({
                companyName,
                plan: isDemoUser ? planLabel : companyPlan || undefined,
                route: pathname ?? undefined,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-primary hover:bg-primary/5 transition font-semibold text-[12px] border border-primary/20 group"
            >
              <MessageCircle size={13} />
              Suporte
              <ChevronRight size={12} className="ml-auto group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>

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
        <main className="admin-page flex-1 overflow-y-auto min-w-0 h-full">
          {children}
        </main>
      </div>

      {/* ─── DEMO read-only banner ─────────────────────────────────── */}
      {isDemoUser && (
        <div
          className="fixed top-0 left-0 right-0 z-[9999] overflow-hidden shadow-md"
          style={{
            background: "linear-gradient(90deg, #4f46e5 0%, #7c3aed 50%, #6d28d9 100%)",
            paddingTop: "env(safe-area-inset-top, 0px)",
          }}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-1.5">
            {/* left: status */}
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles size={12} className="shrink-0 text-violet-200" />
              <span className="text-xs font-bold text-white truncate max-w-[calc(100vw-12rem)] sm:max-w-none">
                <span className="sm:hidden">Demo {planLabel} · Leitura</span>
                <span className="hidden sm:inline">
                  Você está no modo de demonstração {planLabel} — alterações não são salvas
                </span>
              </span>
            </div>
            {/* right: CTA */}
            <a
              href="/signup"
              className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-white text-violet-700 px-2.5 py-0.5 text-[11px] font-black hover:bg-violet-50 transition whitespace-nowrap shadow-sm"
            >
              <span className="hidden sm:inline">Ativar sistema real</span>
              <span className="sm:hidden">Ativar</span>
              <ChevronRight size={10} />
            </a>
          </div>
        </div>
      )}

      {/* ─── Impersonation floating pill — centralizado no topo ─── */}
      {impersonating && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 bg-amber-500 text-white rounded-xl shadow-lg px-3 py-1.5 max-w-[calc(100vw-1.5rem)]">
          <Eye size={13} className="shrink-0 opacity-80" />
          <span className="font-semibold text-xs truncate max-w-[120px] sm:max-w-[200px]">
            {impersonating.companyName}
          </span>
          {user?.companyId && (
            <a
              href={`/menu/${user.companyId}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir cardápio"
              className="hidden sm:flex items-center gap-0.5 text-xs opacity-70 hover:opacity-100 transition shrink-0"
            >
              <ExternalLink size={11} />
            </a>
          )}
          <button
            onClick={stopImpersonating}
            className="flex items-center gap-1 bg-white/20 hover:bg-white/35 transition px-2 py-0.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0"
          >
            <ArrowLeft size={11} />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      )}

      {/* ─── Module status badge — só para a conta matriz ─── */}
      {isMatrix && currentPageSlug && (
        <div
          className={`fixed top-3 right-3 z-[9990] flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg shadow-sm border pointer-events-none select-none ${
            currentPageInDb
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          }`}
        >
          <span className={currentPageInDb ? "text-green-500" : "text-amber-500"}>●</span>
          {currentPageInDb ? "Ativo no Banco" : "Modo Homologação (Inativo no Banco)"}
        </div>
      )}
    </ThemeProvider>
  );
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background">{children}</div>}>
      <ClientShellInner>{children}</ClientShellInner>
    </Suspense>
  );
}

function MenuItem({
  href, icon, label, active, activeColor, badge, onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  activeColor?: "green" | "blue";
  /** Ponto colorido de status de módulo — só exibido para a conta matriz. */
  badge?: "active" | "homologation";
  onClick?: () => void;
}) {
  // Item ativo SEMPRE segue a cor do tema (--color-primary). O activeColor é
  // mantido na assinatura por compat, mas não força mais verde/azul fixos —
  // assim o menu fica consistente em todas as páginas (azul→azul, verde→verde).
  void activeColor;
  const activeCls = "bg-primary text-white shadow-md shadow-primary/30";

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
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span
          title={badge === "active" ? "Ativo no Banco" : "Modo Homologação (Inativo no Banco)"}
          className={`shrink-0 text-[9px] leading-none ${badge === "active" ? "text-green-400" : "text-amber-400"}`}
        >
          ●
        </span>
      )}
    </Link>
  );
}
