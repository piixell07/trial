const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { Boom } = require('@hapi/boom');
const http = require('http');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');

  const sock = makeWASocket({
    auth: state,
    getMessage: async () => undefined,
    browser: ['Ubuntu', 'Chrome', '22.04.4'],
  });

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n📱 Scan this QR code:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('❌ Disconnected. Reconnecting:', shouldReconnect);
      if (shouldReconnect) startBot();
    }

    if (connection === 'open') {
      console.log('✅ Connected to WhatsApp!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    const msg = messages[0];
    if (!msg.message) return;
    if (msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    console.log('💬 Message received:', text);

    const replies = {
      hello: 'Hi there! How can I help you today? 😊',
      howareyou: 'Hi there! How can I help you today? 😊',
      help: 'Sure! Send me "info" to get more details.',
      info: 'This is a WhatsApp bot powered by Pixel 🤖.',
      bye: 'Goodbye! Have a nice day! 👋',
    };

    const lowerText = text.toLowerCase();

    for (const trigger in replies) {
      if (lowerText.includes(trigger)) {
        await sock.sendMessage(from, { text: replies[trigger] });
        return;
      }
    }

    await sock.sendMessage(from, { text: "Sorry, I didn't understand that. Try 'help'." });
  });
}

startBot();

// 🔄 Keep the bot alive on platforms like Render or Oracle
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.write('🤖 WhatsApp Bot Running');
  res.end();
}).listen(PORT, () => {
  console.log('🌐 Server started on port', PORT);
});
