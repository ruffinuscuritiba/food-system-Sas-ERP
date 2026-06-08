/**
 * scan-qr-local.mjs
 * Gera QR do WhatsApp pela sua máquina local (IP residencial),
 * salva a sessão no Neon DB para o Render Evolution API usar.
 *
 * Como usar:
 *   node scan-qr-local.mjs
 *   → Escaneie o QR no terminal com o WhatsApp do número 41 98872-9370
 *   → Após escaneado, a sessão fica salva no banco e o Render pode reconectar.
 */

import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pkg from 'pg';
const { Client } = pkg;

// ─── Config ────────────────────────────────────────────────────────────────
const DB_URL = 'postgresql://neondb_owner:npg_IBo1nWLA3GZU@ep-gentle-silence-aqlf5i0u-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=verify-full';
const INSTANCE_NAME = 'kely';
const PHONE = '5541988729370'; // 41 98872-9370

// ─── DB helper ─────────────────────────────────────────────────────────────
const dbClient = new Client({ connectionString: DB_URL });
await dbClient.connect();
console.log('✅ Conectado ao Neon DB\n');

// Upsert credentials into Neon DB (Evolution API Session table)
async function saveCreds(instanceId, creds) {
  const credsJson = JSON.stringify(creds);
  await dbClient.query(`
    INSERT INTO "Session" ("sessionId", "creds")
    VALUES ($1, $2)
    ON CONFLICT ("sessionId") DO UPDATE SET "creds" = $2
  `, [instanceId, credsJson]);
  console.log('💾 Sessão salva no Neon DB para instanceId:', instanceId);
}

// Get or create Instance record
async function getOrCreateInstance() {
  const existing = await dbClient.query('SELECT id FROM "Instance" WHERE name = $1 LIMIT 1', [INSTANCE_NAME]);
  if (existing.rows.length > 0) return existing.rows[0].id;

  const newId = crypto.randomUUID();
  await dbClient.query(`
    INSERT INTO "Instance" (id, name, "connectionStatus", token, "createdAt", "updatedAt")
    VALUES ($1, $2, 'close', $3, NOW(), NOW())
  `, [newId, INSTANCE_NAME, crypto.randomUUID().replace(/-/g,'').toUpperCase()]);
  console.log('🆕 Instância criada no DB com id:', newId);
  return newId;
}

// ─── Main ───────────────────────────────────────────────────────────────────
console.log('🔄 Iniciando conexão WhatsApp local para:', PHONE);
console.log('   Use IP residencial (esta máquina) para gerar o QR.\n');

const instanceId = await getOrCreateInstance();
const { version } = await fetchLatestBaileysVersion();
console.log('📱 Baileys version:', version.join('.'));

// Auth state em memória (não em arquivo — salvamos no DB)
let savedCreds = null;
try {
  const row = await dbClient.query('SELECT creds FROM "Session" WHERE "sessionId" = $1', [instanceId]);
  if (row.rows.length > 0 && row.rows[0].creds) {
    savedCreds = row.rows[0].creds;
    console.log('📂 Sessão prévia encontrada no DB, tentando reconectar...');
  }
} catch(e) { /* no session */ }

// Simple in-memory auth state
const state = {
  creds: savedCreds || {},
  keys: {}
};

const saveCreds_ = async () => {
  await saveCreds(instanceId, state.creds);
};

const sock = makeWASocket({
  version,
  printQRInTerminal: false,
  auth: state,
  browser: ['FoodSaaS Kely', 'Chrome', '6.8.0'],
  connectTimeoutMs: 60000,
  retryRequestDelayMs: 2000,
  maxRetries: 5,
});

sock.ev.on('creds.update', saveCreds_);

sock.ev.on('connection.update', async (update) => {
  const { connection, lastDisconnect, qr } = update;

  if (qr) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 ESCANEIE O QR ABAIXO COM O WHATSAPP');
    console.log('   Número: 41 98872-9370');
    console.log('   WhatsApp > Dispositivos > Conectar dispositivo');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    qrcode.generate(qr, { small: true });
    console.log('\n⏳ Aguardando escaneamento...');
  }

  if (connection === 'open') {
    console.log('\n✅ CONECTADO COM SUCESSO!');
    console.log('   Número:', sock.user?.id);
    console.log('   Sessão salva no Neon DB.');
    console.log('\n🚀 Próximo passo: reiniciar o Render Evolution API para usar esta sessão.');
    console.log('   Acesse: https://dashboard.render.com/web/srv-d8j3aje7r5hc73deu910');
    console.log('   → Manual Deploy → Deploy latest commit\n');

    // Update instance status in DB
    await dbClient.query('UPDATE "Instance" SET "connectionStatus" = \'open\', "updatedAt" = NOW() WHERE id = $1', [instanceId]);

    // Wait 3s then close
    setTimeout(async () => {
      await sock.end();
      await dbClient.end();
      process.exit(0);
    }, 3000);
  }

  if (connection === 'close') {
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
    console.log('\n⚠️ Conexão fechada. statusCode:', statusCode, '| reconectar:', shouldReconnect);
    if (!shouldReconnect) {
      await dbClient.end();
      process.exit(0);
    }
  }
});

// Timeout after 3 minutes
setTimeout(() => {
  console.log('\n⏰ Timeout de 3 minutos. Encerrando...');
  process.exit(1);
}, 180000);
