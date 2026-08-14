"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Package, DollarSign, History, User } from "lucide-react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import { InstallBanner } from "@/components/driver/InstallBanner";

const NAV = [
  { href: "/driver",          label: "Início",    icon: Home },
  { href: "/driver/orders",   label: "Entregas",  icon: Package },
  { href: "/driver/earnings", label: "Ganhos",    icon: DollarSign },
  { href: "/driver/history",  label: "Histórico", icon: History },
  { href: "/driver/profile",  label: "Perfil",    icon: User },
];

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  // /driver virou rota pública no middleware.ts (server-side) — cookie
  // setado via JS não sobrevive de forma confiável quando o entregador
  // abre pelo ícone "Adicionar à Tela de Início" no iPhone (WKWebView
  // standalone isolado; achado real: 13/08/2026, login pedido toda vez
  // mesmo com token válido por 7d). O gate agora é 100% client-side, lendo
  // localStorage (useAuthStore), que persiste de forma confiável nesse
  // mesmo contexto. Lê o estado direto do store logo após loadAuth() —
  // não confia no valor do hook antes do effect rodar, que na 1ª
  // renderização ainda reflete o estado inicial (não autenticado).
  useEffect(() => {
    useAuthStore.getState().loadAuth();
    if (!useAuthStore.getState().isAuthenticated) {
      router.replace("/login");
      return;
    }
    setAuthChecked(true);
  }, [router]);

  // Heartbeat — "Online" no painel do admin passa a exigir atividade real
  // (app aberto nos últimos minutos), não só o toggle manual que nasce
  // ligado. Roda em qualquer tela do app do entregador, não só na Home.
  useEffect(() => {
    if (!authChecked) return;
    const ping = () => api.post("/drivers/me/heartbeat").catch(() => {});
    ping();
    const id = setInterval(ping, 30_000);
    return () => clearInterval(id);
  }, [authChecked]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <InstallBanner />
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 flex"
           style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/driver" && pathname?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors
                ${active ? "text-orange-500" : "text-gray-400 hover:text-gray-600"}`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
