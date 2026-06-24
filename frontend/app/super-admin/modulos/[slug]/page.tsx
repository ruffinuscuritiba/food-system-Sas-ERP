"use client"

import { useParams, useRouter } from "next/navigation"
import { CheckCircle2, Zap, AlertTriangle, ToggleLeft, ToggleRight, Loader2, Search, Building2 } from "lucide-react"
import { MODULE_CATALOG, ModuleDef } from "../page"
import { saApi } from "@/services/superAdminApi"
import { useEffect, useState } from "react"
import { SuperAdminTopBar, saBtn } from "@/components/super-admin/SuperAdminTopBar"

const CAT_COLORS: Record<string, string> = {
  OPERACAO:   "from-blue-600 to-cyan-600",
  ESTOQUE:    "from-amber-500 to-orange-600",
  FINANCEIRO: "from-emerald-600 to-teal-600",
  DELIVERY:   "from-violet-600 to-purple-600",
  MARKETING:  "from-pink-600 to-rose-600",
  AUTOMACAO:  "from-indigo-600 to-violet-600",
}
const CAT_LABELS: Record<string, string> = {
  OPERACAO: "Operação", ESTOQUE: "Estoque", FINANCEIRO: "Financeiro",
  DELIVERY: "Delivery", MARKETING: "Marketing", AUTOMACAO: "Automação & IA",
}

interface Company { id: string; name: string; plan?: string }
interface ModuleStatus { slug: string; status: string }

export default function ModuloDetailPage() {
  const { slug }   = useParams<{ slug: string }>()
  const router     = useRouter()

  const mod: ModuleDef | undefined = MODULE_CATALOG.find(m => m.slug === slug)

  const [companies,  setCompanies]  = useState<Company[]>([])
  const [statuses,   setStatuses]   = useState<Record<string, boolean>>({})   // companyId → isActive
  const [toggling,   setToggling]   = useState<string | null>(null)           // companyId being toggled
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState("")
  const [error,      setError]      = useState<string | null>(null)

  useEffect(() => {
    if (!mod) return
    saApi.get<Company[]>("/company")
      .then(async (r) => {
        const list = r.data.filter((c: Company) => !c.id.startsWith("demo-"))
        setCompanies(list)
        // fetch module status for each company in parallel (batch)
        const pairs = await Promise.all(
          list.map((c: Company) =>
            saApi.get<ModuleStatus[]>(`/company-module/company/${c.id}`)
              .then(res => ({ id: c.id, active: (res.data ?? []).some((m: ModuleStatus) => m.slug === mod.slug && (m.status === "ACTIVE" || m.status === "TRIAL")) }))
              .catch(() => ({ id: c.id, active: false }))
          )
        )
        const map: Record<string, boolean> = {}
        pairs.forEach(p => { map[p.id] = p.active })
        setStatuses(map)
      })
      .catch(() => setError("Erro ao carregar empresas"))
      .finally(() => setLoading(false))
  }, [mod?.slug])

  async function toggle(company: Company) {
    if (!mod || !mod.isConfigured) return
    const wasOn = !!statuses[company.id]
    setToggling(company.id)
    setError(null)
    // optimistic
    setStatuses(s => ({ ...s, [company.id]: !wasOn }))
    try {
      if (wasOn) {
        await saApi.delete(`/company-module/${company.id}/${mod.slug}`)
      } else {
        await saApi.post("/company-module/activate", { companyId: company.id, moduleSlug: mod.slug })
      }
    } catch (e: any) {
      setStatuses(s => ({ ...s, [company.id]: wasOn }))   // rollback
      setError(e?.response?.data?.message || `Erro ao alterar módulo para ${company.name}`)
    } finally {
      setToggling(null)
    }
  }

  const filtered = companies.filter(c =>
    !search.trim() || c.name.toLowerCase().includes(search.toLowerCase())
  )
  const activeCount = Object.values(statuses).filter(Boolean).length

  if (!mod) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-4xl mb-4">❓</p>
          <p className="text-zinc-400 mb-4">Módulo <code className="text-violet-400">"{slug}"</code> não encontrado.</p>
          <button onClick={() => router.push("/super-admin/modulos")}
            className="px-4 py-2 bg-zinc-800 rounded-xl text-sm hover:bg-zinc-700 transition">
            ← Voltar
          </button>
        </div>
      </div>
    )
  }

  const catColor = CAT_COLORS[mod.category] ?? "from-zinc-600 to-zinc-700"

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col">
      <SuperAdminTopBar backHref="/super-admin/modulos" backLabel="Módulos" />

      <div className="max-w-4xl mx-auto w-full px-6 py-8 space-y-6">

        {/* Header do módulo */}
        <div className="flex items-start gap-5">
          <div className={`w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center text-3xl bg-gradient-to-br ${catColor} shadow-xl`}>
            {mod.emoji}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">
                {CAT_LABELS[mod.category]}
              </span>
              {!mod.isConfigured && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">
                  Em configuração
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-white leading-tight">{mod.name}</h1>
            <p className="text-zinc-400 text-sm mt-1">{mod.tagline}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-black text-emerald-400">{activeCount}</p>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wide">lojas ativas</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3 text-sm text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {!mod.isConfigured && mod.setupNote && (
          <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-800/40 rounded-2xl px-5 py-4 text-sm text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{mod.setupNote}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Detalhes do módulo */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-800 bg-[#111116] p-5">
              <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-violet-400" /> O que é
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">{mod.detail.what}</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-[#111116] p-5">
              <h2 className="text-sm font-bold text-white mb-3">Funcionalidades</h2>
              <ul className="space-y-2">
                {mod.benefits.map((b, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-zinc-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Gerenciamento por empresa */}
          <div className="rounded-2xl border border-zinc-800 bg-[#111116] flex flex-col">
            <div className="px-5 pt-5 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-orange-400" />
                <h2 className="text-sm font-bold text-white">Ativar por Empresa</h2>
                <span className="ml-auto text-[10px] text-zinc-600">Super Admin — sem restrições</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar empresa…"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[400px] divide-y divide-zinc-800/60">
              {loading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-zinc-600 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center text-zinc-600 text-xs">Nenhuma empresa encontrada</div>
              ) : (
                filtered.map(c => {
                  const isOn = !!statuses[c.id]
                  const isToggling = toggling === c.id
                  return (
                    <div key={c.id} className={`flex items-center gap-3 px-5 py-3 transition hover:bg-zinc-800/40 ${isOn ? "bg-emerald-500/5" : ""}`}>
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${isOn ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{c.name}</p>
                        <p className={`text-[10px] font-semibold ${isOn ? "text-emerald-400" : "text-zinc-600"}`}>
                          {isOn ? "● Ativo" : "○ Inativo"}
                        </p>
                      </div>
                      {/* Toggle */}
                      {mod.isConfigured ? (
                        <button
                          onClick={() => toggle(c)}
                          disabled={isToggling}
                          className={`shrink-0 transition ${saBtn} disabled:opacity-40`}
                          title={isOn ? "Desativar" : "Ativar"}
                        >
                          {isToggling
                            ? <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
                            : isOn
                              ? <ToggleRight className="w-9 h-9 text-emerald-400" />
                              : <ToggleLeft className="w-9 h-9 text-zinc-600 hover:text-zinc-400" />
                          }
                        </button>
                      ) : (
                        <span className="text-[10px] text-zinc-700 shrink-0">indisponível</span>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
