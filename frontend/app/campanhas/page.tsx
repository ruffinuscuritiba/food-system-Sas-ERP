"use client"

import { useEffect, useState } from "react"
import { api } from "@/services/api"
import toast from "react-hot-toast"
import {
  QrCode, Plus, ToggleLeft, ToggleRight, Trash2,
  TrendingUp, ScanLine, ShoppingBag, DollarSign, Percent,
  ChevronDown, ChevronUp, Link2, Copy, Check, X, Download, Printer,
  Award, Gift, PartyPopper,
} from "lucide-react"
import { printTicket, THERMAL_CSS } from "@/components/printing/printTicket"

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

// ─── Cliente Fiel (recompensa a cada N pedidos) ───────────────────────────────

interface LoyaltyConfig {
  ordersThreshold: number
  rewardLabel: string
  isActive: boolean
}

interface LoyaltyReward {
  id: string
  customerPhone: string
  customerName: string | null
  milestoneCount: number
  rewardLabel: string
  createdAt: string
}

// ─── Cashback por pedido (% configurável) ──────────────────────────────────

interface CashbackConfig {
  ratePercent: number
  isActive: boolean
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
  const [shareCampaign, setShareCampaign] = useState<Campaign | null>(null)
  const [shareLink, setShareLink]         = useState<string | null>(null)
  const [shareToken, setShareToken]       = useState<string | null>(null)
  const [shareLoading, setShareLoading]   = useState(false)
  const [copied, setCopied]               = useState(false)
  const [companyName, setCompanyName]     = useState("")

  // Cliente Fiel
  const [loyaltyConfig, setLoyaltyConfig]     = useState<LoyaltyConfig | null>(null)
  const [loyaltyPending, setLoyaltyPending]   = useState<LoyaltyReward[]>([])
  const [loyaltyForm, setLoyaltyForm]         = useState({ ordersThreshold: 10, rewardLabel: "1 Pizza Clássica Grátis", isActive: false })
  const [loyaltySaving, setLoyaltySaving]     = useState(false)
  const [showLoyaltyForm, setShowLoyaltyForm] = useState(false)

