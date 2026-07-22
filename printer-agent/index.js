/**
 * FoodSaaS Printer Agent — Phase 3
 *
 * Polls /printers/jobs?status=PENDING, prints via ESC/POS, confirms each job.
 * Supports: USB (node-escpos), Network TCP, impressora instalada no Windows
 * (nome da fila de impressão — funciona com porta COM/serial, USB genérico,
 * compartilhada etc., pois usa o spooler do Windows via WinAPI RAW), e
 * fallback de debug (loga no console, sem hardware).
 *
 * Usage:
 *   PRINTER_AUTH_TOKEN=<token>  node index.js
 *   (ou crie um arquivo .env na mesma pasta — lido automaticamente)
 *
 * Env vars:
 *   API_URL           — backend base URL (default: http://localhost:3001/api)
 *   PRINTER_AUTH_TOKEN — chave de ativação da loja (obrigatório)
 *   POLL_INTERVAL_MS  — intervalo de polling em ms (default: 5000)
 *   PAPER_WIDTH       — 58 | 80 (default: 80)
 *   USB_VENDOR_ID     — HEX (ex: 0x04b8) — habilita USB direto (node-escpos)
 *   USB_PRODUCT_ID    — HEX (ex: 0x0202) — habilita USB direto (node-escpos)
 *   NETWORK_HOST      — IP da impressora (ex: 192.168.1.100) — habilita TCP
 *   NETWORK_PORT      — porta TCP (default: 9100)
 *   PRINTER_NAME      — nome exato da impressora instalada no Windows
 *                       (ex: "MP-4200 TH") — envia RAW via spooler, funciona
 *                       com impressoras em porta COM/serial (Bematech, Elgin
 *                       etc.), USB genérico ou compartilhada
 */

// Carrega variáveis do arquivo .env na mesma pasta do executável (o .env
// nunca era lido antes — PRINTER_AUTH_TOKEN sempre ficava vazio mesmo com o
// arquivo criado corretamente, e o processo encerrava sozinho ao iniciar).
//
// Parser feito à mão (sem depender do pacote "dotenv"): o pkg (empacotador
// do .exe) tem suporte instável a pacotes ESM novos — adicionar "dotenv"
// quebrou o snapshot do binário (Error: Cannot find module .../index.js).
// Um parser de .env é trivial o bastante pra não precisar de dependência.
//
// Arquivo é CommonJS (não ESM) de propósito — o pkg tem bugs conhecidos
// com "type":"module" (import.meta, top-level await e geração de bytecode
// quebravam o executável de formas diferentes); CJS é o modo mais maduro
// e testado do pkg.
const fs = require("fs");
const path = require("path");

function loadDotEnv() {
  // process.pkg existe só dentro do .exe empacotado.
  const baseDir = typeof process.pkg !== "undefined"
    ? path.dirname(process.execPath)
    : process.argv[1] ? path.dirname(process.argv[1]) : process.cwd();
  const envPath = path.join(baseDir, ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnv();

const API_URL         = process.env.API_URL          ?? "http://localhost:3001/api";
let   AUTH_TOKEN      = process.env.PRINTER_AUTH_TOKEN ?? "";
const POLL_MS         = Number(process.env.POLL_INTERVAL_MS ?? 5000);
const PAPER_WIDTH     = Number(process.env.PAPER_WIDTH ?? 80);
const USB_VENDOR_ID   = process.env.USB_VENDOR_ID  ? parseInt(process.env.USB_VENDOR_ID,  16) : null;
const USB_PRODUCT_ID  = process.env.USB_PRODUCT_ID ? parseInt(process.env.USB_PRODUCT_ID, 16) : null;
const NETWORK_HOST    = process.env.NETWORK_HOST ?? null;
const NETWORK_PORT    = Number(process.env.NETWORK_PORT ?? 9100);
const PRINTER_NAME    = process.env.PRINTER_NAME ?? null;

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
  const { USB } = require("escpos");
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
  const net = require("net");
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(NETWORK_PORT, NETWORK_HOST, () => {
      sock.write(data, (err) => {
        sock.end();
        if (err) reject(err); else resolve();
      });
    });
    sock.on("error", reject);
    sock.setTimeout(10_000, () => { sock.destroy(); reject(new Error("TCP timeout")); });
  });
}

