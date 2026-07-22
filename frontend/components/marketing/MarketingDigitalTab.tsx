"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";
import {
  Megaphone, Sparkles, Copy, Check, Clock, Users, Lightbulb,
  MessageCircle, ChevronDown, Trash2, History, Loader2, Zap,
  TrendingUp, Target, Package, Lock, Gauge,
} from "lucide-react";
// ─── Types ────────────────────────────────────────────────────────────────────

interface CampaignResult {
  nome_campanha:    string;
  copy_whatsapp:    string;
  sugestao_publico: string;
  melhor_horario:   string;
  insight_ia:       string;
}

interface SavedCampaign extends CampaignResult {
  id:        string;
  createdAt: string;
  produto:   string;
  objetivo:  string;
}

interface Product {
  id:        string;
  name:      string;
  salePrice: number | string;
  sizes?:    { size: string; price: number }[];
}

interface CampaignUsage {
  used:      number;
  limit:     number;
  remaining: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OBJETIVOS = [
  "Recuperar clientes sumidos",
  "Queimar estoque",
  "Vender em dia frio",
  "Lançamento de produto",
  "Promoção relâmpago",
  "Aumentar ticket médio",
  "Fidelizar clientes",
  "Divulgar novidade",
];

const TONS = [
  "Descontraído",
  "Urgente",
  "Profissional",
  "Animado",
  "Exclusivo",
  "Amigável",
];

const inp =
  "w-full bg-white border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 " +
  "rounded-xl px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder-gray-400";

const sel = inp + " appearance-none cursor-pointer";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketingDigitalTab() {
  const { user } = useAuthStore();

  // Products fetched from API
  const [products, setProducts] = useState<Product[]>([]);

  // Form state
  const [tipoNegocio,   setTipoNegocio]   = useState("Restaurante");
  const [objetivo,      setObjetivo]       = useState(OBJETIVOS[0]);
  const [produto,       setProduto]        = useState("");
  const [produtoCustom, setProdutoCustom]  = useState("");
  const [precoDe,       setPrecoDe]        = useState("");
  const [precoPor,      setPrecoPor]       = useState("");
  const [tomVoz,        setTomVoz]         = useState(TONS[0]);
  const [contexto,      setContexto]       = useState("");

  // UI state
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<CampaignResult | null>(null);
  const [copied,    setCopied]    = useState(false);
  const [history,   setHistory]   = useState<SavedCampaign[]>([]);
  const [showHist,  setShowHist]  = useState(false);
  const [usage,     setUsage]     = useState<CampaignUsage | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const loadUsage = useCallback(() => {
    api.get<CampaignUsage>("/marketing/campaign/usage")
      .then((r) => setUsage(r.data))
      .catch(() => {});
  }, []);

  // ── Load products, history & limite diário ───────────────────────────────

  useEffect(() => {
    api.get<Product[]>("/products")
      .then((r) => setProducts(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});

    try {
      const raw = localStorage.getItem("mkt_campaigns");
      if (raw) setHistory(JSON.parse(raw));
    } catch {}

    loadUsage();
  }, [loadUsage]);

  // ── Auto-fill price when product is selected ─────────────────────────────

  useEffect(() => {
    if (!produto) { setPrecoDe(""); return; }
    const found = products.find((p) => p.id === produto);
    if (!found) return;
    if (found.sizes && found.sizes.length > 0) {
      const min = Math.min(...found.sizes.map((s) => Number(s.price)));
      setPrecoDe(min.toFixed(2));
    } else {
      setPrecoDe(Number(found.salePrice).toFixed(2));
    }
  }, [produto, products]);

  // ── Generate ─────────────────────────────────────────────────────────────

  async function generate() {
    const nomeProduto = produto
      ? products.find((p) => p.id === produto)?.name ?? produtoCustom
      : produtoCustom;

    if (!nomeProduto) { toast.error("Informe o produto"); return; }
    if (!precoDe)     { toast.error("Informe o preço original"); return; }
    if (usage && usage.remaining <= 0) {
      toast.error(`Limite diário de ${usage.limit} campanhas atingido. Volte amanhã.`);
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post<CampaignResult>("/marketing/campaign/generate", {
        tipoNegocio,
        objetivo,
        produto:       nomeProduto,
        precoDe,
        precoPor:      precoPor || undefined,
        tomVoz,
        contextoExtra: contexto || undefined,
      });

      setResult(data);
      loadUsage();

      // Save to history
      const saved: SavedCampaign = {
        ...data,
        id:        Date.now().toString(),
        createdAt: new Date().toISOString(),
        produto:   nomeProduto,
        objetivo,
      };
      setHistory((prev) => {
        const next = [saved, ...prev].slice(0, 10);
        localStorage.setItem("mkt_campaigns", JSON.stringify(next));
        return next;
      });

      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao gerar campanha");
      if (e?.response?.status === 429) loadUsage();
    } finally {
      setLoading(false);
    }
  }

  function copyWhatsApp() {
    if (!result) return;
    navigator.clipboard.writeText(result.copy_whatsapp).then(() => {
      setCopied(true);
      toast.success("Copiado para a área de transferência!");
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function loadFromHistory(c: SavedCampaign) {
    setResult(c);
    setShowHist(false);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function clearHistory() {
    if (!confirm("Apagar todo o histórico?")) return;
    setHistory([]);
    localStorage.removeItem("mkt_campaigns");
  }

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-200">
              <Megaphone size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Marketing Digital</h1>
              <p className="text-gray-500 text-sm">Gere campanhas prontas para WhatsApp com IA</p>
            </div>
          </div>

          {/* History toggle */}
          {history.length > 0 && (
            <button
              onClick={() => setShowHist((s) => !s)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-sm font-semibold transition"
            >
              <History size={15} />
              Histórico ({history.length})
              <ChevronDown size={14} className={`transition-transform ${showHist ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        {/* Limite diário de campanhas IA */}
        {usage && (
          <div
            className={`flex items-center gap-3 rounded-2xl border p-3.5 mb-6 text-sm ${
              usage.remaining <= 0
                ? "bg-red-50 border-red-200 text-red-700"
                : usage.remaining === 1
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-violet-50 border-violet-100 text-violet-700"
            }`}
          >
            {usage.remaining <= 0 ? <Lock size={16} className="shrink-0" /> : <Gauge size={16} className="shrink-0" />}
            <p className="font-semibold flex-1">
              {usage.remaining <= 0
                ? `Limite diário atingido — você já gerou ${usage.used} de ${usage.limit} campanhas hoje. Volte amanhã.`
                : `Você já usou ${usage.used} de ${usage.limit} campanhas de IA hoje (${usage.remaining} ${usage.remaining === 1 ? "restante" : "restantes"}).`}
            </p>
          </div>
        )}

        {/* History panel */}
        {showHist && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-gray-700">Campanhas anteriores</h3>
              <button onClick={clearHistory} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition">
                <Trash2 size={12} /> Limpar
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {history.map((c) => (
                <button
                  key={c.id}
                  onClick={() => loadFromHistory(c)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 border border-gray-100 transition group"
                >
                  <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center shrink-0">
                    <Megaphone size={14} className="text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{c.nome_campanha}</p>
                    <p className="text-xs text-gray-400 truncate">{c.produto} · {c.objetivo}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── LEFT: Form ────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="font-black text-gray-900 text-base flex items-center gap-2">
              <Target size={16} className="text-violet-500" /> Configurar campanha
            </h2>

            {/* Tipo de negócio */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                Tipo de negócio
              </label>
              <input
                value={tipoNegocio}
                onChange={(e) => setTipoNegocio(e.target.value)}
                placeholder="Ex: Pizzaria, Hamburgueria, Sushi..."
                className={inp}
              />
            </div>

            {/* Objetivo */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                Objetivo da campanha
              </label>
              <div className="relative">
                <select value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className={sel}>
                  {OBJETIVOS.map((o) => <option key={o}>{o}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Produto */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                Produto / item foco
              </label>
              {products.length > 0 ? (
                <div className="space-y-2">
                  <div className="relative">
                    <select value={produto} onChange={(e) => setProduto(e.target.value)} className={sel}>
                      <option value="">— Digitar manualmente —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <Package size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                  {!produto && (
                    <input
                      value={produtoCustom}
                      onChange={(e) => setProdutoCustom(e.target.value)}
                      placeholder="Nome do produto..."
                      className={inp}
                    />
                  )}
                </div>
              ) : (
                <input
                  value={produtoCustom}
                  onChange={(e) => setProdutoCustom(e.target.value)}
                  placeholder="Nome do produto..."
                  className={inp}
                />
              )}
            </div>

            {/* Preços */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Preço original (R$) *
                </label>
                <input
                  type="number" min={0} step="0.01"
                  value={precoDe}
                  onChange={(e) => setPrecoDe(e.target.value)}
                  placeholder="45,00"
                  className={inp}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Preço promo (R$)
                </label>
                <input
                  type="number" min={0} step="0.01"
                  value={precoPor}
                  onChange={(e) => setPrecoPor(e.target.value)}
                  placeholder="35,00"
                  className={inp}
                />
              </div>
            </div>

            {/* Tom de voz */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                Tom de voz da marca
              </label>
              <div className="flex flex-wrap gap-2">
                {TONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTomVoz(t)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      tomVoz === t
                        ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                        : "bg-white text-gray-600 border-gray-200 hover:border-violet-300"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Contexto extra */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                Contexto adicional (opcional)
              </label>
              <textarea
                value={contexto}
                onChange={(e) => setContexto(e.target.value)}
                placeholder="Ex: Dia chuvoso, semana do aniversário, clientes da zona sul..."
                rows={2}
                className={inp + " resize-none"}
              />
            </div>

            {/* Generate button */}
            <button
              onClick={generate}
              disabled={loading || !!(usage && usage.remaining <= 0)}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-sm transition shadow-lg shadow-violet-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Gerando campanha...</>
              ) : usage && usage.remaining <= 0 ? (
                <><Lock size={16} /> Limite diário atingido</>
              ) : (
                <><Sparkles size={16} /> Gerar Campanha com IA</>
              )}
            </button>
          </div>

          {/* ── RIGHT: Result ──────────────────────────────────────────────── */}
          <div ref={resultRef}>
            {!result && !loading && (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 h-full min-h-[320px] flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center">
                  <Megaphone size={28} className="text-violet-300" />
                </div>
                <div>
                  <p className="font-bold text-gray-500">Campanha aparecerá aqui</p>
                  <p className="text-sm text-gray-400 mt-1">Preencha o formulário e clique em "Gerar Campanha"</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="bg-white rounded-2xl border border-gray-200 h-full min-h-[320px] flex flex-col items-center justify-center gap-4 p-8">
                <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center animate-pulse">
                  <Sparkles size={28} className="text-violet-500" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-700">IA trabalhando...</p>
                  <p className="text-sm text-gray-400 mt-1">Analisando seus dados e criando a campanha perfeita</p>
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="space-y-4">
                {/* Campaign name badge */}
                <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-2xl p-4 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap size={14} className="text-yellow-300" />
                    <span className="text-xs font-bold text-violet-200 uppercase tracking-wide">Campanha gerada</span>
                  </div>
                  <h3 className="font-black text-lg leading-tight">{result.nome_campanha}</h3>
                </div>

                {/* WhatsApp copy */}
                <div className="bg-[#075E54]/5 border border-[#075E54]/20 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle size={15} className="text-[#25D366]" />
                      <span className="text-xs font-black text-gray-700 uppercase tracking-wide">Copy WhatsApp</span>
                    </div>
                    <button
                      onClick={copyWhatsApp}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        copied
                          ? "bg-green-500 text-white"
                          : "bg-[#25D366] text-white hover:bg-[#128C7E]"
                      }`}
                    >
                      {copied ? <><Check size={12} /> Copiado!</> : <><Copy size={12} /> Copiar</>}
                    </button>
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap bg-white rounded-xl p-3 border border-gray-100">
                    {result.copy_whatsapp}
                  </p>
                </div>

                {/* Cards row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <InfoCard
                    icon={<Users size={14} className="text-blue-500" />}
                    title="Público-alvo"
                    value={result.sugestao_publico}
                    color="border-blue-100 bg-blue-50/50"
                  />
                  <InfoCard
                    icon={<Clock size={14} className="text-amber-500" />}
                    title="Melhor horário"
                    value={result.melhor_horario}
                    color="border-amber-100 bg-amber-50/50"
                  />
                  <InfoCard
                    icon={<Lightbulb size={14} className="text-emerald-500" />}
                    title="Insight IA"
                    value={result.insight_ia}
                    color="border-emerald-100 bg-emerald-50/50"
                  />
                </div>

                {/* Regen button */}
                <button
                  onClick={generate}
                  disabled={loading || !!(usage && usage.remaining <= 0)}
                  className="w-full py-2.5 rounded-xl border border-violet-200 text-violet-600 text-sm font-bold hover:bg-violet-50 disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {usage && usage.remaining <= 0 ? (
                    <><Lock size={14} /> Limite diário atingido</>
                  ) : (
                    <><TrendingUp size={14} /> Gerar nova variação</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── InfoCard ──────────────────────────────────────────────────────────────────

function InfoCard({
  icon, title, value, color,
}: {
  icon:  React.ReactNode;
  title: string;
  value: string;
  color: string;
}) {
  return (
    <div className={`rounded-xl border p-3.5 ${color}`}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{title}</span>
      </div>
      <p className="text-xs text-gray-700 leading-relaxed">{value}</p>
    </div>
  );
}
