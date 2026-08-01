/**
 * insights.ts — design de informação: extrai UMA frase útil e verdadeira dos
 * mesmos dados que alimentam a cena 3D, e aponta os DOIS pontos que a
 * evidenciam (não só um) — pra cena poder contar a história (feixe ligando
 * as duas camadas, câmera enquadrando os dois) em vez do usuário procurar.
 *
 * Justificativa (por que isso existe): olhar pra uma nuvem de esferas girando
 * não é, por si só, mais útil que um gráfico 2D — o "porquê 3D" só se paga
 * quando o espaço revela uma correlação ENTRE camadas que exigiria abrir
 * vários relatórios separados e cruzar manualmente os horários. Esta função
 * faz esse cruzamento uma vez, de forma determinística (sem IA, sem custo),
 * e devolve a frase + os dois pontos prontos pra cena guiar o olho até eles.
 */

import type { DataPoint6D, DataLayer } from "./use6DData";

export type InsightImpact = "ALTO" | "MEDIO" | "BAIXO";

export interface HeadlineInsight {
  text: string;
  peakId: string | null;
  /** Ponto da OUTRA camada que evidencia a coincidência — null se o insight
   *  é só "pico de vendas" sem cruzamento (não há segunda camada pra ligar). */
  correlatedId: string | null;
  /** Rótulos curtos das duas camadas envolvidas, pra tag na UI ("Pedidos + Estoque"). */
  layerTags: [string, string] | null;
  /** Severidade estimada — derivada da MAGNITUDE real do achado (queda %
   *  na janela cruzada, ou % acima da média no caso de pico isolado), nunca
   *  um número arbitrário. Vira o resumo fixo que fica depois da animação. */
  impact: InsightImpact | null;
}

const HOUR_LABEL_BUCKET = 2; // agrupa em janelas de 2h pra achar coincidência

const LAYER_SHORT_LABEL: Record<DataLayer, string> = {
  orders: "Pedidos", stock: "Estoque", drivers: "Entregadores",
  loyalty: "Fidelidade", visits: "Visitas", funnel: "Cardápio",
};

function fmtMoney(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function bucketHour(x: number): number {
  return Math.floor(x / HOUR_LABEL_BUCKET) * HOUR_LABEL_BUCKET;
}

export function computeHeadlineInsight(points: DataPoint6D[]): HeadlineInsight {
  const empty: HeadlineInsight = { text: "", peakId: null, correlatedId: null, layerTags: null, impact: null };
  if (points.length === 0) return empty;

  const orderPoints = points.filter(p => p.layer === "orders");
  if (orderPoints.length === 0) return empty;

  // 1) Pico real de vendas (maior `value` entre pontos de Pedidos)
  const peak = orderPoints.reduce((a, b) => (b.value > a.value ? b : a));
  const avgOrderValue = orderPoints.reduce((s, p) => s + p.value, 0) / orderPoints.length;
  const pctAboveAvg = avgOrderValue > 0 ? ((peak.value - avgOrderValue) / avgOrderValue) * 100 : 0;
  const peakHour = bucketHour(peak.x);

  // 2) Coincidência entre camadas na MESMA janela de horário do pico — o
  //    cruzamento que um gráfico 2D não mostra sem virar vários gráficos.
  //    Guarda o PONTO específico (não só a média) que evidencia a queda —
  //    é ele que a cena vai iluminar junto com o pico.
  const otherLayers: DataLayer[] = ["stock", "drivers", "visits", "funnel", "loyalty"];
  let bestFinding: { layer: DataLayer; label: string; point: DataPoint6D; drop: number } | null = null;

  for (const layer of otherLayers) {
    const layerPoints = points.filter(p => p.layer === layer);
    if (layerPoints.length < 3) continue; // amostra pequena demais pra significar algo

    const inWindow = layerPoints.filter(p => Math.abs(bucketHour(p.x) - peakHour) <= HOUR_LABEL_BUCKET);
    if (inWindow.length === 0) continue;

    const avgHealthAll = layerPoints.reduce((s, p) => s + p.health, 0) / layerPoints.length;
    const worstInWindow = inWindow.reduce((a, b) => (b.health < a.health ? b : a));
    const drop = avgHealthAll > 0 ? (avgHealthAll - worstInWindow.health) / avgHealthAll : 0;

    if (drop > 0.25 && (!bestFinding || drop > bestFinding.drop)) {
      const label = layer === "stock" ? "queda na saúde do estoque"
        : layer === "drivers" ? "repasse de entregador menos estável"
        : layer === "visits" || layer === "funnel" ? "conversão mais baixa no cardápio digital"
        : "queda na fidelidade do ticket médio";
      bestFinding = { layer, label, point: worstInWindow, drop };
    }
  }

  const hourLabel = `${peakHour}h–${peakHour + HOUR_LABEL_BUCKET}h`;
  if (bestFinding) {
    const impact: InsightImpact = bestFinding.drop > 0.5 ? "ALTO" : bestFinding.drop > 0.35 ? "MEDIO" : "BAIXO";
    return {
      text: `Pico de vendas às ${hourLabel} (${fmtMoney(peak.value)}) coincide com ${bestFinding.label} nesse mesmo horário — um cruzamento que só aparece olhando as camadas juntas.`,
      peakId: peak.id,
      correlatedId: bestFinding.point.id,
      layerTags: [LAYER_SHORT_LABEL.orders, LAYER_SHORT_LABEL[bestFinding.layer]],
      impact,
    };
  }

  if (pctAboveAvg > 15) {
    const impact: InsightImpact = pctAboveAvg > 40 ? "ALTO" : pctAboveAvg > 25 ? "MEDIO" : "BAIXO";
    return {
      text: `Seu momento mais forte foi às ${hourLabel}: ${fmtMoney(peak.value)}, ${pctAboveAvg.toFixed(0)}% acima da média do período.`,
      peakId: peak.id,
      correlatedId: null,
      layerTags: null,
      impact,
    };
  }

  return {
    text: `Vendas relativamente estáveis ao longo do período — sem um pico isolado se destacando das demais camadas.`,
    peakId: peak.id,
    correlatedId: null,
    layerTags: null,
    impact: "BAIXO",
  };
}
