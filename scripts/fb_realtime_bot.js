// scripts/fb_realtime_bot.js
// 24/7 Real-time Facebook Messenger AI Bot Engine
// Runs inside the VPS container alongside Next.js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

const PAGE_ID = process.env.FACEBOOK_PAGE_ID || "110644118793600";
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "EAAW6YWihfogBSY0coWHPtYcw2Gwm11ZAznBKAIcOzhgKQJWYITHuelgvzJfoWl0QjgrsRD5DEViDdpVyQKyvxGkBVJ8saKOzXi4IaXvIwYWuJXVJwNxBGsUdru7NAV9Rk5hrGCJigh9NuX1ury8ATCBYvbjBce885iGjucQ3LSbzYQwqQvNGfcu7GO70jQu3QiwI1";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

const PROCESSED_FILE = path.join(process.cwd(), "data", "processed_msg_ids.json");
const processedIds = new Set();

// Preload processed IDs from file if exists
try {
  if (fs.existsSync(PROCESSED_FILE)) {
    const data = JSON.parse(fs.readFileSync(PROCESSED_FILE, "utf-8"));
    for (const id of data) processedIds.add(id);
  }
} catch {}

function saveProcessedId(id) {
  processedIds.add(id);
  try {
    const list = Array.from(processedIds).slice(-500); // keep last 500
    fs.writeFileSync(PROCESSED_FILE, JSON.stringify(list), "utf-8");
  } catch {}
}

// ── Live Product Database Loader ─────────────────────────────────────────────
function getLiveProductContext(query) {
  try {
    const masterPath = path.join(process.cwd(), "data", "medicine_master_complete_db.json");
    const editsPath = path.join(process.cwd(), "data", "custom_user_edits.json");

    if (!fs.existsSync(masterPath)) return "";
    const master = JSON.parse(fs.readFileSync(masterPath, "utf-8"));
    const edits = fs.existsSync(editsPath) ? JSON.parse(fs.readFileSync(editsPath, "utf-8")) : {};

    const q = (query || "").toLowerCase();
    for (const p of master) {
      const edit = edits[p.sl] || {};
      const name = p.name || "";
      const bengali = p.bengali_name || "";
      const key = (p.product_key || "").toLowerCase();

      if (
        (key && q.includes(key)) ||
        (name && q.includes(name.toLowerCase())) ||
        (bengali && q.includes(bengali))
      ) {
        const price = edit.discount_price || edit.regular_price || p.regular_price || p.price;
        const note = edit.custom_offer_note || p.custom_offer_note || "";
        const dosage = edit.dosage_instructions || p.dosage_instructions || "";
        return `\nMATCHED PRODUCT: ${name} (${bengali})\nPRICE: ${price} BDT\nSPECIAL OFFER/NOTE: ${note}\nDOSAGE: ${dosage}\nINDICATION: ${p.indication || p.pain_points_solved || ""}\n`;
      }
    }
  } catch {}
  return "";
}

// ── Gemini AI Generator ──────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

async function generateReply(customerMessage, senderName) {
  const productContext = getLiveProductContext(customerMessage);

  const systemInstruction = `You are Hakim Rejaul Karim - an experienced Unani physician and customer service representative of Galaxy Laboratories (Unani), Bangladesh.
Your identity:
- Name: Hakim Rejaul Karim (হাকিম রেজাউল করিম)
- Title: Unani Physician & Health Consultant, Galaxy Laboratories (Unani)
- Personality: Warm, respectful, trustworthy, deeply knowledgeable in Unani medicine.
Rules:
- Always reply in natural, polite Bengali (বাংলা).
- Start with an Islamic greeting (আসসালামু আলাইকুম) when starting a conversation.
- Do NOT use markdown bolding (like ** or ##). Keep it clean and natural.
- Keep replies direct, concise, and focused on the query.
- If asked about price or medicine: Always use exact price and offer from the live database.
${productContext ? `\n--- LIVE MEDICINE DASHBOARD DATA ---\n${productContext}\n-----------------------------------\n` : ""}
`;

  const models = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];
  for (const m of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: m,
        systemInstruction,
        generationConfig: { maxOutputTokens: 350, temperature: 0.15 }
      });

      const prompt = `Customer (${senderName || "Patient"}): "${customerMessage}". Reply as Hakim Rejaul Karim:`;
      const res = await model.generateContent(prompt);
      const text = res.response.text().trim();
      if (text && text.length > 5) {
        return text.replace(/[*#]+/g, "").trim();
      }
    } catch (err) {
      console.warn(`[AI_MODEL_WARN] (${m}):`, err.message);
    }
  }

  // Safe fallback
  return "আসসালামু আলাইকুম। গ্যালাক্সি ল্যাবরেটরিজের ইউনানি চিকিৎসালয়ে আপনাকে জানাই আন্তরিক মোবারকবাদ। আমি হাকিম রেজাউল করিম বলছি। আপনার শারীরিক কোনো সমস্যা বা কোনো ঔষধ সম্পর্কে বিস্তারিত জানতে চাইলে আমাকে বলুন, আমি সঠিক সমাধান দিচ্ছি।";
}

