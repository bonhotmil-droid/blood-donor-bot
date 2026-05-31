require('dotenv').config();
const express = require('express');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const PORT = process.env.PORT || 10000;
const API_BASE_URL = process.env.API_BASE_URL;
const BOT_API_KEY = process.env.BOT_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_NAME = process.env.BOT_NAME || 'بنك تهامة للتبرع بالدم';

const sessions = new Map();
const app = express();
app.use(express.json());
app.get('/', (_, res) => res.send(`${BOT_NAME} bots are running`));
app.get('/health', (_, res) => res.json({ ok: true, bot: BOT_NAME }));
app.listen(PORT, () => console.log(`Health server running on port ${PORT}`));

function normalizeText(text = '') { return String(text).trim(); }
function apiRequest(action, payload = {}) {
  return axios.post(API_BASE_URL, { action, api_key: BOT_API_KEY, ...payload }, { timeout: 20000 }).then(r => r.data);
}
function mainMenu() {
  return `🩸 مرحباً بك في ${BOT_NAME}\n\nاكتب الرقم المطلوب:\n1️⃣ تسجيل متبرع جديد\n2️⃣ البحث عن متبرع\n3️⃣ إحصائيات\n4️⃣ مساعدة\n\nيمكنك كتابة: تسجيل أو بحث`;
}
function helpText() {
  return `طريقة الاستخدام:\n\nللتسجيل: اكتب تسجيل واتبع الأسئلة.\nللبحث: اكتب بحث ثم أدخل الفصيلة والمحافظة والمديرية.\n\nالفصائل المقبولة: A+ A- B+ B- AB+ AB- O+ O-`;
}
function cleanBlood(v) { return String(v || '').toUpperCase().replace(/\s+/g, ''); }
function isValidBlood(v) { return ['A+','A-','B+','B-','AB+','AB-','O+','O-'].includes(cleanBlood(v)); }
function isValidPhone(v) { return /^7\d{8}$/.test(String(v || '').replace(/\D/g, '').replace(/^967/, '')); }
function phoneOnly(v) { const p = String(v || '').replace(/\D/g, ''); return p.startsWith('967') && p.length === 12 ? p.slice(3) : p; }
function genderValue(text) {
  const t = String(text || '').toLowerCase();
  if (['ذكر', 'male', 'm', 'رجل'].includes(t)) return 'male';
  if (['انثى', 'أنثى', 'female', 'f', 'امرأة', 'بنت'].includes(t)) return 'female';
  return null;
}
function formatDonors(donors) {
  if (!donors || donors.length === 0) return 'لم يتم العثور على متبرعين مطابقين حالياً.';
  return donors.map((d, i) => {
    const hidden = d.gender === 'female';
    const contact = hidden ? 'التواصل: عبر الإدارة حفاظاً على الخصوصية' : `الهاتف: ${d.phone}${d.whatsapp ? `\nواتساب: ${d.whatsapp}` : ''}`;
    return `${i + 1}) ${hidden ? 'متبرعة - محمية الخصوصية' : d.full_name}\nالفصيلة: ${d.blood_type}\nالموقع: ${d.governorate} - ${d.district}\nآخر تبرع: ${d.last_donation_date || 'غير محدد'}\nالوقت المناسب: ${d.best_call_time || 'غير محدد'}\n${contact}`;
  }).join('\n\n');
}
function startRegister(platform, userId) {
  sessions.set(`${platform}:${userId}`, { mode: 'register', step: 0, data: {} });
  return 'تمام ✅ سنسجل متبرع جديد بنفس قاعدة بيانات الموقع.\n\nأرسل الاسم الكامل:';
}
function startSearch(platform, userId) {
  sessions.set(`${platform}:${userId}`, { mode: 'search', step: 0, data: {} });
  return '🔎 أرسل فصيلة الدم المطلوبة مثل: O+ أو A- أو AB+';
}
const registerSteps = [
  { key: 'full_name', ask: 'أرسل الاسم الكامل:' },
  { key: 'age', ask: 'أرسل العمر بين 18 و 65:', validate: v => Number(v) >= 18 && Number(v) <= 65, err: 'العمر يجب أن يكون بين 18 و 65.' },
  { key: 'gender', ask: 'أرسل الجنس: ذكر أو أنثى', transform: genderValue, validate: v => !!genderValue(v), err: 'اكتب ذكر أو أنثى.' },
  { key: 'blood_type', ask: 'أرسل فصيلة الدم: A+ A- B+ B- AB+ AB- O+ O-', transform: cleanBlood, validate: isValidBlood, err: 'فصيلة الدم غير صحيحة.' },
  { key: 'phone', ask: 'أرسل رقم الهاتف 9 أرقام يبدأ بـ 7:', transform: phoneOnly, validate: isValidPhone, err: 'رقم الهاتف يجب أن يكون 9 أرقام ويبدأ بـ 7.' },
  { key: 'whatsapp', ask: 'أرسل رقم الواتساب 9 أرقام يبدأ بـ 7، أو اكتب نفس:', transform: (v, data) => String(v).trim() === 'نفس' ? data.phone : phoneOnly(v), validate: (v, data) => String(v).trim() === 'نفس' || isValidPhone(v), err: 'رقم الواتساب غير صحيح.' },
  { key: 'governorate', ask: 'أرسل المحافظة:' },
  { key: 'district', ask: 'أرسل المديرية:' },
  { key: 'address', ask: 'أرسل العنوان التفصيلي:' },
  { key: 'nearest_center', ask: 'أرسل أقرب مركز/مستشفى:' },
  { key: 'last_donation_date', ask: 'أرسل تاريخ آخر تبرع بصيغة YYYY-MM-DD أو اكتب لا:' },
  { key: 'best_call_time', ask: 'أرسل أفضل وقت للاتصال، مثال: من 4 العصر إلى 9 مساءً:' },
  { key: 'password', ask: 'أرسل كلمة مرور للحساب 8 أحرف على الأقل:', validate: v => String(v).length >= 8, err: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' }
];
async function handleRegister(session, text, platform, userId, senderName) {
  const step = registerSteps[session.step];
  let value = text;
  if (step.validate && !step.validate(value, session.data)) return step.err + '\n' + step.ask;
  if (step.transform) value = step.transform(value, session.data);
  session.data[step.key] = value;
  session.step++;
  if (session.step < registerSteps.length) return registerSteps[session.step].ask;
  const result = await apiRequest('register_donor', { ...session.data, platform, platform_user_id: userId, platform_name: senderName });
  sessions.delete(`${platform}:${userId}`);
  return result.ok ? `✅ ${result.message}\n\nاسم المستخدم للدخول إلى الموقع هو رقم الهاتف: ${session.data.phone}` : `❌ ${result.message}`;
}
async function handleSearch(session, text, platform, userId) {
  if (session.step === 0) {
    if (!isValidBlood(text)) return 'فصيلة الدم غير صحيحة. مثال: O+ أو A- أو AB+';
    session.data.blood_type = cleanBlood(text);
    session.step = 1;
    return 'أرسل المحافظة، أو اكتب الكل:';
  }
  if (session.step === 1) {
    if (text !== 'الكل') session.data.governorate = text;
    session.step = 2;
    return 'أرسل المديرية، أو اكتب الكل:';
  }
  if (session.step === 2) {
    if (text !== 'الكل') session.data.district = text;
    const result = await apiRequest('search_donors', session.data);
    sessions.delete(`${platform}:${userId}`);
    return result.ok ? formatDonors(result.donors) : `❌ ${result.message}`;
  }
}
async function handleMessage(platform, userId, text, senderName = '') {
  text = normalizeText(text);
  const key = `${platform}:${userId}`;
  const lower = text.toLowerCase();
  try {
    if (!text || lower === '/start' || text === '0' || text === 'القائمة') return mainMenu();
    if (text === '4' || text.includes('مساعدة') || lower === 'help') return helpText();
    if (text === '1' || text.includes('تسجيل')) return startRegister(platform, userId);
    if (text === '2' || text.includes('بحث') || text.includes('ابحث')) return startSearch(platform, userId);
    if (text === '3' || text.includes('احصائيات') || text.includes('إحصائيات')) {
      const s = await apiRequest('stats', {});
      if (!s.ok) return 'تعذر جلب الإحصائيات.';
      return `📊 إجمالي المتبرعين: ${s.total}\n` + s.by_blood.map(x => `${x.blood_type}: ${x.total}`).join('\n');
    }
    const session = sessions.get(key);
    if (!session) return mainMenu();
    if (session.mode === 'register') return await handleRegister(session, text, platform, userId, senderName);
    if (session.mode === 'search') return await handleSearch(session, text, platform, userId);
    return mainMenu();
  } catch (e) {
    console.error('handleMessage error:', e.message);
    return 'حدث خطأ مؤقت. حاول مرة أخرى.';
  }
}

if (TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_TOKEN !== 'PUT_YOUR_TELEGRAM_BOT_TOKEN_HERE') {
  const tg = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
  tg.on('message', async (msg) => {
    const text = msg.text || '';
    const reply = await handleMessage('telegram', msg.chat.id, text, msg.from?.first_name || '');
    tg.sendMessage(msg.chat.id, reply);
  });
  console.log('Telegram bot started');
} else {
  console.log('Telegram bot token not set, Telegram disabled');
}

async function startWhatsApp() {
  if (!API_BASE_URL || !BOT_API_KEY) console.error('Missing API_BASE_URL or BOT_API_KEY');
  const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, logger: pino({ level: 'silent' }) });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('Scan this WhatsApp QR:');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) startWhatsApp();
      else console.log('WhatsApp logged out. Delete baileys_auth_info and redeploy to scan again.');
    }
    if (connection === 'open') console.log('WhatsApp bot connected');
  });
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;
    const from = m.key.remoteJid;
    const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
    if (!text) return;
    const reply = await handleMessage('whatsapp', from, text, m.pushName || '');
    await sock.sendMessage(from, { text: reply });
  });
}
startWhatsApp().catch(err => console.error('WhatsApp start error:', err));
