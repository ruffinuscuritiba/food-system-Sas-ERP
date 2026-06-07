"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { DollarSign, TrendingUp, Clock } from "lucide-react";
import toast from "react-hot-toast";

interface Earning {
  id: string;
  driverAmount: number;
  customerFee: number;
  status: string;
  createdAt: string;
  order: { id: string; createdAt: string; total: number; deliveryAddress: string | null } | null;
}

interface Payment {
  id: string;
  totalAmount: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

export default function DriverEarningsPage() {
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get<Earning[]>("/drivers/me/earnings"),
      api.get<Payment[]>("/drivers/me/payments"),
    ]).then(([e, p]) => {
      if (e.status === "fulfilled") setEarnings(e.value.data);
      if (p.status === "fulfilled") setPayments(p.value.data);
    }).catch(() => toast.error("Erro ao carregar ganhos"))
      .finally(() => setLoading(false));
  }, []);

  const pending = earnings
    .filter((e) => e.status === "PENDING")
    .reduce((s, e) => s + Number(e.driverAmount), 0);

  const totalPaid = payments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + Number(p.totalAmount), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h1 className="text-xl font-bold text-gray-900 mb-5">Ganhos</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-yellow-500" />
            <p className="text-xs text-gray-400 uppercase tracking-wide">Saldo Pendente</p>
          </div>
          <p className="text-2xl font-bold text-yellow-600">R$ {pending.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-green-500" />
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Recebido</p>
          </div>
          <p className="text-2xl font-bold text-green-600">R$ {totalPaid.toFixed(2)}</p>
        </div>
      </div>

      {/* Earnings list */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Entregas ({earnings.length})
      </h2>

      {earnings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
          <DollarSign size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-400 text-sm">Nenhum ganho registrado ainda</p>
        </div>
      ) : (
        <div className="space-y-2">
          {earnings.map((e) => (
            <div key={e.id} className="bg-white rounded-2xl border border-gray-100 p-3.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Pedido #{(e.order?.id ?? e.id).slice(-6).toUpperCase()}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(e.createdAt).toLocaleDateString("pt-BR")}
                </p>
                {e.order?.deliveryAddress && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{e.order.deliveryAddress}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-green-600">R$ {Number(e.driverAmount).toFixed(2)}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium
                  ${e.status === "PAID" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                  {e.status === "PAID" ? "Pago" : "Pendente"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
