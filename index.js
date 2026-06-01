require('dotenv').config();
const express = require('express');
const { startTelegram } = require('./src/telegram');
const { startWhatsApp, getLatestQr } = require('./src/whatsapp');

const app = express();
const PORT = process.env.PORT || 10000;
const BANK_NAME = process.env.BANK_NAME || 'بنك تهامة للتبرع بالدم';

app.get('/', (req, res) => {
  res.send(`bots are running ${BANK_NAME}<br><br>WhatsApp QR: <a href="/qr">/qr</a>`);
});
app.get('/qr', (req, res) => {
  const qr = getLatestQr();
  if (!qr) return res.send('لا يوجد QR حاليًا. إذا كان واتساب متصلًا فلن يظهر QR. أعد تشغيل الخدمة إذا احتجت QR جديد.');
  res.send(`<html><body style="font-family:Arial;text-align:center;direction:rtl"><h2>امسح QR من واتساب</h2><p>واتساب ← الأجهزة المرتبطة ← ربط جهاز</p><img src="${qr}" style="max-width:360px;width:90%;border:1px solid #ddd;padding:10px"></body></html>`);
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
if (process.env.ENABLE_TELEGRAM === 'true') startTelegram();
if (process.env.ENABLE_WHATSAPP === 'true') startWhatsApp();
