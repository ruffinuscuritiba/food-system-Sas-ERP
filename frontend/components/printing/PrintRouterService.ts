/**
 * PrintRouterService — classifica um pedido em tickets por setor e despacha.
 *
 * Regras de roteamento de itens:
 *   item.categoryType === "bebidas"  → BAR
 *   qualquer outro                   → KITCHEN
 *
 * Regras de roteamento do pedido:
 *   orderType === "DELIVERY"         → adiciona DELIVERY label
 *   sempre                           → CASHIER receipt
 *
 * Usage:
 *   PrintRouterService.printAll(order, { companyName: "Minha Loja" });
 *
 *   // Para ativar apenas setores específicos (ex: terminal de cozinha):
 *   PrintRouterService.printAll(order, {
 *     companyName: "Minha Loja",
 *     sectors: ["KITCHEN", "BAR"],
 *   });
 */

import { type PrintableOrder }           from "./printTicket";
import { buildKitchenTicket }            from "./KitchenTicket";
import { buildBarTicket }                from "./BarTicket";
import { buildDeliveryLabel }            from "./DeliveryLabel";
import { buildReceipt80mm }              from "./Receipt80mm";
import { type SectorTicket, type PrintSector, printDispatcher, printAllTickets } from "./printDispatcher";

export type { PrintSector, SectorTicket };

export interface PrintRouterOptions {
  companyName:  string;
  /** Limit which sectors are active on this terminal. Default: all four. */
  sectors?:     PrintSector[];
}

export class PrintRouterService {
  /**
   * Builds per-sector tickets for a given order.
   * Only returns tickets for sectors that have content.
   */
  static route(order: PrintableOrder, opts: PrintRouterOptions): SectorTicket[] {
    const enabled = opts.sectors ?? (["KITCHEN", "BAR", "CASHIER", "DELIVERY"] as PrintSector[]);
    const tickets: SectorTicket[] = [];

    const allItems = Array.isArray(order.items) ? order.items : [];
    const kitchenItems = allItems.filter((it: any) => (it.categoryType ?? "normal") !== "bebidas");
    const barItems     = allItems.filter((it: any) => (it.categoryType ?? "normal") === "bebidas");

    if (enabled.includes("KITCHEN") && kitchenItems.length > 0)
      tickets.push({ sector: "KITCHEN", html: buildKitchenTicket({ ...order, items: kitchenItems }) });

    if (enabled.includes("BAR") && barItems.length > 0)
      tickets.push({ sector: "BAR", html: buildBarTicket({ ...order, items: barItems }) });

    if (enabled.includes("DELIVERY") && (order.orderType === "DELIVERY"))
      tickets.push({ sector: "DELIVERY", html: buildDeliveryLabel(order) });

    if (enabled.includes("CASHIER"))
      tickets.push({ sector: "CASHIER", html: buildReceipt80mm(order, { companyName: opts.companyName }) });

    return tickets;
  }

  /** Prints all relevant sector tickets for an order. */
  static printAll(order: PrintableOrder, opts: PrintRouterOptions): void {
    printAllTickets(PrintRouterService.route(order, opts));
  }

  /** Prints a single sector ticket directly. */
  static printSector(order: PrintableOrder, sector: PrintSector, opts: PrintRouterOptions): void {
    const ticket = PrintRouterService.route(order, { ...opts, sectors: [sector] })[0];
    if (ticket) printDispatcher(ticket);
  }
}
