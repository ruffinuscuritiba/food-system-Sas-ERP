"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { LogIn, MoreVertical, ShieldOff, Shield, Wrench, Copy, Archive, RotateCcw, Trash2, Plus, Zap, Printer } from "lucide-react"
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

const PLAN_STYLES: Record<string, string> = {
  BASIC:        "bg-zinc-700/50 text-zinc-300 border border-zinc-600/40",
  PROFESSIONAL: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  ENTERPRISE:   "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  DELIVERY:     "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
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
  const [form, setForm] = useState({ name: "", email: "", adminPassword: "", plan: "BASIC", phone: "" })
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = localStorage.getItem("sa_token")
    if (!token) { router.push("/super-admin/login"); return }
    load()
  }, [showArchived])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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
    setOpenMenuId(null)
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
    setOpenMenuId(null)
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
    if (!form.name || !form.email || !form.adminPassword) { setFormError("Preencha todos os campos obrigatórios"); return }
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
    setOpenMenuId(null)
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
    if (c.archivedAt) return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-700/40 text-zinc-500 border border-zinc-700/40">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
        Arquivado
      </span>
    )
    if (c.isBlocked) return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        Bloqueado
      </span>
    )
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Ativo
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <div className="w-5 h-5 border-2 border-zinc-600 border-t-indigo-500 rounded-full animate-spin" />
          Carregando...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="bg-zinc-900/80 backdrop-blur border-b border-zinc-800 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Painel Super Admin</h1>
            <p className="text-xs text-zinc-500">Gestão de restaurantes</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="text-xs text-zinc-500 hover:text-zinc-200 transition px-3 py-1.5 rounded-lg hover:bg-zinc-800 border border-transparent hover:border-zinc-700"
        >
          Sair
        </button>
      </header>

      <main className="p-8 max-w-[1600px] mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total", value: stats.total, color: "text-white" },
            { label: "Ativos", value: stats.active, color: "text-emerald-400" },
            { label: "Bloqueados", value: stats.blocked, color: "text-red-400" },
            { label: "Arquivados", value: stats.archived, color: "text-zinc-400" },
          ].map((s) => (
            <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{s.label}</p>
              <p className={`text-3xl font-black mt-1.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Demo Central */}
        <div className="mb-8">
          <DemoCentralCard variant="dark" />
        </div>

        {/* Actions bar */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-white">Restaurantes</h2>
            <button
              onClick={() => setShowArchived((v) => !v)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
                showArchived
                  ? "bg-zinc-700 border-zinc-600 text-white"
                  : "bg-transparent border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-600"
              }`}
            >
              {showArchived ? "Ocultar Arquivadas" : "Mostrar Arquivadas"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => (window.location.href = "/super-admin/pricing")}
              className="text-xs font-semibold px-3.5 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 transition"
            >
              💰 Preços
            </button>
            <button
              onClick={runSeed}
              disabled={seeding}
              className="text-xs font-semibold px-3.5 py-2 rounded-lg border border-emerald-700/50 text-emerald-400 hover:bg-emerald-600/10 disabled:opacity-50 transition"
            >
              {seeding ? "Gerando..." : "🌱 Seed Base"}
            </button>
            <button
              onClick={initDemos}
              disabled={initingDemos}
              className="text-xs font-semibold px-3.5 py-2 rounded-lg border border-violet-700/50 text-violet-400 hover:bg-violet-600/10 disabled:opacity-50 transition"
            >
              {initingDemos ? "Criando..." : "🎯 Init Demos"}
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Restaurante
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Restaurante</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Plano</th>
                <th className="text-center px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Usuários</th>
                <th className="text-center px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pedidos</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Cadastro</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {companies.map((c) => (
                <tr
                  key={c.id}
                  className={`transition-colors ${
                    c.archivedAt ? "opacity-40 hover:opacity-60" : "hover:bg-zinc-800/40"
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <span className="font-semibold text-white text-sm">{c.name}</span>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-400 text-xs">{c.email}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold ${PLAN_STYLES[c.plan] || "bg-zinc-700/50 text-zinc-300 border border-zinc-600/40"}`}>
                      {PLAN_LABELS[c.plan] || c.plan}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center text-zinc-400 text-xs">{c._count.users}</td>
                  <td className="px-5 py-3.5 text-center text-zinc-400 text-xs">{c._count.orders}</td>
                  <td className="px-5 py-3.5 text-zinc-500 text-xs">
                    {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-5 py-3.5">{statusBadge(c)}</td>

                  {/* Actions */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      {!c.archivedAt ? (
                        <>
                          {/* Primary CTA */}
                          <button
                            onClick={() => enterStore(c.id)}
                            disabled={entering === c.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 whitespace-nowrap"
                          >
                            {entering === c.id
                              ? <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                              : <LogIn className="w-3 h-3" />
                            }
                            Entrar na Loja
                          </button>

                          {/* Dropdown menu */}
                          <div className="relative" ref={openMenuId === c.id ? menuRef : undefined}>
                            <button
                              onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/60 transition"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openMenuId === c.id && (
                              <div className="absolute right-0 top-8 z-50 w-48 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl shadow-black/40 py-1 overflow-hidden">
                                <button
                                  onClick={() => toggleBlock(c.id)}
                                  disabled={blocking === c.id}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-left hover:bg-zinc-800 transition disabled:opacity-50"
                                >
                                  {c.isBlocked
                                    ? <><Shield className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Desbloquear</span></>
                                    : <><ShieldOff className="w-3.5 h-3.5 text-orange-400" /><span className="text-orange-400">Bloquear</span></>
                                  }
                                </button>
                                <button
                                  onClick={() => fixModules(c.id)}
                                  disabled={fixingModules === c.id}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-left hover:bg-zinc-800 transition disabled:opacity-50 text-teal-400"
                                >
                                  <Wrench className="w-3.5 h-3.5" />
                                  {fixingModules === c.id ? "Corrigindo..." : "Fix Módulos"}
                                </button>
                                <button
                                  onClick={() => { setCloneTarget(c); setCloneSourceId(""); setCloneResult(null); setShowCloneModal(true); setOpenMenuId(null) }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-left hover:bg-zinc-800 transition text-amber-400"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  Clonar Cardápio
                                </button>
                                <button
                                  onClick={() => {
                                    const url = `${window.location.origin}/configuracoes?tab=impressao-local`;
                                    navigator.clipboard.writeText(url);
                                    alert(`Link copiado!\n\n${url}\n\nEnvie para o cliente pelo WhatsApp para instalar o Agente de Impressão.`);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-left hover:bg-zinc-800 transition text-sky-400"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  Copiar Link Agente
                                </button>
                                <div className="border-t border-zinc-800 my-1" />
                                <button
                                  onClick={() => archiveCompany(c.id, c.name)}
                                  disabled={archiving === c.id}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-left hover:bg-zinc-800 transition disabled:opacity-50 text-zinc-400"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                  {archiving === c.id ? "Arquivando..." : "Arquivar"}
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        /* Archived row actions */
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-600">
                            Arquivado {new Date(c.archivedAt!).toLocaleDateString("pt-BR")}
                          </span>
                          <button
                            onClick={() => restoreCompany(c.id)}
                            disabled={archiving === c.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/30 transition disabled:opacity-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Restaurar
                          </button>
                          <button
                            onClick={() => deleteCompany(c.id, c.name)}
                            disabled={deleting === c.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" />
                            {deleting === c.id ? "..." : "Excluir"}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-zinc-600 text-sm">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-bold mb-1">Clonar Cardápio</h3>
            <p className="text-zinc-500 text-sm mb-6">
              Copiar categorias e produtos para <strong className="text-white">{cloneTarget.name}</strong>
            </p>

            {cloneResult ? (
              <>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 text-center mb-6">
                  <p className="text-emerald-400 text-base font-bold">✅ Cardápio clonado!</p>
                  <p className="text-emerald-500 text-sm mt-1.5">
                    {cloneResult.categories} categorias e {cloneResult.products} produtos copiados.
                  </p>
                </div>
                <button
                  onClick={() => setShowCloneModal(false)}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 transition rounded-xl py-3 text-sm font-medium"
                >
                  Fechar
                </button>
              </>
            ) : (
              <form onSubmit={cloneMenu} className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Copiar cardápio de qual restaurante?</label>
                  <select
                    value={cloneSourceId}
                    onChange={(e) => setCloneSourceId(e.target.value)}
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500"
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
                  <p className="text-zinc-600 text-xs mt-1.5">
                    ⚠️ Adiciona produtos/categorias sem apagar os existentes.
                  </p>
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCloneModal(false)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 transition rounded-xl py-3 text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={cloning || !cloneSourceId}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 transition rounded-xl py-3 text-sm font-semibold"
                  >
                    {cloning ? "Clonando..." : "Clonar"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal — Criar Restaurante */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-bold mb-6">Novo Restaurante</h3>
            <form onSubmit={createCompany} className="space-y-4">
              {[
                { label: "Nome do restaurante *", key: "name", type: "text", placeholder: "Ex: Pizzaria Bella Napoli" },
                { label: "Email do admin *", key: "email", type: "email", placeholder: "admin@restaurante.com" },
                { label: "Senha inicial *", key: "adminPassword", type: "password", placeholder: "Mínimo 6 caracteres" },
                { label: "Telefone", key: "phone", type: "text", placeholder: "(41) 99999-9999" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-xs text-zinc-400 mb-1.5">{f.label}</label>
                  <input
                    type={f.type}
                    value={(form as any)[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Plano</label>
                <select
                  value={form.plan}
                  onChange={(e) => setForm({ ...form, plan: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="BASIC">Básico</option>
                  <option value="PROFESSIONAL">Profissional</option>
                  <option value="ENTERPRISE">Enterprise</option>
                  <option value="DELIVERY">Delivery</option>
                </select>
              </div>
              {formError && <p className="text-red-400 text-xs">{formError}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setFormError("") }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 transition rounded-xl py-3 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition rounded-xl py-3 text-sm font-semibold"
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
