require('dotenv').config();
const express = require('express');
const axios = require('axios');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
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

const SITE_URL = 'https://b-d.rf.gd/index.php';
const REGISTER_URL = 'https://b-d.rf.gd/register.php';
const DONORS_URL = 'https://b-d.rf.gd/donors.php';
const LOGO_URL = 'https://b-d.rf.gd/uploads/slider/slide_1774892301_220.jpg';

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const GOVERNORATES = {
  'أمانة العاصمة': ['التحرير','الثورة','الصافية','السبعين','شعوب','معين','الوحدة','أزال','بني الحارث','صنعاء القديمة'],
  'صنعاء': ['بني مطر','سنحان وبني بهلول','بلاد الروس','الحيمة الداخلية','الحيمة الخارجية','همدان','أرحب','نهم','خولان','مناخة','بني حشيش'],
  'عدن': ['صيرة','خور مكسر','المعلا','التواهي','المنصورة','الشيخ عثمان','دار سعد','البريقة'],
  'تعز': ['القاهرة','المظفر','صالة','التعزية','شرعب السلام','شرعب الرونة','ماوية','المخا','الشمايتين','المواسط','جبل حبشي','حيفان','المعافر'],
  'إب': ['الظهار','المشنة','ريف إب','جبلة','يريم','النادرة','السدة','بعدان','حبيش','القفر','السياني','الرضمة'],
  'الحديدة': ['الحوك','الحالي','الميناء','باجل','زبيد','بيت الفقيه','التحيتا','الدريهمي','الزيدية','اللحية','القناوص','الخوخة'],
  'حضرموت': ['المكلا','الشحر','غيل باوزير','سيئون','تريم','شبام','القطن','دوعن','وادي العين وحورة','بروم ميفع'],
  'ذمار': ['مدينة ذمار','عنس','ميفعة عنس','جهران','وصاب العالي','وصاب السافل','الحداء','ضوران آنس','عتمة','مغرب عنس'],
  'لحج': ['الحوطة','تبن','طور الباحة','المضاربة ورأس العارة','القبيطة','يافع','ردفان','الملاح','المسيمير'],
  'أبين': ['زنجبار','خنفر','لودر','مودية','المحفد','أحور','رصد','سرار','سباح'],
  'شبوة': ['عتق','بيحان','عسيلان','مرخة','نصاب','حبان','رضوم','ميفعة','الروضة'],
  'مأرب': ['مدينة مأرب','مأرب الوادي','صرواح','حريب','الجوبة','رغوان','مدغل','مجزر','بدبدة'],
  'البيضاء': ['مدينة البيضاء','رداع','الصومعة','مكيراس','ذي ناعم','الزاهر','الطفة','القريشية','السوادية'],
  'الجوف': ['الحزم','الغيل','المتون','الخلق','خب والشعف','برط العنان','المصلوب','رجوزة'],
  'حجة': ['مدينة حجة','عبس','حرض','ميدي','كشر','مبين','الشاهل','نجرة','بني العوام','أفلح اليمن'],
  'عمران': ['مدينة عمران','ريدة','خمر','حوث','السودة','شهارة','حرف سفيان','عيال سريح','جبل يزيد'],
  'صعدة': ['مدينة صعدة','سحار','الصفراء','كتاف والبقع','باقم','رازح','غمر','منبه','مجز'],
  'المحويت': ['مدينة المحويت','الرجم','شبام كوكبان','الخبت','ملحان','حفاش','بني سعد','الطويلة'],
  'ريمة': ['الجبين','كسمة','السلفية','بلاد الطعام','مزهر','الجعفرية'],
  'الضالع': ['مدينة الضالع','دمت','قعطبة','الحصين','الأزارق','جحاف','الشعيب'],
  'المهرة': ['الغيضة','حوف','شحن','سيحوت','المسيلة','منعر','قشن'],
  'سقطرى': ['حديبو','قلنسية وعبد الكوري'],
};

const sessions = new Map();
let latestQrDataUrl = null;
let latestQrText = null;

