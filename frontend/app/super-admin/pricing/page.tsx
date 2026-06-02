"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { saApi } from "@/services/superAdminApi"

interface PlanConfig {
  plan: string
  price: number
  label: string
  tagline: string | null
}

interface ModuleItem {
  id: string
  slug: string
  name: string
  category: string
  price: number | null
  isFree: boolean
  description: string
}

const PLAN_LABELS: Record<string, { color: string; badge: string }> = {
  BASIC:      { color: "text-slate-300",  badge: "bg-gray-700 text-gray-300" },
  PRO:        { color: "text-blue-300",   badge: "bg-blue-900 text-blue-300" },
  ENTERPRISE: { color: "text-amber-300",  badge: "bg-amber-900 text-amber-300" },
}

const CAT_COLORS: Record<string, string> = {
  OPERACAO:   "bg-orange-900/40 text-orange-300",
  MARKETING:  "bg-purple-900/40 text-purple-300",
  FINANCEIRO: "bg-emerald-900/40 text-emerald-300",
  AUTOMACAO:  "bg-blue-900/40 text-blue-300",
}

export default function SuperAdminPricingPage() {
  const router = useRouter()
  const [plans,      setPlans]      = useState<PlanConfig[]>([])
  const [modules,    setModules]    = useState<ModuleItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [planDraft,  setPlanDraft]  = useState<Record<string, { price: string; label: string; tagline: string }>>({})
  const [modDraft,   setModDraft]   = useState<Record<string, { price: string; isFree: boolean }>>({})
  const [saving,     setSaving]     = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("sa_token")
    if (!token) { router.push("/super-admin/login"); return }
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const [planRes, modRes] = await Promise.all([
        saApi.get<PlanConfig[]>("/super-admin/plan-config"),
        saApi.get<ModuleItem[]>("/super-admin/modules"),
      ])
      setPlans(planRes.data)
      setModules(modRes.data)

      // Inicializar drafts com valores atuais
      const pd: Record<string, { price: string; label: string; tagline: string }> = {}
      planRes.data.forEach((p) => {
        pd[p.plan] = { price: String(p.price), label: p.label, tagline: p.tagline ?? "" }
      })
      setPlanDraft(pd)

      const md: Record<string, { price: string; isFree: boolean }> = {}
      modRes.data.forEach((m) => {
        md[m.slug] = { price: m.price != null ? String(m.price) : "0", isFree: m.isFree }
      })
      setModDraft(md)
    } catch {
      alert("Erro ao carregar configurações de preço")
    } finally {
      setLoading(false)
    }
  }

  async function savePlan(plan: string) {
    const d = planDraft[plan]
    if (!d) return
    setSaving(`plan-${plan}`)
    try {
      await saApi.patch(`/super-admin/plan-config/${plan}`, {
        price:   parseFloat(d.price),
        label:   d.label,
        tagline: d.tagline,
      })
      await load()
    } catch {
      alert(`Erro ao salvar preço do plano ${plan}`)
    } finally {
      setSaving(null)
    }
  }

  async function saveModule(slug: string) {
    const d = modDraft[slug]
    if (!d) return
    setSaving(`mod-${slug}`)
    try {
      await saApi.patch(`/super-admin/modules/${slug}/price`, {
        price:  parseFloat(d.price),
        isFree: d.isFree,
      })
      await load()
    } catch {
      alert(`Erro ao salvar preço do módulo ${slug}`)
    } finally {
      setSaving(null)
    }
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
      <header className="bg-gray-900 border-b border-gray-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/super-admin/dashboard")}
            className="text-sm text-gray-400 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-gray-800"
          >
            ← Voltar
          </button>
          <div>
            <h1 className="text-lg font-bold">💰 Precificação</h1>
            <p className="text-xs text-gray-400">Gerencie preços de planos e módulos avulsos</p>
          </div>
        </div>
      </header>

      <main className="p-8 max-w-5xl mx-auto space-y-10">

        {/* ── Planos ──────────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-bold mb-4 text-gray-200">Planos</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-6 py-3">Plano</th>
                  <th className="text-left px-6 py-3">Label</th>
                  <th className="text-left px-6 py-3">Tagline</th>
                  <th className="text-left px-6 py-3 w-36">Preço (R$/mês)</th>
                  <th className="px-6 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const d = planDraft[p.plan] ?? { price: String(p.price), label: p.label, tagline: p.tagline ?? "" }
                  const cfg = PLAN_LABELS[p.plan] ?? PLAN_LABELS.BASIC
                  const isSaving = saving === `plan-${p.plan}`
                  return (
                    <tr key={p.plan} className="border-b border-gray-800 hover:bg-gray-800/40 transition">
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${cfg.badge}`}>
                          {p.plan}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={d.label}
                          onChange={(e) => setPlanDraft((prev) => ({ ...prev, [p.plan]: { ...d, label: e.target.value } }))}
                          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm w-28 focus:outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={d.tagline}
                          onChange={(e) => setPlanDraft((prev) => ({ ...prev, [p.plan]: { ...d, tagline: e.target.value } }))}
                          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm w-64 focus:outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500 text-xs">R$</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={d.price}
                            onChange={(e) => setPlanDraft((prev) => ({ ...prev, [p.plan]: { ...d, price: e.target.value } }))}
                            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm w-24 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => savePlan(p.plan)}
                          disabled={isSaving}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition rounded-lg px-4 py-1.5 text-xs font-semibold"
                        >
                          {isSaving ? "Salvando..." : "Salvar"}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Módulos Avulsos ──────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-bold mb-4 text-gray-200">Módulos Avulsos</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-6 py-3">Módulo</th>
                  <th className="text-left px-6 py-3">Categoria</th>
                  <th className="text-left px-6 py-3 w-36">Preço (R$/mês)</th>
                  <th className="text-left px-6 py-3 w-28">Gratuito</th>
                  <th className="px-6 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => {
                  const d = modDraft[m.slug] ?? { price: m.price != null ? String(m.price) : "0", isFree: m.isFree }
                  const isSaving = saving === `mod-${m.slug}`
                  const catColor = CAT_COLORS[m.category] ?? "bg-gray-700 text-gray-300"
                  return (
                    <tr key={m.slug} className="border-b border-gray-800 hover:bg-gray-800/40 transition">
                      <td className="px-6 py-4">
                        <p className="font-medium text-white">{m.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{m.description}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${catColor}`}>
                          {m.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500 text-xs">R$</span>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={d.price}
                            disabled={d.isFree}
                            onChange={(e) => setModDraft((prev) => ({ ...prev, [m.slug]: { ...d, price: e.target.value } }))}
                            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm w-24 focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={d.isFree}
                            onChange={(e) => setModDraft((prev) => ({ ...prev, [m.slug]: { ...d, isFree: e.target.checked } }))}
                            className="w-4 h-4 accent-indigo-500"
                          />
                          <span className="text-xs text-gray-400">Incluso</span>
                        </label>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => saveModule(m.slug)}
                          disabled={isSaving}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition rounded-lg px-4 py-1.5 text-xs font-semibold"
                        >
                          {isSaving ? "Salvando..." : "Salvar"}
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {modules.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500 text-sm">
                      Nenhum módulo no catálogo. Cadastre módulos via seed ou Prisma Studio.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  )
}
