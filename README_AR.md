# بوت واتساب + تلجرام لبنك تهامة للدم

هذه النسخة مرتبطة بنفس قاعدة بيانات الموقع الحالية ولا تنشئ جدول متبرعين جديد.

## الربط مع الموقع
ارفع ملف `bot_api.php` إلى مجلد الموقع الرئيسي، بجانب مجلد `includes`، بحيث يصبح الرابط مثل:

`https://b-d.rf.gd/bot_api.php`

الملف يستخدم:

`includes/Database.php`

لذلك سيقرأ نفس بيانات الاتصال الموجودة في:

`includes/config.php`

## الجداول المستخدمة
- `users`
- `donors`

عند التسجيل من البوت يتم:
1. إنشاء حساب في جدول `users`، واسم المستخدم هو رقم الهاتف.
2. إنشاء سجل متبرع في جدول `donors` مربوط بـ `user_id`.

## متغيرات Render
ضع هذه القيم في Environment Variables:

```env
PORT=10000
API_BASE_URL=https://b-d.rf.gd/bot_api.php
BOT_API_KEY=horynet_secure_2026
TELEGRAM_BOT_TOKEN=ضع_توكن_تلجرام
BOT_NAME=بنك تهامة للتبرع بالدم
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

## أوامر البوت
- `تسجيل`
- `بحث`
- `إحصائيات`
- `مساعدة`

## ملاحظة واتساب
عند أول تشغيل افتح Logs في Render وامسح QR من واتساب > الأجهزة المرتبطة.
Render المجاني قد ينام، وقد تحتاج إعادة ربط واتساب إذا ضاعت الجلسة.
