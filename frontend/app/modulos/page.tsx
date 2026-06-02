"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, Check, ChevronRight, Sparkles, Shield, CreditCard, Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/services/api";

import { HeroModules } from "@/components/modulos/HeroModules";
import { ModuleGrid, CatKey } from "@/components/modulos/ModuleGrid";
import { BillingPeriod } from "@/components/modulos/PricingSelector";
import { AnalyticsOrb } from "@/components/modulos/AnalyticsOrb";
import type { Mod } from "@/components/modulos/ModuleCard";

// ─── Static catalog ───────────────────────────────────────────────────────────
// CompanyModule from /company/:id has no catalog fields (name, description, etc.)
// This map provides them so cards render correctly regardless of backend join.
const MODULE_CATALOG: Record<string, Partial<Mod>> = {
  // Default modules (created at signup — uppercase slugs)
  "TABLES":   { name: "Mesas",       icon: "🪑", category: "OPERACAO",    price: null, isFree: true,  description: "Gestão de mesas e comanda digital",            benefits: ["Abertura e fechamento de mesa", "Pedidos por mesa", "QR Code de mesa"],                       badge: null, badgeColor: null, isHighlighted: false, sortOrder: 1 },
  "CASH":     { name: "Caixa",       icon: "💰", category: "FINANCEIRO",  price: null, isFree: true,  description: "Controle de abertura e fechamento de caixa",   benefits: ["Abertura/fechamento de caixa", "Sangria e suprimento", "Relatório diário"],                   badge: null, badgeColor: null, isHighlighted: false, sortOrder: 2 },
  "FINANCIAL":{ name: "Financeiro",  icon: "📊", category: "FINANCEIRO",  price: null, isFree: true,  description: "Gestão financeira completa",                   benefits: ["Extrato financeiro", "Entradas e saídas", "Resumo por período"],                            badge: null, badgeColor: null, isHighlighted: false, sortOrder: 3 },
  "STOCK":    { name: "Estoque",     icon: "📦", category: "OPERACAO",    price: null, isFree: true,  description: "Controle de estoque e movimentações",          benefits: ["Movimentações de estoque", "Alertas de mínimo", "Histórico completo"],                       badge: null, badgeColor: null, isHighlighted: false, sortOrder: 4 },
  "RECIPES":  { name: "Receitas",    icon: "📋", category: "OPERACAO",    price: null, isFree: true,  description: "Fichas técnicas de produtos",                  benefits: ["Fichas técnicas", "CMV automático", "Custo por produto"],                                   badge: null, badgeColor: null, isHighlighted: false, sortOrder: 5 },
  "DELIVERY": { name: "Delivery",    icon: "🛵", category: "OPERACAO",    price:   29, isFree: false, description: "Gestão de entregadores e zonas de entrega",    benefits: ["Zonas de entrega", "Gestão de entregadores", "Taxa automática por bairro"],                 badge: null, badgeColor: null, isHighlighted: false, sortOrder: 6 },
  // Named slugs (from Module catalog)
  "delivery":            { name: "Delivery",               icon: "🛵", category: "OPERACAO",    price:   29, isFree: false, description: "Gestão de entregadores e zonas de entrega",    benefits: ["Zonas de entrega", "Gestão de entregadores", "Rastreamento"],           badge: null,       badgeColor: null,     isHighlighted: false, sortOrder: 6 },
  "cardapio-ia":         { name: "Cardápio IA",            icon: "🤖", category: "AUTOMACAO",   price:   49, isFree: false, description: "Atendimento inteligente no cardápio digital",  benefits: ["Chat IA no cardápio", "Sugestões automáticas", "Atendimento 24h"],     badge: "Popular",  badgeColor: "blue",   isHighlighted: true,  sortOrder: 7 },
  "whatsapp-ia":         { name: "WhatsApp IA",            icon: "💬", category: "AUTOMACAO",   price:   79, isFree: false, description: "Atendimento automático via WhatsApp",          benefits: ["IA no WhatsApp", "Pedidos via chat", "Transferência para humano"],    badge: "Novo",     badgeColor: "purple", isHighlighted: true,  sortOrder: 8 },
  "fidelidade":          { name: "Fidelidade",             icon: "⭐", category: "MARKETING",   price:   19, isFree: false, description: "Programa de fidelidade e cashback",            benefits: ["Pontos por compra", "Cashback automático", "Cupons de recompensa"],   badge: null,       badgeColor: null,     isHighlighted: false, sortOrder: 9 },
  "cupons":              { name: "Cupons",                 icon: "🎁", category: "MARKETING",   price:    9, isFree: false, description: "Sistema de cupons de desconto",                benefits: ["Cupons de desconto", "Frete grátis", "Desconto percentual"],          badge: null,       badgeColor: null,     isHighlighted: false, sortOrder: 10 },
  "meta-pixel":          { name: "Meta Pixel",             icon: "📱", category: "MARKETING",   price:    9, isFree: false, description: "Integração com Facebook/Instagram Ads",        benefits: ["Pixel do Facebook", "Rastreamento de conversões", "Retargeting"],    badge: null,       badgeColor: null,     isHighlighted: false, sortOrder: 11 },
  "google-analytics":    { name: "Google Analytics",       icon: "📈", category: "MARKETING",   price:    9, isFree: false, description: "Analytics avançado do cardápio digital",       benefits: ["GA4 no cardápio", "Relatórios de tráfego", "Conversões"],            badge: null,       badgeColor: null,     isHighlighted: false, sortOrder: 12 },
  "nfce":                { name: "NFC-e",                  icon: "🧾", category: "FINANCEIRO",  price:   59, isFree: false, description: "Emissão de nota fiscal eletrônica",            benefits: ["Emissão de NFC-e", "SEFAZ integrado", "Impressão automática"],        badge: "Em breve", badgeColor: "orange", isHighlighted: false, sortOrder: 13 },
  "fluxo-caixa":         { name: "Fluxo de Caixa",         icon: "💸", category: "FINANCEIRO",  price:   29, isFree: false, description: "Projeção e análise do fluxo financeiro",       benefits: ["Projeção de caixa", "Análise de tendências", "Exportação Excel"],    badge: null,       badgeColor: null,     isHighlighted: false, sortOrder: 14 },
  "dashboard-financeiro":{ name: "Dashboard Financeiro",   icon: "📉", category: "FINANCEIRO",  price:   29, isFree: false, description: "Painel financeiro visual e interativo",        benefits: ["KPIs em tempo real", "Gráficos de vendas", "Comparativo mensal"],     badge: null,       badgeColor: null,     isHighlighted: false, sortOrder: 15 },
  "dre":                 { name: "DRE",                    icon: "📑", category: "FINANCEIRO",  price:   39, isFree: false, description: "Demonstrativo de resultado do exercício",      benefits: ["DRE automatizado", "CMV detalhado", "Margem por produto"],           badge: null,       badgeColor: null,     isHighlighted: false, sortOrder: 16 },
  "pix-automatico":      { name: "Pix Automático",         icon: "⚡", category: "FINANCEIRO",  price:   19, isFree: false, description: "Geração automática de QR Code Pix",            benefits: ["QR Code Pix automático", "Confirmação em tempo real", "Webhook"],    badge: null,       badgeColor: null,     isHighlighted: false, sortOrder: 17 },
  "relatorios-avancados":{ name: "Relatórios Avançados",   icon: "🔬", category: "FINANCEIRO",  price:   29, isFree: false, description: "BI completo com gráficos e análises",          benefits: ["Dashboard BI", "Relatórios PDF", "Análise por período"],             badge: null,       badgeColor: null,     isHighlighted: false, sortOrder: 18 },
  "crm-whatsapp":        { name: "CRM WhatsApp",           icon: "📞", category: "MARKETING",   price:   49, isFree: false, description: "Relacionamento com clientes via WhatsApp",     benefits: ["Histórico de conversas", "Campanhas de marketing", "Segmentação"],  badge: null,       badgeColor: null,     isHighlighted: false, sortOrder: 19 },
  "recuperacao-clientes":{ name: "Recuperação de Clientes",icon: "🔔", category: "MARKETING",   price:   29, isFree: false, description: "Reengajamento automático de clientes inativos",benefits: ["Campanhas de retorno", "Aniversariantes", "Clientes sem pedido"],   badge: null,       badgeColor: null,     isHighlighted: false, sortOrder: 20 },
  "automacao-marketing": { name: "Automação de Marketing", icon: "🚀", category: "MARKETING",   price:   39, isFree: false, description: "Campanhas automáticas para clientes",          benefits: ["Campanhas automáticas", "Aniversariantes", "Reengajamento"],         badge: null,       badgeColor: null,     isHighlighted: false, sortOrder: 21 },
  "multi-loja":          { name: "Multi-loja",             icon: "🏪", category: "OPERACAO",    price:   99, isFree: false, description: "Gestão de múltiplas unidades",                 benefits: ["Múltiplas unidades", "Gestão centralizada", "Relatórios consolidados"],badge:"Enterprise",badgeColor: "purple", isHighlighted: true,  sortOrder: 22 },
  "ifood":               { name: "iFood",                  icon: "🍔", category: "AUTOMACAO",   price:   49, isFree: false, description: "Integração com o marketplace iFood",           benefits: ["Sincronização de cardápio", "Pedidos automáticos", "Status real-time"],badge:"Em breve", badgeColor: "orange", isHighlighted: false, sortOrder: 23 },
  "99food":              { name: "99food",                  icon: "🛺", category: "AUTOMACAO",   price:   49, isFree: false, description: "Integração com o marketplace 99food",          benefits: ["Sincronização de cardápio", "Pedidos automáticos"],                   badge:"Em breve", badgeColor: "orange", isHighlighted: false, sortOrder: 24 },
  "webhooks":            { name: "Webhooks",               icon: "🔗", category: "AUTOMACAO",   price:   19, isFree: false, description: "Notificações automáticas por webhook",         benefits: ["POST em URL configurada", "Eventos de pedido", "Payload JSON"],      badge: null,       badgeColor: null,     isHighlighted: false, sortOrder: 25 },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ModulosPage() {
  const [modules, setModules]       = useState<Mod[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [activeCategory, setActiveCategory] = useState<CatKey>("Todos");
  const [billing, setBilling]       = useState<BillingPeriod>("annual");
  const [busy, setBusy]             = useState<Record<string, boolean>>({});
  const [openMenu, setOpenMenu]     = useState<string | null>(null);
  const companyId                   = useRef("");

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      companyId.current = u.companyId || "";
      if (u.companyId) load(u.companyId);
    } catch { setLoading(false); }
  }, []);

  async function load(cid: string) {
    setLoading(true);
    try {
      // /company-module/company/:cid doesn't exist; read modules from /company
      const { data } = await api.get(`/company/${cid}`);
      const mods: any[] = Array.isArray(data?.modules) ? data.modules : [];
      setModules(mods.map((m: any): Mod => {
        const slug = (m.moduleSlug || m.slug || m.module || "") as string;
        const cat  = MODULE_CATALOG[slug] ?? {};
        return {
          // Catalog defaults (fill missing fields so cards render correctly)
          name:           "",
          description:    "",
          icon:           "📦",
          category:       "OPERACAO",
          price:          null,
          isFree:         false,
          badge:          null,
          badgeColor:     null,
          benefits:       [],
          isHighlighted:  false,
          sortOrder:      99,
          // Override with static catalog when available
          ...cat,
          // API fields always win (id, status, dates)
          id:             m.id ?? slug,
          slug,
          companyModuleId: m.id ?? null,
          status:         (m.status ?? (m.active ? "ACTIVE" : "INACTIVE")) as Mod["status"],
          trialEndsAt:    m.trialEndsAt ?? null,
          activatedAt:    m.activatedAt ?? null,
        };
      }));
    } catch { toast.error("Erro ao carregar módulos"); }
    finally  { setLoading(false); }
  }

  function withBusy(slug: string, fn: () => Promise<void>) {
    return async () => {
      setBusy(p => ({ ...p, [slug]: true }));
      try { await fn(); } finally { setBusy(p => ({ ...p, [slug]: false })); }
    };
  }

  async function handleTrial(slug: string) {
    try {
      await api.post("/company-module/trial", { companyId: companyId.current, moduleSlug: slug });
      toast.success("🎉 Teste grátis de 5 dias ativado!");
      load(companyId.current);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Você já utilizou o teste grátis para este módulo.");
    }
  }

  async function handleActivate(slug: string) {
    try {
      await api.post("/company-module/activate", { companyId: companyId.current, moduleSlug: slug });
      toast.success("✅ Módulo ativado com sucesso!");
      load(companyId.current);
    } catch { toast.error("Erro ao ativar módulo"); }
  }

  async function handleDeactivate(slug: string) {
    try {
      await api.delete(`/company-module/${companyId.current}/${slug}`);
      toast.success("Módulo desativado.");
      load(companyId.current);
    } catch { toast.error("Erro ao desativar módulo"); }
  }

  const active    = modules.filter(m => m.status === "ACTIVE" || m.status === "TRIAL");
  const installed = active.length;

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(180deg, #f8f9fc 0%, #f3f4f6 100%)" }}
      onClick={() => setOpenMenu(null)}
    >
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <HeroModules
        totalModules={modules.length}
        activeModules={installed}
        billing={billing}
        onBillingChange={setBilling}
      />

      {/* ── Installed bar ────────────────────────────────────────────────────── */}
      {installed > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-6 -mt-6 relative z-10 bg-white rounded-2xl border border-gray-100 shadow-xl px-6 py-4 flex items-center gap-4 flex-wrap"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-black text-gray-900 text-sm">{installed} módulo{installed !== 1 ? "s" : ""} ativo{installed !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {active.slice(0, 6).map(m => (
              <div
                key={m.slug}
                title={m.name}
                className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-gray-600"
              >
                <span>{m.icon}</span> {m.name}
              </div>
            ))}
            {active.length > 6 && (
              <span className="text-xs text-gray-400 font-semibold">+{active.length - 6} mais</span>
            )}
          </div>
          <span className="text-xs text-gray-400 font-medium ml-auto hidden md:block">Todos funcionando normalmente ✓</span>
        </motion.div>
      )}

      {/* ── Module grid ──────────────────────────────────────────────────────── */}
      <ModuleGrid
        modules={modules}
        billing={billing}
        search={search}
        onSearchChange={setSearch}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        loading={loading}
        busy={busy}
        openMenu={openMenu}
        onToggleMenu={(slug, e) => { e.stopPropagation(); setOpenMenu(p => p === slug ? null : slug); }}
        onTrial={s => withBusy(s, () => handleTrial(s))()}
        onActivate={s => withBusy(s, () => handleActivate(s))()}
        onDeactivate={s => withBusy(s, () => handleDeactivate(s))()}
      />

      {/* ── Payment & Trust section ───────────────────────────────────────────── */}
      <div className="px-6 pb-16 max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Payment options */}
          <div
            className="lg:col-span-2 rounded-3xl p-8 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #0a1628 0%, #0f2040 60%, #071530 100%)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            {/* Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 opacity-15 pointer-events-none"
              style={{ background: "radial-gradient(circle, #3b82f6, transparent)" }} />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={14} className="text-amber-400" />
                <span className="text-amber-400 text-xs font-black uppercase tracking-widest">Pagamento & Fidelização</span>
              </div>
              <h3 className="text-white text-xl font-black mb-1">Escolha como pagar</h3>
              <p className="text-white/50 text-sm mb-6">Economize mais com pagamento antecipado e Pix</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    icon: "⚡", title: "Pix com desconto",
                    desc: "Pague via Pix e ganhe 5% adicional de desconto no total.",
                    tag: "-5% extra", tagColor: "text-emerald-400 bg-emerald-400/15",
                  },
                  {
                    icon: "🔄", title: "Cartão recorrente",
                    desc: "Débito automático mensal. Zero preocupação, renovação garantida.",
                    tag: "Auto-renovável", tagColor: "text-blue-400 bg-blue-400/15",
                  },
                  {
                    icon: "📅", title: "Pagamento antecipado",
                    desc: "Pague o ano todo de uma vez e economize até 35% com Pix.",
                    tag: "Máx. economia", tagColor: "text-amber-400 bg-amber-400/15",
                  },
                  {
                    icon: "🎁", title: "Fidelização",
                    desc: "Clientes com plano anual têm acesso prioritário a novos módulos.",
                    tag: "Exclusivo", tagColor: "text-violet-400 bg-violet-400/15",
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/8 transition">
                    <span className="text-2xl">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-white font-bold text-sm">{item.title}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.tagColor}`}>{item.tag}</span>
                      </div>
                      <p className="text-white/45 text-xs leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 mt-5 pt-5 border-t border-white/10">
                <CreditCard size={14} className="text-white/40" />
                <span className="text-white/40 text-xs">Aceitamos: Pix · Cartão de crédito · Débito · Boleto · Transferência</span>
              </div>
            </div>
          </div>

          {/* Trust & CTA panel */}
          <div className="flex flex-col gap-4">

            {/* Savings CTA */}
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-3xl p-6 flex-1">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
                style={{ boxShadow: "0 8px 24px rgba(99,102,241,0.35)" }}>
                <Sparkles size={20} className="text-white" />
              </div>
              <h4 className="font-black text-gray-900 text-base mb-1">Plano Enterprise</h4>
              <p className="text-gray-500 text-xs mb-4 leading-relaxed">
                Módulos ilimitados + suporte dedicado + onboarding + SLA garantido.
              </p>
              <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{
                  background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  boxShadow: "0 6px 18px rgba(79,70,229,0.3)",
                }}>
                Falar com vendas <ChevronRight size={13} />
              </button>
            </div>

            {/* Trust badges */}
            <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
              <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-4">Garantias</p>
              <div className="space-y-3">
                {[
                  { icon: <Shield size={13} className="text-emerald-500" />, text: "Dados protegidos com criptografia AES-256" },
                  { icon: <TrendingUp size={13} className="text-blue-500" />, text: "99.9% de uptime garantido por SLA" },
                  { icon: <Check size={13} className="text-amber-500" />, text: "Cancele quando quiser, sem multa" },
                  { icon: <Zap size={13} className="text-violet-500" />, text: "Suporte técnico incluído em todos os planos" },
                ].map((g, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                      {g.icon}
                    </div>
                    <span className="text-xs text-gray-500 font-medium leading-tight">{g.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
