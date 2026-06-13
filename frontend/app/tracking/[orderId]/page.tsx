"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, Clock, CookingPot, Bike, Package, XCircle, Store } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

interface TrackItem {
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface TrackOrder {
  id: string;
  number?: number;
  status: string;
  total: number;
  deliveryFee: number;
  orderType?: string;
  createdAt: string;
  confirmedAt?: string;
  preparingAt?: string;
  readyAt?: string;
  outForDeliveryAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  items: TrackItem[];
  driver?: { user: { name: string }; currentLat?: number; currentLng?: number } | null;
  company?: { name: string } | null;
}

const STEPS = [
  { status: "PENDING",          label: "Pedido recebido",   icon: Package,     ts: "createdAt" },
  { status: "CONFIRMED",        label: "Confirmado",         icon: CheckCircle, ts: "confirmedAt" },
  { status: "PREPARING",        label: "Em preparação",      icon: CookingPot,  ts: "preparingAt" },
  { status: "READY",            label: "Pronto",             icon: CheckCircle, ts: "readyAt" },
  { status: "OUT_FOR_DELIVERY", label: "Saiu para entrega",  icon: Bike,        ts: "outForDeliveryAt" },
  { status: "DELIVERED",        label: "Entregue!",          icon: CheckCircle, ts: "deliveredAt" },
];

const PICKUP_STEPS = [
  { status: "PENDING",   label: "Pedido recebido",  icon: Package,     ts: "createdAt" },
  { status: "CONFIRMED", label: "Confirmado",        icon: CheckCircle, ts: "confirmedAt" },
  { status: "PREPARING", label: "Em preparação",     icon: CookingPot,  ts: "preparingAt" },
  { status: "READY",     label: "Pronto para retirar", icon: Store,     ts: "readyAt" },
  { status: "DELIVERED", label: "Retirado!",         icon: CheckCircle, ts: "deliveredAt" },
];

const STATUS_ORDER = ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"];

function fmtTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function TrackingPage() {
  const { orderId } = useParams() as { orderId: string };
  const [order, setOrder]   = useState<TrackOrder | null>(null);
  const [error, setError]   = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/orders/public/track/${orderId}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setOrder(await res.json());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s unless delivered/cancelled
  useEffect(() => {
    if (!order || ["DELIVERED", "CANCELLED"].includes(order.status)) return;
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [order, load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center gap-3 px-4 text-center">
        <XCircle size={40} className="text-red-400" />
        <p className="font-bold text-gray-700 text-lg">Pedido não encontrado</p>
        <p className="text-gray-400 text-sm">Verifique o link e tente novamente.</p>
      </div>
    );
  }

  const isCancelled = order.status === "CANCELLED";
  const isDelivery  = order.orderType === "DELIVERY";
  const steps       = isDelivery ? STEPS : PICKUP_STEPS;
  const currentIdx  = STATUS_ORDER.indexOf(order.status);

  const subtotal = Number(order.total) - Number(order.deliveryFee ?? 0);

  return (
    <div className="min-h-screen bg-orange-50">
      {/* Header */}
      <div className="bg-orange-500 text-white px-5 pt-10 pb-6">
        <p className="text-orange-200 text-sm font-medium mb-1">
          {order.company?.name ?? "Seu pedido"}
        </p>
        <h1 className="text-2xl font-bold">
          Pedido {order.number ? `#${order.number}` : `#${order.id.slice(-6).toUpperCase()}`}
        </h1>
        <p className="text-orange-200 text-sm mt-1">
          {isCancelled ? "Cancelado" : "Acompanhe em tempo real"}
        </p>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        {/* Status card */}
        {isCancelled ? (
          <div className="bg-white rounded-2xl p-5 flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
              <XCircle size={24} className="text-red-500" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Pedido cancelado</p>
              <p className="text-sm text-gray-400">{fmtTime(order.cancelledAt ?? order.createdAt)}</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 mb-4">Status do pedido</h2>
            <div className="relative">
              {steps.map((step, i) => {
                const stepStatusIdx = STATUS_ORDER.indexOf(step.status);
                const done    = stepStatusIdx <= currentIdx;
                const active  = step.status === order.status;
                const ts      = order[step.ts as keyof TrackOrder] as string | undefined;
                const Icon    = step.icon;

                return (
                  <div key={step.status} className="flex gap-3 relative">
                    {/* Line */}
                    {i < steps.length - 1 && (
                      <div className={`absolute left-4 top-9 w-0.5 h-8 ${done ? "bg-orange-400" : "bg-gray-200"}`} />
                    )}

                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                      active  ? "bg-orange-500 text-white ring-4 ring-orange-100" :
                      done    ? "bg-orange-100 text-orange-500" :
                                "bg-gray-100 text-gray-300"
                    }`}>
                      <Icon size={14} />
                    </div>

                    {/* Label */}
                    <div className={`pb-8 ${i === steps.length - 1 ? "pb-0" : ""}`}>
                      <p className={`text-sm font-semibold leading-tight ${done ? "text-gray-800" : "text-gray-400"}`}>
                        {step.label}
                        {active && <span className="ml-2 text-[10px] font-bold text-orange-500 uppercase tracking-wide">Agora</span>}
                      </p>
                      {ts && (
                        <p className="text-xs text-gray-400">{fmtTime(ts)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Driver info if out for delivery */}
            {order.status === "OUT_FOR_DELIVERY" && order.driver && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Bike size={18} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {order.driver.user.name}
                  </p>
                  <p className="text-xs text-gray-400">Entregador a caminho</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Order summary */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-500">Resumo do pedido</h2>
          </div>
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-0">
              <p className="text-sm text-gray-700">{item.quantity}× {item.productName}</p>
              <p className="text-sm font-medium text-gray-600">
                R${(Number(item.unitPrice) * item.quantity).toFixed(2)}
              </p>
            </div>
          ))}
          <div className="px-5 py-4 bg-gray-50 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>R${subtotal.toFixed(2)}</span>
            </div>
            {Number(order.deliveryFee) > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Taxa de entrega</span>
                <span>R${Number(order.deliveryFee).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200">
              <span>Total</span>
              <span>R${Number(order.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          Atualizado automaticamente a cada 30 segundos
        </p>
      </div>
    </div>
  );
}
