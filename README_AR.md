# بوت بنك تهامة للتبرع بالدم

## المميزات
- بوت تلجرام بأزرار اختيار فصيلة الدم والمحافظات والمديريات.
- بوت واتساب Baileys بقوائم مرقمة.
- شعار البنك في بداية محادثة تلجرام.
- روابط: الموقع الإلكتروني، التسجيل المباشر، قائمة المتبرعين.
- صفحة QR للواتساب على Render عبر الرابط `/qr`.
- ربط التسجيل والبحث بقاعدة بيانات الموقع عبر `bot_api.php`.

## الملفات المهمة
- `index.js` تشغيل الخدمة.
- `src/telegram.js` بوت تلجرام.
- `src/whatsapp.js` بوت واتساب.
- `src/data.js` المحافظات والمديريات وفصائل الدم.
- `site/bot_api.php` ارفعه إلى مجلد الموقع الرئيسي.

## متغيرات Render
ضع في Environment:

```env
API_URL=https://b-d.rf.gd/bot_api.php
BOT_API_KEY=horynet_secure_2026
TELEGRAM_TOKEN=توكن_تلجرام
ENABLE_TELEGRAM=true
ENABLE_WHATSAPP=true
BANK_NAME=بنك تهامة للتبرع بالدم
BANK_LOGO_URL=https://b-d.rf.gd/uploads/slider/slide_1774892301_220.jpg
WEBSITE_URL=https://b-d.rf.gd/index.php
REGISTER_URL=https://b-d.rf.gd/register.php
DONORS_URL=https://b-d.rf.gd/donors.php
```

## أوامر Render
Build Command:
```bash
npm install
```
Start Command:
```bash
npm start
```

## واتساب
بعد النشر افتح:
`https://blood-donor-bot.onrender.com/qr`
ثم امسح QR من واتساب > الأجهزة المرتبطة > ربط جهاز.

## ملاحظات
- ملف `site/bot_api.php` يجب رفعه للموقع وليس Render.
- إذا ظهر unauthorized عند فتح `bot_api.php` مباشرة فهذا طبيعي.
