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
    let matched = null;

    // Search query for specific product in master database
    if (q) {
      for (const p of master) {
        const name = (p["ওষুধের নাম (Brand Name)"] || "").toLowerCase();
        const generic = (p["জেনেরিক ও ফার্মাকোলজিক্যাল ক্লাস (Generic & Class)"] || "").toLowerCase();
        if ((name && q.includes(name)) || (generic && q.includes(generic))) {
          matched = p;
          break;
        }
      }
    }

    // Only default to Soul Mate if the customer's query is general about price, order, usage, or mentions soul mate
    const isGeneralAdQuery = /^(দাম|কত|প্রাইস|price|কাজ|উপকার|কিভাবে|অর্ডার|ডেলিভারি|খাব|নিয়ম|order|koto|dam|kaj|rule)/i.test(q) ||
      q.includes("soul") || q.includes("সোল") || q.includes("মেট") || q.includes("mate") ||
      q.includes("খাওয়ার") || q.includes("কাজ কি") || q.includes("দাম কত") || q.includes("নিতে চাই");

    if (!matched && isGeneralAdQuery) {
      matched = master.find(p => String(p.SL) === "39");
    }

    if (matched) {
      const sl = String(matched.SL);
      const edit = edits[sl] || {};
      const name = matched["ওষুধের নাম (Brand Name)"] || "Soul Mate (সোল মেট)";
      const price = edit.discount_price || edit.custom_price || "৩,০০০";
      const regPrice = edit.custom_price || "";
      const note = edit.custom_note || "ক্যাশ অন ডেলিভারি, পার্সেল হাতে পেয়ে পেমেন্ট।";
      const pitch = edit.custom_pitch || matched["১. কাস্টমারের আসল সমস্যা ও পেইন পয়েন্ট (Pain Point Mapping)"] || "";
      const dosage = edit.dosageForm || matched["১৩. স্ট্যান্ডার্ড মেডিকেল ডোজ ও সেবন প্রোটোকল (Dosage & Protocols)"] || matched["ডোজ ফর্ম ও শক্তি (Dosage Form & Strength)"] || "";
      const indications = matched["১. কাস্টমারের আসল সমস্যা ও পেইন পয়েন্ট (Pain Point Mapping)"] || "";
      const dietary = matched["৬. পুষ্টি ও দ্রুত ফলাফল পাওয়ার খাদ্যাভ্যাস (Dietary Blueprint)"] || "";
      const superiority = matched["২. বাজারের অন্যান্য ওষুধের সাথে শ্রেষ্ঠত্ব (Superiority Matrix)"] || "";
      const ageSolutions = matched["৩. বয়স ভিত্তিক কাস্টমাইজড সমাধান (Age-Specific Solutions)"] || "";
      const objectionsList = matched["৫. কাস্টমারের ৪টি কঠিন আপত্তি ও উত্তর (Objection Destroyers)"] || [];
      const objectionsFormatted = Array.isArray(objectionsList)
        ? objectionsList.map(o => `প্রশ্ন: ${o.objection}\nউত্তর: ${o.script}`).join("\n\n")
        : "";

      return `
[লাইভ ড্যাশবোর্ড ও এনসাইক্লোপিডিয়া প্রোডাক্ট তথ্য / Live Encyclopedia Product Data]
ওষুধের নাম: ${name}
মূল্য: ${price} টাকা ${regPrice && regPrice !== price ? `(রেগুলার: ${regPrice} টাকা)` : ""}
অফার ও ডেলিভারি নোট: ${note}
কার্যকারিতা ও সমাধান: ${pitch}
সেবনবিধি / ডোজ: ${dosage}
সমস্যা ও ইন্ডিকেশন: ${indications}
${superiority ? `শ্রেষ্ঠত্ব ও কেন সেরা: ${superiority}` : ""}
${dietary ? `খাদ্যাভ্যাস ও পথ্য (Diet Plan): ${dietary}` : ""}
${ageSolutions ? `বয়স ভিত্তিক পরামর্শ: ${ageSolutions}` : ""}
${objectionsFormatted ? `কাস্টমারের কমন আপত্তি ও বিক্রির সঠিক উত্তর:\n${objectionsFormatted}` : ""}
      `.trim();
    }
  } catch (err) {
    console.error("DB error:", err);
  }
  return "";
}

// ── Gemini AI Generator ──────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

