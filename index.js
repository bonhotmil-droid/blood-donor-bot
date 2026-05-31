require('dotenv').config();
const express = require('express');
const axios = require('axios');
const qrcode = require('qrcode-terminal');
const P = require('pino');
const { Telegraf, Markup } = require('telegraf');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const PORT = process.env.PORT || 10000;
const API_URL = process.env.API_URL;
const BOT_API_KEY = process.env.BOT_API_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ENABLE_TELEGRAM = String(process.env.ENABLE_TELEGRAM || 'true').toLowerCase() === 'true';
const ENABLE_WHATSAPP = String(process.env.ENABLE_WHATSAPP || 'true').toLowerCase() === 'true';

if (!API_URL || !BOT_API_KEY) {
  console.error('❌ Missing API_URL or BOT_API_KEY in Environment Variables');
}

const sessions = new Map();
const app = express();
app.use(express.json());
app.get('/', (req, res) => res.send('bots are running بنك تهامة للتبرع بالدم'));
app.get('/health', (req, res) => res.json({ ok: true, service: 'blood-donor-bots' }));
app.listen(PORT, () => console.log(`✅ Web server running on port ${PORT}`));

async function apiRequest(action, payload = {}) {
  const { data } = await axios.post(API_URL, { action, ...payload }, {
    headers: { 'X-BOT-API-KEY': BOT_API_KEY, 'Content-Type': 'application/json' },
    timeout: 20000
  });
  return data;
}

function normalizeBlood(text='') {
  return text.toUpperCase().replace('او موجب','O+').replace('او سالب','O-').trim();
}

function helpText() {
  return `🩸 بنك تهامة للتبرع بالدم\n\nالأوامر:\nتسجيل - لتسجيل متبرع جديد\nبحث O+ - البحث حسب الفصيلة\nبحث O+ تعز - البحث حسب الفصيلة والمحافظة\nمساعدة - عرض التعليمات`;
}

function startRegister(userId) {
  sessions.set(userId, { mode: 'register', step: 'full_name', data: {} });
  return 'اكتب الاسم الكامل للمتبرع:';
}

async function handleMessage(userId, text, senderPhone='') {
  text = (text || '').trim();
  const low = text.toLowerCase();

  if (!text || ['مساعدة','مساعده','help','/help','/start'].includes(low)) return helpText();
  if (['تسجيل','سجل','register'].includes(low)) return startRegister(userId);

  if (low.startsWith('بحث') || low.startsWith('search')) {
    const parts = text.split(/\s+/).slice(1);
    const blood_type = normalizeBlood(parts[0] || '');
    const governorate = parts.slice(1).join(' ');
    if (!blood_type) return 'اكتب البحث هكذا:\nبحث O+\nأو:\nبحث O+ تعز';
    try {
      const res = await apiRequest('search_donors', { blood_type, governorate });
      if (!res.ok) return 'تعذر البحث: ' + (res.error || 'خطأ غير معروف');
      if (!res.donors || res.donors.length === 0) return 'لم يتم العثور على متبرعين مطابقين.';
      return res.donors.slice(0, 10).map((d, i) =>
        `${i+1}) ${d.full_name || 'متبرع'}\n🩸 ${d.blood_type || ''}\n📍 ${d.governorate || ''} - ${d.district || ''}\n📞 ${d.phone || d.whatsapp || ''}`
      ).join('\n\n');
    } catch (e) {
      return 'خطأ اتصال مع API الموقع: ' + e.message;
    }
  }

  const s = sessions.get(userId);
  if (!s || s.mode !== 'register') return 'لم أفهم طلبك. اكتب: مساعدة';

  const d = s.data;
  if (s.step === 'full_name') { d.full_name = text; s.step = 'blood_type'; return 'اكتب فصيلة الدم مثل: O+ أو A- أو B+ أو AB+'; }
  if (s.step === 'blood_type') { d.blood_type = normalizeBlood(text); s.step = 'phone'; return 'اكتب رقم الهاتف:'; }
  if (s.step === 'phone') { d.phone = text; d.whatsapp = senderPhone || text; s.step = 'governorate'; return 'اكتب المحافظة:'; }
  if (s.step === 'governorate') { d.governorate = text; s.step = 'district'; return 'اكتب المديرية/المنطقة:'; }
  if (s.step === 'district') {
    d.district = text;
    sessions.delete(userId);
    try {
      const res = await apiRequest('register_donor', d);
      if (!res.ok) return 'تعذر التسجيل: ' + (res.error || 'خطأ غير معروف');
      return '✅ تم تسجيل المتبرع بنجاح في قاعدة بيانات الموقع.\nجزاك الله خيرًا.';
    } catch (e) {
      return 'خطأ اتصال مع API الموقع: ' + e.message;
    }
  }
  return 'حدث خطأ في الجلسة. اكتب تسجيل للبدء من جديد.';
}

async function startTelegram() {
  if (!ENABLE_TELEGRAM) return console.log('ℹ️ Telegram disabled');
  if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN.includes('PUT_')) return console.log('⚠️ TELEGRAM_TOKEN missing, Telegram bot not started');
  const bot = new Telegraf(TELEGRAM_TOKEN);
  bot.start(ctx => ctx.reply(helpText(), Markup.keyboard([['🩸 تسجيل متبرع'], ['🔎 بحث O+']]).resize()));
  bot.hears('🩸 تسجيل متبرع', ctx => ctx.reply(startRegister('tg:' + ctx.from.id)));
  bot.hears(/🔎 بحث/i, ctx => ctx.reply('اكتب مثلًا: بحث O+ تعز'));
  bot.on('text', async ctx => {
    const reply = await handleMessage('tg:' + ctx.from.id, ctx.message.text);
    await ctx.reply(reply);
  });
  await bot.launch();
  console.log('✅ Telegram bot started');
}

async function startWhatsApp() {
  if (!ENABLE_WHATSAPP) return console.log('ℹ️ WhatsApp disabled');
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, logger: P({ level: 'silent' }), printQRInTerminal: false });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('📱 امسح QR التالي من واتساب > الأجهزة المرتبطة > ربط جهاز');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') console.log('✅ WhatsApp connected');
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log('⚠️ WhatsApp disconnected:', statusCode);
      if (statusCode !== DisconnectReason.loggedOut) startWhatsApp();
      else console.log('❌ WhatsApp logged out. Delete auth_info_baileys and redeploy to scan QR again.');
    }
  });
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const jid = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const phone = jid.replace('@s.whatsapp.net','').replace('@g.us','');
    const reply = await handleMessage('wa:' + jid, text, phone);
    await sock.sendMessage(jid, { text: reply });
  });
}

startTelegram().catch(e => console.error('❌ Telegram error:', e));
startWhatsApp().catch(e => console.error('❌ WhatsApp error:', e));