const app = express();
app.use(express.json());
app.get('/', (req, res) => res.send('bots are running بنك تهامة للتبرع بالدم'));
app.get('/health', (req, res) => res.json({ ok: true, service: 'blood-donor-bots-complete' }));
app.get('/qr', (req, res) => {
  if (!latestQrDataUrl) return res.send('<h2>لا يوجد QR حاليًا</h2><p>إذا كان واتساب متصلًا فلن يظهر QR.</p>');
  res.send(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WhatsApp QR</title><style>body{font-family:Tahoma,Arial;text-align:center;padding:25px;background:#f7f7f7}img{max-width:92vw;border:10px solid white;border-radius:18px;box-shadow:0 8px 30px #999}.box{background:white;border-radius:18px;padding:20px;display:inline-block}</style></head><body><div class="box"><h2>امسح QR من واتساب</h2><p>واتساب → الأجهزة المرتبطة → ربط جهاز</p><img src="${latestQrDataUrl}" /></div></body></html>`);
});
app.get('/qr.png', async (req, res) => {
  if (!latestQrText) return res.status(404).send('No QR available');
  const buf = await QRCode.toBuffer(latestQrText, { type: 'png', width: 420, margin: 2 });
  res.type('png').send(buf);
});
app.listen(PORT, () => console.log(`✅ Web server running on port ${PORT}`));

function chunk(arr, size) { const out=[]; for (let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size)); return out; }
function normalizeBlood(text='') { return String(text).toUpperCase().replace('او موجب','O+').replace('او سالب','O-').replace('0+','O+').replace('0-','O-').trim(); }
function selectByNumberOrText(text, list) {
  const t = String(text || '').trim();
  const n = parseInt(t, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= list.length) return list[n-1];
  return list.find(x => x === t) || null;
}
function apiErrorText(res) { return res?.details || res?.error || res?.message || 'خطأ غير معروف'; }

function mainText() {
  return `🩸 أهلاً وسهلاً بك في بنك تهامة الإلكتروني للتبرع بالدم\n\nيمكنك من خلال البوت:\n🩸 تسجيل نفسك كمتبرع.\n🔎 البحث عن متبرعين.\n📋 فتح قائمة المتبرعين.\n🌐 زيارة الموقع الإلكتروني.`;
}
function waMainMenu() {
  return `${mainText()}\n\nاختر رقم الخدمة:\n1) 🩸 تسجيل متبرع\n2) 🔎 بحث عن متبرع\n3) 🌐 الموقع الإلكتروني\n4) 🏥 التسجيل المباشر في البنك\n5) 📋 قائمة المتبرعين\n\nروابط مهمة:\n🌐 ${SITE_URL}\n🏥 ${REGISTER_URL}\n📋 ${DONORS_URL}`;
}
function tgMainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🩸 تسجيل متبرع', 'register_start'), Markup.button.callback('🔎 البحث عن متبرع', 'search_start')],
    [Markup.button.url('🌐 الموقع الإلكتروني', SITE_URL)],
    [Markup.button.url('🏥 التسجيل المباشر في البنك', REGISTER_URL)],
    [Markup.button.url('📋 قائمة المتبرعين', DONORS_URL)],
  ]);
}
function tgBackHomeKeyboard(backAction='main_menu') {
  return Markup.inlineKeyboard([[Markup.button.callback('⬅️ رجوع', backAction), Markup.button.callback('🏠 القائمة الرئيسية', 'main_menu')]]);
}
function tgBloodKeyboard(prefix='blood') {
  return Markup.inlineKeyboard([...chunk(BLOOD_TYPES.map(b => Markup.button.callback(b, `${prefix}:${b}`)), 4), [Markup.button.callback('🏠 القائمة الرئيسية', 'main_menu')]]);
}
function tgGovernorateKeyboard(prefix='gov') {
  return Markup.inlineKeyboard([...chunk(Object.keys(GOVERNORATES).map(g => Markup.button.callback(g, `${prefix}:${g}`)), 2), [Markup.button.callback('🏠 القائمة الرئيسية', 'main_menu')]]);
}
function tgDistrictKeyboard(gov, prefix='district') {
  const districts = GOVERNORATES[gov] || [];
  return Markup.inlineKeyboard([...chunk(districts.map(d => Markup.button.callback(d, `${prefix}:${d}`)), 2), [Markup.button.callback('⬅️ رجوع', 'register_back_gov'), Markup.button.callback('🏠 القائمة الرئيسية', 'main_menu')]]);
}
function govListText() { return Object.keys(GOVERNORATES).map((g,i)=>`${i+1}) ${g}`).join('\n'); }
function districtListText(gov) { return (GOVERNORATES[gov] || []).map((d,i)=>`${i+1}) ${d}`).join('\n'); }

