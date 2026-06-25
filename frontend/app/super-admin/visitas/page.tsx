"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard, UserCheck, TrendingUp, Package, Layout,
  DollarSign, PieChart, Building2, Eye, Users, MessageSquare,
  RefreshCw, ArrowLeft, Activity, Calendar, BarChart3,
  TrendingDown, Zap,
} from "lucide-react"
import { saApi } from "@/services/superAdminApi"

interface VisitStats {
  total: number
  today: number
  thisWeek: number
  thisMonth: number
}

interface PageData {
  page: string
  label: string
  icon: React.ReactNode
  color: string
  glow: string
  stats: VisitStats | null
  loading: boolean
}

const PAGES_CONFIG = [
  {
    page: "/demo",
    label: "Página de Demos",
    icon: <Zap size={20} />,
    color: "#f97316",
    glow: "rgba(249,115,22,0.15)",
  },
  {
    page: "/ia-demo",
    label: "Luna — IA Demo",
    icon: <MessageSquare size={20} />,
    color: "#8b5cf6",
    glow: "rgba(139,92,246,0.15)",
  },
  {
    page: "/landing",
    label: "Landing Page",
    icon: <BarChart3 size={20} />,
    color: "#06b6d4",
    glow: "rgba(6,182,212,0.15)",
  },
]

// Nichos rastreados na /demo (page = "demo:<nicho>"). Mantém paridade com ALL_NICHES de app/demo/page.tsx
const NICHES = [
  "Restaurantes", "Pizzaria", "Hamburgueria", "Lanchonetes",
  "Churrascaria", "Hotdogs", "Marmitarias", "Padaria",
  "Confeitaria", "Pastelaria", "Açaí", "Conveniências", "Mercados",
]
const NICHE_EMOJI: Record<string, string> = {
  Restaurantes: "🍽️", Pizzaria: "🍕", Hamburgueria: "🍔", Lanchonetes: "🥪",
  Churrascaria: "🥩", Hotdogs: "🌭", Marmitarias: "🍱", Padaria: "🥐",
  Confeitaria: "🍰", Pastelaria: "🥟", "Açaí": "🍧", "Conveniências": "🏪", Mercados: "🛒",
}

function KpiCard({
  label, value, sub, icon, color, glow,
}: {
  label: string; value: number | string; sub?: string
  icon: React.ReactNode; color: string; glow: string
}) {
  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-3"
      style={{
        background: `linear-gradient(135deg, ${glow} 0%, rgba(255,255,255,0.02) 100%)`,
        borderColor: `${color}22`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: `${color}99` }}>
          {label}
        </span>
        <span style={{ color }}>{icon}</span>
      </div>
      <span className="text-4xl font-black text-white tabular-nums">{value}</span>
      {sub && <span className="text-xs text-white/40">{sub}</span>}
    </div>
  )
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-bold text-white/60 tabular-nums w-6 text-right">{pct}%</span>
    </div>
  )
}

const NAV_ITEMS = [
  { label: "Dashboard",    href: "/super-admin/dashboard",  icon: LayoutDashboard },
  { label: "Restaurantes", href: "/super-admin/dashboard",  icon: Building2 },
  { label: "Clientes",     href: "/super-admin/clientes",   icon: UserCheck },
  { label: "Leads",        href: "/super-admin/leads",      icon: TrendingUp },
  { label: "Módulos",      href: "/super-admin/modulos",    icon: Package },
  { label: "Construtor",   href: "/super-admin/construtor", icon: Layout },
  { label: "Preços",       href: "/super-admin/pricing",    icon: DollarSign },
  { label: "Visitas",      href: "/super-admin/visitas",    icon: PieChart },
]

