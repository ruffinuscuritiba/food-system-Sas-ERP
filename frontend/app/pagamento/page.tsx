"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { api } from "@/services/api";
import Link from "next/link";

const PLAN_INFO: Record<string, { label: string; price: string; features: string[] }> = {
  BASIC: {
    label: "Básico",
    price: "R$ 97,00/mês",
    features: ["Cardápio digital", "Pedidos online", "Relatórios básicos"],
  },
  DELIVERY: {
    label: "Profissional",
    price: "R$ 197,00/mês",
    features: ["PDV completo", "Gestão de estoque", "Controle financeiro"],
  },
  ENTERPRISE: {
    label: "Enterprise",
    price: "R$ 397,00/mês",
    features: ["Multi-tenant", "API dedicada", "Gerente de conta"],
  },
};

function PagamentoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const plan = searchParams.get("plan") || "DELIVERY";
  const companyId = searchParams.get("companyId") || "";

  const [provider, setProvider] = useState<"MERCADOPAGO" | "STRIPE">("MERCADOPAGO");
  const [loading, setLoading] = useState(false);

  const planInfo = PLAN_INFO[plan] || PLAN_INFO.DELIVERY;

  async function handleCheckout() {
    if (!companyId) {
      toast.error("ID da empresa não encontrado. Faça login novamente.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/payments/checkout", {
        companyId,
        plan,
        provider,
      });
      // Redirect to payment gateway
      window.location.href = res.data.checkoutUrl;
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao iniciar pagamento.";
      toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-12">
      <Toaster position="top-right" />
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <Link href="/landing" className="text-3xl font-black text-red-500">
            🍽️ FoodSaaS
          </Link>
          <p className="mt-2 text-slate-400">Finalizar assinatura</p>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 space-y-6">
          {/* Plan summary */}
          <div className="rounded-xl bg-slate-800 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Plano selecionado</p>
                <h2 className="text-xl font-bold mt-1">{planInfo.label}</h2>
                <p className="text-green-400 font-bold mt-1">{planInfo.price}</p>
              </div>
              <Link
                href="/planos"
                className="text-xs text-red-400 hover:text-red-300"
              >
                Alterar
              </Link>
            </div>
            <ul className="mt-3 space-y-1">
              {planInfo.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                  <span className="text-green-400">✓</span> {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Payment method */}
          <div>
            <p className="text-sm font-semibold mb-3">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  value: "MERCADOPAGO" as const,
                  label: "MercadoPago",
                  desc: "PIX, cartão, boleto",
                  icon: "💳",
                },
                {
                  value: "STRIPE" as const,
                  label: "Stripe",
                  desc: "Cartão internacional",
                  icon: "🌐",
                },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setProvider(p.value)}
                  className={`rounded-xl border p-4 text-left transition ${
                    provider === p.value
                      ? "border-red-500 bg-red-500/10"
                      : "border-slate-700 hover:border-slate-500"
                  }`}
                >
                  <div className="text-2xl mb-1">{p.icon}</div>
                  <p className="font-semibold text-sm">{p.label}</p>
                  <p className="text-xs text-slate-400">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Security note */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>🔒</span>
            <span>Pagamento 100% seguro. Seus dados são criptografados.</span>
          </div>

          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full rounded-xl bg-red-500 py-4 text-lg font-bold hover:bg-red-600 transition disabled:opacity-50"
          >
            {loading ? "Redirecionando..." : `Pagar com ${provider === "MERCADOPAGO" ? "MercadoPago" : "Stripe"} →`}
          </button>

          <p className="text-center text-xs text-slate-500">
            Ao pagar, você concorda com os{" "}
            <span className="underline cursor-pointer">Termos de Uso</span>.
            Cancele quando quiser.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PagamentoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Carregando...</div>}>
      <PagamentoContent />
    </Suspense>
  );
}