async function generateReply(customerMessage, senderName) {
  const productContext = getLiveProductContext(customerMessage);

  const systemInstruction = `You are an expert, empathetic, and persuasive human customer support and sales representative for our authentic healthcare & herbal medicine store in Bangladesh.

Core Communication Rules:
1. Natural Bengali: Always reply in fluent, natural, polite Bengali (বাংলা). Chat like a helpful human page admin chatting on Facebook Messenger.
2. Direct yet Persuasive: Answer the customer's exact question clearly and concisely, but also understand their psychology, hesitation, and situation to build trust and convince them.
3. Greetings Rule:
   - ONLY say "ওয়ালাইকুম আসসালাম" IF the customer explicitly greeted with "আসসালামু আলাইকুম" or "সালাম".
   - If the customer says "Hi", "Hello", "হাই", "হ্যালো", respond warmly and naturally, e.g.: "জি বলুন, কীভাবে সাহায্য করতে পারি?"
   - If the customer asks a direct question (e.g., "দাম কত?", "কি কাজ করে?", "খাব কিভাবে?"), do NOT include any greeting or introduction at all. Answer the question directly!
4. Product Availability & Unknown Items (CRITICAL):
   - If a customer asks for ANY medicine, product, brand, or illness treatment that is NOT in our provided database (for example: "নাপা আছে?", "প্যারাসিটামল আছে?", "টাইগার আছে?", "সারজেল আছে?", "ক্যান্সারের ওষুধ আছে?"):
     You MUST state clearly and directly: "দুঃখিত, এই প্রোডাক্টটি বর্তমানে আমাদের কাছে নেই।" (or "দুঃখিত, এটার ওষুধ আমাদের কাছে নেই।")
   - If a customer asks about something we do not know or do not have in our database:
     Reply: "দুঃখিত, এ বিষয়ে আমাদের কাছে তথ্য নেই।"
   - NEVER make up fake product info, and NEVER recommend an unrelated product like Soul Mate when an unavailable product was requested.
5. Sales Psychology & Customer Objection Handling (High-Converting):
   - Empathy & Trust: If the customer shares an emotional hesitation, past bad experience, or doubt, empathize sincerely and reassure them with facts.
   - Fraud/Scam Fear: If customer is afraid of being cheated or getting fake products, remove all risk: "আপনার এমন ভাবাটা স্বাভাবিক। তবে নিশ্চিন্ত থাকুন, আপনাকে ১ টাকাও অগ্রিম দিতে হবে না। সম্পূর্ণ ক্যাশ অন ডেলিভারিতে পার্সেল হাতে পেয়ে নিশ্চিত হয়ে তারপর মূল্য পরিশোধ করবেন।"
   - Price Objection (দাম বেশি মনে করলে): Politely explain the value of pure, rare herbal ingredients (আসল শিলাজিৎ, কোরিয়ান জিনসেং, জাফরান) that give safe, permanent root-cause healing without any harmful side effects, unlike cheap temporary chemicals.
   - Closing Call-to-Action: After answering their question or resolving their doubt, politely encourage them to place an order by providing their Name, Address, and Mobile Number.
6. Self-Identity Rule:
   - NEVER introduce yourself as any individual doctor, hakim, or person. Do NOT say "আমি হাকিম...", "আমি অমুক বলছি", or "আমাদের প্রতিষ্ঠানে স্বাগতম".
   - Speak naturally on behalf of the customer care team.
7. Product Context & Live Dashboard Truth:
   - Our main active campaign product is Soul Mate (সোল মেট / Lion Strong™).
   - If the customer asks general questions about the ad ("দাম কত?", "কাজ কি?", "অর্ডার করব কিভাবে?") without asking for an unavailable brand name, answer strictly using Soul Mate data.
   - If the customer asks about another specific medicine that IS in our database, use that medicine's data.
   - All prices, offers, and dosage MUST strictly match the Live Medicine Dashboard Data provided below.
8. Ordering & Delivery:
   - Delivery is Cash on Delivery (ক্যাশ অন ডেলিভারি - পার্সেল হাতে পেয়ে মূল্য পরিশোধ)।
   - Packaging is 100% discrete (১০০% গোপনীয়তা বজায় রেখে পার্সেল পাঠানো হয়)।
9. Clean Plain Text:
   - Plain text only. Absolutely DO NOT use markdown bolding or asterisks (no ** or ## or *). Keep it completely clean.

${productContext ? `\n--- LIVE MEDICINE DASHBOARD DATA ---\n${productContext}\n-----------------------------------\n` : ""}
`;

  const models = ["gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];
  for (const m of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: m,
        systemInstruction,
        generationConfig: { maxOutputTokens: 350, temperature: 0.2 }
      });

      const prompt = `Customer (${senderName || "Customer"}): "${customerMessage}"\nReply:`;
      const res = await model.generateContent(prompt);
      const text = res.response.text().trim();
      if (text && text.length > 3) {
        return text.replace(/[*#]+/g, "").trim();
      }
    } catch (err) {
      console.warn(`[AI_MODEL_WARN] (${m}):`, err.message);
    }
  }

  // Safe fallback
  return "দুঃখিত, এই প্রোডাক্টটি বর্তমানে আমাদের কাছে নেই।";
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
        processedIds.add(lastMsg.id); // Mark in memory to prevent duplicate in next tick
        const customerName = lastMsg.from?.name || "Customer";
        const messageText = (lastMsg.message || "").trim();

        console.log(`[FB_BOT] 🔔 NEW MESSAGE from ${customerName} (${lastMsg.from.id}): "${messageText}"`);

        // Generate AI reply
        const replyText = await generateReply(messageText, customerName);
        console.log(`[FB_BOT] 🤖 HAKIM REPLY: "${replyText.slice(0, 70)}..."`);

        // Send reply to Messenger
        const sendResult = await sendFacebookMessage(lastMsg.from.id, replyText);
        console.log(`[FB_BOT] 🚀 SENT [${sendResult.status}]:`, sendResult.data?.message_id || sendResult.data);
        saveProcessedId(lastMsg.id); // Persist to file once successfully attempted
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
