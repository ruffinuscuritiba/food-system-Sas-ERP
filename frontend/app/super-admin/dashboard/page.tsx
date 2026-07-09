"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  LogIn, MoreVertical, ShieldOff, Shield, Wrench, Copy, Archive,
  RotateCcw, Trash2, Plus, Zap, Users, Building2,
  BarChart3, Ban, Search, ChevronRight, LayoutDashboard,
  UserCheck, TrendingUp, DollarSign, Star, Printer, RefreshCw,
  ExternalLink, Layout, Package, Bell, Moon, Sun, Activity,
  PieChart, Layers, Bot, Store,
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

// Grupos temáticos de segmento para as abas do painel
const SEGMENT_GROUPS = [
  {
    key:      "RESTAURANTES",
    label:    "Restaurantes",
    emoji:    "🍽️",
    segments: ["RESTAURANTE", "CHURRASCARIA", "MARMITARIA"],
  },
  {
    key:      "PIZZARIAS",
    label:    "Pizzarias",
    emoji:    "🍕",
    segments: ["PIZZARIA"],
  },
  {
    key:      "FASTFOOD",
    label:    "Lanchonetes & Fast-Food",
    emoji:    "🥪",
    segments: ["LANCHONETE", "HOT_DOG", "PASTELARIA"],
  },
  {
    key:      "PADARIAS",
    label:    "Padarias & Doces",
    emoji:    "🥖",
    segments: ["PADARIA", "DOCERIA"],
  },
  {
    key:      "VAREJO",
    label:    "Comércio Varejista",
    emoji:    "🏪",
    segments: ["MERCADO", "CONVENIENCIA"],
  },
]

const SEGMENT_EMOJI: Record<string, string> = {
  RESTAURANTE: "🍽️", LANCHONETE: "🥪", PIZZARIA: "🍕",
  CHURRASCARIA: "🥩", MARMITARIA: "🥡", HOT_DOG: "🌭",
  PASTELARIA: "🥟", PADARIA: "🥖", DOCERIA: "🍰",
  CONVENIENCIA: "🏪", MERCADO: "🛒",
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
  BASIC:        "#71717a",
  PROFESSIONAL: "#3b82f6",
  ENTERPRISE:   "#8b5cf6",
  DELIVERY:     "#10b981",
}

const PROTECTED_EMAILS = new Set([
  "platform@foodsaas.internal",
  "demo-basic@foodsaas.demo",
  "demo-pro@foodsaas.demo",
  "demo-enterprise@foodsaas.demo",
  "demo-delivery@foodsaas.demo",
])

const DEMO_EMAILS = new Set([
  "demo-basic@foodsaas.demo",
  "demo-pro@foodsaas.demo",
  "demo-enterprise@foodsaas.demo",
  "demo-delivery@foodsaas.demo",
])

function isProtected(c: Company) {
  return PROTECTED_EMAILS.has(c.email?.toLowerCase())
}

const NAV_ITEMS = [
  { label: "Dashboard",    href: "/super-admin/dashboard",  icon: LayoutDashboard, section: "Principal" },
  { label: "Restaurantes", href: "/super-admin/dashboard",  icon: Building2,        section: "Principal" },
  { label: "Clientes",     href: "/super-admin/clientes",   icon: UserCheck,        section: "Principal" },
  { label: "Leads",        href: "/super-admin/leads",      icon: TrendingUp,       section: "Principal" },
  { label: "Módulos",      href: "/super-admin/modulos",    icon: Package,          section: "Produto"   },
  { label: "Construtor",   href: "/super-admin/construtor", icon: Layout,           section: "Produto"   },
  { label: "Preços",       href: "/super-admin/pricing",    icon: DollarSign,       section: "Produto"   },
  { label: "Visitas",      href: "/super-admin/visitas",    icon: PieChart,         section: "Analytics" },
]