export default function VisitasPage() {
  const router = useRouter()
  const [pages, setPages] = useState<PageData[]>(
    PAGES_CONFIG.map(p => ({ ...p, stats: null, loading: true }))
  )
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const [nicheStats, setNicheStats] = useState<{ niche: string; stats: VisitStats | null }[]>([])
  const [nicheLoading, setNicheLoading] = useState(true)

  async function loadAll() {
    setRefreshing(true)
    setNicheLoading(true)
    const [updated, niches] = await Promise.all([
      Promise.all(
        PAGES_CONFIG.map(async (p) => {
          try {
            const res = await saApi.get<VisitStats>(`/visits/stats?page=${encodeURIComponent(p.page)}`)
            return { ...p, stats: res.data, loading: false }
          } catch {
            return { ...p, stats: null, loading: false }
          }
        })
      ),
      Promise.all(
        NICHES.map(async (niche) => {
          try {
            const res = await saApi.get<VisitStats>(`/visits/stats?page=${encodeURIComponent("demo:" + niche)}`)
            return { niche, stats: res.data }
          } catch {
            return { niche, stats: null }
          }
        })
      ),
    ])
    setPages(updated)
    setNicheStats(niches)
    setLastRefresh(new Date())
    setRefreshing(false)
    setNicheLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const totalVisits  = pages.reduce((s, p) => s + (p.stats?.total    ?? 0), 0)
  const todayVisits  = pages.reduce((s, p) => s + (p.stats?.today    ?? 0), 0)
  const weekVisits   = pages.reduce((s, p) => s + (p.stats?.thisWeek  ?? 0), 0)
  const monthVisits  = pages.reduce((s, p) => s + (p.stats?.thisMonth ?? 0), 0)

  const maxMonth = Math.max(...pages.map(p => p.stats?.thisMonth ?? 0), 1)

  return (
    <div className="min-h-screen flex" style={{ background: "var(--surface-0)", color: "#f1f5f9" }}>

      {/* ── Sidebar nav ── */}
      <aside className="hidden lg:flex flex-col w-52 shrink-0 border-r border-white/[0.05] px-3 py-6 gap-1">
        <div className="px-3 mb-6">
          <span className="text-xs font-black tracking-widest text-white/20 uppercase">R_FoodSaaS</span>
        </div>
        {NAV_ITEMS.map(item => {
          const active = item.href === "/super-admin/visitas"
          return (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          )
        })}
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 p-6 lg:p-10 overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => router.push("/super-admin/dashboard")}
                className="text-white/30 hover:text-white/70 transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <h1 className="text-2xl font-black text-white">Visitas</h1>
            </div>
            <p className="text-sm text-white/40">
              Atualizadas em {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <button
            onClick={loadAll}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/20 transition-all disabled:opacity-40"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>

        {/* KPIs globais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <KpiCard label="Total Histórico" value={totalVisits.toLocaleString("pt-BR")}
            icon={<Eye size={18} />} color="#f97316" glow="rgba(249,115,22,0.12)"
            sub="desde o início" />
          <KpiCard label="Hoje" value={todayVisits.toLocaleString("pt-BR")}
            icon={<Activity size={18} />} color="#22c55e" glow="rgba(34,197,94,0.12)"
            sub="últimas 24h" />
          <KpiCard label="Esta Semana" value={weekVisits.toLocaleString("pt-BR")}
            icon={<Calendar size={18} />} color="#3b82f6" glow="rgba(59,130,246,0.12)"
            sub="últimos 7 dias" />
          <KpiCard label="Este Mês" value={monthVisits.toLocaleString("pt-BR")}
            icon={<BarChart3 size={18} />} color="#8b5cf6" glow="rgba(139,92,246,0.12)"
            sub="mês atual" />
        </div>

        {/* Cards por página */}
        <h2 className="text-xs font-bold uppercase tracking-widest text-white/20 mb-4">
          Por Página
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-10">
          {pages.map((p) => (
            <div
              key={p.page}
              className="rounded-2xl border p-6 flex flex-col gap-5"
              style={{
                borderColor: `${p.color}22`,
                background: `linear-gradient(135deg, ${p.glow} 0%, rgba(255,255,255,0.015) 100%)`,
              }}
            >
              {/* título */}
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${p.color}22`, color: p.color }}
                >
                  {p.icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{p.label}</p>
                  <p className="text-[11px] text-white/30 font-mono">{p.page}</p>
                </div>
              </div>

              {/* números */}
              {p.loading ? (
                <div className="flex items-center gap-2 text-white/30 text-sm">
                  <RefreshCw size={14} className="animate-spin" /> Carregando...
                </div>
              ) : p.stats ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Hoje",       value: p.stats.today },
                      { label: "Semana",     value: p.stats.thisWeek },
                      { label: "Mês",        value: p.stats.thisMonth },
                      { label: "Total",      value: p.stats.total },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{label}</p>
                        <p className="text-2xl font-black text-white tabular-nums">{value.toLocaleString("pt-BR")}</p>
                      </div>
                    ))}
                  </div>

                  {/* barra de participação no mês */}
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
                      Participação no mês
                    </p>
                    <MiniBar value={p.stats.thisMonth} max={monthVisits || 1} color={p.color} />
                  </div>
                </>
              ) : (
                <p className="text-sm text-white/30">Sem dados disponíveis</p>
              )}
            </div>
          ))}
        </div>

        {/* Interesse por nicho de negócio */}
        <h2 className="text-xs font-bold uppercase tracking-widest text-white/20 mb-1">
          Interesse por Nicho de Negócio
        </h2>
        <p className="text-xs text-white/40 mb-4">
          Onde focar o marketing — cada vez que um visitante explora ou entra numa demo de um nicho, ele conta aqui.
        </p>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-10">
          {nicheLoading ? (
            <div className="flex items-center gap-2 text-white/30 text-sm py-4">
              <RefreshCw size={14} className="animate-spin" /> Carregando...
            </div>
          ) : (() => {
            const ranked = nicheStats
              .map(n => ({ niche: n.niche, total: n.stats?.total ?? 0, month: n.stats?.thisMonth ?? 0 }))
              .sort((a, b) => b.total - a.total)
            const withData = ranked.filter(r => r.total > 0)
            const maxTotal = Math.max(...ranked.map(r => r.total), 1)
            if (withData.length === 0) {
              return (
                <p className="text-sm text-white/30 py-2">
                  Ainda sem dados por nicho. Conforme os visitantes exploram os nichos na <span className="font-mono text-white/50">/demo</span>, o ranking aparece aqui.
                </p>
              )
            }
            return (
              <div className="space-y-3">
                {withData.map((r, i) => (
                  <div key={r.niche} className="flex items-center gap-3">
                    <span className="text-lg w-7 text-center shrink-0">{NICHE_EMOJI[r.niche] ?? "🍽️"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-white flex items-center gap-2">
                          {r.niche}
                          {i === 0 && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300">
                              🎯 Foco
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-white/50 tabular-nums">
                          {r.total} <span className="text-white/30">({r.month} no mês)</span>
                        </span>
                      </div>
                      <MiniBar value={r.total} max={maxTotal} color={i === 0 ? "#f97316" : "#8b5cf6"} />
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        {/* Dica de conversão */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0 text-orange-400">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-white mb-1">Taxa de Conversão Estimada</p>
              <p className="text-xs text-white/40 leading-relaxed">
                Compare <strong className="text-white/70">Visitas /demo</strong> com{" "}
                <strong className="text-white/70">Leads captados</strong> na aba Leads para calcular
                sua taxa de conversão. Uma taxa saudável é entre 5% e 15%.
                {monthVisits > 0 && (
                  <> Você teve <strong className="text-orange-400">{monthVisits} visitas</strong> este mês.</>
                )}
              </p>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
