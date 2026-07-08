/**
 * PrintDispatcher — abstraction layer between templates and output devices.
 *
 * Phase 1: browser popup via window.open() (current).
 * Phase 2 (future): route to ESC/POS Agent via WebSocket based on PrinterProfile.
 *
 * All print calls in the app go through this dispatcher, not printTicket() directly.
 * This ensures a single swap point when upgrading to ESC/POS or network printers.
 */

import { printTicket } from "./printTicket";

export type PrintSector = "KITCHEN" | "BAR" | "PIZZARIA" | "LANCHONETE" | "CASHIER" | "DELIVERY";

export interface SectorTicket {
  sector: PrintSector;
  html:   string;
}

/**
 * Dispatches one sector ticket to the correct output.
 * Phase 1: always browser popup.
 */
export function printDispatcher(ticket: SectorTicket): void {
  // Phase 2 hook point: check localStorage/PrinterProfile for sector config
  // const profile = getPrinterProfile(ticket.sector);
  // if (profile?.type === "ESCPOS_AGENT") { sendToAgent(profile, ticket); return; }
  printTicket(ticket.html);
}

/**
 * Dispatches multiple tickets sequentially with a 350ms gap
 * to avoid browser popup throttling when several windows open at once.
 */
export function printAllTickets(tickets: SectorTicket[]): void {
  tickets.forEach((t, i) => {
    if (i === 0) { printDispatcher(t); return; }
    setTimeout(() => printDispatcher(t), i * 350);
  });
}
