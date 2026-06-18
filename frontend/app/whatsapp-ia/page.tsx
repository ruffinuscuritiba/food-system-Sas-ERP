"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { AiTrialLock } from "@/components/AiTrialLock";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import {
  MessageSquare, Plus, Trash2, Settings2, BarChart2,
  Phone, Wifi, WifiOff, Bot, User, ChevronRight,
  RefreshCw, Send, AlertCircle, CheckCircle2,
  Zap, Shield, ToggleLeft, ToggleRight, Copy, Eye, EyeOff, Pencil,
  MessageCircle, TrendingUp, Users, ShoppingBag, X, QrCode,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Connection = {
  id: string; name: string; provider: string; instanceName?: string;
  apiUrl?: string; apiToken?: string; phoneNumberId?: string;
  webhookToken?: string; phoneNumber?: string; isActive: boolean;
  settings?: AiSettings | null;
  _count?: { conversations: number };
};

type AiSettings = {
  id?: string; aiProvider: string; aiModel: string;
  attendantName: string; systemPrompt?: string;
  greetingMessage?: string; offlineMessage?: string;
  transferKeywords?: string; mode: string;
  typingDelay: number; messageDelay: number;
  useEmojis: boolean; businessHoursStart: string;
  businessHoursEnd: string; businessDays: string;
  isActive: boolean;
  // Personalidade avançada
  responseStyle: string;
  personalityType: string;
  emojiUsage: string;
  advancedPersonality: boolean;
  speechHabits: string;
  characteristics: string;
  principles: string;
  humor: string;
  // Comportamento de pedidos
  menuLinkStyle: string;
  conversationalOrdering: boolean;
  orderHandlingMode: string;
};

type Conversation = {
  id: string; customerPhone: string; customerName?: string;
  status: string; mode: string; orderId?: string;
  lastMessageAt: string; createdAt: string;
  _count?: { messages: number };
  messages?: { role: string; content: string; createdAt: string }[];
};

type Message = { id: string; role: string; content: string; createdAt: string };
type Stats = {
  totalConversations: number; activeConversations: number;
  humanConversations: number; totalMessages: number; ordersCreated: number;
};

const PROVIDERS = [
  { value: "EVOLUTION", label: "Evolution API" },
  { value: "CLOUD_API", label: "WhatsApp Cloud API (Meta)" },
  { value: "ZAPI",      label: "Z-API" },
  { value: "TWILIO",    label: "Twilio WhatsApp" },
];

const AI_PROVIDERS = [
  { value: "GEMINI",    label: "Google Gemini (recomendado)" },
  { value: "ANTHROPIC", label: "Anthropic Claude" },
  { value: "OPENAI",    label: "OpenAI GPT-4" },
];

const AI_MODELS: Record<string, { value: string; label: string }[]> = {
  GEMINI:    [{ value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" }, { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" }],
  ANTHROPIC: [{ value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" }, { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" }],
  OPENAI:    [{ value: "gpt-4o-mini", label: "GPT-4o Mini" }, { value: "gpt-4o", label: "GPT-4o" }],
};

const MODE_OPTIONS = [
  { value: "AUTO",   label: "Automático",   desc: "IA responde tudo", icon: <Bot size={15} /> },
  { value: "HYBRID", label: "Híbrido",      desc: "IA + transferência", icon: <Zap size={15} /> },
  { value: "MANUAL", label: "Manual",       desc: "Só operador humano", icon: <User size={15} /> },
];

const BACKENDURL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.srv1747711.hstgr.cloud/api";

// ─── Main component ───────────────────────────────────────────────────────────

