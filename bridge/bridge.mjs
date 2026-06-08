/**
 * FoodSaaS Kely — WhatsApp Bridge (Fly.io Edition)
 *
 * Conecta ao WhatsApp via Baileys e faz ponte com o FoodSaaS:
 *   1. Recebe mensagens do WhatsApp -> encaminha para webhook FoodSaaS
 *   2. Busca respostas da IA no FoodSaaS -> envia via WhatsApp
 *
 * Deploy: fly deploy
 */

import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { createServer } from 'http';
import qrcode from 'qrcode-terminal';

// ─── Config ────────────────────────────────────────────────────────────────
const FOODSAAS_WEBHOOK = process.env.FOODSAAS_WEBHOOK || 'https://food-system-backend-no7d.onrender.com/api/whatsapp-ai/webhook/cmq571fqn000jazfccsg9hw8t';
const FOODSAAS_OUTBOX  = process.env.FOODSAAS_OUTBOX  || 'https://food-system-backend-no7d.onrender.com/api/whatsapp-ai/bridge/outbox/cmq571fqn000jazfccsg9hw8t';
const POLL_INTERVAL_MS = 2000;
const OWN_NUMBER = process.env.OWN_NUMBER || '554188729370';
const PORT = process.env.PORT || 8080;

let sock = null;
let lastMessageId = null;
let connected = false;
let lastActivity = Date.now();

// ─── Health check HTTP server (Fly.io precisa) ────────────────────────────
const server = createServer((req, res) => {
  if (req.url === '/health') {
    const status = connected ? 'connected' : 'disconnected';
    const idle = Math.floor((Date.now() - lastActivity) / 1000);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status, uptime: process.uptime(), idle, lastMessageId }));
  } else {
    res.writeHead(200);
    res.end('Kely Bridge OK');
  }
});
server.listen(PORT, () => console.log(`[HTTP] Health check na porta ${PORT}`));

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatPhone(jid) {
  return jid?.split('@')[0] || '';
}

async function forwardToFoodSaaS(phone, text, msgId) {
  const payload = {
    event: 'messages.upsert',
    instance: 'kely',
    data: {
      key: {
        remoteJid: `${phone}@s.whatsapp.net`,
        fromMe: false,
        id: msgId,
      },
      message: {
        conversation: text,
      },
      messageType: 'conversation',
      pushName: phone,
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
  };

  try {
    const res = await fetch(FOODSAAS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    console.log(`[->] Msg de ${phone} encaminhada (${res.status})`);
    lastActivity = Date.now();
  } catch (err) {
    console.error(`[!] Erro webhook:`, err.message);
  }
}

async function pollOutbox() {
  if (!connected) return;

  try {
    const url = lastMessageId
      ? `${FOODSAAS_OUTBOX}?after=${lastMessageId}`
      : FOODSAAS_OUTBOX;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return;

    const messages = await res.json();

    for (const msg of messages) {
      if (!msg.phone || !msg.text) continue;

      const jid = msg.phone.includes('@') ? msg.phone : `${msg.phone}@s.whatsapp.net`;
      try {
        await sock.sendMessage(jid, { text: msg.text });
        console.log(`[<-] Kely -> ${msg.phone}: ${msg.text.substring(0, 80)}...`);
        lastMessageId = msg.id;
        lastActivity = Date.now();
      } catch (err) {
        console.error(`[!] Erro envio WA ${msg.phone}:`, err.message);
      }
    }
  } catch (err) {
    if (!err.message?.includes('timeout')) {
      console.error(`[!] Poll:`, err.message);
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function start() {
  console.log('');
  console.log('=== FoodSaaS Kely — Bridge Fly.io ===');
  console.log(`Numero: ${OWN_NUMBER}`);
  console.log(`Webhook: ${FOODSAAS_WEBHOOK.substring(0, 60)}...`);
  console.log('');

  const { state, saveCreds } = await useMultiFileAuthState('./auth_kely');
  const { version } = await fetchLatestBaileysVersion();
  console.log('Baileys:', version.join('.'));

  sock = makeWASocket({
    version,
    auth: state,
    browser: ['FoodSaaS Kely', 'Chrome', '6.8.0'],
    connectTimeoutMs: 60000,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages: msgs }) => {
    for (const msg of msgs) {
      if (msg.key.fromMe) continue;
      if (msg.key.remoteJid?.endsWith('@g.us')) continue;
      if (msg.key.remoteJid?.endsWith('@broadcast')) continue;
      if (msg.key.remoteJid === 'status@broadcast') continue;

      const phone = formatPhone(msg.key.remoteJid);
      if (!phone || phone === OWN_NUMBER) continue;

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.buttonsResponseMessage?.selectedButtonId ||
        msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
        '';

      if (!text.trim()) continue;

      console.log(`[>>] ${phone}: ${text.substring(0, 80)}`);
      await forwardToFoodSaaS(phone, text, msg.key.id);
    }
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n=================================');
console.log('ESCANEIE O QR CODE DO WHATSAPP');
console.log('=================================\n');

qrcode.generate(qr, {
  small: true
});
    }

    if (connection === 'open') {
      connected = true;
      console.log('[OK] WhatsApp conectado! Bridge ativo 24/7.');
      console.log('[OK] Numero:', sock.user?.id);
      setInterval(pollOutbox, POLL_INTERVAL_MS);
    }

    if (connection === 'close') {
      connected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;

      console.log(`[!] Desconectado (${code})`);

      if (loggedOut) {
        console.log('[FATAL] Sessao expirada. Precisa reescanear QR.');
        // Não faz exit — mantém HTTP health check rodando
      } else {
        console.log('[!] Reconectando em 5s...');
        setTimeout(start, 5000);
      }
    }
  });
}

start().catch((err) => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
