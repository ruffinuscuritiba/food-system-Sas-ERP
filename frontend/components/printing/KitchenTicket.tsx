/**
 * KitchenTicket — ticket para a tela da cozinha (80mm, fontes grandes).
 *
 * Consolida o printKitchenOrder() anteriormente em app/kitchen/page.tsx.
 * Prioriza legibilidade a distância: nome do item em fonte grande,
 * tipo de atendimento em destaque, preços secundários.
 *
 * Usage:
 *   import { printTicket } from "@/components/printing/printTicket";
 *   import { buildKitchenTicket } from "@/components/printing/KitchenTicket";
 *
 *   printTicket(buildKitchenTicket(order));
 */

import {
  type PrintableOrder,
  THERMAL_CSS,
  TYPE_LABELS,
  PAY_LABELS,
  fmtBrl,
  fmtTime,
  buildQrFooterHtml,
} from "./printTicket";

/** Kitchen-specific CSS overrides on top of THERMAL_CSS */
const KITCHEN_CSS = `
  body         { font-size: 14px; }
  h1           { font-size: 26px; letter-spacing: 2px; }
  .type        { font-size: 22px; margin: 6px 0; }
  .item-name   { font-size: 22px !important; font-weight: 900 !important; }
  .item-obs    { font-size: 16px !important; }
  .item-comp   { font-size: 16px !important; margin-left: 12px !important; }
  .item-price  { font-size: 14px !important; }
  .line        { font-size: 16px; margin-bottom: 8px; }
  .total-line  { font-size: 18px !important; }
  .seq         { font-size: 36px; font-weight: 900; text-align: center; letter-spacing: 4px; }
`;

export function buildKitchenTicket(order: PrintableOrder, sectorLabel: string = "COZINHA"): string {
  const source    = order.source === "ONLINE" ? "ONLINE" : "PDV";
  const typeLabel = TYPE_LABELS[order.orderType || "DINE_IN"] || "🍽️ Balcão";
  const payLabel  = PAY_LABELS[order.paymentMethod || ""] || order.paymentMethod || "—";

  const clientName  = order.customerName || order.customer?.name || order.notes || "—";
  const clientPhone = order.customerPhone || order.customer?.phone || "";

  const items    = Array.isArray(order.items) ? order.items : [];
  const orderSeq = order.number ? String(order.number) : order.id.slice(-8).toUpperCase();
  const time     = fmtTime(order.createdAt || new Date().toISOString());

  // Kitchen ticket: show prices only as secondary info
  const itemsHtml = items.map(item => {
    const name        = item.productName || item.name || "Item";
    const complements = Array.isArray(item.selectedComplements) ? item.selectedComplements : [];
    const compsHtml   = complements.map(c =>
      `<div class="item-comp">+ ${c.quantity}x ${c.optionName}${Number(c.price) > 0 ? ` (${fmtBrl(c.price)})` : ""}</div>`
    ).join("");

    return `
      <div style="margin-bottom:14px;border-left:4px solid #111;padding-left:8px;">
        <div class="item-name">${item.quantity}x ${name}</div>
        ${item.notes ? `<div class="item-obs">⚠ ${item.notes}</div>` : ""}
        ${compsHtml}
        <div class="item-price" style="color:#666;">${fmtBrl(item.subtotal ?? 0)}</div>
      </div>
    `;
  }).join("");

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8"/>
      <title>${sectorLabel} #${orderSeq}</title>
      <style>${THERMAL_CSS}${KITCHEN_CSS}</style>
    </head>
    <body>

      <h1>${sectorLabel}</h1>
      <div class="seq">#${orderSeq}</div>
      <div class="center small">${time}</div>
      <hr/>

      <div class="type">${typeLabel}</div>
      <div class="center small" style="margin-bottom:6px;">[${source}]</div>

      <div class="line"><span class="bold">Cliente:</span> ${clientName}</div>
      ${clientPhone ? `<div class="line"><span class="bold">Tel:</span> ${clientPhone}</div>` : ""}
      ${order.deliveryAddress ? `<div class="line"><span class="bold">Endereço:</span> ${order.deliveryAddress}</div>` : ""}
      <div class="line"><span class="bold">Pgto:</span> ${payLabel}</div>
      <div class="line total-line"><span class="bold">TOTAL:</span> ${fmtBrl(order.total)}</div>

      <hr/>
      ${itemsHtml}
      <hr/>

      <div class="center bold" style="font-size:15px;">${order.status || order.orderStatus || ""}</div>

      ${order.printBlock ? buildQrFooterHtml(order.printBlock) : ""}

    </body>
    </html>
  `;
}
