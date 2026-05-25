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
];

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
};

const NAV_SECTIONS: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", label: "Dashboard", icon: <LayoutDashboard size={18} />, roles: [] },
    ],
  },
  {
    title: "Operação",
    items: [
      { href: "/orders",  label: "Pedidos",     icon: <ShoppingCart size={18} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER","DELIVERY"] },
      { href: "/kitchen", label: "Cozinha",     icon: <CookingPot size={18} />,   roles: ["SUPER_ADMIN","ADMIN","MANAGER","KITCHEN"] },
      { href: "/tables",  label: "Mesas",       icon: <Store size={18} />,        roles: ["SUPER_ADMIN","ADMIN","MANAGER","CASHIER"] },
      { href: "/pdv",     label: "PDV / Caixa", icon: <DollarSign size={18} />,   roles: ["SUPER_ADMIN","ADMIN","MANAGER","CASHIER"] },
    ],
  },
  {
    title: "Cardápio",
    items: [
      { href: "/products",   label: "Produtos",   icon: <Package size={18} />,      roles: ["SUPER_ADMIN","ADMIN","MANAGER"] },
      { href: "/categories", label: "Categorias", icon: <FolderKanban size={18} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER"] },
    ],
  },
  {
    title: "Estoque",
    items: [
      { href: "/stock",       label: "Movimentações", icon: <Layers size={18} />,       roles: ["SUPER_ADMIN","ADMIN","MANAGER"] },
      { href: "/ingredients", label: "Ingredientes",  icon: <FlaskConical size={18} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER"] },
      { href: "/recipes",     label: "Receitas",      icon: <BookOpen size={18} />,     roles: ["SUPER_ADMIN","ADMIN","MANAGER"] },
    ],
  },
  {
    title: "Inteligência Artificial",
    items: [
      { href: "/cadastro-inteligente", label: "Cadastro por Imagem", icon: <Sparkles size={18} />, roles: ["SUPER_ADMIN","ADMIN","MANAGER"] },
    ],
  },
  {
    title: "Configurações",
    items: [
      { href: "/theme",         label: "Tema / Visual", icon: <Palette size={18} />, roles: ["SUPER_ADMIN","ADMIN"] },
      { href: "/tables/qrcode", label: "QR Code Mesas", icon: <QrCode size={18} />,  roles: ["SUPER_ADMIN","ADMIN"] },
    ],
  },
];

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPage = PUBLIC_ROUTES.some((r) => pathname?.startsWith(r));

  const { loadAuth, user } = useAuthStore();
  const [companyName, setCompanyName] = useState("FoodSaaS ERP");
  const [impersonating, setImpersonating] = useState<{ companyName: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadAuth();
    const imp = localStorage.getItem("impersonating");
    if (imp) { try { setImpersonating(JSON.parse(imp)); } catch {} }
  }, [loadAuth]);

  useEffect(() => {
    if (!user?.companyId) return;
    api.get(`/company/${user.companyId}`)
      .then((r) => { if (r.data?.name) setCompanyName(r.data.name); })
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

      {impersonating && (
        <div className="fixed top-0 inset-x-0 z-50 bg-amber-400 text-black px-5 py-2.5 flex items-center justify-between shadow-lg">
          <span className="text-sm font-medium">
            Visualizando como: <strong>{impersonating.companyName}</strong>
          </span>
          <button
            onClick={stopImpersonating}
            className="flex items-center gap-1.5 bg-black/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-black transition"
          >
            <ArrowLeft size={14} /> Voltar ao Super Admin
          </button>
        </div>
      )}

      {/* Mobile top bar */}
      <div className={`md:hidden fixed inset-x-0 z-40 bg-white border-b border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between ${impersonating ? "top-10" : "top-0"}`}>
        <div className="flex items-center gap-2">
          <div className="bg-orange-500 p-1.5 rounded-lg">
            <UtensilsCrossed size={16} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm truncate max-w-[180px]">{companyName}</span>
        </div>
        <button onClick={() => setSidebarOpen(true)} className="text-gray-500 hover:text-gray-700 p-1">
          <Menu size={22} />
        </button>
      </div>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      <div className={`flex min-h-screen bg-gray-50 ${impersonating ? "pt-10" : ""} md:pt-0 pt-14`}>

        {/* ─── Sidebar ──────────────────────────────────────────────── */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 flex flex-col shrink-0 shadow-lg
          transition-transform duration-300
          md:relative md:translate-x-0 md:z-auto md:shadow-sm
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          ${impersonating ? "top-10 md:top-0" : "top-0"}
        `}>

          {/* Logo */}
          <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="bg-orange-500 p-2 rounded-xl">
                <UtensilsCrossed size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-sm font-black text-gray-900 leading-tight truncate max-w-[140px]">{companyName}</h1>
                <p className="text-gray-400 text-xs mt-0.5">
                  {user?.role === "SUPER_ADMIN" ? "Super Admin" :
                   user?.role === "ADMIN"       ? "Administrador" :
                   user?.role === "MANAGER"     ? "Gerente" :
                   user?.role === "CASHIER"     ? "Caixa" :
                   user?.role === "KITCHEN"     ? "Cozinha" :
                   user?.role === "DELIVERY"    ? "Entregador" : "Gestão"}
                </p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-gray-600 p-1">
              <X size={18} />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
            {NAV_SECTIONS.map((section, si) => {
              const visible = section.items.filter((item) => canSee(item.roles));
              if (visible.length === 0) return null;
              return (
                <div key={si} className={si > 0 ? "pt-4" : ""}>
                  {section.title && (
                    <p className="px-3 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      {section.title}
                    </p>
                  )}
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
                </div>
              );
            })}
          </nav>

          {/* Ver Loja */}
          {user?.companyId && (
            <div className="px-3 pb-2">
              <a
                href={`/menu/${user.companyId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-orange-500 hover:bg-orange-50 transition font-semibold text-sm border border-orange-200"
              >
                <ExternalLink size={15} />
                Ver Cardápio Online
                <ChevronRight size={14} className="ml-auto" />
              </a>
            </div>
          )}

          {/* Logout */}
          <div className="px-3 py-4 border-t border-gray-100">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-500 transition font-medium text-sm"
            >
              <LogOut size={17} />
              Sair
            </button>
          </div>
        </aside>

        {/* ─── Content ──────────────────────────────────────────────── */}
        <main className="flex-1 overflow-auto min-w-0">
          {children}
        </main>
      </div>
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
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition text-sm font-medium ${
        active
          ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
