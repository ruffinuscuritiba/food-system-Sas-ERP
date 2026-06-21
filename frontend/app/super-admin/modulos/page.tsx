"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  LayoutDashboard, UserCheck, TrendingUp, Package,
  Layout, Star, DollarSign, Search, CheckCircle2, XCircle,
  ToggleLeft, ToggleRight, Loader2, AlertCircle, RefreshCw,
} from "lucide-react"
import { saApi } from "@/services/superAdminApi"

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface Company {
  id: string
  name: string
  plan: string
  email?: string
}

interface ModuleItem {
  id: string
  name: string
  slug: string
  description?: string
  category: string
  isFree?: boolean
  status: "ACTIVE" | "TRIAL" | "INACTIVE" | "EXPIRED"
  trialEndsAt?: string | null
}

// ── Navegação (espelhada do dashboard) ────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Dashboard",    href: "/super-admin/dashboard",  icon: LayoutDashboard },
  { label: "Clientes",     href: "/super-admin/clientes",   icon: UserCheck },
  { label: "Leads",        href: "/super-admin/leads",      icon: TrendingUp },
  { label: "Módulos",      href: "/super-admin/modulos",    icon: Package },
  { label: "Construtor",   href: "/super-admin/construtor", icon: Layout },
  { label: "Editor Tema",  href: "/super-admin/tema",       icon: Star },
  { label: "Preços",       href: "/super-admin/pricing",    icon: DollarSign },
]

const PLAN_BADGE: Record<string, string> = {
  BASIC:        "bg-zinc-800 text-zinc-300",
  PROFESSIONAL: "bg-blue-950 text-blue-300",
  ENTERPRISE:   "bg-violet-950 text-violet-300",
  DELIVERY:     "bg-emerald-950 text-emerald-300",
}

const PLAN_LABELS: Record<string, string> = {
  BASIC: "Básico", PROFESSIONAL: "Pro", ENTERPRISE: "Enterprise", DELIVERY: "Delivery",
}

const CAT_LABEL: Record<string, string> = {
  OPERACAO: "Operação",
  FINANCEIRO: "Financeiro",
  MARKETING: "Marketing",
  AUTOMACAO: "Automação",
}

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

