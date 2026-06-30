"use client"

import { useEffect, useState } from "react"
import { api } from "@/services/api"
import toast from "react-hot-toast"
import {
  QrCode, Plus, ToggleLeft, ToggleRight, Trash2,
  TrendingUp, ScanLine, ShoppingBag, DollarSign, Percent,
  ChevronDown, ChevronUp,
} from "lucide-react"

// ─── Tipos ───────────────────────────────────────────────────────────────────

type CampaignType = "RECUPERACAO_IFOOD" | "FIDELIZACAO" | "CASHBACK" | "PRIMEIRA_COMPRA"
type DiscountType = "PERCENTUAL" | "FIXO"

interface Campaign {
  id: string
  name: string
  type: CampaignType
  discountType: DiscountType
  discountValue: number
  minimumOrder: number
  startsAt: string
  endsAt: string
  limitPerCustomer?: number
  limitPerDevice?: number
  status: boolean
  _count: { qrCodes: number }
}

interface Metrics {
  generated: number
  scanned: number
  conversionRate: number
  totalOrders: number
  totalRevenue: number
  totalDiscount: number
  avgTicket: number
}

// ─── Labels ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<CampaignType, string> = {
  RECUPERACAO_IFOOD: "🍊 Recuperação iFood",
  FIDELIZACAO:       "⭐ Fidelização",
  CASHBACK:          "💸 Cashback",
  PRIMEIRA_COMPRA:   "🎁 Primeira Compra",
}

