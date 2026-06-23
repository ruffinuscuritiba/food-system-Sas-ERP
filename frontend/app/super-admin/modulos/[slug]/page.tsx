"use client"

import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, Zap, AlertTriangle, ToggleLeft, ToggleRight, Loader2 } from "lucide-react"
import { MODULE_CATALOG, ModuleDef } from "../page"
import { saApi } from "@/services/superAdminApi"
import { useEffect, useState } from "react"

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

export default function ModuloDetailPage() {
  const { slug }        = useParams<{ slug: string }>()
  const searchParams    = useSearchParams()
  const router          = useRouter()
  const companyId       = searchParams.get("company")
  const companyName     = searchParams.get("cname")

  const mod: ModuleDef | undefined = MODULE_CATALOG.find(m => m.slug === slug)

  const [isOn,     setIsOn]     = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [toggling, setToggling] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    if (!companyId || !mod) return
    setLoading(true)
    saApi.get(`/company-module/company/${companyId}`)
      .then((r) => {
        const list: { slug: string; status: string }[] = r.data ?? []
        const cm = list.find(m => m.slug === mod.slug)
        setIsOn(cm?.status === "ACTIVE" || cm?.status === "TRIAL")
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [companyId, mod])

  async function toggle() {
    if (!companyId || !mod || !mod.isConfigured) return
    setToggling(true)
    setError(null)
    try {
      if (isOn) {
        await saApi.delete(`/company-module/${companyId}/${mod.slug}`)
        setIsOn(false)
      } else {
        await saApi.post("/company-module/activate", { companyId, moduleSlug: mod.slug })
        setIsOn(true)
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || "Erro ao alterar módulo")
    } finally {
      setToggling(false)
    }
  }

  if (!mod) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-4xl mb-4">❓</p>
          <p className="text-zinc-400 mb-4">Módulo <code className="text-violet-400">"{slug}"</code> não encontrado no catálogo.</p>
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
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Back */}
        <button onClick={() => router.push("/super-admin/modulos")}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white mb-8 transition">
          <ArrowLeft className="w-3.5 h-3.5" />
          {companyName ? `Voltar para ${companyName}` : "Voltar aos Módulos"}
        </button>

        {/* Header */}
        <div className="flex items-start gap-5 mb-8">
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

          {/* Toggle rápido (só se empresa selecionada) */}
          {companyId && mod.isConfigured && (
            <div className="shrink-0 flex flex-col items-center gap-1">
              {loading ? (
                <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
              ) : (
                <button onClick={toggle} disabled={toggling}
                  className="transition hover:opacity-80 disabled:opacity-40"
                  title={isOn ? "Desativar" : "Ativar"}>
                  {toggling
                    ? <Loader2 className="w-9 h-9 text-zinc-400 animate-spin" />
                    : isOn
                      ? <ToggleRight className="w-11 h-11 text-emerald-400" />
                      : <ToggleLeft className="w-11 h-11 text-zinc-600" />}
                </button>
              )}
              <span className={`text-[10px] font-semibold ${isOn ? "text-emerald-400" : "text-zinc-600"}`}>
                {isOn ? "Ativo" : "Inativo"}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3 text-sm text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {!mod.isConfigured && mod.setupNote && (
          <div className="mb-6 flex items-start gap-2 bg-amber-950/30 border border-amber-800/40 rounded-2xl px-5 py-4 text-sm text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{mod.setupNote}</span>
          </div>
        )}

        {/* O que é */}
        <div className="rounded-2xl border border-zinc-800 bg-[#111116] p-6 mb-5">
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-400" /> O que é
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">{mod.detail.what}</p>
        </div>

        {/* Por que usar */}
        <div className="rounded-2xl border border-zinc-800 bg-[#111116] p-6 mb-5">
          <h2 className="text-sm font-bold text-white mb-4">Por que ativar</h2>
          <ul className="space-y-2.5">
            {mod.detail.why.map((w, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-zinc-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                {w}
              </li>
            ))}
          </ul>
        </div>

        {/* Benefícios */}
        <div className="rounded-2xl border border-zinc-800 bg-[#111116] p-6 mb-8">
          <h2 className="text-sm font-bold text-white mb-4">Funcionalidades</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mod.benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-zinc-400">
                <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${catColor} shrink-0`} />
                {b}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        {companyId && mod.isConfigured && (
          <button
            onClick={toggle}
            disabled={toggling || loading}
            className={`w-full py-4 rounded-2xl font-bold text-sm transition disabled:opacity-50 ${
              isOn
                ? "bg-zinc-800 hover:bg-zinc-700 text-white"
                : `bg-gradient-to-r ${catColor} text-white hover:opacity-90 shadow-lg`
            }`}
          >
            {toggling
              ? "Aguarde..."
              : isOn
                ? "Desativar módulo"
                : `Ativar ${mod.name} para ${companyName ?? "esta empresa"}`}
          </button>
        )}

        {!companyId && (
          <div className="text-center text-zinc-600 text-sm border border-zinc-800 rounded-2xl p-6">
            Acesse esta página via <strong className="text-zinc-400">/super-admin/modulos</strong> com uma empresa selecionada para ativar/desativar.
          </div>
        )}
      </div>
    </div>
  )
}
