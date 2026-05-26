"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import {
  DollarSign, TrendingUp, FileText, Settings, CheckCircle,
  AlertCircle, ArrowUpRight, ArrowDownRight, Calendar,
  CreditCard, Landmark, RefreshCw, Download, ChevronRight,
  Zap, BarChart2, Info, Building2, Clock, Wallet,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "mensalidade" | "extrato" | "relatorio" | "configuracoes";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Badge({ label, color }: { label: string; color: "green" | "red" | "yellow" | "blue" | "gray" }) {
  const cls = {
    green:  "bg-green-100 text-green-700",
    red:    "bg-red-100 text-red-700",
    yellow: "bg-amber-100 text-amber-700",
    blue:   "bg-blue-100 text-blue-700",
    gray:   "bg-gray-100 text-gray-600",
  }[color];
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

// ── Tab: Mensalidade ──────────────────────────────────────────────────────────

function TabMensalidade({ orders }: { orders: any[] }) {
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const RATE = 0.04;
  const BASE = 300;
  const THRESHOLD = 7500;
  const estimated = totalRevenue < THRESHOLD ? totalRevenue * RATE : BASE;
  const dueDay = 18;

  const history = [
    { n: 1, due: "18/05/2026", status: "Pendente", total: BASE, pending: Math.max(0, estimated - 0), color: "yellow" },
    { n: 2, due: "18/04/2026", status: "Pago",     total: BASE, pending: 0, color: "green" },
    { n: 3, due: "18/03/2026", status: "Pago",     total: 216,  pending: 0, color: "green" },
    { n: 4, due: "18/02/2026", status: "Pago",     total: BASE, pending: 0, color: "green" },
    { n: 5, due: "18/01/2026", status: "Pago",     total: 250,  pending: 0, color: "green" },
  ];

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6">
      {/* LEFT */}
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 font-medium">Plano de assinatura</span>
          <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-0.5 rounded-full">
            Vencimento todo dia {dueDay}
          </span>
        </div>

        {/* Plan box */}
        <div className="border border-blue-100 bg-blue-50/50 rounded-2xl p-5 space-y-3">
          <p className="font-bold text-blue-700">Pague só pelo que usar!</p>
          <ul className="text-sm text-blue-600 space-y-1">
            <li>· Mensalidade base: <strong>R$ {fmt(BASE)}/mês</strong></li>
            <li>· Mensalidade mínima: <strong>R$ 60,00/mês</strong></li>
          </ul>
          <p className="font-bold text-blue-700 mt-3">O que entra no faturamento?</p>
          <p className="text-sm text-blue-600">
            · Pedidos do sistema (menu online e cadastros manuais). Pedidos de iFood, 99 e outras plataformas não entram.
          </p>
          <p className="font-bold text-blue-700 mt-3">Como funciona?</p>
          <ul className="text-sm text-blue-600 space-y-1">
            <li>· Se o faturamento for <strong>menor de R$ {fmt(THRESHOLD)}/mês</strong>, você paga <strong>{(RATE * 100).toFixed(0)}% desse valor</strong>.</li>
            <li className="text-blue-500">· Exemplo: faturou R$ 3.000,00 — sua mensalidade será R$ 120,00/mês.</li>
            <li>· Se o faturamento <strong>passar de R$ {fmt(THRESHOLD)}/mês</strong>, você paga o valor fixo da mensalidade base (R$ {fmt(BASE)}/mês).</li>
          </ul>
          <p className="text-xs text-blue-500 mt-2 border-t border-blue-200 pt-2">
            A primeira mensalidade é cobrada apenas após o período de teste. A segunda cobrança acontece 30 dias após a ativação da assinatura e é descontada automaticamente do seu saldo de pagamentos online.
          </p>
        </div>

        {/* Pay button */}
        <button className="w-full bg-red-500 hover:bg-red-600 transition text-white py-3.5 rounded-xl font-bold text-sm">
          Pagar mensalidade em aberto
        </button>

        {/* History table */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={15} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-600">Histórico de mensalidades</span>
          </div>
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["#", "Vencimento", "Situação", "Total", "Pendente"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.n} className="border-t border-gray-100 hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-400">{row.n}</td>
                    <td className="px-4 py-3 text-gray-700">{row.due}</td>
                    <td className="px-4 py-3">
                      <Badge label={row.status} color={row.color as any} />
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800">R$ {fmt(row.total)}</td>
                    <td className="px-4 py-3 text-gray-500">R$ {fmt(row.pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="space-y-4">
        <div className="border border-gray-100 rounded-2xl p-5 shadow-sm bg-white">
          <p className="font-bold text-gray-800 mb-4">Você tem acesso completo ao FoodSaaS!</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {["PDV / Caixa", "Pedidos", "Cozinha", "Relatórios", "Estoque", "IA", "Suporte prioritário"].map((f) => (
              <span key={f} className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                <CheckCircle size={12} /> {f}
              </span>
            ))}
          </div>
          <button className="w-full border border-red-300 text-red-500 hover:bg-red-50 transition py-2.5 rounded-xl text-sm font-semibold">
            Cancelar assinatura
          </button>
        </div>

        <div className="border border-gray-100 rounded-2xl p-5 shadow-sm bg-white space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Faturamento base de maio</span>
            <span className="font-bold text-gray-800">R$ {fmt(totalRevenue)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Período</span>
            <span>01/05/2026 — 26/05/2026</span>
          </div>
          <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
            O faturamento base é o total de vendas desde o último vencimento, utilizado para calcular sua mensalidade. Inclui todos os pedidos, mesmo aqueles rejeitados ou não finalizados.
          </p>
          <div className="flex justify-between text-sm border-t pt-3">
            <span className="text-gray-500">Mensalidade estimada</span>
            <span className="font-bold text-gray-700">R$ {fmt(estimated)}</span>
          </div>
          <div className="flex justify-between text-base font-black border-t pt-3">
            <span className="text-gray-800">Valor final</span>
            <span className="text-primary">R$ {fmt(estimated)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Extrato ──────────────────────────────────────────────────────────────

function TabExtrato({ orders }: { orders: any[] }) {
  const grossRevenue = orders
    .filter((o) => o.status === "DELIVERED" || o.status === "COMPLETED")
    .reduce((s, o) => s + Number(o.total ?? 0), 0);

  const PIX_RATE = 0.005;
  const PIX_FIXED = 0.40;
  const pixOrders = orders.filter((o) => o.paymentMethod === "PIX");
  const taxPix = pixOrders.reduce((s, o) => s + Number(o.total ?? 0) * PIX_RATE + PIX_FIXED, 0);
  const subscriptionCost = 300;
  const netRevenue = grossRevenue - taxPix - subscriptionCost;

  const transactions = orders.slice(0, 15).map((o) => ({
    id: o.id,
    time: new Date(o.createdAt).toLocaleString("pt-BR"),
    description: `Pedido #${o.id.slice(-6).toUpperCase()}`,
    method: o.paymentMethod === "PIX" ? "PIX" : o.paymentMethod === "CREDIT_CARD" ? "Cartão de Crédito" : "Débito",
    status: o.status === "DELIVERED" ? "Liberado" : o.status === "CANCELLED" ? "Cancelado" : "Pendente",
    statusColor: o.status === "DELIVERED" ? "green" : o.status === "CANCELLED" ? "red" : "yellow",
    gross: Number(o.total ?? 0),
    fee: Number(o.total ?? 0) * PIX_RATE + PIX_FIXED,
    net: Number(o.total ?? 0) * (1 - PIX_RATE) - PIX_FIXED,
    releaseDate: new Date(o.createdAt).toLocaleString("pt-BR"),
  }));

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-6">
      {/* LEFT */}
      <div className="space-y-5">
        {/* Balance */}
        <div className="border border-gray-100 rounded-2xl p-6 shadow-sm bg-white">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Wallet size={16} /> Saldo Disponível
          </div>
          <p className={`text-4xl font-black mb-4 ${netRevenue >= 0 ? "text-gray-900" : "text-red-500"}`}>
            R$ {fmt(netRevenue)}
          </p>
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Info size={14} /> Saldo a Liberar
          </div>
          <p className="text-2xl font-bold text-gray-700 mt-1">R$ 0,00</p>
        </div>

        {/* Fee info */}
        <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
          {[
            { label: "Taxa do PIX", value: "0,5% do valor + R$ 0,40 Aplicada em pagamentos por PIX" },
            { label: "Taxa do crédito online", value: "3,99% do valor do pedido Aplicada em compras com cartão de crédito" },
            { label: "Taxa de adiantamento", value: "1,7% do valor do pedido Para recebimento antecipado de valores" },
            { label: "Taxa de transferência", value: "R$ 0,40 por repasse Aplicada em transferências bancárias" },
          ].map((f) => (
            <div key={f.label} className="border border-blue-100 bg-blue-50/50 rounded-xl p-3">
              <p className="font-bold text-blue-700 mb-1">{f.label}</p>
              <p className="text-blue-500">{f.value}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button className="flex items-center gap-2 border border-primary text-primary hover:bg-primary/5 transition px-4 py-2 rounded-xl text-sm font-semibold">
            <ArrowUpRight size={16} /> Ver último repasse
          </button>
          <button className="flex items-center gap-2 border border-primary text-primary hover:bg-primary/5 transition px-4 py-2 rounded-xl text-sm font-semibold">
            <Download size={16} /> Exportar transações
          </button>
        </div>

        {/* Transactions table */}
        <div className="border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Transações</span>
            <span className="text-xs text-gray-400">Atualizado em {new Date().toLocaleString("pt-BR")}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {["Horário", "Descrição", "Forma pag.", "Status", "Data lib.", "Valor bruto", "Taxa", "Valor líquido"].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">Nenhuma transação encontrada</td></tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50 transition">
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{t.time}</td>
                      <td className="px-3 py-2.5 text-gray-700 font-medium">{t.description}</td>
                      <td className="px-3 py-2.5 text-gray-500">{t.method}</td>
                      <td className="px-3 py-2.5">
                        <Badge label={t.status} color={t.statusColor as any} />
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{t.releaseDate}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-800">R$ {fmt(t.gross)}</td>
                      <td className="px-3 py-2.5 text-red-500">-R$ {fmt(t.fee)}</td>
                      <td className="px-3 py-2.5 font-bold text-green-600">R$ {fmt(t.net)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RIGHT: Resumo */}
      <div className="border border-gray-100 rounded-2xl p-5 shadow-sm bg-white h-fit">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={16} className="text-gray-400" />
          <span className="font-bold text-gray-800">Resumo Financeiro</span>
        </div>
        {[
          { label: "Receita Bruta", value: grossRevenue, positive: true },
          { label: "Taxas Operacionais", value: -taxPix, positive: false },
          { label: "Mensalidade", value: -subscriptionCost, positive: false },
          { label: "Reembolsos", value: 0, positive: false },
          { label: "Receita Líquida", value: netRevenue, positive: netRevenue >= 0, bold: true },
        ].map((row) => (
          <div key={row.label} className={`flex justify-between items-center py-2.5 ${row.bold ? "border-t border-gray-200 mt-2 pt-3" : "border-t border-gray-100 first:border-0"}`}>
            <span className={`text-sm ${row.bold ? "font-bold text-gray-800" : "text-gray-500"}`}>{row.label}</span>
            <span className={`text-sm font-bold ${row.bold ? (row.positive ? "text-green-600" : "text-red-500") : row.positive ? "text-green-600" : "text-red-500"}`}>
              {row.positive ? "+" : ""}R$ {fmt(row.value)}
            </span>
          </div>
        ))}
        <button className="w-full border border-primary text-primary hover:bg-primary/5 transition py-2.5 rounded-xl text-sm font-semibold mt-4">
          Ver demonstrativo completo
        </button>
      </div>
    </div>
  );
}

// ── Tab: Relatório ────────────────────────────────────────────────────────────

function TabRelatorio({ orders }: { orders: any[] }) {
  const [period, setPeriod] = useState("mes");

  const now = new Date();
  const periodStart = period === "mes"
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : period === "semana"
    ? new Date(now.getTime() - 7 * 86400000)
    : new Date(now.getTime() - 86400000);

  const filtered = orders.filter((o) => new Date(o.createdAt) >= periodStart);
  const delivered = filtered.filter((o) => o.status === "DELIVERED" || o.status === "COMPLETED");

  const grossRevenue = delivered.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const pixRevenue   = delivered.filter((o) => o.paymentMethod === "PIX").reduce((s, o) => s + Number(o.total ?? 0), 0);
  const cardRevenue  = delivered.filter((o) => o.paymentMethod === "CREDIT_CARD").reduce((s, o) => s + Number(o.total ?? 0), 0);
  const cashRevenue  = delivered.filter((o) => o.paymentMethod === "CASH").reduce((s, o) => s + Number(o.total ?? 0), 0);
  const totalDiscounts = 0;
  const netRevenue = grossRevenue - totalDiscounts;
  const taxPix = pixRevenue * 0.005 + delivered.filter((o) => o.paymentMethod === "PIX").length * 0.40;
  const taxCard = cardRevenue * 0.0399;

  // Weekly chart data
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now.getTime() - (6 - i) * 86400000);
    const dayStr = day.toLocaleDateString("pt-BR", { weekday: "short" });
    const dayTotal = orders
      .filter((o) => {
        const d = new Date(o.createdAt);
        return d.toDateString() === day.toDateString() &&
          (o.status === "DELIVERED" || o.status === "COMPLETED");
      })
      .reduce((s, o) => s + Number(o.total ?? 0), 0);
    return { day: dayStr, value: dayTotal };
  });

  const maxChart = Math.max(...chartData.map((d) => d.value), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-1">Faturamento Online</p>
          <p className="text-4xl font-black text-gray-900">R$ {fmt(grossRevenue)}</p>
        </div>
        <div className="flex gap-2">
          {[
            { key: "dia", label: "Hoje" },
            { key: "semana", label: "7 dias" },
            { key: "mes", label: "Este mês" },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${period === p.key ? "bg-primary text-white" : "border border-gray-200 text-gray-500 hover:border-primary hover:text-primary"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="border border-gray-100 rounded-2xl p-5 bg-white shadow-sm">
        <p className="text-sm font-bold text-gray-600 mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-primary" /> Demonstrativo de Receita (últimos 7 dias)
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barSize={32}>
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false}
              tickFormatter={(v) => `R$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`} />
            <Tooltip
              formatter={(v: number) => [`R$ ${fmt(v)}`, "Faturamento"]}
              contentStyle={{ borderRadius: 12, border: "1px solid #f3f4f6", fontSize: 12 }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.value === maxChart ? "var(--color-primary, #f97316)" : "#e5e7eb"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Progress bar */}
        <div className="mt-4 h-3 rounded-full bg-gray-100 overflow-hidden flex">
          {grossRevenue > 0 && (
            <>
              <div className="bg-red-400 h-full" style={{ width: `${(totalDiscounts / grossRevenue) * 100}%` }} />
              <div className="bg-green-500 h-full flex-1" />
            </>
          )}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Descontos Totais: R$ {fmt(totalDiscounts)}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Receita Bruta: R$ {fmt(grossRevenue)}</span>
        </div>
      </div>

      {/* Revenue breakdown */}
      <div className="border border-gray-100 rounded-2xl bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="font-bold text-gray-800">Receita Bruta</p>
          <p className="text-xs text-gray-400 mt-0.5">Valor total recebido em vendas (PIX e Crédito) antes dos descontos.</p>
        </div>
        {[
          { label: "PIX (Online)", value: pixRevenue },
          { label: "Cartão de Crédito (Online)", value: cardRevenue },
          { label: "Dinheiro", value: cashRevenue },
          { label: "Programa de Indicação", value: 0 },
          { label: "Reembolsos Recebidos", value: 0 },
        ].map((row) => (
          <div key={row.label} className="flex justify-between items-center px-5 py-3 border-b border-gray-50 hover:bg-gray-50 transition text-sm">
            <span className="text-primary font-medium">{row.label}</span>
            <span className="font-bold text-gray-800">R$ {fmt(row.value)}</span>
          </div>
        ))}
        <div className="flex justify-between items-center px-5 py-4 bg-gray-50 text-sm font-black">
          <span className="text-gray-700">Total</span>
          <span className="text-green-600">R$ {fmt(grossRevenue)}</span>
        </div>
      </div>

      {/* Operational fees */}
      <div className="border border-gray-100 rounded-2xl bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="font-bold text-gray-800">Taxas Operacionais</p>
          <p className="text-xs text-gray-400 mt-0.5">Taxas aplicadas sobre transações financeiras realizadas pela sua loja.</p>
        </div>
        {[
          { label: "Taxas PIX", value: -taxPix },
          { label: "Taxas Cartão", value: -taxCard },
          { label: "Taxas de Transferência", value: 0 },
        ].map((row) => (
          <div key={row.label} className="flex justify-between items-center px-5 py-3 border-b border-gray-50 hover:bg-gray-50 transition text-sm">
            <span className="text-gray-600">{row.label}</span>
            <span className="font-bold text-red-500">R$ {fmt(row.value)}</span>
          </div>
        ))}
        <div className="flex justify-between items-center px-5 py-4 bg-gray-50 text-sm font-black">
          <span className="text-gray-700">Receita Líquida</span>
          <span className={netRevenue - taxPix - taxCard >= 0 ? "text-green-600" : "text-red-500"}>
            R$ {fmt(netRevenue - taxPix - taxCard)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Configurações ────────────────────────────────────────────────────────

function TabConfiguracoes() {
  const [repasse, setRepasse] = useState({ frequency: "daily", hour: "3:00", bank: "", agency: "", account: "", cnpj: "" });
  const [creditRelease, setCreditRelease] = useState<"D0" | "D30">("D0");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    toast.success("Configurações salvas");
  }

  const D0_RATE = 3.99 + 1.7;
  const D30_RATE = 3.99;

  return (
    <div className="max-w-2xl space-y-8">

      {/* Bank account activation */}
      <section className="border border-gray-100 rounded-2xl p-6 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-bold text-gray-800 mb-1">Ativação da sua conta bancária</p>
            <p className="text-sm text-gray-400">Acompanhe o progresso da sua conta. Quando estiver tudo certo, você poderá receber seus repasses automaticamente!</p>
          </div>
          <Building2 size={32} className="text-primary shrink-0" />
        </div>
        <button className="mt-4 w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-bold text-sm transition">
          Ativar conta bancária
        </button>
        <div className="mt-4 border border-amber-200 bg-amber-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-600 font-bold text-sm mb-1">
            <AlertCircle size={15} /> Documentação pendente
          </div>
          <p className="text-xs text-amber-600">
            Envie seu CNPJ, contrato social e comprovante de endereço para ativar os repasses automáticos. Entre em contato com o suporte se precisar de ajuda.
          </p>
        </div>
      </section>

      {/* Conta de repasse */}
      <section className="border border-gray-100 rounded-2xl p-6 bg-white shadow-sm">
        <p className="font-bold text-gray-800 mb-1">Conta de Repasse</p>
        <p className="text-sm text-gray-400 mb-5">Configure a conta para recebimento do saldo disponível das vendas online da sua loja.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Banco</label>
            <input value={repasse.bank} onChange={(e) => setRepasse({ ...repasse, bank: e.target.value })}
              placeholder="Ex: Nubank, Itaú..."
              className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm outline-none text-gray-800" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Agência</label>
            <input value={repasse.agency} onChange={(e) => setRepasse({ ...repasse, agency: e.target.value })}
              placeholder="0001"
              className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm outline-none text-gray-800" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Conta</label>
            <input value={repasse.account} onChange={(e) => setRepasse({ ...repasse, account: e.target.value })}
              placeholder="12345-6"
              className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm outline-none text-gray-800" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">CNPJ / CPF</label>
            <input value={repasse.cnpj} onChange={(e) => setRepasse({ ...repasse, cnpj: e.target.value })}
              placeholder="00.000.000/0001-00"
              className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm outline-none text-gray-800" />
          </div>
        </div>
        <button className="mt-4 flex items-center gap-2 text-primary border border-primary/30 hover:bg-primary/5 transition px-4 py-2 rounded-xl text-sm font-semibold">
          <Zap size={14} /> + Adicionar conta
        </button>
      </section>

      {/* Repasse frequency */}
      <section className="border border-gray-100 rounded-2xl p-6 bg-white shadow-sm">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="font-bold text-gray-800 mb-1">Quando você quer receber seu repasse?</p>
            <p className="text-sm text-gray-400">Defina quantas vezes por semana você quer receber o saldo disponível da sua loja.</p>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-bold text-gray-600">Com qual frequência?</p>
            <div className="flex gap-4">
              {[{ key: "daily", label: "Todos os dias" }, { key: "weekly", label: "Uma vez por semana" }].map((opt) => (
                <label key={opt.key} className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                  <input type="radio" name="freq" checked={repasse.frequency === opt.key}
                    onChange={() => setRepasse({ ...repasse, frequency: opt.key })}
                    className="accent-primary" />
                  {opt.label}
                </label>
              ))}
            </div>
            <p className="text-sm font-bold text-gray-600">Que horas?</p>
            <select value={repasse.hour} onChange={(e) => setRepasse({ ...repasse, hour: e.target.value })}
              className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm outline-none text-gray-800">
              {["1:00", "2:00", "3:00", "6:00", "9:00", "12:00", "18:00", "21:00"].map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Credit release */}
      <section className="border border-gray-100 rounded-2xl p-6 bg-white shadow-sm">
        <p className="font-bold text-gray-800 mb-1">Liberação de vendas com Crédito Online</p>
        <p className="text-sm text-gray-400 mb-5">Escolha quando deseja que as vendas feitas com cartão de crédito sejam disponibilizadas no seu saldo para repasse.</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: "D0", title: "Liberação no mesmo dia (D+0)", rate: D0_RATE, example: "Ao vender R$ 100, você recebe hoje R$ 94,31" },
            { key: "D30", title: "Liberação em 30 dias (D+30)", rate: D30_RATE, example: "Ao vender R$ 100, você recebe daqui a 30 dias R$ 96,01" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setCreditRelease(opt.key as any)}
              className={`text-left p-4 rounded-2xl border-2 transition ${creditRelease === opt.key ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}
            >
              <div className="flex items-start gap-2">
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${creditRelease === opt.key ? "border-primary" : "border-gray-300"}`}>
                  {creditRelease === opt.key && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-800">{opt.title}</p>
                  <p className="text-xs text-gray-400 mt-1">{opt.example}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-4 border border-amber-100 bg-amber-50 rounded-xl p-3 text-xs text-amber-700">
          <strong>Taxa para repasse no mesmo dia (D+0):</strong> {D0_RATE.toFixed(2)}% &nbsp;|&nbsp;
          <strong>Taxa para repasse em 30 dias (D+30):</strong> {D30_RATE.toFixed(2)}%
          <p className="mt-1 text-amber-500">A taxa de adiantamento é cobrada no momento da liberação das vendas.</p>
        </div>
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-bold text-sm transition"
      >
        {saving ? "Salvando..." : "Salvar configurações"}
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "mensalidade",   label: "Mensalidade",   icon: <CreditCard size={15} /> },
  { key: "extrato",       label: "Extrato",        icon: <Landmark size={15} /> },
  { key: "relatorio",     label: "Relatório",      icon: <BarChart2 size={15} /> },
  { key: "configuracoes", label: "Configurações",  icon: <Settings size={15} /> },
];

export default function FinanceiroPage() {
  const [tab, setTab] = useState<Tab>("mensalidade");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/orders")
      .then((r) => setOrders(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-primary p-2.5 rounded-xl">
            <DollarSign size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Financeiro</h1>
            <p className="text-gray-400 text-sm">Mensalidade, extrato, relatórios e configurações bancárias</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition ${
                  tab === t.key
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={24} className="animate-spin text-primary" />
          </div>
        ) : (
          <>
            {tab === "mensalidade"   && <TabMensalidade orders={orders} />}
            {tab === "extrato"       && <TabExtrato orders={orders} />}
            {tab === "relatorio"     && <TabRelatorio orders={orders} />}
            {tab === "configuracoes" && <TabConfiguracoes />}
          </>
        )}
      </div>
    </main>
  );
}
