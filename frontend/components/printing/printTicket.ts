/**
 * Core print utility.
 *
 * Opens a blank popup, injects the HTML string produced by a builder
 * (Receipt80mm, KitchenTicket, CustomerReceipt), and triggers the
 * browser's print dialog.  The popup closes itself after printing.
 *
 * Usage:
 *   import { printTicket } from "@/components/printing/printTicket";
 *   import { buildReceipt80mm } from "@/components/printing/Receipt80mm";
 *   printTicket(buildReceipt80mm(order, "Restaurante X"));
 */

// ── Shared type ───────────────────────────────────────────────────────────────

export type PrintableComplement = {
  optionName: string;
  quantity: number;
  price: number;
};

export type PrintableItem = {
  productName?: string;
  name?: string;
  quantity: number;
  unitPrice?: number;
  subtotal?: number;
  notes?: string;
  selectedComplements?: PrintableComplement[];
};

export type QrPrintBlock = {
  title: string;
  customerName: string;
  discountLine: string;
  url: string;
  couponCode: string;
  validUntil: string;
};

export type PrintableOrder = {
  id: string;
  /** Número sequencial por tenant — exibição humana (ex: #42) */
  number?: number;
  /** Adapter Caminho 2 — "PDV" | "ONLINE" */
  source?: string;
  /** "ONLINE" (padrão) | "TOTEM" — pedido de tablet fixo na mesa, sem pré-conta */
  channel?: string;
  orderType?: string;
  status?: string;
  orderStatus?: string;
  paymentMethod?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  subtotal?: number;
  deliveryFee?: number;
  driverFee?: number;
  total: number;
  notes?: string;
  items: PrintableItem[];
  createdAt?: string;
  confirmedAt?: string;
  customer?: { name?: string; phone?: string };
  /** QR Recovery — rodapé do ticket com desconto no próximo pedido */
  printBlock?: QrPrintBlock | null;
};

// ── Shared CSS ────────────────────────────────────────────────────────────────

/**
 * Base 80mm thermal-printer styles embedded in every generated HTML document.
 * @page forces 80mm width and auto height (continuous paper roll).
 */
export const THERMAL_CSS = `
  @page { margin: 4mm; size: 80mm auto; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, sans-serif;
    font-size: 13px;
    width: 72mm;
    padding: 4mm 0;
    color: #111;
  }
  h1  { font-size: 18px; text-align: center; margin-bottom: 4px; }
  h2  { font-size: 15px; }
  hr  { border: none; border-top: 1px dashed #999; margin: 8px 0; }
  .center { text-align: center; }
  .bold   { font-weight: bold; }
  .line   { margin-bottom: 6px; }
  .small  { font-size: 11px; color: #555; }
  .type   { font-size: 15px; font-weight: bold; text-align: center; margin-bottom: 6px; }
  .source {
    display: inline-block;
    font-weight: 900;
    font-size: 11px;
    letter-spacing: 1.5px;
    padding: 2px 8px;
    border-radius: 4px;
    margin-bottom: 6px;
  }
  .source-pdv    { border: 2px solid #111; color: #111; }
  .source-online { border: 2px solid #1d4ed8; color: #1d4ed8; }
  .item-name  { font-size: 14px; font-weight: bold; }
  .item-obs   { font-size: 12px; font-style: italic; color: #555; }
  .item-comp  { font-size: 12px; color: #444; margin-left: 10px; }
  .item-price { font-size: 12px; color: #333; margin-top: 2px; }
  .total-line { font-size: 15px; font-weight: bold; }
`;

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Opens a popup, writes the full HTML string, and triggers window.print().
 * Returns false (and warns in the console) if the popup was blocked — callers
 * use this to warn the operator instead of failing silently.
 */
export function printTicket(html: string): boolean {
  const w = window.open("", "_blank", "width=420,height=700");
  if (!w) {
    console.warn("[printTicket] Popup blocked — allow popups for this site.");
    return false;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  return true;
}

// ── Helpers shared by builders ────────────────────────────────────────────────

export const PAY_LABELS: Record<string, string> = {
  PIX:         "PIX",
  CASH:        "Dinheiro",
  CREDIT_CARD: "Cartão de Crédito",
  DEBIT_CARD:  "Cartão de Débito",
  TRANSFER:    "Transferência",
};

export const TYPE_LABELS: Record<string, string> = {
  DELIVERY: "🛵 Delivery",
  PICKUP:   "🏠 Retirada",
  DINE_IN:  "🍽️ Balcão",
};

/**
 * Gera o HTML do rodapé de recuperação de cliente.
 * Usa api.qrserver.com para renderizar o QR Code inline (PNG via URL, sem deps JS).
 */
export function buildQrFooterHtml(block: QrPrintBlock): string {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(block.url)}`;
  return `
    <hr/>
    <div style="text-align:center;padding:6px 0;">
      <div style="font-size:14px;font-weight:900;letter-spacing:1px;">🎁 ${block.title}</div>
      <div style="font-size:13px;margin:3px 0;">${block.discountLine}</div>
      <div style="font-size:11px;color:#555;">no seu próximo pedido no nosso cardápio</div>
      <img src="${qrUrl}" width="110" height="110" style="display:block;margin:8px auto;" alt="QR"/>
      <div style="font-family:monospace;font-size:16px;font-weight:900;letter-spacing:3px;">${block.couponCode}</div>
      <div style="font-size:10px;color:#888;margin-top:3px;">válido até ${block.validUntil}</div>
      <div style="font-size:9px;color:#aaa;margin-top:2px;">${block.url}</div>
    </div>
    <hr/>
    <div style="text-align:center;font-size:11px;color:#777;padding-bottom:4px;">✂ recorte e guarde este cupom</div>
  `;
}

export function fmtBrl(v?: number | null): string {
  return `R$ ${Number(v ?? 0).toFixed(2)}`;
}

export function fmtTime(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("pt-BR"); }
  catch { return ""; }
}

export function buildItemsHtml(items: PrintableItem[], showPrices = true): string {
  return items.map(item => {
    const name = item.productName || item.name || "Item";
    const complements = Array.isArray(item.selectedComplements) ? item.selectedComplements : [];
    const complementsHtml = complements.map(c =>
      `<div class="item-comp">+ ${c.quantity}x ${c.optionName}${Number(c.price) > 0 ? ` (${fmtBrl(c.price)})` : ""}</div>`
    ).join("");
    const priceHtml = showPrices
      ? `<div class="item-price">${fmtBrl(item.subtotal ?? (Number(item.unitPrice ?? 0) * item.quantity))}</div>`
      : "";
    return `
      <div style="margin-bottom:10px;">
        <div class="item-name">${item.quantity}x ${name}</div>
        ${item.notes ? `<div class="item-obs">Obs: ${item.notes}</div>` : ""}
        ${complementsHtml}
        ${priceHtml}
      </div>
    `;
  }).join("");
}
