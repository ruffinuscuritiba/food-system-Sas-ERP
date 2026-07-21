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
 * Phase 1: always browser popup. Returns false if the popup was blocked.
 */
export function printDispatcher(ticket: SectorTicket): boolean {
  // Phase 2 hook point: check localStorage/PrinterProfile for sector config
  // const profile = getPrinterProfile(ticket.sector);
  // if (profile?.type === "ESCPOS_AGENT") { sendToAgent(profile, ticket); return; }
  return printTicket(ticket.html);
}

export interface PrintBatchResult {
  /** Total tickets attempted. */
  total: number;
  /** Sectors whose popup was blocked by the browser — operator must be warned. */
  blockedSectors: PrintSector[];
}

/**
 * Dispatches multiple tickets sequentially with a 350ms gap to avoid browser
 * popup throttling when several windows open at once. Resolves once every
 * ticket has been attempted, with the list of sectors whose popup was
 * blocked — so the caller can alert the operator instead of failing
 * silently (previous behavior: console.warn only, nobody ever saw it).
 * Callers that don't care about the result can keep calling it
 * fire-and-forget, same as before.
 */
export function printAllTickets(tickets: SectorTicket[]): Promise<PrintBatchResult> {
  const blockedSectors: PrintSector[] = [];
  return new Promise((resolve) => {
    if (tickets.length === 0) { resolve({ total: 0, blockedSectors }); return; }
    tickets.forEach((t, i) => {
      const fire = () => {
        if (!printDispatcher(t)) blockedSectors.push(t.sector);
        if (i === tickets.length - 1) resolve({ total: tickets.length, blockedSectors });
      };
      if (i === 0) fire();
      else setTimeout(fire, i * 350);
    });
  });
}
