"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { MapPinned, Bike, Map as MapIcon, Loader2 } from "lucide-react";
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
const MonitoramentoTab = dynamic(() => import("@/app/delivery-tracking/page"), { ssr: false, loading: TabLoader });
const EntregadorTab = dynamic(() => import("@/app/entregadores/page"), { ssr: false, loading: TabLoader });
const AreaEntregaTab = dynamic(() => import("@/components/settings/EntregaTab"), { ssr: false, loading: TabLoader });

const TABS = [
  { id: "monitoramento", label: "Monitoramento", icon: MapPinned, desc: "Mapa em tempo real dos entregadores em rota" },
  { id: "entregador", label: "Entregador", icon: Bike, desc: "Cadastro e gestão dos entregadores" },
  { id: "area", label: "Área de Entrega", icon: MapIcon, desc: "Zonas de entrega, taxas e configurações de raio" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function EntregaInner() {
  useNavKeyGuard("delivery-tracking");
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = (searchParams.get("tab") as TabId) ?? "monitoramento";
  const activeTabDef = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  function setTab(id: TabId) {
    router.push(`/entrega?tab=${id}`, { scroll: false });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 mb-1">
          <Bike size={17} className="text-primary" />
          <h1 className="text-sm font-bold text-gray-900">Entrega</h1>
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

      <div className={activeTab === "area" ? "p-6" : ""}>
        {activeTab === "monitoramento" ? (
          <MonitoramentoTab />
        ) : activeTab === "entregador" ? (
          <EntregadorTab />
        ) : activeTab === "area" ? (
          <AreaEntregaTab />
        ) : null}
      </div>
    </div>
  );
}

export default function EntregaPage() {
  return (
    <Suspense>
      <EntregaInner />
    </Suspense>
  );
}