const TYPE_COLORS: Record<CampaignType, string> = {
  RECUPERACAO_IFOOD: "bg-orange-100 text-orange-700 border-orange-200",
  FIDELIZACAO:       "bg-yellow-100 text-yellow-700 border-yellow-200",
  CASHBACK:          "bg-emerald-100 text-emerald-700 border-emerald-200",
  PRIMEIRA_COMPRA:   "bg-blue-100 text-blue-700 border-blue-200",
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CampanhasPage() {
  const [campaigns, setCampaigns]   = useState<Campaign[]>([])
  const [metrics, setMetrics]       = useState<Metrics | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name:             "",
    type:             "RECUPERACAO_IFOOD" as CampaignType,
    discountType:     "FIXO" as DiscountType,
    discountValue:    10,
    minimumOrder:     0,
    startsAt:         new Date().toISOString().slice(0, 16),
    endsAt:           new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16),
    limitPerCustomer: "",
    limitPerDevice:   "",
  })

  async function loadAll() {
    setLoading(true)
    try {
      const [c, m] = await Promise.all([
        api.get<Campaign[]>("/qr-campaigns"),
        api.get<Metrics>("/qr-campaigns/metrics"),
      ])
      setCampaigns(c.data)
      setMetrics(m.data)
    } catch {
      toast.error("Erro ao carregar campanhas")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post("/qr-campaigns", {
        ...form,
        discountValue:    Number(form.discountValue),
        minimumOrder:     Number(form.minimumOrder),
        limitPerCustomer: form.limitPerCustomer ? Number(form.limitPerCustomer) : undefined,
        limitPerDevice:   form.limitPerDevice   ? Number(form.limitPerDevice)   : undefined,
      })
      toast.success("Campanha criada!")
      setShowForm(false)
      loadAll()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Erro ao criar campanha")
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleStatus(id: string, current: boolean) {
    try {
      await api.patch(`/qr-campaigns/${id}/toggle`, { status: !current })
      toast.success(!current ? "Campanha ativada" : "Campanha pausada")
      loadAll()
    } catch {
      toast.error("Erro ao alterar status")
    }
  }

  async function deleteCampaign(id: string) {
    if (!confirm("Deletar campanha? Os QR codes gerados serão removidos.")) return
    try {
      await api.delete(`/qr-campaigns/${id}`)
      toast.success("Campanha removida")
      loadAll()
    } catch {
      toast.error("Erro ao remover campanha")
    }
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })

  return (
    <div className="admin-page p-6 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <QrCode className="text-orange-600" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Recuperação via QR Code</h1>
            <p className="text-sm text-gray-500">Converta clientes de apps externos para o cardápio próprio</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 transition"
        >
          <Plus size={16} />
          Nova Campanha
          {showForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Métricas KPI */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "QR Gerados",       value: metrics.generated,               icon: QrCode,     color: "text-gray-600",    bg: "bg-gray-50"    },
            { label: "Escaneados",        value: `${metrics.scanned} (${metrics.conversionRate}%)`, icon: ScanLine, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Pedidos Gerados",   value: metrics.totalOrders,             icon: ShoppingBag, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Faturamento",       value: `R$ ${fmt(metrics.totalRevenue)}`, icon: DollarSign, color: "text-orange-600",  bg: "bg-orange-50" },
          ].map(kpi => (
            <div key={kpi.label} className={`rounded-2xl border p-4 ${kpi.bg}`}>
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon size={16} className={kpi.color} />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{kpi.label}</span>
              </div>
              <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Formulário inline */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 border rounded-2xl p-6 space-y-4">
          <h2 className="font-bold text-gray-800">Nova Campanha</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Nome</label>
              <input
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                placeholder="Ex: Cupom iFood — Julho"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Tipo</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as CampaignType }))}
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              >
                {(Object.entries(TYPE_LABELS) as [CampaignType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Tipo de Desconto</label>
              <div className="mt-1 flex gap-2">
                {(["FIXO", "PERCENTUAL"] as DiscountType[]).map(t => (
                  <button
                    key={t} type="button"
                    onClick={() => setForm(f => ({ ...f, discountType: t }))}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-sm font-semibold border transition
                      ${form.discountType === t ? "bg-orange-600 text-white border-orange-600" : "bg-white text-gray-600"}`}
                  >
                    {t === "FIXO" ? <DollarSign size={14} /> : <Percent size={14} />}
                    {t === "FIXO" ? "Valor Fixo" : "Percentual"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">
                Valor do Desconto {form.discountType === "PERCENTUAL" ? "(%)" : "(R$)"}
              </label>
              <input
                type="number" min={0.01} step={0.01} required
                value={form.discountValue}
                onChange={e => setForm(f => ({ ...f, discountValue: Number(e.target.value) }))}
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Pedido Mínimo (R$)</label>
              <input
                type="number" min={0} step={0.01}
                value={form.minimumOrder}
                onChange={e => setForm(f => ({ ...f, minimumOrder: Number(e.target.value) }))}
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Limite por dispositivo/IP</label>
              <input
                type="number" min={1} step={1}
                value={form.limitPerDevice}
                onChange={e => setForm(f => ({ ...f, limitPerDevice: e.target.value }))}
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                placeholder="Ex: 1 (usar apenas 1x por device)"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Válida a partir de</label>
              <input
                type="datetime-local" required
                value={form.startsAt}
                onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))}
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Válida até</label>
              <input
                type="datetime-local" required
                value={form.endsAt}
                onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))}
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl border text-sm text-gray-600 hover:bg-gray-100">
              Cancelar
            </button>
            <button type="submit" disabled={submitting}
              className="px-6 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50">
              {submitting ? "Salvando..." : "Salvar Campanha"}
            </button>
          </div>
        </form>
      )}

      {/* Lista de campanhas */}
      {loading ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <QrCode size={40} className="mx-auto mb-3 opacity-30" />
          <p>Nenhuma campanha criada ainda.</p>
          <p className="text-sm">Clique em "Nova Campanha" para começar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id}
              className={`border rounded-2xl p-4 flex flex-wrap items-center gap-4 transition
                ${c.status ? "bg-white" : "bg-gray-50 opacity-70"}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${TYPE_COLORS[c.type]}`}>
                    {TYPE_LABELS[c.type]}
                  </span>
                  {!c.status && (
                    <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Pausada</span>
                  )}
                </div>
                <p className="font-semibold text-gray-800 mt-1">{c.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {c.discountType === "FIXO"
                    ? `R$ ${Number(c.discountValue).toFixed(2).replace(".", ",")} de desconto`
                    : `${c.discountValue}% de desconto`
                  }
                  {Number(c.minimumOrder) > 0 && ` · Mín. R$ ${Number(c.minimumOrder).toFixed(2).replace(".", ",")}`}
                  {" · "}
                  Válido até {new Date(c.endsAt).toLocaleDateString("pt-BR")}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-xl font-black text-gray-800">{c._count.qrCodes}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">QR gerados</p>
                </div>

                <button
                  onClick={() => toggleStatus(c.id, c.status)}
                  className="text-gray-400 hover:text-orange-600 transition"
                  title={c.status ? "Pausar" : "Ativar"}
                >
                  {c.status
                    ? <ToggleRight size={28} className="text-orange-500" />
                    : <ToggleLeft size={28} />
                  }
                </button>

                <button
                  onClick={() => deleteCampaign(c.id)}
                  className="text-gray-300 hover:text-red-500 transition"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dica técnica */}
      <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm text-orange-700">
        <strong>Como funciona:</strong> ao finalizar cada pedido (cardápio próprio, iFood ou 99Food),
        o sistema gera automaticamente um QR code na impressão. O cliente escaneia, é redirecionado
        para o seu cardápio digital e o desconto é aplicado automaticamente no checkout.
      </div>
    </div>
  )
}
