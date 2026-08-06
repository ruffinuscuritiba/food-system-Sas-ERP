"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import { Printer, RefreshCw, Search, Calendar } from "lucide-react";
import { PrintRouterService } from "@/components/printing/PrintRouterService";
import { useNavKeyGuard } from "@/hooks/useNavKeyGuard";

type OrderItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
  selectedComplements?: { optionName: string; quantity: number; price: number }[];
};

type Order = {
  id: string;
  status: string;
  orderType?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  paymentMethod: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  notes?: string;
  createdAt: string;
  confirmedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  items: OrderItem[];
  customer?: { name: string; phone: string };
  source?: string;
};

const STATUS_PT: Record<string, { label: string; color: string }> = {
  DELIVERED: { label: "Entregue",  color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelado", color: "bg-red-100 text-red-600"    },
};

const PAY_LABELS: Record<string, string> = {
  PIX: "PIX", CASH: "Dinheiro",
  CREDIT_CARD: "Crédito", DEBIT_CARD: "Débito", MEAL_VOUCHER: "Vale-Refeição",
  TRANSFER: "Transferência",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function HistoricoPedidosPage() {
  useNavKeyGuard("historico");
  const { user } = useAuthStore();
  const [orders, setOrders]       = useState<Order[]>([]);
  const [loading, setLoading]     = useState(true);
  const [companyName, setCompanyName] = useState("Restaurante");
  // Busca por conferência — nome/telefone/nº do pedido + intervalo de data
  // (datetime-local, com horário) pra achar um pedido específico sem ter que
  // rolar a lista inteira. Filtro é local (a lista já vem inteira do backend).
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [ordRes, compRes] = await Promise.allSettled([
        api.get("/orders"),
        api.get(`/company/${user?.companyId}`),
      ]);
      if (ordRes.status === "fulfilled") {
        const all: Order[] = Array.isArray(ordRes.value.data) ? ordRes.value.data : [];
        setOrders(all.filter(o => o.status === "DELIVERED" || o.status === "CANCELLED"));
      }
      if (compRes.status === "fulfilled" && compRes.value.data?.name) {
        setCompanyName(compRes.value.data.name);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filteredOrders = orders.filter((order) => {
    const ref = order.deliveredAt || order.cancelledAt || order.createdAt;
    const refTime = ref ? new Date(ref).getTime() : null;
    if (dateFrom && (refTime === null || refTime < new Date(dateFrom).getTime())) return false;
    if (dateTo && (refTime === null || refTime > new Date(dateTo).getTime())) return false;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const clientName  = (order.customer?.name  || order.customerName  || "").toLowerCase();
    const clientPhone = (order.customer?.phone || order.customerPhone || "").toLowerCase();
    const shortId = order.id.slice(-8).toLowerCase();
    return clientName.includes(q) || clientPhone.includes(q) || shortId.includes(q);
  });

  async function handlePrint(order: Order) {
    const result = await PrintRouterService.printAll(
      {
        ...order,
        status: STATUS_PT[order.status]?.label || order.status,
        customerName: order.customer?.name || order.customerName || "—",
        customerPhone: order.customer?.phone || order.customerPhone || "",
      },
      { companyName },
    );
    if (result.blockedSectors.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const toast = (await import("react-hot-toast")).default;
      toast.error(
        `Impressão bloqueada pelo navegador (${result.blockedSectors.join(", ")}). Libere pop-ups para este site.`,
        { id: "historico-print-blocked", duration: 8000 },
      );
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Histórico de Pedidos</h1>
          <p className="text-gray-400 text-sm mt-0.5">Pedidos entregues e cancelados</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {/* Busca por conferência: nome/telefone/nº do pedido + intervalo de data e horário */}
      {orders.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 mb-5 bg-gray-50 border border-gray-200 rounded-2xl p-4">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs text-gray-400 font-bold uppercase mb-1.5">Buscar</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nome, telefone ou nº do pedido"
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 font-bold uppercase mb-1.5 flex items-center gap-1">
              <Calendar size={11} /> De
            </label>
            <input
              type="datetime-local"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 font-bold uppercase mb-1.5 flex items-center gap-1">
              <Calendar size={11} /> Até
            </label>
            <input
              type="datetime-local"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary"
            />
          </div>
          {(searchQuery || dateFrom || dateTo) && (
            <button
              onClick={() => { setSearchQuery(""); setDateFrom(""); setDateTo(""); }}
              className="h-10 px-4 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-100 transition"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" /> Carregando...
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-lg font-semibold">Nenhum pedido no histórico ainda</p>
          <p className="text-sm mt-1">Pedidos marcados como Entregue ou Cancelado aparecerão aqui.</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-lg font-semibold">Nenhum pedido encontrado com esse filtro</p>
          <p className="text-sm mt-1">Ajuste a busca ou o intervalo de data/horário.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm touch-pan-x">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Pedido</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Telefone</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Total</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Pgto</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Data</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredOrders.map(order => {
                const st = STATUS_PT[order.status];
                const clientName  = order.customer?.name  || order.customerName  || "—";
                const clientPhone = order.customer?.phone || order.customerPhone || "—";
                const dateStr     = fmtDate(order.deliveredAt || order.cancelledAt || order.createdAt);

                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-mono text-gray-700 font-bold">
                      #{order.id.slice(-8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-gray-800">{clientName}</td>
                    <td className="px-4 py-3 text-gray-500">{clientPhone}</td>
                    <td className="px-4 py-3 font-bold text-gray-900">
                      R$ {Number(order.total).toFixed(2).replace(".", ",")}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {PAY_LABELS[order.paymentMethod] || order.paymentMethod}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{dateStr}</td>
                    <td className="px-4 py-3">
                      {st ? (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${st.color}`}>
                          {st.label}
                        </span>
                      ) : (
                        <span className="text-gray-400">{order.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handlePrint(order)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-semibold transition"
                      >
                        <Printer size={13} /> Reimprimir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
