"use client";

import { Lock, Zap, ArrowRight } from "lucide-react";

interface AiTrialLockProps {
  /** Message variant — "trial" (3-day window) or "expired" (dueDate passed) */
  variant?: "trial" | "expired";
}

/**
 * Full-page overlay rendered by AI feature pages when the company is in trial
 * (PENDING_PAYMENT) or expired. Prompts the user to upgrade.
 */
export function AiTrialLock({ variant = "trial" }: AiTrialLockProps) {
  const isExpired = variant === "expired";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      {/* icon */}
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 ring-1 ring-violet-500/30">
        <Lock className="h-8 w-8 text-violet-400" />
      </div>

      {/* title */}
      <div className="space-y-2">
        <h2 className="text-2xl font-black text-gray-900">
          {isExpired
            ? "Período de teste encerrado"
            : "Recurso exclusivo do plano ativo"}
        </h2>
        <p className="mx-auto max-w-md text-base text-gray-500 leading-relaxed">
          {isExpired
            ? "Seu teste gratuito de 7 dias expirou. Ative seu plano para retomar o acesso completo ao sistema."
            : "A Inteligência Artificial está disponível apenas nos planos ativos. Durante o período de teste você pode explorar todas as outras funções livremente."}
        </p>
      </div>

      {/* badge */}
      <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">
        <Zap className="h-4 w-4" />
        Recurso de Inteligência Artificial disponível apenas nos planos premium ativos
      </div>

      {/* CTA */}
      <a
        href="/assinatura"
        className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-8 py-3.5 text-sm font-black text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700"
      >
        {isExpired ? "Ativar plano" : "Ver planos"}
        <ArrowRight className="h-4 w-4" />
      </a>
    </div>
  );
}
