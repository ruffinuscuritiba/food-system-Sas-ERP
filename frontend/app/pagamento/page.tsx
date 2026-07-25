"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { api } from "@/services/api";
import Link from "next/link";

type PlanType = "BASIC" | "DELIVERY" | "ENTERPRISE";
type PaymentProvider = "MERCADOPAGO" | "STRIPE";

const PLAN_INFO: Record<PlanType, { label: string; price: string; features: string[] }> = {
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

  const planParam = (searchParams.get("plan") as PlanType) || "DELIVERY";
  const urlCompanyId = searchParams.get("companyId") || "";

  const [provider, setProvider] = useState<PaymentProvider>("MERCADOPAGO");
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string>(urlCompanyId);

  // Garante a recuperação do companyId mesmo se o usuário der F5 ou perder os searchParams
  useEffect(() => {
    if (urlCompanyId) {
      setCompanyId(urlCompanyId);
      localStorage.setItem("@foodsaas:companyId", urlCompanyId);
    } else {
      const storedId = localStorage.getItem("@foodsaas:companyId");
      if (storedId) setCompanyId(storedId);
    }
  }, [urlCompanyId]);

  const planInfo = PLAN_INFO[planParam] || PLAN_INFO.DELIVERY;

  async function handleCheckout() {
    if (!companyId) {
      toast.error("ID da empresa não localizado. Por favor, acesse novamente.");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/payments/checkout", {
        companyId,
        plan: planParam,
        provider,
      });

      if (res.data?.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
      } else {
        throw new Error("URL de checkout não retornada pela API.");
      }
    } catch (err: unknown) {
      setLoading(false);
      
      // Tratamento genérico e seguro de erros de API
      const errorResponse = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      const msg = errorResponse || "Erro ao iniciar processo de pagamento. Tente novamente.";
      
      toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-12">
      <Toaster position="top-right" />
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <Link href="/landing" className="text-3xl font-black text-red-500 hover:opacity-90 transition">
            🍽️ FoodSaaS
          </Link>
          <p className="mt-2 text-slate-400">Finalizar assinatura do sistema</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 space-y-6 shadow-2xl">
          {/* Resumo do Plano Selecionado */}
          <div className="rounded-xl bg-slate-800/80 border border-slate-700/50 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Plano Selecionado
                </p>
                <h2 className="text-xl font-bold mt-1 text-white">{planInfo.label}</h2>
                <p className="text-green-400 font-black mt-1 text-lg">{planInfo.price}</p>
              </div>
              <Link
                href="/planos"
                className="text-xs font-bold text-red-400 hover:text-red-300 underline underline-offset-4"
              >
                Alterar
              </Link>
            </div>
            <ul className="mt-4 space-y-1.5 border-t border-slate-700/50 pt-3">
              {planInfo.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                  <span className="text-green-400 font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Seleção de Método de Pagamento */}
          <div>
            <p className="text-sm font-semibold mb-3 text-slate-200">Forma de Pagamento</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  value: "MERCADOPAGO" as const,
                  label: "MercadoPago",
                  desc: "PIX, Cartão, Boleto",
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
                  type="button"
                  disabled={loading}
                  onClick={() => setProvider(p.value)}
                  className={`rounded-xl border p-4 text-left transition ${
                    provider === p.value
                      ? "border-red-500 bg-red-500/10 ring-1 ring-red-500"
                      : "border-slate-800 bg-slate-800/40 hover:border-slate-600"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="text-2xl mb-1">{p.icon}</div>
                  <p className="font-semibold text-sm text-white">{p.label}</p>
                  <p className="text-xs text-slate-400">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Nota de Segurança */}
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
            <span>🔒</span>
            <span>Pagamento 100% seguro com criptografia de ponta a ponta.</span>
          </div>

          {/* Botão Principal de Ação */}
          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full rounded-xl bg-red-500 py-4 text-lg font-black text-white hover:bg-red-600 active:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20"
          >
            {loading
              ? "Redirecionando para o checkout..."
              : `Pagar com ${provider === "MERCADOPAGO" ? "MercadoPago" : "Stripe"} →`}
          </button>

          <p className="text-center text-xs text-slate-500">
            Ao assinar, você concorda com nossos{" "}
            <span className="underline cursor-pointer hover:text-slate-400">Termos de Uso</span>.
            Cancele a qualquer momento.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PagamentoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PagamentoContent />
    </Suspense>
  );
}