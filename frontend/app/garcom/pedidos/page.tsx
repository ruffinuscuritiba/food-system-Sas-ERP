"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api";
import { RefreshCw, ClipboardList } from "lucide-react";
import toast from "react-hot-toast";

interface KitchenItem {
  productName: string;
  quantity: number;
  selectedComplements?: { groupName: string; optionName: string }[];
}

interface KitchenOrder {
  id: string;
  source: string;
  status: string;
  number?: number;
  tableNumber?: number;
  orderType?: string;
  items: KitchenItem[];
  total: number;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING:           { label: "Aguardando",  color: "bg-gray-100 text-gray-600" },
  CONFIRMED:         { label: "Confirmado",  color: "bg-blue-100 text-blue-700" },
  PREPARING:         { label: "Preparando",  color: "bg-yellow-100 text-yellow-700" },
  READY:             { label: "Pronto",      color: "bg-green-100 text-green-700" },
  OUT_FOR_DELIVERY:  { label: "Em entrega",  color: "bg-purple-100 text-purple-700" },
  DELIVERED:         { label: "Entregue",    color: "bg-gray-100 text-gray-500" },
  CANCELLED:         { label: "Cancelado",   color: "bg-red-100 text-red-600" },
};

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY"];

export default function GarcomPedidos() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "all">("active");

  const load = useCallback(async () => {
    try {
      const res = await api.get<KitchenOrder[]>("/orders/kitchen");
      setOrders(res.data);
    } catch {
      toast.error("Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const displayed = orders.filter((o) =>
    filter === "active" ? ACTIVE_STATUSES.includes(o.status) : true
  );

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-sm text-gray-400">{displayed.length} pedido{displayed.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(["active", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
              filter === f ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {f === "active" ? "Ativos" : "Todos"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <ClipboardList size={36} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-400 text-sm">Nenhum pedido {filter === "active" ? "ativo" : ""} no momento</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((order) => {
            const cfg = STATUS_CONFIG[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-500" };
            const time = new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

            return (
              <div key={`${order.source}-${order.id}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">
                      {order.tableNumber ? `Mesa ${order.tableNumber}` : `Pedido #${order.number ?? order.id.slice(-4).toUpperCase()}`}
                    </p>
                    <p className="text-[11px] text-gray-400">{time}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>

                <div className="text-sm text-gray-700 space-y-0.5">
                  {order.items.slice(0, 4).map((item, i) => (
                    <p key={i} className="truncate">
                      {item.quantity}× {item.productName}
                    </p>
                  ))}
                  {order.items.length > 4 && (
                    <p className="text-gray-400 text-xs">+{order.items.length - 4} item(s)</p>
                  )}
                </div>

                <div className="flex justify-end mt-2 pt-2 border-t border-gray-50">
                  <p className="text-sm font-bold text-gray-700">R${Number(order.total).toFixed(2)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
