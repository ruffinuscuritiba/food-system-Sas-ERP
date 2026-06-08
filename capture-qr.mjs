// Capture QR code from Evolution API via WebSocket
// Run: node capture-qr.mjs
import { WebSocket } from 'ws';
import { writeFileSync } from 'fs';

const EVOLUTION_URL = 'https://evolution-api-kely.onrender.com';
const WS_URL = 'wss://evolution-api-kely.onrender.com';
const API_KEY = 'kely-evolution-2024-secret';
const INSTANCE = 'kely';

console.log('🔌 Connecting to Evolution API WebSocket...');
console.log('   URL:', WS_URL);

const ws = new WebSocket(WS_URL, {
  headers: {
    apikey: API_KEY,
  }
});

let qrFound = false;
const timeout = setTimeout(() => {
  if (!qrFound) {
    console.log('⏰ Timeout: No QR received in 60 seconds');
    console.log('   The Baileys client may be blocked by WhatsApp from this IP.');
    ws.close();
    process.exit(1);
  }
}, 60000);

ws.on('open', () => {
  console.log('✅ WebSocket connected!');
  // Subscribe to QR events for our instance
  ws.send(JSON.stringify({
    event: 'subscribe',
    instance: INSTANCE,
  }));
  console.log('👂 Waiting for QR code event...');
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    const event = msg.event || msg.type || '';

    console.log('📨 Event:', event, '| Instance:', msg.instance || '?');

    // Check for QR code in various event formats
    if (event.includes('qrcode') || event.includes('qr') || event === 'connection.update') {
      const qrData = msg.data?.qrcode?.base64 || msg.data?.base64 || msg.qrcode?.base64 || msg.base64;

      if (qrData && qrData.length > 100) {
        qrFound = true;
        clearTimeout(timeout);
        console.log('\n🎉 QR CODE RECEIVED!');

        // Extract base64 data
        const b64 = qrData.includes(',') ? qrData.split(',')[1] : qrData;
        const imgBuffer = Buffer.from(b64, 'base64');

        // Save as file
        const outPath = 'C:\\Users\\Ruffinus Pizzaria\\Desktop\\qrcode-kely.jpg';
        writeFileSync(outPath, imgBuffer);
        console.log('💾 Saved to:', outPath);
        console.log('📱 Open the file and scan with WhatsApp (41 98872-9370)');

        ws.close();
        process.exit(0);
      }
    }

    // Log all events for debugging
    if (Object.keys(msg).length > 0) {
      console.log('   Full msg:', JSON.stringify(msg).substring(0, 200));
    }
  } catch(e) {
    console.log('Raw message:', data.toString().substring(0, 100));
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err.message);
});

ws.on('close', (code, reason) => {
  console.log('🔌 WebSocket closed:', code, reason.toString());
});