async function apiRequest(action, payload = {}) {
  const { data } = await axios.post(API_URL, { action, ...payload }, {
    headers: { 'X-BOT-API-KEY': BOT_API_KEY, 'Content-Type': 'application/json' },
    timeout: 20000,
    validateStatus: () => true
  });
  console.log('🌐 API RESPONSE:', action, JSON.stringify(data));
  return data;
}
async function registerDonor(data) {
  const res = await apiRequest('register_donor', data);
  if (!res.ok) throw new Error(apiErrorText(res));
  return res;
}
async function searchDonors(blood_type, governorate='') {
  const res = await apiRequest('search_donors', { blood_type, governorate });
  if (!res.ok) throw new Error(apiErrorText(res));
  return res.donors || [];
}
function formatDonors(donors) {
  if (!donors.length) return 'لم يتم العثور على متبرعين مطابقين.';
  return donors.slice(0, 10).map((d, i) => `${i+1}) ${d.full_name || 'متبرع'}\n🩸 ${d.blood_type || ''}\n📍 ${d.governorate || ''} - ${d.district || ''}\n📞 ${d.phone || d.whatsapp || ''}`).join('\n\n');
}

function startRegister(userId) { sessions.set(userId, { mode: 'register', step: 'full_name', data: {} }); }
function resetSession(userId) { sessions.delete(userId); }

async function sendTelegramHome(ctx, edit=false) {
  resetSession('tg:' + ctx.from.id);
  const caption = mainText();
  try {
    if (edit && ctx.callbackQuery?.message) return ctx.editMessageCaption(caption, tgMainKeyboard()).catch(() => ctx.replyWithPhoto(LOGO_URL, { caption, ...tgMainKeyboard() }));
    return ctx.replyWithPhoto(LOGO_URL, { caption, ...tgMainKeyboard() });
  } catch (e) {
    return ctx.reply(caption, tgMainKeyboard());
  }
}

