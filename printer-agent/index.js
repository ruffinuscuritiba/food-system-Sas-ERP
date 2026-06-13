/**
 * FoodSaaS Printer Agent — Phase 3
 *
 * Polls /printers/jobs?status=PENDING, prints via ESC/POS, confirms each job.
 * Supports: USB (node-escpos), Network TCP, and Browser-print fallback (no-op).
 *
 * Usage:
 *   PRINTER_AUTH_TOKEN=<jwt>  node index.js
 *
 * Env vars:
 *   API_URL           — backend base URL (default: http://localhost:3001/api)
 *   PRINTER_AUTH_TOKEN — JWT do admin da empresa (obrigatório)
 *   POLL_INTERVAL_MS  — intervalo de polling em ms (default: 5000)
 *   PAPER_WIDTH       — 58 | 80 (default: 80)
 *   USB_VENDOR_ID     — HEX (ex: 0x04b8) — habilita USB
 *   USB_PRODUCT_ID    — HEX (ex: 0x0202) — habilita USB
 *   NETWORK_HOST      — IP da impressora (ex: 192.168.1.100) — habilita TCP
 *   NETWORK_PORT      — porta TCP (default: 9100)
 */

const API_URL         = process.env.API_URL          ?? "http://localhost:3001/api";
const AUTH_TOKEN      = process.env.PRINTER_AUTH_TOKEN ?? "";
const POLL_MS         = Number(process.env.POLL_INTERVAL_MS ?? 5000);
const PAPER_WIDTH     = Number(process.env.PAPER_WIDTH ?? 80);
const USB_VENDOR_ID   = process.env.USB_VENDOR_ID  ? parseInt(process.env.USB_VENDOR_ID,  16) : null;
const USB_PRODUCT_ID  = process.env.USB_PRODUCT_ID ? parseInt(process.env.USB_PRODUCT_ID, 16) : null;
const NETWORK_HOST    = process.env.NETWORK_HOST ?? null;
const NETWORK_PORT    = Number(process.env.NETWORK_PORT ?? 9100);

// ── ESC/POS byte sequences ────────────────────────────────────────────────────

const ESC  = 0x1b;
const GS   = 0x1d;
const LF   = 0x0a;

