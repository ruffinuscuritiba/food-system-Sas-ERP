"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/services/api";
import { getTrackingSocket, disconnectTrackingSocket } from "@/services/trackingSocket";
import { Bike, MapPin, Package, LogOut, Navigation, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";

interface DriverProfile {
  id: string;
  phone: string | null;
  vehicleType: string | null;
  vehiclePlate: string | null;
  isAvailable: boolean;
  user: { name: string; email: string };
}

interface ActiveOrder {
  id: string;
  status: string;
  total: number;
  driverFee: number | null;
  deliveryAddress: string | null;
  customer: { name: string; phone: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  READY: "Pronto para coleta",
  OUT_FOR_DELIVERY: "Em entrega",
};

const STATUS_COLOR: Record<string, string> = {
  READY: "bg-yellow-100 text-yellow-700",
  OUT_FOR_DELIVERY: "bg-blue-100 text-blue-700",
};

export default function DriverHome() {
  const { logout } = useAuthStore();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [gpsActive, setGpsActive] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastEmitRef = useRef<number>(0);

  async function load() {
    try {
      const [profileRes, ordersRes] = await Promise.allSettled([
        api.get<DriverProfile>("/drivers/me"),
        api.get<ActiveOrder[]>("/drivers/me/orders"),
      ]);
      if (profileRes.status === "fulfilled") setProfile(profileRes.value.data);
      if (ordersRes.status === "fulfilled") {
        const active = ordersRes.value.data.filter(
          (o) => o.status === "READY" || o.status === "OUT_FOR_DELIVERY",
        );
        setActiveOrders(active);
      }
    } finally {
      setLoading(false);
    }
  }

  // Connect tracking socket and start GPS watch
  useEffect(() => {
    load();

    const sock = getTrackingSocket();
    sock.connect();

    sock.on("connect", () => {
      setGpsActive(true);
    });

    sock.on("disconnect", () => {
      setGpsActive(false);
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      disconnectTrackingSocket();
      setGpsActive(false);
    };
  }, []);

  // Start GPS once profile and socket are ready
  useEffect(() => {
    if (!profile || !gpsActive) return;
    if (!("geolocation" in navigator)) return;

    const sock = getTrackingSocket();

    // Register driver presence
    sock.emit("driver:register", profile.id);

    // Watch position — throttle to once every 5s to avoid spam
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastEmitRef.current < 5000) return;
        lastEmitRef.current = now;

        const { latitude: lat, longitude: lng } = pos.coords;

        // Find first active OUT_FOR_DELIVERY order for orderId context
        const currentOrder = activeOrders.find((o) => o.status === "OUT_FOR_DELIVERY")
          ?? activeOrders[0];

        sock.emit("driver:location", {
          driverId: profile.id,
          orderId: currentOrder?.id ?? "",
          lat,
          lng,
        });
      },
      (err) => {
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
          toast.error("Permita o acesso ao GPS para transmitir localização");
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [profile?.id, gpsActive, activeOrders]);

  async function handlePickedUp(orderId: string) {
    setActionLoading(`pickup-${orderId}`);
    try {
      const sock = getTrackingSocket();
      sock.emit("driver:picked_up", { orderId });
      // Optimistic update
      setActiveOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "OUT_FOR_DELIVERY" } : o)),
      );
      toast.success("Coleta confirmada! Boa entrega 🛵");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelivered(orderId: string) {
    setActionLoading(`delivered-${orderId}`);
    try {
      const sock = getTrackingSocket();

      await new Promise<void>((resolve, reject) => {
        // Emit via socket — TrackingGateway calls ordersService.updateStatus(DELIVERED)
        sock.emit("driver:delivered", { orderId });

        // Wait briefly then reload to confirm status change
        setTimeout(async () => {
          try {
            await load();
            toast.success("Entrega confirmada! 🎉");
            resolve();
          } catch {
            reject();
          }
        }, 1200);
      });
    } catch {
      toast.error("Erro ao confirmar entrega");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Olá, {profile?.user.name ?? "Entregador"} 👋
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${gpsActive ? "bg-green-500" : "bg-gray-300"}`} />
            <p className="text-xs text-gray-400">
              {gpsActive ? "GPS ativo · transmitindo localização" : "Conectando..."}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="p-2 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
        >
          <LogOut size={18} />
        </button>
      </div>

      {/* Profile card */}
      {profile && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <Bike size={22} className="text-orange-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{profile.user.name}</p>
              <p className="text-xs text-gray-500">{profile.user.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Veículo</p>
              <p className="text-sm font-semibold text-gray-700 mt-0.5 truncate">{profile.vehicleType ?? "—"}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Placa</p>
              <p className="text-sm font-semibold text-gray-700 mt-0.5">{profile.vehiclePlate ?? "—"}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Status</p>
              <p className={`text-sm font-semibold mt-0.5 ${profile.isAvailable ? "text-green-600" : "text-red-500"}`}>
                {profile.isAvailable ? "Online" : "Offline"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active deliveries */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Entregas ativas ({activeOrders.length})
      </h2>

      {activeOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
          <Package size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-400 text-sm">Nenhuma entrega ativa no momento</p>
          <p className="text-gray-300 text-xs mt-1">Vá em "Entregas" para aceitar pedidos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-900 text-base">
                    #{order.id.slice(-6).toUpperCase()}
                  </p>
                  {order.customer && (
                    <p className="text-sm text-gray-500 mt-0.5">{order.customer.name}</p>
                  )}
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
              </div>

              {order.deliveryAddress && (
                <div className="flex items-start gap-2 mb-3 text-sm text-gray-600">
                  <MapPin size={14} className="shrink-0 mt-0.5 text-orange-400" />
                  <span className="leading-tight">{order.deliveryAddress}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Repasse</p>
                  <p className="text-lg font-bold text-green-600">
                    R$ {Number(order.driverFee ?? 0).toFixed(2)}
                  </p>
                </div>

                <div className="flex gap-2">
                  {order.status === "READY" && (
                    <button
                      disabled={actionLoading === `pickup-${order.id}`}
                      onClick={() => handlePickedUp(order.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm font-semibold disabled:opacity-60"
                    >
                      <Navigation size={14} />
                      {actionLoading === `pickup-${order.id}` ? "..." : "Coletei"}
                    </button>
                  )}
                  {order.status === "OUT_FOR_DELIVERY" && (
                    <button
                      disabled={actionLoading === `delivered-${order.id}`}
                      onClick={() => handleDelivered(order.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition disabled:opacity-60"
                    >
                      <CheckCircle size={14} />
                      {actionLoading === `delivered-${order.id}` ? "..." : "Entregue"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
