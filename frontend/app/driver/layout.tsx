"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, DollarSign, History, User } from "lucide-react";

const NAV = [
  { href: "/driver",          label: "Início",    icon: Home },
  { href: "/driver/orders",   label: "Entregas",  icon: Package },
  { href: "/driver/earnings", label: "Ganhos",    icon: DollarSign },
  { href: "/driver/history",  label: "Histórico", icon: History },
  { href: "/driver/profile",  label: "Perfil",    icon: User },
];

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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
