"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Check,
  ChevronDown,
  Loader2,
  MessageCircle,
  Minus,
  UtensilsCrossed,
  Zap,
  BarChart3,
  Smartphone,
  Bot,
  TrendingUp,
  X,
  User,
  Mail,
  Phone,
  Store,
  ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import { DEMO_ACCOUNTS, type DemoAccount } from "@/lib/demoThemes";
import { SUPPORT_WHATSAPP } from "@/config/support";

const SPECIALIST_WA_URL = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
  "Olá! Gostaria de falar com um especialista da Ruffinu's FoodSaaS ERP.",
)}`;

// ─── Comparison table data ────────────────────────────────────────────────────
type PlanKey = "basic" | "pro" | "enterprise";

interface Feature {
  label: string;
  basic: boolean;
  pro: boolean;
  enterprise: boolean;
}

const COMPARISON: Feature[] = [
  { label: "PDV",              basic: true,  pro: true,  enterprise: true },
  { label: "Pedidos",          basic: true,  pro: true,  enterprise: true },
  { label: "Cozinha",          basic: true,  pro: true,  enterprise: true },
  { label: "Mesas",            basic: true,  pro: true,  enterprise: true },
  { label: "Cardápio Online",  basic: true,  pro: true,  enterprise: true },
  { label: "Cupons",           basic: false, pro: true,  enterprise: true },
  { label: "Relatórios",       basic: false, pro: true,  enterprise: true },
  { label: "WhatsApp IA",      basic: false, pro: true,  enterprise: true },
  { label: "Multiunidades",    basic: false, pro: false, enterprise: true },
  { label: "White Label",      basic: false, pro: false, enterprise: true },
];

// ─── Benefits data ────────────────────────────────────────────────────────────
const BENEFITS = [
  { icon: Zap,        title: "Operação rápida",          desc: "PDV otimizado para velocidade no atendimento." },
  { icon: BarChart3,  title: "Gestão completa",          desc: "Financeiro, estoque e relatórios em um só lugar." },
  { icon: Smartphone, title: "Cardápio digital",         desc: "Cardápio online com pedidos direto pelo cliente." },
  { icon: Bot,        title: "Automação inteligente",    desc: "IA no WhatsApp para atender e vender 24h." },
  { icon: TrendingUp, title: "Mais vendas",              desc: "Cupons, fidelidade e upsell integrados ao fluxo." },
];

// ─── Screenshots (demo-assets presentes no /public) ──────────────────────────
const DEMO_SCREENSHOTS: Record<PlanKey, string> = {
  basic:      "/demo-assets/banners/pizzas-salgadas.jpg",
  pro:        "/demo-assets/banners/combos.jpg",
  enterprise: "/demo-assets/banners/pizzas-doces.jpg",
};

// ─── helpers ─────────────────────────────────────────────────────────────────
function planKey(plan: string): PlanKey {
  return plan.toLowerCase() as PlanKey;
}

// ─── Lead Capture Modal ───────────────────────────────────────────────────────
interface LeadForm {
  name: string;
  email: string;
  whatsapp: string;
  restaurantName: string;
}

interface LeadCaptureModalProps {
  demo: DemoAccount;
  onClose: () => void;
  onConfirm: (form: LeadForm) => Promise<void>;
  loading: boolean;
}

function LeadCaptureModal({ demo, onClose, onConfirm, loading }: LeadCaptureModalProps) {
  const [form, setForm] = useState<LeadForm>({ name: "", email: "", whatsapp: "", restaurantName: "" });
  const color = demo.primaryColor;

  function formatPhone(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  function handleWhatsapp(v: string) {
    setForm((f) => ({ ...f, whatsapp: formatPhone(v) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Informe seu nome."); return; }
    if (!form.email.trim() || !form.email.includes("@")) { toast.error("Informe um e-mail válido."); return; }
    if (!form.restaurantName.trim()) { toast.error("Informe o nome do restaurante."); return; }
    await onConfirm(form);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0d1117] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* top glow */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-25"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}88, transparent 70%)` }}
          aria-hidden
        />

        {/* header */}
        <div className="relative flex items-center justify-between px-7 pt-7 pb-0">
          <div>
            <span
              className="inline-block rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest mb-3"
              style={{ color, backgroundColor: `${color}22`, border: `1px solid ${color}44` }}
            >
              Demo {demo.plan}
            </span>
            <h2 className="text-xl font-black text-white leading-tight">
              Acesso à demonstração
            </h2>
            <p className="mt-1 text-sm text-white/50">
              Preencha seus dados e explore o sistema completo — sem custo.
            </p>
          </div>
          <button
            onClick={onClose}
            className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition"
          >
            <X size={14} />
          </button>
        </div>

        {/* form */}
        <form onSubmit={handleSubmit} className="relative px-7 py-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5">Seu nome *</label>
            <div className="relative">
              <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="João Silva"
                className="w-full bg-white/[0.06] border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/25 transition"
                autoFocus
              />
            </div>
          </div>

          {/* E-mail */}
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5">E-mail *</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="joao@meurestaurante.com.br"
                className="w-full bg-white/[0.06] border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/25 transition"
              />
            </div>
          </div>

          {/* WhatsApp */}
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5">
              WhatsApp <span className="text-white/30">(opcional)</span>
            </label>
            <div className="relative">
              <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="tel"
                value={form.whatsapp}
                onChange={(e) => handleWhatsapp(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full bg-white/[0.06] border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/25 transition"
              />
            </div>
          </div>

          {/* Restaurant name */}
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5">Nome do restaurante *</label>
            <div className="relative">
              <Store size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={form.restaurantName}
                onChange={(e) => setForm((f) => ({ ...f, restaurantName: e.target.value }))}
                placeholder="Pizzaria Bella Napoli"
                className="w-full bg-white/[0.06] border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/25 transition"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              backgroundColor: color,
              boxShadow: `0 8px 24px -8px ${color}cc, inset 0 1px 0 rgba(255,255,255,0.15)`,
            }}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Entrando…</>
            ) : (
              <>Entrar na demonstração <ArrowRight className="h-4 w-4" /></>
            )}
          </button>

          <p className="text-center text-[11px] text-white/25 pt-1">
            Sem cartão de crédito. Acesso imediato. Dados protegidos.
          </p>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DemoPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [entering, setEntering] = useState<string | null>(null);
  const [modalDemo, setModalDemo] = useState<DemoAccount | null>(null);
  const demoSectionRef = useRef<HTMLElement>(null);

  async function enterDemoWithLead(demo: DemoAccount, form: LeadForm) {
    setEntering(demo.id);
    try {
      const { data } = await api.post("auth/demo-access", {
        name:           form.name,
        email:          form.email,
        whatsapp:       form.whatsapp,
        restaurantName: form.restaurantName,
        plan:           demo.plan.toLowerCase() as "basic" | "pro" | "enterprise",
      });
      const { accessToken, user } = data;
      if (!accessToken) { toast.error("Demonstração indisponível."); return; }
      setAuth(accessToken, user);
      document.cookie = `token=${accessToken}; path=/`;
      localStorage.setItem("token", accessToken);
      localStorage.setItem("user", JSON.stringify(user));
      setModalDemo(null);
      toast.success(`Bem-vindo à demo ${demo.plan}!`);
      router.push("/pdv");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Não foi possível abrir esta demonstração.");
    } finally {
      setEntering(null);
    }
  }

  function scrollToDemo() {
    demoSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-[#07090f] text-white selection:bg-orange-500/30">
      {/* Lead capture modal */}
      {modalDemo && (
        <LeadCaptureModal
          demo={modalDemo}
          loading={entering === modalDemo.id}
          onClose={() => { if (!entering) setModalDemo(null); }}
          onConfirm={(form) => enterDemoWithLead(modalDemo, form)}
        />
      )}
      {/* ── ambient glows ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-60 left-1/3 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-orange-500/8 blur-[180px]" />
        <div className="absolute top-1/2 -right-40 h-[400px] w-[600px] rounded-full bg-violet-600/8 blur-[160px]" />
        <div className="absolute bottom-0 left-1/4 h-[300px] w-[500px] rounded-full bg-blue-600/6 blur-[140px]" />
      </div>

      <div className="relative z-10">
        {/* ── HEADER ── */}
        <header className="sticky top-0 z-50 border-b border-white/5 bg-[#07090f]/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-orange-500/15 p-2 ring-1 ring-orange-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <UtensilsCrossed className="h-4 w-4 text-orange-400" />
              </div>
              <span className="text-base font-black tracking-tight">FoodSaaS ERP</span>
            </div>
            <nav className="flex items-center gap-3">
              <button
                onClick={scrollToDemo}
                className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 sm:block"
              >
                Ver demos
              </button>
              <a
                href={SPECIALIST_WA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-black text-white shadow-[0_4px_14px_-4px_rgba(249,115,22,0.7),inset_0_1px_0_rgba(255,255,255,0.15)] transition hover:bg-orange-600"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Falar com Especialista</span>
                <span className="sm:hidden">Especialista</span>
              </a>
            </nav>
          </div>
        </header>

        {/* ── HERO ── */}
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-20 text-center sm:px-8 sm:pb-24 sm:pt-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-orange-400">
            Demonstrações ao vivo
          </span>

          <h1 className="mx-auto mt-7 max-w-4xl text-5xl font-black leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
            FoodSaaS{" "}
            <span className="bg-gradient-to-r from-orange-400 via-orange-300 to-amber-400 bg-clip-text text-transparent">
              ERP
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/55 sm:text-xl">
            Sistema completo para pizzarias, restaurantes, hamburguerias,
            delivery e dark kitchens.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={scrollToDemo}
              className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-7 py-4 text-sm font-black text-white shadow-[0_8px_24px_-6px_rgba(249,115,22,0.6),inset_0_1px_0_rgba(255,255,255,0.15)] transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-[0_12px_30px_-6px_rgba(249,115,22,0.7)]"
            >
              Testar Demonstrações
              <ChevronDown className="h-4 w-4" />
            </button>
            <a
              href={SPECIALIST_WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-7 py-4 text-sm font-semibold text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur transition hover:border-white/20 hover:bg-white/10"
            >
              <MessageCircle className="h-4 w-4" />
              Falar com Especialista
            </a>
          </div>
        </section>

        {/* ── BENEFITS ── */}
        <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {BENEFITS.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-white/[0.13] hover:bg-white/[0.04]"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 ring-1 ring-orange-500/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <Icon className="h-4 w-4 text-orange-400" />
                </div>
                <p className="text-sm font-black text-white">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/45">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── DEMO CARDS ── */}
        <section
          id="demos"
          ref={demoSectionRef}
          className="mx-auto max-w-6xl px-5 pb-24 sm:px-8"
        >
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Escolha uma demonstração
            </h2>
            <p className="mt-3 text-sm text-white/50">
              Acesso imediato — sem cadastro, sem cartão.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {DEMO_ACCOUNTS.map((demo) => (
              <DemoCard
                key={demo.id}
                demo={demo}
                screenshot={DEMO_SCREENSHOTS[planKey(demo.plan)]}
                loading={entering === demo.id}
                disabled={entering !== null && entering !== demo.id}
                onSelect={() => setModalDemo(demo)}
              />
            ))}
          </div>
        </section>

        {/* ── COMPARISON TABLE ── */}
        <section className="mx-auto max-w-4xl px-5 pb-28 sm:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Comparativo de planos
            </h2>
            <p className="mt-3 text-sm text-white/50">
              Escolha o plano ideal para o tamanho da sua operação.
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur">
            {/* Header */}
            <div className="grid grid-cols-4 border-b border-white/[0.07] bg-white/[0.03]">
              <div className="p-5" />
              {(["BASIC", "PRO", "ENTERPRISE"] as const).map((plan, i) => {
                const colors = ["#16a34a", "#2563eb", "#7c3aed"];
                const color = colors[i];
                return (
                  <div key={plan} className="border-l border-white/[0.07] p-5 text-center">
                    <span
                      className="inline-block rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                      style={{ color, backgroundColor: `${color}22`, border: `1px solid ${color}44` }}
                    >
                      {plan}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Rows */}
            {COMPARISON.map((feat, idx) => (
              <div
                key={feat.label}
                className={`grid grid-cols-4 border-b border-white/[0.05] transition hover:bg-white/[0.02] ${
                  idx === COMPARISON.length - 1 ? "border-b-0" : ""
                }`}
              >
                <div className="flex items-center px-5 py-4 text-sm font-medium text-white/75">
                  {feat.label}
                </div>
                {(["basic", "pro", "enterprise"] as PlanKey[]).map((key, i) => {
                  const colors = ["#16a34a", "#2563eb", "#7c3aed"];
                  const val = feat[key];
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-center border-l border-white/[0.05] py-4"
                    >
                      {val ? (
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${colors[i]}22` }}
                        >
                          <Check
                            className="h-3.5 w-3.5"
                            style={{ color: colors[i] }}
                            strokeWidth={3}
                          />
                        </span>
                      ) : (
                        <Minus className="h-4 w-4 text-white/20" strokeWidth={2} />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        {/* ── FOOTER CTA ── */}
        <section className="mx-auto max-w-3xl px-5 pb-20 text-center sm:px-8">
          <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <p className="text-2xl font-black sm:text-3xl">
              Experimente o sistema completo
              <br />
              <span className="text-white/50">antes de contratar.</span>
            </p>
            <p className="mt-3 text-sm text-white/45">
              Nenhum compromisso. Sem dados de cartão.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={scrollToDemo}
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-6 py-3.5 text-sm font-black text-white shadow-[0_8px_24px_-6px_rgba(249,115,22,0.5),inset_0_1px_0_rgba(255,255,255,0.15)] transition hover:bg-orange-600"
              >
                Ver demonstrações
              </button>
              <a
                href={SPECIALIST_WA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:bg-white/10"
              >
                <MessageCircle className="h-4 w-4" />
                Falar com Especialista
              </a>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/[0.05] py-8 text-center text-xs text-white/25">
          © {new Date().getFullYear()} FoodSaaS ERP — Demonstração pública
        </footer>
      </div>
    </div>
  );
}

// ─── Demo Card ────────────────────────────────────────────────────────────────
interface DemoCardProps {
  demo: DemoAccount;
  screenshot: string;
  loading: boolean;
  disabled: boolean;
  onSelect: () => void;
}

function DemoCard({ demo, screenshot, loading, disabled, onSelect }: DemoCardProps) {
  const color = demo.primaryColor;

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0b0e18] shadow-[0_2px_0_rgba(255,255,255,0.04)_inset,0_24px_48px_-16px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.7)]"
      style={{
        boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 24px 60px -20px ${color}44`,
      }}
    >
      {/* Screenshot */}
      <div className="relative h-40 overflow-hidden">
        <Image
          src={screenshot}
          alt={`Preview ${demo.label}`}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        {/* overlay gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, ${color}22 0%, #0b0e18 100%)`,
          }}
        />
        {/* plan badge */}
        <span
          className="absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest backdrop-blur"
          style={{ color, backgroundColor: `${color}33`, border: `1px solid ${color}55` }}
        >
          {demo.plan}
        </span>
      </div>

      {/* top glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-30 transition-opacity duration-300 group-hover:opacity-50"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}55, transparent 70%)` }}
        aria-hidden
      />

      {/* Content */}
      <div className="relative flex flex-1 flex-col p-7">
        <h2 className="text-xl font-black tracking-tight">{demo.label}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-white/55">{demo.tagline}</p>

        <ul className="mt-5 space-y-2.5 flex-1">
          {demo.features.map((feat) => (
            <li key={feat} className="flex items-start gap-2.5 text-sm text-white/75">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                style={{ backgroundColor: `${color}22` }}
              >
                <Check className="h-3 w-3" style={{ color }} strokeWidth={3} />
              </span>
              {feat}
            </li>
          ))}
        </ul>

        <button
          onClick={onSelect}
          disabled={loading || disabled}
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            backgroundColor: color,
            boxShadow: `0 8px 24px -8px ${color}cc, inset 0 1px 0 rgba(255,255,255,0.15)`,
          }}
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Abrindo…</>
          ) : (
            `Testar ${demo.plan.charAt(0) + demo.plan.slice(1).toLowerCase()}`
          )}
        </button>
      </div>
    </article>
  );
}