// ── Página principal ──────────────────────────────────────────────────────────
export default function SuperAdminModulosPage() {
  const router = useRouter()
  const pathname = usePathname()

  const [companies, setCompanies] = useState<Company[]>([])
  const [search, setSearch] = useState("")
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [loadingModules, setLoadingModules] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Carrega lista de empresas
  useEffect(() => {
    const token = localStorage.getItem("sa_token")
    if (!token) { router.push("/super-admin/login"); return }

    saApi.get("/super-admin/companies")
      .then((r) => setCompanies(r.data?.data ?? r.data ?? []))
      .catch(() => setError("Erro ao carregar empresas"))
      .finally(() => setLoadingCompanies(false))
  }, [router])

  // Carrega módulos da empresa selecionada
  useEffect(() => {
    if (!selectedCompany) return
    setLoadingModules(true)
    setModules([])
    saApi.get(`/company-module/company/${selectedCompany.id}`)
      .then((r) => setModules(r.data ?? []))
      .catch(() => setError("Erro ao carregar módulos"))
      .finally(() => setLoadingModules(false))
  }, [selectedCompany])

  async function toggleModule(mod: ModuleItem) {
    if (!selectedCompany) return
    setToggling(mod.slug)
    try {
      const isActive = mod.status === "ACTIVE" || mod.status === "TRIAL"
      if (isActive) {
        await saApi.delete(`/company-module/${selectedCompany.id}/${mod.slug}`)
      } else {
        await saApi.post("/company-module/activate", {
          companyId: selectedCompany.id,
          moduleSlug: mod.slug,
        })
      }
      // Re-fetch módulos
      const r = await saApi.get(`/company-module/company/${selectedCompany.id}`)
      setModules(r.data ?? [])
    } catch {
      setError("Erro ao alterar módulo")
    } finally {
      setToggling(null)
    }
  }

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(search.toLowerCase())
  )

  // Agrupa módulos por categoria
  const byCategory = modules.reduce<Record<string, ModuleItem[]>>((acc, m) => {
    const cat = m.category ?? "OUTROS"
    ;(acc[cat] = acc[cat] ?? []).push(m)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex">

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-zinc-800 bg-[#0d0d0e] p-4 gap-1">
        <div className="flex items-center gap-2 px-1 mb-6">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-xs font-black">F</div>
          <span className="text-sm font-bold text-white">FoodSaaS</span>
          <span className="text-[10px] text-zinc-500 ml-auto">Super Admin</span>
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} active={pathname === item.href} />
        ))}
        <div className="mt-auto pt-4 border-t border-zinc-800">
          <button
            onClick={() => { localStorage.removeItem("sa_token"); router.push("/super-admin/login") }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-all"
          >
            <XCircle className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* ── Conteúdo ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Painel esquerdo — lista de empresas */}
        <div className="w-72 shrink-0 border-r border-zinc-800 flex flex-col">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-sm font-bold text-white mb-3">Empresas</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar empresa..."
                className="w-full pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingCompanies ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
              </div>
            ) : filteredCompanies.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center p-4">Nenhuma empresa encontrada</p>
            ) : (
              filteredCompanies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => setSelectedCompany(company)}
                  className={`w-full text-left px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors ${
                    selectedCompany?.id === company.id ? "bg-zinc-800 border-l-2 border-l-violet-500" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-white truncate">{company.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${PLAN_BADGE[company.plan] ?? "bg-zinc-800 text-zinc-400"}`}>
                      {PLAN_LABELS[company.plan] ?? company.plan}
                    </span>
                  </div>
                  {company.email && (
                    <span className="text-[10px] text-zinc-600 truncate block">{company.email}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Painel direito — módulos */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-3 mb-4 text-sm text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200">×</button>
            </div>
          )}

          {!selectedCompany ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-40">
              <Package className="w-12 h-12 text-zinc-600" />
              <p className="text-zinc-400 text-sm">Selecione uma empresa<br />para gerenciar os módulos</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-lg font-bold text-white">{selectedCompany.name}</h1>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {modules.filter(m => m.status === "ACTIVE" || m.status === "TRIAL").length} módulos ativos de {modules.length}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setLoadingModules(true)
                    saApi.get(`/company-module/company/${selectedCompany.id}`)
                      .then(r => setModules(r.data ?? []))
                      .finally(() => setLoadingModules(false))
                  }}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white border border-zinc-800 rounded-lg px-3 py-2 hover:bg-zinc-800 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Atualizar
                </button>
              </div>

              {loadingModules ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
                </div>
              ) : Object.entries(byCategory).map(([cat, mods]) => (
                <div key={cat} className="mb-8">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                    {CAT_LABEL[cat] ?? cat}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {mods.map((mod) => {
                      const isOn = mod.status === "ACTIVE" || mod.status === "TRIAL"
                      const isLoading = toggling === mod.slug
                      return (
                        <div
                          key={mod.slug}
                          className={`relative rounded-xl border p-4 transition-all ${
                            isOn
                              ? "border-emerald-800/60 bg-emerald-950/20"
                              : "border-zinc-800 bg-zinc-900/40"
                          }`}
                        >
                          {/* Status badge */}
                          {mod.status === "TRIAL" && (
                            <span className="absolute top-3 right-3 text-[10px] bg-amber-900/60 text-amber-300 px-1.5 py-0.5 rounded font-medium">
                              TRIAL
                            </span>
                          )}
                          {mod.status === "EXPIRED" && (
                            <span className="absolute top-3 right-3 text-[10px] bg-red-900/60 text-red-300 px-1.5 py-0.5 rounded font-medium">
                              EXPIRADO
                            </span>
                          )}

                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{mod.name}</p>
                              <p className="text-[10px] text-zinc-600 mt-0.5 font-mono">{mod.slug}</p>
                            </div>
                            {/* Toggle */}
                            <button
                              onClick={() => toggleModule(mod)}
                              disabled={isLoading}
                              className="shrink-0 transition-opacity hover:opacity-80 disabled:opacity-40"
                              title={isOn ? "Desativar módulo" : "Ativar módulo"}
                            >
                              {isLoading ? (
                                <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
                              ) : isOn ? (
                                <ToggleRight className="w-8 h-8 text-emerald-400" />
                              ) : (
                                <ToggleLeft className="w-8 h-8 text-zinc-600" />
                              )}
                            </button>
                          </div>

                          {mod.description && (
                            <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">{mod.description}</p>
                          )}

                          {/* Status line */}
                          <div className="flex items-center gap-1.5 mt-3">
                            {isOn ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                            ) : (
                              <XCircle className="w-3 h-3 text-zinc-700 shrink-0" />
                            )}
                            <span className={`text-[10px] font-medium ${isOn ? "text-emerald-400" : "text-zinc-600"}`}>
                              {mod.status === "ACTIVE" ? "Ativo"
                               : mod.status === "TRIAL" ? `Trial até ${mod.trialEndsAt ? new Date(mod.trialEndsAt).toLocaleDateString("pt-BR") : "?"}`
                               : mod.status === "EXPIRED" ? "Expirado"
                               : "Inativo"}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
