"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingBag,
  Receipt, AlertTriangle, Bot, Send, RefreshCw,
  BarChart2, Package, Bell, ChevronRight, X, Loader2,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { api } from "@/services/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type DatePreset = "today" | "week" | "month" | "custom";

interface Kpis {
  revenue: number; revenueGrowth: number;
  grossProfit: number; grossMargin: number;
  orderCount: number; orderGrowth: number;
  avgTicket: number; ticketGrowth: number;
  cmv: number; cmvRatio: number; cancelRate: number;
  topProducts: { productName: string; revenue: number; profit: number; margin: number; quantity: number }[];
  last30Days: { date: string; revenue: number; orders: number }[];
}

interface RevenueReport {
  totalRevenue: number; totalCmv: number; grossProfit: number; grossMargin: number;
  orderCount: number; avgTicket: number; cancelledCount: number;
  byPaymentMethod: Record<string, number>;
  dailySeries: { date: string; revenue: number; cmv: number; profit: number; orders: number }[];
}

interface Alert { id: string; type: string; severity: string; title: string; message: string; read: boolean; createdAt: string; }
interface AiMessage { role: "USER" | "ASSISTANT"; content: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

function presetRange(preset: DatePreset, custom: { from: string; to: string }) {
  const now = new Date();
  if (preset === "today") {
    const d = fmtDate(now);
    return { from: d, to: d };
  }
  if (preset === "week") {
    const f = new Date(now); f.setDate(now.getDate() - 7);
    return { from: fmtDate(f), to: fmtDate(now) };
  }
  if (preset === "month") {
    const f = new Date(now); f.setDate(now.getDate() - 30);
    return { from: fmtDate(f), to: fmtDate(now) };
  }
  return custom;
}

function GrowthBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${positive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
      {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {positive ? "+" : ""}{pct(value)}
    </span>
  );
}

function KpiCard({ icon, label, value, growth, sub }: { icon: React.ReactNode; label: string; value: string; growth?: number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{label}</span>
        <span className="text-primary">{icon}</span>
      </div>
      <div className="text-2xl font-black text-gray-900">{value}</div>
      <div className="flex items-center gap-2">
        {growth !== undefined && <GrowthBadge value={growth} />}
        {sub && <span className="text-xs text-gray-400">{sub}</span>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BIPage() {
  const [tab, setTab] = useState<"dashboard" | "reports" | "ia" | "alerts">("dashboard");
  const [preset, setPreset] = useState<DatePreset>("month");
  const [custom, setCustom] = useState({ from: fmtDate(new Date()), to: fmtDate(new Date()) });

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [revenue, setRevenue] = useState<RevenueReport | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);

  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const range = presetRange(preset, custom);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, revRes, alertRes] = await Promise.allSettled([
        api.get("/reports/executive"),
        api.get(`/reports/revenue?from=${range.from}&to=${range.to}`),
        api.get("/alerts?unread=false"),
      ]);
      if (kpiRes.status   === "fulfilled") setKpis(kpiRes.value.data);
      if (revRes.status   === "fulfilled") setRevenue(revRes.value.data);
      if (alertRes.status === "fulfilled") setAlerts(alertRes.value.data ?? []);
    } catch {}
    setLoading(false);
  }, [range.from, range.to]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [aiMessages]);

  async function sendMessage() {
    if (!aiInput.trim() || aiLoading) return;
    const question = aiInput.trim();
    setAiInput("");
    setAiMessages((prev) => [...prev, { role: "USER", content: question }]);
    setAiLoading(true);
    try {
      const res = await api.post("/ia/ask", { question, conversationId });
      setConversationId(res.data.conversationId);
      setAiMessages((prev) => [...prev, { role: "ASSISTANT", content: res.data.answer }]);
    } catch {
      setAiMessages((prev) => [...prev, { role: "ASSISTANT", content: "Erro ao conectar com o assistente. Tente novamente." }]);
    }
    setAiLoading(false);
  }

  async function markAlertRead(id: string) {
    await api.patch(`/alerts/${id}/read`);
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, read: true } : a));
  }

  const TABS = [
    { key: "dashboard", label: "Dashboard", icon: <BarChart2 size={14} /> },
    { key: "reports", label: "Relatórios", icon: <Receipt size={14} /> },
    { key: "ia", label: "Consultora IA", icon: <Bot size={14} /> },
    { key: "alerts", label: `Alertas ${alerts.filter(a => !a.read).length > 0 ? `(${alerts.filter(a => !a.read).length})` : ""}`, icon: <Bell size={14} /> },
  ] as const;

  const PRESETS: { key: DatePreset; label: string }[] = [
    { key: "today", label: "Hoje" },
    { key: "week", label: "7 dias" },
    { key: "month", label: "30 dias" },
    { key: "custom", label: "Personalizado" },
  ];

  return (
    <div className="min-h-screen bg-[#F5F3EF] p-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Central de Inteligência</h1>
          <p className="text-sm text-gray-500 mt-0.5">BI · Relatórios · IA · Alertas</p>
        </div>
        <button onClick={loadDashboard} className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Atualizar
        </button>
      </div>

      {/* Date range controls */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${preset === p.key ? "bg-primary text-white shadow-md shadow-primary/30" : "bg-white text-gray-600 border border-gray-200 hover:border-primary/40"}`}
          >
            {p.label}
          </button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5">
            <input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="text-xs border-none outline-none bg-transparent" />
            <span className="text-gray-400 text-xs">até</span>
            <input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="text-xs border-none outline-none bg-transparent" />
          </div>
        )}
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1 mb-6 shadow-sm w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${tab === t.key ? "bg-primary text-white shadow-md shadow-primary/20" : "text-gray-500 hover:text-gray-800"}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Dashboard Tab ── */}
      {tab === "dashboard" && (
        <div className="space-y-6">
          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={<DollarSign size={16} />} label="Faturamento" value={fmt(kpis?.revenue ?? 0)} growth={kpis?.revenueGrowth} sub="vs período anterior" />
            <KpiCard icon={<TrendingUp size={16} />} label="Lucro Bruto" value={fmt(kpis?.grossProfit ?? 0)} sub={`Margem ${pct(kpis?.grossMargin ?? 0)}`} />
            <KpiCard icon={<ShoppingBag size={16} />} label="Pedidos" value={String(kpis?.orderCount ?? 0)} growth={kpis?.orderGrowth} />
            <KpiCard icon={<Receipt size={16} />} label="Ticket Médio" value={fmt(kpis?.avgTicket ?? 0)} growth={kpis?.ticketGrowth} />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">CMV</p>
              <p className="text-xl font-black text-gray-900">{pct(kpis?.cmvRatio ?? 0)}</p>
              <p className="text-xs text-gray-400 mt-1">{fmt(kpis?.cmv ?? 0)}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Cancelamentos</p>
              <p className={`text-xl font-black ${(kpis?.cancelRate ?? 0) > 0.15 ? "text-red-600" : "text-gray-900"}`}>{pct(kpis?.cancelRate ?? 0)}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Alertas Ativos</p>
              <p className={`text-xl font-black ${alerts.filter(a => !a.read).length > 0 ? "text-amber-600" : "text-gray-900"}`}>{alerts.filter(a => !a.read).length}</p>
            </div>
          </div>

          {/* Revenue chart */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 text-sm">Faturamento · CMV · Lucro (período)</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenue?.dailySeries ?? []} margin={{ left: 0, right: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={(d) => d} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenue" name="Faturamento" fill="#f97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cmv" name="CMV" fill="#fcd34d" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Lucro" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top products */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 text-sm flex items-center gap-2"><Package size={14} /> Top Produtos (30 dias)</h3>
            <div className="space-y-2">
              {(kpis?.topProducts ?? []).slice(0, 8).map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="flex-1 text-sm text-gray-700 truncate font-medium">{p.productName}</span>
                  <span className="text-sm font-bold text-gray-900">{fmt(p.revenue)}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.margin > 0.4 ? "bg-emerald-100 text-emerald-700" : p.margin > 0.2 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}`}>{pct(p.margin)}</span>
                </div>
              ))}
              {(kpis?.topProducts ?? []).length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sem dados no período</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── Reports Tab ── */}
      {tab === "reports" && (
        <div className="space-y-6">
          {/* Revenue breakdown */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 text-sm">Receita por Método de Pagamento</h3>
            {revenue && Object.keys(revenue.byPaymentMethod).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(revenue.byPaymentMethod).sort(([, a], [, b]) => b - a).map(([method, value]) => {
                  const pctVal = revenue.totalRevenue > 0 ? value / revenue.totalRevenue : 0;
                  const labels: Record<string, string> = { PIX: "Pix", CASH: "Dinheiro", CREDIT_CARD: "Crédito", DEBIT_CARD: "Débito", TRANSFER: "Transferência" };
                  return (
                    <div key={method}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 font-medium">{labels[method] ?? method}</span>
                        <span className="font-bold text-gray-900">{fmt(value)} <span className="text-gray-400 font-normal">({pct(pctVal)})</span></span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pctVal * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-sm text-gray-400 text-center py-6">Sem dados no período</p>}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Faturamento", value: fmt(revenue?.totalRevenue ?? 0) },
              { label: "CMV Total", value: fmt(revenue?.totalCmv ?? 0) },
              { label: "Lucro Bruto", value: fmt(revenue?.grossProfit ?? 0) },
              { label: "Pedidos", value: String(revenue?.orderCount ?? 0) },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 font-semibold">{c.label}</p>
                <p className="text-lg font-black text-gray-900">{c.value}</p>
              </div>
            ))}
          </div>

          {/* Line chart evolution */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 text-sm">Evolução de Pedidos</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={revenue?.dailySeries ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="orders" name="Pedidos" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── IA Tab ── */}
      {tab === "ia" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[600px]">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/30">
              <Bot size={16} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Consultora IA</p>
              <p className="text-xs text-gray-400">Análise inteligente do seu negócio</p>
            </div>
            {conversationId && (
              <button onClick={() => { setAiMessages([]); setConversationId(null); }} className="ml-auto text-gray-400 hover:text-gray-600 transition">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {aiMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <Bot size={24} className="text-primary" />
                </div>
                <div>
                  <p className="font-bold text-gray-800">Olá! Sou sua Consultora de IA</p>
                  <p className="text-sm text-gray-500 mt-1 max-w-xs">Analiso os dados do seu negócio em tempo real. Pergunte sobre faturamento, produtos, estratégias e muito mais.</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {["Como melhorar minha margem?", "Quais produtos vender mais?", "Análise de cancelamentos", "Sugestão de promoção"].map((s) => (
                    <button key={s} onClick={() => { setAiInput(s); }} className="text-xs bg-primary/5 text-primary border border-primary/20 px-3 py-1.5 rounded-xl hover:bg-primary/10 transition font-medium">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {aiMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${m.role === "USER" ? "bg-primary text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2 text-gray-500 text-sm">
                  <Loader2 size={14} className="animate-spin" /> Analisando...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="flex gap-2">
              <input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Pergunte sobre seu negócio..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
              />
              <button
                onClick={sendMessage}
                disabled={!aiInput.trim() || aiLoading}
                className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-md shadow-primary/30 disabled:opacity-40 transition hover:bg-primary/90"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Alerts Tab ── */}
      {tab === "alerts" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">{alerts.filter(a => !a.read).length} alertas não lidos</p>
            {alerts.some(a => !a.read) && (
              <button onClick={async () => { await api.patch("/alerts/read-all"); setAlerts(prev => prev.map(a => ({ ...a, read: true }))); }} className="text-xs text-primary font-bold hover:underline">
                Marcar todos como lidos
              </button>
            )}
          </div>
          {alerts.length === 0 && (
            <div className="bg-white rounded-2xl p-10 text-center border border-gray-100 shadow-sm">
              <Bell size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Nenhum alerta no momento</p>
              <p className="text-xs text-gray-400 mt-1">Os alertas são gerados automaticamente pelo sistema</p>
            </div>
          )}
          {alerts.map((alert) => {
            const colors: Record<string, string> = { CRITICAL: "border-red-300 bg-red-50", WARNING: "border-amber-300 bg-amber-50", INFO: "border-blue-300 bg-blue-50" };
            const icons: Record<string, string> = { CRITICAL: "text-red-600", WARNING: "text-amber-600", INFO: "text-blue-600" };
            return (
              <div key={alert.id} className={`border rounded-2xl p-4 ${colors[alert.severity] ?? "border-gray-200 bg-white"} ${alert.read ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${icons[alert.severity] ?? "text-gray-600"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 text-sm">{alert.title}</p>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${alert.severity === "CRITICAL" ? "bg-red-200 text-red-800" : alert.severity === "WARNING" ? "bg-amber-200 text-amber-800" : "bg-blue-200 text-blue-800"}`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(alert.createdAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                  {!alert.read && (
                    <button onClick={() => markAlertRead(alert.id)} className="shrink-0 text-xs text-gray-400 hover:text-gray-700 transition font-medium">
                      Lido
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
