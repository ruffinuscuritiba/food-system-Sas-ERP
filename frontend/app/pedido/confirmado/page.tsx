"use client";

import { useSearchParams } from "next/navigation";
import { CheckCircle2, ChefHat, Bike, PackageCheck, Clock, XCircle } from "lucide-react";
import { Suspense, useEffect, useState, createElement } from "react";
import { io, Socket } from "socket.io-client";
import { apiBaseUrl, socketBaseUrl } from "@/services/env";

// Status operacional unificado
type Status =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "UNKNOWN";

interface StatusConfig {
  label: string;
  color: string;
  bgColor: string; // Mapeado explicitamente para evitar falha no Tailwind
  icon: React.ElementType;
  pct: number;
}

const STATUS_META: Record<Status, StatusConfig> = {
  PENDING:          { label: "Recebido",         color: "bg-yellow-500", bgColor: "bg-yellow-500/20", icon: Clock,         pct: 15 },
  CONFIRMED:        { label: "Confirmado",       color: "bg-blue-500",   bgColor: "bg-blue-500/20",   icon: CheckCircle2,  pct: 30 },
  PREPARING:        { label: "Em preparo",       color: "bg-orange-500", bgColor: "bg-orange-500/20", icon: ChefHat,       pct: 55 },
  READY:            { label: "Pronto",           color: "bg-purple-500", bgColor: "bg-purple-500/20", icon: PackageCheck,  pct: 75 },
  OUT_FOR_DELIVERY: { label: "Saiu para entrega", color: "bg-cyan-500",   bgColor: "bg-cyan-500/20",   icon: Bike,          pct: 90 },
  DELIVERED:        { label: "Entregue",         color: "bg-green-500",  bgColor: "bg-green-500/20",  icon: CheckCircle2,  pct: 100 },
  CANCELLED:        { label: "Cancelado",        color: "bg-red-500",    bgColor: "bg-red-500/20",    icon: XCircle,       pct: 0 },
  UNKNOWN:          { label: "Aguardando…",      color: "bg-slate-500",  bgColor: "bg-slate-500/20",  icon: Clock,         pct: 5 },
};

function normalize(raw: string | null | undefined): Status {
  if (!raw) return "UNKNOWN";
  const s = String(raw).toUpperCase();
  if (s === "DELIVERING") return "OUT_FOR_DELIVERY";
  if (s === "COMPLETED") return "DELIVERED";
  if (s === "CANCELED") return "CANCELLED";
  if (s in STATUS_META) return s as Status;
  return "UNKNOWN";
}

function ConfirmadoContent() {
  const params = useSearchParams();
  const orderId = params.get("orderId") || "";
  const mock = params.get("mock");

  const [status, setStatus] = useState<Status>("UNKNOWN");
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [connected, setConnected] = useState(false);

  // Polling fallback (15s)
  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`${apiBaseUrl}/online-orders/${orderId}/public-status`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setStatus(normalize(data?.orderStatus));
        setLastUpdate(
          new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      } catch {
        /* silencioso */
      }
    }

    poll();
    const interval = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orderId]);

  // Socket.IO
  useEffect(() => {
    if (!orderId) return;

    const socket: Socket = io(socketBaseUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("joinOrder", { orderId });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("orderStatusChanged", (payload: { orderId: string; status: string }) => {
      if (payload?.orderId !== orderId) return;
      setStatus(normalize(payload.status));
      setLastUpdate(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [orderId]);

  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 px-4 text-center text-white py-12">
      {/* Círculo do Ícone com classe exícita de background opaco */}
      <div className={`${meta.bgColor} rounded-full p-6 transition-all duration-300`}>
        {createElement(meta.icon, { size: 72, className: "text-white" })}
      </div>

      <h1
        className={`text-4xl font-black ${
          status === "DELIVERED"
            ? "text-green-400"
            : status === "CANCELLED"
            ? "text-red-400"
            : "text-white"
        }`}
      >
        {status === "DELIVERED"
          ? "Pedido entregue!"
          : status === "CANCELLED"
          ? "Pedido cancelado"
          : meta.label}
      </h1>

      {/* Progress bar visual */}
      <div className="w-full max-w-md">
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${meta.color}`}
            style={{ width: `${meta.pct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-bold">
          <span>Recebido</span>
          <span>Preparando</span>
          <span>Saiu</span>
          <span>Entregue</span>
        </div>
      </div>

      {status !== "DELIVERED" && status !== "CANCELLED" && (
        <p className="text-slate-300 text-base max-w-sm">
          Acompanhe em tempo real. Esta página atualiza sozinha — não feche.
        </p>
      )}

      {orderId && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl px-6 py-3 text-sm text-slate-400">
          Pedido <span className="text-white font-mono font-bold">#{orderId.slice(-8).toUpperCase()}</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span
          className={`w-2 h-2 rounded-full ${
            connected ? "bg-green-500 animate-pulse" : "bg-slate-600"
          }`}
        />
        {connected ? "Conectado em tempo real" : "Reconectando..."}
        {lastUpdate && <span className="ml-2 text-slate-600">· Atualizado às {lastUpdate}</span>}
      </div>

      {mock && (
        <p className="text-xs text-slate-600">(modo demonstração — sem gateway configurado)</p>
      )}
    </div>
  );
}

export default function PedidoConfirmadoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ConfirmadoContent />
    </Suspense>
  );
}