async function startTelegram() {
  if (!ENABLE_TELEGRAM) return console.log('ℹ️ Telegram disabled');
  if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN.includes('PUT_')) return console.log('⚠️ TELEGRAM_TOKEN missing, Telegram bot not started');
  const bot = new Telegraf(TELEGRAM_TOKEN);

  bot.start(ctx => sendTelegramHome(ctx));
  bot.action('main_menu', async ctx => { await ctx.answerCbQuery(); return sendTelegramHome(ctx, true); });
  bot.action('register_start', async ctx => { await ctx.answerCbQuery(); const userId='tg:'+ctx.from.id; startRegister(userId); return ctx.reply('اكتب الاسم الكامل للمتبرع:', tgBackHomeKeyboard()); });
  bot.action(/^blood:(.+)/, async ctx => {
    await ctx.answerCbQuery(); const userId='tg:'+ctx.from.id; const s=sessions.get(userId); if (!s) return ctx.reply('اضغط تسجيل متبرع للبدء.', tgMainKeyboard());
    s.data.blood_type = ctx.match[1]; s.step='phone'; return ctx.reply('اكتب رقم الهاتف:', tgBackHomeKeyboard());
  });
  bot.action(/^gov:(.+)/, async ctx => {
    await ctx.answerCbQuery(); const userId='tg:'+ctx.from.id; const s=sessions.get(userId); if (!s) return ctx.reply('اضغط تسجيل متبرع للبدء.', tgMainKeyboard());
    s.data.governorate = ctx.match[1]; s.step='district'; return ctx.reply(`اختر المديرية التابعة لمحافظة ${ctx.match[1]}:`, tgDistrictKeyboard(ctx.match[1]));
  });
  bot.action('register_back_gov', async ctx => { await ctx.answerCbQuery(); return ctx.reply('اختر المحافظة:', tgGovernorateKeyboard()); });
  bot.action(/^district:(.+)/, async ctx => {
    await ctx.answerCbQuery(); const userId='tg:'+ctx.from.id; const s=sessions.get(userId); if (!s) return ctx.reply('اضغط تسجيل متبرع للبدء.', tgMainKeyboard());
    s.data.district = ctx.match[1]; resetSession(userId);
    try { await registerDonor(s.data); return ctx.reply('✅ تم تسجيل المتبرع بنجاح في قاعدة بيانات الموقع.\nجزاك الله خيرًا.', tgMainKeyboard()); }
    catch(e) { console.error('❌ TELEGRAM REGISTER ERROR:', e); return ctx.reply('تعذر التسجيل: ' + e.message, tgMainKeyboard()); }
  });
  bot.action('search_start', async ctx => { await ctx.answerCbQuery(); sessions.set('tg:'+ctx.from.id, { mode:'search', step:'blood_type', data:{} }); return ctx.reply('اختر فصيلة الدم المطلوبة:', tgBloodKeyboard('search_blood')); });
  bot.action(/^search_blood:(.+)/, async ctx => { await ctx.answerCbQuery(); const userId='tg:'+ctx.from.id; const s=sessions.get(userId)||{mode:'search',data:{}}; s.data.blood_type=ctx.match[1]; s.step='governorate'; sessions.set(userId,s); return ctx.reply('اختر المحافظة أو اكتب بحث مباشر بدون محافظة:', tgGovernorateKeyboard('search_gov')); });
  bot.action(/^search_gov:(.+)/, async ctx => { await ctx.answerCbQuery(); const userId='tg:'+ctx.from.id; const s=sessions.get(userId); const blood=s?.data?.blood_type; resetSession(userId); try { const donors=await searchDonors(blood, ctx.match[1]); return ctx.reply(formatDonors(donors), tgMainKeyboard()); } catch(e){ return ctx.reply('تعذر البحث: '+e.message, tgMainKeyboard()); } });

  bot.on('text', async ctx => {
    const userId='tg:'+ctx.from.id; const text=(ctx.message.text||'').trim(); const s=sessions.get(userId);
    if (['/start','القائمة','الرئيسية','🏠 القائمة الرئيسية'].includes(text)) return sendTelegramHome(ctx);
    if (['تسجيل','🩸 تسجيل متبرع'].includes(text)) { startRegister(userId); return ctx.reply('اكتب الاسم الكامل للمتبرع:', tgBackHomeKeyboard()); }
    if (text.startsWith('بحث')) {
      const parts = text.split(/\s+/).slice(1); const blood=normalizeBlood(parts[0]||''); const gov=parts.slice(1).join(' ');
      try { return ctx.reply(formatDonors(await searchDonors(blood, gov)), tgMainKeyboard()); } catch(e){ return ctx.reply('تعذر البحث: '+e.message, tgMainKeyboard()); }
    }
    if (!s) return ctx.reply('اختر خدمة من القائمة:', tgMainKeyboard());
    if (s.mode === 'register') {
      if (s.step === 'full_name') { s.data.full_name=text; s.step='blood_type'; return ctx.reply('اختر فصيلة الدم:', tgBloodKeyboard('blood')); }
      if (s.step === 'phone') { s.data.phone=text; s.data.whatsapp=text; s.step='governorate'; return ctx.reply('اختر المحافظة:', tgGovernorateKeyboard('gov')); }
    }
    return ctx.reply('اختر من الأزرار أو اضغط القائمة الرئيسية.', tgMainKeyboard());
  });

  await bot.launch();
  console.log('✅ Telegram bot started');
}