// ── Send Message via Facebook Graph API ──────────────────────────────────────
async function sendFacebookMessage(recipientId, text) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_TOKEN}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: "RESPONSE"
    })
  });
  return { status: res.status, data: await res.json() };
}

// ── Fetch Recent Conversations from Facebook ─────────────────────────────────
async function fetchConversations() {
  const url = `https://graph.facebook.com/v19.0/${PAGE_ID}/conversations?fields=messages.limit(2){message,from,created_time,id}&access_token=${PAGE_TOKEN}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

// ── Main Polling Loop ────────────────────────────────────────────────────────
let isPolling = false;

async function pollOnce() {
  if (isPolling) return;
  isPolling = true;

  try {
    const convs = await fetchConversations();
    for (const conv of convs) {
      const msgs = conv.messages?.data || [];
      if (msgs.length === 0) continue;

      const lastMsg = msgs[0];
      const isFromCustomer = lastMsg.from?.id && lastMsg.from.id !== PAGE_ID;

      if (isFromCustomer && lastMsg.id && !processedIds.has(lastMsg.id)) {
        saveProcessedId(lastMsg.id);
        const customerName = lastMsg.from?.name || "Customer";
        const messageText = (lastMsg.message || "").trim();

        console.log(`[FB_BOT] 🔔 NEW MESSAGE from ${customerName} (${lastMsg.from.id}): "${messageText}"`);

        // Generate AI reply
        const replyText = await generateReply(messageText, customerName);
        console.log(`[FB_BOT] 🤖 HAKIM REPLY: "${replyText.slice(0, 70)}..."`);

        // Send reply to Messenger
        const sendResult = await sendFacebookMessage(lastMsg.from.id, replyText);
        console.log(`[FB_BOT] 🚀 SENT [${sendResult.status}]:`, sendResult.data?.message_id || sendResult.data);
      }
    }
  } catch (err) {
    // Network hiccup - ignore and keep polling
  } finally {
    isPolling = false;
  }
}

// ── Start Engine ─────────────────────────────────────────────────────────────
async function startBot() {
  console.log("=================================================");
  console.log("  GALAXY BOT - 24/7 REAL-TIME MESSENGER ENGINE   ");
  console.log("  Page ID:", PAGE_ID);
  console.log("=================================================");

  // Initialize: preload old messages so we only reply to new or unreplied recent messages
  try {
    const initConvs = await fetchConversations();
    const now = Date.now();
    for (const conv of initConvs) {
      const msgs = conv.messages?.data || [];
      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        const isLatest = (i === 0);
        const isFromCustomer = m.from?.id && m.from.id !== PAGE_ID;
        const isRecent = (now - new Date(m.created_time).getTime()) < 24 * 60 * 60 * 1000;

        if (isLatest && isFromCustomer && isRecent && !processedIds.has(m.id)) {
          console.log(`[FB_BOT] Found pending unreplied message from ${m.from?.name || "Customer"}: "${m.message}". Processing immediately.`);
        } else {
          if (m.id) processedIds.add(m.id);
        }
      }
    }
    console.log(`[FB_BOT] Preloaded ${processedIds.size} message IDs. Starting loop...`);
  } catch (e) {
    console.warn("[FB_BOT] Init warning:", e.message);
  }

  // Poll every 2.0 seconds
  setInterval(pollOnce, 2000);
}

startBot();
