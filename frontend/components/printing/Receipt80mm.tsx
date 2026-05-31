/**
 * Receipt80mm — full admin/PDV receipt (80mm thermal width).
 *
 * Consolidates the printOrder() function previously duplicated in
 * app/orders/page.tsx and app/pdv/page.tsx into a single, typed builder.
 *
 * Usage:
 *   import { printTicket } from "@/components/printing/printTicket";
 *   import { buildReceipt80mm } from "@/components/printing/Receipt80mm";
 *
 *   printTicket(buildReceipt80mm(order, "Restaurante Bom"));
 */

import {
  type PrintableOrder,
  THERMAL_CSS,
  PAY_LABELS,
  TYPE_LABELS,
  fmtBrl,
  fmtTime,
  fmtDate,
  buildItemsHtml,
} from "./printTicket";

export type Receipt80mmOptions = {
  companyName?: string;
};

export function buildReceipt80mm(
  order: PrintableOrder,
  opts: Receipt80mmOptions = {},
): string {
  const companyName = opts.companyName || "Restaurante";

  const source      = order.source === "ONLINE" ? "ONLINE" : "PDV";
  const sourceCls   = source === "ONLINE" ? "source-online" : "source-pdv";
  const typeLabel   = TYPE_LABELS[order.orderType || "DINE_IN"] || "🍽️ Balcão";
  const payLabel    = PAY_LABELS[order.paymentMethod || ""] || order.paymentMethod || "—";

  const clientName  = order.customerName || order.customer?.name || "—";
  const clientPhone = order.customerPhone || order.customer?.phone || "";

  const statusLabel = order.status || order.orderStatus || "";

  const items = Array.isArray(order.items) ? order.items : [];

  const timestamp   = order.confirmedAt
    ? `${fmtDate(order.confirmedAt)} ${fmtTime(order.confirmedAt)}`
    : fmtDate(order.createdAt);

  const orderSeq    = order.id.slice(-8).toUpperCase();

  const deliveryFee = Number(order.deliveryFee ?? 0);
  const driverFee   = Number(order.driverFee   ?? 0);

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8"/>
      <title>Pedido #${orderSeq}</title>
      <style>${THERMAL_CSS}</style>
    </head>
    <body>

      <h1>${companyName}</h1>
      <div class="center small">${timestamp}</div>
      <hr/>

      <div class="center">
        <span class="source ${sourceCls}">[${source}]</span>
      </div>
      <div class="type">${typeLabel}</div>

      <div class="line"><span class="bold">Pedido:</span> #${orderSeq}</div>
      <div class="line"><span class="bold">Cliente:</span> ${clientName}</div>
      ${clientPhone ? `<div class="line"><span class="bold">Tel:</span> ${clientPhone}</div>` : ""}
      ${order.deliveryAddress ? `<div class="line"><span class="bold">Endereço:</span> ${order.deliveryAddress}</div>` : ""}
      <div class="line"><span class="bold">Pagamento:</span> ${payLabel}</div>

      <hr/>
      ${buildItemsHtml(items, true)}
      <hr/>

      ${deliveryFee > 0 ? `<div class="line"><span class="bold">Taxa entrega:</span> ${fmtBrl(deliveryFee)}</div>` : ""}
      ${driverFee   > 0 ? `<div class="line"><span class="bold">Taxa entregador:</span> ${fmtBrl(driverFee)}</div>` : ""}
      <div class="line total-line"><span class="bold">TOTAL:</span> ${fmtBrl(order.total)}</div>

      ${statusLabel ? `<hr/><div class="center bold" style="font-size:15px;">${statusLabel}</div>` : ""}

      <hr/>
      <div class="center small">Obrigado pela preferência!</div>

    </body>
    </html>
  `;
}
