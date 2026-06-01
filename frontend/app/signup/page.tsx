"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import { PasswordInput } from "@/components/ui/PasswordInput";

export default function SignupPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.companyName || !form.name || !form.email || !form.password) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Senha mínima de 6 caracteres");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Senhas não conferem");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/signup", {
        companyName: form.companyName,
        name: form.name,
        email: form.email,
        password: form.password,
      });
      setAuth(data.accessToken, data.user);
      localStorage.setItem("token", data.accessToken);
      localStorage.setItem("user", JSON.stringify(data.user));
      document.cookie = `token=${data.accessToken}; path=/`;
      toast.success("Conta criada com sucesso!");
      router.push("/pdv");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 w-full max-w-md shadow-2xl">
        <h1 className="text-4xl font-bold text-white mb-2">Criar conta</h1>
        <p className="text-slate-400 mb-8">Cadastre seu restaurante gratuitamente</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Nome do restaurante *"
            value={form.companyName}
            onChange={(e) => set("companyName", e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 focus:border-green-500 transition text-white p-4 rounded-2xl outline-none"
          />
          <input
            type="text"
            placeholder="Seu nome *"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 focus:border-green-500 transition text-white p-4 rounded-2xl outline-none"
          />
          <input
            type="email"
            placeholder="E-mail *"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 focus:border-green-500 transition text-white p-4 rounded-2xl outline-none"
          />
          <PasswordInput
            value={form.password}
            onChange={(v) => set("password", v)}
            placeholder="Senha (mín. 6 caracteres) *"
            autoComplete="new-password"
            className="w-full bg-slate-800 border border-slate-700 focus:border-green-500 transition text-white p-4 rounded-2xl outline-none"
          />
          <PasswordInput
            value={form.confirmPassword}
            onChange={(v) => set("confirmPassword", v)}
            placeholder="Confirmar senha *"
            autoComplete="new-password"
            className="w-full bg-slate-800 border border-slate-700 focus:border-green-500 transition text-white p-4 rounded-2xl outline-none"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-white py-4 rounded-2xl font-bold"
          >
            {loading ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        <p className="text-center text-slate-500 text-sm mt-6">
          Já tem conta?{" "}
          <Link href="/login" className="text-green-400 hover:text-green-300 font-medium">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
