"use client";

import dynamic from "next/dynamic";
import { Bike, MapPin, Navigation, CheckCircle2, RefreshCw, Clock } from "lucide-react";
import { useDriverTracking } from "@/hooks/useDriverTracking";
import type { ActiveDelivery, DriverRecord, LiveLocation } from "@/hooks/useDriverTracking";
import { useNavKeyGuard } from "@/hooks/useNavKeyGuard";

// Leaflet must be imported client-side only (uses window/document)
const TrackingMap = dynamic(
  () => import("@/components/delivery-tracking/TrackingMap"),
  { ssr: false, loading: () => <MapPlaceholder /> },
);

function MapPlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-2xl">
      <div className="text-center text-gray-400">
        <MapPin size={32} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">Carregando mapa…</p>
      </div>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}
function KpiCard({ label, value, icon, accent }: KpiCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide leading-tight">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}

function DriverRow({
  driver,
  delivery,
  loc,
}: {
  driver: DriverRecord;
  delivery: ActiveDelivery | undefined;
  loc: LiveLocation | undefined;
}) {
  const hasLiveGps = loc && loc.updatedAt !== "db";

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold ${driver.isAvailable ? "bg-orange-400" : "bg-gray-300"}`}>
        {driver.user.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{driver.user.name}</p>
          {delivery ? (
            <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
              Em rota
            </span>
          ) : driver.isAvailable ? (
            <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              Disponível
            </span>
          ) : (
            <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
              Offline
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {driver.vehicleType ?? "Veículo não informado"}
          {driver.vehiclePlate ? ` · ${driver.vehiclePlate}` : ""}
        </p>
        {delivery?.deliveryAddress && (
          <p className="text-xs text-blue-500 mt-0.5 truncate flex items-center gap-1">
            <MapPin size={10} className="shrink-0" />
            {delivery.deliveryAddress}
          </p>
        )}
        {loc ? (
          <p className="text-[10px] text-gray-300 mt-0.5 flex items-center gap-1">
            <Navigation size={9} />
            {hasLiveGps
              ? `GPS ao vivo · ${new Date(loc.updatedAt).toLocaleTimeString("pt-BR")}`
              : `Última posição registrada`}
          </p>
        ) : (
          <p className="text-[10px] text-gray-300 mt-0.5">Sem localização</p>
        )}
      </div>
    </div>
  );
}

export default function DeliveryTrackingPage() {
  useNavKeyGuard("delivery-tracking");
  const {
    drivers,
    liveLocations,
    activeDeliveries,
    loading,
    onlineCount,
    enRouteCount,
    availableCount,
    refresh,
  } = useDriverTracking();

  return (
    <div className="flex flex-col h-full bg-[#F5F3EF]">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Central de Rastreamento</h1>
          <p className="text-sm text-gray-400 mt-0.5">Entregadores em tempo real</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {/* KPI cards */}
      <div className="px-6 mb-4 grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard
          label="Online"
          value={onlineCount}
          icon={<Bike size={18} className="text-orange-600" />}
          accent="bg-orange-50"
        />
        <KpiCard
          label="Em rota"
          value={enRouteCount}
          icon={<Navigation size={18} className="text-blue-600" />}
          accent="bg-blue-50"
        />
        <KpiCard
          label="Disponíveis"
          value={availableCount}
          icon={<CheckCircle2 size={18} className="text-green-600" />}
          accent="bg-green-50"
        />
        <KpiCard
          label="Atualização"
          value={30}
          icon={<Clock size={18} className="text-gray-500" />}
          accent="bg-gray-50"
        />
      </div>

      {/* Main content: map + list */}
      <div className="flex-1 px-6 pb-6 flex flex-col lg:flex-row gap-4 min-h-0">
        {/* Map */}
        <div className="flex-1 min-h-[320px] lg:min-h-0 rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          {!loading && (
            <TrackingMap
              drivers={drivers}
              liveLocations={liveLocations}
              activeDeliveries={activeDeliveries}
            />
          )}
          {loading && <MapPlaceholder />}
        </div>

        {/* Driver list */}
        <div className="w-full lg:w-80 xl:w-96 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
          <div className="px-4 pt-4 pb-3 border-b border-gray-50">
            <p className="text-sm font-semibold text-gray-700">
              Entregadores ({drivers.length})
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-7 h-7 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : drivers.length === 0 ? (
              <div className="py-10 text-center">
                <Bike size={28} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">Nenhum entregador cadastrado</p>
              </div>
            ) : (
              drivers.map((d) => (
                <DriverRow
                  key={d.id}
                  driver={d}
                  delivery={activeDeliveries.find((o) => o.driverId === d.id)}
                  loc={liveLocations[d.id]}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
