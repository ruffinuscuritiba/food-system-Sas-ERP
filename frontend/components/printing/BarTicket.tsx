/**
 * BarTicket — ticket para o setor de bar/bebidas (80mm).
 *
 * Exibe apenas itens de bebidas. Sem preços, sem informação financeira.
 * Fontes grandes para leitura a distância — mesmo padrão do KitchenTicket.
 *
 * Usage:
 *   import { buildBarTicket } from "@/components/printing/BarTicket";
 *   printDispatcher({ sector: "BAR", html: buildBarTicket(order) });
 */

import {
  type PrintableOrder,
  THERMAL_CSS,
  TYPE_LABELS,
  fmtTime,
} from "./printTicket";

const BAR_CSS = `
  body         { font-size: 14px; }
  h1           { font-size: 26px; letter-spacing: 2px; }
  .type        { font-size: 20px; margin: 6px 0; }
  .item-name   { font-size: 22px !important; font-weight: 900 !important; }
  .item-obs    { font-size: 16px !important; }
  .item-comp   { font-size: 16px !important; margin-left: 12px !important; }
  .line        { font-size: 16px; margin-bottom: 8px; }
  .seq         { font-size: 36px; font-weight: 900; text-align: center; letter-spacing: 4px; }
  .bar-accent  { color: #1d4ed8; }
`;

export function buildBarTicket(order: PrintableOrder): string {
  const typeLabel = TYPE_LABELS[order.orderType || "DINE_IN"] || "🍽️ Balcão";
  const clientName = order.customerName || order.customer?.name || order.notes || "—";
  const orderSeq  = order.number ? String(order.number) : order.id.slice(-8).toUpperCase();
  const time      = fmtTime(order.createdAt || new Date().toISOString());

  const items = (Array.isArray(order.items) ? order.items : [])
    .filter((it: any) => (it.categoryType ?? "normal") === "bebidas");

  const itemsHtml = items.map(item => {
    const name        = item.productName || item.name || "Item";
    const complements = Array.isArray(item.selectedComplements) ? item.selectedComplements : [];
    const compsHtml   = complements
      .map(c => `<div class="item-comp">+ ${c.quantity}x ${c.optionName}</div>`)
      .join("");

    return `
      <div style="margin-bottom:14px;border-left:4px solid #1d4ed8;padding-left:8px;">
        <div class="item-name">${item.quantity}x ${name}</div>
        ${item.notes ? `<div class="item-obs">⚠ ${item.notes}</div>` : ""}
        ${compsHtml}
      </div>
    `;
  }).join("");

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8"/>
      <title>Bar #${orderSeq}</title>
      <style>${THERMAL_CSS}${BAR_CSS}</style>
    </head>
    <body>

      <h1 class="bar-accent">BAR</h1>
      <div class="seq bar-accent">#${orderSeq}</div>
      <div class="center small">${time}</div>
      <hr/>

      <div class="type">${typeLabel}</div>
      <div class="line"><span class="bold">Cliente:</span> ${clientName}</div>

      <hr/>
      ${itemsHtml}
      <hr/>

      <div class="center small">Apenas bebidas deste pedido</div>

    </body>
    </html>
  `;
}
