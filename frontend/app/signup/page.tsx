"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import { PasswordInput } from "@/components/ui/PasswordInput";

const SEGMENTS = [
  { value: "RESTAURANTE",  label: "Restaurante",   emoji: "🍽️" },
  { value: "LANCHONETE",   label: "Lanchonete",    emoji: "🥪" },
  { value: "PIZZARIA",     label: "Pizzaria",      emoji: "🍕" },
  { value: "CHURRASCARIA", label: "Churrascaria",  emoji: "🥩" },
  { value: "MARMITARIA",   label: "Marmitaria",    emoji: "🍱" },
  { value: "HOT_DOG",      label: "Hot Dog",        emoji: "🌭" },
  { value: "PASTELARIA",   label: "Pastelaria",    emoji: "🥟" },
  { value: "PADARIA",      label: "Padaria",       emoji: "🥐" },
  { value: "DOCERIA",      label: "Doceria",       emoji: "🍰" },
  { value: "CONVENIENCIA", label: "Conveniência",  emoji: "🏪" },
  { value: "HAMBURGUERIA", label: "Hamburgueria",  emoji: "🍔" },
  { value: "ACAI",         label: "Açaí",          emoji: "🫐" },
  { value: "MERCADO",      label: "Mercado",       emoji: "🛒" },
] as const;

export default function SignupPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [segment, setSegment] = useState("");
  const [form, setForm] = useState({
    companyName: "",
    name: "",
    email: "",
    whatsapp: "",
    password: "",
    confirmPassword: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function selectSegment(value: string) {
    setSegment(value);
    setStep(2);
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
        whatsapp: form.whatsapp || undefined,
        businessSegment: segment || "RESTAURANTE",
      });
      setAuth(data.accessToken, data.user);
      localStorage.setItem("token", data.accessToken);
      localStorage.setItem("user", JSON.stringify(data.user));
      document.cookie = `token=${data.accessToken}; path=/`;
      toast.success("Conta criada! Escolha seu plano.");
      router.push("/assinatura");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  const selectedSegmentData = SEGMENTS.find((s) => s.value === segment);

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-lg">
        {/* Step 1 — Escolha do segmento */}
        {step === 1 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Qual é o seu negócio?</h1>
              <p className="text-slate-400">Vamos pré-configurar o sistema para você</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SEGMENTS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => selectSegment(s.value)}
                  className="flex flex-col items-center gap-2 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-green-500 rounded-2xl transition-all duration-150 group"
                >
                  <span className="text-3xl group-hover:scale-110 transition-transform">{s.emoji}</span>
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white text-center leading-tight">
                    {s.label}
                  </span>
                </button>
              ))}
            </div>

            <p className="text-center text-slate-500 text-sm mt-6">
              Já tem conta?{" "}
              <Link href="/login" className="text-green-400 hover:text-green-300 font-medium">
                Entrar
              </Link>
            </p>
          </div>
        )}

        {/* Step 2 — Dados da conta */}
        {step === 2 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-10 shadow-2xl">
            {/* Back + segmento selecionado */}
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setStep(1)}
                className="text-slate-400 hover:text-white transition text-sm flex items-center gap-1"
              >
                ← Voltar
              </button>
              {selectedSegmentData && (
                <span className="ml-auto flex items-center gap-2 bg-green-900/30 border border-green-700/50 rounded-xl px-3 py-1.5 text-sm text-green-300 font-medium">
                  <span>{selectedSegmentData.emoji}</span>
                  {selectedSegmentData.label}
                </span>
              )}
            </div>

            <h1 className="text-3xl font-bold text-white mb-2">Criar conta</h1>
            <p className="text-slate-400 mb-7">Cadastre seu estabelecimento gratuitamente</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Nome do estabelecimento *"
                value={form.companyName}
                onChange={(e) => set("companyName", e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 focus:border-green-500 transition text-white p-4 rounded-2xl outline-none"
                autoComplete="organization"
              />
              <input
                type="text"
                placeholder="Seu nome *"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 focus:border-green-500 transition text-white p-4 rounded-2xl outline-none"
                autoComplete="name"
              />
              <input
                type="email"
                placeholder="E-mail *"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 focus:border-green-500 transition text-white p-4 rounded-2xl outline-none"
                autoComplete="email"
              />
              <input
                type="tel"
                placeholder="WhatsApp (opcional) — ex: 41999999999"
                value={form.whatsapp}
                onChange={(e) => set("whatsapp", e.target.value.replace(/\D/g, ""))}
                className="w-full bg-slate-800 border border-slate-700 focus:border-green-500 transition text-white p-4 rounded-2xl outline-none"
                autoComplete="tel"
                maxLength={13}
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
                className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-white py-4 rounded-2xl font-bold mt-2"
              >
                {loading ? "Criando conta..." : "Criar conta gratuita"}
              </button>
            </form>

            <p className="text-center text-slate-500 text-sm mt-6">
              Já tem conta?{" "}
              <Link href="/login" className="text-green-400 hover:text-green-300 font-medium">
                Entrar
              </Link>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
