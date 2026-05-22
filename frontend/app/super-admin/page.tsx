"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { api } from "@/services/api";
import Link from "next/link";

type Company = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  plan: string;
  subscriptionStatus: string;
  dueDate: string | null;
  isBlocked: boolean;
  createdAt: string;
  users: { id: string; name: string; email: string; role: string }[];
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  TRIAL: "Trial",
  PENDING_PAYMENT: "Pend. Pagamento",
  SUSPENDED: "Suspenso",
  CANCELLED: "Cancelado",
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-green-500/10 text-green-400 border-green-500/30",
  TRIAL: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  PENDING_PAYMENT: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  SUSPENDED: "bg-red-500/10 text-red-400 border-red-500/30",
  CANCELLED: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

const PLAN_LABEL: Record<string, string> = {
  BASIC: "Básico",
  DELIVERY: "Profissional",
  ENTERPRISE: "Enterprise",
};

export default function SuperAdminPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [selected, setSelected] = useState<Company | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    trial: 0,
    blocked: 0,
    mrr: 0,
  });

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) { router.push("/login"); return; }
    const user = JSON.parse(userStr);
    if (user.role !== "SUPER_ADMIN") {
      toast.error("Acesso negado. Apenas SUPER_ADMIN.");
      router.push("/dashboard");
      return;
    }
    loadCompanies();
  }, []);

  async function loadCompanies() {
    try {
      const res = await api.get("/company");
      const data: Company[] = res.data;
      setCompanies(data);

      const planMrr: Record<string, number> = { BASIC: 97, DELIVERY: 197, ENTERPRISE: 397 };
      setStats({
        total: data.length,
        active: data.filter((c) => c.subscriptionStatus === "ACTIVE").length,
        trial: data.filter((c) => c.subscriptionStatus === "TRIAL").length,
        blocked: data.filter((c) => c.isBlocked).length,
        mrr: data
          .filter((c) => c.subscriptionStatus === "ACTIVE")
          .reduce((sum, c) => sum + (planMrr[c.plan] || 0), 0),
      });
    } catch {
      toast.error("Erro ao carregar empresas.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleBlock(company: Company) {
    setActionLoading(company.id);
    try {
      const endpoint = company.isBlocked
        ? `/company/${company.id}/unblock`
        : `/company/${company.id}/block`;
      await api.patch(endpoint);
      toast.success(company.isBlocked ? "Empresa desbloqueada." : "Empresa bloqueada.");
      loadCompanies();
      setSelected(null);
    } catch {
      toast.error("Erro ao alterar status.");
    } finally {
      setActionLoading(null);
    }
  }

  async function updatePlan(companyId: string, plan: string, status: string) {
    setActionLoading(companyId);
    try {
      await api.patch(`/company/${companyId}`, { plan, subscriptionStatus: status });
      toast.success("Plano atualizado.");
      loadCompanies();
      setSelected(null);
    } catch {
      toast.error("Erro ao atualizar plano.");
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = companies.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "ALL" || c.subscriptionStatus === filterStatus;
    return matchSearch && matchStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-red-500">🔧 Super Admin</h1>
            <p className="text-slate-400 text-sm">Painel de controle SaaS</p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:border-slate-500 transition"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Total Clientes", value: stats.total, color: "text-white" },
            { label: "Ativos", value: stats.active, color: "text-green-400" },
            { label: "Em Trial", value: stats.trial, color: "text-yellow-400" },
            { label: "Bloqueados", value: stats.blocked, color: "text-red-400" },
            { label: "MRR", value: `R$ ${stats.mrr.toLocaleString("pt-BR")}`, color: "text-blue-400" },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">{k.label}</p>
              <p className={`text-2xl font-black mt-1 ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Buscar empresa ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-white focus:border-red-500 focus:outline-none"
          >
            <option value="ALL">Todos os status</option>
            <option value="ACTIVE">Ativos</option>
            <option value="TRIAL">Trial</option>
            <option value="PENDING_PAYMENT">Pend. Pagamento</option>
            <option value="SUSPENDED">Suspenso</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3">Empresa</th>
                  <th className="px-5 py-3">Plano</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Vencimento</th>
                  <th className="px-5 py-3">Usuários</th>
                  <th className="px-5 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                      Nenhuma empresa encontrada.
                    </td>
                  </tr>
                ) : (
                  filtered.map((company) => (
                    <tr
                      key={company.id}
                      className="border-b border-slate-800 hover:bg-slate-800/50 transition"
                    >
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-semibold">{company.name}</p>
                          {company.email && (
                            <p className="text-xs text-slate-400">{company.email}</p>
                          )}
                          {company.isBlocked && (
                            <span className="text-xs text-red-400">🔒 Bloqueada</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm font-medium">
                          {PLAN_LABEL[company.plan] || company.plan}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            STATUS_COLOR[company.subscriptionStatus] || "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {STATUS_LABEL[company.subscriptionStatus] || company.subscriptionStatus}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-400">
                        {company.dueDate
                          ? new Date(company.dueDate).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-400">
                        {company.users?.length || 0}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setSelected(company)}
                          className="rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-xs font-semibold transition"
                        >
                          Gerenciar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h2 className="text-lg font-bold">{selected.name}</h2>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white text-2xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Email</p>
                  <p>{selected.email || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Telefone</p>
                  <p>{selected.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Plano atual</p>
                  <p>{PLAN_LABEL[selected.plan] || selected.plan}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Status</p>
                  <p>{STATUS_LABEL[selected.subscriptionStatus] || selected.subscriptionStatus}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Vencimento</p>
                  <p>{selected.dueDate ? new Date(selected.dueDate).toLocaleDateString("pt-BR") : "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Criada em</p>
                  <p>{new Date(selected.createdAt).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>

              {/* Alterar plano */}
              <div>
                <p className="text-sm font-semibold mb-2">Alterar plano e status</p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { plan: "BASIC", status: "ACTIVE", label: "Básico Ativo" },
                    { plan: "DELIVERY", status: "ACTIVE", label: "Prof. Ativo" },
                    { plan: "ENTERPRISE", status: "ACTIVE", label: "Enterprise Ativo" },
                    { plan: selected.plan, status: "TRIAL", label: "Definir Trial" },
                    { plan: selected.plan, status: "SUSPENDED", label: "Suspender" },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => updatePlan(selected.id, opt.plan, opt.status)}
                      disabled={actionLoading === selected.id}
                      className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs hover:border-slate-400 transition disabled:opacity-50"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bloquear / Desbloquear */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => toggleBlock(selected)}
                  disabled={actionLoading === selected.id}
                  className={`flex-1 rounded-xl py-2.5 font-bold transition disabled:opacity-50 ${
                    selected.isBlocked
                      ? "bg-green-500 hover:bg-green-600"
                      : "bg-red-500 hover:bg-red-600"
                  }`}
                >
                  {actionLoading === selected.id
                    ? "Processando..."
                    : selected.isBlocked
                    ? "Desbloquear empresa"
                    : "Bloquear empresa"}
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="flex-1 rounded-xl border border-slate-600 py-2.5 font-semibold hover:border-slate-400 transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
