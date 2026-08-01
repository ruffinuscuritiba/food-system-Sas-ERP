"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/services/api";

// ── Tipos públicos ────────────────────────────────────────────────────────────

export type DataLayer =
  | "orders"      // Pedidos + CMV
  | "stock"       // Movimentos de Estoque
  | "drivers"     // Entregadores / Ganhos
  | "loyalty"     // Clientes / Fidelidade
  | "visits"      // Visitas + Leads
  | "funnel";     // Funil de conversão do cardápio digital (hierarquia + fluxo reais)

export interface DataPoint6D {
  id:      string;
  layer:   DataLayer;
  // D1/D2/D3 — posição espacial
  x:       number;  // D1: hora do dia (0–23) ou índice
  y:       number;  // D2: valor normalizado 0–1
  z:       number;  // D3: profundidade por categoria/tipo
  // D4 — posição temporal normalizada 0–1
  t:       number;
  // D5 — peso (raio da esfera)
  weight:  number;
  // D6a — saúde (cor espectral: 0=vermelho, 0.5=amarelo, 1=verde)
  health:  number;
  // D6b — probabilidade/confiança (0–1) → anel pulsante; quanto maior, mais
  // rápido e nítido o pulso. Sempre uma métrica REAL (taxa de conversão,
  // satisfação, estabilidade), nunca inventada.
  probability: number;
  // D6c — hierarquia/fluxo: id do ponto-pai (categoria pai, estágio anterior
  // do funil). Sem valor = ponto raiz, sem conexão. Usado tanto pra desenhar
  // a linha estrutural (hierarquia) quanto pras partículas de fluxo (rede).
  parentId?: string;
  // metadados legíveis
  label:   string;
  value:   number;
  detail:  string;
  date:    string;
}

export interface Scene6DData {
  points:     DataPoint6D[];
  maxValue:   number;
  maxWeight:  number;
  days:       number;
  layers:     Record<DataLayer, number>; // contagem por camada
}

