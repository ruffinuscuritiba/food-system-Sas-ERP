"use client";

import "./globals.css";

import Link from "next/link";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  LayoutDashboard,
  Package,
  FolderKanban,
  CookingPot,
  ShoppingCart,
  Store,
  LogOut,
} from "lucide-react";

import toast, {
  Toaster,
} from "react-hot-toast";

import { useAuthStore }
from "@/stores/auth.store";

import { apiBaseUrl } from "@/services/env";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const pathname =
    usePathname();
  const router = useRouter();
  // Rotas públicas que não mostram o sidebar/navbar
  const PUBLIC_ROUTES = [
    '/login',
    '/signup',
    '/landing',
    '/menu',
    '/pagamento',
    '/order-status',
  ]
  const isLoginPage =
    PUBLIC_ROUTES.some((route) => pathname?.startsWith(route));

  const {
    isAdmin,
    isKitchen,
    isCashier,
    loadAuth,
    user,
  } = useAuthStore();

  const [companyName, setCompanyName] =
    useState("FoodSaaS ERP");

  // Carregar autenticação ao montar o layout
  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  useEffect(() => {
    if (!user?.companyId) return;
    fetch(`${apiBaseUrl}/company/${user.companyId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.name) setCompanyName(data.name);
      })
      .catch(() => {});
  }, [user?.companyId]);

  function logout() {

    localStorage.removeItem(
      "token",
    );

    localStorage.removeItem(
      "user",
    );

    document.cookie =
      "token=; Max-Age=0; path=/";

    toast.success(
      "Logout realizado",
    );

    router.push("/login");
  }

  if (isLoginPage) {

    return (

      <html lang="pt-BR">

        <body>

          <Toaster position="top-right" />

          {children}

        </body>

      </html>
    );
  }

  return (

    <html lang="pt-BR">

      <body className="bg-slate-950 text-white">

        <Toaster position="top-right" />

        <div className="flex min-h-screen">

          <aside className="w-72 bg-slate-900 border-r border-slate-800 p-6 flex flex-col">

            <div className="mb-10">

              <h1 className="text-2xl font-bold leading-tight">
                {companyName}
              </h1>

              <p className="text-slate-400 mt-1 text-sm">
                Gestão SaaS
              </p>

            </div>

            <nav className="flex-1 space-y-2">

              <MenuItem
                href="/"
                icon={
                  <LayoutDashboard
                    size={20}
                  />
                }
                label="Dashboard"
                active={
                  pathname === "/"
                }
              />

              {isAdmin() && (

                <MenuItem
                  href="/products"
                  icon={
                    <Package
                      size={20}
                    />
                  }
                  label="Produtos"
                  active={
                    pathname ===
                    "/products"
                  }
                />

              )}

              {isAdmin() && (

                <MenuItem
                  href="/categories"
                  icon={
                    <FolderKanban
                      size={20}
                    />
                  }
                  label="Categorias"
                  active={
                    pathname ===
                    "/categories"
                  }
                />

              )}

              {isAdmin() && (

                <MenuItem
                  href="/orders"
                  icon={
                    <ShoppingCart
                      size={20}
                    />
                  }
                  label="Pedidos"
                  active={
                    pathname ===
                    "/orders"
                  }
                />

              )}

              {(isKitchen() ||
                isAdmin()) && (

                <MenuItem
                  href="/kitchen"
                  icon={
                    <CookingPot
                      size={20}
                    />
                  }
                  label="Cozinha"
                  active={
                    pathname ===
                    "/kitchen"
                  }
                />

              )}

              {(isCashier() ||
                isAdmin()) ? (

                <MenuItem
                  href="/tables"
                  icon={
                    <Store
                      size={20}
                    />
                  }
                  label="Mesas"
                  active={
                    pathname ===
                    "/tables"
                  }
                />

              ) : null}

            </nav>

            <button
              onClick={logout}
              className="mt-10 flex items-center gap-3 bg-red-500 hover:bg-red-600 transition rounded-2xl px-4 py-4 font-bold"
            >

              <LogOut size={20} />

              Sair

            </button>

          </aside>

          <main className="flex-1 overflow-auto">

            {children}

          </main>

        </div>

      </body>

    </html>
  );
}

function MenuItem({
  href,
  icon,
  label,
  active,
}: any) {

  return (

    <Link
      href={href}
      className={`

        flex items-center gap-3
        px-4 py-4 rounded-2xl
        transition font-medium

        ${
          active
            ? "bg-green-500 text-white"
            : "hover:bg-slate-800 text-slate-300"
        }

      `}
    >

      {icon}

      {label}

    </Link>
  );
}