const CMD = {
  INIT:        Buffer.from([ESC, 0x40]),
  ALIGN_LEFT:  Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_CENTER:Buffer.from([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: Buffer.from([ESC, 0x61, 0x02]),
  BOLD_ON:     Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF:    Buffer.from([ESC, 0x45, 0x00]),
  DOUBLE_ON:   Buffer.from([GS,  0x21, 0x11]),
  DOUBLE_OFF:  Buffer.from([GS,  0x21, 0x00]),
  FONT_NORMAL: Buffer.from([ESC, 0x21, 0x00]),
  FEED_3:      Buffer.from([ESC, 0x64, 0x03]),
  CUT:         Buffer.from([GS,  0x56, 0x41, 0x10]),
};

function textBuffer(str) {
  return Buffer.from(str + "\n", "latin1");
}

function dashLine(width) {
  return textBuffer("-".repeat(width));
}

function padLine(left, right, width) {
  const space = Math.max(1, width - left.length - right.length);
  return textBuffer(left + " ".repeat(space) + right);
}

// ── Ticket builder ────────────────────────────────────────────────────────────

function buildTicket(job) {
  const payload = typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload;
  const col = PAPER_WIDTH === 58 ? 32 : 42;
  const parts = [];

  parts.push(CMD.INIT);
  parts.push(CMD.ALIGN_CENTER);

  // Company name
  if (payload.companyName) {
    parts.push(CMD.BOLD_ON, CMD.DOUBLE_ON);
    parts.push(textBuffer(payload.companyName.toUpperCase().slice(0, col)));
    parts.push(CMD.DOUBLE_OFF, CMD.BOLD_OFF);
  }

  // Template badge
  parts.push(textBuffer(payload.template ?? job.template ?? "KITCHEN"));
  parts.push(dashLine(col));

  // Order info
  parts.push(CMD.ALIGN_LEFT);
  if (payload.orderNumber) {
    parts.push(CMD.BOLD_ON);
    parts.push(textBuffer(`PEDIDO #${payload.orderNumber}`));
    parts.push(CMD.BOLD_OFF);
  }
  if (payload.source) parts.push(textBuffer(`Origem: ${payload.source}`));
  if (payload.orderType) parts.push(textBuffer(`Tipo: ${payload.orderType}`));
  if (payload.time) parts.push(textBuffer(`Hora: ${payload.time}`));

  parts.push(dashLine(col));

  // Items
  if (Array.isArray(payload.items)) {
    payload.items.forEach((item) => {
      parts.push(CMD.BOLD_ON);
      const line = `${item.quantity}x ${item.name ?? item.productName ?? "Item"}`;
      parts.push(textBuffer(line.slice(0, col)));
      parts.push(CMD.BOLD_OFF);

      // Complements
      if (Array.isArray(item.selectedComplements)) {
        item.selectedComplements.forEach((c) => {
          parts.push(textBuffer(`  + ${c.optionName ?? c.name}`.slice(0, col)));
        });
      }
    });
  }

  parts.push(dashLine(col));

  // Totals (only for non-kitchen templates)
  if (job.template !== "KITCHEN" && job.template !== "BAR") {
    if (payload.deliveryFee > 0) {
      parts.push(padLine("Taxa entrega:", `R$${Number(payload.deliveryFee).toFixed(2)}`, col));
    }
    if (payload.total != null) {
      parts.push(CMD.BOLD_ON);
      parts.push(padLine("TOTAL:", `R$${Number(payload.total).toFixed(2)}`, col));
      parts.push(CMD.BOLD_OFF);
    }
    if (payload.paymentMethod) {
      parts.push(textBuffer(`Pagamento: ${payload.paymentMethod}`));
    }
    if (payload.deliveryAddress) {
      parts.push(dashLine(col));
      parts.push(CMD.BOLD_ON, textBuffer("ENDEREÇO:"), CMD.BOLD_OFF);
      // Wrap long address
      const addr = payload.deliveryAddress;
      for (let i = 0; i < addr.length; i += col) {
        parts.push(textBuffer(addr.slice(i, i + col)));
      }
    }
  }

  parts.push(CMD.FEED_3);
  parts.push(CMD.CUT);

  return Buffer.concat(parts);
}

// ── Printer backends ──────────────────────────────────────────────────────────

async function printUsb(data) {
  const { USB } = await import("escpos");
  const device  = new USB(USB_VENDOR_ID, USB_PRODUCT_ID);
  return new Promise((resolve, reject) => {
    device.open((err) => {
      if (err) return reject(err);
      device.write(data, (werr) => {
        device.close();
        if (werr) reject(werr); else resolve();
      });
    });
  });
}

async function printNetwork(data) {
  const net = await import("net");
  return new Promise((resolve, reject) => {
    const sock = net.default.createConnection(NETWORK_PORT, NETWORK_HOST, () => {
      sock.write(data, (err) => {
        sock.end();
        if (err) reject(err); else resolve();
      });
    });
    sock.on("error", reject);
    sock.setTimeout(10_000, () => { sock.destroy(); reject(new Error("TCP timeout")); });
  });
}

async function printJob(job) {
  const data = buildTicket(job);

  if (USB_VENDOR_ID && USB_PRODUCT_ID) {
    await printUsb(data);
  } else if (NETWORK_HOST) {
    await printNetwork(data);
  } else {
    // No hardware configured — log the ticket as plain text for debugging
    console.log("=== TICKET (no hardware) ===");
    console.log(data.toString("latin1").replace(/[^\x20-\x7E\n]/g, "?"));
    console.log("===========================");
  }
}

// ── API helpers ───────────────────────────────────────────────────────────────

const HEADERS = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${AUTH_TOKEN}`,
};

async function fetchPendingJobs() {
  const res = await fetch(`${API_URL}/printers/jobs?status=PENDING`, { headers: HEADERS });
  if (!res.ok) throw new Error(`GET jobs failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.jobs ?? []);
}

async function markJobSent(jobId) {
  await fetch(`${API_URL}/printers/jobs/${jobId}/status`, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify({ status: "SENT" }),
  });
}

async function markJobPrinted(jobId) {
  await fetch(`${API_URL}/printers/jobs/${jobId}/status`, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify({ status: "PRINTED" }),
  });
}

async function markJobFailed(jobId, reason) {
  await fetch(`${API_URL}/printers/jobs/${jobId}/status`, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify({ status: "FAILED", failReason: String(reason).slice(0, 200) }),
  });
}

// ── Poll loop ─────────────────────────────────────────────────────────────────

async function poll() {
  if (!AUTH_TOKEN) {
    console.error("PRINTER_AUTH_TOKEN não configurado. Defina a variável de ambiente.");
    process.exit(1);
  }

  let jobs;
  try {
    jobs = await fetchPendingJobs();
  } catch (err) {
    console.warn(`[poll] Erro ao buscar jobs: ${err.message}`);
    return;
  }

  for (const job of jobs) {
    try {
      console.log(`[print] Job ${job.id} template=${job.template}`);
      await markJobSent(job.id);
      await printJob(job);
      await markJobPrinted(job.id);
      console.log(`[print] ✓ Job ${job.id} impresso`);
    } catch (err) {
      console.error(`[print] ✗ Job ${job.id} falhou: ${err.message}`);
      await markJobFailed(job.id, err.message).catch(() => {});
    }
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

console.log(`FoodSaaS Printer Agent iniciado`);
console.log(`  API: ${API_URL}`);
console.log(`  Polling a cada ${POLL_MS}ms`);
if (USB_VENDOR_ID)  console.log(`  Modo: USB (${USB_VENDOR_ID.toString(16)}:${USB_PRODUCT_ID.toString(16)})`);
else if (NETWORK_HOST) console.log(`  Modo: Network TCP (${NETWORK_HOST}:${NETWORK_PORT})`);
else console.log(`  Modo: Debug (sem hardware — log no console)`);

poll(); // primeira execução imediata
setInterval(poll, POLL_MS);
