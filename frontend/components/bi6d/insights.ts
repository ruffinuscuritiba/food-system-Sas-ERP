/**
 * insights.ts — design de informação: extrai UMA frase útil e verdadeira dos
 * mesmos dados que alimentam a cena 3D, e aponta o ponto que a evidencia.
 *
 * Justificativa (por que isso existe): olhar pra uma nuvem de esferas girando
 * não é, por si só, mais útil que um gráfico 2D — o "porquê 3D" só se paga
 * quando o espaço revela uma correlação ENTRE camadas que exigiria abrir
 * vários relatórios separados e cruzar manualmente os horários. Esta função
 * faz esse cruzamento uma vez, de forma determinística (sem IA, sem custo),
 * e devolve a frase pronta pra aparecer nos primeiros segundos de tela.
 */

import type { DataPoint6D, DataLayer } from "./use6DData";

export interface HeadlineInsight {
  text: string;
  peakId: string | null;
}

const HOUR_LABEL_BUCKET = 2; // agrupa em janelas de 2h pra achar coincidência

function fmtMoney(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function bucketHour(x: number): number {
  return Math.floor(x / HOUR_LABEL_BUCKET) * HOUR_LABEL_BUCKET;
}

export function computeHeadlineInsight(points: DataPoint6D[]): HeadlineInsight {
  if (points.length === 0) return { text: "", peakId: null };

  const orderPoints = points.filter(p => p.layer === "orders");
  if (orderPoints.length === 0) return { text: "", peakId: null };

  // 1) Pico real de vendas (maior `value` entre pontos de Pedidos)
  const peak = orderPoints.reduce((a, b) => (b.value > a.value ? b : a));
  const avgOrderValue = orderPoints.reduce((s, p) => s + p.value, 0) / orderPoints.length;
  const pctAboveAvg = avgOrderValue > 0 ? ((peak.value - avgOrderValue) / avgOrderValue) * 100 : 0;
  const peakHour = bucketHour(peak.x);

  // 2) Coincidência entre camadas na MESMA janela de horário do pico —
  //    o cruzamento que um gráfico 2D não mostra de graça.
  const otherLayers: DataLayer[] = ["stock", "drivers", "visits", "funnel", "loyalty"];
  const findings: string[] = [];

  for (const layer of otherLayers) {
    const layerPoints = points.filter(p => p.layer === layer);
    if (layerPoints.length < 3) continue; // amostra pequena demais pra significar algo

    const inWindow = layerPoints.filter(p => Math.abs(bucketHour(p.x) - peakHour) <= HOUR_LABEL_BUCKET);
    if (inWindow.length === 0) continue;

    const avgHealthAll    = layerPoints.reduce((s, p) => s + p.health, 0) / layerPoints.length;
    const avgHealthWindow = inWindow.reduce((s, p) => s + p.health, 0) / inWindow.length;
    const drop = avgHealthAll > 0 ? (avgHealthAll - avgHealthWindow) / avgHealthAll : 0;

    if (drop > 0.25) {
      const label = layer === "stock" ? "queda na saúde do estoque"
        : layer === "drivers" ? "repasse de entregador menos estável"
        : layer === "visits" || layer === "funnel" ? "conversão mais baixa no cardápio digital"
        : "queda na fidelidade do ticket médio";
      findings.push(label);
    }
  }

  const hourLabel = `${peakHour}h–${peakHour + HOUR_LABEL_BUCKET}h`;
  if (findings.length > 0) {
    return {
      text: `Pico de vendas às ${hourLabel} (${fmtMoney(peak.value)}) coincide com ${findings[0]} nesse mesmo horário — um cruzamento que só aparece olhando as camadas juntas.`,
      peakId: peak.id,
    };
  }

  if (pctAboveAvg > 15) {
    return {
      text: `Seu momento mais forte foi às ${hourLabel}: ${fmtMoney(peak.value)}, ${pctAboveAvg.toFixed(0)}% acima da média do período.`,
      peakId: peak.id,
    };
  }

  return {
    text: `Vendas relativamente estáveis ao longo do período — sem um pico isolado se destacando das demais camadas.`,
    peakId: peak.id,
  };
}
