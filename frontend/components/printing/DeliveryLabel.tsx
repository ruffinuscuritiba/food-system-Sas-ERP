/**
 * DeliveryLabel — etiqueta de entrega para o setor de delivery (80mm).
 *
 * Foco: endereço grande e legível, dados do cliente, forma de pagamento.
 * NÃO expõe: custos internos, margem, CMV, taxa do entregador, financeiro.
 *
 * Usage:
 *   import { buildDeliveryLabel } from "@/components/printing/DeliveryLabel";
 *   printDispatcher({ sector: "DELIVERY", html: buildDeliveryLabel(order) });
 */

import {
  type PrintableOrder,
  THERMAL_CSS,
  PAY_LABELS,
  fmtBrl,
  fmtTime,
} from "./printTicket";

const DELIVERY_CSS = `
  body          { font-size: 14px; }
  h1            { font-size: 22px; letter-spacing: 2px; }
  .seq          { font-size: 36px; font-weight: 900; text-align: center; letter-spacing: 4px; }
  .addr-line    { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .addr-detail  { font-size: 14px; color: #333; margin-bottom: 3px; }
  .pay-box      { border: 2px solid #111; border-radius: 4px; padding: 6px 10px; margin: 8px 0; }
  .pay-label    { font-size: 16px; font-weight: 900; }
  .troco-box    { border: 2px dashed #111; border-radius: 4px; padding: 6px 10px; margin: 8px 0; }
  .troco-label  { font-size: 16px; font-weight: 900; color: #b91c1c; }
  .total-line   { font-size: 18px; font-weight: 900; }
  .line         { font-size: 15px; margin-bottom: 6px; }
`;

export function buildDeliveryLabel(order: PrintableOrder): string {
  const orderSeq   = order.id.slice(-8).toUpperCase();
  const time       = fmtTime(order.createdAt || new Date().toISOString());
  const clientName = order.customerName || order.customer?.name || "—";
  const clientPhone= order.customerPhone || order.customer?.phone || "";
  const payLabel   = PAY_LABELS[order.paymentMethod || ""] || order.paymentMethod || "—";

  // Parse address from deliveryAddress string or use fields if available
  const address = order.deliveryAddress || "Endereço não informado";

  const isCash = order.paymentMethod === "CASH";
  const total  = Number(order.total ?? 0);

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8"/>
      <title>Delivery #${orderSeq}</title>
      <style>${THERMAL_CSS}${DELIVERY_CSS}</style>
    </head>
    <body>

      <h1>🛵 DELIVERY</h1>
      <div class="seq">#${orderSeq}</div>
      <div class="center small">${time}</div>
      <hr/>

      <div class="line"><span class="bold">Cliente:</span> ${clientName}</div>
      ${clientPhone ? `<div class="line"><span class="bold">Tel:</span> ${clientPhone}</div>` : ""}
      <hr/>

      <div style="margin: 8px 0;">
        <div class="addr-line">📍 ${address}</div>
      </div>
      <hr/>

      <div class="pay-box">
        <div class="pay-label">💳 ${payLabel}</div>
        <div class="total-line">Total: ${fmtBrl(total)}</div>
      </div>

      ${isCash ? `
        <div class="troco-box">
          <div class="troco-label">💵 COBRAR EM DINHEIRO</div>
          <div style="font-size:13px;color:#555;">Confirmar troco no ato da entrega</div>
        </div>
      ` : ""}

      <hr/>
      <div class="center small">FoodSaaS ERP</div>

    </body>
    </html>
  `;
}
