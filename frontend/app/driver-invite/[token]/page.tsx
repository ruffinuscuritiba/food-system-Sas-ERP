"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Bike } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";

interface Props {
  params: Promise<{ token: string }>;
}

/**
 * Convite de instalação do app do entregador — em vez do admin inventar uma
 * senha e repassar ela por fora (WhatsApp/papel, 2 informações pra
 * comunicar), o admin manda só este link (gerado em /entregadores); o
 * entregador define a própria senha aqui e já cai logado no app, pronto
 * pra instalar (banner de instalação aparece em /driver).
 */
export default function DriverInvitePage({ params }: Props) {
  const { token } = use(params);
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/drivers/invite/accept", { token, password });
      setAuth(data.accessToken, data.user);
      toast.success("Conta ativada!");
      router.replace("/driver");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Link inválido ou expirado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
            <Bike className="text-orange-600" size={24} />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Bem-vindo!</h1>
          <p className="text-sm text-gray-500">
            Defina sua senha pra ativar sua conta de entregador.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Senha</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-orange-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Confirmar senha</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repita a senha"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-orange-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold rounded-xl py-3 text-sm transition"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? "Ativando..." : "Ativar conta e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
