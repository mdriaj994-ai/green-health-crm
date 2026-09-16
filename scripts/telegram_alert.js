// scripts/telegram_alert.js
// Handles instant Admin notification via Telegram when customer asks unknown/unusual questions
const fs = require("fs");
const path = require("path");

async function sendTelegramAdminAlert({ customerName, senderId, question, pageName = "গ্রীন হেলথ ইউনানী ফার্মেসী" }) {
  const token = process.env.TELEGRAM_ALERT_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  const now = new Date().toLocaleString("en-BD", { timeZone: "Asia/Dhaka" });

  const alertMessage = 
`🚨 [এডমিন অ্যালার্ট: অজানা কাস্টমার জিজ্ঞাসা] 🚨
━━━━━━━━━━━━━━━━━━━━
👤 কাস্টমার: ${customerName || "অজ্ঞাত"}
🆔 Sender ID: ${senderId || "N/A"}
📄 পেজ: ${pageName}
⏰ সময়: ${now}
━━━━━━━━━━━━━━━━━━━━
❓ কাস্টমারের অদ্ভুত/নতুন প্রশ্ন:
"${question}"
━━━━━━━━━━━━━━━━━━━━
⚠️ বট এই চ্যাটটি হোল্ডে রেখে কাস্টমারকে অপেক্ষার মেসেজ দিয়েছে। অনুগ্রহ করে পেজ ইনবক্সে গিয়ে সরাসরি উত্তর দিন!`;

  // 1. Always persist to data/admin_alerts.json (guaranteed in persistent volume)
  try {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const alertPath = path.join(dataDir, "admin_alerts.json");
    let alerts = [];
    if (fs.existsSync(alertPath)) {
      try {
        alerts = JSON.parse(fs.readFileSync(alertPath, "utf-8"));
      } catch (_) {}
    }
    alerts.unshift({
      id: "alt_" + Date.now(),
      customerName: customerName || "অজ্ঞাত",
      senderId: senderId || "",
      pageName,
      question: question || "",
      timestamp: new Date().toISOString()
    });
    // Keep last 100 alerts
    fs.writeFileSync(alertPath, JSON.stringify(alerts.slice(0, 100), null, 2), "utf-8");
    console.log(`[TELEGRAM_ALERT] 💾 Admin alert saved to data/admin_alerts.json`);
  } catch (logErr) {
    console.warn("[TELEGRAM_ALERT_LOG_ERR]", logErr.message);
  }

  // 2. Send via Telegram Bot API if configured
  if (token && token !== "placeholder" && chatId) {
    try {
      const fetchFn = globalThis.fetch || require("node-fetch");
      const res = await fetchFn(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: alertMessage
        })
      });
      const resData = await res.json();
      if (resData.ok) {
        console.log(`[TELEGRAM_ALERT] ✅ Sent alert to Telegram Admin (${chatId})!`);
        return true;
      } else {
        console.warn(`[TELEGRAM_ALERT] ⚠️ Telegram API error:`, resData.description);
      }
    } catch (apiErr) {
      console.error(`[TELEGRAM_ALERT] ❌ Failed to call Telegram API:`, apiErr.message);
    }
  } else {
    console.log(`[TELEGRAM_ALERT] ℹ️ Alert logged to file. (Configure TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID in .env to receive in Telegram)`);
  }
  return false;
}

module.exports = { sendTelegramAdminAlert };
