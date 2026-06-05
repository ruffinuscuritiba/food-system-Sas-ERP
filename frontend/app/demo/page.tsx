"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, MessageCircle, UtensilsCrossed } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import { DEMO_ACCOUNTS, type DemoAccount } from "@/lib/demoThemes";

export default function DemoPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [entering, setEntering] = useState<string | null>(null);

  async function enterDemo(demo: DemoAccount) {
    setEntering(demo.id);
    try {
      const { data } = await api.post("auth/login", {
        email: demo.email,
        password: demo.password,
      });
      const { accessToken, user } = data;
      if (!accessToken) {
        toast.error("Demonstração indisponível no momento.");
        return;
      }
      setAuth(accessToken, user);
      document.cookie = `token=${accessToken}; path=/`;
      localStorage.setItem("token", accessToken);
      localStorage.setItem("user", JSON.stringify(user));
      toast.success(`Entrando na demo ${demo.plan}...`);
      router.push("/pdv");
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          "Não foi possível abrir esta demonstração. Tente novamente em instantes.",
      );
    } finally {
      setEntering(null);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#05070d] via-[#0a0f1f] to-[#05070d] text-white">
      {/* Glow decorativo */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -top-40 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-orange-500/10 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[320px] w-[520px] rounded-full bg-violet-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-10 sm:px-8 sm:py-16">
        {/* Header */}
        <header className="mb-10 flex items-center gap-3 sm:mb-14">
          <div className="rounded-2xl bg-orange-500/15 p-2.5 ring-1 ring-orange-500/40">
            <UtensilsCrossed className="h-5 w-5 text-orange-400" />
          </div>
          <span className="text-lg font-black tracking-tight sm:text-xl">
            FoodSaaS ERP
          </span>
        </header>

        {/* Hero */}
        <section className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/70 backdrop-blur">
            Demonstrações ao vivo
          </p>
          <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">
            FoodSaaS ERP
          </h1>
          <p className="mt-4 text-base text-white/60 sm:text-lg">
            Escolha uma demonstração para experimentar
          </p>
        </section>

        {/* Cards */}
        <section className="mt-12 grid gap-6 sm:mt-16 md:grid-cols-3">
          {DEMO_ACCOUNTS.map((demo) => (
            <DemoCard
              key={demo.id}
              demo={demo}
              loading={entering === demo.id}
              disabled={entering !== null && entering !== demo.id}
              onSelect={() => enterDemo(demo)}
            />
          ))}
        </section>

        {/* Rodapé / CTA */}
        <section className="mt-16 flex flex-col items-center gap-4 text-center sm:mt-20">
          <p className="max-w-md text-sm text-white/60 sm:text-base">
            Experimente o sistema completo antes de contratar.
          </p>
          <a
            href="https://wa.me/?text=Quero%20falar%20com%20um%20especialista%20FoodSaaS"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white/90 transition hover:border-white/30 hover:bg-white/10"
          >
            <MessageCircle className="h-4 w-4" />
            Falar com Especialista
          </a>
        </section>

        <footer className="mt-auto pt-12 text-center text-xs text-white/30">
          © {new Date().getFullYear()} FoodSaaS ERP — Demonstração pública
        </footer>
      </div>
    </main>
  );
}

interface DemoCardProps {
  demo: DemoAccount;
  loading: boolean;
  disabled: boolean;
  onSelect: () => void;
}

function DemoCard({ demo, loading, disabled, onSelect }: DemoCardProps) {
  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)]"
      style={{
        boxShadow: `0 0 0 1px rgba(255,255,255,0.02), 0 20px 60px -30px ${demo.primaryColor}55`,
      }}
    >
      {/* Glow superior do card */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full opacity-40 blur-3xl transition-opacity duration-300 group-hover:opacity-70"
        style={{ backgroundColor: demo.primaryColor }}
        aria-hidden
      />

      <div className="relative">
        <span
          className="inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
          style={{
            color: demo.primaryColor,
            backgroundColor: `${demo.primaryColor}1f`,
            border: `1px solid ${demo.primaryColor}55`,
          }}
        >
          {demo.plan}
        </span>
        <h2 className="mt-4 text-2xl font-black tracking-tight">{demo.label}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          {demo.tagline}
        </p>
      </div>

      <ul className="relative mt-6 space-y-2.5">
        {demo.features.map((feat) => (
          <li
            key={feat}
            className="flex items-start gap-2.5 text-sm text-white/80"
          >
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${demo.primaryColor}26` }}
            >
              <Check
                className="h-3 w-3"
                style={{ color: demo.primaryColor }}
                strokeWidth={3}
              />
            </span>
            {feat}
          </li>
        ))}
      </ul>

      <button
        onClick={onSelect}
        disabled={loading || disabled}
        className="relative mt-8 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black text-white shadow-lg transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          backgroundColor: demo.primaryColor,
          boxShadow: `0 12px 30px -10px ${demo.primaryColor}aa`,
        }}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Abrindo...
          </>
        ) : (
          `Testar ${demo.plan.charAt(0) + demo.plan.slice(1).toLowerCase()}`
        )}
      </button>
    </article>
  );
}
