"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";

// Mesmo fix de ícone Webpack já usado em DeliveryZoneMap/TrackingMap.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export interface HeatmapNeighborhood {
  neighborhood: string;
  orderCount: number;
  revenue: number;
  lat: number | null;
  lng: number | null;
}

interface Props {
  neighborhoods: HeatmapNeighborhood[];
}

const DEFAULT_CENTER: [number, number] = [-25.4284, -49.2733];

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function OrderHeatmap({ neighborhoods }: Props) {
  const geo = neighborhoods.filter((n) => n.lat != null && n.lng != null);
  const maxCount = Math.max(1, ...geo.map((n) => n.orderCount));

  const center: [number, number] =
    geo.length > 0
      ? [
          geo.reduce((s, n) => s + (n.lat ?? 0), 0) / geo.length,
          geo.reduce((s, n) => s + (n.lng ?? 0), 0) / geo.length,
        ]
      : DEFAULT_CENTER;

  if (geo.length === 0) {
    return (
      <div className="h-[420px] flex items-center justify-center text-sm text-gray-400 bg-gray-50 rounded-2xl border border-gray-100">
        Nenhum bairro com coordenada cadastrada ainda — configure a latitude/longitude
        das zonas de entrega em Configurações → Entrega pra ver o mapa.
      </div>
    );
  }

  return (
    <div className="h-[420px] rounded-2xl overflow-hidden border border-gray-100">
      <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        {geo.map((n) => {
          const intensity = n.orderCount / maxCount; // 0..1
          const radius = 12 + intensity * 38; // 12..50px
          return (
            <CircleMarker
              key={n.neighborhood}
              center={[n.lat as number, n.lng as number]}
              radius={radius}
              pathOptions={{
                color: "#dc2626",
                fillColor: "#dc2626",
                fillOpacity: 0.15 + intensity * 0.55,
                weight: 1,
              }}
            >
              <Tooltip direction="top" offset={[0, -radius]}>
                <div className="text-xs">
                  <strong>{n.neighborhood}</strong>
                  <br />
                  {n.orderCount} pedido{n.orderCount === 1 ? "" : "s"} · {fmt(n.revenue)}
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