// Impressora instalada no Windows (qualquer porta: COM/serial, USB genérico,
// compartilhada) — envia bytes RAW direto pelo spooler via WinAPI
// (OpenPrinter/StartDocPrinter/WritePrinter), técnica clássica documentada
// pela Microsoft (KB322091). Evita depender de VID/PID de USB — a maioria
// das térmicas brasileiras (Bematech, Elgin, Tanca) se apresenta ao Windows
// como porta COM virtual, não como dispositivo USB "cru".
async function printWindowsRaw(data, printerName) {
  const os          = require("os");
  const { spawn }   = require("child_process");

  const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), "fsaas-print-"));
  const dataFile = path.join(tmpDir, "ticket.prn");
  const psFile   = path.join(tmpDir, "print.ps1");
  fs.writeFileSync(dataFile, data);

  const psScript = `
param([string]$PrinterName, [string]$DataFile)
Add-Type @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public class FoodSaaSRawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendFileToPrinter(string printerName, string fileName) {
        byte[] bytes = File.ReadAllBytes(fileName);
        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
        IntPtr hPrinter;
        bool ok = false;
        if (OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            DOCINFOA di = new DOCINFOA();
            di.pDocName = "FoodSaaS Ticket";
            di.pDataType = "RAW";
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    Int32 written;
                    ok = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out written);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        Marshal.FreeCoTaskMem(pUnmanagedBytes);
        return ok;
    }
}
"@
$result = [FoodSaaSRawPrinter]::SendFileToPrinter($PrinterName, $DataFile)
if (-not $result) { Write-Error "Falha ao enviar para a impressora '$PrinterName'"; exit 1 }
`;
  fs.writeFileSync(psFile, psScript);

  return new Promise((resolve, reject) => {
    const ps = spawn("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psFile,
      "-PrinterName", printerName, "-DataFile", dataFile,
    ]);
    let stderr = "";
    ps.stderr.on("data", (d) => { stderr += d.toString(); });
    ps.on("error", reject);
    ps.on("close", (code) => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `powershell saiu com código ${code}`));
    });
  });
}

async function printJob(job) {
  const data = buildTicket(job);

  if (USB_VENDOR_ID && USB_PRODUCT_ID) {
    await printUsb(data);
  } else if (NETWORK_HOST) {
    await printNetwork(data);
  } else if (PRINTER_NAME) {
    await printWindowsRaw(data, PRINTER_NAME);
  } else {
    // No hardware configured — log the ticket as plain text for debugging
    console.log("=== TICKET (no hardware) ===");
    console.log(data.toString("latin1").replace(/[^\x20-\x7E\n]/g, "?"));
    console.log("===========================");
  }
}

// ── API helpers ───────────────────────────────────────────────────────────────

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${AUTH_TOKEN}`,
  };
}

async function fetchPendingJobs() {
  const res = await fetch(`${API_URL}/printers/jobs?status=PENDING`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`GET jobs failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.jobs ?? []);
}

async function markJobSent(jobId) {
  await fetch(`${API_URL}/printers/jobs/${jobId}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status: "SENT" }),
  });
}

async function markJobPrinted(jobId) {
  await fetch(`${API_URL}/printers/jobs/${jobId}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status: "PRINTED" }),
  });
}

