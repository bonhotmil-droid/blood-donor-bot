# بوت بنك تهامة للتبرع بالدم - نسخة كاملة

## الملفات
- `index.js` بوت واتساب Baileys + بوت تلجرام + صفحة QR.
- `package.json` حزم المشروع.
- `.env.example` مثال متغيرات Render.
- `bot_api.php` يرفع إلى الموقع داخل `htdocs` أو `public_html`.

## متغيرات Render
```
API_URL=https://b-d.rf.gd/bot_api.php
BOT_API_KEY=horynet_secure_2026
TELEGRAM_TOKEN=توكن_بوت_تلجرام
ENABLE_TELEGRAM=true
ENABLE_WHATSAPP=true
```

## الأوامر في Render
Build Command:
```
npm install
```
Start Command:
```
npm start
```

## رابط QR واتساب
بعد النشر افتح:
```
https://blood-donor-bot.onrender.com/qr
```
أو:
```
https://blood-donor-bot.onrender.com/qr.png
```

## التحديثات المضافة
- شعار البنك في بداية المحادثة.
- أزرار تلجرام رئيسية.
- روابط: الموقع الإلكتروني، التسجيل المباشر، قائمة المتبرعين.
- فصيلة الدم بأزرار.
- المحافظات بأزرار.
- المديريات تظهر حسب المحافظة المختارة.
- واتساب بقوائم مرقمة.
- رسائل خطأ أوضح عند فشل API.
