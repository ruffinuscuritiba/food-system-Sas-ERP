"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import {
  ShoppingBag, Zap, RefreshCw, CheckCircle2, XCircle,
  AlertCircle, Clock, ChevronDown, ChevronUp, Play, Link2,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type Provider = "MOCK" | "IFOOD" | "RAPPI";

interface Config {
  id: string;
  provider: Provider;
  isActive: boolean;
  sandboxMode: boolean;
  clientId?: string;
  merchantId?: string;
  updatedAt: string;
}

interface EventLog {
  id: string;
  provider: Provider;
  eventType: string;
  externalOrderId?: string;
  status: "RECEIVED" | "PROCESSED" | "ERROR";
  errorMessage?: string;
  processedAt?: string;
  createdAt: string;
}

interface IntegrationOrder {
  id: string;
  provider: Provider;
  externalOrderId: string;
  orderId?: string;
  externalStatus?: string;
  createdAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<Provider, { label: string; color: string; icon: string; desc: string }> = {
  MOCK:  { label: "Mock (Teste)",  color: "bg-gray-100 text-gray-700",   icon: "🧪", desc: "Sandbox local — sem conta externa. Ideal para testar o fluxo completo antes de conectar o iFood." },
  IFOOD: { label: "iFood",         color: "bg-red-100 text-red-700",     icon: "🍔", desc: "Receba pedidos do iFood automaticamente. Requer conta parceira e homologação oficial." },
  RAPPI: { label: "Rappi",         color: "bg-orange-100 text-orange-700", icon: "🛵", desc: "Integração com Rappi. Em breve." },
};

const STATUS_STYLE: Record<string, string> = {
  RECEIVED:  "bg-blue-100 text-blue-700",
  PROCESSED: "bg-green-100 text-green-700",
  ERROR:     "bg-red-100 text-red-700",
};

function fmt(d: string) {
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function IntegracoesPage() {
  const [configs, setConfigs]   = useState<Config[]>([]);
  const [events,  setEvents]    = useState<EventLog[]>([]);
  const [orders,  setOrders]    = useState<IntegrationOrder[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<"config" | "catalog" | "events" | "orders">("config");

  // Formulário de config
  const [selectedProvider, setSelectedProvider] = useState<Provider>("MOCK");
  const [clientId,      setClientId]      = useState("");
  const [clientSecret,  setClientSecret]  = useState("");
  const [merchantId,    setMerchantId]    = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [sandboxMode,   setSandboxMode]   = useState(true);
  const [isActive,      setIsActive]      = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [validating,    setValidating]    = useState(false);
  const [syncing,       setSyncing]       = useState(false);
  const [catalogMapCount, setCatalogMapCount] = useState<number | null>(null);

  // Simulação mock
  const [simName,    setSimName]    = useState("Maria Silva");
  const [simPhone,   setSimPhone]   = useState("11999990000");
  const [simBairro,  setSimBairro]  = useState("");
  const [simProductId, setSimProductId] = useState("");
  const [simQty,     setSimQty]     = useState(1);
  const [simPrice,   setSimPrice]   = useState("");
  const [simulating, setSimulating] = useState(false);

  const [expandedConfig, setExpandedConfig] = useState<Provider | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [cfgRes, evRes, ordRes] = await Promise.allSettled([
        api.get("/integrations/config"),
        api.get("/integrations/events?limit=30"),
        api.get("/integrations/orders?limit=30"),
      ]);
      if (cfgRes.status === "fulfilled") setConfigs(Array.isArray(cfgRes.value.data) ? cfgRes.value.data : []);
      if (evRes.status  === "fulfilled") setEvents(Array.isArray(evRes.value.data)   ? evRes.value.data  : []);
      if (ordRes.status === "fulfilled") setOrders(Array.isArray(ordRes.value.data)  ? ordRes.value.data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === "catalog") loadCatalogMapCount("IFOOD"); }, [tab]);

  function loadConfigForProvider(p: Provider) {
    const cfg = configs.find((c) => c.provider === p);
    setClientId(cfg?.clientId ?? "");
    setClientSecret(""); // secret nunca retorna do backend
    setMerchantId(cfg?.merchantId ?? "");
    setWebhookSecret("");
    setSandboxMode(cfg?.sandboxMode ?? true);
    setIsActive(cfg?.isActive ?? false);
    setExpandedConfig(expandedConfig === p ? null : p);
    setSelectedProvider(p);
  }

  async function saveConfig() {
    setSaving(true);
    try {
      await api.put("/integrations/config", {
        provider:       selectedProvider,
        clientId:       clientId || undefined,
        clientSecret:   clientSecret || undefined,
        merchantId:     merchantId || undefined,
        webhookSecret:  webhookSecret || undefined,
        sandboxMode,
        isActive,
      });
      toast.success("Integração salva.");
      load();
      setExpandedConfig(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function validateConnection(provider: Provider) {
    setValidating(true);
    try {
      const { data } = await api.post("/integrations/test-connection", { provider });
      toast.success(data?.message ?? "Conexão validada.");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Falha ao validar conexão.");
    } finally {
      setValidating(false);
    }
  }

  async function loadCatalogMapCount(provider: Provider) {
    try {
      const { data } = await api.get(`/integrations/catalog/maps?provider=${provider}`);
      setCatalogMapCount(Array.isArray(data) ? data.length : 0);
    } catch {
      setCatalogMapCount(null);
    }
  }

  async function syncCatalog(provider: Provider) {
    setSyncing(true);
    try {
      const { data } = await api.post("/integrations/push-catalog", { provider });
      toast.success(`Cardápio sincronizado: ${data.categories} categorias, ${data.items} itens.`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Falha ao sincronizar catálogo.");
    } finally {
      setSyncing(false);
    }
  }

  async function simulate() {
    if (!simProductId) { toast.error("Informe o ID do produto interno."); return; }
    setSimulating(true);
    try {
      await api.post("/integrations/mock/simulate-order", {
        customerName:  simName,
        customerPhone: simPhone,
        neighborhood:  simBairro || undefined,
        items: [{ internalProductId: simProductId, quantity: simQty, unitPrice: Number(simPrice) || 10 }],
        paymentMethod: "PIX",
      });
      toast.success("Pedido simulado! Verifique a Cozinha.");
      setTimeout(load, 1500);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Erro na simulação.");
    } finally {
      setSimulating(false);
    }
  }

  const apiBase =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api$/, '') || "https://api.srv1747711.hstgr.cloud";
  const webhookBaseUrl = `${apiBase}/api/integrations/webhook/`;

  // Pega companyId real do JWT (localStorage)
  const companyIdFromStorage =
    typeof window !== "undefined"
      ? (() => { try { return JSON.parse(localStorage.getItem("user") || "{}").companyId ?? ""; } catch { return ""; } })()
      : "";

  return (
    <main className="min-h-screen bg-gray-50 p-6 lg:p-10">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Link2 className="w-8 h-8 text-indigo-600" />
              Integrações
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Conecte marketplaces. O FoodSaaS é o dono do pedido — iFood vira apenas uma fonte de entrada.
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 text-sm bg-white border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-2xl p-1 border border-gray-100 shadow-sm">
          {([
            { key: "config",  label: "Provedores",    icon: <Zap className="w-4 h-4" /> },
            { key: "catalog", label: "Mapeamento",    icon: <ShoppingBag className="w-4 h-4" /> },
            { key: "orders",  label: "Pedidos",       icon: <CheckCircle2 className="w-4 h-4" /> },
            { key: "events",  label: "Log de Eventos",icon: <Clock className="w-4 h-4" /> },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition ${
                tab === t.key
                  ? "bg-indigo-600 text-white shadow"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-12 text-gray-400">Carregando...</div>
        )}

        {/* ── TAB: Provedores ─────────────────────────────────────────────── */}
        {!loading && tab === "config" && (
          <div className="space-y-4">
            {(["MOCK", "IFOOD", "RAPPI"] as Provider[]).map((p) => {
              const meta = PROVIDER_LABELS[p];
              const cfg  = configs.find((c) => c.provider === p);
              const open = expandedConfig === p;

              return (
                <div key={p} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <button
                    onClick={() => loadConfigForProvider(p)}
                    className="w-full flex items-center gap-4 p-5 hover:bg-gray-50 transition text-left"
                  >
                    <span className="text-2xl">{meta.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{meta.label}</span>
                        {cfg && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            cfg.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}>
                            {cfg.isActive ? "Ativo" : "Inativo"}
                          </span>
                        )}
                        {cfg?.sandboxMode && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                            Sandbox
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{meta.desc}</p>
                    </div>
                    {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </button>

                  {open && (
                    <div className="border-t border-gray-100 p-5 space-y-4">

                      {/* Webhook URL (read-only, companyId real) */}
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          URL do Webhook — configure no painel do marketplace
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <code className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 break-all">
                            {webhookBaseUrl}{companyIdFromStorage || <strong>[SEU_COMPANY_ID]</strong>}/{p}
                          </code>
                          <button
                            onClick={() => {
                              const url = `${webhookBaseUrl}${companyIdFromStorage || "SEU_COMPANY_ID"}/${p}`;
                              navigator.clipboard.writeText(url);
                              toast.success("URL copiada!");
                            }}
                            className="shrink-0 text-xs bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-xl transition"
                          >
                            Copiar
                          </button>
                        </div>
                      </div>

                      {/* Callback URL — campo exigido no cadastro do app no Portal do Parceiro */}
                      {p === "IFOOD" && (
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Callback URL — cole no campo &ldquo;Callback URL&rdquo; ao criar o app no Portal do Parceiro
                          </label>
                          <div className="mt-1 flex items-center gap-2">
                            <code className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 break-all">
                              {apiBase}/api/integrations/ifood/oauth/callback
                            </code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${apiBase}/api/integrations/ifood/oauth/callback`);
                                toast.success("URL copiada!");
                              }}
                              className="shrink-0 text-xs bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-xl transition"
                            >
                              Copiar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Credenciais OAuth2 — iFood apenas */}
                      {p === "IFOOD" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Client ID <span className="text-red-500">*</span>
                            </label>
                            <input
                              value={clientId}
                              onChange={(e) => setClientId(e.target.value)}
                              placeholder="UUID do painel iFood Partners"
                              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Client Secret <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="password"
                              value={clientSecret}
                              onChange={(e) => setClientSecret(e.target.value)}
                              placeholder="Deixe em branco para manter o atual"
                              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                            />
                          </div>
                        </div>
                      )}

                      {p === "IFOOD" && (
                        <div>
                          <button
                            onClick={() => validateConnection(p)}
                            disabled={validating || !clientId}
                            className="text-sm bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-700 border border-red-200 px-4 py-2 rounded-xl transition font-medium flex items-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {validating ? "Validando..." : "Validar Conexão"}
                          </button>
                          <p className="text-xs text-gray-400 mt-1.5">
                            Salve o Client ID/Secret primeiro, depois valide — tentamos obter um token OAuth2 real do iFood.
                          </p>
                        </div>
                      )}

                      {p !== "MOCK" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Merchant ID
                          </label>
                          <input
                            value={merchantId}
                            onChange={(e) => setMerchantId(e.target.value)}
                            placeholder="ex: 123e4567-e89b-12d3..."
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      )}

                      {p !== "MOCK" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Webhook Secret (HMAC)
                          </label>
                          <input
                            type="password"
                            value={webhookSecret}
                            onChange={(e) => setWebhookSecret(e.target.value)}
                            placeholder="Deixe em branco para manter o atual"
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-6">
                        {p !== "MOCK" && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sandboxMode}
                              onChange={(e) => setSandboxMode(e.target.checked)}
                              className="w-4 h-4 accent-indigo-600"
                            />
                            <span className="text-sm text-gray-700">Modo Sandbox</span>
                          </label>
                        )}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className="w-4 h-4 accent-green-500"
                          />
                          <span className="text-sm text-gray-700">Integração ativa</span>
                        </label>
                      </div>

                      {/* Mock simulation inline */}
                      {p === "MOCK" && isActive && (
                        <div className="bg-indigo-50 rounded-xl p-4 space-y-3 border border-indigo-100">
                          <p className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
                            <Play className="w-4 h-4" /> Simular pedido de teste
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Nome cliente</label>
                              <input value={simName} onChange={(e) => setSimName(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Telefone</label>
                              <input value={simPhone} onChange={(e) => setSimPhone(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                ID do produto (interno)
                                <span className="ml-1 text-indigo-500 text-xs">copie de /products</span>
                              </label>
                              <input value={simProductId} onChange={(e) => setSimProductId(e.target.value)}
                                placeholder="cuid do produto..."
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Qtd</label>
                                <input type="number" min={1} value={simQty} onChange={(e) => setSimQty(Number(e.target.value))}
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Preço unit.</label>
                                <input value={simPrice} onChange={(e) => setSimPrice(e.target.value)}
                                  placeholder="0.00"
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={simulate}
                            disabled={simulating}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
                          >
                            <Play className="w-4 h-4" />
                            {simulating ? "Enviando..." : "Disparar pedido mock → Cozinha"}
                          </button>
                        </div>
                      )}

                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setExpandedConfig(null)}
                          className="px-5 py-2 rounded-xl border border-gray-200 text-sm hover:bg-gray-50 transition"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={saveConfig}
                          disabled={saving}
                          className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition"
                        >
                          {saving ? "Salvando..." : "Salvar"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB: Mapeamento de Catálogo ──────────────────────────────────── */}
        {!loading && tab === "catalog" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Mapeamento de Catálogo</h2>
            <p className="text-sm text-gray-500 mb-6">
              Associe o ID de cada produto no marketplace ao produto interno do FoodSaaS.
              No modo <strong>Mock</strong>, esse mapeamento não é necessário (IDs são iguais).
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
              <AlertCircle className="inline w-4 h-4 mr-2" />
              Disponível após ativar uma integração com iFood ou Rappi. No Mock, pedidos chegam
              usando o <code className="bg-yellow-100 px-1 rounded">internalProductId</code> diretamente.
            </div>

            {/* Sincronização de catálogo — iFood */}
            <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-red-900 flex items-center gap-2">
                🍔 Sincronizar Cardápio com iFood
              </h3>
              <p className="text-sm text-red-700/80 mt-1">
                {catalogMapCount === null
                  ? "Carregando mapeamentos..."
                  : catalogMapCount === 0
                    ? "Nenhum produto mapeado ainda. Cadastre pelo menos um mapeamento (externalProductId → produto interno) antes de sincronizar."
                    : `${catalogMapCount} produto(s) mapeado(s) — prontos para envio.`}
              </p>
              <button
                onClick={() => syncCatalog("IFOOD")}
                disabled={syncing || !catalogMapCount}
                className="mt-3 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-4 py-2 rounded-xl transition font-medium flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Enviando..." : "Sincronizar Cardápio Agora"}
              </button>
            </div>
          </div>
        )}

        {/* ── TAB: Pedidos ────────────────────────────────────────────────── */}
        {!loading && tab === "orders" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Pedidos recebidos via integração</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Cada linha representa um pedido externo mapeado para um pedido interno.
              </p>
            </div>
            {orders.length === 0 ? (
              <div className="p-10 text-center text-gray-400">
                Nenhum pedido de integração ainda. Use a aba Provedores → Simular para testar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Provider","External ID","Order Interno","Status Externo","Criado em"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${PROVIDER_LABELS[o.provider]?.color}`}>
                            {PROVIDER_LABELS[o.provider]?.icon} {o.provider}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-gray-600">{o.externalOrderId}</td>
                        <td className="px-5 py-3 font-mono text-xs text-gray-400">{o.orderId ?? "—"}</td>
                        <td className="px-5 py-3 text-xs text-gray-500">{o.externalStatus ?? "—"}</td>
                        <td className="px-5 py-3 text-xs text-gray-400">{fmt(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Log de Eventos ─────────────────────────────────────────── */}
        {!loading && tab === "events" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Log de Webhooks Recebidos</h2>
              <p className="text-sm text-gray-500 mt-0.5">Últimos 30 eventos. Cada linha = 1 webhook recebido.</p>
            </div>
            {events.length === 0 ? (
              <div className="p-10 text-center text-gray-400">Nenhum evento registrado ainda.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Provider","Tipo","External Order","Status","Erro","Data"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${PROVIDER_LABELS[e.provider]?.color}`}>
                            {PROVIDER_LABELS[e.provider]?.icon} {e.provider}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs font-mono text-gray-700">{e.eventType}</td>
                        <td className="px-5 py-3 text-xs font-mono text-gray-400">{e.externalOrderId ?? "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[e.status] ?? ""}`}>
                            {e.status === "ERROR"     && <XCircle     className="inline w-3 h-3 mr-1" />}
                            {e.status === "PROCESSED" && <CheckCircle2 className="inline w-3 h-3 mr-1" />}
                            {e.status === "RECEIVED"  && <Clock        className="inline w-3 h-3 mr-1" />}
                            {e.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-red-500 max-w-[200px] truncate">{e.errorMessage ?? "—"}</td>
                        <td className="px-5 py-3 text-xs text-gray-400">{fmt(e.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
