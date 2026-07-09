"use client";
import { useEffect } from "react";
import Link from "next/link";
import { trackView, trackClick } from "@/lib/track";

const plans = [
  {
    name: "Básico",
    price: "R$ 97",
    period: "/mês",
    description: "Ideal para pequenos negócios",
    features: [
      "1 estabelecimento",
      "Cardápio digital",
      "Pedidos online",
      "Relatórios básicos",
      "Suporte por email",
    ],
    cta: "Começar grátis",
    highlight: false,
    plan: "BASIC",
  },
  {
    name: "Profissional",
    price: "R$ 197",
    period: "/mês",
    description: "Para negócios em crescimento",
    features: [
      "1 estabelecimento",
      "Tudo do Básico",
      "PDV completo",
      "Gestão de estoque",
      "Controle financeiro",
      "Suporte prioritário",
    ],
    cta: "Assinar agora",
    highlight: true,
    plan: "DELIVERY",
  },
  {
    name: "Enterprise",
    price: "R$ 397",
    period: "/mês",
    description: "Para redes e franquias",
    features: [
      "Múltiplos estabelecimentos",
      "Tudo do Profissional",
      "Multi-tenant avançado",
      "API dedicada",
      "Gerente de conta",
      "SLA garantido",
    ],
    cta: "Falar com vendas",
    highlight: false,
    plan: "ENTERPRISE",
  },
];

export default function LandingPage() {
  useEffect(() => { trackView("/landing"); }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-slate-800 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-red-500">🍽️ FoodSaaS</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-slate-300 hover:text-white transition"
            >
              Entrar
            </Link>
            <Link
              href="/signup"
              onClick={() => trackClick("/landing", "nav_comecar_gratis")}
              className="rounded-xl bg-red-500 px-5 py-2 font-semibold hover:bg-red-600 transition"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-24 text-center">
        <div className="mx-auto max-w-4xl">
          <span className="mb-4 inline-block rounded-full bg-red-500/10 px-4 py-1 text-sm font-medium text-red-400 border border-red-500/20">
            Sistema ERP para Alimentação
          </span>
          <h1 className="mb-6 text-5xl font-black leading-tight md:text-7xl">
            Gerencie seu restaurante{" "}
            <span className="text-red-500">do jeito certo</span>
          </h1>
          <p className="mb-10 text-xl text-slate-400 max-w-2xl mx-auto">
            Cardápio digital, pedidos online, PDV, estoque e financeiro em uma
            única plataforma. Comece em minutos, sem cartão de crédito.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              onClick={() => trackClick("/landing", "hero_criar_conta")}
              className="w-full sm:w-auto rounded-2xl bg-red-500 px-8 py-4 text-lg font-bold hover:bg-red-600 transition"
            >
              Criar conta grátis →
            </Link>
            <Link
              href="#planos"
              onClick={() => trackClick("/landing", "hero_ver_planos")}
              className="w-full sm:w-auto rounded-2xl border border-slate-700 px-8 py-4 text-lg font-semibold hover:border-slate-500 transition"
            >
              Ver planos
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 bg-slate-900">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12 text-center text-4xl font-bold">
            Tudo que você precisa
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: "📱",
                title: "Cardápio Digital",
                desc: "QR Code na mesa, pedidos direto pelo celular do cliente. Sem papel, sem erro.",
              },
              {
                icon: "🛒",
                title: "Pedidos Online",
                desc: "Receba pedidos de delivery e retirada com carrinho de compras integrado.",
              },
              {
                icon: "💰",
                title: "PDV Completo",
                desc: "Caixa, controle de mesas, sangria e fechamento de caixa em tempo real.",
              },
              {
                icon: "📦",
                title: "Gestão de Estoque",
                desc: "Ingredientes, fichas técnicas e alertas de estoque mínimo automáticos.",
              },
              {
                icon: "📊",
                title: "Relatórios",
                desc: "Dashboard com métricas de vendas, ticket médio e desempenho em tempo real.",
              },
              {
                icon: "🔒",
                title: "Multi-tenant Seguro",
                desc: "Cada empresa com dados 100% isolados. LGPD compliant.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-700 bg-slate-800 p-6"
              >
                <div className="mb-3 text-4xl">{f.icon}</div>
                <h3 className="mb-2 text-xl font-bold">{f.title}</h3>
                <p className="text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-4 text-center text-4xl font-bold">Planos e Preços</h2>
          <p className="mb-12 text-center text-slate-400">
            7 dias grátis em todos os planos. Cancele quando quiser.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl border p-8 flex flex-col ${
                  p.highlight
                    ? "border-red-500 bg-red-500/5"
                    : "border-slate-700 bg-slate-900"
                }`}
              >
                {p.highlight && (
                  <span className="mb-4 self-start rounded-full bg-red-500 px-3 py-1 text-xs font-bold">
                    MAIS POPULAR
                  </span>
                )}
                <h3 className="text-2xl font-bold">{p.name}</h3>
                <p className="mt-1 text-slate-400 text-sm">{p.description}</p>
                <div className="mt-4 mb-6">
                  <span className="text-4xl font-black">{p.price}</span>
                  <span className="text-slate-400">{p.period}</span>
                </div>
                <ul className="mb-8 flex-1 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/signup?plan=${p.plan}`}
                  onClick={() => trackClick("/landing", `plan_${p.plan.toLowerCase()}`)}
                  className={`block rounded-xl py-3 text-center font-bold transition ${
                    p.highlight
                      ? "bg-red-500 hover:bg-red-600"
                      : "border border-slate-600 hover:border-slate-400"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="px-6 py-20 bg-slate-900 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-4 text-4xl font-bold">
            Pronto para modernizar seu negócio?
          </h2>
          <p className="mb-8 text-slate-400">
            Junte-se a centenas de restaurantes que já usam o FoodSaaS.
          </p>
          <Link
            href="/signup"
            onClick={() => trackClick("/landing", "footer_criar_conta")}
            className="inline-block rounded-2xl bg-red-500 px-10 py-4 text-lg font-bold hover:bg-red-600 transition"
          >
            Criar conta grátis →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-8 text-center text-slate-500 text-sm">
        © 2025 FoodSaaS. Todos os direitos reservados.
      </footer>
    </div>
  );
}
