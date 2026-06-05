"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UtensilsCrossed } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "@/stores/auth.store";
import { loginDemo, getDemoAccount, type DemoPlan } from "./_enterDemo";

export default function AutoEnterDemo({ plan }: { plan: DemoPlan }) {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const demo = getDemoAccount(plan);

  useEffect(() => {
    async function run() {
      try {
        const { accessToken, user } = await loginDemo(plan);
        if (!accessToken) throw new Error("Token ausente");
        setAuth(accessToken, user as Parameters<typeof setAuth>[1]);
        document.cookie = `token=${accessToken}; path=/`;
        localStorage.setItem("token", accessToken);
        localStorage.setItem("user", JSON.stringify(user));
        toast.success(`Abrindo demo ${plan.toUpperCase()}…`);
        router.push("/pdv");
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          "Demonstração indisponível. Tente /demo para escolher outra.";
        setError(msg);
        toast.error(msg);
      }
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const color = demo?.primaryColor ?? "#f97316";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#07090f] text-white">
      <div
        className="rounded-2xl p-3 ring-1"
        style={{ backgroundColor: `${color}18`, border: `1px solid ${color}44` }}
      >
        <UtensilsCrossed className="h-8 w-8" style={{ color }} />
      </div>

      {error ? (
        <>
          <p className="max-w-xs text-center text-sm text-white/60">{error}</p>
          <a
            href="/demo"
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Voltar para demos
          </a>
        </>
      ) : (
        <>
          <p className="text-lg font-black">Abrindo demo {plan.toUpperCase()}…</p>
          <Loader2 className="h-6 w-6 animate-spin" style={{ color }} />
          <p className="text-xs text-white/40">Carregando {demo?.label ?? "demonstração"}</p>
        </>
      )}
    </div>
  );
}
