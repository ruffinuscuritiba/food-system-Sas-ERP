"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { History, MapPin } from "lucide-react";
import toast from "react-hot-toast";

interface HistoryOrder {
  id: string;
  status: string;
  total: number;
  driverFee: number | null;
  deliveryAddress: string | null;
  deliveredAt: string | null;
  createdAt: string;
  customer: { name: string } | null;
}

export default function DriverHistoryPage() {
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<HistoryOrder[]>("/drivers/me/orders")
      .then((res) => {
        const delivered = res.data.filter((o) => o.status === "DELIVERED");
        setOrders(delivered);
      })
      .catch(() => toast.error("Erro ao carregar histórico"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Histórico</h1>
      <p className="text-sm text-gray-400 mb-5">{orders.length} entrega(s) concluída(s)</p>

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <History size={36} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-400 text-sm">Nenhuma entrega concluída ainda</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-bold text-gray-900">Pedido #{order.id.slice(-6).toUpperCase()}</p>
                  {order.customer && (
                    <p className="text-sm text-gray-500">{order.customer.name}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-green-600">
                    R$ {Number(order.driverFee ?? 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {order.deliveredAt
                      ? new Date(order.deliveredAt).toLocaleDateString("pt-BR")
                      : new Date(order.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              {order.deliveryAddress && (
                <div className="flex items-start gap-1.5 text-xs text-gray-400">
                  <MapPin size={12} className="shrink-0 mt-0.5 text-orange-300" />
                  <span className="leading-tight">{order.deliveryAddress}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
