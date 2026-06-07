"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/services/api";
import { MapPin, Package, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

interface AvailableOrder {
  id: string;
  total: number;
  driverFee: number | null;
  deliveryAddress: string | null;
  customer: { name: string; phone: string } | null;
  items: { productName: string; quantity: number }[];
}

export default function DriverOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<AvailableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<AvailableOrder[]>("/drivers/me/available");
      setOrders(res.data);
    } catch {
      toast.error("Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function accept(orderId: string) {
    setAccepting(orderId);
    try {
      await api.post(`/drivers/me/accept/${orderId}`);
      toast.success("Entrega aceita!");
      router.push("/driver");
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error("Este pedido já foi aceito por outro entregador");
        load();
      } else {
        toast.error("Erro ao aceitar entrega");
      }
    } finally {
      setAccepting(null);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Entregas Disponíveis</h1>
          <p className="text-sm text-gray-400">{orders.length} pedido(s) aguardando</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <Package size={36} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-400 text-sm">Nenhum pedido disponível no momento</p>
          <button onClick={load} className="mt-4 text-orange-500 text-sm font-semibold">
            Atualizar
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="font-bold text-gray-900">Pedido #{order.id.slice(-6).toUpperCase()}</p>
                <p className="text-sm font-semibold text-gray-500">
                  R$ {Number(order.total).toFixed(2)}
                </p>
              </div>

              {order.customer && (
                <p className="text-sm text-gray-600 mb-1">{order.customer.name}</p>
              )}

              {order.deliveryAddress && (
                <div className="flex items-start gap-1.5 mb-3 text-sm text-gray-500">
                  <MapPin size={13} className="shrink-0 mt-0.5 text-orange-400" />
                  <span className="leading-tight">{order.deliveryAddress}</span>
                </div>
              )}

              {order.items.length > 0 && (
                <div className="text-xs text-gray-400 mb-3">
                  {order.items.slice(0, 3).map((it, i) => (
                    <span key={i}>{it.quantity}× {it.productName}{i < Math.min(order.items.length, 3) - 1 ? ", " : ""}</span>
                  ))}
                  {order.items.length > 3 && <span> +{order.items.length - 3} item(s)</span>}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Repasse</p>
                  <p className="text-base font-bold text-green-600">
                    R$ {Number(order.driverFee ?? 0).toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => accept(order.id)}
                  disabled={accepting === order.id}
                  className="px-5 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 active:scale-95 transition disabled:opacity-60"
                >
                  {accepting === order.id ? "Aceitando..." : "Aceitar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
