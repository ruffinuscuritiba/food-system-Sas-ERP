"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { QrCode, Repeat, Ticket, Megaphone, TrendingUp, Loader2 } from "lucide-react";
import { useNavKeyGuard } from "@/hooks/useNavKeyGuard";

function TabLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-primary" size={28} />
    </div>
  );
}

// Abas migradas de rotas antigas — os layouts das rotas antigas redirecionam
// pra cá; importamos os componentes diretamente (sem passar pelo roteador).
const QrRecuperacaoTab = dynamic(() => import("@/app/campanhas/page"), { ssr: false, loading: TabLoader });
const ReengajamentoTab = dynamic(() => import("@/app/campanhas-recorrentes/page"), { ssr: false, loading: TabLoader });
const TrafegoPagoTab = dynamic(() => import("@/app/trafego-pago/page"), { ssr: false, loading: TabLoader });
const CuponsTab = dynamic(() => import("@/components/marketing/CuponsTab"), { ssr: false, loading: TabLoader });
const MarketingDigitalTab = dynamic(() => import("@/components/marketing/MarketingDigitalTab"), { ssr: false, loading: TabLoader });

const TABS = [
  { id: "qr", label: "QR Recuperação", icon: QrCode, desc: "Cupom de recuperação via QR Code impresso no ticket" },
  { id: "reengajamento", label: "Reengajamento WhatsApp", icon: Repeat, desc: "Campanhas recorrentes com opt-in e gotejamento configurável" },
  { id: "cupons", label: "Cupons", icon: Ticket, desc: "Cupons de desconto manuais — criar, listar e desativar" },
  { id: "digital", label: "Marketing Digital", icon: Megaphone, desc: "Gerador de campanhas de texto com IA" },
  { id: "trafego", label: "Tráfego Pago", icon: TrendingUp, desc: "Produtos mais vistos e mais vendidos, pronto pra anúncio" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function MarketingInner() {
  useNavKeyGuard("marketing");
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = (searchParams.get("tab") as TabId) ?? "qr";
  const activeTabDef = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  function setTab(id: TabId) {
    router.push(`/marketing?tab=${id}`, { scroll: false });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 mb-1">
          <Megaphone size={17} className="text-primary" />
          <h1 className="text-sm font-bold text-gray-900">Marketing &amp; Fidelização</h1>
        </div>
        <p className="text-[11px] text-gray-400">{activeTabDef.desc}</p>

        <div className="flex gap-1 mt-4 -mb-4 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon size={14} /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6">
        {activeTab === "qr" ? (
          <QrRecuperacaoTab />
        ) : activeTab === "reengajamento" ? (
          <ReengajamentoTab />
        ) : activeTab === "cupons" ? (
          <CuponsTab />
        ) : activeTab === "digital" ? (
          <MarketingDigitalTab />
        ) : activeTab === "trafego" ? (
          <TrafegoPagoTab />
        ) : null}
      </div>
    </div>
  );
}

export default function MarketingPage() {
  return (
    <Suspense>
      <MarketingInner />
    </Suspense>
  );
}
