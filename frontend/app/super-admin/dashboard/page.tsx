"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  LogIn, MoreVertical, ShieldOff, Shield, Wrench, Copy, Archive,
  RotateCcw, Trash2, Plus, Zap, Users, Building2,
  BarChart3, Ban, Search, ChevronRight, LayoutDashboard,
  UserCheck, TrendingUp, DollarSign, Star, Printer, RefreshCw, ExternalLink, Layout, Package,
} from "lucide-react"
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
  businessSegment?: string
  _count: { users: number; orders: number }
}

const SEGMENT_LABELS: Record<string, string> = {
  RESTAURANTE:  "Restaurantes",
  LANCHONETE:   "Lanchonetes",
  PIZZARIA:     "Pizzarias",
  CHURRASCARIA: "Churrascos",
  MARMITARIA:   "Marmitarias",
  HOT_DOG:      "Hot Dogs",
  PASTELARIA:   "Pastelarias",
  PADARIA:      "Padarias",
  DOCERIA:      "Docerias",
  CONVENIENCIA: "Conveniências",
  MERCADO:      "Mercados",
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

const PLAN_BADGE: Record<string, string> = {
  BASIC:        "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700",
  PROFESSIONAL: "bg-blue-950 text-blue-300 ring-1 ring-blue-800",
  ENTERPRISE:   "bg-violet-950 text-violet-300 ring-1 ring-violet-800",
  DELIVERY:     "bg-emerald-950 text-emerald-300 ring-1 ring-emerald-800",
}

const PROTECTED_EMAILS = new Set([
  "platform@foodsaas.internal",
  "demo-basic@foodsaas.demo",
  "demo-pro@foodsaas.demo",
  "demo-enterprise@foodsaas.demo",
])

function isProtected(c: Company) {
  return PROTECTED_EMAILS.has(c.email?.toLowerCase())
}

const NAV_ITEMS = [
  { label: "Dashboard",    href: "/super-admin/dashboard",  icon: LayoutDashboard },
  { label: "Clientes",     href: "/super-admin/clientes",   icon: UserCheck },
  { label: "Leads",        href: "/super-admin/leads",      icon: TrendingUp },
  { label: "Módulos",      href: "/super-admin/modulos",    icon: Package },
  { label: "Construtor",   href: "/super-admin/construtor", icon: Layout },
  { label: "Editor Tema",  href: "/super-admin/tema",       icon: Star },
  { label: "Preços",       href: "/super-admin/pricing",    icon: DollarSign },
]

function NavLink({ item, active }: { item: typeof NAV_ITEMS[0]; active: boolean }) {
  const router = useRouter()
  const Icon = item.icon
  return (
    <button
      onClick={() => router.push(item.href)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
        active
          ? "bg-zinc-800 text-white font-medium"
          : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {item.label}
    </button>
  )
}

function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string
  value: number | string
  sub?: string
  icon: React.ElementType
  accent: string
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <span className="text-3xl font-black text-white tabular-nums">{value}</span>
        {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

export default function SuperAdminDashboard() {
  const router = useRouter()
  const pathname = usePathname()
  const [companies, setCompanies] = useState<Company[]>([])
  const [filtered, setFiltered] = useState<Company[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, blocked: 0, archived: 0 })
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState("")
  const [planFilter, setPlanFilter] = useState("ALL")
  const [segmentTab, setSegmentTab] = useState("ALL")
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
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null)
  const [confirmText, setConfirmText] = useState("")
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = localStorage.getItem("sa_token")
    if (!token) { router.push("/super-admin/login"); return }
    load()
  }, [showArchived])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    let list = companies
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
    }
    if (planFilter !== "ALL") list = list.filter(c => c.plan === planFilter)
    if (segmentTab !== "ALL") list = list.filter(c => (c.businessSegment ?? "RESTAURANTE") === segmentTab)
    setFiltered(list)
  }, [search, planFilter, segmentTab, companies])

  async function load() {
    setLoading(true)
    try {
      const [companiesRes, statsRes] = await Promise.all([
        saApi.get(`/super-admin/companies?showArchived=${showArchived}`),
        saApi.get("/super-admin/stats"),
      ])
      setCompanies(companiesRes.data)
      setFiltered(companiesRes.data)
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

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(deleteTarget.id)
    try {
      await saApi.delete(`/super-admin/companies/${deleteTarget.id}`)
      setDeleteTarget(null)
      setConfirmText("")
      await load()
    } finally {
      setDeleting(null)
    }
  }

  async function toggleBlock(id: string) {
    setBlocking(id); setOpenMenuId(null)
    try { await saApi.patch(`/super-admin/companies/${id}/block`); await load() }
    finally { setBlocking(null) }
  }

  async function archiveCompany(id: string, name: string) {
    if (!window.confirm(`Arquivar "${name}"? Os dados serão preservados.`)) return
    setArchiving(id); setOpenMenuId(null)
    try { await saApi.patch(`/super-admin/companies/${id}/archive`); await load() }
    catch { alert("Erro ao arquivar empresa.") }
    finally { setArchiving(null) }
  }

  async function restoreCompany(id: string) {
    setArchiving(id)
    try { await saApi.patch(`/super-admin/companies/${id}/restore`); await load() }
    catch { alert("Erro ao restaurar empresa.") }
    finally { setArchiving(null) }
  }

  async function createCompany(e: React.FormEvent) {
    e.preventDefault(); setFormError("")
    if (!form.name || !form.email || !form.adminPassword) { setFormError("Preencha todos os campos obrigatórios"); return }
    setCreating(true)
    try {
      await saApi.post("/super-admin/companies", form)
      setShowModal(false); setForm({ name: "", email: "", adminPassword: "", plan: "BASIC", phone: "" })
      await load()
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Erro ao criar restaurante")
    } finally {
      setCreating(false)
    }
  }

  async function fixModules(id: string) {
    setFixingModules(id); setOpenMenuId(null)
    try { await saApi.post(`/super-admin/companies/${id}/fix-modules`); await load() }
    catch { alert("Erro ao corrigir módulos") }
    finally { setFixingModules(null) }
  }

  async function cloneMenu(e: React.FormEvent) {
    e.preventDefault()
    if (!cloneTarget || !cloneSourceId) return
    if (cloneSourceId === cloneTarget.id) { alert("Selecione uma empresa diferente como origem."); return }
    setCloning(true); setCloneResult(null)
    try {
      const { data } = await saApi.post(`/super-admin/companies/${cloneTarget.id}/clone-menu`, { sourceId: cloneSourceId })
      setCloneResult(data)
    } catch { alert("Erro ao clonar cardápio.") }
    finally { setCloning(false) }
  }

  async function runSeed() {
    if (!window.confirm("Criar/restaurar empresa demo com 15 categorias e 45 produtos?")) return
    setSeeding(true)
    try {
      const { data } = await saApi.post("/super-admin/seed")
      alert(`Seed concluído: ${data.categories} categorias, ${data.products} produtos`)
      await load()
    } catch { alert("Erro ao executar seed") }
    finally { setSeeding(false) }
  }

  async function initDemos() {
    if (!window.confirm("Criar/resetar as 3 empresas de demonstração?")) return
    setInitingDemos(true)
    try {
      const { data } = await saApi.post("/super-admin/demo/init")
      alert(`✅ ${data.message}`)
      await load()
    } catch (err: any) {
      alert(`Erro: ${err?.response?.data?.message || "Falha ao inicializar demos"}`)
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
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-500 ring-1 ring-zinc-700">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />Arquivado
      </span>
    )
    if (c.isBlocked) return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-950 text-red-400 ring-1 ring-red-900">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />Bloqueado
      </span>
    )
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 ring-1 ring-emerald-900">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Ativo
      </span>
    )
  }

  const planCounts = companies.reduce((acc, c) => {
    acc[c.plan] = (acc[c.plan] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Carregando painel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex text-white">

      {/* ── LEFT SIDEBAR ── */}
      <aside className="hidden lg:flex w-60 xl:w-64 shrink-0 flex-col border-r border-zinc-800/60 bg-zinc-950">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">FoodSaaS</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Super Admin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(item => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}

          <div className="pt-5 pb-1">
            <p className="text-[10px] uppercase tracking-widest text-zinc-700 px-3 mb-2">Ferramentas</p>
          </div>

          <button
            onClick={runSeed}
            disabled={seeding}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 transition-all disabled:opacity-40"
          >
            <RefreshCw className="w-4 h-4 shrink-0" />
            {seeding ? "Gerando..." : "Seed Demo"}
          </button>
          <button
            onClick={initDemos}
            disabled={initingDemos}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 transition-all disabled:opacity-40"
          >
            <Star className="w-4 h-4 shrink-0" />
            {initingDemos ? "Criando..." : "Init Demos"}
          </button>
        </nav>

        {/* Footer logout */}
        <div className="px-3 py-4 border-t border-zinc-800/60">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition-all"
          >
            <LogIn className="w-4 h-4 rotate-180 shrink-0" />
            Sair
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="h-14 border-b border-zinc-800/60 px-6 flex items-center justify-between gap-4 shrink-0 bg-zinc-950/80 backdrop-blur sticky top-0 z-20">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="text-zinc-300 font-medium">Dashboard</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>{segmentTab === "ALL" ? "Estabelecimentos" : (SEGMENT_LABELS[segmentTab] ?? segmentTab)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowArchived(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                showArchived
                  ? "border-zinc-600 bg-zinc-800 text-zinc-200"
                  : "border-zinc-800 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400"
              }`}
            >
              {showArchived ? "Ocultar arquivadas" : "Ver arquivadas"}
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo restaurante
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 xl:p-8 overflow-auto">

          {/* ── STATS CARDS ── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total"
              value={stats.total}
              sub="estabelecimentos"
              icon={Building2}
              accent="bg-zinc-800 text-zinc-400"
            />
            <StatCard
              label="Ativos"
              value={stats.active}
              sub={`${stats.total ? Math.round((stats.active / stats.total) * 100) : 0}% do total`}
              icon={UserCheck}
              accent="bg-emerald-950 text-emerald-400"
            />
            <StatCard
              label="Bloqueados"
              value={stats.blocked}
              sub="acesso suspenso"
              icon={Ban}
              accent="bg-red-950 text-red-400"
            />
            <StatCard
              label="Arquivados"
              value={stats.archived}
              sub="dados preservados"
              icon={Archive}
              accent="bg-zinc-800 text-zinc-500"
            />
          </div>

          {/* ── PLAN DISTRIBUTION ── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
            {(["BASIC", "PROFESSIONAL", "ENTERPRISE", "DELIVERY"] as const).map(plan => {
              const count = planCounts[plan] || 0
              const pct = stats.total ? Math.round((count / stats.total) * 100) : 0
              const barColor =
                plan === "ENTERPRISE" ? "bg-violet-500" :
                plan === "PROFESSIONAL" ? "bg-blue-500" :
                plan === "DELIVERY" ? "bg-emerald-500" : "bg-zinc-500"
              return (
                <div key={plan} className="bg-zinc-900 border border-zinc-800/60 rounded-xl px-4 py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">{PLAN_LABELS[plan]}</p>
                    <p className="text-2xl font-black text-white mt-0.5 tabular-nums">{count}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-zinc-400 tabular-nums">{pct}%</p>
                    <div className="w-14 h-1.5 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── DEMO CENTRAL ── */}
          <div className="mb-6">
            <DemoCentralCard variant="dark" />
          </div>

          {/* ── TABLE ── */}
          <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden">

            {/* Segment tabs */}
            {(() => {
              const segments = Array.from(new Set(companies.map(c => c.businessSegment ?? "RESTAURANTE"))).sort()
              if (segments.length <= 1) return null
              return (
                <div className="px-5 pt-4 flex items-center gap-1 flex-wrap border-b border-zinc-800/60 pb-0">
                  <button
                    onClick={() => setSegmentTab("ALL")}
                    className={`px-3 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                      segmentTab === "ALL"
                        ? "border-indigo-500 text-white bg-zinc-800/60"
                        : "border-transparent text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Todos <span className="ml-1 text-[10px] text-zinc-600">{companies.length}</span>
                  </button>
                  {segments.map(seg => {
                    const count = companies.filter(c => (c.businessSegment ?? "RESTAURANTE") === seg).length
                    return (
                      <button
                        key={seg}
                        onClick={() => setSegmentTab(seg)}
                        className={`px-3 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                          segmentTab === seg
                            ? "border-indigo-500 text-white bg-zinc-800/60"
                            : "border-transparent text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {SEGMENT_LABELS[seg] ?? seg} <span className="ml-1 text-[10px] text-zinc-600">{count}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })()}

            {/* Table header / filters */}
            <div className="px-5 py-4 border-b border-zinc-800/60 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-white shrink-0">
                  {segmentTab === "ALL" ? "Estabelecimentos" : (SEGMENT_LABELS[segmentTab] ?? segmentTab)}
                </h2>
                <span className="text-[10px] text-zinc-600 bg-zinc-800 rounded-full px-2 py-0.5 tabular-nums">{filtered.length}</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nome ou e-mail..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <select
                  value={planFilter}
                  onChange={e => setPlanFilter(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="ALL">Todos os planos</option>
                  <option value="BASIC">Básico</option>
                  <option value="PROFESSIONAL">Profissional</option>
                  <option value="ENTERPRISE">Enterprise</option>
                  <option value="DELIVERY">Delivery</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/60">
                    {["Restaurante", "E-mail", "Plano", "Usuários", "Pedidos", "Cadastro", "Status", ""].map(h => (
                      <th key={h} className="px-5 py-3 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      className={`group transition-colors ${c.archivedAt ? "opacity-40 hover:opacity-60" : "hover:bg-zinc-800/30"}`}
                    >
                      {/* Name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-[11px] font-bold text-zinc-400 shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-white text-sm leading-tight">{c.name}</span>
                        </div>
                      </td>
                      {/* Email */}
                      <td className="px-5 py-3.5 text-zinc-500 text-xs">{c.email}</td>
                      {/* Plan */}
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${PLAN_BADGE[c.plan] || "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700"}`}>
                          {PLAN_LABELS[c.plan] || c.plan}
                        </span>
                      </td>
                      {/* Users */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <Users className="w-3 h-3" />
                          <span className="text-xs tabular-nums">{c._count.users}</span>
                        </div>
                      </td>
                      {/* Orders */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <BarChart3 className="w-3 h-3" />
                          <span className="text-xs tabular-nums">{c._count.orders}</span>
                        </div>
                      </td>
                      {/* Date */}
                      <td className="px-5 py-3.5 text-zinc-600 text-xs">
                        {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      {/* Status */}
                      <td className="px-5 py-3.5">{statusBadge(c)}</td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {!c.archivedAt ? (
                            <>
                              <button
                                onClick={() => enterStore(c.id)}
                                disabled={entering === c.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 whitespace-nowrap"
                              >
                                {entering === c.id
                                  ? <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                                  : <ExternalLink className="w-3 h-3" />
                                }
                                Entrar
                              </button>

                              <div className="relative" ref={openMenuId === c.id ? menuRef : undefined}>
                                <button
                                  onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                                  className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-200 hover:bg-zinc-700/60 transition"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>

                                {openMenuId === c.id && (
                                  <div className="absolute right-0 top-9 z-50 w-52 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl shadow-black/60 py-1.5 overflow-hidden">
                                    <button
                                      onClick={() => toggleBlock(c.id)}
                                      disabled={blocking === c.id}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-left hover:bg-zinc-800 transition disabled:opacity-50"
                                    >
                                      {c.isBlocked
                                        ? <><Shield className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Desbloquear acesso</span></>
                                        : <><ShieldOff className="w-3.5 h-3.5 text-orange-400" /><span className="text-orange-400">Bloquear acesso</span></>
                                      }
                                    </button>
                                    <button
                                      onClick={() => fixModules(c.id)}
                                      disabled={fixingModules === c.id}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-left hover:bg-zinc-800 transition disabled:opacity-50 text-teal-400"
                                    >
                                      <Wrench className="w-3.5 h-3.5" />
                                      {fixingModules === c.id ? "Corrigindo..." : "Fix módulos"}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setCloneTarget(c)
                                        setCloneSourceId("")
                                        setCloneResult(null)
                                        setShowCloneModal(true)
                                        setOpenMenuId(null)
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-left hover:bg-zinc-800 transition text-amber-400"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                      Clonar cardápio
                                    </button>
                                    <button
                                      onClick={() => {
                                        const url = `${window.location.origin}/configuracoes?tab=impressao-local`
                                        navigator.clipboard.writeText(url)
                                        alert(`Link copiado!\n\n${url}`)
                                        setOpenMenuId(null)
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-left hover:bg-zinc-800 transition text-sky-400"
                                    >
                                      <Printer className="w-3.5 h-3.5" />
                                      Link agente impressão
                                    </button>
                                    {!isProtected(c) && (
                                      <>
                                        <div className="border-t border-zinc-800 my-1" />
                                        <button
                                          onClick={() => archiveCompany(c.id, c.name)}
                                          disabled={archiving === c.id}
                                          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-left hover:bg-zinc-800 transition disabled:opacity-50 text-zinc-500"
                                        >
                                          <Archive className="w-3.5 h-3.5" />
                                          {archiving === c.id ? "Arquivando..." : "Arquivar empresa"}
                                        </button>
                                        <button
                                          onClick={() => { setOpenMenuId(null); setConfirmText(""); setDeleteTarget(c) }}
                                          disabled={deleting === c.id}
                                          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-left hover:bg-red-950/60 transition disabled:opacity-50 text-red-400"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          {deleting === c.id ? "Excluindo..." : "Excluir empresa"}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-zinc-700">
                                {new Date(c.archivedAt!).toLocaleDateString("pt-BR")}
                              </span>
                              <button
                                onClick={() => restoreCompany(c.id)}
                                disabled={archiving === c.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-950 hover:bg-emerald-900 text-emerald-400 ring-1 ring-emerald-900 transition disabled:opacity-50"
                              >
                                <RotateCcw className="w-3 h-3" />Restaurar
                              </button>
                              <button
                                onClick={() => { setConfirmText(""); setDeleteTarget(c) }}
                                disabled={deleting === c.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-950 hover:bg-red-900 text-red-400 ring-1 ring-red-900 transition disabled:opacity-50"
                              >
                                <Trash2 className="w-3 h-3" />{deleting === c.id ? "..." : "Excluir"}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center text-zinc-700 text-sm">
                        {search || planFilter !== "ALL"
                          ? "Nenhum resultado para os filtros aplicados"
                          : showArchived
                          ? "Nenhuma empresa arquivada"
                          : "Nenhum restaurante cadastrado"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* ── MODAL — Confirmar Exclusão ── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-red-900/50 rounded-2xl p-7 w-full max-w-md shadow-2xl shadow-black/60">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-950 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Excluir empresa</h3>
                <p className="text-xs text-zinc-500">Esta ação é permanente e irreversível</p>
              </div>
            </div>

            <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-4 mb-5 text-sm text-red-300 space-y-1">
              <p className="font-semibold">{deleteTarget.name}</p>
              <p className="text-red-400/70 text-xs">{deleteTarget.email}</p>
              <p className="text-xs text-red-400/60 mt-2">
                Todos os dados serão apagados: usuários, pedidos, produtos, financeiro e histórico.
              </p>
            </div>

            <div className="mb-5">
              <label className="block text-xs text-zinc-400 mb-1.5">
                Digite <span className="text-white font-bold">EXCLUIR</span> para confirmar
              </label>
              <input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="EXCLUIR"
                autoFocus
                className="w-full bg-zinc-800 border border-zinc-700 focus:border-red-600 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 outline-none transition"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setConfirmText("") }}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 transition rounded-xl py-3 text-sm font-medium text-white"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={confirmText !== "EXCLUIR" || deleting === deleteTarget.id}
                className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition rounded-xl py-3 text-sm font-bold text-white"
              >
                {deleting === deleteTarget.id ? "Excluindo..." : "Excluir definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL — Clonar Cardápio ── */}
      {showCloneModal && cloneTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7 w-full max-w-md shadow-2xl shadow-black/60">
            <h3 className="text-base font-bold mb-1 text-white">Clonar Cardápio</h3>
            <p className="text-zinc-500 text-sm mb-6">
              Copiar categorias e produtos para <strong className="text-white">{cloneTarget.name}</strong>
            </p>

            {cloneResult ? (
              <>
                <div className="bg-emerald-950 border border-emerald-900 rounded-xl p-5 text-center mb-6">
                  <p className="text-emerald-400 text-base font-bold">Cardápio clonado</p>
                  <p className="text-emerald-600 text-sm mt-1.5">
                    {cloneResult.categories} categorias e {cloneResult.products} produtos copiados.
                  </p>
                </div>
                <button onClick={() => setShowCloneModal(false)} className="w-full bg-zinc-800 hover:bg-zinc-700 transition rounded-xl py-3 text-sm font-medium text-white">
                  Fechar
                </button>
              </>
            ) : (
              <form onSubmit={cloneMenu} className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Empresa de origem</label>
                  <select
                    value={cloneSourceId}
                    onChange={(e) => setCloneSourceId(e.target.value)}
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Selecione a empresa...</option>
                    {companies.filter((c) => c.id !== cloneTarget.id && !c.archivedAt).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <p className="text-zinc-600 text-xs mt-1.5">Adiciona produtos sem apagar os existentes.</p>
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowCloneModal(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 transition rounded-xl py-3 text-sm font-medium text-white">
                    Cancelar
                  </button>
                  <button type="submit" disabled={cloning || !cloneSourceId} className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 transition rounded-xl py-3 text-sm font-semibold text-white">
                    {cloning ? "Clonando..." : "Clonar"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL — Criar Restaurante ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7 w-full max-w-md shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold text-white">Novo Restaurante</h3>
              <button onClick={() => { setShowModal(false); setFormError("") }} className="text-zinc-600 hover:text-zinc-300 transition text-lg leading-none">✕</button>
            </div>
            <form onSubmit={createCompany} className="space-y-4">
              {[
                { label: "Nome do restaurante *", key: "name",          type: "text",     ph: "Ex: Pizzaria Bella Napoli", ac: "off" },
                { label: "E-mail do admin *",      key: "email",         type: "email",    ph: "admin@restaurante.com",     ac: "off" },
                { label: "Senha inicial *",         key: "adminPassword", type: "password", ph: "Mínimo 6 caracteres",       ac: "new-password" },
                { label: "Telefone",                key: "phone",         type: "text",     ph: "(41) 99999-9999",           ac: "off" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-xs text-zinc-400 mb-1.5">{f.label}</label>
                  <input
                    type={f.type}
                    value={(form as any)[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.ph}
                    autoComplete={f.ac}
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
              {formError && (
                <p className="text-red-400 text-xs bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">{formError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowModal(false); setFormError("") }} className="flex-1 bg-zinc-800 hover:bg-zinc-700 transition rounded-xl py-3 text-sm font-medium text-white">
                  Cancelar
                </button>
                <button type="submit" disabled={creating} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition rounded-xl py-3 text-sm font-semibold text-white">
                  {creating ? "Criando..." : "Criar restaurante"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
