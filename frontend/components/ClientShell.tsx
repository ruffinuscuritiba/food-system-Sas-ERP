"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  BarChart2,
  Eye,
} from "lucide-react";

import toast, { Toaster } from "react-hot-toast";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/services/api";

const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/landing",
  "/menu",
  "/pagamento",
  "/pedido",
  "/order-status",
  "/super-admin",
  "/pdv",
];

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
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
};

const NAV_SECTIONS: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", label: "Dashboard", icon: <LayoutDashboard size={16} />, roles: [] },
    ],
  },
  {
    title: "Operação",
    items: [
      { href: "/pdv",     label: "PDV / Caixa", icon: <DollarSign size={16} />,   roles: ["SUPER_ADMIN","ADMIN","MANAGER","CASHIER"] },
      { href: "/orders",  label: "Pedidos",     icon: <ShoppingCart size={16} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER","DELIVERY"] },
      { href: "/kitchen", label: "Cozinha",     icon: <CookingPot size={16} />,   roles: ["SUPER_ADMIN","ADMIN","MANAGER","KITCHEN"] },
      { href: "/tables",  label: "Mesas",       icon: <Store size={16} />,        roles: ["SUPER_ADMIN","ADMIN","MANAGER","CASHIER"] },
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
      { href: "/stock",       label: "Movimentações", icon: <Layers size={16} />,       roles: ["SUPER_ADMIN","ADMIN","MANAGER"] },
      { href: "/ingredients", label: "Ingredientes",  icon: <FlaskConical size={16} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER"] },
      { href: "/recipes",     label: "Receitas",      icon: <BookOpen size={16} />,     roles: ["SUPER_ADMIN","ADMIN","MANAGER"] },
    ],
  },
  {
    title: "IA",
    items: [
      { href: "/cadastro-inteligente", label: "Cadastro por Imagem", icon: <Sparkles size={16} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER"] },
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
      { href: "/financeiro",    label: "Financeiro",              icon: <Landmark size={16} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER"] },
      { href: "/bi",            label: "Relatórios / BI",         icon: <BarChart2 size={16} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER"] },
      { href: "/theme",         label: "Tema / Visual",           icon: <Palette size={16} />,  roles: ["SUPER_ADMIN","ADMIN"] },
      { href: "/tables/qrcode", label: "QR Code Mesas",           icon: <QrCode size={16} />,   roles: ["SUPER_ADMIN","ADMIN"] },
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
  const [impersonatingMenuOpen, setImpersonatingMenuOpen] = useState(false);

  useEffect(() => {
    loadAuth();
    const imp = localStorage.getItem("impersonating");
    if (imp) { try { setImpersonating(JSON.parse(imp)); } catch {} }
  }, [loadAuth]);

  useEffect(() => {
    if (!user?.companyId) return;
    // /company already returns the modules relation — single call,
    // no separate /company-module fetch needed (that route doesn't exist).
    api.get(`/company/${user.companyId}`)
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
    api.get(`/themes/${user.companyId}`)
      .then((r) => {
        const color = r.data?.primaryColor;
        if (color) document.documentElement.style.setProperty("--color-primary", color);
      })
      .catch(() => {});
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
    return roles.includes(user?.role || "");
  }

  if (isPublicPage) {
    return (
      <>
        <Toaster position="top-right" />
        {children}
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" />

      {/* Mobile top bar */}
      <div className="md:hidden fixed inset-x-0 top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center shadow-md shadow-orange-200">
            <UtensilsCrossed size={15} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm truncate max-w-[180px]">{companyName}</span>
        </div>
        <button onClick={() => setSidebarOpen(true)} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition">
          <Menu size={18} />
        </button>
      </div>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex min-h-screen bg-[#F5F3EF] md:pt-0 pt-14">

        {/* ─── Sidebar ──────────────────────────────────────────────── */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-60 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0
          transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0 md:z-auto
          ${sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:shadow-sm"}
          top-0
        `}>

          {/* Brand */}
          <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-primary/30">
                <UtensilsCrossed size={16} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-[13px] font-black text-white leading-tight truncate">{companyName}</h1>
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
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
            {NAV_SECTIONS.map((section, si) => {
              const visible = section.items.filter((item) => canSee(item.roles));
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
          <div className="px-3 py-3 border-t border-slate-800">
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
        <main className="flex-1 overflow-auto min-w-0">
          {children}
        </main>
      </div>

      {/* ─── Floating impersonation indicator ──────────────────────── */}
      {impersonating && (
        <div className="fixed bottom-5 right-5 z-[9998]">
          {/* Mini menu popup */}
          {impersonatingMenuOpen && (
            <>
              {/* Backdrop to close on outside click */}
              <div
                className="fixed inset-0 z-0"
                onClick={() => setImpersonatingMenuOpen(false)}
              />
              <div className="absolute bottom-full right-0 mb-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-10">
                {/* Header */}
                <div className="px-4 py-3.5 border-b border-slate-800">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Visualizando como cliente
                  </p>
                  <p className="text-white font-bold text-sm leading-tight truncate">
                    {impersonating.companyName}
                  </p>
                </div>
                {/* Actions */}
                <div className="p-2 space-y-1">
                  {user?.companyId && (
                    <a
                      href={`/menu/${user.companyId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition text-[13px] font-medium"
                      onClick={() => setImpersonatingMenuOpen(false)}
                    >
                      <ExternalLink size={14} className="text-slate-400" />
                      Abrir cardápio da loja
                    </a>
                  )}
                  <button
                    onClick={stopImpersonating}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl text-red-400 hover:bg-red-900/30 hover:text-red-300 transition text-[13px] font-semibold"
                  >
                    <ArrowLeft size={14} />
                    Sair da visualização
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Pill trigger button */}
          <button
            onClick={() => setImpersonatingMenuOpen((o) => !o)}
            className={`
              flex items-center gap-2 px-3.5 py-2 rounded-full shadow-lg border transition-all duration-200 select-none
              ${impersonatingMenuOpen
                ? "bg-slate-700 border-slate-500 text-white shadow-black/40"
                : "bg-slate-900/95 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-600 shadow-black/30"
              }
            `}
            title="Modo visualização de cliente"
          >
            <Eye size={13} className="text-amber-400 shrink-0" />
            <span className="text-xs font-semibold truncate max-w-[140px]">
              {impersonating.companyName}
            </span>
            <ChevronRight
              size={12}
              className={`text-slate-500 shrink-0 transition-transform duration-200 ${impersonatingMenuOpen ? "-rotate-90" : "rotate-90"}`}
            />
          </button>
        </div>
      )}
    </>
  );
}

function MenuItem({
  href, icon, label, active, onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all text-[13px] font-semibold group ${
        active
          ? "bg-primary text-white shadow-md shadow-primary/30"
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
      }`}
    >
      <span className={`shrink-0 transition-transform group-hover:scale-110 ${active ? "" : "text-slate-500 group-hover:text-slate-200"}`}>
        {icon}
      </span>
      {label}
    </Link>
  );
}
