"use client";

import { useState } from "react";
import { Bot, Copy, ExternalLink, MessageCircle, Rocket } from "lucide-react";
import toast from "react-hot-toast";
import { saApi } from "@/services/superAdminApi";

const DEMO_URL = "https://food-system-sas-erp-frontend.vercel.app/demo";
const WA_URL = `https://wa.me/?text=${encodeURIComponent(
  `Conheça o FoodSaaS ERP: ${DEMO_URL}`,
)}`;

/** Card used in both /dashboard (light) and /super-admin/dashboard (dark). */
export function DemoCentralCard({
  variant = "light",
  showConfigureAI = false,
}: {
  variant?: "light" | "dark";
  /** Botão "Configurar IA" — atalho de impersonation direto pra plataforma. Só o super-admin deve ver. */
  showConfigureAI?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [enteringAI, setEnteringAI] = useState(false);

  async function configureAI() {
    setEnteringAI(true);
    try {
      const { data } = await saApi.post("/super-admin/platform/impersonate");
      localStorage.setItem("token", data.accessToken);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("impersonating", JSON.stringify({ companyName: "R FoodSaaS Plataforma", companyId: data.user.companyId }));
      document.cookie = `token=${data.accessToken}; path=/`;
      window.location.href = "/whatsapp-ia";
    } catch {
      toast.error("Erro ao acessar configuração de IA");
      setEnteringAI(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(DEMO_URL);
      setCopied(true);
      toast.success("Link copiado com sucesso");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  const isDark = variant === "dark";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-6 transition ${
        isDark
          ? "border-violet-500/20 bg-gradient-to-br from-violet-950/60 to-violet-900/30 shadow-[0_0_0_1px_rgba(139,92,246,0.08),0_8px_32px_-8px_rgba(139,92,246,0.3)]"
          : "border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 shadow-sm hover:shadow-md"
      }`}
    >
      {/* ambient glow */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl"
        style={{ backgroundColor: isDark ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.10)" }}
        aria-hidden
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Left — icon + text */}
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${
              isDark
                ? "bg-violet-500/15 ring-violet-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "bg-violet-100 ring-violet-200"
            }`}
          >
            <Rocket className={`h-5 w-5 ${isDark ? "text-violet-400" : "text-violet-600"}`} />
          </div>
          <div>
            <p className={`font-black ${isDark ? "text-white" : "text-gray-900"}`}>
              🚀 Central de Demonstrações
            </p>
            <p className={`mt-0.5 text-sm ${isDark ? "text-violet-300/70" : "text-gray-500"}`}>
              Compartilhe as versões Basic, Pro e Enterprise com clientes.
            </p>
          </div>
        </div>

        {/* Right — actions */}
        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end lg:flex-row">
          {/* Abrir Central */}
          <a
            href={DEMO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition ${
              isDark
                ? "bg-violet-600 text-white shadow-[0_4px_14px_-4px_rgba(139,92,246,0.7),inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-violet-500"
                : "bg-violet-600 text-white shadow-[0_4px_14px_-4px_rgba(109,40,217,0.4)] hover:bg-violet-700"
            }`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir Central
          </a>

          {/* Copiar Link */}
          <button
            onClick={copyLink}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition ${
              copied
                ? isDark
                  ? "border-green-500/40 bg-green-500/15 text-green-400"
                  : "border-green-300 bg-green-50 text-green-700"
                : isDark
                  ? "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                  : "border-violet-200 bg-white text-gray-700 hover:bg-violet-50"
            }`}
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copiado!" : "Copiar Link"}
          </button>

          {/* WhatsApp */}
          <a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition ${
              isDark
                ? "border-green-500/25 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Compartilhar WhatsApp
          </a>

          {/* Configurar IA — super admin only */}
          {showConfigureAI && (
            <button
              onClick={configureAI}
              disabled={enteringAI}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                isDark
                  ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
                  : "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              {enteringAI ? "Abrindo..." : "Configurar IA"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
