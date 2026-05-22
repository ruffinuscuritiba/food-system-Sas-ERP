"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import { api } from "@/services/api";

const PLANS = [
  { value: "BASIC", label: "Básico — R$ 97/mês" },
  { value: "DELIVERY", label: "Profissional — R$ 197/mês" },
  { value: "ENTERPRISE", label: "Enterprise — R$ 397/mês" },
];

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultPlan = searchParams.get("plan") || "DELIVERY";

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    // Empresa
    companyName: "",
    companyPhone: "",
    companyEmail: "",
    plan: defaultPlan,
    // Usuário admin
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      // 1. Criar empresa
      const companyRes = await api.post("/company", {
        name: form.companyName,
        phone: form.companyPhone,
        email: form.companyEmail,
        plan: form.plan,
        subscriptionStatus: "TRIAL",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      const companyId = companyRes.data.id;

      // 2. Criar usuário admin vinculado à empresa
      await api.post("/auth/register", {
        name: form.name,
        email: form.email,
        password: form.password,
        role: "ADMIN",
        companyId,
      });

      // 3. Login automático
      const loginRes = await api.post("/auth/login", {
        email: form.email,
        password: form.password,
      });
      localStorage.setItem("token", loginRes.data.accessToken);
      localStorage.setItem("user", JSON.stringify(loginRes.data.user));

      toast.success("Conta criada com sucesso! Bem-vindo(a)!");
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao criar conta.";
      toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-12">
      <Toaster position="top-right" />
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/landing" className="text-3xl font-black text-red-500">
            🍽️ FoodSaaS
          </Link>
          <p className="mt-2 text-slate-400">Crie sua conta em 2 minutos</p>
        </div>

        {/* Steps indicator */}
        <div className="mb-8 flex items-center justify-center gap-4">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  step >= s ? "bg-red-500" : "bg-slate-700"
                }`}
              >
                {s}
              </div>
              <span className={`text-sm ${step >= s ? "text-white" : "text-slate-500"}`}>
                {s === 1 ? "Sua empresa" : "Seu acesso"}
              </span>
              {s < 2 && <div className="h-px w-8 bg-slate-700" />}
            </div>
          ))}
        </div>

        <form
          onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2); } : handleSubmit}
          className="rounded-2xl border border-slate-700 bg-slate-900 p-8 space-y-5"
        >
          {step === 1 && (
            <>
              <h2 className="text-xl font-bold mb-2">Dados da empresa</h2>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nome do estabelecimento *</label>
                <input
                  name="companyName"
                  value={form.companyName}
                  onChange={handleChange}
                  required
                  placeholder="Ex: Pizzaria do João"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Email do estabelecimento</label>
                <input
                  name="companyEmail"
                  type="email"
                  value={form.companyEmail}
                  onChange={handleChange}
                  placeholder="contato@pizzaria.com"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Telefone / WhatsApp</label>
                <input
                  name="companyPhone"
                  value={form.companyPhone}
                  onChange={handleChange}
                  placeholder="(41) 99999-9999"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Plano *</label>
                <select
                  name="plan"
                  value={form.plan}
                  onChange={handleChange}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white focus:border-red-500 focus:outline-none"
                >
                  {PLANS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-red-500 py-3 font-bold hover:bg-red-600 transition"
              >
                Próximo →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-xl font-bold mb-2">Seu acesso de administrador</h2>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Seu nome *</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="João Silva"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Email de acesso *</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="joao@email.com"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Senha *</label>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Confirmar senha *</label>
                <input
                  name="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                  placeholder="Repita a senha"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-xl border border-slate-600 py-3 font-semibold hover:border-slate-400 transition"
                >
                  ← Voltar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-red-500 py-3 font-bold hover:bg-red-600 transition disabled:opacity-50"
                >
                  {loading ? "Criando..." : "Criar conta"}
                </button>
              </div>
            </>
          )}
        </form>

        <p className="mt-6 text-center text-slate-400 text-sm">
          Já tem conta?{" "}
          <Link href="/login" className="text-red-400 hover:text-red-300">
            Entrar
          </Link>
        </p>
        <p className="mt-2 text-center text-slate-500 text-xs">
          Ao criar sua conta você concorda com nossos{" "}
          <span className="underline cursor-pointer">Termos de Uso</span> e{" "}
          <span className="underline cursor-pointer">Política de Privacidade</span>.
        </p>
      </div>
    </div>
  );
}
