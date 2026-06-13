"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/services/api";
import { AlertTriangle, Download, X, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";

const SESSION_KEY = "printer_agent_banner_dismissed";

export default function PrinterAgentBanner() {
  const { user } = useAuthStore();
  const [offline, setOffline]     = useState(false);
  const [dismissed, setDismissed] = useState(true); // start hidden until confirmed offline

  useEffect(() => {
    // Só mostra para ADMIN/MANAGER
    if (!user || !["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(user.role)) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    let active = true;
    async function check() {
      try {
        const res = await api.get<{ online: boolean }>("/printers/agent/status");
        if (active && !res.data.online) {
          setOffline(true);
          setDismissed(false);
        }
      } catch { /* silent */ }
    }

    check();
    const id = setInterval(check, 60_000);
    return () => { active = false; clearInterval(id); };
  }, [user]);

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setDismissed(true);
  }

  if (!offline || dismissed) return null;

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-3 text-sm">
      <AlertTriangle size={15} className="text-amber-500 shrink-0" />
      <span className="text-amber-800 flex-1 leading-tight">
        <strong>Agente de impressão offline.</strong>{" "}
        Cupons não serão impressos automaticamente nesta máquina.
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/configuracoes?tab=impressao-local"
          className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 transition"
        >
          <Download size={12} />
          Baixar Agente
          <ChevronRight size={11} />
        </Link>
        <button
          onClick={dismiss}
          className="p-1 rounded-lg text-amber-500 hover:bg-amber-100 transition"
          aria-label="Fechar"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
