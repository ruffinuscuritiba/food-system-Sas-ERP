/**
 * PrintRouterService — classifica um pedido em tickets por setor e despacha.
 *
 * Regras de roteamento de itens (por Category.categoryType, configurável em
 * /categories):
 *   categoryType === "bebidas" → BAR
 *   categoryType === "pizza"   → PIZZARIA
 *   categoryType === "lanche"  → LANCHONETE
 *   qualquer outro (ou "normal") → KITCHEN (cozinha geral)
 *
 * Regras de roteamento do pedido:
 *   orderType === "DELIVERY"         → adiciona DELIVERY label
 *   channel === "TOTEM"              → NÃO imprime CASHIER (sem pré-conta —
 *                                       a conta real fecha depois via PDV/comanda)
 *   printPaymentRule.mode==="SELECTED" e paymentMethod fora da lista → NÃO
 *   imprime CASHIER (configurável em /configuracoes?tab=impressao)
 *   demais casos                     → CASHIER receipt
 *
 * Um único pedido pode gerar até 6 tickets (um por setor com itens + caixa +
 * entrega) — cada `printAllTickets` abre um popup por ticket, com 350ms de
 * intervalo entre eles pra não ser bloqueado pelo navegador.
 *
 * Usage:
 *   PrintRouterService.printAll(order, { companyName: "Minha Loja" });
 *
 *   // Para ativar apenas setores específicos (ex: terminal de um setor só):
 *   PrintRouterService.printAll(order, {
 *     companyName: "Minha Loja",
 *     sectors: ["PIZZARIA"],
 *   });
 */

import { type PrintableOrder }           from "./printTicket";
import { buildKitchenTicket }            from "./KitchenTicket";
import { buildBarTicket }                from "./BarTicket";
import { buildDeliveryLabel }            from "./DeliveryLabel";
import { buildReceipt80mm }              from "./Receipt80mm";
import { type SectorTicket, type PrintSector, type PrintBatchResult, printDispatcher, printAllTickets } from "./printDispatcher";

export type { PrintSector, SectorTicket, PrintBatchResult };

export interface PrintRouterOptions {
  companyName:  string;
  /** Limit which sectors are active on this terminal. Default: all four. */
  sectors?:     PrintSector[];
  /**
   * Regra de negócio da loja: quando imprimir o cupom do cliente (CASHIER)
   * por forma de pagamento. `printingSettings.printMode`/`printPaymentTypes`
   * em Company. "ALL" (padrão) preserva o comportamento anterior.
   */
  printPaymentRule?: { mode: "ALL" | "SELECTED"; types: string[] };
}

export class PrintRouterService {
  /**
   * Builds per-sector tickets for a given order.
   * Only returns tickets for sectors that have content.
   */
  static route(order: PrintableOrder, opts: PrintRouterOptions): SectorTicket[] {
    const enabled = opts.sectors ?? (["KITCHEN", "BAR", "PIZZARIA", "LANCHONETE", "CASHIER", "DELIVERY"] as PrintSector[]);
    const tickets: SectorTicket[] = [];

    const allItems = Array.isArray(order.items) ? order.items : [];
    const byType = (type: string) => allItems.filter((it: any) => (it.categoryType ?? "normal") === type);
    const barItems        = byType("bebidas");
    const pizzariaItems   = byType("pizza");
    const lanchoneteItems = byType("lanche");
    const kitchenItems    = allItems.filter((it: any) => {
      const t = (it as any).categoryType ?? "normal";
      return t !== "bebidas" && t !== "pizza" && t !== "lanche";
    });

    if (enabled.includes("KITCHEN") && kitchenItems.length > 0)
      tickets.push({ sector: "KITCHEN", html: buildKitchenTicket({ ...order, items: kitchenItems }, "COZINHA") });

    if (enabled.includes("BAR") && barItems.length > 0)
      tickets.push({ sector: "BAR", html: buildBarTicket({ ...order, items: barItems }) });

    if (enabled.includes("PIZZARIA") && pizzariaItems.length > 0)
      tickets.push({ sector: "PIZZARIA", html: buildKitchenTicket({ ...order, items: pizzariaItems }, "PIZZARIA") });

    if (enabled.includes("LANCHONETE") && lanchoneteItems.length > 0)
      tickets.push({ sector: "LANCHONETE", html: buildKitchenTicket({ ...order, items: lanchoneteItems }, "LANCHONETE") });

    if (enabled.includes("DELIVERY") && (order.orderType === "DELIVERY"))
      tickets.push({ sector: "DELIVERY", html: buildDeliveryLabel(order) });

    const rule = opts.printPaymentRule;
    const cashierAllowedByPaymentRule =
      !rule || rule.mode === "ALL" || (!!order.paymentMethod && rule.types.includes(order.paymentMethod));

    if (enabled.includes("CASHIER") && order.channel !== "TOTEM" && cashierAllowedByPaymentRule)
      tickets.push({ sector: "CASHIER", html: buildReceipt80mm(order, { companyName: opts.companyName }) });

    return tickets;
  }

  /**
   * Prints all relevant sector tickets for an order. Returns a promise with
   * the sectors whose popup was blocked, so callers can warn the operator.
   */
  static printAll(order: PrintableOrder, opts: PrintRouterOptions): Promise<PrintBatchResult> {
    return printAllTickets(PrintRouterService.route(order, opts));
  }

  /** Prints a single sector ticket directly. */
  static printSector(order: PrintableOrder, sector: PrintSector, opts: PrintRouterOptions): void {
    const ticket = PrintRouterService.route(order, { ...opts, sectors: [sector] })[0];
    if (ticket) printDispatcher(ticket);
  }
}