async function handleWhatsAppMessage(userId, text, senderPhone='') {
  text = (text || '').trim();
  if (!text || ['/start','start','مساعدة','مساعده','قائمة','القائمة','0','menu'].includes(text.toLowerCase())) return waMainMenu();
  if (text === '3') return `🌐 الموقع الإلكتروني:\n${SITE_URL}`;
  if (text === '4') return `🏥 التسجيل المباشر في البنك:\n${REGISTER_URL}`;
  if (text === '5') return `📋 قائمة المتبرعين:\n${DONORS_URL}`;
  if (text === '1' || text === 'تسجيل') { startRegister(userId); return 'اكتب الاسم الكامل للمتبرع:'; }
  if (text === '2' || text.startsWith('بحث')) {
    if (text === '2') { sessions.set(userId, { mode:'search', step:'blood_type', data:{} }); return 'اختر فصيلة الدم المطلوبة:\n' + BLOOD_TYPES.map((b,i)=>`${i+1}) ${b}`).join('\n'); }
    const parts = text.split(/\s+/).slice(1); const blood=normalizeBlood(parts[0]||''); const gov=parts.slice(1).join(' ');
    try { return formatDonors(await searchDonors(blood, gov)); } catch(e){ return 'تعذر البحث: '+e.message; }
  }
  const s = sessions.get(userId);
  if (!s) return 'لم أفهم طلبك. اكتب: قائمة';
  if (s.mode === 'search') {
    if (s.step === 'blood_type') { const selected=selectByNumberOrText(normalizeBlood(text), BLOOD_TYPES); if(!selected) return 'اختر فصيلة صحيحة:\n'+BLOOD_TYPES.map((b,i)=>`${i+1}) ${b}`).join('\n'); s.data.blood_type=selected; s.step='governorate'; return 'اختر المحافظة أو اكتب 0 للبحث في كل المحافظات:\n0) كل المحافظات\n'+govListText(); }
    if (s.step === 'governorate') { const gov=text==='0'?'':selectByNumberOrText(text,Object.keys(GOVERNORATES)); resetSession(userId); try { return formatDonors(await searchDonors(s.data.blood_type, gov)); } catch(e){ return 'تعذر البحث: '+e.message; } }
  }
  const d = s.data;
  if (s.mode === 'register') {
    if (s.step === 'full_name') { d.full_name=text; s.step='blood_type'; return 'اختر فصيلة الدم:\n' + BLOOD_TYPES.map((b,i)=>`${i+1}) ${b}`).join('\n'); }
    if (s.step === 'blood_type') { const selected=selectByNumberOrText(normalizeBlood(text), BLOOD_TYPES); if(!selected) return 'اختر فصيلة صحيحة:\n'+BLOOD_TYPES.map((b,i)=>`${i+1}) ${b}`).join('\n'); d.blood_type=selected; s.step='phone'; return 'اكتب رقم الهاتف:'; }
    if (s.step === 'phone') { d.phone=text; d.whatsapp=senderPhone || text; s.step='governorate'; return 'اختر المحافظة برقمها أو اكتب اسمها:\n'+govListText(); }
    if (s.step === 'governorate') { const selected=selectByNumberOrText(text,Object.keys(GOVERNORATES)); if(!selected) return 'اختر محافظة صحيحة:\n'+govListText(); d.governorate=selected; s.step='district'; return `اختر المديرية التابعة لمحافظة ${selected}:\n`+districtListText(selected); }
    if (s.step === 'district') { const selected=selectByNumberOrText(text,GOVERNORATES[d.governorate]||[]); if(!selected) return `اختر مديرية صحيحة من ${d.governorate}:\n`+districtListText(d.governorate); d.district=selected; resetSession(userId); try { await registerDonor(d); return '✅ تم تسجيل المتبرع بنجاح في قاعدة بيانات الموقع.\nجزاك الله خيرًا.'; } catch(e){ console.error('❌ WHATSAPP REGISTER ERROR:', e); return 'تعذر التسجيل: '+e.message; } }
  }
  return 'حدث خطأ في الجلسة. اكتب: قائمة';
}

async function startWhatsApp() {
  if (!ENABLE_WHATSAPP) return console.log('ℹ️ WhatsApp disabled');
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, logger: P({ level: 'silent' }), printQRInTerminal: false });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      latestQrText = qr;
      latestQrDataUrl = await QRCode.toDataURL(qr, { width: 420, margin: 2 });
      console.log('📱 امسح QR التالي من واتساب > الأجهزة المرتبطة > ربط جهاز');
      console.log('🔗 أو افتح رابط QR كصورة: /qr أو /qr.png من رابط Render');
      qrcodeTerminal.generate(qr, { small: true });
    }
    if (connection === 'open') { latestQrDataUrl=null; latestQrText=null; console.log('✅ WhatsApp connected'); }
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
    const reply = await handleWhatsAppMessage('wa:' + jid, text, phone);
    if (['/start','start','قائمة','القائمة','menu'].includes(text.toLowerCase().trim())) {
      try { await sock.sendMessage(jid, { image: { url: LOGO_URL }, caption: reply }); return; } catch(e) {}
    }
    await sock.sendMessage(jid, { text: reply });
  });
}

startTelegram().catch(e => console.error('❌ Telegram error:', e));
startWhatsApp().catch(e => console.error('❌ WhatsApp error:', e));