export default function WhatsappIaPage() {
  const { isAiLocked, isExpired, loading: subLoading } = useSubscription();
  const [tab, setTab] = useState<"connections" | "config" | "conversations" | "stats">("connections");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedConn, setSelectedConn] = useState<Connection | null>(null);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [manualText, setManualText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [connRes, convRes, statsRes] = await Promise.all([
        api.get("/whatsapp-ai/connections"),
        api.get("/whatsapp-ai/conversations"),
        api.get("/whatsapp-ai/stats"),
      ]);
      setConnections(Array.isArray(connRes.data) ? connRes.data : []);
      setConversations(Array.isArray(convRes.data) ? convRes.data : []);
      setStats(statsRes.data);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const loadMessages = async (convId: string) => {
    try {
      const res = await api.get(`/whatsapp-ai/conversations/${convId}/messages`);
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch {}
  };

  const openConversation = (conv: Conversation) => {
    setSelectedConv(conv);
    loadMessages(conv.id);
  };

  // ── Send manual message ────────────────────────────────────────────────────

  const sendManual = async () => {
    if (!selectedConv || !manualText.trim() || sending) return;
    setSending(true);
    try {
      await api.post(`/whatsapp-ai/conversations/${selectedConv.id}/send`, { text: manualText.trim() });
      setManualText("");
      await loadMessages(selectedConv.id);
      toast.success("Mensagem enviada");
    } catch {
      toast.error("Falha ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  // ── Toggle AI mode ─────────────────────────────────────────────────────────

  const toggleConvMode = async (conv: Conversation, newMode: string) => {
    try {
      await api.patch(`/whatsapp-ai/conversations/${conv.id}/mode`, { mode: newMode });
      await loadAll();
      if (selectedConv?.id === conv.id) {
        setSelectedConv({ ...selectedConv, mode: newMode });
      }
      toast.success(`Modo alterado para ${newMode === "AI" ? "IA" : "Humano"}`);
    } catch {
      toast.error("Erro ao alterar modo");
    }
  };

  // ── Copy webhook URL ───────────────────────────────────────────────────────

  const copyWebhook = (connId: string) => {
    const url = `${BACKENDURL}/whatsapp-ai/webhook/${connId}`;
    navigator.clipboard.writeText(url);
    toast.success("URL copiada!");
  };

  const tabs = [
    { id: "connections",   label: "Conexões",      icon: <Wifi size={15} /> },
    { id: "config",        label: "Configurar IA", icon: <Settings2 size={15} /> },
    { id: "conversations", label: "Conversas",     icon: <MessageCircle size={15} /> },
    { id: "stats",         label: "Estatísticas",  icon: <BarChart2 size={15} /> },
  ];

  if (!subLoading && isAiLocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <AiTrialLock variant={isExpired ? "expired" : "trial"} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center">
            <MessageSquare size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">IA Garçom — WhatsApp</h1>
            <p className="text-slate-400 text-xs">Atendimento automatizado com inteligência artificial</p>
          </div>
          <div className="ml-auto">
            <span className="bg-green-900/40 border border-green-700/50 text-green-400 text-xs font-bold px-3 py-1 rounded-full">
              Módulo de Integração
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800 px-6">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition -mb-px ${
                tab === t.id
                  ? "border-green-500 text-green-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {loading && tab !== "conversations" ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <RefreshCw size={20} className="animate-spin mr-2" /> Carregando...
          </div>
        ) : (
          <>
            {tab === "connections"   && <ConnectionsTab connections={connections} onRefresh={loadAll} onSelect={(c) => { setSelectedConn(c); setTab("config"); }} copyWebhook={copyWebhook} />}
            {tab === "config"        && <ConfigTab connections={connections} selectedConn={selectedConn} onSelect={setSelectedConn} onRefresh={loadAll} />}
            {tab === "conversations" && (
              <ConversationsTab
                conversations={conversations}
                selectedConv={selectedConv}
                messages={messages}
                manualText={manualText}
                setManualText={setManualText}
                sending={sending}
                onOpen={openConversation}
                onSend={sendManual}
                onToggleMode={toggleConvMode}
                messagesEndRef={messagesEndRef}
                onRefresh={loadAll}
              />
            )}
            {tab === "stats"         && <StatsTab stats={stats} />}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Provider type (UI-only) ──────────────────────────────────────────────────

type ProviderType = "WHATSAPP_BUSINESS" | "EVOLUTION" | "META_CLOUD";

const PROVIDER_CARDS: {
  type: ProviderType;
  label: string;
  badge?: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  {
    type:  "WHATSAPP_BUSINESS",
    label: "WhatsApp Business",
    badge: "Recomendado",
    desc:  "Conecte via QR Code. Simples e rápido.",
    icon: (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 32, height: 32, borderRadius: 8,
        background: "linear-gradient(145deg,#25D366 0%,#128C7E 60%,#075E54 100%)",
        boxShadow: "0 2px 8px rgba(37,211,102,0.4)",
      }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </span>
    ),
  },
  {
    type:  "EVOLUTION",
    label: "Evolution API",
    desc:  "Instância própria com controle total.",
    icon: (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 32, height: 32, borderRadius: 8,
        background: "linear-gradient(145deg,#6366f1,#4f46e5)",
        boxShadow: "0 2px 8px rgba(99,102,241,0.4)",
      }}>
        <Zap size={16} color="white" />
      </span>
    ),
  },
  {
    type:  "META_CLOUD",
    label: "Meta Cloud API",
    desc:  "API oficial da Meta para empresas.",
    icon: (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 32, height: 32, borderRadius: 8,
        background: "linear-gradient(145deg,#1877f2,#0d5db5)",
        boxShadow: "0 2px 8px rgba(24,119,242,0.4)",
      }}>
        <Shield size={16} color="white" />
      </span>
    ),
  },
];

// ─── Connections Tab ──────────────────────────────────────────────────────────

function ConnectionsTab({ connections, onRefresh, onSelect, copyWebhook }: {
  connections: Connection[];
  onRefresh: () => void;
  onSelect: (c: Connection) => void;
  copyWebhook: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [providerType, setProviderType] = useState<ProviderType>("WHATSAPP_BUSINESS");
  const [form, setForm] = useState({
    name: "", provider: "EVOLUTION", instanceName: "", apiUrl: "",
    apiToken: "", phoneNumberId: "", webhookToken: "", phoneNumber: "",
  });
  const [saving, setSaving] = useState(false);

  // QR Code modal state
  const [qrModal, setQrModal] = useState<{
    open: boolean;
    connectionId: string;
    qrCode: string | null;
    state: string;
  }>({ open: false, connectionId: "", qrCode: null, state: "connecting" });
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopQrPoll = () => {
    if (qrPollRef.current) { clearInterval(qrPollRef.current); qrPollRef.current = null; }
  };

  const startQrPoll = (connectionId: string) => {
    stopQrPoll();
    qrPollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/whatsapp-ai/connections/${connectionId}/qr`);
        const { qrCode, state } = res.data as { qrCode: string | null; state: string };
        setQrModal((prev) => ({ ...prev, qrCode, state }));
        if (state === "open") {
          stopQrPoll();
          onRefresh();
          setTimeout(() => setQrModal((prev) => ({ ...prev, open: false })), 2500);
        }
      } catch {}
    }, 4000);
  };

  const closeQrModal = () => {
    stopQrPoll();
    setQrModal({ open: false, connectionId: "", qrCode: null, state: "connecting" });
    onRefresh();
  };

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", instanceName: "", apiUrl: "",
    apiToken: "", phoneNumberId: "", webhookToken: "", phoneNumber: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [showDetailsId, setShowDetailsId] = useState<string | null>(null);
  const [showTokenId, setShowTokenId] = useState<string | null>(null);

  const startEdit = (conn: Connection) => {
    setEditingId(conn.id);
    setEditForm({
      name:          conn.name          ?? "",
      instanceName:  conn.instanceName  ?? "",
      apiUrl:        conn.apiUrl        ?? "",
      apiToken:      conn.apiToken      ?? "",
      phoneNumberId: conn.phoneNumberId ?? "",
      webhookToken:  conn.webhookToken  ?? "",
      phoneNumber:   conn.phoneNumber   ?? "",
    });
  };

  const saveEdit = async (id: string) => {
    setEditSaving(true);
    try {
      await api.patch(`/whatsapp-ai/connections/${id}`, editForm);
      toast.success("Conexão atualizada!");
      setEditingId(null);
      onRefresh();
    } catch {
      toast.error("Erro ao atualizar conexão");
    } finally {
      setEditSaving(false);
    }
  };

  const handleProviderTypeChange = (type: ProviderType) => {
    setProviderType(type);
    setForm((f) => ({
      ...f,
      provider: type === "META_CLOUD" ? "CLOUD_API" : "EVOLUTION",
      // reset campos técnicos ao trocar de tipo
      instanceName: "", apiUrl: "", apiToken: "",
      phoneNumberId: "", webhookToken: "",
    }));
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    try {
      if (providerType === "WHATSAPP_BUSINESS") {
        // Managed provisioning: platform creates Evolution instance + returns QR
        const res = await api.post("/whatsapp-ai/connections/provision", { name: form.name.trim() });
        const { connection, qrCode } = res.data as { connection: { id: string }; qrCode: string | null };
        setShowForm(false);
        setForm({ name: "", provider: "EVOLUTION", instanceName: "", apiUrl: "", apiToken: "", phoneNumberId: "", webhookToken: "", phoneNumber: "" });
        setQrModal({ open: true, connectionId: connection.id, qrCode, state: "connecting" });
        startQrPoll(connection.id);
        onRefresh();
      } else {
        await api.post("/whatsapp-ai/connections", form);
        toast.success("Conexão criada!");
        setShowForm(false);
        setProviderType("WHATSAPP_BUSINESS");
        setForm({ name: "", provider: "EVOLUTION", instanceName: "", apiUrl: "", apiToken: "", phoneNumberId: "", webhookToken: "", phoneNumber: "" });
        onRefresh();
      }
    } catch {
      toast.error("Erro ao criar conexão");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remover conexão e todas as conversas?")) return;
    try {
      await api.delete(`/whatsapp-ai/connections/${id}`);
      toast.success("Conexão removida");
      onRefresh();
    } catch { toast.error("Erro ao remover"); }
  };

  const toggle = async (conn: Connection) => {
    try {
      await api.patch(`/whatsapp-ai/connections/${conn.id}`, { isActive: !conn.isActive });
      onRefresh();
    } catch { toast.error("Erro"); }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-white">Conexões WhatsApp</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
        >
          <Plus size={15} /> Nova Conexão
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-5">
          <h3 className="font-bold text-white text-base">Nova Conexão</h3>

          {/* ── Provider type selector ── */}
          <div>
            <label className="text-xs text-slate-400 font-semibold mb-2 block">Tipo de conexão</label>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDER_CARDS.map((card) => {
                const active = providerType === card.type;
                return (
                  <button
                    key={card.type}
                    type="button"
                    onClick={() => handleProviderTypeChange(card.type)}
                    className={`relative flex flex-col items-start gap-2 p-3 rounded-xl border text-left transition ${
                      active
                        ? "border-green-500 bg-green-900/20"
                        : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                    }`}
                  >
                    {card.badge && (
                      <span className="absolute top-2 right-2 text-[9px] font-black bg-green-600 text-white px-1.5 py-0.5 rounded-full">
                        {card.badge}
                      </span>
                    )}
                    {card.icon}
                    <div>
                      <p className={`text-xs font-bold leading-tight ${active ? "text-white" : "text-slate-300"}`}>
                        {card.label}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{card.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Fields ── */}
          <div className="space-y-3">
            {/* WhatsApp Business: nome + telefone apenas */}
            {providerType === "WHATSAPP_BUSINESS" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome da conexão" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Ex: WhatsApp Principal" />
                  <Field label="Número do WhatsApp" value={form.phoneNumber} onChange={(v) => setForm({ ...form, phoneNumber: v })} placeholder="5511999999999" />
                </div>
                <div className="flex items-start gap-2.5 bg-green-950/40 border border-green-800/50 rounded-xl px-4 py-3">
                  <CheckCircle2 size={15} className="text-green-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-green-300 leading-relaxed">
                    Após salvar você poderá conectar seu WhatsApp Business através de QR Code.
                  </p>
                </div>
              </>
            )}

            {/* Evolution API: campos técnicos completos */}
            {providerType === "EVOLUTION" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome da conexão" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Ex: WhatsApp Principal" />
                <Field label="Número do WhatsApp" value={form.phoneNumber} onChange={(v) => setForm({ ...form, phoneNumber: v })} placeholder="5511999999999" />
                <Field label="URL da API" value={form.apiUrl} onChange={(v) => setForm({ ...form, apiUrl: v })} placeholder="https://api.evolution.io" />
                <Field label="Nome da Instância" value={form.instanceName} onChange={(v) => setForm({ ...form, instanceName: v })} placeholder="minha-instancia" />
                <Field label="API Token / Bearer" value={form.apiToken} onChange={(v) => setForm({ ...form, apiToken: v })} placeholder="Token de autenticação" type="password" />
                <Field label="Webhook Token (opcional)" value={form.webhookToken} onChange={(v) => setForm({ ...form, webhookToken: v })} placeholder="Verificação de webhook" />
              </div>
            )}

            {/* Meta Cloud API: Phone Number ID + token */}
            {providerType === "META_CLOUD" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome da conexão" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Ex: WhatsApp Meta" />
                <Field label="Número do WhatsApp" value={form.phoneNumber} onChange={(v) => setForm({ ...form, phoneNumber: v })} placeholder="5511999999999" />
                <Field label="Phone Number ID" value={form.phoneNumberId} onChange={(v) => setForm({ ...form, phoneNumberId: v })} placeholder="123456789" />
                <Field label="API Token / Bearer" value={form.apiToken} onChange={(v) => setForm({ ...form, apiToken: v })} placeholder="Token de autenticação" type="password" />
                <Field label="Webhook Token (opcional)" value={form.webhookToken} onChange={(v) => setForm({ ...form, webhookToken: v })} placeholder="Verificação de webhook" />
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={save} disabled={saving}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2"
            >
              {saving ? <><RefreshCw size={13} className="animate-spin" /> Preparando...</> : providerType === "WHATSAPP_BUSINESS" ? "Conectar via QR Code →" : "Salvar"}
            </button>
            <button onClick={() => setShowForm(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-5 py-2 rounded-xl text-sm font-semibold transition">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl p-8 w-full max-w-sm mx-4 text-center">
            <button onClick={closeQrModal} className="absolute top-4 right-4 text-slate-500 hover:text-white transition">
              <X size={18} />
            </button>

            {qrModal.state === "open" ? (
              <div className="py-6">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-green-400" />
                </div>
                <p className="text-xl font-black text-white">WhatsApp Conectado!</p>
                <p className="text-slate-400 text-sm mt-2">A IA já pode receber e responder mensagens.</p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <p className="font-black text-white text-lg">Escaneie o QR Code</p>
                  <p className="text-slate-400 text-xs mt-1">Abra o WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
                </div>

                {qrModal.qrCode ? (
                  <div className="bg-white rounded-xl p-3 inline-block">
                    <img
                      src={qrModal.qrCode.startsWith("data:") ? qrModal.qrCode : `data:image/png;base64,${qrModal.qrCode}`}
                      alt="QR Code WhatsApp"
                      className="w-52 h-52 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-52 h-52 bg-slate-800 rounded-xl flex items-center justify-center mx-auto">
                    <RefreshCw size={24} className="text-slate-500 animate-spin" />
                  </div>
                )}

                <div className="mt-4 flex items-center justify-center gap-2 text-slate-400 text-xs">
                  <RefreshCw size={11} className="animate-spin" />
                  Aguardando leitura... (atualiza a cada 4s)
                </div>

                <button
                  onClick={() => {
                    stopQrPoll();
                    api.get(`/whatsapp-ai/connections/${qrModal.connectionId}/qr`)
                      .then((r) => {
                        const { qrCode, state } = r.data as { qrCode: string | null; state: string };
                        setQrModal((prev) => ({ ...prev, qrCode, state }));
                        if (state === "open") { onRefresh(); setTimeout(() => setQrModal((p) => ({ ...p, open: false })), 2500); }
                        else startQrPoll(qrModal.connectionId);
                      }).catch(() => startQrPoll(qrModal.connectionId));
                  }}
                  className="mt-3 text-xs text-slate-500 hover:text-white underline transition"
                >
                  Atualizar QR Code
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {connections.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Nenhuma conexão configurada</p>
          <p className="text-sm mt-1">Crie sua primeira conexão WhatsApp acima</p>
        </div>
      ) : (
        connections.map((conn) => (
          <div key={conn.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${conn.isActive ? "bg-green-900/40 text-green-400" : "bg-slate-800 text-slate-500"}`}>
                  {conn.isActive ? <Wifi size={18} /> : <WifiOff size={18} />}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-white truncate">{conn.name}</p>
                  <p className="text-xs text-slate-400">{PROVIDERS.find((p) => p.value === conn.provider)?.label ?? conn.provider} {conn.phoneNumber && `• ${conn.phoneNumber}`}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-500 bg-slate-800 px-2.5 py-1 rounded-lg">
                  {conn._count?.conversations ?? 0} conversas
                </span>
                {/* QR Code — só aparece para conexões Evolution com instanceName */}
                {conn.provider !== "META" && (
                  <button
                    onClick={() => {
                      api.get(`/whatsapp-ai/connections/${conn.id}/qr`)
                        .then((r) => {
                          const { qrCode, state } = r.data as { qrCode: string | null; state: string };
                          setQrModal({ open: true, connectionId: conn.id, qrCode, state });
                          if (state !== "open") startQrPoll(conn.id);
                        }).catch(() => toast.error("Erro ao obter QR Code"));
                    }}
                    title="Escanear QR Code / Reconectar"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition bg-amber-900/40 hover:bg-amber-800/60 text-amber-400 hover:text-amber-300"
                  >
                    <QrCode size={15} />
                  </button>
                )}
                <button onClick={() => toggle(conn)} title="Ativar/Desativar" className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition text-slate-400">
                  {conn.isActive ? <ToggleRight size={16} className="text-green-400" /> : <ToggleLeft size={16} />}
                </button>
                {/* Olho — ver detalhes técnicos */}
                <button
                  onClick={() => setShowDetailsId(showDetailsId === conn.id ? null : conn.id)}
                  title="Ver detalhes técnicos"
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${showDetailsId === conn.id ? "bg-indigo-800 text-indigo-300" : "bg-slate-800 hover:bg-indigo-900/40 text-slate-400 hover:text-indigo-300"}`}
                >
                  {showDetailsId === conn.id ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                {/* Lápis — editar */}
                <button
                  onClick={() => editingId === conn.id ? setEditingId(null) : startEdit(conn)}
                  title="Editar conexão"
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${editingId === conn.id ? "bg-amber-800 text-amber-300" : "bg-slate-800 hover:bg-amber-900/40 text-slate-400 hover:text-amber-300"}`}
                >
                  <Pencil size={13} />
                </button>
                {/* IA config */}
                <button onClick={() => onSelect(conn)} title="Configurar IA" className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-blue-800 flex items-center justify-center transition text-slate-400 hover:text-blue-300">
                  <Settings2 size={14} />
                </button>
                <button onClick={() => remove(conn.id)} title="Remover" className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-red-900/30 flex items-center justify-center transition text-slate-400 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Webhook URL */}
            <div className="mt-4 flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-xl px-3 py-2">
              <span className="text-xs text-slate-500 font-mono flex-1 truncate">
                Webhook: /api/whatsapp-ai/webhook/{conn.id}
              </span>
              <button onClick={() => copyWebhook(conn.id)} className="shrink-0 text-slate-400 hover:text-white transition">
                <Copy size={13} />
              </button>
            </div>

            {/* ── Painel de detalhes técnicos (olho) ── */}
            {showDetailsId === conn.id && (
              <div className="mt-3 bg-slate-800/70 border border-indigo-800/40 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-indigo-400 mb-3 flex items-center gap-1.5"><Eye size={12} /> Detalhes técnicos</p>
                {[
                  { label: "Phone Number ID", value: conn.phoneNumberId },
                  { label: "Número", value: conn.phoneNumber },
                  { label: "Instance Name", value: conn.instanceName },
                  { label: "API URL", value: conn.apiUrl },
                  { label: "Webhook Token", value: conn.webhookToken },
                  { label: "API Token", value: conn.apiToken, secret: true },
                ].map(({ label, value, secret }) =>
                  value ? (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400 w-32 shrink-0">{label}</span>
                      <span className="text-xs text-slate-200 font-mono flex-1 truncate">
                        {secret && showTokenId !== conn.id ? "••••••••••••" : value}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        {secret && (
                          <button
                            onClick={() => setShowTokenId(showTokenId === conn.id ? null : conn.id)}
                            className="text-slate-500 hover:text-white transition"
                          >
                            {showTokenId === conn.id ? <EyeOff size={11} /> : <Eye size={11} />}
                          </button>
                        )}
                        <button
                          onClick={() => { navigator.clipboard.writeText(value); toast.success("Copiado!"); }}
                          className="text-slate-500 hover:text-white transition"
                        >
                          <Copy size={11} />
                        </button>
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            )}

            {/* ── Form de edição inline (lápis) ── */}
            {editingId === conn.id && (
              <div className="mt-3 bg-slate-800/70 border border-amber-700/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5"><Pencil size={12} /> Editar conexão</p>
                  <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-white transition"><X size={14} /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome" value={editForm.name} onChange={(v) => setEditForm({ ...editForm, name: v })} placeholder="Nome da conexão" />
                  <Field label="Número do WhatsApp" value={editForm.phoneNumber} onChange={(v) => setEditForm({ ...editForm, phoneNumber: v })} placeholder="5511999999999" />
                  {conn.provider === "CLOUD_API" ? (
                    <>
                      <Field label="Phone Number ID" value={editForm.phoneNumberId} onChange={(v) => setEditForm({ ...editForm, phoneNumberId: v })} placeholder="863109456886497" />
                      <Field label="API Token" value={editForm.apiToken} onChange={(v) => setEditForm({ ...editForm, apiToken: v })} placeholder="Token Meta" type="password" />
                      <Field label="Webhook Token (opcional)" value={editForm.webhookToken} onChange={(v) => setEditForm({ ...editForm, webhookToken: v })} placeholder="Token de verificação" />
                    </>
                  ) : (
                    <>
                      <Field label="URL da API" value={editForm.apiUrl} onChange={(v) => setEditForm({ ...editForm, apiUrl: v })} placeholder="https://api.evolution.io" />
                      <Field label="Nome da Instância" value={editForm.instanceName} onChange={(v) => setEditForm({ ...editForm, instanceName: v })} placeholder="minha-instancia" />
                      <Field label="API Token" value={editForm.apiToken} onChange={(v) => setEditForm({ ...editForm, apiToken: v })} placeholder="Token de autenticação" type="password" />
                      <Field label="Webhook Token (opcional)" value={editForm.webhookToken} onChange={(v) => setEditForm({ ...editForm, webhookToken: v })} placeholder="Token de verificação" />
                    </>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => saveEdit(conn.id)}
                    disabled={editSaving}
                    className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-bold transition"
                  >
                    {editSaving ? "Salvando..." : "Salvar alterações"}
                  </button>
                  <button onClick={() => setEditingId(null)} className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-5 py-2 rounded-xl text-sm font-semibold transition">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ─── Config Tab ───────────────────────────────────────────────────────────────

function ConfigTab({ connections, selectedConn, onSelect, onRefresh }: {
  connections: Connection[];
  selectedConn: Connection | null;
  onSelect: (c: Connection) => void;
  onRefresh: () => void;
}) {
  const DEFAULT_SETTINGS: AiSettings = {
    aiProvider: "GEMINI", aiModel: "gemini-1.5-flash",
    attendantName: "Atendente", systemPrompt: "",
    greetingMessage: "Olá! 😊 Bem-vindo! Como posso te ajudar hoje?",
    offlineMessage: "Olá! Estamos fora do horário de atendimento. Em breve retornaremos! 🕐",
    transferKeywords: "humano,atendente,falar com pessoa",
    mode: "AUTO", typingDelay: 1500, messageDelay: 800,
    useEmojis: true, businessHoursStart: "08:00", businessHoursEnd: "22:00",
    businessDays: "1,2,3,4,5,6", isActive: true,
    responseStyle: "DIRECT",
    personalityType: "FRIENDLY",
    emojiUsage: "MODERATE",
    advancedPersonality: false,
    speechHabits: "", characteristics: "", principles: "", humor: "",
    menuLinkStyle: "BUTTON",
    conversationalOrdering: false,
    orderHandlingMode: "LINK_ONLY",
  };

  const [settings, setSettings] = useState<AiSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const conn = selectedConn ?? connections[0] ?? null;

  useEffect(() => {
    if (!conn) return;
    setLoaded(false);
    api.get(`/whatsapp-ai/settings/${conn.id}`)
      .then((r) => { if (r.data) setSettings({ ...DEFAULT_SETTINGS, ...r.data }); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [conn?.id]);

  const save = async () => {
    if (!conn) return;
    setSaving(true);
    try {
      await api.put(`/whatsapp-ai/settings/${conn.id}`, settings);
      toast.success("Configurações salvas!");
      onRefresh();
    } catch { toast.error("Erro ao salvar"); }
    finally { setSaving(false); }
  };

  if (connections.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <Settings2 size={40} className="mx-auto mb-3 opacity-30" />
        <p className="font-semibold">Crie uma conexão primeiro</p>
        <p className="text-sm mt-1">Vá para a aba Conexões e adicione o WhatsApp</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Connection selector */}
      <div>
        <label className="text-xs text-slate-400 font-semibold mb-1.5 block">Configurando conexão</label>
        <select
          value={conn?.id ?? ""}
          onChange={(e) => onSelect(connections.find((c) => c.id === e.target.value)!)}
          className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500 w-full max-w-xs"
        >
          {connections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {!loaded ? (
        <div className="text-slate-500 text-sm flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Carregando...</div>
      ) : (
        <>
          {/* Mode */}
          <Card title="Modo de Atendimento" icon={<Bot size={16} />}>
            <div className="grid grid-cols-3 gap-3">
              {MODE_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setSettings({ ...settings, mode: m.value })}
                  className={`p-3 rounded-xl border text-left transition ${
                    settings.mode === m.value
                      ? "border-green-500 bg-green-900/20 text-white"
                      : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 font-semibold text-sm">
                    {m.icon} {m.label}
                  </div>
                  <p className="text-xs opacity-70">{m.desc}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* AI Provider */}
          <Card title="Provedor de IA" icon={<Zap size={16} />}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1.5 block">Provedor</label>
                <select
                  value={settings.aiProvider}
                  onChange={(e) => setSettings({ ...settings, aiProvider: e.target.value, aiModel: AI_MODELS[e.target.value]?.[0]?.value ?? "" })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500"
                >
                  {AI_PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1.5 block">Modelo</label>
                <select
                  value={settings.aiModel}
                  onChange={(e) => setSettings({ ...settings, aiModel: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500"
                >
                  {(AI_MODELS[settings.aiProvider] ?? []).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
          </Card>

          {/* Personality */}
          <Card title="Seu Atendente" icon={<User size={16} />}>
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1.5 block">Nome do Atendente</label>
                <input
                  value={settings.attendantName}
                  onChange={(e) => setSettings({ ...settings, attendantName: e.target.value })}
                  placeholder="Ex: Júlia, Kely, Ana..."
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500"
                />
                <p className="text-xs text-slate-500 mt-1">Este nome será usado pela IA ao se apresentar para os clientes</p>
              </div>

              {/* Response Style */}
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-2 block">Estilo de resposta</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "DIRECT", label: "Direto ao ponto", desc: "Respostas curtas e objetivas" },
                    { value: "CONVERSATIONAL", label: "Conversacional", desc: "Mais natural e elaborado" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSettings({ ...settings, responseStyle: opt.value })}
                      className={`p-3 rounded-xl border text-left transition ${
                        settings.responseStyle === opt.value
                          ? "border-green-500 bg-green-900/20 text-white"
                          : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className="text-xs opacity-70 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Personality Type */}
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-2 block">Personalidade principal</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "FRIENDLY", label: "😊 Amigável", desc: "Calorosa e acolhedora" },
                    { value: "PLAYFUL", label: "😄 Descontraída", desc: "Leve e bem-humorada" },
                    { value: "FORMAL", label: "🎩 Formal", desc: "Profissional e séria" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSettings({ ...settings, personalityType: opt.value })}
                      className={`p-3 rounded-xl border text-left transition ${
                        settings.personalityType === opt.value
                          ? "border-green-500 bg-green-900/20 text-white"
                          : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className="text-xs opacity-70 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Emoji Usage */}
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-2 block">Uso de emojis</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "NONE", label: "Nenhum", desc: "Sem emojis" },
                    { value: "MODERATE", label: "Moderado", desc: "Alguns emojis" },
                    { value: "ALWAYS", label: "Frequente", desc: "Muitos emojis 🎉" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSettings({ ...settings, emojiUsage: opt.value, useEmojis: opt.value !== "NONE" })}
                      className={`p-3 rounded-xl border text-left transition ${
                        settings.emojiUsage === opt.value
                          ? "border-green-500 bg-green-900/20 text-white"
                          : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className="text-xs opacity-70 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Personality Toggle */}
              <div className="border border-slate-700 rounded-xl overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-slate-800/50 cursor-pointer"
                  onClick={() => setSettings({ ...settings, advancedPersonality: !settings.advancedPersonality })}
                >
                  <div>
                    <p className="text-sm font-semibold text-white">Personalidade avançada</p>
                    <p className="text-xs text-slate-400">Defina vícios de linguagem, características e humor único</p>
                  </div>
                  {settings.advancedPersonality
                    ? <ToggleRight size={28} className="text-green-400 shrink-0" />
                    : <ToggleLeft size={28} className="text-slate-500 shrink-0" />}
                </div>
                {settings.advancedPersonality && (
                  <div className="p-3 space-y-3 bg-slate-900/50 border-t border-slate-700">
                    {[
                      { key: "speechHabits" as const, label: "Vícios de linguagem", placeholder: "Ex: Usa 'com certeza!', 'Boa escolha!'..." },
                      { key: "characteristics" as const, label: "Características", placeholder: "Ex: Sempre pergunta o nome do cliente no 1º contato..." },
                      { key: "principles" as const, label: "Princípios", placeholder: "Ex: Nunca menciona concorrentes. Sempre oferece alternativa..." },
                      { key: "humor" as const, label: "Humor / Tom", placeholder: "Ex: Levemente bem-humorada, usa trocadilhos com comida..." },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key}>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs text-slate-400 font-semibold">{label}</label>
                          <span className="text-xs text-slate-500">{(settings[key] ?? "").length}/150</span>
                        </div>
                        <textarea
                          value={settings[key] ?? ""}
                          onChange={(e) => setSettings({ ...settings, [key]: e.target.value.slice(0, 150) })}
                          rows={2}
                          placeholder={placeholder}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500 resize-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* System Prompt */}
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1.5 block">Prompt de Sistema (opcional — avançado)</label>
                <textarea
                  value={settings.systemPrompt ?? ""}
                  onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                  rows={4}
                  placeholder="Você é {attendantName}, atendente virtual de {empresa}. Seja amigável e objetivo..."
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500 resize-none"
                />
              </div>
            </div>
          </Card>

          {/* Orders & Menu */}
          <Card title="Pedidos e Cardápio" icon={<ShoppingBag size={16} />}>
            <div className="space-y-4">
              {/* Menu Link Style */}
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-2 block">Envio do cardápio</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "BUTTON", label: "🔘 Botão", desc: "Link como botão clicável" },
                    { value: "TEXT", label: "📝 Texto", desc: "Link embutido no texto" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSettings({ ...settings, menuLinkStyle: opt.value })}
                      className={`p-3 rounded-xl border text-left transition ${
                        settings.menuLinkStyle === opt.value
                          ? "border-green-500 bg-green-900/20 text-white"
                          : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className="text-xs opacity-70 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Conversational Ordering */}
              <div
                className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl cursor-pointer"
                onClick={() => setSettings({ ...settings, conversationalOrdering: !settings.conversationalOrdering })}
              >
                <div>
                  <p className="text-sm font-semibold text-white">Pedido conversacional</p>
                  <p className="text-xs text-slate-400">IA coleta os itens do pedido pela conversa, sem redirecionar ao cardápio</p>
                </div>
                {settings.conversationalOrdering
                  ? <ToggleRight size={28} className="text-green-400 shrink-0" />
                  : <ToggleLeft size={28} className="text-slate-500 shrink-0" />}
              </div>

              {/* Order Handling Mode */}
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-2 block">Retirada de pedidos</label>
                <div className="space-y-2">
                  {[
                    { value: "LINK_ONLY", label: "Apenas link do cardápio", desc: "Envia o link e encerra o atendimento" },
                    { value: "LINK_THEN_HUMAN_3", label: "Link + humano após 3 min", desc: "Aguarda 3 min e transfere se sem resposta" },
                    { value: "LINK_THEN_HUMAN_2", label: "Link + humano após 2 min", desc: "Aguarda 2 min e transfere se sem resposta" },
                    { value: "ALWAYS_HUMAN", label: "Sempre transferir para humano", desc: "Coleta dados e encaminha imediatamente" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSettings({ ...settings, orderHandlingMode: opt.value })}
                      className={`w-full p-3 rounded-xl border text-left transition flex items-start gap-3 ${
                        settings.orderHandlingMode === opt.value
                          ? "border-green-500 bg-green-900/20 text-white"
                          : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      <span className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        settings.orderHandlingMode === opt.value ? "border-green-400" : "border-slate-500"
                      }`}>
                        {settings.orderHandlingMode === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-green-400 block" />}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{opt.label}</p>
                        <p className="text-xs opacity-70">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Messages */}
          <Card title="Mensagens Padrão" icon={<MessageSquare size={16} />}>
            <div className="space-y-3">
              <TextAreaField
                label="Mensagem de boas-vindas"
                value={settings.greetingMessage ?? ""}
                onChange={(v) => setSettings({ ...settings, greetingMessage: v })}
                placeholder="Olá! 😊 Bem-vindo! Como posso te ajudar?"
              />
              <TextAreaField
                label="Mensagem fora do horário"
                value={settings.offlineMessage ?? ""}
                onChange={(v) => setSettings({ ...settings, offlineMessage: v })}
                placeholder="Estamos fechados. Voltamos às 08h!"
              />
              <Field
                label="Palavras que acionam atendimento humano (vírgula separado)"
                value={settings.transferKeywords ?? ""}
                onChange={(v) => setSettings({ ...settings, transferKeywords: v })}
                placeholder="humano, atendente, falar com pessoa"
              />
            </div>
          </Card>

          {/* Hours — removido daqui; fonte canônica é Company.businessHours */}
          <div className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm">
            <span className="text-slate-400 mt-0.5 shrink-0">🕐</span>
            <span className="text-slate-400 leading-relaxed">
              Os horários de atendimento da IA são gerenciados em{" "}
              <a
                href="/configuracoes?tab=loja"
                className="text-green-400 underline underline-offset-2 hover:text-green-300"
              >
                Configurações &rsaquo; Minha Loja
              </a>
              . Qualquer alteração lá reflete imediatamente no comportamento da Kely.
            </span>
          </div>

          {/* Delays */}
          <Card title="Humanização" icon={<Settings2 size={16} />}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1.5 block">
                  Delay de digitação fake: <span className="text-white">{settings.typingDelay}ms</span>
                </label>
                <input type="range" min={0} max={5000} step={100} value={settings.typingDelay}
                  onChange={(e) => setSettings({ ...settings, typingDelay: Number(e.target.value) })}
                  className="w-full accent-green-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1.5 block">
                  Delay entre mensagens: <span className="text-white">{settings.messageDelay}ms</span>
                </label>
                <input type="range" min={0} max={3000} step={100} value={settings.messageDelay}
                  onChange={(e) => setSettings({ ...settings, messageDelay: Number(e.target.value) })}
                  className="w-full accent-green-500" />
              </div>
            </div>
          </Card>

          <button
            onClick={save} disabled={saving}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition"
          >
            {saving ? "Salvando..." : "Salvar Configurações"}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Conversations Tab ────────────────────────────────────────────────────────

function ConversationsTab({ conversations, selectedConv, messages, manualText, setManualText, sending, onOpen, onSend, onToggleMode, messagesEndRef, onRefresh }: any) {
  return (
    <div className="flex gap-4 h-[calc(100vh-220px)]">
      {/* List */}
      <div className="w-72 shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-white text-sm">Conversas</h2>
          <button onClick={onRefresh} className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition">
            <RefreshCw size={13} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {conversations.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">Nenhuma conversa</div>
          ) : conversations.map((conv: Conversation) => (
            <button
              key={conv.id}
              onClick={() => onOpen(conv)}
              className={`w-full text-left p-3 rounded-xl border transition ${
                selectedConv?.id === conv.id
                  ? "border-green-600 bg-green-900/20"
                  : "border-slate-800 bg-slate-900 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-white text-sm truncate max-w-[140px]">
                  {conv.customerName ?? conv.customerPhone}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  conv.mode === "AI"    ? "bg-blue-900/40 text-blue-400" :
                  conv.mode === "HUMAN" ? "bg-amber-900/40 text-amber-400" :
                  "bg-slate-800 text-slate-400"
                }`}>
                  {conv.mode}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate">{conv.customerPhone}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">
                {conv._count?.messages ?? 0} msgs · {new Date(conv.lastMessageAt).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        {!selectedConv ? (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <div className="text-center">
              <MessageCircle size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Selecione uma conversa</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
              <div>
                <p className="font-bold text-white">{selectedConv.customerName ?? selectedConv.customerPhone}</p>
                <p className="text-xs text-slate-400">{selectedConv.customerPhone} · {selectedConv.status}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onToggleMode(selectedConv, selectedConv.mode === "AI" ? "HUMAN" : "AI")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    selectedConv.mode === "AI"
                      ? "bg-blue-900/40 border border-blue-700 text-blue-300 hover:bg-amber-900/40 hover:border-amber-700 hover:text-amber-300"
                      : "bg-amber-900/40 border border-amber-700 text-amber-300 hover:bg-blue-900/40 hover:border-blue-700 hover:text-blue-300"
                  }`}
                >
                  {selectedConv.mode === "AI" ? <><Bot size={12} /> IA ativa — Assumir</> : <><User size={12} /> Humano — Devolver IA</>}
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg: Message) => (
                <div key={msg.id} className={`flex ${msg.role === "USER" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === "USER"
                      ? "bg-slate-800 text-slate-200 rounded-bl-sm"
                      : msg.role === "ASSISTANT"
                      ? "bg-green-800/60 border border-green-700/40 text-white rounded-br-sm"
                      : "bg-slate-700/50 text-slate-400 text-xs italic"
                  }`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    <p className="text-[10px] opacity-40 mt-1 text-right">
                      {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-slate-800 flex gap-2">
              <input
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
                placeholder="Escrever mensagem como operador..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500"
              />
              <button
                onClick={onSend} disabled={sending || !manualText.trim()}
                className="w-10 h-10 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-40 flex items-center justify-center transition text-white"
              >
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────

function StatsTab({ stats }: { stats: Stats | null }) {
  if (!stats) return <div className="text-slate-500 text-sm">Carregando estatísticas...</div>;

  const cards = [
    { label: "Total de Conversas",   value: stats.totalConversations,  icon: <MessageCircle size={20} />, color: "blue" },
    { label: "Conversas Ativas",     value: stats.activeConversations,  icon: <Wifi size={20} />,          color: "green" },
    { label: "Atendimentos Humanos", value: stats.humanConversations,   icon: <User size={20} />,          color: "amber" },
    { label: "Mensagens Trocadas",   value: stats.totalMessages,        icon: <MessageSquare size={20} />, color: "purple" },
    { label: "Pedidos via IA",       value: stats.ordersCreated,        icon: <ShoppingBag size={20} />,   color: "emerald" },
  ];

  const colorMap: Record<string, string> = {
    blue:    "bg-blue-900/30 border-blue-800 text-blue-400",
    green:   "bg-green-900/30 border-green-800 text-green-400",
    amber:   "bg-amber-900/30 border-amber-800 text-amber-400",
    purple:  "bg-purple-900/30 border-purple-800 text-purple-400",
    emerald: "bg-emerald-900/30 border-emerald-800 text-emerald-400",
  };

  return (
    <div className="max-w-4xl">
      <h2 className="text-lg font-bold text-white mb-5">Painel de Estatísticas</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className={`border rounded-2xl p-4 ${colorMap[c.color]}`}>
            <div className="mb-3 opacity-80">{c.icon}</div>
            <p className="text-3xl font-black text-white mb-1">{c.value}</p>
            <p className="text-xs font-medium opacity-70 leading-snug">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-green-400" /> Taxa de Conversão</h3>
        {stats.totalConversations > 0 ? (
          <div className="space-y-3">
            <StatBar
              label="Pedidos gerados"
              value={stats.ordersCreated}
              total={stats.totalConversations}
              color="bg-green-500"
            />
            <StatBar
              label="Atendimento humano"
              value={stats.humanConversations}
              total={stats.totalConversations}
              color="bg-amber-500"
            />
            <StatBar
              label="Conversas ativas"
              value={stats.activeConversations}
              total={stats.totalConversations}
              color="bg-blue-500"
            />
          </div>
        ) : (
          <p className="text-slate-500 text-sm">Ainda não há dados suficientes.</p>
        )}
      </div>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-slate-400 font-semibold mb-1.5 block">{label}</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500"
      />
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-slate-400 font-semibold mb-1.5 block">{label}</label>
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} rows={2}
        className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500 resize-none"
      />
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-4">
        <span className="text-green-400">{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}

function StatBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="font-bold text-white">{value} ({pct}%)</span>
      </div>
      <div className="w-full bg-slate-800 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