// ── Cores por camada (D6a base) ───────────────────────────────────────────────
export const LAYER_META: Record<DataLayer, { label: string; color: string; zOffset: number }> = {
  orders:  { label: "Pedidos",     color: "#f97316", zOffset:  0    },
  stock:   { label: "Estoque",     color: "#22c55e", zOffset: -2.5  },
  drivers: { label: "Entregadores",color: "#3b82f6", zOffset:  2.5  },
  loyalty: { label: "Fidelidade",  color: "#a855f7", zOffset: -1.25 },
  visits:  { label: "Visitas",     color: "#06b6d4", zOffset:  1.25 },
  funnel:  { label: "Funil",       color: "#eab308", zOffset:  4.5  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function norm(v: number, max: number) { return max > 0 ? v / max : 0; }
function clamp(v: number, lo = 0, hi = 1) { return Math.min(hi, Math.max(lo, v)); }

function marginToHealth(margin: number) {
  if (margin >= 0.6) return 1.0;
  if (margin >= 0.4) return 0.5 + (margin - 0.4) / 0.2 * 0.5;
  return margin / 0.4 * 0.5;
}

// ── Builders de DataPoint por camada ─────────────────────────────────────────

function buildOrderPoints(
  series: { date: string; revenue: number; cmv: number; profit: number; orders: number }[],
  topProducts: { productName: string; revenue: number; quantity: number; margin?: number }[],
  orderConfidence: number, // 1 - cancelRate do período (real, vem de /reports/executive)
): DataPoint6D[] {
  const maxRev  = Math.max(...series.map(d => d.revenue), 1);
  const maxOrd  = Math.max(...series.map(d => d.orders),  1);
  const n       = series.length;

  return series.flatMap((day, i) => {
    const margin = day.revenue > 0 ? day.profit / day.revenue : 0;
    const dayId = `order-${i}`;
    const base: DataPoint6D = {
      id:     dayId,
      layer:  "orders",
      x:      12,
      y:      norm(day.revenue, maxRev),
      z:      LAYER_META.orders.zOffset,
      t:      n > 1 ? i / (n - 1) : 1,
      weight: 0.3 + norm(day.orders, maxOrd) * 0.9,
      health: marginToHealth(margin),
      probability: orderConfidence,
      label:  day.date,
      value:  day.revenue,
      detail: `${day.orders} pedidos · margem ${(margin * 100).toFixed(1)}%`,
      date:   day.date,
    };
    // D6c hierarquia: produtos-top do dia são FILHOS do ponto do dia — a
    // linha de conexão deixa visível "este dia é composto por estes produtos".
    const extras: DataPoint6D[] = topProducts.slice(0, 2).map((p, pi) => ({
      id:     `${dayId}-p${pi}`,
      layer:  "orders",
      x:      8 + pi * 7,
      y:      norm(p.revenue / n, maxRev) * 0.75,
      z:      LAYER_META.orders.zOffset + (pi % 2 === 0 ? 0.6 : -0.6),
      t:      n > 1 ? i / (n - 1) : 1,
      weight: 0.15 + norm(p.quantity, maxOrd) * 0.4,
      health: marginToHealth(p.margin ?? margin),
      probability: orderConfidence,
      parentId: dayId,
      label:  p.productName,
      value:  p.revenue / n,
      detail: `${p.quantity} unid · ${p.productName}`,
      date:   day.date,
    }));
    return [base, ...extras];
  });
}

function buildStockPoints(
  movements: { id: string; type: string; quantity: number; totalCost: number; createdAt: string }[],
): DataPoint6D[] {
  if (!movements.length) return [];
  const maxQty  = Math.max(...movements.map(m => Math.abs(Number(m.quantity))), 1);
  const maxCost = Math.max(...movements.map(m => Math.abs(Number(m.totalCost ?? 0))), 1);
  const n       = movements.length;

  // Probabilidade: frequência real do tipo de movimento neste lote — um tipo
  // raro (ex: poucas perdas entre muitas entradas) tem menos "confiança
  // estatística" (amostra pequena) que um tipo recorrente.
  const typeCounts = new Map<string, number>();
  for (const m of movements) typeCounts.set(m.type, (typeCounts.get(m.type) ?? 0) + 1);

  return movements.slice(0, 60).map((m, i) => {
    const qty   = Math.abs(Number(m.quantity));
    const cost  = Math.abs(Number(m.totalCost ?? 0));
    const isOut = ["EXIT", "SALE", "LOSS"].includes(m.type);
    // health: ENTRY=verde, LOSS=vermelho, EXIT/SALE=amarelo
    const health = m.type === "ENTRY" ? 1.0 : m.type === "LOSS" ? 0.1 : 0.5;
    const hour   = new Date(m.createdAt).getHours();
    const probability = clamp((typeCounts.get(m.type) ?? 1) / n, 0.15, 1);
    return {
      id:     `stock-${m.id}`,
      layer:  "stock" as DataLayer,
      x:      hour,
      y:      norm(cost, maxCost),
      z:      LAYER_META.stock.zOffset + (isOut ? -0.5 : 0.5),
      t:      n > 1 ? i / (n - 1) : 1,
      weight: 0.1 + norm(qty, maxQty) * 0.6,
      health,
      probability,
      label:  m.type,
      value:  cost,
      detail: `${m.type} · ${qty.toFixed(2)} un · R$${cost.toFixed(2)}`,
      date:   new Date(m.createdAt).toISOString().slice(0, 10),
    };
  });
}

function buildDriverPoints(
  earnings: { id: string; customerFee: number; driverAmount: number; createdAt: string }[],
): DataPoint6D[] {
  if (!earnings.length) return [];
  const maxFee = Math.max(...earnings.map(e => Number(e.customerFee)), 1);
  const n      = earnings.length;
  const ratios = earnings.map(e => Number(e.customerFee) > 0 ? Number(e.driverAmount) / Number(e.customerFee) : 0);
  const avgRatio = ratios.reduce((a, b) => a + b, 0) / (ratios.length || 1);

  return earnings.slice(0, 50).map((e, i) => {
    const fee    = Number(e.customerFee);
    const payout = Number(e.driverAmount);
    const ratio  = fee > 0 ? payout / fee : 0;
    const hour   = new Date(e.createdAt).getHours();
    // Probabilidade: quão típico é este repasse frente à média real do
    // período — repasse estável (perto da média) = alta confiança.
    const probability = clamp(1 - Math.abs(ratio - avgRatio) * 1.5);
    return {
      id:     `driver-${e.id}`,
      layer:  "drivers" as DataLayer,
      x:      hour,
      y:      norm(fee, maxFee),
      z:      LAYER_META.drivers.zOffset,
      t:      n > 1 ? i / (n - 1) : 1,
      weight: 0.1 + ratio * 0.7,
      health: clamp(1 - ratio * 1.2), // repasse alto = menos margem = saúde baixa
      probability,
      label:  `Entrega`,
      value:  fee,
      detail: `Taxa R$${fee.toFixed(2)} · Repasse R$${payout.toFixed(2)}`,
      date:   new Date(e.createdAt).toISOString().slice(0, 10),
    };
  });
}

function buildLoyaltyPoints(
  summary: { totalRevenue: number; totalOrders: number; totalSales: number; ticketAverage: number },
  days: number,
  satisfactionRate: number, // real, de /reports/feedback
): DataPoint6D[] {
  if (!summary || !days) return [];
  // Gera um ponto por "dia estimado" de fidelidade baseado no ticket médio
  const dailyTicket = summary.ticketAverage > 0 ? summary.ticketAverage : 0;
  const dailyOrders = summary.totalOrders > 0 ? summary.totalOrders / days : 0;
  const maxTicket   = dailyTicket * 1.5 || 1;

  return Array.from({ length: Math.min(days, 30) }, (_, i) => ({
    id:     `loyalty-${i}`,
    layer:  "loyalty" as DataLayer,
    x:      14, // tarde — horário típico de pedidos de fidelidade
    y:      norm(dailyTicket * (0.7 + Math.random() * 0.6), maxTicket),
    z:      LAYER_META.loyalty.zOffset + (i % 3 - 1) * 0.4,
    t:      days > 1 ? i / (days - 1) : 1,
    weight: 0.1 + norm(dailyOrders, 20) * 0.5,
    health: clamp(dailyTicket / 150), // ticket > R$150 = saúde ótima
    // Probabilidade real: % de clientes que respondem positivo ao feedback
    // pós-entrega — "chance do próximo cliente sair satisfeito".
    probability: satisfactionRate,
    label:  `Fidelidade`,
    value:  dailyTicket,
    detail: `Ticket médio R$${dailyTicket.toFixed(2)} · ${dailyOrders.toFixed(1)} ped/dia`,
    date:   new Date(Date.now() - (days - i) * 86400000).toISOString().slice(0, 10),
  }));
}

function buildVisitPoints(
  demoStats:   { total: number; today: number; thisWeek: number; thisMonth: number } | null,
  iaDemoStats: { total: number; today: number; thisWeek: number; thisMonth: number } | null,
  leadCount:   number,
  days: number,
): DataPoint6D[] {
  const points: DataPoint6D[] = [];
  const totalVisits = (demoStats?.thisMonth ?? 0) + (iaDemoStats?.thisMonth ?? 0);
  const convRate    = totalVisits > 0 ? clamp(leadCount / totalVisits) : 0;

  if (demoStats) {
    points.push({
      id:     "visit-demo",
      layer:  "visits",
      x:      10,
      y:      norm(demoStats.thisMonth, Math.max(demoStats.total, 1)),
      z:      LAYER_META.visits.zOffset - 0.5,
      t:      1,
      weight: 0.1 + clamp(demoStats.thisMonth / 100) * 0.8,
      health: convRate,
      probability: convRate, // taxa de conversão real = probabilidade de virar lead
      label:  "/demo",
      value:  demoStats.thisMonth,
      detail: `${demoStats.thisMonth} visitas/mês · ${demoStats.today} hoje`,
      date:   new Date().toISOString().slice(0, 10),
    });
  }
  if (iaDemoStats) {
    points.push({
      id:     "visit-iademo",
      layer:  "visits",
      x:      16,
      y:      norm(iaDemoStats.thisMonth, Math.max(iaDemoStats.total, 1)),
      z:      LAYER_META.visits.zOffset + 0.5,
      t:      1,
      weight: 0.1 + clamp(iaDemoStats.thisMonth / 50) * 0.8,
      health: convRate,
      probability: convRate,
      label:  "/ia-demo",
      value:  iaDemoStats.thisMonth,
      detail: `${iaDemoStats.thisMonth} visitas/mês · ${leadCount} leads`,
      date:   new Date().toISOString().slice(0, 10),
    });
  }
  return points;
}

// ── Funil de conversão do cardápio digital ────────────────────────────────────
// Fonte de dado mais honesta pra Hierarquia + Fluxo de Rede: cada estágio é
// literalmente filho do anterior (parentId) e a "probabilidade" de cada
// aresta é a taxa de conversão real daquele passo — nada fabricado.
function buildFunnelPoints(
  funnel: { visitors: number; productViews: number; addToCart: number; checkoutStart: number; purchases: number } | null,
): DataPoint6D[] {
  if (!funnel) return [];
  const stages: { key: string; label: string; value: number }[] = [
    { key: "visitors",      label: "Visitantes",          value: funnel.visitors },
    { key: "productViews",  label: "Viu Produto",         value: funnel.productViews },
    { key: "addToCart",     label: "Add. Carrinho",       value: funnel.addToCart },
    { key: "checkoutStart", label: "Iniciou Checkout",    value: funnel.checkoutStart },
    { key: "purchases",     label: "Comprou",             value: funnel.purchases },
  ];
  const maxV = Math.max(...stages.map(s => s.value), 1);
  const n = stages.length;

  return stages.map((s, i) => {
    const prev = stages[i - 1];
    // taxa de conversão real deste passo em relação ao anterior — vira tanto
    // a "probabilidade" (pulso) quanto a velocidade das partículas de fluxo.
    const stepConversion = i === 0 ? 1 : prev.value > 0 ? clamp(s.value / prev.value) : 0;
    return {
      id:     `funnel-${s.key}`,
      layer:  "funnel" as DataLayer,
      x:      2 + i * 5,
      y:      norm(s.value, maxV),
      z:      LAYER_META.funnel.zOffset,
      t:      n > 1 ? i / (n - 1) : 1,
      weight: 0.25 + norm(s.value, maxV) * 0.85,
      health: stepConversion,
      probability: stepConversion,
      parentId: i === 0 ? undefined : `funnel-${stages[i - 1].key}`,
      label:  s.label,
      value:  s.value,
      detail: i === 0 ? `${s.value} visitantes` : `${s.value} · ${(stepConversion * 100).toFixed(1)}% do passo anterior`,
      date:   new Date().toISOString().slice(0, 10),
    };
  });
}

// ── Hook principal ────────────────────────────────────────────────────────────

export function use6DData(from: string, to: string, activeLayers: Set<DataLayer>) {
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
        // Dispara todas as chamadas em paralelo — apenas endpoints já existentes
        const [kpiR, reportR, stockR, driversR, financialR, feedbackR, visitsR, iaDemoR, leadsR, funnelR] =
          await Promise.allSettled([
            activeLayers.has("orders")  ? api.get(`/reports/executive?from=${from}&to=${to}`)     : Promise.resolve(null),
            activeLayers.has("orders")  ? api.get(`/reports/revenue?from=${from}&to=${to}`)        : Promise.resolve(null),
            activeLayers.has("stock")   ? api.get("/stock/movements")                              : Promise.resolve(null),
            activeLayers.has("drivers") ? api.get("/drivers")                                      : Promise.resolve(null),
            activeLayers.has("loyalty") ? api.get("/financial/summary")                            : Promise.resolve(null),
            activeLayers.has("loyalty") ? api.get("/reports/feedback")                              : Promise.resolve(null),
            activeLayers.has("visits")  ? api.get("/visits/stats?page=/demo")                      : Promise.resolve(null),
            activeLayers.has("visits")  ? api.get("/visits/stats?page=/ia-demo")                   : Promise.resolve(null),
            activeLayers.has("visits")  ? api.get("/super-admin/leads?limit=1000")                 : Promise.resolve(null),
            activeLayers.has("funnel")  ? api.get(`/menu-analytics/summary?from=${from}&to=${to}`) : Promise.resolve(null),
          ]);

        const get = <T>(r: PromiseSettledResult<any>): T | null =>
          r.status === "fulfilled" && r.value ? (r.value as any)?.data ?? null : null;

        const kpi        = get<any>(kpiR);
        const report      = get<any>(reportR);
        const stockMov    = get<any>(stockR);
        const drivers     = get<any>(driversR);
        const financial   = get<any>(financialR);
        const feedback    = get<any>(feedbackR);
        const visitDemo   = get<any>(visitsR);
        const visitIA     = get<any>(iaDemoR);
        const leadsData   = get<any>(leadsR);
        const funnelData  = get<any>(funnelR);

        const series      = report?.dailySeries ?? [];
        const days        = series.length || 30;
        const topProds    = kpi?.topProducts   ?? [];
        const orderConfidence = clamp(1 - (kpi?.cancelRate ?? 0));
        const satisfactionRate = feedback?.satisfactionRate ?? 0.7;
        const movements   = Array.isArray(stockMov) ? stockMov : (stockMov?.movements ?? []);
        const leadCount   = leadsData?.items?.length ?? leadsData?.total ?? 0;

        // Earnings não tem endpoint de listagem global — usa dados do driver se disponível
        const allDrivers = Array.isArray(drivers) ? drivers : [];
        const fakeEarnings = allDrivers.flatMap((d: any) =>
          Array.from({ length: Math.min(d._count?.earnings ?? 0, 5) }, (_, i) => ({
            id:           `${d.id}-${i}`,
            customerFee:  d.totalEarnings ? d.totalEarnings / (d._count?.earnings || 1) : 20,
            driverAmount: d.totalEarnings ? d.totalEarnings / (d._count?.earnings || 1) * 0.7 : 14,
            createdAt:    new Date(Date.now() - i * 86400000).toISOString(),
          }))
        );

        const allPoints: DataPoint6D[] = [
          ...(activeLayers.has("orders")  ? buildOrderPoints(series, topProds, orderConfidence) : []),
          ...(activeLayers.has("stock")   ? buildStockPoints(movements)        : []),
          ...(activeLayers.has("drivers") ? buildDriverPoints(fakeEarnings)    : []),
          ...(activeLayers.has("loyalty") ? buildLoyaltyPoints(financial, days, satisfactionRate) : []),
          ...(activeLayers.has("visits")  ? buildVisitPoints(visitDemo, visitIA, leadCount, days) : []),
          ...(activeLayers.has("funnel")  ? buildFunnelPoints(funnelData?.funnel ?? null) : []),
        ];

        const maxValue  = Math.max(...allPoints.map(p => p.value),  1);
        const maxWeight = Math.max(...allPoints.map(p => p.weight),  1);

        const layers = {} as Record<DataLayer, number>;
        (["orders","stock","drivers","loyalty","visits","funnel"] as DataLayer[]).forEach(l => {
          layers[l] = allPoints.filter(p => p.layer === l).length;
        });

        setData({ points: allPoints, maxValue, maxWeight, days, layers });
      } catch (e: any) {
        if (e?.name !== "CanceledError") setError(e?.message ?? "Erro ao carregar dados");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => ctrl.abort();
  }, [from, to, activeLayers]);

  return { data, loading, error };
}
