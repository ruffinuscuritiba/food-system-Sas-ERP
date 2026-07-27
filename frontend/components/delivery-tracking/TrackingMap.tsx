"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { DriverRecord, LiveLocation, ActiveDelivery } from "@/hooks/useDriverTracking";

// Fix Leaflet's default icon path broken by webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Capacete estilizado com gradiente radial (efeito 3D/glossy) em vez do
// emoji de moto plano. Mesma silhueta pros dois estados, só muda a cor.
function helmetSvg(gradId: string, from: string, mid: string, to: string, visor: string) {
  return `<svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="${gradId}" cx="35%" cy="25%" r="80%">
        <stop offset="0%" stop-color="${from}"/>
        <stop offset="45%" stop-color="${mid}"/>
        <stop offset="100%" stop-color="${to}"/>
      </radialGradient>
    </defs>
    <path d="M2 14.5C2 8.15 6.7 3 12 3s10 5.15 10 11.5V16a1.5 1.5 0 0 1-1.5 1.5H3.5A1.5 1.5 0 0 1 2 16v-1.5Z" fill="url(#${gradId})" stroke="${to}" stroke-width="0.6"/>
    <rect x="5.5" y="12.2" width="13" height="3.6" rx="1.8" fill="${visor}"/>
    <rect x="6.3" y="12.8" width="4.2" height="1" rx="0.5" fill="#ffffff" opacity="0.55"/>
  </svg>`;
}

const driverIcon = L.divIcon({
  html: `<div style="
    background:#f97316;
    border:3px solid white;
    border-radius:50%;
    width:32px;height:32px;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 8px rgba(0,0,0,.35);
  ">${helmetSvg("hgOrange", "#fff7ed", "#fb923c", "#c2410c", "#1e293b")}</div>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -18],
});

const idleIcon = L.divIcon({
  html: `<div style="
    background:#94a3b8;
    border:3px solid white;
    border-radius:50%;
    width:28px;height:28px;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 6px rgba(0,0,0,.25);
  ">${helmetSvg("hgGray", "#f8fafc", "#cbd5e1", "#64748b", "#1e293b")}</div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

interface Props {
  drivers: DriverRecord[];
  liveLocations: Record<string, LiveLocation>;
  activeDeliveries: ActiveDelivery[];
}

export default function TrackingMap({ drivers, liveLocations, activeDeliveries }: Props) {
  // Build visible markers: drivers with a known location
  const markers = drivers
    .map((d) => {
      const loc = liveLocations[d.id];
      if (!loc) return null;
      const delivery = activeDeliveries.find((o) => o.driverId === d.id);
      return { driver: d, loc, delivery };
    })
    .filter(Boolean) as { driver: DriverRecord; loc: LiveLocation; delivery: ActiveDelivery | undefined }[];

  // Center: average of visible markers or Brazil default
  const center: [number, number] =
    markers.length > 0
      ? [
          markers.reduce((s, m) => s + m.loc.lat, 0) / markers.length,
          markers.reduce((s, m) => s + m.loc.lng, 0) / markers.length,
        ]
      : [-14.235, -51.925];

  const zoom = markers.length > 0 ? 13 : 4;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%", borderRadius: "16px" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {markers.map(({ driver, loc, delivery }) => (
        <Marker
          key={driver.id}
          position={[loc.lat, loc.lng]}
          icon={delivery ? driverIcon : idleIcon}
        >
          <Popup>
            <div style={{ minWidth: 160 }}>
              <p style={{ fontWeight: 700, margin: "0 0 4px" }}>{driver.user.name}</p>
              {driver.vehicleType && (
                <p style={{ margin: "0 0 2px", fontSize: 12, color: "#64748b" }}>
                  {driver.vehicleType} {driver.vehiclePlate ? `· ${driver.vehiclePlate}` : ""}
                </p>
              )}
              {delivery ? (
                <>
                  <p style={{ margin: "4px 0 2px", fontSize: 12, fontWeight: 600, color: "#2563eb" }}>
                    Em entrega
                  </p>
                  {delivery.customer?.name && (
                    <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>{delivery.customer.name}</p>
                  )}
                  {delivery.deliveryAddress && (
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>{delivery.deliveryAddress}</p>
                  )}
                </>
              ) : (
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#16a34a" }}>Disponível</p>
              )}
              {loc.updatedAt !== "db" && (
                <p style={{ margin: "4px 0 0", fontSize: 10, color: "#94a3b8" }}>
                  GPS ao vivo · {new Date(loc.updatedAt).toLocaleTimeString("pt-BR")}
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
