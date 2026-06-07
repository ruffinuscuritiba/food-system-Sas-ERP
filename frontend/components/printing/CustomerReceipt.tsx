/**
 * CustomerReceipt — comprovante para o cliente final (80mm).
 *
 * Usado em:
 *   - app/pedido/confirmado/page.tsx  → botão "Imprimir comprovante"
 *   - app/orders/page.tsx             → reimpressão pós-entrega
 *
 * Diferenças em relação ao Receipt80mm:
 *   - Sem badge de origem [PDV]/[ONLINE] (irrelevante para o cliente)
 *   - Sem custo/margem (nunca exibidos ao cliente)
 *   - Status de pedido em destaque
 *   - URL de rastreamento quando disponível
 *   - Tom mais amigável ("Obrigado", status em português)
 *
 * Usage:
 *   import { printTicket } from "@/components/printing/printTicket";
 *   import { buildCustomerReceipt } from "@/components/printing/CustomerReceipt";
 *
 *   printTicket(buildCustomerReceipt(order, { trackingUrl: "..." }));
 */

import {
  type PrintableOrder,
  THERMAL_CSS,
  TYPE_LABELS,
  PAY_LABELS,
  fmtBrl,
  fmtTime,
  fmtDate,
  buildItemsHtml,
} from "./printTicket";

export type CustomerReceiptOptions = {
  companyName?: string;
  trackingUrl?: string;
};

const STATUS_PT: Record<string, string> = {
  PENDING:          "Recebido",
  CONFIRMED:        "Confirmado",
  PREPARING:        "Em preparo",
  READY:            "Pronto",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED:        "Entregue",
  CANCELLED:        "Cancelado",
  // OnlineOrder aliases
  DELIVERING:       "Saiu para entrega",
  COMPLETED:        "Entregue",
  CANCELED:         "Cancelado",
};

export function buildCustomerReceipt(
  order: PrintableOrder,
  opts: CustomerReceiptOptions = {},
): string {
  const companyName = opts.companyName || "Restaurante";

  const typeLabel   = TYPE_LABELS[order.orderType || "DINE_IN"] || "🍽️ Atendimento";
  const payLabel    = PAY_LABELS[order.paymentMethod || ""] || order.paymentMethod || "—";

  const clientName  = order.customerName || order.customer?.name || "";
  const clientPhone = order.customerPhone || order.customer?.phone || "";

  const rawStatus   = order.status || order.orderStatus || "";
  const statusPt    = STATUS_PT[rawStatus.toUpperCase()] || rawStatus;

  const orderSeq    = order.number ? String(order.number) : order.id.slice(-8).toUpperCase();
  const dateStr     = fmtDate(order.createdAt);
  const timeStr     = fmtTime(order.createdAt);

  const items        = Array.isArray(order.items) ? order.items : [];
  const deliveryFee  = Number(order.deliveryFee ?? 0);

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8"/>
      <title>Comprovante #${orderSeq}</title>
      <style>
        ${THERMAL_CSS}
        h1 { font-size: 20px; }
        .status-box {
          border: 2px solid #111;
          border-radius: 4px;
          padding: 6px 12px;
          text-align: center;
          font-size: 15px;
          font-weight: bold;
          margin: 8px 0;
        }
        .tagline {
          font-size: 12px;
          text-align: center;
          color: #555;
          margin-top: 10px;
        }
      </style>
    </head>
    <body>

      <h1>${companyName}</h1>
      <div class="center small">${dateStr} ${timeStr}</div>
      <hr/>

      <div class="center bold" style="font-size:15px;">COMPROVANTE DO PEDIDO</div>
      <div class="center" style="font-size:22px;font-weight:900;letter-spacing:3px;">#${orderSeq}</div>
      <hr/>

      <div class="type">${typeLabel}</div>

      ${clientName  ? `<div class="line"><span class="bold">Cliente:</span> ${clientName}</div>` : ""}
      ${clientPhone ? `<div class="line"><span class="bold">Tel:</span> ${clientPhone}</div>` : ""}
      ${order.deliveryAddress ? `<div class="line"><span class="bold">Endereço:</span> ${order.deliveryAddress}</div>` : ""}
      <div class="line"><span class="bold">Pagamento:</span> ${payLabel}</div>

      <hr/>
      ${buildItemsHtml(items, true)}
      <hr/>

      ${deliveryFee > 0 ? `<div class="line"><span class="bold">Taxa entrega:</span> ${fmtBrl(deliveryFee)}</div>` : ""}
      <div class="line total-line"><span class="bold">TOTAL:</span> ${fmtBrl(order.total)}</div>

      ${statusPt ? `<div class="status-box">${statusPt}</div>` : ""}

      ${opts.trackingUrl ? `
        <hr/>
        <div class="center small">Acompanhe seu pedido:</div>
        <div class="center small" style="word-break:break-all;">${opts.trackingUrl}</div>
      ` : ""}

      <hr/>
      <div class="tagline">Obrigado pela preferência!</div>
      <div class="tagline">Volte sempre 🙏</div>

    </body>
    </html>
  `;
}
