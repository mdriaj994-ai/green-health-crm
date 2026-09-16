# ✅ WORKING BACKUP — 2026-09-16
## Green Health Bot — সব কাজ করছে এই তারিখে

---

## ⚠️ গুরুত্বপূর্ণ নিয়ম
**এই backup folder-এর কোনো ফাইল কখনো পরিবর্তন করা যাবে না।**
শুধু reference হিসেবে দেখা যাবে।
কোনো ফাইল restore করতে হলে: backup থেকে copy করে main folder-এ paste করো।

---

## এই তারিখে যা কাজ করছিল:

### ✅ Order System
- Facebook Messenger-এ order message পাঠালে dashboard-এ save হয়
- Customer-কে confirmation message পাঠানো হয়
- Order detection: `নাম=X | জেলা=X | থানা=X | রিসিভ ঠিকানা=X | নাম্বার=X`

### ✅ Voice Bot
- Customer voice note পাঠালে transcribe → AI reply → voice note হিসেবে reply
- ElevenLabs voice (ID: nsJQzXf7dXyDnOFqO3uX)

### ✅ Token System
- Permanent token hardcoded in bot
- Startup-এ DB-তে token fix হয়

### ✅ Sync
- প্রতি ৫ মিনিটে Facebook messages sync হয়

---

## Key Fix যা করা হয়েছে:

| সমস্যা | Fix |
|---|---|
| Order dashboard-এ যাচ্ছিল না | Webhook handler-এ order detection যোগ |
| `no such table: Order` | `getDb()` তে auto-create যোগ |
| `contact.findFirst` error | prisma.ts-এ findFirst যোগ |
| Token expire | Startup-এ permanent token pre-fix |

---

## Backup Files:

```
backup/2026-09-16_WORKING/
├── scripts/
│   ├── fb_realtime_bot.js       ← Main bot (voice, order detect)
│   ├── sync_fb_messages.js      ← Facebook message sync
│   ├── save_order_to_db.js      ← Order parsing & DB save
│   └── start-all.js             ← App entry point
└── src/
    ├── app/api/
    │   ├── webhooks/facebook/
    │   │   └── route.ts         ← Webhook handler (order detect HERE)
    │   └── orders/
    │       └── route.ts         ← Orders CRUD API
    └── lib/
        └── prisma.ts            ← SQLite DB client (contact.findFirst fixed)
```

---

## Restore করার নিয়ম:
```
# কোনো ফাইল restore করতে:
Copy: backup/2026-09-16_WORKING/scripts/fb_realtime_bot.js
Paste to: scripts/fb_realtime_bot.js

# তারপর GitHub push করো:
git add .
git commit -m "restore: working version 2026-09-16"
git push origin main
# তারপর Coolify Redeploy
```

---

## GitHub Latest Working Commits:
- `4e2bbc6` — fix: auto-create Order table in getDb()
- `80360d8` — fix: contact.findFirst added to prisma client
- `f47cae7` — fix: order detection in webhook handler
- `fe35328` — fix: dual-save orders via DB + API
- `8003787` — debug: ORDER_DETECT logs added

**Coolify URL:** https://greenhelth.duckdns.org
**Page ID:** 110644118793600
**Bot Version:** v2026-09-16
