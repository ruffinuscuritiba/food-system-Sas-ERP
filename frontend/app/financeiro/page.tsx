"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import { useAuthStore } from "@/stores/auth.store";
import {
  DollarSign, TrendingUp, TrendingDown, FileText, Settings,
  CheckCircle, AlertCircle, ArrowUpRight, ArrowDownRight,
  Calendar, CreditCard, Landmark, RefreshCw, Download,
  ChevronRight, Zap, BarChart2, Info, Building2, Clock,
  Wallet, Plus, X, Filter, Search, Package, Lock, EyeOff,
  Unlock, ShieldCheck, Printer,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "mensalidade" | "extrato" | "caixa" | "relatorio" | "configuracoes";

interface FinancialRecord {
  id: string;
  type: "INCOME" | "EXPENSE";
  category: string;
  description?: string;
  amount: number;
  paymentMethod?: string;
  createdAt: string;
}

interface FinancialSummary {
  entries: number;
  exits: number;
  balance: number;
  totalSales: number;
  totalOrders: number;
  ticketAverage: number;
}

interface CashStatus {
  id?: string;
  openingValue?: number;
  balance?: number;
  entries?: number;
  exits?: number;
  isOpen?: boolean;
  createdAt?: string;
  declaredValue?: number | null;
  systemValue?: number | null;
  difference?: number | null;
  closedByName?: string | null;
  closedAt?: string | null;
}

interface Order {
  id: string;
  total: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  orderType?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Badge({
  label,
  color,
}: {
  label: string;
  color: "green" | "red" | "yellow" | "blue" | "gray";
}) {
  const cls = {
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    yellow: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    gray: "bg-gray-100 text-gray-600",
  }[color];
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  );
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartão de Crédito",
  DEBIT_CARD: "Cartão de Débito",
  TRANSFER: "Transferência",
};

const INCOME_CATEGORIES = [
  "Vendas",
  "Serviços",
  "Outros ingressos",
  "Reembolso recebido",
  "Investimento",
];

const EXPENSE_CATEGORIES = [
  "Fornecedores",
  "Aluguel",
  "Salários",
  "Energia / Água / Gás",
  "Marketing",
  "Manutenção",
  "Equipamentos",
  "Mensalidade sistema",
  "Taxas bancárias",
  "Outros custos",
];

// ── Modal: Nova Transação ─────────────────────────────────────────────────────

interface NovaTransacaoModalProps {
  onClose: () => void;
  onSaved: () => void;
}

function NovaTransacaoModal({ onClose, onSaved }: NovaTransacaoModalProps) {
  const [form, setForm] = useState({
    type: "INCOME" as "INCOME" | "EXPENSE",
    category: "",
    description: "",
    amount: "",
    paymentMethod: "",
  });
  const [saving, setSaving] = useState(false);

  const categories = form.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  async function save() {
    if (!form.category || !form.amount || isNaN(Number(form.amount))) {
      toast.error("Preencha categoria e valor");
      return;
    }
    setSaving(true);
    try {
      await api.post("/financial", {
        type: form.type,
        category: form.category,
        description: form.description || undefined,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod || undefined,
      });
      toast.success("Transação registrada com sucesso!");
      onSaved();
      onClose();
    } catch {
      toast.error("Erro ao salvar transação");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Nova Transação</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Type toggle */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {(["INCOME", "EXPENSE"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, type: t, category: "" })}
                  className={`py-2.5 rounded-xl text-sm font-bold transition border-2 flex items-center justify-center gap-2 ${
                    form.type === t
                      ? t === "INCOME"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-red-400 bg-red-50 text-red-600"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {t === "INCOME" ? (
                    <><ArrowUpRight size={15} /> Receita</>
                  ) : (
                    <><ArrowDownRight size={15} /> Despesa</>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
              Categoria <span className="text-red-400">*</span>
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm outline-none text-gray-800"
            >
              <option value="">Selecione...</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
              Descrição (opcional)
            </label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex: Compra de insumos..."
              className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm outline-none text-gray-800"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
              Valor (R$) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0,00"
              className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm outline-none text-gray-800"
            />
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
              Forma de pagamento (opcional)
            </label>
            <select
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm outline-none text-gray-800"
            >
              <option value="">Nenhuma</option>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 py-2.5 rounded-xl text-sm font-semibold transition"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
              form.type === "INCOME"
                ? "bg-green-500 hover:bg-green-600 text-white"
                : "bg-red-500 hover:bg-red-600 text-white"
            } disabled:opacity-50`}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Mensalidade ──────────────────────────────────────────────────────────

function TabMensalidade({ summary }: { summary: FinancialSummary | null }) {
  const totalRevenue = summary?.totalSales ?? 0;
  const RATE = 0.04;
  const BASE = 300;
  const MIN = 60;
  const THRESHOLD = 7500;
  const estimated = Math.max(MIN, totalRevenue < THRESHOLD ? totalRevenue * RATE : BASE);
  const dueDay = 18;

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

        {/* Plan info */}
        <div className="border border-blue-100 bg-blue-50/50 rounded-2xl p-5 space-y-3">
          <p className="font-bold text-blue-700">Pague só pelo que usar!</p>
          <ul className="text-sm text-blue-600 space-y-1">
            <li>· Mensalidade base: <strong>R$ {fmt(BASE)}/mês</strong></li>
            <li>· Mensalidade mínima: <strong>R$ {fmt(MIN)}/mês</strong></li>
          </ul>
          <p className="font-bold text-blue-700 mt-3">Como funciona?</p>
          <ul className="text-sm text-blue-600 space-y-1">
            <li>
              · Se o faturamento for{" "}
              <strong>menor de R$ {fmt(THRESHOLD)}/mês</strong>, você paga{" "}
              <strong>{(RATE * 100).toFixed(0)}% desse valor</strong>.
            </li>
            <li className="text-blue-500">
              · Exemplo: faturou R$ 3.000,00 — sua mensalidade será R$ 120,00/mês.
            </li>
            <li>
              · Se o faturamento{" "}
              <strong>passar de R$ {fmt(THRESHOLD)}/mês</strong>, você paga o valor
              fixo de R$ {fmt(BASE)}/mês.
            </li>
          </ul>
          <p className="text-xs text-blue-500 mt-2 border-t border-blue-200 pt-2">
            A primeira mensalidade é cobrada apenas após o período de teste. A segunda
            cobrança acontece 30 dias após a ativação e é descontada automaticamente do
            saldo de pagamentos online.
          </p>
        </div>

        {/* Pay button */}
        <button
          onClick={() =>
            toast("Entre em contato com o suporte para realizar o pagamento.", {
              icon: "💳",
            })
          }
          className="w-full bg-red-500 hover:bg-red-600 transition text-white py-3.5 rounded-xl font-bold text-sm"
        >
          Pagar mensalidade em aberto
        </button>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Faturamento total",
              value: `R$ ${fmt(totalRevenue)}`,
              icon: <TrendingUp size={16} className="text-green-500" />,
            },
            {
              label: "Total de pedidos",
              value: String(summary?.totalOrders ?? 0),
              icon: <Package size={16} className="text-blue-500" />,
            },
            {
              label: "Ticket médio",
              value: `R$ ${fmt(summary?.ticketAverage ?? 0)}`,
              icon: <BarChart2 size={16} className="text-primary" />,
            },
          ].map((k) => (
            <div
              key={k.label}
              className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm"
            >
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                {k.icon}
                <span>{k.label}</span>
              </div>
              <p className="font-black text-gray-900">{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT */}
      <div className="space-y-4">
        <div className="border border-gray-100 rounded-2xl p-5 shadow-sm bg-white">
          <p className="font-bold text-gray-800 mb-4">Você tem acesso completo ao FoodSaaS!</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {[
              "PDV / Caixa",
              "Pedidos",
              "Cozinha",
              "Relatórios",
              "Estoque",
              "IA",
              "Suporte prioritário",
            ].map((f) => (
              <span
                key={f}
                className="flex items-center gap-1 text-xs text-green-600 font-semibold"
              >
                <CheckCircle size={12} /> {f}
              </span>
            ))}
          </div>
          <button
            onClick={() => {
              if (!confirm("Tem certeza que deseja cancelar a assinatura?")) return;
              toast.error("Entre em contato com o suporte para cancelar.");
            }}
            className="w-full border border-red-300 text-red-500 hover:bg-red-50 transition py-2.5 rounded-xl text-sm font-semibold"
          >
            Cancelar assinatura
          </button>
        </div>

        <div className="border border-gray-100 rounded-2xl p-5 shadow-sm bg-white space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Faturamento base do período</span>
            <span className="font-bold text-gray-800">R$ {fmt(totalRevenue)}</span>
          </div>
          <div className="flex justify-between text-sm border-t pt-3">
            <span className="text-gray-500">Mensalidade estimada</span>
            <span className="font-bold text-gray-700">R$ {fmt(estimated)}</span>
          </div>
          <div className="flex justify-between text-base font-black border-t pt-3">
            <span className="text-gray-800">Valor final</span>
            <span className="text-primary">R$ {fmt(estimated)}</span>
          </div>
          <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
            Calculado sobre o faturamento total de pedidos registrados no sistema.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Extrato ──────────────────────────────────────────────────────────────

interface TabExtratoProps {
  records: FinancialRecord[];
  summary: FinancialSummary | null;
  cash: CashStatus | null;
  onAdd: () => void;
  onRefresh: () => void;
}

function TabExtrato({ records, summary, cash, onAdd, onRefresh }: TabExtratoProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");

  const filtered = records.filter((r) => {
    if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.category.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  function exportCSV() {
    const header = ["Data", "Tipo", "Categoria", "Descrição", "Forma Pagto", "Valor"];
    const rows = filtered.map((r) => [
      new Date(r.createdAt).toLocaleString("pt-BR"),
      r.type === "INCOME" ? "Receita" : "Despesa",
      r.category,
      r.description ?? "",
      r.paymentMethod ? (PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod) : "",
      r.type === "INCOME" ? `+R$${fmt(r.amount)}` : `-R$${fmt(r.amount)}`,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extrato_financeiro_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Extrato exportado!");
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Receitas",
            value: summary?.entries ?? 0,
            color: "text-green-600",
            bg: "bg-green-50",
            icon: <ArrowUpRight size={18} className="text-green-600" />,
          },
          {
            label: "Despesas",
            value: summary?.exits ?? 0,
            color: "text-red-500",
            bg: "bg-red-50",
            icon: <ArrowDownRight size={18} className="text-red-500" />,
          },
          {
            label: "Saldo",
            value: summary?.balance ?? 0,
            color: (summary?.balance ?? 0) >= 0 ? "text-gray-900" : "text-red-500",
            bg: "bg-gray-50",
            icon: <Wallet size={18} className="text-gray-500" />,
          },
          {
            label: "Caixa atual",
            value: cash?.balance ?? 0,
            color: cash?.isOpen ? "text-blue-600" : "text-gray-400",
            bg: "bg-blue-50",
            icon: cash?.isOpen ? (
              <CheckCircle size={18} className="text-blue-500" />
            ) : (
              <AlertCircle size={18} className="text-gray-400" />
            ),
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`${card.bg} border border-gray-100 rounded-2xl p-4`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium">{card.label}</span>
              {card.icon}
            </div>
            <p className={`text-xl font-black ${card.color}`}>
              R$ {fmt(Number(card.value))}
            </p>
            {card.label === "Caixa atual" && (
              <p className="text-xs mt-1 text-gray-400">
                {cash?.isOpen ? "Caixa aberto" : "Caixa fechado"}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[180px] relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por categoria ou descrição..."
            className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-1 border border-gray-200 rounded-xl p-1">
          {(["ALL", "INCOME", "EXPENSE"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                typeFilter === f
                  ? f === "INCOME"
                    ? "bg-green-100 text-green-700"
                    : f === "EXPENSE"
                    ? "bg-red-100 text-red-600"
                    : "bg-gray-200 text-gray-700"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {f === "ALL" ? "Todas" : f === "INCOME" ? "Receitas" : "Despesas"}
            </button>
          ))}
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-bold transition"
        >
          <Plus size={15} /> Nova Transação
        </button>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-xl text-sm font-semibold transition"
        >
          <Download size={15} /> Exportar CSV
        </button>
        <button
          onClick={onRefresh}
          className="border border-gray-200 text-gray-500 hover:bg-gray-50 p-2 rounded-xl transition"
          title="Atualizar"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Transactions table */}
      <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            Transações ({filtered.length})
          </span>
          <span className="text-xs text-gray-400">
            Atualizado em {new Date().toLocaleString("pt-BR")}
          </span>
        </div>
        <div className="overflow-x-auto touch-pan-x">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {["Data", "Tipo", "Categoria", "Descrição", "Forma pagto.", "Valor"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    <Wallet size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="font-semibold">Nenhuma transação encontrada</p>
                    <p className="text-xs mt-1">
                      Clique em &quot;Nova Transação&quot; para registrar uma receita ou despesa.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-gray-100 hover:bg-gray-50 transition"
                  >
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {new Date(r.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={r.type === "INCOME" ? "Receita" : "Despesa"}
                        color={r.type === "INCOME" ? "green" : "red"}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium">{r.category}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {r.description || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {r.paymentMethod
                        ? (PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod)
                        : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 font-bold whitespace-nowrap ${
                        r.type === "INCOME" ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {r.type === "INCOME" ? "+" : "-"}R$ {fmt(Number(r.amount))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Relatório ────────────────────────────────────────────────────────────

function TabRelatorio({
  orders,
  summary,
}: {
  orders: Order[];
  summary: FinancialSummary | null;
}) {
  const [period, setPeriod] = useState<"dia" | "semana" | "mes">("mes");

  const now = new Date();
  const periodStart =
    period === "mes"
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : period === "semana"
      ? new Date(now.getTime() - 7 * 86400000)
      : new Date(now.getTime() - 86400000);

  const filtered = orders.filter((o) => new Date(o.createdAt) >= periodStart);
  const delivered = filtered.filter(
    (o) => o.status === "DELIVERED" || o.status === "COMPLETED"
  );

  const grossRevenue = delivered.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const pixRevenue = delivered
    .filter((o) => o.paymentMethod === "PIX")
    .reduce((s, o) => s + Number(o.total ?? 0), 0);
  const cardRevenue = delivered
    .filter((o) => o.paymentMethod === "CREDIT_CARD")
    .reduce((s, o) => s + Number(o.total ?? 0), 0);
  const debitRevenue = delivered
    .filter((o) => o.paymentMethod === "DEBIT_CARD")
    .reduce((s, o) => s + Number(o.total ?? 0), 0);
  const cashRevenue = delivered
    .filter((o) => o.paymentMethod === "CASH")
    .reduce((s, o) => s + Number(o.total ?? 0), 0);
  const transferRevenue = delivered
    .filter((o) => o.paymentMethod === "TRANSFER")
    .reduce((s, o) => s + Number(o.total ?? 0), 0);

  const taxPix =
    pixRevenue * 0.005 +
    delivered.filter((o) => o.paymentMethod === "PIX").length * 0.4;
  const taxCard = cardRevenue * 0.0399;
  const totalExpenses = summary?.exits ?? 0;
  const netRevenue = grossRevenue - taxPix - taxCard - totalExpenses;

  // Weekly chart
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now.getTime() - (6 - i) * 86400000);
    const dayStr = day.toLocaleDateString("pt-BR", { weekday: "short" });
    const dayTotal = orders
      .filter((o) => {
        const d = new Date(o.createdAt);
        return (
          d.toDateString() === day.toDateString() &&
          (o.status === "DELIVERED" || o.status === "COMPLETED")
        );
      })
      .reduce((s, o) => s + Number(o.total ?? 0), 0);
    return { day: dayStr, value: dayTotal };
  });

  const maxChart = Math.max(...chartData.map((d) => d.value), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-1">
            Faturamento Online
          </p>
          <p className="text-4xl font-black text-gray-900">R$ {fmt(grossRevenue)}</p>
          <p className="text-sm text-gray-400 mt-1">
            {delivered.length} pedidos entregues
          </p>
        </div>
        <div className="flex gap-2">
          {(
            [
              { key: "dia", label: "Hoje" },
              { key: "semana", label: "7 dias" },
              { key: "mes", label: "Este mês" },
            ] as const
          ).map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                period === p.key
                  ? "bg-primary text-white"
                  : "border border-gray-200 text-gray-500 hover:border-primary hover:text-primary"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Receitas manuais",
            value: summary?.entries ?? 0,
            color: "text-green-600",
          },
          {
            label: "Despesas registradas",
            value: summary?.exits ?? 0,
            color: "text-red-500",
          },
          {
            label: "Saldo financeiro",
            value: summary?.balance ?? 0,
            color: (summary?.balance ?? 0) >= 0 ? "text-gray-900" : "text-red-500",
          },
          {
            label: "Ticket médio",
            value: summary?.ticketAverage ?? 0,
            color: "text-primary",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="border border-gray-100 bg-white rounded-2xl p-4 shadow-sm"
          >
            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
            <p className={`font-black text-lg ${k.color}`}>R$ {fmt(Number(k.value))}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="border border-gray-100 rounded-2xl p-5 bg-white shadow-sm">
        <p className="text-sm font-bold text-gray-600 mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-primary" /> Demonstrativo (últimos 7 dias)
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barSize={32}>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                `R$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`
              }
            />
            <Tooltip
              formatter={(v: number) => [`R$ ${fmt(v)}`, "Faturamento"]}
              contentStyle={{ borderRadius: 12, border: "1px solid #f3f4f6", fontSize: 12 }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry.value === maxChart
                      ? "var(--color-primary, #f97316)"
                      : "#e5e7eb"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue breakdown */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Receita por método */}
        <div className="border border-gray-100 rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="font-bold text-gray-800">Receita por forma de pagamento</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Pedidos entregues no período selecionado.
            </p>
          </div>
          {[
            { label: "PIX", value: pixRevenue },
            { label: "Cartão de Crédito", value: cardRevenue },
            { label: "Cartão de Débito", value: debitRevenue },
            { label: "Dinheiro", value: cashRevenue },
            { label: "Transferência", value: transferRevenue },
          ].map((row) => (
            <div
              key={row.label}
              className="flex justify-between items-center px-5 py-3 border-b border-gray-50 hover:bg-gray-50 transition text-sm"
            >
              <span className="text-primary font-medium">{row.label}</span>
              <span className="font-bold text-gray-800">R$ {fmt(row.value)}</span>
            </div>
          ))}
          <div className="flex justify-between items-center px-5 py-4 bg-gray-50 text-sm font-black">
            <span className="text-gray-700">Total</span>
            <span className="text-green-600">R$ {fmt(grossRevenue)}</span>
          </div>
        </div>

        {/* Deduções e resultado */}
        <div className="border border-gray-100 rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="font-bold text-gray-800">Resultado financeiro</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Deduções sobre a receita bruta de vendas.
            </p>
          </div>
          {[
            { label: "Receita Bruta", value: grossRevenue, positive: true },
            { label: "Taxas PIX", value: -taxPix, positive: false },
            { label: "Taxas Cartão", value: -taxCard, positive: false },
            { label: "Despesas registradas", value: -totalExpenses, positive: false },
          ].map((row) => (
            <div
              key={row.label}
              className="flex justify-between items-center px-5 py-3 border-b border-gray-50 hover:bg-gray-50 transition text-sm"
            >
              <span className="text-gray-600">{row.label}</span>
              <span
                className={`font-bold ${row.positive ? "text-green-600" : "text-red-500"}`}
              >
                {row.positive ? "+" : ""}R$ {fmt(Math.abs(row.value))}
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center px-5 py-4 bg-gray-50 text-sm font-black border-t border-gray-100">
            <span className="text-gray-800">Resultado Líquido</span>
            <span className={netRevenue >= 0 ? "text-green-600" : "text-red-500"}>
              R$ {fmt(netRevenue)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Configurações ────────────────────────────────────────────────────────

function TabConfiguracoes() {
  const [repasse, setRepasse] = useState({
    frequency: "daily",
    hour: "3:00",
    bank: "",
    agency: "",
    account: "",
    cnpj: "",
  });
  const [creditRelease, setCreditRelease] = useState<"D0" | "D30">("D0");
  const [saving, setSaving] = useState(false);

  const D0_RATE = 3.99 + 1.7;
  const D30_RATE = 3.99;

  async function save() {
    setSaving(true);
    try {
      // Bank settings are informational only for now (no dedicated endpoint).
      // Persisting locally via localStorage as a UX improvement.
      localStorage.setItem(
        "financeiro_repasse",
        JSON.stringify({ ...repasse, creditRelease })
      );
      await new Promise((r) => setTimeout(r, 400));
      toast.success("Configurações salvas localmente");
    } finally {
      setSaving(false);
    }
  }

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("financeiro_repasse");
      if (saved) {
        const p = JSON.parse(saved);
        setRepasse({
          frequency: p.frequency ?? "daily",
          hour: p.hour ?? "3:00",
          bank: p.bank ?? "",
          agency: p.agency ?? "",
          account: p.account ?? "",
          cnpj: p.cnpj ?? "",
        });
        setCreditRelease(p.creditRelease ?? "D0");
      }
    } catch {}
  }, []);

  return (
    <div className="max-w-2xl space-y-8">
      {/* Bank account activation */}
      <section className="border border-gray-100 rounded-2xl p-6 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-bold text-gray-800 mb-1">Ativação da sua conta bancária</p>
            <p className="text-sm text-gray-400">
              Quando estiver tudo configurado, você poderá receber seus repasses
              automaticamente!
            </p>
          </div>
          <Building2 size={32} className="text-primary shrink-0" />
        </div>
        <button
          onClick={() => toast("Entre em contato com o suporte para ativar sua conta bancária.", { icon: "🏦" })}
          className="mt-4 w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-bold text-sm transition"
        >
          Ativar conta bancária
        </button>
        <div className="mt-4 border border-amber-200 bg-amber-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-600 font-bold text-sm mb-1">
            <AlertCircle size={15} /> Documentação pendente
          </div>
          <p className="text-xs text-amber-600">
            Envie seu CNPJ, contrato social e comprovante de endereço para ativar os
            repasses automáticos. Entre em contato com o suporte se precisar de ajuda.
          </p>
        </div>
      </section>

      {/* Conta de repasse */}
      <section className="border border-gray-100 rounded-2xl p-6 bg-white shadow-sm">
        <p className="font-bold text-gray-800 mb-1">Conta de Repasse</p>
        <p className="text-sm text-gray-400 mb-5">
          Configure a conta para recebimento do saldo disponível das vendas online.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
              Banco
            </label>
            <input
              value={repasse.bank}
              onChange={(e) => setRepasse({ ...repasse, bank: e.target.value })}
              placeholder="Ex: Nubank, Itaú..."
              className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm outline-none text-gray-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
              Agência
            </label>
            <input
              value={repasse.agency}
              onChange={(e) => setRepasse({ ...repasse, agency: e.target.value })}
              placeholder="0001"
              className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm outline-none text-gray-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
              Conta
            </label>
            <input
              value={repasse.account}
              onChange={(e) => setRepasse({ ...repasse, account: e.target.value })}
              placeholder="12345-6"
              className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm outline-none text-gray-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
              CNPJ / CPF
            </label>
            <input
              value={repasse.cnpj}
              onChange={(e) => setRepasse({ ...repasse, cnpj: e.target.value })}
              placeholder="00.000.000/0001-00"
              className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm outline-none text-gray-800"
            />
          </div>
        </div>
      </section>

      {/* Repasse frequency */}
      <section className="border border-gray-100 rounded-2xl p-6 bg-white shadow-sm">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="font-bold text-gray-800 mb-1">Frequência de repasse</p>
            <p className="text-sm text-gray-400">
              Defina quantas vezes por semana você quer receber o saldo disponível.
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-bold text-gray-600">Com qual frequência?</p>
            <div className="flex gap-4">
              {[
                { key: "daily", label: "Todos os dias" },
                { key: "weekly", label: "Uma vez por semana" },
              ].map((opt) => (
                <label
                  key={opt.key}
                  className="flex items-center gap-2 cursor-pointer text-sm text-gray-600"
                >
                  <input
                    type="radio"
                    name="freq"
                    checked={repasse.frequency === opt.key}
                    onChange={() => setRepasse({ ...repasse, frequency: opt.key })}
                    className="accent-primary"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <p className="text-sm font-bold text-gray-600">Que horas?</p>
            <select
              value={repasse.hour}
              onChange={(e) => setRepasse({ ...repasse, hour: e.target.value })}
              className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm outline-none text-gray-800"
            >
              {["1:00", "2:00", "3:00", "6:00", "9:00", "12:00", "18:00", "21:00"].map(
                (h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </section>

      {/* Credit release */}
      <section className="border border-gray-100 rounded-2xl p-6 bg-white shadow-sm">
        <p className="font-bold text-gray-800 mb-1">
          Liberação de vendas com Crédito Online
        </p>
        <p className="text-sm text-gray-400 mb-5">
          Escolha quando deseja que as vendas feitas com cartão de crédito sejam
          disponibilizadas no seu saldo.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              key: "D0",
              title: "Mesmo dia (D+0)",
              rate: D0_RATE,
              example: "Ao vender R$ 100, você recebe hoje R$ 94,31",
            },
            {
              key: "D30",
              title: "Em 30 dias (D+30)",
              rate: D30_RATE,
              example: "Ao vender R$ 100, você recebe em 30 dias R$ 96,01",
            },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setCreditRelease(opt.key as "D0" | "D30")}
              className={`text-left p-4 rounded-2xl border-2 transition ${
                creditRelease === opt.key
                  ? "border-primary bg-primary/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-start gap-2">
                <div
                  className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                    creditRelease === opt.key ? "border-primary" : "border-gray-300"
                  }`}
                >
                  {creditRelease === opt.key && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
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
          <strong>Taxa D+0:</strong> {D0_RATE.toFixed(2)}% &nbsp;|&nbsp;
          <strong>Taxa D+30:</strong> {D30_RATE.toFixed(2)}%
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

// ── Tab: Caixa (Fechamento às Cegas) ──────────────────────────────────────────

function TabCaixa({ cash, onRefresh }: { cash: CashStatus | null; onRefresh: () => void }) {
  const isManager = useAuthStore((s) => s.isAdmin());
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [openingValue, setOpeningValue] = useState("");
  const [declaredValue, setDeclaredValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastClose, setLastClose] = useState<CashStatus | null>(null);
  const [history, setHistory] = useState<CashStatus[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!isManager) return;
    setLoadingHistory(true);
    try {
      const res = await api.get("/cash/history");
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch {
      // silencioso — histórico é conveniência, não bloqueia a operação
    } finally {
      setLoadingHistory(false);
    }
  }, [isManager]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function openCash() {
    const value = Number(openingValue);
    if (isNaN(value) || value < 0) { toast.error("Valor inválido"); return; }
    setSaving(true);
    try {
      await api.post("/cash/open", { openingValue: value });
      toast.success("Caixa aberto!");
      setShowOpenModal(false);
      setOpeningValue("");
      onRefresh();
    } catch {
      toast.error("Erro ao abrir caixa");
    } finally {
      setSaving(false);
    }
  }

  async function closeCash() {
    const value = Number(declaredValue);
    if (isNaN(value) || value < 0) { toast.error("Informe o valor contado"); return; }
    setSaving(true);
    try {
      const res = await api.patch("/cash/close", { declaredValue: value });
      setLastClose(res.data ?? null);
      setShowCloseModal(false);
      setDeclaredValue("");
      toast.success(
        isManager ? "Caixa fechado — conferência abaixo." : "Caixa fechado! Aguarde a conferência do gestor.",
      );
      onRefresh();
      loadHistory();
    } catch {
      toast.error("Erro ao fechar caixa");
    } finally {
      setSaving(false);
    }
  }

  async function printAuditSummary(cashId?: string) {
    if (!cashId) return;
    try {
      const res = await api.get(`/cash/${cashId}/audit-summary`);
      const data = res.data;
      if (!data) { toast.error("Sessão de caixa não encontrada"); return; }
      const rows = (data.byPaymentMethod as { paymentMethod: string; total: number; count: number }[])
        .map((r) => `
          <div class="line" style="display:flex;justify-content:space-between;">
            <span>${PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod} (${r.count})</span>
            <span class="bold">R$ ${fmt(r.total)}</span>
          </div>`)
        .join("");
      const html = `
        <html><head><meta charset="utf-8" /><style>
          @page { margin: 4mm; size: 80mm auto; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 13px; width: 72mm; padding: 4mm 0; color: #111; }
          h1 { font-size: 15px; text-align: center; margin-bottom: 4px; }
          hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
          .center { text-align: center; } .bold { font-weight: bold; } .line { margin-bottom: 6px; }
          .small { font-size: 11px; color: #555; } .total-line { font-size: 15px; font-weight: bold; }
        </style></head><body>
          <h1>🧾 Cupom de Auditoria</h1>
          <p class="center small">Resumo de cartão / PIX / transferência</p>
          <hr/>
          <p class="small">Aberto em: ${new Date(data.openedAt).toLocaleString("pt-BR")}</p>
          ${data.closedAt ? `<p class="small">Fechado em: ${new Date(data.closedAt).toLocaleString("pt-BR")}</p>` : `<p class="small">Caixa ainda aberto</p>`}
          <hr/>
          ${rows || `<p class="small center">Nenhuma venda não-dinheiro nesta sessão.</p>`}
          <hr/>
          <div class="line total-line" style="display:flex;justify-content:space-between;">
            <span>TOTAL NÃO-DINHEIRO</span><span>R$ ${fmt(data.grandTotal)}</span>
          </div>
          <p class="small center" style="margin-top:8px;">Não inclui vendas em dinheiro — já contadas na gaveta.</p>
        </body></html>`;
      const w = window.open("", "_blank", "width=420,height=700");
      if (!w) { toast.error("Popup bloqueado — permita popups para imprimir"); return; }
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    } catch {
      toast.error("Erro ao gerar cupom de auditoria");
    }
  }

  function diffBadge(diff: number | null | undefined) {
    if (diff === null || diff === undefined) return <Badge label="—" color="gray" />;
    const rounded = Number(diff.toFixed(2));
    if (rounded === 0) return <Badge label="Bateu certo" color="green" />;
    if (rounded < 0) return <Badge label={`Falta R$ ${fmt(Math.abs(rounded))}`} color="red" />;
    return <Badge label={`Sobra R$ ${fmt(rounded)}`} color="yellow" />;
  }

  return (
    <div className="space-y-5">
      {/* Status atual */}
      <div className="border border-gray-100 rounded-2xl bg-white shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${cash?.isOpen ? "bg-blue-50" : "bg-gray-100"}`}>
              {cash?.isOpen ? <Unlock size={18} className="text-blue-600" /> : <Lock size={18} className="text-gray-400" />}
            </div>
            <div>
              <p className="font-bold text-gray-900">{cash?.isOpen ? "Caixa aberto" : "Caixa fechado"}</p>
              {cash?.isOpen && cash?.createdAt && (
                <p className="text-xs text-gray-400">
                  Aberto em {new Date(cash.createdAt).toLocaleString("pt-BR")} · valor inicial R$ {fmt(Number(cash.openingValue ?? 0))}
                </p>
              )}
            </div>
          </div>
          {cash?.isOpen ? (
            <div className="flex items-center gap-2">
              {isManager && (
                <button
                  onClick={() => printAuditSummary(cash?.id)}
                  className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2.5 rounded-xl text-sm font-semibold transition"
                  title="Imprimir resumo de cartão/PIX desta sessão"
                >
                  <Printer size={15} /> Cupom de Auditoria
                </button>
              )}
              <button
                onClick={() => setShowCloseModal(true)}
                className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-2.5 rounded-xl text-sm font-bold transition"
              >
                <Lock size={15} /> Fechar Caixa
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowOpenModal(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition"
            >
              <Unlock size={15} /> Abrir Caixa
            </button>
          )}
        </div>

        {!isManager && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
            <EyeOff size={14} className="mt-0.5 shrink-0" />
            <span>
              <strong>Fechamento às cegas:</strong> você declara apenas o valor contado na gaveta. O sistema
              não mostra o saldo esperado — a conferência é feita pelo gestor.
            </span>
          </div>
        )}
      </div>

      {/* Resultado do último fechamento (só gestor vê a comparação) */}
      {isManager && lastClose && (
        <div className="border border-gray-100 rounded-2xl bg-white shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={16} className="text-primary" />
            <h3 className="font-bold text-gray-900 text-sm">Conferência do fechamento</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Sistema esperava</p>
              <p className="font-black text-gray-900">R$ {fmt(Number(lastClose.systemValue ?? 0))}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Operador declarou</p>
              <p className="font-black text-gray-900">R$ {fmt(Number(lastClose.declaredValue ?? 0))}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Diferença</p>
              {diffBadge(lastClose.difference)}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Fechado por</p>
              <p className="font-semibold text-gray-700 text-sm">{lastClose.closedByName ?? "—"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Histórico — só gestor */}
      {isManager && (
        <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Histórico de fechamentos
            </span>
            {loadingHistory && <RefreshCw size={13} className="animate-spin text-gray-400" />}
          </div>
          <div className="overflow-x-auto touch-pan-x">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {["Fechado em", "Operador", "Sistema", "Declarado", "Diferença", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">Nenhum fechamento registrado ainda.</td></tr>
                )}
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">{h.closedAt ? new Date(h.closedAt).toLocaleString("pt-BR") : "—"}</td>
                    <td className="px-4 py-3">{h.closedByName ?? "—"}</td>
                    <td className="px-4 py-3">R$ {fmt(Number(h.systemValue ?? 0))}</td>
                    <td className="px-4 py-3">R$ {fmt(Number(h.declaredValue ?? 0))}</td>
                    <td className="px-4 py-3">{diffBadge(h.difference)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => printAuditSummary(h.id)}
                        className="text-gray-400 hover:text-gray-700 transition"
                        title="Imprimir cupom de auditoria"
                      >
                        <Printer size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Abrir Caixa */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Abrir Caixa</h2>
              <button onClick={() => setShowOpenModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                Valor inicial em caixa (R$)
              </label>
              <input
                type="number" min="0" step="0.01" autoFocus
                value={openingValue}
                onChange={(e) => setOpeningValue(e.target.value)}
                placeholder="0,00"
                className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm outline-none text-gray-800"
              />
              <button
                onClick={openCash}
                disabled={saving}
                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm transition"
              >
                {saving ? "Abrindo..." : "Abrir Caixa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Fechar Caixa — às cegas (não mostra saldo do sistema) */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <EyeOff size={16} /> Fechar Caixa
              </h2>
              <button onClick={() => setShowCloseModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
                Conte o dinheiro físico na gaveta e informe o valor abaixo. O sistema não exibe o
                saldo esperado — a comparação fica disponível apenas para o gestor.
              </p>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                Valor contado (R$)
              </label>
              <input
                type="number" min="0" step="0.01" autoFocus
                value={declaredValue}
                onChange={(e) => setDeclaredValue(e.target.value)}
                placeholder="0,00"
                className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm outline-none text-gray-800"
              />
              <button
                onClick={closeCash}
                disabled={saving}
                className="w-full bg-gray-900 hover:bg-black disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm transition"
              >
                {saving ? "Fechando..." : "Confirmar Fechamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "mensalidade", label: "Mensalidade", icon: <CreditCard size={15} /> },
  { key: "extrato", label: "Extrato", icon: <Landmark size={15} /> },
  { key: "caixa", label: "Fechamento de Caixa", icon: <Lock size={15} /> },
  { key: "relatorio", label: "Relatório", icon: <BarChart2 size={15} /> },
  { key: "configuracoes", label: "Configurações", icon: <Settings size={15} /> },
];

export default function FinanceiroPage() {
  const [tab, setTab] = useState<Tab>("extrato");
  const [orders, setOrders] = useState<Order[]>([]);
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [cash, setCash] = useState<CashStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, recordsRes, summaryRes, cashRes] = await Promise.allSettled([
        api.get("/orders"),
        api.get("/financial"),
        api.get("/financial/summary"),
        api.get("/cash/current"),
      ]);

      if (ordersRes.status === "fulfilled") {
        setOrders(Array.isArray(ordersRes.value.data) ? ordersRes.value.data : []);
      }
      if (recordsRes.status === "fulfilled") {
        setRecords(Array.isArray(recordsRes.value.data) ? recordsRes.value.data : []);
      }
      if (summaryRes.status === "fulfilled") {
        setSummary(summaryRes.value.data ?? null);
      }
      if (cashRes.status === "fulfilled") {
        setCash(cashRes.value.data ?? null);
      }
    } catch {
      toast.error("Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2.5 rounded-xl">
              <DollarSign size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Financeiro</h1>
              <p className="text-gray-400 text-sm">
                Mensalidade, extrato, relatórios e configurações bancárias
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="border border-gray-200 text-gray-500 hover:bg-gray-100 p-2 rounded-xl transition disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-1 overflow-x-auto touch-pan-x scroll-smooth">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
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
          <div className="flex items-center justify-center py-20 gap-3">
            <RefreshCw size={24} className="animate-spin text-primary" />
            <span className="text-gray-400 text-sm">Carregando dados financeiros...</span>
          </div>
        ) : (
          <>
            {tab === "mensalidade" && <TabMensalidade summary={summary} />}
            {tab === "extrato" && (
              <TabExtrato
                records={records}
                summary={summary}
                cash={cash}
                onAdd={() => setShowModal(true)}
                onRefresh={load}
              />
            )}
            {tab === "caixa" && (
              <TabCaixa cash={cash} onRefresh={load} />
            )}
            {tab === "relatorio" && (
              <TabRelatorio orders={orders} summary={summary} />
            )}
            {tab === "configuracoes" && <TabConfiguracoes />}
          </>
        )}
      </div>

      {showModal && (
        <NovaTransacaoModal
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
    </main>
  );
}
