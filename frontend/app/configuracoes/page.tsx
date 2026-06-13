"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  Store, Palette, ClipboardList, CreditCard, Bike, Pizza,
  Printer, MessageCircle, Cable, Users, Star, Settings,
  Save, Loader2, CheckCircle2, AlertCircle,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import dynamic from "next/dynamic";

function TabLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-orange-500" size={28} />
    </div>
  );
}

const EntregaTab = dynamic(() => import("@/components/settings/EntregaTab"), {
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
const ImpressaoLocalTab = dynamic(() => import("@/components/settings/ImpressaoLocalTab"), {
  ssr: false,
  loading: TabLoader,
});

// ─── Constantes ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "loja",        label: "Minha Loja",      icon: Store,          group: "Identidade" },
  { id: "aparencia",   label: "Aparência",        icon: Palette,        group: "Identidade" },
  { id: "pedidos",     label: "Pedidos",          icon: ClipboardList,  group: "Operação" },
  { id: "pagamento",   label: "Pagamento",        icon: CreditCard,     group: "Operação" },
  { id: "entrega",     label: "Entrega",          icon: Bike,           group: "Operação" },
  { id: "pizza",       label: "Pizza & Cardápio", icon: Pizza,          group: "Operação" },
  { id: "impressao",        label: "Impressão",        icon: Printer,        group: "Tecnologia" },
  { id: "impressao-local",  label: "Impressão Local",  icon: Printer,        group: "Tecnologia" },
  { id: "whatsapp",    label: "WhatsApp IA",      icon: MessageCircle,  group: "Tecnologia" },
  { id: "integracoes", label: "Integrações",      icon: Cable,          group: "Tecnologia" },
  { id: "equipe",      label: "Equipe",           icon: Users,          group: "Gestão" },
  { id: "plano",       label: "Plano & Módulos",  icon: Star,           group: "Gestão" },
] as const;

type TabId = (typeof TABS)[number]["id"];
const GROUPS = ["Identidade", "Operação", "Tecnologia", "Gestão"] as const;

const DAYS = [
  { key: "1", label: "Segunda-feira" },
  { key: "2", label: "Terça-feira" },
  { key: "3", label: "Quarta-feira" },
  { key: "4", label: "Quinta-feira" },
  { key: "5", label: "Sexta-feira" },
  { key: "6", label: "Sábado" },
  { key: "0", label: "Domingo" },
] as const;

const DEFAULT_HOURS: BusinessHours = Object.fromEntries(
  DAYS.map(({ key }, i) => [
    key,
    { open: "10:00", close: "22:00", isOpen: i < 5 },
  ])
) as BusinessHours;

// ─── Tipos ────────────────────────────────────────────────────────────────────

type BusinessHourDay = { open: string; close: string; isOpen: boolean };
type BusinessHours   = Record<string, BusinessHourDay>;

interface CompanySettings {
  id: string;
  name: string;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  cnpj: string | null;
  razaoSocial: string | null;
  zipCode: string | null;
  street: string | null;
  streetNumber: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  businessHours: BusinessHours | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function str(v: string | null | undefined): string { return v ?? ""; }

function maskCnpj(v: string): string {
  return v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

function maskZip(v: string): string {
  return v.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}

// ─── Componente da aba Minha Loja ────────────────────────────────────────────

function LojaTab() {
  const { user } = useAuthStore();
  const [data, setData] = useState<CompanySettings | null>(null);
  const [hours, setHours] = useState<BusinessHours>(DEFAULT_HOURS);
  const [saving, setSaving] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const cepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user?.companyId) return;
    api.get<CompanySettings>("/company/settings")
      .then((res) => {
        setData(res.data);
        setHours(res.data.businessHours ?? DEFAULT_HOURS);
      })
      .catch(() => toast.error("Erro ao carregar configurações da loja"));
  }, [user?.companyId]);

  const patch = useCallback(<K extends keyof CompanySettings>(
    key: K,
    value: CompanySettings[K],
  ) => {
    setData((prev) => prev ? { ...prev, [key]: value } : prev);
  }, []);

  async function lookupCep(raw: string) {
    const cep = raw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const json = await res.json();
      if (json.erro) { toast.error("CEP não encontrado"); return; }
      setData((prev) => prev ? {
        ...prev,
        street:       json.logradouro ?? prev.street,
        neighborhood: json.bairro     ?? prev.neighborhood,
        city:         json.localidade ?? prev.city,
        state:        json.uf         ?? prev.state,
      } : prev);
    } catch {
      toast.error("Erro ao buscar CEP");
    } finally {
      setLoadingCep(false);
    }
  }

  function handleCepChange(v: string) {
    const masked = maskZip(v);
    patch("zipCode", masked);
    if (cepTimer.current) clearTimeout(cepTimer.current);
    cepTimer.current = setTimeout(() => lookupCep(masked), 600);
  }

  function toggleDay(key: string) {
    setHours((prev) => ({
      ...prev,
      [key]: { ...prev[key], isOpen: !prev[key]?.isOpen },
    }));
  }

  function setHourField(key: string, field: "open" | "close", value: string) {
    setHours((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    try {
      await api.patch("/company/settings", {
        name:         data.name,
        description:  data.description,
        phone:        data.phone,
        whatsapp:     data.whatsapp,
        email:        data.email,
        cnpj:         data.cnpj,
        razaoSocial:  data.razaoSocial,
        zipCode:      data.zipCode,
        street:       data.street,
        streetNumber: data.streetNumber,
        complement:   data.complement,
        neighborhood: data.neighborhood,
        city:         data.city,
        state:        data.state,
        businessHours: hours,
      });
      toast.success("Configurações salvas com sucesso!");
    } catch {
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin text-orange-500" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* ── Dados da empresa ────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Dados da empresa
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Usado no cardápio digital, nota fiscal e WhatsApp IA
          </p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome da loja *" colSpan>
            <Input
              value={str(data.name)}
              onChange={(v) => patch("name", v)}
              placeholder="Ex: Bella Napoli Pizzaria"
            />
          </Field>

          <Field label="CNPJ">
            <Input
              value={str(data.cnpj)}
              onChange={(v) => patch("cnpj", maskCnpj(v))}
              placeholder="00.000.000/0001-00"
              maxLength={18}
            />
          </Field>

          <Field label="Razão Social" colSpan>
            <Input
              value={str(data.razaoSocial)}
              onChange={(v) => patch("razaoSocial", v)}
              placeholder="Ex: Bella Napoli Ltda."
            />
          </Field>

          <Field label="Descrição / slogan" colSpan>
            <textarea
              value={str(data.description)}
              onChange={(e) => patch("description", e.target.value)}
              rows={2}
              placeholder="Ex: A melhor pizza da cidade desde 1998"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </Field>

          <Field label="Telefone">
            <Input
              value={str(data.phone)}
              onChange={(v) => patch("phone", maskPhone(v))}
              placeholder="(41) 3333-4444"
              maxLength={15}
            />
          </Field>

          <Field label="WhatsApp">
            <Input
              value={str(data.whatsapp)}
              onChange={(v) => patch("whatsapp", maskPhone(v))}
              placeholder="(41) 99999-0000"
              maxLength={15}
            />
          </Field>

          <Field label="E-mail de contato" colSpan>
            <Input
              type="email"
              value={str(data.email)}
              onChange={(v) => patch("email", v)}
              placeholder="contato@suapizzaria.com.br"
            />
          </Field>
        </div>
      </section>

      {/* ── Endereço ────────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Endereço da loja
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Exibido no cardápio digital e calculado no delivery
          </p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="CEP">
            <div className="relative">
              <Input
                value={str(data.zipCode)}
                onChange={handleCepChange}
                placeholder="00000-000"
                maxLength={9}
              />
              {loadingCep && (
                <Loader2
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
                />
              )}
            </div>
          </Field>

          <Field label="UF">
            <Input
              value={str(data.state)}
              onChange={(v) => patch("state", v.toUpperCase().slice(0, 2))}
              placeholder="PR"
              maxLength={2}
            />
          </Field>

          <Field label="Rua / Avenida" colSpan>
            <Input
              value={str(data.street)}
              onChange={(v) => patch("street", v)}
              placeholder="Av. República Argentina"
            />
          </Field>

          <Field label="Número">
            <Input
              value={str(data.streetNumber)}
              onChange={(v) => patch("streetNumber", v)}
              placeholder="1255"
            />
          </Field>

          <Field label="Complemento">
            <Input
              value={str(data.complement)}
              onChange={(v) => patch("complement", v)}
              placeholder="Loja 3, Sala 201..."
            />
          </Field>

          <Field label="Bairro" colSpan>
            <Input
              value={str(data.neighborhood)}
              onChange={(v) => patch("neighborhood", v)}
              placeholder="Água Verde"
            />
          </Field>

          <Field label="Cidade" colSpan>
            <Input
              value={str(data.city)}
              onChange={(v) => patch("city", v)}
              placeholder="Curitiba"
            />
          </Field>
        </div>
      </section>

      {/* ── Horários de funcionamento ───────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Horários de funcionamento
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Lidos automaticamente pelo WhatsApp IA, cardápio digital e status do pedido
          </p>
        </div>
        <div className="p-5">
          <div className="space-y-2">
            {/* Cabeçalho */}
            <div className="grid grid-cols-[1fr_80px_80px_44px] gap-3 pb-1">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Dia</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center">Abre</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center">Fecha</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center">Ativo</span>
            </div>

            {DAYS.map(({ key, label }) => {
              const day = hours[key] ?? { open: "10:00", close: "22:00", isOpen: false };
              return (
                <div
                  key={key}
                  className={`grid grid-cols-[1fr_80px_80px_44px] gap-3 items-center py-2.5 px-3 rounded-lg transition-colors ${
                    day.isOpen
                      ? "bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30"
                      : "bg-gray-50 dark:bg-gray-800/50 border border-transparent"
                  }`}
                >
                  <span
                    className={`text-sm font-medium ${
                      day.isOpen
                        ? "text-gray-900 dark:text-gray-100"
                        : "text-gray-400 dark:text-gray-600"
                    }`}
                  >
                    {label}
                  </span>

                  <input
                    type="time"
                    value={day.open}
                    onChange={(e) => setHourField(key, "open", e.target.value)}
                    disabled={!day.isOpen}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  />

                  <input
                    type="time"
                    value={day.close}
                    onChange={(e) => setHourField(key, "close", e.target.value)}
                    disabled={!day.isOpen}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  />

                  {/* Toggle */}
                  <button
                    onClick={() => toggleDay(key)}
                    aria-label={day.isOpen ? "Desativar" : "Ativar"}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      day.isOpen ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        day.isOpen ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Aviso overnight */}
          <p className="mt-3 text-xs text-gray-400 flex items-center gap-1.5">
            <AlertCircle size={12} />
            Horários que cruzam meia-noite são suportados (ex: 18:00 → 02:00).
          </p>
        </div>
      </section>

      {/* ── Botão salvar ────────────────────────────────────────────────── */}
      <div className="flex justify-end pb-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors"
        >
          {saving ? (
            <><Loader2 size={15} className="animate-spin" /> Salvando...</>
          ) : (
            <><Save size={15} /> Salvar alterações</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Componente placeholder para abas ainda não implementadas ─────────────────

function PlaceholderTab({ tab }: { tab: TabId }) {
  // Abas com conteúdo implementado não têm link aqui (evita redirect circular).
  // aparencia / impressao / integracoes → renderizadas acima com os componentes migrados.
  const redirects: Partial<Record<TabId, { href: string; label: string }>> = {
    pizza:    { href: "/pizza-borders", label: "Ir para Pizza & Bordas (temporário)" },
    whatsapp: { href: "/whatsapp-ia",   label: "Ir para WhatsApp IA (temporário)" },
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

// ─── Componentes de UI reutilizáveis ─────────────────────────────────────────

function Field({
  label,
  children,
  colSpan,
}: {
  label: string;
  children: React.ReactNode;
  colSpan?: boolean;
}) {
  return (
    <div className={colSpan ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
    />
  );
}

// ─── Descrições das abas ──────────────────────────────────────────────────────

function getTabDescription(tab: TabId): string {
  const map: Record<TabId, string> = {
    loja:        "Dados cadastrais, endereço e horários de funcionamento",
    aparencia:   "Cores, logotipo, banner e estilo visual do sistema",
    pedidos:     "Tipos de atendimento, tempo estimado e pedido mínimo",
    pagamento:   "Formas de pagamento aceitas, gateways online e troco",
    entrega:     "Zonas de entrega, taxas e configurações de raio",
    pizza:       "Tamanhos, bordas, complementos e regras do cardápio",
    impressao:          "Impressoras cadastradas, setores e fila de impressão",
    "impressao-local":  "Agente de impressão local, download e token de ativação",
    whatsapp:    "Atendente virtual, conexões e comportamento da IA",
    integracoes: "iFood, Rappi, gateways de pagamento e apps externos",
    equipe:      "Usuários, funções e permissões de acesso",
    plano:       "Assinatura atual, módulos ativos e limites do plano",
  };
  return map[tab] ?? "";
}

// ─── Shell principal ─────────────────────────────────────────────────────────

function ConfiguracoesInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = (searchParams.get("tab") as TabId) ?? "loja";

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
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3.5 flex items-center">
          <ActiveIcon size={17} className="text-orange-500 mr-2.5 flex-shrink-0" />
          <div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">
              {activeTabDef.label}
            </h1>
            <p className="text-[11px] text-gray-400">{getTabDescription(activeTab)}</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "loja" ? (
            <LojaTab />
          ) : activeTab === "entrega" ? (
            <EntregaTab />
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
          ) : activeTab === "equipe" ? (
            <UsuariosTab />
          ) : activeTab === "plano" ? (
            <PlanoTab />
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