  // Cashback
  const [cashbackConfig, setCashbackConfig]   = useState<CashbackConfig | null>(null)
  const [cashbackForm, setCashbackForm]       = useState({ ratePercent: 1.5, isActive: true })
  const [cashbackSaving, setCashbackSaving]   = useState(false)
  const [showCashbackForm, setShowCashbackForm] = useState(false)

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
    // Nome da loja para o cartaz impresso — best-effort, não bloqueia a tela
    api.get<{ name?: string }>("/company/settings")
      .then(r => setCompanyName(r.data?.name ?? ""))
      .catch(() => {})
  }

  async function loadLoyalty() {
    try {
      const [cfg, pending] = await Promise.all([
        api.get<LoyaltyConfig>("/loyalty-milestones/config"),
        api.get<LoyaltyReward[]>("/loyalty-milestones/pending"),
      ])
      setLoyaltyConfig(cfg.data)
      setLoyaltyForm({
        ordersThreshold: cfg.data.ordersThreshold,
        rewardLabel: cfg.data.rewardLabel,
        isActive: cfg.data.isActive,
      })
      setLoyaltyPending(pending.data)
    } catch {
      // best-effort — não trava a tela de campanhas por causa disso
    }
  }

  async function loadCashback() {
    try {
      const { data } = await api.get<CashbackConfig>("/loyalty/cashback-config")
      setCashbackConfig(data)
      setCashbackForm({ ratePercent: Number(data.ratePercent), isActive: data.isActive })
    } catch {
      // best-effort — não trava a tela de campanhas por causa disso
    }
  }

  useEffect(() => { loadAll(); loadLoyalty(); loadCashback() }, [])

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

  async function openShare(c: Campaign) {
    setShareCampaign(c)
    setShareLink(null)
    setShareToken(null)
    setCopied(false)
    setShareLoading(true)
    try {
      const { data } = await api.post<{ redirectUrl: string; token: string }>(`/qr-campaigns/${c.id}/manual-link`)
      setShareLink(data.redirectUrl)
      setShareToken(data.token)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Erro ao gerar link")
      setShareCampaign(null)
    } finally {
      setShareLoading(false)
    }
  }

  /**
   * Imprime um cupom preto-e-branco de 80mm (mesmo padrão dos tickets de
   * pedido — THERMAL_CSS/printTicket) pra grampear na caixa/sacola de
   * entrega (iFood/99Food). Trocado do cartaz A5 colorido original porque a
   * impressora térmica de recibo (ex.: Bematech MP-4200 TH) não imprime
   * página inteira colorida — só ~80mm em preto e branco.
   */
  function printPoster() {
    if (!shareCampaign || !shareLink) return
    const discountLine = shareCampaign.discountType === "FIXO"
      ? `R$ ${Number(shareCampaign.discountValue).toFixed(2).replace(".", ",")} DE DESCONTO`
      : `${shareCampaign.discountValue}% DE DESCONTO`
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(shareLink)}`
    const store = companyName ? companyName.toUpperCase() : ""

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Cupom — ${shareCampaign.name}</title>
<style>${THERMAL_CSS}</style>
</head>
<body>
  ${store ? `<div class="center bold" style="letter-spacing:1px;">${store}</div>` : ""}
  <div class="center bold" style="font-size:11px;margin-top:4px;">ESCANEIE E GANHE</div>
  <hr/>
  <div class="center" style="font-size:18px;font-weight:900;margin-top:4px;">${discountLine}</div>
  <div class="center" style="font-size:12px;font-weight:600;margin-top:4px;">no seu primeiro pedido, direto pela nossa loja - sem taxa de app!</div>
  <div class="center" style="margin:10px 0;">
    <img src="${qrImg}" width="180" height="180" style="display:block;margin:0 auto;" alt="QR"/>
  </div>
  <div class="center bold" style="font-size:14px;">Aponte a câmera do celular</div>
  <div class="center" style="font-family:monospace;font-size:16px;font-weight:900;letter-spacing:3px;margin-top:4px;">${shareToken ?? ""}</div>
  <hr/>
  <div class="center bold" style="font-size:11px;">Desconto aplicado automaticamente no cadastro do 1o pedido</div>
  <div class="center bold" style="font-size:11px;margin-top:6px;">*** grampeie este cupom na caixa/sacola ***</div>
</body>
</html>`

    if (!printTicket(html)) {
      toast.error("Popup bloqueado — permita popups para imprimir o cupom")
    }
  }

  async function copyLink() {
    if (!shareLink) return
    await navigator.clipboard.writeText(shareLink)
    setCopied(true)
    toast.success("Link copiado!")
    setTimeout(() => setCopied(false), 2000)
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

  async function saveLoyaltyConfig(e: React.FormEvent) {
    e.preventDefault()
    if (loyaltyForm.ordersThreshold < 2) {
      toast.error("O número de pedidos precisa ser pelo menos 2")
      return
    }
    setLoyaltySaving(true)
    try {
      const { data } = await api.patch<LoyaltyConfig>("/loyalty-milestones/config", loyaltyForm)
      setLoyaltyConfig(data)
      toast.success("Programa Cliente Fiel salvo!")
      setShowLoyaltyForm(false)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Erro ao salvar")
    } finally {
      setLoyaltySaving(false)
    }
  }

  async function saveCashbackConfig(e: React.FormEvent) {
    e.preventDefault()
    if (cashbackForm.ratePercent < 0 || cashbackForm.ratePercent > 20) {
      toast.error("A taxa precisa estar entre 0% e 20%")
      return
    }
    setCashbackSaving(true)
    try {
      const { data } = await api.patch<CashbackConfig>("/loyalty/cashback-config", cashbackForm)
      setCashbackConfig(data)
      toast.success("Cashback salvo!")
      setShowCashbackForm(false)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Erro ao salvar")
    } finally {
      setCashbackSaving(false)
    }
  }

  async function redeemMilestone(id: string) {
    try {
      await api.post(`/loyalty-milestones/${id}/redeem`)
      setLoyaltyPending(prev => prev.filter(r => r.id !== id))
      toast.success("Prêmio marcado como entregue!")
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Erro ao confirmar entrega")
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
                  onClick={() => openShare(c)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-orange-200 text-orange-600 text-xs font-semibold hover:bg-orange-50 transition"
                  title="Copiar link / QR Code para compartilhar"
                >
                  <Link2 size={14} />
                  Link / QR
                </button>

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
        para o seu cardápio digital e o desconto é aplicado automaticamente no checkout. Use o botão
        "Link / QR" em cada campanha para compartilhar o mesmo cupom em redes sociais, WhatsApp ou cartaz impresso.
      </div>

      {/* ── Cliente Fiel — recompensa a cada N pedidos ─────────────────────── */}
      <div className="border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Award className="text-purple-600" size={20} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Cliente Fiel</h2>
              <p className="text-xs text-gray-500">
                {loyaltyConfig?.isActive
                  ? `Ativo — a cada ${loyaltyConfig.ordersThreshold} pedidos, o cliente ganha "${loyaltyConfig.rewardLabel}"`
                  : "Desativado — configure abaixo para ativar"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowLoyaltyForm(v => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold text-purple-700 border-purple-200 hover:bg-purple-50 transition"
          >
            {showLoyaltyForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Configurar
          </button>
        </div>

        {showLoyaltyForm && (
          <form onSubmit={saveLoyaltyConfig} className="bg-gray-50 border rounded-2xl p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">A cada quantos pedidos</label>
                <input
                  type="number" min={2} max={100} required
                  value={loyaltyForm.ordersThreshold}
                  onChange={e => setLoyaltyForm(f => ({ ...f, ordersThreshold: Number(e.target.value) }))}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Recompensa</label>
                <input
                  required maxLength={100}
                  value={loyaltyForm.rewardLabel}
                  onChange={e => setLoyaltyForm(f => ({ ...f, rewardLabel: e.target.value }))}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                  placeholder="Ex: 1 Pizza Clássica Grátis"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={loyaltyForm.isActive}
                onChange={e => setLoyaltyForm(f => ({ ...f, isActive: e.target.checked }))}
                className="rounded"
              />
              Programa ativo
            </label>
            <p className="text-xs text-gray-400">
              O sistema soma pedidos do cardápio próprio, PDV e mesa por telefone do cliente. Ao bater o marco,
              avisamos o cliente por WhatsApp (se configurado) e ele aparece na lista abaixo — a entrega do prêmio
              é sempre manual no balcão, o sistema não aplica desconto nem produto grátis sozinho no carrinho.
            </p>
            <div className="flex justify-end">
              <button type="submit" disabled={loyaltySaving}
                className="px-6 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
                {loyaltySaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        )}

        {loyaltyPending.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Prontos para resgatar ({loyaltyPending.length})</p>
            {loyaltyPending.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 border rounded-xl p-3 bg-purple-50/50">
                <div className="flex items-center gap-3 min-w-0">
                  <PartyPopper className="text-purple-500 shrink-0" size={18} />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">
                      {r.customerName || r.customerPhone}
                    </p>
                    <p className="text-xs text-gray-500">
                      Bateu {r.milestoneCount} pedidos · ganhou <strong>{r.rewardLabel}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => redeemMilestone(r.id)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition"
                >
                  <Gift size={14} /> Entregar prêmio
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-2">Nenhum cliente pronto para resgatar no momento.</p>
        )}
      </div>

      {/* ── Cashback — % por pedido, cliente escolhe acumular ou usar na hora ── */}
      <div className="border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <DollarSign className="text-emerald-600" size={20} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Cashback</h2>
              <p className="text-xs text-gray-500">
                {cashbackConfig?.isActive
                  ? `Ativo — ${cashbackConfig.ratePercent}% de volta em cada pedido`
                  : "Desativado — configure abaixo para ativar"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCashbackForm(v => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50 transition"
          >
            {showCashbackForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Configurar
          </button>
        </div>

        {showCashbackForm && (
          <form onSubmit={saveCashbackConfig} className="bg-gray-50 border rounded-2xl p-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Taxa de cashback (%)</label>
              <input
                type="number" min={0} max={20} step={0.1} required
                value={cashbackForm.ratePercent}
                onChange={e => setCashbackForm(f => ({ ...f, ratePercent: Number(e.target.value) }))}
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={cashbackForm.isActive}
                onChange={e => setCashbackForm(f => ({ ...f, isActive: e.target.checked }))}
                className="rounded"
              />
              Cashback ativo
            </label>
            <p className="text-xs text-gray-400">
              No checkout do cardápio digital, o cliente escolhe por pedido: guardar o cashback no saldo pra usar
              num pedido futuro, ou já usar como desconto neste mesmo pedido. Vale só pro cardápio digital (PDV/mesa
              não têm essa opção ainda). O saldo acumulado é o mesmo dos pontos de fidelidade.
            </p>
            <div className="flex justify-end">
              <button type="submit" disabled={cashbackSaving}
                className="px-6 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
                {cashbackSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Modal de compartilhamento */}
      {shareCampaign && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShareCampaign(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Compartilhar cupom</h3>
              <button onClick={() => setShareCampaign(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-500">{shareCampaign.name}</p>

            {shareLoading ? (
              <p className="text-sm text-gray-400 py-8 text-center">Gerando link...</p>
            ) : shareLink ? (
              <>
                <div className="flex justify-center py-2">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareLink)}`}
                    alt="QR Code da campanha"
                    className="rounded-xl border"
                    width={200}
                    height={200}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={shareLink}
                    className="flex-1 border rounded-xl px-3 py-2 text-xs text-gray-600 bg-gray-50"
                    onFocus={e => e.target.select()}
                  />
                  <button
                    onClick={copyLink}
                    className={`shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition
                      ${copied ? "bg-emerald-100 text-emerald-700" : "bg-orange-600 text-white hover:bg-orange-700"}`}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                </div>
                <a
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(shareLink)}`}
                  download={`qr-${shareCampaign.name.replace(/\s+/g, "-").toLowerCase()}.png`}
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  <Download size={14} /> Baixar QR Code (alta resolução)
                </a>
                <button
                  type="button"
                  onClick={printPoster}
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition"
                >
                  <Printer size={14} /> Imprimir Cupom (P&B, 80mm)
                </button>
                <p className="text-xs text-gray-400 text-center">
                  Esse link pode ser escaneado por várias pessoas — não expira no primeiro uso.
                  {shareCampaign.type === "RECUPERACAO_IFOOD" &&
                    " Grampeie o cupom na sacola/caixa das entregas do iFood/99Food enquanto a integração automática não está conectada."}
                </p>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
