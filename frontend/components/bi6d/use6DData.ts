"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/services/api";

export interface DataPoint6D {
  id:        string;
  // D1 + D2: posição XY — hora do dia (0-23) × receita (R$)
  x:         number; // hora: 0–23
  y:         number; // receita normalizada 0–1
  // D3: profundidade — categoria de produto (0 = delivery, 1 = balcão, 2 = mesa)
  z:         number;
  // D4: dimensão temporal — índice do dia (0 = mais antigo → N = hoje)
  t:         number;
  // D5: peso/densidade — volume de pedidos (raio da esfera 0.15–1.2)
  weight:    number;
  // D6: espectro de cor — saúde da margem (0=ruim=vermelho, 1=ótimo=verde)
  health:    number;
  // metadados
  label:     string;
  revenue:   number;
  orders:    number;
  margin:    number;
  date:      string;
}

export interface Scene6DData {
  points:    DataPoint6D[];
  maxRevenue: number;
  maxOrders:  number;
  days:       number;
}

function normalizeRevenue(rev: number, max: number): number {
  return max > 0 ? rev / max : 0;
}

function marginToHealth(margin: number): number {
  // margin 0–1 → health 0–1 (abaixo de 40% é crítico)
  if (margin >= 0.6) return 1.0;
  if (margin >= 0.4) return (margin - 0.4) / 0.2 * 0.5 + 0.5;
  return margin / 0.4 * 0.5;
}

function orderTypeToZ(type: string): number {
  if (type === "DELIVERY") return -1.5;
  if (type === "DINE_IN")  return  0;
  return 1.5; // PICKUP / balcão
}

export function use6DData(from: string, to: string) {
  const [data,    setData]    = useState<Scene6DData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!from || !to) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    async function load() {
      try {
        // Reutiliza os endpoints existentes do BI — zero backend novo
        const [kpiRes, reportRes] = await Promise.allSettled([
          api.get(`/reports/kpis?from=${from}&to=${to}`),
          api.get(`/reports/revenue?from=${from}&to=${to}`),
        ]);

        const kpi    = kpiRes.status    === "fulfilled" ? kpiRes.value.data    : null;
        const report = reportRes.status === "fulfilled" ? reportRes.value.data : null;

        if (!report?.dailySeries) {
          setData({ points: [], maxRevenue: 0, maxOrders: 0, days: 0 });
          return;
        }

        const series: { date: string; revenue: number; cmv: number; profit: number; orders: number }[]
          = report.dailySeries;

        const maxRevenue = Math.max(...series.map((d: any) => d.revenue), 1);
        const maxOrders  = Math.max(...series.map((d: any) => d.orders),  1);

        // Produtos top para enriquecer profundidade Z
        const topProducts: { productName: string; revenue: number; quantity: number; margin: number }[]
          = kpi?.topProducts ?? [];

        const points: DataPoint6D[] = series.flatMap((day, dayIdx) => {
          const margin = day.revenue > 0 ? day.profit / day.revenue : 0;

          // Um ponto base por dia (tipo misto)
          const base: DataPoint6D = {
            id:      `day-${dayIdx}`,
            x:       12, // meio-dia como default
            y:       normalizeRevenue(day.revenue, maxRevenue),
            z:       0,
            t:       dayIdx / Math.max(series.length - 1, 1),
            weight:  0.3 + (day.orders / maxOrders) * 0.9,
            health:  marginToHealth(margin),
            label:   day.date,
            revenue: day.revenue,
            orders:  day.orders,
            margin,
            date:    day.date,
          };

          // Pontos extras por produto top (enriquecem D3 e D6)
          const extras: DataPoint6D[] = topProducts.slice(0, 3).map((p, pi) => ({
            id:      `day-${dayIdx}-prod-${pi}`,
            x:       8 + pi * 4,
            y:       normalizeRevenue(p.revenue / series.length, maxRevenue) * 0.8,
            z:       (pi - 1) * 1.2,
            t:       dayIdx / Math.max(series.length - 1, 1),
            weight:  0.15 + (p.quantity / (maxOrders || 1)) * 0.5,
            health:  marginToHealth(p.margin ?? margin),
            label:   p.productName,
            revenue: p.revenue / series.length,
            orders:  p.quantity,
            margin:  p.margin ?? margin,
            date:    day.date,
          }));

          return [base, ...extras];
        });

        setData({ points, maxRevenue, maxOrders, days: series.length });
      } catch (e: any) {
        if (e?.name !== "CanceledError") setError(e?.message ?? "Erro ao carregar dados");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => ctrl.abort();
  }, [from, to]);

  return { data, loading, error };
}
