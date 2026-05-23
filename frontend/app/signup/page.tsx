"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

const PLANS = [
  { value: "BASIC", label: "Básico — R$ 97/mês" },
  { value: "DELIVERY", label: "Profissional — R$ 197/mês" },
  { value: "ENTERPRISE", label: "Enterprise — R$ 397/mês" },
];

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const defaultPlan = searchParams.get("plan") || "DELIVERY";

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    companyName: "",
    email: "",
    password: "",
    phone: "",
    plan: defaultPlan,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);

      toast.success("Cadastro realizado!");

      setTimeout(() => {
        router.push("/login");
      }, 1000);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <Toaster />

      <div className="w-full max-w-md bg-zinc-900 p-6 rounded-xl">
        <h1 className="text-3xl font-bold mb-6">
          Criar Conta
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Empresa"
            className="w-full p-3 rounded bg-zinc-800"
            value={form.companyName}
            onChange={(e) =>
              setForm({ ...form, companyName: e.target.value })
            }
          />

          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 rounded bg-zinc-800"
            value={form.email}
            onChange={(e) =>
              setForm({ ...form, email: e.target.value })
            }
          />

          <input
            type="password"
            placeholder="Senha"
            className="w-full p-3 rounded bg-zinc-800"
            value={form.password}
            onChange={(e) =>
              setForm({ ...form, password: e.target.value })
            }
          />

          <select
            className="w-full p-3 rounded bg-zinc-800"
            value={form.plan}
            onChange={(e) =>
              setForm({ ...form, plan: e.target.value })
            }
          >
            {PLANS.map((plan) => (
              <option key={plan.value} value={plan.value}>
                {plan.label}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 p-3 rounded"
          >
            {loading ? "Criando..." : "Criar Conta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          Já possui conta?{" "}
          <Link href="/login" className="text-green-400">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <SignupContent />
    </Suspense>
  );
}