// ── Ring chart SVG (animated) ──────────────────────────────────────────────────
function RingChart({ pct, color, trackColor }: { pct: number; color: string; trackColor: string }) {
  const r = 18; const circ = 2 * Math.PI * r
  const dash = circ * Math.min(pct, 100) / 100
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0 drop-shadow-sm">
      <circle cx="26" cy="26" r={r} fill="none" stroke={trackColor} strokeWidth="5" />
      <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round" transform="rotate(-90 26 26)"
        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 4px ${color}88)` }} />
      <text x="26" y="30" textAnchor="middle" fontSize="9" fontWeight="700" fill={color}>
        {Math.round(pct)}%
      </text>
    </svg>
  )
}

// ── Deterministic avatar color from name ───────────────────────────────────────
function avatarGradient(name: string): [string, string] {
  const palettes: [string, string][] = [
    ["#6366f1","#1e1b4b"], ["#8b5cf6","#2e1065"], ["#ec4899","#500724"],
    ["#f97316","#431407"], ["#10b981","#052e16"], ["#3b82f6","#1e3a5f"],
    ["#f59e0b","#451a03"], ["#14b8a6","#042f2e"],
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return palettes[h % palettes.length]
}

export default function SuperAdminDashboard() {
  const router   = useRouter()
  const pathname = usePathname()

  // ── Theme ─────────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(true)
  useEffect(() => {
    const saved = localStorage.getItem("sa_theme")
    if (saved === "light") setIsDark(false)
  }, [])
  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    localStorage.setItem("sa_theme", next ? "dark" : "light")
  }

  // helper: c(darkClass, lightClass)
  const c = (dark: string, light: string) => isDark ? dark : light

  // ── Data ──────────────────────────────────────────────────────────────────
  const [companies, setCompanies] = useState<Company[]>([])
  const [filtered,  setFiltered]  = useState<Company[]>([])
  const [recentLeads, setRecentLeads] = useState<{ id: string; name: string | null; company: string | null; recommendedPlan: string | null; createdAt: string }[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, blocked: 0, archived: 0 })
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [showDemos,    setShowDemos]    = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState("")
  const [planFilter, setPlanFilter] = useState("ALL")
  const [segmentTab, setSegmentTab] = useState("ALL")
  const [blocking,  setBlocking]  = useState<string | null>(null)
  const [archiving, setArchiving] = useState<string | null>(null)
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const [entering,  setEntering]  = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", email: "", adminPassword: "", plan: "BASIC", phone: "" })
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState("")
  const [seeding, setSeeding] = useState(false)
  const [initingDemos, setInitingDemos] = useState(false)
  const [enteringAI, setEnteringAI] = useState(false)
  const [fixingModules, setFixingModules] = useState<string | null>(null)
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [cloneTarget, setCloneTarget] = useState<Company | null>(null)
  const [cloneSourceId, setCloneSourceId] = useState("")
  const [cloning, setCloning] = useState(false)
  const [cloneResult, setCloneResult] = useState<{ categories: number; products: number } | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null)
  const [confirmText, setConfirmText] = useState("")
  const [showNotif, setShowNotif] = useState(false)
  const [notifSeenAt, setNotifSeenAt] = useState<number>(() => {
    try { return parseInt(localStorage.getItem("sa_notif_seen") ?? "0", 10) } catch { return 0 }
  })
  const menuRef  = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = localStorage.getItem("sa_token")
    if (!token) { router.push("/super-admin/login"); return }
    load()
  }, [showArchived])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    let list = companies
    if (!showDemos) list = list.filter(co => !DEMO_EMAILS.has(co.email?.toLowerCase() ?? ""))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
    }
    if (planFilter !== "ALL") list = list.filter(c => c.plan === planFilter)
    if (segmentTab !== "ALL") {
      const group = SEGMENT_GROUPS.find(g => g.key === segmentTab)
      if (group) list = list.filter(c => group.segments.includes(c.businessSegment ?? "RESTAURANTE"))
    }
    setFiltered(list)
  }, [search, planFilter, segmentTab, companies, showDemos])

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
    // Leads não bloqueiam o load principal — falha aqui não deve deslogar o super-admin
    try {
      const leadsRes = await saApi.get("/super-admin/leads")
      setRecentLeads(leadsRes.data)
    } catch {
      setRecentLeads([])
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
      alert("Erro ao acessar a loja.")
    } finally {
      setEntering(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(deleteTarget.id)
    try {
      await saApi.delete(`/super-admin/companies/${deleteTarget.id}`)
      setDeleteTarget(null); setConfirmText("")
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
    if (!window.confirm("Criar/restaurar empresa demo com categorias e produtos?")) return
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

  async function impersonatePlatformAndGo(path: string, onError: () => void) {
    try {
      const { data } = await saApi.post("/super-admin/platform/impersonate")
      localStorage.setItem("token", data.accessToken)
      localStorage.setItem("user", JSON.stringify(data.user))
      localStorage.setItem("impersonating", JSON.stringify({ companyName: "R FoodSaaS Plataforma", companyId: data.user.companyId }))
      document.cookie = `token=${data.accessToken}; path=/`
      window.location.href = path
    } catch {
      alert("Erro ao acessar a conta da plataforma")
      onError()
    }
  }

  async function configureAI() {
    setEnteringAI(true)
    await impersonatePlatformAndGo("/whatsapp-ia", () => setEnteringAI(false))
  }

  function openMyStore() {
    router.push("/super-admin/loja")
  }

  // ── Derivados ─────────────────────────────────────────────────────────────
  const planCounts = companies.reduce((acc, co) => {
    acc[co.plan] = (acc[co.plan] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const segmentCounts = companies.reduce((acc, co) => {
    const s = co.businessSegment ?? "RESTAURANTE"
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const topSegments = Object.entries(segmentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  const recentCompanies = [...companies]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4)

  // ── Notifications derived from companies + leads data ────────────────────────
  const notifications = (() => {
    const list: { type: string; title: string; sub: string; color: string; bg: string; companyId: string | null; ts: number }[] = []
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const realNew = companies.filter(co =>
      !DEMO_EMAILS.has(co.email?.toLowerCase() ?? "") &&
      new Date(co.createdAt) >= sevenDaysAgo
    )
    realNew.forEach(co => list.push({
      type: "signup",
      title: `Nova loja: ${co.name}`,
      sub: `${PLAN_LABELS[co.plan] ?? co.plan} · ${new Date(co.createdAt).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}`,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10 border-indigo-500/20",
      companyId: co.id,
      ts: new Date(co.createdAt).getTime(),
    }))
    companies.filter(co => co.isBlocked).forEach(co => list.push({
      type: "blocked",
      title: `Loja bloqueada: ${co.name}`,
      sub: `Acesso suspenso · ${new Date(co.createdAt).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}`,
      color: "text-red-400",
      bg: "bg-red-500/10 border-red-500/20",
      companyId: co.id,
      ts: new Date(co.createdAt).getTime(),
    }))
    recentLeads.filter(l => new Date(l.createdAt) >= sevenDaysAgo).forEach(l => list.push({
      type: "lead",
      title: `Novo lead: ${l.name || "Anônimo"}${l.company ? ` — ${l.company}` : ""}`,
      sub: `${l.recommendedPlan ? (PLAN_LABELS[l.recommendedPlan] ?? l.recommendedPlan) + " · " : ""}${new Date(l.createdAt).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}`,
      color: "text-orange-400",
      bg: "bg-orange-500/10 border-orange-500/20",
      companyId: null,
      ts: new Date(l.createdAt).getTime(),
    }))
    return list.sort((a, b) => b.ts - a.ts)
  })()

  const unreadCount = notifications.filter(n => n.ts > notifSeenAt).length

  function openNotif() {
    setShowNotif(v => !v)
    if (!showNotif) {
      // marca como visto ao abrir
      const now = Date.now()
      setNotifSeenAt(now)
      try { localStorage.setItem("sa_notif_seen", String(now)) } catch {}
    }
  }

  const activePct  = stats.total ? Math.round((stats.active  / stats.total) * 100) : 0
  const blockedPct = stats.total ? Math.round((stats.blocked / stats.total) * 100) : 0

  function statusBadge(co: Company) {
    if (co.archivedAt) return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />Arquivado
      </span>
    )
    if (co.isBlocked) return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-950 text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />Bloqueado
      </span>
    )
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Ativo
      </span>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${c("bg-[var(--surface-0)]", "bg-gray-50")}`}>
        <div className="flex flex-col items-center gap-4">
          <div className={`w-9 h-9 border-2 rounded-full animate-spin ${c("border-zinc-800 border-t-indigo-500", "border-gray-200 border-t-indigo-500")}`} />
          <p className={`text-sm ${c("text-zinc-500", "text-gray-400")}`}>Carregando painel...</p>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen flex text-sm ${c("bg-[var(--surface-0)] text-white", "bg-gray-50 text-gray-900")}`}>

      {/* ══════════════════════════════════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════════════════════════════════ */}
      <aside className={`hidden lg:flex w-56 xl:w-60 shrink-0 flex-col border-r ${c("bg-[#0c0c0f] border-[#1c1c24]", "bg-white border-gray-200")}`}>

        {/* Logo */}
        <div className={`px-5 py-5 border-b ${c("border-[#1c1c24]", "border-gray-100")}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className={`text-sm font-black leading-none ${c("text-white", "text-gray-900")}`}>FoodSaaS</p>
              <p className={`text-[10px] mt-0.5 ${c("text-zinc-500", "text-gray-400")}`}>Super Admin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {(["Principal", "Produto", "Analytics"] as const).map(section => {
            const items = NAV_ITEMS.filter(i => i.section === section)
            return (
              <div key={section} className="mb-4">
                <p className={`text-[9px] font-bold uppercase tracking-widest px-2 mb-1.5 ${c("text-zinc-700", "text-gray-400")}`}>{section}</p>
                {items.map(item => {
                  const Icon = item.icon
                  const active = pathname === item.href && item.label !== "Restaurantes"
                  return (
                    <button
                      key={item.label}
                      onClick={() => {
                        if (item.label === "Restaurantes") {
                          tableRef.current?.scrollIntoView({ behavior: "smooth" })
                        } else {
                          router.push(item.href)
                        }
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all mb-0.5 ${
                        active
                          ? c("bg-indigo-950 text-indigo-300 font-semibold border-l-2 border-indigo-500 pl-[10px]",
                               "bg-indigo-50 text-indigo-600 font-semibold border-l-2 border-indigo-500 pl-[10px]")
                          : c("text-zinc-500 hover:text-zinc-200 hover:bg-[#18181b]",
                               "text-gray-500 hover:text-gray-800 hover:bg-gray-50")
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {item.label}
                    </button>
                  )
                })}
              </div>
            )
          })}

          {/* Tools */}
          <div className={`border-t pt-4 ${c("border-[#1c1c24]", "border-gray-100")}`}>
            <p className={`text-[9px] font-bold uppercase tracking-widest px-2 mb-1.5 ${c("text-zinc-700", "text-gray-400")}`}>Ferramentas</p>
            <button onClick={runSeed} disabled={seeding}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs mb-0.5 transition-all disabled:opacity-40 ${c("text-zinc-500 hover:text-zinc-200 hover:bg-[#18181b]", "text-gray-500 hover:text-gray-800 hover:bg-gray-50")}`}>
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              {seeding ? "Gerando..." : "Seed Demo"}
            </button>
            <button onClick={initDemos} disabled={initingDemos}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs mb-0.5 transition-all disabled:opacity-40 ${c("text-zinc-500 hover:text-zinc-200 hover:bg-[#18181b]", "text-gray-500 hover:text-gray-800 hover:bg-gray-50")}`}>
              <Star className="w-3.5 h-3.5 shrink-0" />
              {initingDemos ? "Criando..." : "Init Demos"}
            </button>
            <button onClick={configureAI} disabled={enteringAI}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs mb-0.5 transition-all disabled:opacity-40 ${c("text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30", "text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50")}`}>
              <Bot className="w-3.5 h-3.5 shrink-0" />
              {enteringAI ? "Abrindo..." : "Configurar IA"}
            </button>
            <button onClick={openMyStore}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs mb-0.5 transition-all ${c("text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/30", "text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50")}`}>
              <Store className="w-3.5 h-3.5 shrink-0" />
              Minha Loja
            </button>
          </div>
        </nav>

        {/* Footer */}
        <div className={`px-3 py-3 border-t ${c("border-[#1c1c24]", "border-gray-100")}`}>
          <button onClick={logout}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${c("text-zinc-600 hover:text-red-400 hover:bg-red-950/30", "text-gray-500 hover:text-red-500 hover:bg-red-50")}`}>
            <LogIn className="w-3.5 h-3.5 rotate-180 shrink-0" />
            Sair do painel
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* TOP BAR */}
        <header className={`h-14 border-b px-5 flex items-center gap-3 shrink-0 sticky top-0 z-20 ${c("bg-[#09090b]/95 border-[#1c1c24] backdrop-blur", "bg-white/95 border-gray-200 backdrop-blur")}`}>
          {/* Greeting */}
          <div className="flex-1 flex items-center gap-2">
            <span className={`text-sm font-black ${c("text-white", "text-gray-900")}`}>Dashboard</span>
            <ChevronRight className={`w-3.5 h-3.5 ${c("text-zinc-700", "text-gray-300")}`} />
            <span className={`text-xs ${c("text-zinc-500", "text-gray-400")}`}>
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </span>
          </div>

          {/* Search */}
          <div className={`hidden sm:flex items-center gap-2 rounded-xl px-3 py-2 w-52 border ${c("bg-[#18181b] border-[#27272a]", "bg-gray-50 border-gray-200")}`}>
            <Search className={`w-3.5 h-3.5 shrink-0 ${c("text-zinc-600", "text-gray-400")}`} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar restaurante..."
              className={`bg-transparent text-xs outline-none w-full ${c("text-zinc-300 placeholder-zinc-600", "text-gray-700 placeholder-gray-400")}`}
            />
          </div>

          {/* Theme toggle */}
          <button onClick={toggleTheme}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${c("bg-[#18181b] text-zinc-400 hover:text-white hover:bg-[#27272a]", "bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200")}`}
            title={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {/* Bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={openNotif}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                showNotif
                  ? c("bg-indigo-600 text-white", "bg-indigo-100 text-indigo-600")
                  : c("bg-[#18181b] text-zinc-400 hover:text-white hover:bg-[#27272a]", "bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200")
              }`}
              title="Notificações"
            >
              <Bell className="w-3.5 h-3.5" />
            </button>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 border-2 border-[#09090b] flex items-center justify-center text-[9px] font-bold text-white px-0.5">
                {unreadCount}
              </span>
            )}
            {showNotif && (
              <div className={`absolute right-0 top-10 w-80 rounded-2xl shadow-2xl z-50 border overflow-hidden ${c("bg-[#111113] border-[#27272a]", "bg-white border-gray-200")}`}>
                <div className={`flex items-center justify-between px-4 py-3 border-b ${c("border-[#27272a]", "border-gray-100")}`}>
                  <span className={`text-xs font-bold ${c("text-zinc-200", "text-gray-700")}`}>Notificações</span>
                  <span className={`text-[10px] ${c("text-zinc-500", "text-gray-400")}`}>{notifications.length} eventos</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <Bell className={`w-8 h-8 ${c("text-zinc-700", "text-gray-300")}`} />
                      <p className={`text-xs ${c("text-zinc-600", "text-gray-400")}`}>Nenhuma notificação</p>
                    </div>
                  ) : notifications.map((n, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setShowNotif(false)
                        if (n.type === "lead") {
                          router.push("/super-admin/leads")
                          return
                        }
                        setSearch(n.title.replace(/^(Nova loja|Loja bloqueada): /, ""))
                        setTimeout(() => {
                          const row = document.getElementById(`company-row-${n.companyId}`)
                          row?.scrollIntoView({ behavior: "smooth", block: "center" })
                          row?.classList.add("ring-2", "ring-indigo-500")
                          setTimeout(() => row?.classList.remove("ring-2", "ring-indigo-500"), 2000)
                        }, 150)
                      }}
                      className={`w-full flex items-start gap-3 px-4 py-3 border-b last:border-b-0 ${c("border-[#1a1a1f] hover:bg-[#18181b]", "border-gray-50 hover:bg-gray-50")} transition-colors text-left`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${n.bg}`}>
                        {n.type === "signup" ? <span className="text-sm">🏪</span> : n.type === "lead" ? <span className="text-sm">🔥</span> : <span className="text-sm">🚫</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-xs font-medium truncate ${c("text-zinc-200", "text-gray-700")}`}>{n.title}</p>
                          {n.ts > notifSeenAt && (
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" title="Não lida" />
                          )}
                        </div>
                        <p className={`text-[10px] mt-0.5 ${c("text-zinc-500", "text-gray-400")}`}>{n.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Demos toggle */}
          <button onClick={() => setShowDemos(v => !v)}
            className={`hidden sm:flex text-xs px-3 py-2 rounded-xl border transition-all ${
              showDemos
                ? c("border-violet-600 bg-violet-950 text-violet-200", "border-violet-400 bg-violet-100 text-violet-700")
                : c("border-[#27272a] text-zinc-600 hover:border-zinc-700 hover:text-zinc-300", "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600")
            }`}>
            {showDemos ? "Ocultar demos" : "Ver demos"}
          </button>

          {/* Archived toggle */}
          <button onClick={() => setShowArchived(v => !v)}
            className={`hidden sm:flex text-xs px-3 py-2 rounded-xl border transition-all ${
              showArchived
                ? c("border-zinc-600 bg-zinc-800 text-zinc-200", "border-gray-400 bg-gray-100 text-gray-700")
                : c("border-[#27272a] text-zinc-600 hover:border-zinc-700 hover:text-zinc-300", "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600")
            }`}>
            {showArchived ? "Ocultar arquivadas" : "Ver arquivadas"}
          </button>

          {/* New */}
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25 transition-all">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Novo restaurante</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </header>

        {/* CONTENT */}
        <main className="flex-1 p-5 xl:p-6 overflow-auto space-y-5">

          {/* ── STATS CARDS ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              {
                label: "Total de lojas",
                value: stats.total,
                sub: "estabelecimentos",
                trend: `+${recentCompanies.length > 0 ? recentCompanies.filter(co => {
                  const d = new Date(co.createdAt); const now = new Date();
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
                }).length : 0} esse mês`,
                trendUp: true,
                color: "#6366f1",
                trackDark: "#1e1b4b",
                trackLight: "#e0e7ff",
                pct: 100,
                topColor: "from-indigo-500 to-violet-500",
              },
              {
                label: "Lojas ativas",
                value: stats.active,
                sub: `${activePct}% do total`,
                trend: "em operação",
                trendUp: true,
                color: "#10b981",
                trackDark: "#052e16",
                trackLight: "#d1fae5",
                pct: activePct,
                topColor: "from-emerald-400 to-teal-500",
              },
              {
                label: "Bloqueadas",
                value: stats.blocked,
                sub: "acesso suspenso",
                trend: blockedPct > 0 ? `${blockedPct}% do total` : "nenhuma bloqueada",
                trendUp: false,
                color: "#f43f5e",
                trackDark: "#2d1515",
                trackLight: "#ffe4e6",
                pct: blockedPct,
                topColor: "from-rose-500 to-pink-600",
              },
              {
                label: "Arquivadas",
                value: stats.archived,
                sub: "dados preservados",
                trend: "desativadas",
                trendUp: null,
                color: "#71717a",
                trackDark: "#1c1c24",
                trackLight: "#f4f4f5",
                pct: stats.total ? Math.round((stats.archived / stats.total) * 100) : 0,
                topColor: "from-zinc-500 to-zinc-600",
              },
            ].map((s, i) => (
              <div key={i} className={`relative overflow-hidden rounded-2xl border p-5 ${c("bg-[#0f0f14] border-[#1c1c24]", "bg-white border-gray-200 shadow-sm")}`}>
                {/* Top color bar */}
                <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${s.topColor}`} />
                <p className={`text-[9px] font-bold uppercase tracking-widest mb-3 ${c("text-zinc-600", "text-gray-400")}`}>{s.label}</p>
                <div className="flex items-end justify-between">
                  <div>
                    <p
                      className={`text-4xl font-black tabular-nums leading-none ${c("text-white", "text-gray-900")}`}
                      style={{ textShadow: `0 0 24px ${s.color}55` }}
                    >{s.value}</p>
                    <p className={`text-[10px] mt-1 ${c("text-zinc-600", "text-gray-400")}`}>{s.sub}</p>
                    <p className={`text-[10px] mt-1.5 font-semibold flex items-center gap-1 ${
                      s.trendUp === true ? "text-emerald-400" :
                      s.trendUp === false && s.value > 0 ? "text-rose-400" :
                      c("text-zinc-600", "text-gray-400")
                    }`}>
                      {s.trendUp === true && <span className="text-[8px]">▲</span>}
                      {s.trendUp === false && s.value > 0 && <span className="text-[8px]">▲</span>}
                      {s.trend}
                    </p>
                  </div>
                  <RingChart pct={s.pct} color={s.color} trackColor={isDark ? s.trackDark : s.trackLight} />
                </div>
              </div>
            ))}
          </div>

          {/* ── MID ROW ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Distribuição por plano */}
            <div className={`rounded-2xl border p-5 ${c("bg-[#0f0f14] border-[#1c1c24]", "bg-white border-gray-200 shadow-sm")}`}>
              <div className="flex items-center justify-between mb-4">
                <p className={`text-xs font-bold ${c("text-zinc-300", "text-gray-700")}`}>Distribuição por Plano</p>
                <span className={`text-[10px] ${c("text-zinc-600", "text-gray-400")}`}>{stats.total} total</span>
              </div>
              {(["BASIC", "PROFESSIONAL", "ENTERPRISE", "DELIVERY"] as const).map(plan => {
                const count = planCounts[plan] || 0
                const pct   = stats.total ? Math.round((count / stats.total) * 100) : 0
                const color = PLAN_COLORS[plan]
                return (
                  <div key={plan} className="mb-3.5 last:mb-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}88` }} />
                        <span className={`text-xs font-medium ${c("text-zinc-400", "text-gray-600")}`}>{PLAN_LABELS[plan]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] ${c("text-zinc-600", "text-gray-400")}`}>{pct}%</span>
                        <span className={`text-xs font-black tabular-nums ${c("text-white", "text-gray-900")}`}>{count}</span>
                      </div>
                    </div>
                    <div className={`h-2 rounded-full overflow-hidden ${c("bg-[#27272a]", "bg-gray-100")}`}>
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Top segmentos */}
            <div className={`rounded-2xl border p-5 ${c("bg-[#0f0f14] border-[#1c1c24]", "bg-white border-gray-200 shadow-sm")}`}>
              <div className="flex items-center justify-between mb-4">
                <p className={`text-xs font-bold ${c("text-zinc-300", "text-gray-700")}`}>Top Segmentos</p>
                <span className={`text-[10px] ${c("text-zinc-600", "text-gray-400")}`}>por quantidade</span>
              </div>
              {topSegments.length === 0 ? (
                <p className={`text-xs ${c("text-zinc-600", "text-gray-400")}`}>Nenhum dado</p>
              ) : topSegments.map(([seg, count], i) => {
                const maxCount = topSegments[0][1]
                const pct = Math.round((count / maxCount) * 100)
                const colors = ["#f97316", "#f59e0b", "#10b981", "#3b82f6"]
                const col = colors[i]
                return (
                  <div key={seg} className="mb-3.5 last:mb-0">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                        style={{ background: `${col}22`, border: `1px solid ${col}44` }}>
                        {SEGMENT_EMOJI[seg] ?? "🏪"}
                      </div>
                      <span className={`text-xs font-medium flex-1 truncate ${c("text-zinc-300", "text-gray-700")}`}>{SEGMENT_LABELS[seg] ?? seg}</span>
                      <span className={`text-[10px] font-black tabular-nums`} style={{ color: col }}>{count}</span>
                    </div>
                    <div className={`ml-9 h-1.5 rounded-full overflow-hidden ${c("bg-[#27272a]", "bg-gray-100")}`}>
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${col}66, ${col})` }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Atividade recente */}
            <div className={`rounded-2xl border p-5 ${c("bg-[#0f0f14] border-[#1c1c24]", "bg-white border-gray-200 shadow-sm")}`}>
              <div className="flex items-center justify-between mb-4">
                <p className={`text-xs font-bold ${c("text-zinc-300", "text-gray-700")}`}>Cadastros Recentes</p>
                <Activity className={`w-3.5 h-3.5 ${c("text-zinc-600", "text-gray-400")}`} />
              </div>
              {recentCompanies.length === 0 ? (
                <p className={`text-xs ${c("text-zinc-600", "text-gray-400")}`}>Nenhum cadastro ainda</p>
              ) : recentCompanies.map((co) => {
                const [fgColor, bgColor] = avatarGradient(co.name)
                return (
                <div key={co.id} className={`flex items-center gap-3 py-2 border-b last:border-b-0 ${c("border-[#1c1c24]", "border-gray-50")}`}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                    style={{ backgroundColor: bgColor, color: fgColor, boxShadow: `0 0 8px ${fgColor}44` }}>
                    {co.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${c("text-zinc-200", "text-gray-800")}`}>{co.name}</p>
                    <p className={`text-[10px] ${c("text-zinc-600", "text-gray-400")}`}>
                      {new Date(co.createdAt).toLocaleDateString("pt-BR")} · {PLAN_LABELS[co.plan] ?? co.plan}
                    </p>
                  </div>
                  <button onClick={() => enterStore(co.id)} disabled={entering === co.id}
                    className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 transition shrink-0">
                    Entrar →
                  </button>
                </div>
              )
              })}
            </div>
          </div>

          {/* ── DEMO CENTRAL ─────────────────────────────────────────────── */}
          <div>
            <DemoCentralCard variant={isDark ? "dark" : "light"} />
          </div>

          {/* ── TABELA ─────────────────────────────────────────────────── */}
          <div ref={tableRef} className={`rounded-2xl border overflow-hidden ${c("bg-[#0f0f14] border-[#1c1c24]", "bg-white border-gray-200 shadow-sm")}`}>

            {/* Segment group tabs */}
            {(() => {
              // só mostra grupos que tenham ao menos 1 empresa
              const activeGroups = SEGMENT_GROUPS.filter(g =>
                companies.some(co => g.segments.includes(co.businessSegment ?? "RESTAURANTE"))
              )
              if (activeGroups.length === 0) return null
              return (
                <div className={`px-5 pt-4 flex items-center gap-0.5 flex-wrap border-b pb-0 overflow-x-auto ${c("border-[#1c1c24]", "border-gray-100")}`}>
                  {/* Aba "Todos" */}
                  <button onClick={() => setSegmentTab("ALL")}
                    className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                      segmentTab === "ALL"
                        ? c("border-indigo-500 text-white", "border-indigo-500 text-indigo-600")
                        : c("border-transparent text-zinc-500 hover:text-zinc-300", "border-transparent text-gray-400 hover:text-gray-700")
                    }`}>
                    Todos
                    <span className={`ml-1.5 tabular-nums text-[10px] px-1.5 py-0.5 rounded-full ${
                      segmentTab === "ALL"
                        ? c("bg-indigo-900 text-indigo-300", "bg-indigo-100 text-indigo-600")
                        : c("bg-[#27272a] text-zinc-600", "bg-gray-100 text-gray-400")
                    }`}>{companies.length}</span>
                  </button>

                  {activeGroups.map(group => {
                    const count = companies.filter(co =>
                      group.segments.includes(co.businessSegment ?? "RESTAURANTE")
                    ).length
                    const active = segmentTab === group.key
                    return (
                      <button key={group.key} onClick={() => setSegmentTab(group.key)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                          active
                            ? c("border-indigo-500 text-white", "border-indigo-500 text-indigo-600")
                            : c("border-transparent text-zinc-500 hover:text-zinc-300", "border-transparent text-gray-400 hover:text-gray-700")
                        }`}>
                        <span>{group.emoji}</span>
                        <span>{group.label}</span>
                        <span className={`tabular-nums text-[10px] px-1.5 py-0.5 rounded-full ${
                          active
                            ? c("bg-indigo-900 text-indigo-300", "bg-indigo-100 text-indigo-600")
                            : c("bg-[#27272a] text-zinc-600", "bg-gray-100 text-gray-400")
                        }`}>{count}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })()}

            {/* Filters row */}
            <div className={`px-5 py-3 border-b flex flex-col sm:flex-row items-start sm:items-center gap-3 ${c("border-[#1c1c24]", "border-gray-100")}`}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h2 className={`text-xs font-bold shrink-0 ${c("text-white", "text-gray-900")}`}>
                  {segmentTab === "ALL"
                    ? "Estabelecimentos"
                    : (SEGMENT_GROUPS.find(g => g.key === segmentTab)?.label ?? segmentTab)}
                </h2>
                <span className={`text-[10px] rounded-full px-2 py-0.5 tabular-nums ${c("bg-[#27272a] text-zinc-500", "bg-gray-100 text-gray-500")}`}>{filtered.length}</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${c("text-zinc-600", "text-gray-400")}`} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                    className={`w-full rounded-xl pl-8 pr-3 py-2 text-xs outline-none border transition ${c("bg-[#18181b] border-[#27272a] text-white placeholder-zinc-600 focus:border-indigo-500", "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-400")}`}
                  />
                </div>
                <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
                  className={`rounded-xl px-3 py-2 text-xs outline-none border transition ${c("bg-[#18181b] border-[#27272a] text-zinc-300 focus:border-indigo-500", "bg-gray-50 border-gray-200 text-gray-700 focus:border-indigo-400")}`}>
                  <option value="ALL">Todos os planos</option>
                  <option value="BASIC">Básico</option>
                  <option value="PROFESSIONAL">Profissional</option>
                  <option value="ENTERPRISE">Enterprise</option>
                  <option value="DELIVERY">Delivery</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${c("border-[#1c1c24]", "border-gray-100")}`}>
                    {["Restaurante", "Plano", "Usuários", "Pedidos", "Cadastro", "Status", ""].map(h => (
                      <th key={h} className={`px-5 py-3 text-[9px] font-bold uppercase tracking-widest text-left ${c("text-zinc-600", "text-gray-400")}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`divide-y ${c("divide-[#1c1c24]/60", "divide-gray-50")}`}>
                  {filtered.map((co) => {
                    const [fgColor, bgColor] = avatarGradient(co.name)
                    return (
                    <tr key={co.id} id={`company-row-${co.id}`} className={`transition-colors ${co.archivedAt ? "opacity-40" : c("hover:bg-[#18181b]", "hover:bg-gray-50")}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0"
                            style={{ backgroundColor: bgColor, color: fgColor, boxShadow: `0 0 6px ${fgColor}44` }}>
                            {co.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className={`text-xs font-semibold ${c("text-white", "text-gray-900")}`}>{co.name}</p>
                            <p className={`text-[10px] ${c("text-zinc-600", "text-gray-400")}`}>{co.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ backgroundColor: `${PLAN_COLORS[co.plan]}22`, color: PLAN_COLORS[co.plan] }}>
                          {PLAN_LABELS[co.plan] || co.plan}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className={`flex items-center gap-1.5 ${c("text-zinc-500", "text-gray-400")}`}>
                          <Users className="w-3 h-3" />
                          <span className="text-xs tabular-nums">{co._count.users}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className={`flex items-center gap-1.5 ${c("text-zinc-500", "text-gray-400")}`}>
                          <BarChart3 className="w-3 h-3" />
                          <span className="text-xs font-bold tabular-nums">{co._count.orders}</span>
                        </div>
                      </td>
                      <td className={`px-5 py-3.5 text-xs ${c("text-zinc-600", "text-gray-400")}`}>
                        {new Date(co.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-5 py-3.5">{statusBadge(co)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {!co.archivedAt ? (
                            <>
                              <button onClick={() => enterStore(co.id)} disabled={entering === co.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50">
                                {entering === co.id
                                  ? <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                                  : <ExternalLink className="w-3 h-3" />}
                                Entrar
                              </button>

                              <div className="relative" ref={openMenuId === co.id ? menuRef : undefined}>
                                <button onClick={() => setOpenMenuId(openMenuId === co.id ? null : co.id)}
                                  className={`p-1.5 rounded-lg transition ${c("text-zinc-600 hover:text-zinc-200 hover:bg-[#27272a]", "text-gray-400 hover:text-gray-700 hover:bg-gray-100")}`}>
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                {openMenuId === co.id && (
                                  <div className={`absolute right-0 top-9 z-50 w-52 rounded-xl shadow-2xl shadow-black/60 py-1.5 overflow-hidden border ${c("bg-[#18181b] border-[#27272a]", "bg-white border-gray-200")}`}>
                                    <button onClick={() => toggleBlock(co.id)} disabled={blocking === co.id}
                                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left transition disabled:opacity-50 ${c("hover:bg-[#27272a]", "hover:bg-gray-50")}`}>
                                      {co.isBlocked
                                        ? <><Shield className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Desbloquear</span></>
                                        : <><ShieldOff className="w-3.5 h-3.5 text-orange-400" /><span className="text-orange-400">Bloquear acesso</span></>}
                                    </button>
                                    <button onClick={() => fixModules(co.id)} disabled={fixingModules === co.id}
                                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left text-teal-400 transition disabled:opacity-50 ${c("hover:bg-[#27272a]", "hover:bg-gray-50")}`}>
                                      <Wrench className="w-3.5 h-3.5" />
                                      {fixingModules === co.id ? "Corrigindo..." : "Fix módulos"}
                                    </button>
                                    <button onClick={() => { setCloneTarget(co); setCloneSourceId(""); setCloneResult(null); setShowCloneModal(true); setOpenMenuId(null) }}
                                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left text-amber-400 transition ${c("hover:bg-[#27272a]", "hover:bg-gray-50")}`}>
                                      <Copy className="w-3.5 h-3.5" />
                                      Clonar cardápio
                                    </button>
                                    <button onClick={() => { const url = `${window.location.origin}/configuracoes?tab=impressao-local`; navigator.clipboard.writeText(url); alert(`Link copiado!\n\n${url}`); setOpenMenuId(null) }}
                                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left text-sky-400 transition ${c("hover:bg-[#27272a]", "hover:bg-gray-50")}`}>
                                      <Printer className="w-3.5 h-3.5" />
                                      Link agente impressão
                                    </button>
                                    {!isProtected(co) && (
                                      <>
                                        <div className={`border-t my-1 ${c("border-[#27272a]", "border-gray-100")}`} />
                                        <button onClick={() => archiveCompany(co.id, co.name)} disabled={archiving === co.id}
                                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left text-zinc-500 transition disabled:opacity-50 ${c("hover:bg-[#27272a]", "hover:bg-gray-50")}`}>
                                          <Archive className="w-3.5 h-3.5" />
                                          {archiving === co.id ? "Arquivando..." : "Arquivar empresa"}
                                        </button>
                                        <button onClick={() => { setOpenMenuId(null); setConfirmText(""); setDeleteTarget(co) }} disabled={deleting === co.id}
                                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left text-red-400 transition disabled:opacity-50 ${c("hover:bg-red-950/40", "hover:bg-red-50")}`}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                          {deleting === co.id ? "Excluindo..." : "Excluir empresa"}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button onClick={() => restoreCompany(co.id)} disabled={archiving === co.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-950 hover:bg-emerald-900 text-emerald-400 ring-1 ring-emerald-900 transition disabled:opacity-50">
                                <RotateCcw className="w-3 h-3" />Restaurar
                              </button>
                              <button onClick={() => { setConfirmText(""); setDeleteTarget(co) }} disabled={deleting === co.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-950 hover:bg-red-900 text-red-400 ring-1 ring-red-900 transition disabled:opacity-50">
                                <Trash2 className="w-3 h-3" />{deleting === co.id ? "..." : "Excluir"}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )})}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className={`px-6 py-16 text-center text-sm ${c("text-zinc-700", "text-gray-400")}`}>
                        {search || planFilter !== "ALL"
                          ? "Nenhum resultado para os filtros aplicados"
                          : showArchived ? "Nenhuma empresa arquivada"
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

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — Novo restaurante
      ══════════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl p-7 w-full max-w-md shadow-2xl border ${c("bg-[#0f0f14] border-[#27272a]", "bg-white border-gray-200")}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-sm font-black ${c("text-white", "text-gray-900")}`}>Novo Restaurante</h3>
              <button onClick={() => setShowModal(false)} className={`w-7 h-7 rounded-lg flex items-center justify-center text-lg transition ${c("text-zinc-500 hover:text-white hover:bg-[#27272a]", "text-gray-400 hover:text-gray-700 hover:bg-gray-100")}`}>×</button>
            </div>
            <form onSubmit={createCompany} className="space-y-3">
              {[
                { label: "Nome do restaurante *", key: "name", type: "text", placeholder: "Pizzaria Bella Napoli" },
                { label: "E-mail admin *", key: "email", type: "email", placeholder: "admin@restaurante.com.br" },
                { label: "Senha *", key: "adminPassword", type: "password", placeholder: "Mínimo 6 caracteres" },
                { label: "Telefone", key: "phone", type: "tel", placeholder: "(11) 99999-9999" },
              ].map(f => (
                <div key={f.key}>
                  <label className={`block text-[10px] font-semibold mb-1 ${c("text-zinc-400", "text-gray-500")}`}>{f.label}</label>
                  <input type={f.type} value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className={`w-full rounded-xl px-4 py-2.5 text-xs outline-none border transition ${c("bg-[#18181b] border-[#27272a] text-white placeholder-zinc-600 focus:border-indigo-500", "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-400")}`}
                  />
                </div>
              ))}
              <div>
                <label className={`block text-[10px] font-semibold mb-1 ${c("text-zinc-400", "text-gray-500")}`}>Plano</label>
                <select value={form.plan} onChange={e => setForm(p => ({ ...p, plan: e.target.value }))}
                  className={`w-full rounded-xl px-4 py-2.5 text-xs outline-none border transition ${c("bg-[#18181b] border-[#27272a] text-zinc-300 focus:border-indigo-500", "bg-gray-50 border-gray-200 text-gray-700 focus:border-indigo-400")}`}>
                  <option value="BASIC">Básico</option>
                  <option value="PROFESSIONAL">Profissional</option>
                  <option value="ENTERPRISE">Enterprise</option>
                  <option value="DELIVERY">Delivery</option>
                </select>
              </div>
              {formError && <p className="text-xs text-red-400">{formError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-medium transition ${c("bg-[#27272a] hover:bg-[#3f3f46] text-white", "bg-gray-100 hover:bg-gray-200 text-gray-700")}`}>
                  Cancelar
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 rounded-xl py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50">
                  {creating ? "Criando..." : "Criar restaurante"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — Excluir
      ══════════════════════════════════════════════════════════════════════ */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl p-7 w-full max-w-md shadow-2xl border ${c("bg-[#0f0f14] border-red-900/50", "bg-white border-red-200")}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-950 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className={`text-sm font-black ${c("text-white", "text-gray-900")}`}>Excluir empresa</h3>
                <p className={`text-[10px] ${c("text-zinc-500", "text-gray-400")}`}>Esta ação é permanente e irreversível</p>
              </div>
            </div>
            <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-4 mb-5">
              <p className="text-sm font-semibold text-red-300">{deleteTarget.name}</p>
              <p className="text-[10px] text-red-400/70 mt-0.5">{deleteTarget.email}</p>
              <p className="text-[10px] text-red-400/60 mt-2">Todos os dados serão apagados permanentemente.</p>
            </div>
            <div className="mb-5">
              <label className={`block text-[10px] mb-1.5 ${c("text-zinc-400", "text-gray-500")}`}>
                Digite <span className="font-black text-white">EXCLUIR</span> para confirmar
              </label>
              <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
                placeholder="EXCLUIR" autoFocus
                className={`w-full rounded-xl px-4 py-3 text-sm outline-none border transition ${c("bg-[#18181b] border-[#27272a] focus:border-red-600 text-white placeholder-zinc-600", "bg-gray-50 border-gray-200 focus:border-red-400 text-gray-900")}`}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setDeleteTarget(null); setConfirmText("") }}
                className={`flex-1 rounded-xl py-3 text-sm font-medium transition ${c("bg-[#27272a] hover:bg-[#3f3f46] text-white", "bg-gray-100 hover:bg-gray-200 text-gray-700")}`}>
                Cancelar
              </button>
              <button onClick={confirmDelete} disabled={confirmText !== "EXCLUIR" || deleting === deleteTarget.id}
                className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition rounded-xl py-3 text-sm font-black text-white">
                {deleting === deleteTarget.id ? "Excluindo..." : "Excluir definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — Clonar cardápio
      ══════════════════════════════════════════════════════════════════════ */}
      {showCloneModal && cloneTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl p-7 w-full max-w-md shadow-2xl border ${c("bg-[#0f0f14] border-[#27272a]", "bg-white border-gray-200")}`}>
            <h3 className={`text-sm font-black mb-1 ${c("text-white", "text-gray-900")}`}>Clonar Cardápio</h3>
            <p className={`text-xs mb-5 ${c("text-zinc-500", "text-gray-500")}`}>
              Copiar para <strong className={c("text-white", "text-gray-900")}>{cloneTarget.name}</strong>
            </p>
            {cloneResult ? (
              <>
                <div className="bg-emerald-950 border border-emerald-900 rounded-xl p-5 text-center mb-5">
                  <p className="text-emerald-400 font-black">Cardápio clonado ✓</p>
                  <p className="text-emerald-600 text-xs mt-1.5">{cloneResult.categories} categorias e {cloneResult.products} produtos copiados.</p>
                </div>
                <button onClick={() => setShowCloneModal(false)}
                  className={`w-full rounded-xl py-3 text-sm font-medium transition ${c("bg-[#27272a] hover:bg-[#3f3f46] text-white", "bg-gray-100 hover:bg-gray-200 text-gray-700")}`}>
                  Fechar
                </button>
              </>
            ) : (
              <form onSubmit={cloneMenu} className="space-y-4">
                <div>
                  <label className={`block text-[10px] font-semibold mb-1 ${c("text-zinc-400", "text-gray-500")}`}>Empresa de origem</label>
                  <select value={cloneSourceId} onChange={e => setCloneSourceId(e.target.value)} required
                    className={`w-full rounded-xl px-4 py-2.5 text-xs outline-none border transition ${c("bg-[#18181b] border-[#27272a] text-zinc-300 focus:border-amber-500", "bg-gray-50 border-gray-200 text-gray-700")}`}>
                    <option value="">Selecionar empresa...</option>
                    {companies.filter(co => co.id !== cloneTarget.id).map(co => (
                      <option key={co.id} value={co.id}>{co.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowCloneModal(false)}
                    className={`flex-1 rounded-xl py-2.5 text-xs font-medium transition ${c("bg-[#27272a] hover:bg-[#3f3f46] text-white", "bg-gray-100 hover:bg-gray-200 text-gray-700")}`}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={cloning || !cloneSourceId}
                    className="flex-1 rounded-xl py-2.5 text-xs font-black bg-amber-600 hover:bg-amber-500 text-white transition disabled:opacity-50">
                    {cloning ? "Clonando..." : "Clonar cardápio"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
