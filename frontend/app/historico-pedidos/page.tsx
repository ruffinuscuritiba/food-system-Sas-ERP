"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import { Printer, RefreshCw } from "lucide-react";
import { printTicket } from "@/components/printing/printTicket";
import { buildReceipt80mm } from "@/components/printing/Receipt80mm";

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
  CREDIT_CARD: "Crédito", DEBIT_CARD: "Débito", TRANSFER: "Transferência",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function HistoricoPedidosPage() {
  const { user } = useAuthStore();
  const [orders, setOrders]       = useState<Order[]>([]);
  const [loading, setLoading]     = useState(true);
  const [companyName, setCompanyName] = useState("Restaurante");

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

  function handlePrint(order: Order) {
    printTicket(buildReceipt80mm(
      {
        ...order,
        status: STATUS_PT[order.status]?.label || order.status,
        customerName: order.customer?.name || order.customerName || "—",
        customerPhone: order.customer?.phone || order.customerPhone || "",
      },
      { companyName },
    ));
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

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" /> Carregando...
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-lg font-semibold">Nenhum pedido no histórico ainda</p>
          <p className="text-sm mt-1">Pedidos marcados como Entregue ou Cancelado aparecerão aqui.</p>
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
              {orders.map(order => {
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
