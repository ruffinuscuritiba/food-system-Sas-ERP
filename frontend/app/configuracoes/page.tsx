"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import {
  Store, Palette, ClipboardList, CreditCard, Pizza,
  Printer, MessageCircle, Cable, Users, Star, Settings,
  Loader2, DollarSign, QrCode, SlidersHorizontal,
  FileCheck2,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/services/api";
import dynamic from "next/dynamic";
import { QrLinksModal } from "@/components/shared/QrLinksModal";
import { LojaTab } from "@/components/settings/LojaTab";

function TabLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-orange-500" size={28} />
    </div>
  );
}

const PedidosTab = dynamic(() => import("@/components/settings/PedidosTab"), {
  ssr: false,
  loading: TabLoader,
});
const PagamentoTab = dynamic(() => import("@/components/settings/PagamentoTab"), {
  ssr: false,
  loading: TabLoader,
});
// ImpressaoTab = configurações de layout + preview do cupom (settings/ImpressaoTab.tsx)
// Gerenciamento de hardware de impressoras ainda acessível via /configuracoes?tab=impressao → hardware embutido abaixo
const ImpressaoTab = dynamic(() => import("@/components/settings/ImpressaoTab"), {
  ssr: false,
  loading: TabLoader,
});

// Abas migradas: os layouts das rotas antigas redirecionam para cá.
// Importamos os componentes diretamente (sem passar pelo roteador) para evitar loop.
const AparenciaTab = dynamic(() => import("@/app/theme/page"), {
  ssr: false,
  loading: TabLoader,
});
const ImpressorasHardwareTab = dynamic(() => import("@/app/impressoras/page"), {
  ssr: false,
  loading: TabLoader,
});
const IntegracoesTab = dynamic(() => import("@/app/integracoes/page"), {
  ssr: false,
  loading: TabLoader,
});
const UsuariosTab = dynamic(() => import("@/components/settings/UsuariosTab"), {
  ssr: false,
  loading: TabLoader,
});
const PlanoTab = dynamic(() => import("@/components/settings/PlanoTab"), {
  ssr: false,
  loading: TabLoader,
});
const FinanceiroTab = dynamic(() => import("@/components/settings/FinanceiroTab"), {
  ssr: false,
  loading: TabLoader,
});
const FiscalTab = dynamic(() => import("@/components/settings/FiscalTab"), {
  ssr: false,
  loading: TabLoader,
});
const ImpressaoLocalTab = dynamic(() => import("@/components/settings/ImpressaoLocalTab"), {
  ssr: false,
  loading: TabLoader,
});
const InterfaceTab = dynamic(() => import("@/components/settings/InterfaceTab"), {
  ssr: false,
  loading: TabLoader,
});

// ─── Constantes ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "loja",        label: "Minha Loja",      icon: Store,          group: "Identidade" },
  { id: "aparencia",   label: "Aparência",        icon: Palette,        group: "Identidade" },
  { id: "pedidos",     label: "Pedidos",          icon: ClipboardList,       group: "Operação" },
  { id: "pagamento",   label: "Pagamento",        icon: CreditCard,          group: "Operação" },
  { id: "pizza",       label: "Pizza & Cardápio", icon: Pizza,               group: "Operação" },
  { id: "interface",   label: "Interface",        icon: SlidersHorizontal,   group: "Operação" },
  { id: "impressao",        label: "Impressão",        icon: Printer,        group: "Tecnologia" },
  { id: "impressao-local",  label: "Impressão Local",  icon: Printer,        group: "Tecnologia" },
  { id: "whatsapp",    label: "WhatsApp IA",      icon: MessageCircle,  group: "Tecnologia" },
  { id: "integracoes", label: "Integrações",      icon: Cable,          group: "Tecnologia" },
  { id: "financeiro",  label: "Financeiro",       icon: DollarSign,     group: "Gestão" },
  { id: "fiscal",      label: "Fiscal",           icon: FileCheck2,     group: "Gestão" },
  { id: "equipe",      label: "Equipe",           icon: Users,          group: "Gestão" },
  { id: "plano",       label: "Plano & Módulos",  icon: Star,           group: "Gestão" },
] as const;

type TabId = (typeof TABS)[number]["id"];
const GROUPS = ["Identidade", "Operação", "Tecnologia", "Gestão"] as const;

// ─── Componente placeholder para abas ainda não implementadas ─────────────────

