"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/services/api";
import { getTrackingSocket } from "@/services/trackingSocket";

export interface DriverRecord {
  id: string;
  phone: string | null;
  vehicleType: string | null;
  vehiclePlate: string | null;
  isAvailable: boolean;
  currentLat: number | null;
  currentLng: number | null;
  companyId: string;
  user: { id: string; name: string; email: string; isActive: boolean };
}

export interface LiveLocation {
  driverId: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

export interface ActiveDelivery {
  id: string;
  source: string;
  status: string;
  driverId: string | null;
  deliveryAddress: string | null;
  total: number;
  customer: { name: string } | null;
}

export function useDriverTracking() {
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [liveLocations, setLiveLocations] = useState<Record<string, LiveLocation>>({});
  const [activeDeliveries, setActiveDeliveries] = useState<ActiveDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const joinedRooms = useRef<Set<string>>(new Set());

  const fetch = useCallback(async () => {
    const [driversRes, ordersRes] = await Promise.allSettled([
      api.get<DriverRecord[]>("/drivers"),
      api.get<ActiveDelivery[]>("/orders/kitchen"),
    ]);

    if (driversRes.status === "fulfilled") {
      const list = driversRes.value.data;
      setDrivers(list);
      // Seed live locations from persisted DB values (updated by GPS)
      setLiveLocations((prev) => {
        const fromDb: Record<string, LiveLocation> = {};
        list.forEach((d) => {
          if (d.currentLat != null && d.currentLng != null) {
            fromDb[d.id] = {
              driverId: d.id,
              lat: d.currentLat,
              lng: d.currentLng,
              updatedAt: "db",
            };
          }
        });
        // Socket-live values take precedence
        return { ...fromDb, ...prev };
      });
    }

    if (ordersRes.status === "fulfilled") {
      const deliveries = (ordersRes.value.data as ActiveDelivery[]).filter(
        (o) => o.status === "OUT_FOR_DELIVERY" && o.driverId,
      );
      setActiveDeliveries(deliveries);
    }

    setLoading(false);
  }, []);

  // Initial load + 30s HTTP fallback
  useEffect(() => {
    fetch();
    const timer = setInterval(fetch, 30_000);
    return () => clearInterval(timer);
  }, [fetch]);

  // Socket: join order rooms for active deliveries → receive driver:location broadcasts
  useEffect(() => {
    if (!activeDeliveries.length) return;

    const sock = getTrackingSocket();
    if (!sock.connected) sock.connect();

    activeDeliveries.forEach((order) => {
      if (!joinedRooms.current.has(order.id)) {
        sock.emit("track:order", order.id);
        joinedRooms.current.add(order.id);
      }
    });

    const onLocation = (payload: { lat: number; lng: number; driverId: string; timestamp: string }) => {
      setLiveLocations((prev) => ({
        ...prev,
        [payload.driverId]: {
          driverId: payload.driverId,
          lat: payload.lat,
          lng: payload.lng,
          updatedAt: payload.timestamp,
        },
      }));
    };

    sock.on("driver:location", onLocation);
    return () => { sock.off("driver:location", onLocation); };
  }, [activeDeliveries]);

  // KPIs
  const onlineCount    = drivers.filter((d) => d.user.isActive).length;
  const enRouteCount   = activeDeliveries.length;
  const availableCount = drivers.filter((d) => d.isAvailable && !activeDeliveries.find((o) => o.driverId === d.id)).length;

  return {
    drivers,
    liveLocations,
    activeDeliveries,
    loading,
    onlineCount,
    enRouteCount,
    availableCount,
    refresh: fetch,
  };
}
