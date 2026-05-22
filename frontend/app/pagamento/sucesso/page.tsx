"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/services/api";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

function PagamentoSucessoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const plan = searchParams.get("plan") || "";
  const companyId = searchParams.get("companyId") || "";
  const isMock = searchParams.get("mock") === "1";

  const [activated, setActivated] = useState(false);

  useEffect(() => {
    if (companyId && plan) {
      activateSubscription();
    }
  }, []);

  async function activateSubscription() {
    try {
      await api.post("/payments/activate", { companyId, plan });
      setActivated(true);
    } catch {
      // May already be activated by webhook
      setActivated(true);
    }
  }

  const PLAN_LABEL: Record<string, string> = {
    BASIC: "Básico",
    DELIVERY: "Profissional",
    ENTERPRISE: "Enterprise",
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <Toaster position="top-right" />
      <div className="text-center max-w-md">
        <div className="text-7xl mb-6">🎉</div>
        <h1 className="text-4xl font-black mb-3">Pagamento confirmado!</h1>
        <p className="text-slate-400 mb-2">
          Seu plano <strong className="text-white">{PLAN_LABEL[plan] || plan}</strong> está ativo.
        </p>
        {isMock && (
          <p className="text-xs text-yellow-400 mb-4">
            (Modo de desenvolvimento — pagamento simulado)
          </p>
        )}
        <p className="text-slate-500 text-sm mb-8">
          Você receberá um email de confirmação em breve.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl bg-red-500 px-8 py-3 font-bold hover:bg-red-600 transition"
          >
            Acessar meu painel →
          </Link>
          <Link
            href="/planos"
            className="rounded-xl border border-slate-700 px-8 py-3 font-semibold hover:border-slate-500 transition"
          >
            Ver minha assinatura
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PagamentoSucessoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Carregando...</div>}>
      <PagamentoSucessoContent />
    </Suspense>
  );
}