function PlaceholderTab({ tab }: { tab: TabId }) {
  // Abas com conteúdo implementado não têm link aqui (evita redirect circular).
  // aparencia / impressao / integracoes → renderizadas acima com os componentes migrados.
  // Chaves antigas (ex: "entrega", migrada pra /entrega) não fazem mais parte
  // de TabId, mas podem chegar aqui via link/bookmark antigo — daí o Record<string,...>.
  const redirects: Partial<Record<string, { href: string; label: string }>> = {
    pizza:    { href: "/pizza-borders", label: "Ir para Pizza & Bordas (temporário)" },
    whatsapp: { href: "/whatsapp-ia",   label: "Ir para WhatsApp IA (temporário)" },
    entrega:  { href: "/entrega?tab=area", label: "Ir para Entrega (novo local)" },
  };
  const redirect = redirects[tab];

  return (
    <div className="max-w-3xl">
      <div className="rounded-xl border border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/20 p-5 mb-6">
        <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">
          🚧 Aba em construção
        </p>
        <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
          Esta seção está sendo migrada aqui. Os campos serão implementados progressivamente.
        </p>
        {redirect && (
          <a
            href={redirect.href}
            className="inline-block mt-3 px-4 py-2 text-xs font-semibold rounded-lg bg-orange-500 text-white hover:bg-orange-600"
          >
            {redirect.label} →
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Descrições das abas ──────────────────────────────────────────────────────

function getTabDescription(tab: TabId): string {
  const map: Record<TabId, string> = {
    loja:        "Dados cadastrais, endereço e horários de funcionamento",
    aparencia:   "Cores, logotipo, banner e estilo visual do sistema",
    pedidos:     "Tipos de atendimento, tempo estimado e pedido mínimo",
    pagamento:   "Formas de pagamento aceitas, gateways online e troco",
    pizza:       "Tamanhos, bordas, complementos e regras do cardápio",
    impressao:          "Impressoras cadastradas, setores e fila de impressão",
    "impressao-local":  "Agente de impressão local, download e token de ativação",
    whatsapp:    "Atendente virtual, conexões e comportamento da IA",
    integracoes: "iFood, Rappi, gateways de pagamento e apps externos",
    financeiro:  "Split de pagamentos, conta de repasse e frequência de transferência",
    fiscal:      "Emissão de NFC-e/NF-e via provedor de terceiros (BYOK) — credenciais e termo de uso",
    equipe:      "Usuários, funções e permissões de acesso",
    plano:       "Assinatura atual, módulos ativos e limites do plano",
    interface:   "Personalize quais seções aparecem no painel — sem perder nenhum dado",
  };
  return map[tab] ?? "";
}

// ─── Shell principal ─────────────────────────────────────────────────────────

function ConfiguracoesInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const activeTab = (searchParams.get("tab") as TabId) ?? "loja";
  const [qrOpen, setQrOpen] = useState(false);

  function setTab(id: TabId) {
    router.push(`/configuracoes?tab=${id}`, { scroll: false });
  }

  const activeTabDef = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  const ActiveIcon = activeTabDef.icon;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-y-auto">
        <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Settings size={15} className="text-gray-400" />
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">Configurações</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Parametrização central da loja</p>
        </div>

        {GROUPS.map((group) => {
          const groupTabs = TABS.filter((t) => t.group === group);
          return (
            <div key={group} className="py-2 px-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 px-2 pb-1.5">
                {group}
              </p>
              {groupTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setTab(tab.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors mb-0.5 ${
                      isActive
                        ? "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 font-semibold"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <Icon size={14} className="flex-shrink-0" />
                    <span className="text-xs">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </aside>

      {/* ── Conteúdo ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center">
            <ActiveIcon size={17} className="text-orange-500 mr-2.5 flex-shrink-0" />
            <div>
              <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {activeTabDef.label}
              </h1>
              <p className="text-[11px] text-gray-400">{getTabDescription(activeTab)}</p>
            </div>
          </div>
          {/* QR Code e Links — atalho global */}
          <button
            onClick={() => setQrOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600 transition"
            title="QR Code e Links do cardápio"
          >
            <QrCode size={14} />
            <span className="hidden sm:inline">QR Code e Links</span>
          </button>
        </div>

        {/* Modal QR Code e Links */}
        {user?.companyId && (
          <QrLinksModal
            companyId={user.companyId}
            companyName={user.name}
            isOpen={qrOpen}
            onClose={() => setQrOpen(false)}
          />
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "loja" ? (
            <LojaTab client={api} />
          ) : activeTab === "pedidos" ? (
            <PedidosTab />
          ) : activeTab === "pagamento" ? (
            <PagamentoTab />
          ) : activeTab === "aparencia" ? (
            <AparenciaTab />
          ) : activeTab === "impressao" ? (
            <div className="space-y-8">
              <ImpressaoTab />
              {/* Hardware: impressoras cadastradas, perfis e fila */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">
                    Hardware — Impressoras Cadastradas
                  </span>
                  <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                </div>
                <ImpressorasHardwareTab />
              </div>
            </div>
          ) : activeTab === "impressao-local" ? (
            <ImpressaoLocalTab />
          ) : activeTab === "integracoes" ? (
            <IntegracoesTab />
          ) : activeTab === "financeiro" ? (
            <FinanceiroTab />
          ) : activeTab === "fiscal" ? (
            <FiscalTab />
          ) : activeTab === "equipe" ? (
            <UsuariosTab />
          ) : activeTab === "plano" ? (
            <PlanoTab />
          ) : activeTab === "interface" ? (
            <InterfaceTab />
          ) : (
            <PlaceholderTab tab={activeTab} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConfiguracoesPage() {
  return (
    <Suspense>
      <ConfiguracoesInner />
    </Suspense>
  );
}
