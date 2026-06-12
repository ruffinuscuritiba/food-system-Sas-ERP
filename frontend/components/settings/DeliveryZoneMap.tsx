"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Popup,
  useMapEvents,
} from "react-leaflet";
import { useEffect } from "react";

// Fix Leaflet webpack icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const storeIcon = L.divIcon({
  html: `<div style="
    background:#1e293b;border:3px solid #f97316;border-radius:50%;
    width:34px;height:34px;display:flex;align-items:center;
    justify-content:center;font-size:16px;
    box-shadow:0 2px 8px rgba(0,0,0,.4);">🏪</div>`,
  className: "",
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -20],
});

export interface DeliveryZone {
  id: string;
  name: string;
  type: string;
  neighborhood: string | null;
  clientFee: number;
  driverShare: number;
  isActive: boolean;
  radiusKm: number | null;
  lat: number | null;
  lng: number | null;
  color: string;
}

interface Props {
  zones: DeliveryZone[];
  storeLat: number | null;
  storeLng: number | null;
  onMapClick?: (lat: number, lng: number) => void;
  clickMode?: "store" | "zone" | null;
}

// Default center: Curitiba, PR
const DEFAULT_CENTER: [number, number] = [-25.4284, -49.2733];
const DEFAULT_ZOOM = 12;

function ClickCapture({
  onMapClick,
  active,
}: {
  onMapClick?: (lat: number, lng: number) => void;
  active: boolean;
}) {
  useMapEvents({
    click(e) {
      if (active && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export default function DeliveryZoneMap({
  zones,
  storeLat,
  storeLng,
  onMapClick,
  clickMode,
}: Props) {
  const center: [number, number] =
    storeLat && storeLng ? [storeLat, storeLng] : DEFAULT_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={DEFAULT_ZOOM}
      style={{ width: "100%", height: "100%", borderRadius: "12px" }}
      className={clickMode ? "cursor-crosshair" : ""}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickCapture onMapClick={onMapClick} active={!!clickMode} />

      {/* Store pin */}
      {storeLat && storeLng && (
        <Marker position={[storeLat, storeLng]} icon={storeIcon}>
          <Popup>
            <span className="font-semibold text-sm">📍 Sua loja</span>
          </Popup>
        </Marker>
      )}

      {/* Zones */}
      {zones
        .filter((z) => z.isActive)
        .map((zone) => {
          if (zone.type === "RADIUS" && zone.radiusKm) {
            const center: [number, number] =
              zone.lat && zone.lng
                ? [zone.lat, zone.lng]
                : storeLat && storeLng
                  ? [storeLat, storeLng]
                  : DEFAULT_CENTER;
            return (
              <Circle
                key={zone.id}
                center={center}
                radius={zone.radiusKm * 1000} // meters
                pathOptions={{
                  color: zone.color,
                  fillColor: zone.color,
                  fillOpacity: 0.12,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-xs">
                    <strong>{zone.name}</strong>
                    <br />
                    Raio: {zone.radiusKm} km
                    <br />
                    Taxa: R$ {Number(zone.clientFee).toFixed(2)}
                  </div>
                </Popup>
              </Circle>
            );
          }

          // NEIGHBORHOOD — show a pin at store center (approximation)
          if (zone.type === "NEIGHBORHOOD" && storeLat && storeLng) {
            const pinIcon = L.divIcon({
              html: `<div style="
                background:${zone.color};color:#fff;border:2px solid white;
                border-radius:6px;padding:2px 6px;font-size:10px;font-weight:700;
                white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.3);">
                ${zone.neighborhood ?? zone.name}
              </div>`,
              className: "",
              iconAnchor: [0, 0],
            });
            // Spread pins slightly around store to avoid overlap
            const offset = 0.005 * (zones.indexOf(zone) + 1);
            return (
              <Marker
                key={zone.id}
                position={[storeLat + offset * 0.4, storeLng + offset]}
                icon={pinIcon}
              >
                <Popup>
                  <div className="text-xs">
                    <strong>{zone.name}</strong>
                    <br />
                    {zone.neighborhood && <>Bairro: {zone.neighborhood}<br /></>}
                    Taxa: R$ {Number(zone.clientFee).toFixed(2)}
                  </div>
                </Popup>
              </Marker>
            );
          }

          return null;
        })}
    </MapContainer>
  );
}
