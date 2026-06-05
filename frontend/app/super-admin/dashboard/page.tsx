"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { saApi } from "@/services/superAdminApi"
import { DemoCentralCard } from "@/components/DemoCentralCard"

interface Company {
  id: string
  name: string
  email: string
  plan: string
  subscriptionStatus: string
  isBlocked: boolean
  archivedAt: string | null
  createdAt: string
  _count: { users: number; orders: number }
}

interface Stats {
  total: number
  active: number
  blocked: number
  archived: number
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
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, blocked: 0, archived: 0 })
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [blocking, setBlocking] = useState<string | null>(null)
  const [archiving, setArchiving] = useState<string | null>(null)
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
  const [seeding, setSeeding] = useState(false)
  const [initingDemos, setInitingDemos] = useState(false)
  const [fixingModules, setFixingModules] = useState<string | null>(null)
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [cloneTarget, setCloneTarget] = useState<Company | null>(null)
  const [cloneSourceId, setCloneSourceId] = useState("")
  const [cloning, setCloning] = useState(false)
  const [cloneResult, setCloneResult] = useState<{ categories: number; products: number } | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("sa_token")
    if (!token) {
      router.push("/super-admin/login")
      return
    }
    load()
  }, [showArchived])

  async function load() {
    setLoading(true)
    try {
      const [companiesRes, statsRes] = await Promise.all([
        saApi.get(`/super-admin/companies?showArchived=${showArchived}`),
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

  async function archiveCompany(id: string, name: string) {
    if (!window.confirm(`Arquivar "${name}"? A empresa ficará oculta da listagem padrão. Os dados serão preservados.`)) return
    setArchiving(id)
    try {
      await saApi.patch(`/super-admin/companies/${id}/archive`)
      await load()
    } catch {
      alert("Erro ao arquivar empresa.")
    } finally {
      setArchiving(null)
    }
  }

  async function restoreCompany(id: string) {
    setArchiving(id)
    try {
      await saApi.patch(`/super-admin/companies/${id}/restore`)
      await load()
    } catch {
      alert("Erro ao restaurar empresa.")
    } finally {
      setArchiving(null)
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

  async function fixModules(id: string) {
    setFixingModules(id)
    try {
      await saApi.post(`/super-admin/companies/${id}/fix-modules`)
      await load()
    } catch {
      alert("Erro ao corrigir módulos")
    } finally {
      setFixingModules(null)
    }
  }

  async function cloneMenu(e: React.FormEvent) {
    e.preventDefault()
    if (!cloneTarget || !cloneSourceId) return
    if (cloneSourceId === cloneTarget.id) { alert("Selecione uma empresa diferente como origem."); return }
    setCloning(true)
    setCloneResult(null)
    try {
      const { data } = await saApi.post(`/super-admin/companies/${cloneTarget.id}/clone-menu`, { sourceId: cloneSourceId })
      setCloneResult(data)
    } catch {
      alert("Erro ao clonar cardápio. Verifique se a empresa de origem possui produtos cadastrados.")
    } finally {
      setCloning(false)
    }
  }

  async function runSeed() {
    if (!window.confirm("Criar/restaurar empresa demo com 15 categorias e 45 produtos?")) return
    setSeeding(true)
    try {
      const { data } = await saApi.post("/super-admin/seed")
      alert(`Seed concluído: ${data.categories} categorias, ${data.products} produtos (ID: ${data.companyId})`)
      await load()
    } catch {
      alert("Erro ao executar seed")
    } finally {
      setSeeding(false)
    }
  }

  async function initDemos() {
    if (!window.confirm("Criar/resetar as 3 empresas de demonstração comercial?\n\n• Demo BASIC — demo-basic@foodsaas.demo\n• Demo PRO — demo-pro@foodsaas.demo\n• Demo ENTERPRISE — demo-enterprise@foodsaas.demo\n\nIsso também executa o Seed de dados antes de clonar o cardápio.")) return
    setInitingDemos(true)
    try {
      const { data } = await saApi.post("/super-admin/demo/init")
      const lines = data.demos.map((d: any) => `${d.plan}: ${d.email} / senha no backend`).join("\n")
      alert(`✅ ${data.message}\n\n${lines}`)
      await load()
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao inicializar demos comerciais"
      alert(`Erro: ${msg}`)
    } finally {
      setInitingDemos(false)
    }
  }

  function logout() {
    localStorage.removeItem("sa_token")
    router.push("/super-admin/login")
  }

  function statusBadge(c: Company) {
    if (c.archivedAt) return <span className="px-2 py-1 rounded-lg text-xs font-medium bg-gray-700 text-gray-400">Arquivado</span>
    if (c.isBlocked) return <span className="px-2 py-1 rounded-lg text-xs font-medium bg-red-900 text-red-300">Bloqueado</span>
    return <span className="px-2 py-1 rounded-lg text-xs font-medium bg-green-900 text-green-300">Ativo</span>
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
        <div className="grid grid-cols-4 gap-4 mb-8">
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
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <p className="text-gray-400 text-sm">Arquivados</p>
            <p className="text-4xl font-bold text-gray-400 mt-1">{stats.archived}</p>
          </div>
        </div>

        {/* Demo Central */}
        <div className="mb-8">
          <DemoCentralCard variant="dark" />
        </div>

        {/* Actions bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">Restaurantes</h2>
            <button
              onClick={() => setShowArchived((v) => !v)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
                showArchived
                  ? "bg-gray-700 border-gray-500 text-white"
                  : "bg-transparent border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
              }`}
            >
              {showArchived ? "Ocultar Arquivadas" : "Mostrar Arquivadas"}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.href = "/super-admin/pricing"}
              className="bg-gray-700 hover:bg-gray-600 transition rounded-xl px-5 py-2.5 text-sm font-semibold"
            >
              💰 Preços
            </button>
            <button
              onClick={runSeed}
              disabled={seeding}
              className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 transition rounded-xl px-5 py-2.5 text-sm font-semibold"
              title="Cria/restaura a empresa-base de seed com 45 produtos (company-seed-001)"
            >
              {seeding ? "Gerando..." : "🌱 Seed Base"}
            </button>
            <button
              onClick={initDemos}
              disabled={initingDemos}
              className="bg-violet-700 hover:bg-violet-600 disabled:opacity-50 transition rounded-xl px-5 py-2.5 text-sm font-semibold"
              title="Cria/reseta as 3 empresas de demonstração comercial (Basic, Pro, Enterprise)"
            >
              {initingDemos ? "Criando demos..." : "🎯 Init Demos"}
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 transition rounded-xl px-5 py-2.5 text-sm font-semibold"
            >
              + Novo Restaurante
            </button>
          </div>
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
                <tr
                  key={c.id}
                  className={`border-b border-gray-800 transition ${
                    c.archivedAt ? "opacity-50 hover:opacity-70" : "hover:bg-gray-800/50"
                  }`}
                >
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
                  <td className="px-6 py-4">{statusBadge(c)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!c.archivedAt && (
                        <>
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
                            onClick={() => fixModules(c.id)}
                            disabled={fixingModules === c.id}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50 bg-teal-700 hover:bg-teal-600 text-white"
                          >
                            {fixingModules === c.id ? "..." : "Fix Módulos"}
                          </button>
                          <button
                            onClick={() => { setCloneTarget(c); setCloneSourceId(""); setCloneResult(null); setShowCloneModal(true) }}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg transition bg-amber-700 hover:bg-amber-600 text-white"
                          >
                            📋 Clonar
                          </button>
                          <button
                            onClick={() => archiveCompany(c.id, c.name)}
                            disabled={archiving === c.id}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white"
                          >
                            {archiving === c.id ? "..." : "Arquivar"}
                          </button>
                        </>
                      )}
                      {c.archivedAt && (
                        <>
                          <span className="text-xs text-gray-500">
                            Arquivado em {new Date(c.archivedAt).toLocaleDateString("pt-BR")}
                          </span>
                          <button
                            onClick={() => restoreCompany(c.id)}
                            disabled={archiving === c.id}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50 bg-green-700 hover:bg-green-600 text-white"
                          >
                            {archiving === c.id ? "..." : "Restaurar"}
                          </button>
                          <button
                            onClick={() => deleteCompany(c.id, c.name)}
                            disabled={deleting === c.id}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50 bg-red-900 hover:bg-red-800 text-red-300 hover:text-red-200"
                          >
                            {deleting === c.id ? "..." : "Excluir"}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    {showArchived ? "Nenhuma empresa arquivada" : "Nenhum restaurante cadastrado"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Modal — Clonar Cardápio */}
      {showCloneModal && cloneTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md">
            <h3 className="text-lg font-bold mb-2">Clonar Cardápio</h3>
            <p className="text-gray-400 text-sm mb-6">
              Copiar categorias e produtos para <strong className="text-white">{cloneTarget.name}</strong>
            </p>

            {cloneResult ? (
              <div className="bg-green-900/40 border border-green-600 rounded-xl p-5 text-center mb-6">
                <p className="text-green-300 text-lg font-bold">✅ Cardápio clonado com sucesso!</p>
                <p className="text-green-400 text-sm mt-2">
                  {cloneResult.categories} categorias e {cloneResult.products} produtos copiados.
                </p>
              </div>
            ) : (
              <form onSubmit={cloneMenu} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Copiar cardápio de qual restaurante?</label>
                  <select
                    value={cloneSourceId}
                    onChange={(e) => setCloneSourceId(e.target.value)}
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Selecione a empresa de origem...</option>
                    {companies
                      .filter((c) => c.id !== cloneTarget.id && !c.archivedAt)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c._count.orders} pedidos)
                        </option>
                      ))}
                  </select>
                  <p className="text-gray-500 text-xs mt-1">
                    ⚠️ Isso adicionará produtos/categorias sem apagar os existentes.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCloneModal(false)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 transition rounded-xl py-3 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={cloning || !cloneSourceId}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition rounded-xl py-3 font-semibold"
                  >
                    {cloning ? "Clonando..." : "Clonar"}
                  </button>
                </div>
              </form>
            )}

            {cloneResult && (
              <button
                onClick={() => setShowCloneModal(false)}
                className="w-full bg-gray-800 hover:bg-gray-700 transition rounded-xl py-3 font-medium"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      )}

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
