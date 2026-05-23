"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { saApi } from "@/services/superAdminApi"

interface Company {
  id: string
  name: string
  email: string
  plan: string
  subscriptionStatus: string
  isBlocked: boolean
  createdAt: string
  _count: { users: number; orders: number }
}

interface Stats {
  total: number
  active: number
  blocked: number
}

const PLAN_LABELS: Record<string, string> = {
  BASIC: "Básico",
  PROFESSIONAL: "Profissional",
  ENTERPRISE: "Enterprise",
  DELIVERY: "Delivery",
}

const PLAN_COLORS: Record<string, string> = {
  BASIC: "bg-gray-700 text-gray-300",
  PROFESSIONAL: "bg-blue-900 text-blue-300",
  ENTERPRISE: "bg-purple-900 text-purple-300",
  DELIVERY: "bg-green-900 text-green-300",
}

export default function SuperAdminDashboard() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, blocked: 0 })
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [blocking, setBlocking] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [entering, setEntering] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    email: "",
    adminPassword: "",
    plan: "BASIC",
    phone: "",
  })
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState("")

  useEffect(() => {
    const token = localStorage.getItem("sa_token")
    if (!token) {
      router.push("/super-admin/login")
      return
    }
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const [companiesRes, statsRes] = await Promise.all([
        saApi.get("/super-admin/companies"),
        saApi.get("/super-admin/stats"),
      ])
      setCompanies(companiesRes.data)
      setStats(statsRes.data)
    } catch {
      router.push("/super-admin/login")
    } finally {
      setLoading(false)
    }
  }

  async function enterStore(id: string) {
    setEntering(id)
    try {
      const { data } = await saApi.post(`/super-admin/companies/${id}/impersonate`)
      localStorage.setItem("token", data.accessToken)
      localStorage.setItem("user", JSON.stringify(data.user))
      localStorage.setItem("impersonating", JSON.stringify({ companyName: data.companyName, companyId: id }))
      document.cookie = `token=${data.accessToken}; path=/`
      window.location.href = "/"
    } catch {
      alert("Erro ao acessar a loja. Verifique se ela possui usuários ativos.")
    } finally {
      setEntering(null)
    }
  }

  async function deleteCompany(id: string, name: string) {
    if (!window.confirm(`Excluir "${name}" permanentemente? Esta ação não pode ser desfeita.`)) return
    setDeleting(id)
    try {
      await saApi.delete(`/super-admin/companies/${id}`)
      await load()
    } finally {
      setDeleting(null)
    }
  }

  async function toggleBlock(id: string) {
    setBlocking(id)
    try {
      await saApi.patch(`/super-admin/companies/${id}/block`)
      await load()
    } finally {
      setBlocking(null)
    }
  }

  async function createCompany(e: React.FormEvent) {
    e.preventDefault()
    setFormError("")
    if (!form.name || !form.email || !form.adminPassword) {
      setFormError("Preencha todos os campos obrigatórios")
      return
    }
    setCreating(true)
    try {
      await saApi.post("/super-admin/companies", form)
      setShowModal(false)
      setForm({ name: "", email: "", adminPassword: "", plan: "BASIC", phone: "" })
      await load()
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Erro ao criar restaurante")
    } finally {
      setCreating(false)
    }
  }

  function logout() {
    localStorage.removeItem("sa_token")
    router.push("/super-admin/login")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <div>
            <h1 className="text-lg font-bold">Painel Super Admin</h1>
            <p className="text-xs text-gray-400">Gestão de restaurantes</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-400 hover:text-white transition px-4 py-2 rounded-lg hover:bg-gray-800"
        >
          Sair
        </button>
      </header>

      <main className="p-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <p className="text-gray-400 text-sm">Total de Restaurantes</p>
            <p className="text-4xl font-bold text-white mt-1">{stats.total}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <p className="text-gray-400 text-sm">Ativos</p>
            <p className="text-4xl font-bold text-green-400 mt-1">{stats.active}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <p className="text-gray-400 text-sm">Bloqueados</p>
            <p className="text-4xl font-bold text-red-400 mt-1">{stats.blocked}</p>
          </div>
        </div>

        {/* Actions bar */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Restaurantes</h2>
          <button
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 transition rounded-xl px-5 py-2.5 text-sm font-semibold"
          >
            + Novo Restaurante
          </button>
        </div>

        {/* Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left px-6 py-4">Restaurante</th>
                <th className="text-left px-6 py-4">Email</th>
                <th className="text-left px-6 py-4">Plano</th>
                <th className="text-left px-6 py-4">Usuários</th>
                <th className="text-left px-6 py-4">Pedidos</th>
                <th className="text-left px-6 py-4">Cadastro</th>
                <th className="text-left px-6 py-4">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                  <td className="px-6 py-4 font-medium">{c.name}</td>
                  <td className="px-6 py-4 text-gray-400">{c.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${PLAN_COLORS[c.plan] || "bg-gray-700 text-gray-300"}`}>
                      {PLAN_LABELS[c.plan] || c.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400">{c._count.users}</td>
                  <td className="px-6 py-4 text-gray-400">{c._count.orders}</td>
                  <td className="px-6 py-4 text-gray-400">
                    {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${c.isBlocked ? "bg-red-900 text-red-300" : "bg-green-900 text-green-300"}`}>
                      {c.isBlocked ? "Bloqueado" : "Ativo"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => enterStore(c.id)}
                        disabled={entering === c.id}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50 bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        {entering === c.id ? "..." : "Entrar na Loja"}
                      </button>
                      <button
                        onClick={() => toggleBlock(c.id)}
                        disabled={blocking === c.id}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50 ${
                          c.isBlocked
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "bg-orange-600 hover:bg-orange-700 text-white"
                        }`}
                      >
                        {blocking === c.id ? "..." : c.isBlocked ? "Desbloquear" : "Bloquear"}
                      </button>
                      <button
                        onClick={() => deleteCompany(c.id, c.name)}
                        disabled={deleting === c.id}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white"
                      >
                        {deleting === c.id ? "..." : "Excluir"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    Nenhum restaurante cadastrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Modal — Criar Restaurante */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md">
            <h3 className="text-lg font-bold mb-6">Novo Restaurante</h3>

            <form onSubmit={createCompany} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nome do restaurante *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Pizzaria Bella Napoli"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Email do admin *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@restaurante.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Senha inicial *</label>
                <input
                  type="password"
                  value={form.adminPassword}
                  onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Plano</label>
                <select
                  value={form.plan}
                  onChange={(e) => setForm({ ...form, plan: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="BASIC">Básico</option>
                  <option value="PROFESSIONAL">Profissional</option>
                  <option value="ENTERPRISE">Enterprise</option>
                  <option value="DELIVERY">Delivery</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Telefone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(41) 99999-9999"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {formError && (
                <p className="text-red-400 text-sm">{formError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setFormError("") }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 transition rounded-xl py-3 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition rounded-xl py-3 font-semibold"
                >
                  {creating ? "Criando..." : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
