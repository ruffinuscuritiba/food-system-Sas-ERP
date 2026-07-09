"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Store } from "lucide-react";
import { SuperAdminTopBar } from "@/components/super-admin/SuperAdminTopBar";
import { saApi } from "@/services/superAdminApi";
import { LojaTab } from "@/components/settings/LojaTab";

/**
 * Identidade da própria plataforma (R_FoodSaaS ERP / conta "Ruffinu's Pizzaria").
 * O super-admin não tinha um lugar nativo pra editar os próprios dados/horários
 * sem impersonar uma loja — esta página resolve isso, reaproveitando o mesmo
 * componente de "Minha Loja" usado por qualquer empresa comum, mas falando
 * direto com o sa_token via /super-admin/platform/settings.
 */
export default function SuperAdminLojaPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("sa_token");
    if (!token) {
      router.replace("/super-admin/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-[var(--surface-0)] text-white">
      <SuperAdminTopBar />
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
            <Store className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Minha Loja — R_FoodSaaS ERP</h1>
            <p className="text-xs text-zinc-500">
              Dados, endereço e horários da própria plataforma (usados pela Kely e pelo cardápio interno).
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-1">
          <LojaTab client={saApi} endpoint="/super-admin/platform/settings" skipAuthCheck />
        </div>
      </main>
    </div>
  );
}