async function markJobFailed(jobId, reason) {
  await fetch(`${API_URL}/printers/jobs/${jobId}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status: "FAILED", failReason: String(reason).slice(0, 200) }),
  });
}

// ── Heartbeat — reports agent is alive every 30s ──────────────────────────────

async function sendHeartbeat() {
  try {
    await fetch(`${API_URL}/printers/agent/heartbeat`, {
      method: "POST",
      headers: authHeaders(),
    });
  } catch { /* non-fatal */ }
}

// ── First-run setup — pede a chave uma única vez e salva no .env ──────────────
// Antes disso, quem baixava o .exe e dava duplo-clique só via um erro no
// console pedindo pra CRIAR um arquivo .env manualmente com um editor de
// texto — travava a maioria dos usuários. Agora o próprio programa pergunta
// e salva sozinho, igual a qualquer app "plug-and-play".

function resolveBaseDir() {
  return typeof process.pkg !== "undefined"
    ? path.dirname(process.execPath)
    : process.argv[1] ? path.dirname(process.argv[1]) : process.cwd();
}

async function promptForToken() {
  const readline = require("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("\n=== Configuração inicial ===");
  console.log("No painel, acesse Configurações → Impressão e copie a 'Chave de Ativação da Loja'.\n");
  const answer = await new Promise((resolve) => {
    rl.question("Cole a chave aqui e pressione ENTER: ", resolve);
  });
  rl.close();
  return answer.trim();
}

async function ensureToken() {
  if (AUTH_TOKEN) return true;
  if (!process.stdin.isTTY) return false; // rodando sem console interativo (ex: serviço) — não dá pra perguntar

  const token = await promptForToken();
  if (!token) return false;
  AUTH_TOKEN = token;

  const envPath = path.join(resolveBaseDir(), ".env");
  try {
    const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
    const keptLines = existing
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.trim().startsWith("PRINTER_AUTH_TOKEN="));
    keptLines.push(`PRINTER_AUTH_TOKEN=${token}`);
    fs.writeFileSync(envPath, keptLines.join("\n") + "\n", "utf-8");
    console.log(`\n✓ Chave salva em ${envPath} — não vai precisar colar de novo.\n`);
  } catch (err) {
    console.warn(`Não foi possível salvar a chave automaticamente (${err.message}). Vai precisar colar de novo na próxima vez.`);
  }
  return true;
}

// ── Poll loop ─────────────────────────────────────────────────────────────────

async function poll() {
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

// Ao rodar o .exe com duplo-clique no Windows, um erro fatal fechava a janela
// do console instantaneamente — impossível ler a mensagem. Agora, se faltar
// o token, avisa claramente e espera ENTER antes de fechar.
async function waitBeforeExit() {
  if (process.stdin.isTTY) {
    console.error("\nPressione ENTER para fechar esta janela...");
    await new Promise((resolve) => {
      process.stdin.resume();
      process.stdin.once("data", resolve);
    });
  }
  process.exit(1);
}

async function main() {
  const ok = await ensureToken();
  if (!ok) {
    console.error("PRINTER_AUTH_TOKEN não configurado.");
    console.error("Crie um arquivo .env na MESMA PASTA deste executável com o conteúdo:");
    console.error("  PRINTER_AUTH_TOKEN=<chave copiada da tela Configurações → Impressão>");
    await waitBeforeExit();
    return;
  }

  console.log(`FoodSaaS Printer Agent iniciado`);
  console.log(`  API: ${API_URL}`);
  console.log(`  Polling a cada ${POLL_MS}ms`);
  if (USB_VENDOR_ID)  console.log(`  Modo: USB (${USB_VENDOR_ID.toString(16)}:${USB_PRODUCT_ID.toString(16)})`);
  else if (NETWORK_HOST) console.log(`  Modo: Network TCP (${NETWORK_HOST}:${NETWORK_PORT})`);
  else if (PRINTER_NAME) console.log(`  Modo: Impressora do Windows ("${PRINTER_NAME}")`);
  else console.log(`  Modo: Debug (sem hardware — log no console)`);

  sendHeartbeat(); // heartbeat imediato ao iniciar
  setInterval(sendHeartbeat, 30_000);

  poll(); // primeira execução imediata
  setInterval(poll, POLL_MS);
}

main();
