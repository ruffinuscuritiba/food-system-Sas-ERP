"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { api } from "@/services/api";
import Link from "next/link";

const PLANS = [
  {
    value: "BASIC",
    label: "Básico",
    price: "R$ 97/mês",
    features: ["Cardápio digital", "Pedidos online", "Relatórios básicos"],
  },
  {
    value: "DELIVERY",
    label: "Profissional",
    price: "R$ 197/mês",
    features: ["PDV completo", "Gestão de estoque", "Controle financeiro"],
  },
  {
    value: "ENTERPRISE",
    label: "Enterprise",
    price: "R$ 397/mês",
    features: ["Multi-tenant", "API dedicada", "Gerente de conta"],
  },
];

type CompanyInfo = {
  id: string;
  name: string;
  plan: string;
  subscriptionStatus: string;
  dueDate: string | null;
  isBlocked: boolean;
};

export default function PlanosPage() {
  const router = useRouter();
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) { router.push("/login"); return; }
    const user = JSON.parse(userStr);
    loadCompany(user.companyId);
  }, []);

  async function loadCompany(companyId: string) {
    try {
      const res = await api.get(`/company/${companyId}`);
      setCompany(res.data);
    } catch {
      toast.error("Erro ao carregar dados da empresa.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(plan: string) {
    if (!company) return;
    setUpgrading(plan);
    try {
      await api.patch(`/company/${company.id}`, {
        plan,
        subscriptionStatus: "PENDING_PAYMENT",
      });
      toast.success(`Plano alterado para ${plan}. Finalize o pagamento.`);
      router.push(`/pagamento?plan=${plan}&companyId=${company.id}`);
    } catch {
      toast.error("Erro ao alterar plano.");
    } finally {
      setUpgrading(null);
    }
  }

  const statusLabel: Record<string, string> = {
    ACTIVE: "Ativo",
    TRIAL: "Período de teste",
    PENDING_PAYMENT: "Aguardando pagamento",
    SUSPENDED: "Suspenso",
    CANCELLED: "Cancelado",
  };

  const statusColor: Record<string, string> = {
    ACTIVE: "text-green-400",
    TRIAL: "text-yellow-400",
    PENDING_PAYMENT: "text-orange-400",
    SUSPENDED: "text-red-400",
    CANCELLED: "text-slate-400",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <Toaster position="top-right" />
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestão de Planos</h1>
            <p className="text-slate-400 mt-1">Gerencie sua assinatura</p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:border-slate-500 transition"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Status atual */}
        {company && (
          <div className="mb-8 rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold mb-4">Assinatura atual</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Empresa</p>
                <p className="font-semibold mt-1">{company.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Plano</p>
                <p className="font-semibold mt-1">
                  {PLANS.find((p) => p.value === company.plan)?.label || company.plan}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Status</p>
                <p className={`font-semibold mt-1 ${statusColor[company.subscriptionStatus] || "text-white"}`}>
                  {statusLabel[company.subscriptionStatus] || company.subscriptionStatus}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Vencimento</p>
                <p className="font-semibold mt-1">
                  {company.dueDate
                    ? new Date(company.dueDate).toLocaleDateString("pt-BR")
                    : "—"}
                </p>
              </div>
            </div>
            {company.isBlocked && (
              <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm">
                ⚠️ Sua conta está bloqueada. Entre em contato com o suporte ou regularize o pagamento.
              </div>
            )}
          </div>
        )}

        {/* Planos disponíveis */}
        <h2 className="text-xl font-bold mb-6">Planos disponíveis</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((p) => {
            const isCurrent = company?.plan === p.value;
            return (
              <div
                key={p.value}
                className={`rounded-2xl border p-6 flex flex-col ${
                  isCurrent
                    ? "border-red-500 bg-red-500/5"
                    : "border-slate-700 bg-slate-900"
                }`}
              >
                {isCurrent && (
                  <span className="mb-3 self-start rounded-full bg-red-500 px-3 py-1 text-xs font-bold">
                    PLANO ATUAL
                  </span>
                )}
                <h3 className="text-xl font-bold">{p.label}</h3>
                <p className="text-2xl font-black mt-2 mb-4">{p.price}</p>
                <ul className="flex-1 space-y-2 mb-6">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                      <span className="text-green-400">✓</span> {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full rounded-xl bg-slate-700 py-3 text-sm font-semibold text-slate-400 cursor-not-allowed"
                  >
                    Plano atual
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(p.value)}
                    disabled={upgrading === p.value}
                    className="w-full rounded-xl bg-red-500 py-3 font-bold hover:bg-red-600 transition disabled:opacity-50"
                  >
                    {upgrading === p.value ? "Processando..." : "Assinar este plano"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Cancelamento */}
        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="font-semibold mb-2">Cancelar assinatura</h3>
          <p className="text-slate-400 text-sm mb-4">
            Ao cancelar, você perderá acesso ao sistema ao final do período pago.
            Seus dados ficam disponíveis por 30 dias.
          </p>
          <button
            onClick={() => toast.error("Para cancelar, entre em contato com o suporte.")}
            className="rounded-xl border border-red-500/50 px-4 py-2 text-sm text-red-400 hover:border-red-500 transition"
          >
            Solicitar cancelamento
          </button>
        </div>
      </div>
    </div>
  );
}
