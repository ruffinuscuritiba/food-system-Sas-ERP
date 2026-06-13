"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/services/api";
import { RefreshCw, Users, Plus } from "lucide-react";
import toast from "react-hot-toast";

interface TableOrder {
  id: string;
  status: string;
  total: number;
  items: { productName: string; quantity: number }[];
}

interface Table {
  id: string;
  number: number;
  status: "FREE" | "OCCUPIED" | "RESERVED";
  dineInOrders?: TableOrder[];
}

const STATUS_CONFIG = {
  FREE:     { label: "Livre",     bg: "bg-green-100",  text: "text-green-700",  border: "border-green-200"  },
  OCCUPIED: { label: "Ocupada",   bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
  RESERVED: { label: "Reservada", bg: "bg-blue-100",   text: "text-blue-700",   border: "border-blue-200"   },
};

export default function GarcomHome() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Table[]>("/tables");
      setTables(res.data.sort((a, b) => a.number - b.number));
    } catch {
      toast.error("Erro ao carregar mesas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh a cada 30s
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const occupied = tables.filter((t) => t.status === "OCCUPIED").length;
  const free     = tables.filter((t) => t.status === "FREE").length;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mesas</h1>
          <p className="text-sm text-gray-400">
            {occupied} ocupada{occupied !== 1 ? "s" : ""} · {free} livre{free !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Legenda */}
      <div className="flex gap-3 mb-5">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <span key={key} className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.text.replace("text-", "bg-")}`} />
            {cfg.label}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tables.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <Users size={36} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-400 text-sm">Nenhuma mesa cadastrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {tables.map((table) => {
            const cfg = STATUS_CONFIG[table.status];
            const activeOrders = table.dineInOrders?.filter(
              (o) => !["DELIVERED", "CANCELLED"].includes(o.status)
            ) ?? [];
            const total = activeOrders.reduce((s, o) => s + Number(o.total), 0);
            const itemCount = activeOrders.reduce(
              (s, o) => s + o.items.reduce((si, i) => si + i.quantity, 0),
              0
            );

            return (
              <button
                key={table.id}
                onClick={() => router.push(`/garcom/mesa/${table.id}`)}
                className={`relative flex flex-col items-center justify-center aspect-square rounded-2xl border-2 ${cfg.bg} ${cfg.border} transition active:scale-95`}
              >
                <span className={`text-2xl font-bold ${cfg.text}`}>{table.number}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${cfg.text} opacity-70`}>
                  {cfg.label}
                </span>
                {table.status === "OCCUPIED" && itemCount > 0 && (
                  <div className="absolute top-2 right-2 bg-orange-500 text-white text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {itemCount}
                  </div>
                )}
                {table.status === "OCCUPIED" && total > 0 && (
                  <span className="mt-1 text-[10px] text-orange-700 font-semibold">
                    R${total.toFixed(2)}
                  </span>
                )}
                {table.status === "FREE" && (
                  <Plus size={14} className="mt-1 text-green-500 opacity-60" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
