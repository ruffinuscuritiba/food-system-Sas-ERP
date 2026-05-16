"use client";

import Link from "next/link";

import { usePathname } from "next/navigation";

import {

  LayoutDashboard,

  ShoppingCart,

  Pizza,

  DollarSign,

  Package,

  ChefHat,

  Users,

  LogOut,

} from "lucide-react";

const links = [

  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
  },

  {
    href: "/orders",
    label: "Pedidos",
    icon: ShoppingCart,
  },

  {
    href: "/kitchen",
    label: "Cozinha",
    icon: ChefHat,
  },

  {
    href: "/tables",
    label: "Mesas",
    icon: Pizza,
  },

  {
    href: "/stock",
    label: "Estoque",
    icon: Package,
  },

  {
    href: "/financial",
    label: "Financeiro",
    icon: DollarSign,
  },

  {
    href: "/customers",
    label: "Clientes",
    icon: Users,
  },
];

export function Sidebar() {

  const pathname =
    usePathname();

  function logout() {

    localStorage.removeItem(
      "token",
    );

    localStorage.removeItem(
      "user",
    );

    document.cookie =
      "token=; Max-Age=0; path=/";

    window.location.href =
      "/login";
  }

  return (

    <aside className="w-72 bg-slate-900 border-r border-slate-800 p-6 flex flex-col">

      <div>

        <h1 className="text-3xl font-black text-white mb-10">
          Ruffinus ERP
        </h1>

        <nav className="space-y-2">

          {links.map((link) => {

            const Icon =
              link.icon;

            const active =
              pathname === link.href;

            return (

              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition font-medium ${
                  active
                    ? "bg-green-500 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >

                <Icon size={20} />

                {link.label}

              </Link>
            );
          })}

        </nav>

      </div>

      <button
        onClick={logout}
        className="mt-auto flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 transition rounded-2xl py-4 text-white font-bold"
      >

        <LogOut size={18} />

        Sair

      </button>

    </aside>
  );
}