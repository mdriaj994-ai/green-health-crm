// scripts/fb_realtime_bot.js
// 24/7 Real-time Facebook Messenger AI Bot Engine
// Runs inside the VPS container alongside Next.js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

const Database = require("better-sqlite3");
const customerMemory = require("./customer_memory.js");
const { getGeoSocialProofFromProfile } = require("./geo_social_proof.js");

const HAKIM_PERSONA = {
  fullName: "হাকীম মো: আব্দুল করিম",
  fullNameEnglish: "Hakim Md. Abdul Karim",
  title: "ক্যাটাগরি-এ নিবন্ধিত ইউনানী চিকিৎসক (রেজি নং: ৫৮৪২/২০১৮), গবেষক ও বিশেষজ্ঞ",
  hometown: "আলীকদম, বান্দরবান পার্বত্য জেলা",
  localityDetail: "আলীকদম, বান্দরবান পার্বত্য জেলা",
  nativeDistrict: "বান্দরবান",
  educationSummary: "স্বাস্থ্য ও পরিবার কল্যাণ মন্ত্রণালয়ের অধীন বাংলাদেশ ইউনানী ও আয়ুর্বেদিক বোর্ড থেকে ক্যাটাগরি-এ নিবন্ধিত ইউনানী চিকিৎসক (রেজি নং: ৫৮৪২/২০১৮)। দীর্ঘ ১৮ বছর ধরে মানুষের সেবায় ক্লিনিক্যাল প্র্যাকটিস করছি।",
  chamber: "জনতা ইউনানী চিকিৎসালয় ও ভেষজ ভান্ডার, দোকান নং- ৩৩ (৩য় তলা), আলীকদম, বান্দরবান পার্বত্য জেলা (ই-ট্রেড লাইসেন্স নং: TRAD/ALIKADAM/0482/2026)",
  chamberShort: "জনতা ইউনানী চিকিৎসালয় ও ভেষজ ভান্ডার, আলীকদম, বান্দরবান",
  personalNote: "আমি দীর্ঘ ১৮ বছর ধরে মানুষের যৌন ও শারীরিক স্বাস্থ্য সেবায় প্রাকৃতিক ভেষজ চিকিৎসা প্রদান করছি।",
  specialization: "পুরুষের যৌন স্বাস্থ্য, দ্রুত বীর্যপাত স্থায়ী রোধ, শুক্রাণু ঘনত্ব বৃদ্ধি এবং টেস্টোস্টেরন বৃদ্ধির ইউনানী চিকিৎসা",
  helpline: "01870-023804 (বিকাশ)"
};

function getTimeAwareGreeting() {
  const now = new Date();
  const bdHour = (now.getUTCHours() + 6) % 24;
  if (bdHour >= 5 && bdHour < 9) return "আলহামদুলিল্লাহ, ফজরের নামাজ শেষ করে এইমাত্র চেম্বারে বসলাম।";
  if (bdHour >= 9 && bdHour < 12) return "আলহামদুলিল্লাহ, সকাল থেকেই পেশেন্ট দেখছি। একটু ব্যস্ততার মধ্যে আছি, তবু বলুন।";
  if (bdHour >= 12 && bdHour < 14) return "ভাই, আলহামদুলিল্লাহ। এইমাত্র দুপুরের খাবার শেষ করলাম, একটু ব্যস্ততার মধ্যে আছি — বলুন আপনার কী সেবা করতে পারি।";
  if (bdHour >= 14 && bdHour < 17) return "আলহামদুলিল্লাহ, বিকালের দিকে পেশেন্ট একটু কম থাকে — এখন আপনার জন্য সময় আছে, বলুন।";
  if (bdHour >= 17 && bdHour < 20) return "ভাই, সন্ধ্যার পর থেকে চেম্বারে বসি। এইমাত্র বসলাম — বলুন কীভাবে সাহায্য করতে পারি।";
  if (bdHour >= 20 && bdHour < 23) return "ভাই, এইতো চেম্বারে পেশেন্ট দেখছি। রাতের শেষ রাউন্ড চলছে — তবু বলুন।";
  return "ভাই, এইতো গভীর রাতেও বসে আছি — অনেক দূর থেকেও মানুষ আসে পরামর্শের জন্য। বলুন আপনার কী সমস্যা।";
}
const { parseOrderFromMessage, saveOrderToDb } = require("./save_order_to_db.js");


const PAGE_ID = process.env.FACEBOOK_PAGE_ID || "932259009980880";
const PERM_PAGE_TOKEN = "EAAjkLPT8UegBSsQVgxm1fBW6D7N7oon9ZAudS1UKVLVbBEar1BGEvZCLJ3ibSLO6FmILQDf6mq4rcsL98cpxuuRwAHSwUprKUBLv6ZBBCSjYAGUPTU1SQIRDvR74D5aIivRiDoUG3zobZB83AIwZA8mZAhoqcBDpjii2KsvQshwZCCIdUSJk5NaDb5JZCFGt4YWKBfEZC";
const _envTok = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const PAGE_TOKEN = (_envTok && _envTok.startsWith("EAAjkLPT8UegBSs") && _envTok.length > 150) ? _envTok : PERM_PAGE_TOKEN;
process.env.FACEBOOK_PAGE_ACCESS_TOKEN = PAGE_TOKEN;
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || "2502681553555944";
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || "73a482e9d5815a344205c92f1c83d5a8";
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID || "932259009980880";

const VALID_GEMINI_KEY = Buffer.from("QVEuQWI4Uk42SXdmUlNLazY2WG83NEFsR1dhdVdFYVYxMlpudU5LZUEtamhjV1hjZGFFYXc=", "base64").toString("utf-8");
const rawGeminiEnv = (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes("Ku6nT") && process.env.GEMINI_API_KEY.length > 30) ? process.env.GEMINI_API_KEY : null;
const GEMINI_KEYS = Array.from(new Set([
  rawGeminiEnv,
  VALID_GEMINI_KEY,
].filter(Boolean)));
const GEMINI_KEY = GEMINI_KEYS[0];

const VALID_GROQ_KEY = "gsk_Do7rt6SmudBYJ3qbWbG0" + "WGdyb3FYSCZWQMKoFMjIvG5QJazFokds";

function buildGroqSystemInstruction(senderName = "ভাইয়া", isVoiceMode = false) {
  return `You are Hakim Md. Abdul Karim (হাকীম মো: আব্দুল করিম), Category-A registered Unani Physician (রেজি নং: ৫৮৪২/২০১৮), Senior Herbal Researcher at Jonota Unani Chikitshaloy, Shop 33 (3rd floor), Alikadam, Bandarban (E-Trade License: TRAD/ALIKADAM/0482/2026).

CLINICAL & PRODUCT KNOWLEDGE:
- Main Formulation: খাঁটি কস্তুরী পাউডার (Kasturi Powder), 250g net weight, 1 month full course.
- Offer Price: ২,৮০০ টাকা (2,800 BDT).
- Advance Booking Rule (MANDATORY): ৫০০ টাকা অগ্রিম বুকিং শুধুমাত্র আমাদের অফিসিয়াল বিকাশ হেল্পলাইন 01870-023804 নম্বরে পরিশোধ করতে হয়। বাকি ২,৩০০ টাকা কুরিয়ারে পার্সেল হাতে পেয়ে ক্যাশ অন ডেলিভারিতে দেখে পরিশোধ করবেন। (নগদ বা অন্য কোনো পেমেন্ট চালু নেই, শুধুমাত্র বিকাশ)।
- Dosage: প্রতিদিন সকালে খালি পেটে ১ চামচ হালকা কুসুম গরম দুধ বা পানিতে মিশিয়ে সেবন করতে হয়।
- 6 Rare Ingredients: খাঁটি মৃগনাভি কস্তুরী (Pure Musk Pods), হিমালয়ের বন্য শিলাজিৎ (Himalayan Shilajit), আসল কোরিয়ান রেড জিনসেং (Korean Red Ginseng), অশ্বগন্ধা, শ্বেত মুসলি ও কাশ্মীরি জাফরান, এবং তালমাখনা, সর্পগন্ধা ও জয়ফল-জয়ত্রী।
- Benefits: দ্রুত বীর্যপাত স্থায়ী রোধ করে, গোপনাঙ্গ লোহার মতো শক্ত ও দৃঢ় করে, পাতলা বীর্য আঠার মতো ঘন ও গাঢ় করে এবং স্বাভাবিক সহবাসের সময় ২০-২৫+ মিনিটে উন্নীত করে। ৩ থেকে ৫ দিনেই পরিবর্তন বোঝা যায়। ১০০% প্রাকৃতিক, কোনো পার্শ্বপ্রতিক্রিয়া নেই।
- Delivery: সারা দেশে কুরিয়ারে ক্যাশ অন ডেলিভারি (ঢাকা ১-২ দিন, ঢাকার বাইরে ২-৩ দিন)। কুরিয়ার ম্যানের সামনে প্যাকেট খুলে দেখে নিশ্চিত হয়ে টাকা পরিশোধ করা যায়।
- Chamber Visit: জনতা ইউনানী চিকিৎসালয় ও ভেষজ ভান্ডার, দোকান নং- ৩৩ (৩য় তলা), আলীকদম কাঁচাবাজার, আলীকদম, বান্দরবান পার্বত্য জেলা। হেল্পলাইন: 01870-023804 (বিকাশ)।
- Government License / Proof: হাকীম মো: আব্দুল করিম স্বাস্থ্য ও পরিবার কল্যাণ মন্ত্রণালয়ের অধীন বাংলাদেশ ইউনানী ও আয়ুর্বেদিক বোর্ডের ক্যাটাগরি-এ নিবন্ধিত চিকিৎসক (রেজি নং: ৫৮৪২/২০১৮)।

CONVERSATIONAL RULES (STRICT & ABSOLUTE):
1. Speak warmly, respectfully, and authoritatively as Hakim Md. Abdul Karim in natural, authentic Bangladeshi Bengali (জি ভাইয়া, ইনশাআল্লাহ, কোনো চিন্তা করবেন না).
2. Keep responses brief, conversational, and natural (2 to 4 sentences maximum). Real doctors don't send huge essay templates.
3. THE ABSOLUTE DIRECTIVE — ANSWER ONLY WHAT WAS ASKED:
   - If customer says "আমি কি বলছি যে আমার কোনো সমস্যা আছে?" or "আমার কোনো সমস্যা নেই" — DO NOT diagnose them! Reply with respect: "জি না ভাইয়া, আপনি এমন কিছু বলেননি। ভুল বোঝাবুঝির জন্য আন্তরিকভাবে দুঃখিত। সুস্থ মানুষও সাধারণ শারীরিক শক্তি, পুষ্টি ও চিরতারুণ্য ধরে রাখতে কস্তুরী পাউডার সেবন করতে পারেন। বলুন ভাইয়া, আপনাকে কীভাবে সহযোগিতা করতে পারি?"
   - If customer asks "তাহলে?" — Ask warmly whether they want to know the price, ingredients, usage rule, or chamber address.
   - If customer gives Salam — reply with "ওয়ালাইকুম আসসালাম ভাইয়া। বলুন, কীভাবে সাহায্য করতে পারি?".
   - If customer asks "কেমন আছেন" — reply "আলহামদুলিল্লাহ ভাইয়া, ভালো আছি। আপনি কেমন আছেন?".
   - If customer asks about shop/chamber address — give the exact Alikadam, Bandarban address.
   - If customer asks about price — tell 2,800 BDT offer price clearly, but DO NOT push 500 advance or booking immediately! Instead, politely assess their problem: ask about their main issues (timing, erection, or weakness) and age to see if this medicine is right for them.
   - If customer asks about delay ("পরে নেব", "টাকা নেই", "বিকেলে জানাবো") — "আচ্ছা ঠিক আছে ভাই, বিকেলে বা রাতে যখনই ফ্রি হন আমাকে জানাবেন। আমি আপনার জন্য একটি বয়াম স্টক হোল্ড করে রাখছি। আমাদের বিকাশ হেল্পলাইন: 01870-023804।"
4. NO CANNED OR REPETITIVE TEMPLATES: Never send pre-saved rigid text blocks. Adapt every sentence dynamically to the customer's exact message and conversation context.
5. STRICT BAN on markdown bolding or asterisks (NO ** or ## or *).
6. STRICT BAN on unsolicited or premature order forms: NEVER send the order form unless the customer has COMPLETED consultation (health problem, age) AND explicitly confirmed they want to order. If they ask to order early without describing their health issues, ALWAYS consult and assess their problem first.
7. Strictly bKash only (01870-023804). NEVER mention Nagad.
${isVoiceMode ? "8. VOICE MODE: This reply will be spoken out loud via doctor voice note. Speak warmly and naturally directly to the patient." : ""}`;
}

async function callGroqLLM(prompt, systemInstruction) {
  const apiKey = (process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes("yb0FY"))
    ? process.env.GROQ_API_KEY
    : VALID_GROQ_KEY;
  if (!apiKey) return null;

  // Pure LLM models without web search (no custard powder or external search hallucination)
  const models = ["qwen/qwen3.8-27b", "openai/gpt-oss-120b"];
  for (const model of models) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt },
          ],
          temperature: 0.45,
          max_completion_tokens: 450,
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content && content.length > 5) {
          return content;
        }
      } else {
        const errText = await res.text();
        console.warn(`[GROQ_LLM_ERR] (${model}) [${res.status}]:`, errText);
      }
    } catch (e) {
      console.warn(`[GROQ_LLM_WARN] (${model}):`, e.message);
    }
  }
  return null;
}

// Fetch all active connected Facebook pages dynamically from database
function getActivePages() {
  try {
    const dbPath = path.join(process.cwd(), "prisma", "social_inbox.db");
    if (fs.existsSync(dbPath)) {
      const db = new Database(dbPath, { readonly: true });
      const rows = db.prepare("SELECT * FROM ConnectedAccount WHERE platform = 'FACEBOOK' AND (isActive = 1 OR isActive = 'true')").all();
      db.close();
      if (rows && rows.length > 0) {
        return rows.map(r => ({
          id: r.id,
          pageId: String(r.pageId),
          pageName: r.pageName || "গ্রীন হেলথ ইউনানী ফার্মেসী",
          accessToken: (r.accessToken && r.accessToken.startsWith("EAAjkLPT8UegBSs") && r.accessToken.length > 150) ? r.accessToken : PAGE_TOKEN,
          aiAutoReply: r.aiAutoReply !== 0
        })).filter(p => p.pageId && p.accessToken);
      }
    }
  } catch (e) {
    console.warn("[FB_BOT] DB load pages error:", e.message);
  }
  // Fallback to primary configured page if DB is empty or inaccessible
  return [{
    id: "default-env",
    pageId: PAGE_ID,
    pageName: "গ্রীন হেলথ ইউনানী ফার্মেসী",
    accessToken: PAGE_TOKEN,
    aiAutoReply: true
  }];
}

const PROCESSED_FILE = path.join(process.cwd(), "data", "processed_msg_ids.json");
const THREAD_MEMORY_FILE = path.join(process.cwd(), "data", "thread_memory.json");
const VOICE_USERS_FILE = path.join(process.cwd(), "data", "voice_users.json");
const SCHEDULED_REMINDERS_FILE = path.join(process.cwd(), "data", "scheduled_reminders.json");
const processedIds = new Set();
const inFlightMsgIds = new Set();
const threadMemory = new Map();
const voiceUsers = new Set();

// ── BOT SENT MESSAGES TRACKER ────────────────────────────────────────────────
// Used to distinguish between bot-generated replies and human admin replies in inbox
const BOT_SENT_FILE = path.join(process.cwd(), "data", "bot_sent_msg_ids.json");
const botSentMsgIds = new Set();
const botSentTexts = new Set();

try {
  if (fs.existsSync(BOT_SENT_FILE)) {
    const data = JSON.parse(fs.readFileSync(BOT_SENT_FILE, "utf-8"));
    if (Array.isArray(data)) {
      for (const id of data) botSentMsgIds.add(String(id));
    }
  }
} catch {}

// Preload recent bot messages from SQLite so server restarts remember recent bot replies
try {
  const dbPath = path.join(process.cwd(), "prisma", "social_inbox.db");
  if (fs.existsSync(dbPath)) {
    const db = new Database(dbPath);
    const botRows = db.prepare(`SELECT content FROM "Message" WHERE "senderType" = 'BOT' ORDER BY "createdAt" DESC LIMIT 300`).all();
    for (const r of botRows) {
      if (r.content) {
        const clean = r.content.replace(/^\[ভয়েস মেসেজ\]\s*/, '').trim();
        if (clean) botSentTexts.add(clean);
      }
    }
    db.close();
  }
} catch {}

function recordBotSentMessage(messageId, text = null) {
  if (messageId) {
    botSentMsgIds.add(String(messageId));
    try {
      const dir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      let list = [];
      if (fs.existsSync(BOT_SENT_FILE)) {
        try { list = JSON.parse(fs.readFileSync(BOT_SENT_FILE, "utf-8")); } catch {}
      }
      if (!list.includes(String(messageId))) {
        list.push(String(messageId));
        if (list.length > 2000) list = list.slice(-2000);
        fs.writeFileSync(BOT_SENT_FILE, JSON.stringify(list), "utf-8");
      }
    } catch {}
  }
  if (text && typeof text === "string") {
    botSentTexts.add(text.trim());
    if (botSentTexts.size > 500) {
      const it = botSentTexts.values();
      for (let i = 0; i < 100; i++) botSentTexts.delete(it.next().value);
    }
  }
}

function isBotSentMessage(msg) {
  if (!msg) return false;
  if (msg.id && botSentMsgIds.has(String(msg.id))) return true;
  if (msg.message && botSentTexts.has(String(msg.message).trim())) return true;
  return false;
}

function isFacebookAutomatedMessage(msg) {
  if (!msg) return false;
  const t = (msg.message || "").trim();
  if (!t && (!msg.attachments || msg.attachments.data?.length === 0)) return true; // empty notification
  return /replied to an ad|Please let us know how we can help you|Thanks for reaching out|Thanks for messaging us|স্বাগতম|Welcome to|help you/i.test(t);
}

function reloadVoiceUsersFromDisk() {
  try {
    if (fs.existsSync(VOICE_USERS_FILE)) {
      const list = JSON.parse(fs.readFileSync(VOICE_USERS_FILE, "utf-8"));
      if (Array.isArray(list)) {
        for (const id of list) voiceUsers.add(String(id));
      }
    }
  } catch {}
}
reloadVoiceUsersFromDisk();

function isVoiceMode(userId) {
  if (!userId) return false;
  const idStr = String(userId);
  if (voiceUsers.has(idStr)) return true;

  // Multi-process check
  reloadVoiceUsersFromDisk();
  if (voiceUsers.has(idStr)) return true;

  // Check permanent customer profile
  try {
    const prof = customerMemory.getCustomerProfile(idStr);
    if (prof && prof.prefersVoice) {
      voiceUsers.add(idStr);
      return true;
    }
  } catch {}

  return false;
}

function setVoiceMode(userId, enabled = true) {
  if (!userId) return;
  const idStr = String(userId);
  if (enabled) {
    voiceUsers.add(idStr);
  } else {
    voiceUsers.delete(idStr);
  }
  try {
    const dir = path.dirname(VOICE_USERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(VOICE_USERS_FILE, JSON.stringify(Array.from(voiceUsers)), "utf-8");
  } catch {}

  try {
    customerMemory.updateCustomerProfile(idStr, { prefersVoice: enabled });
  } catch {}
}

function isOnlyVoiceRequest(text) {
  if (!text) return false;
  const clean = text.trim().toLowerCase();
  return (
    /^(voice|boyes|boes|voyes|ভয়েস|ভয়েস|বয়েজ|বয়েজ|বয়েস|বয়েস|অডিও|audio)(\s*(dao|den|din|pathan|koro|koren|bolo|bolen|দাও|দেন|দিন|পাঠান|করুন|বলো|বলেন))?$/i.test(clean) ||
    /^(vai|bhai|vaiya|bhaiya)?\s*(voice|boyes|boes|voyes|ভয়েস|ভয়েস|বয়েজ|বয়েজ|বয়েস|বয়েস|মুখে)\s*(dao|den|din|pathan|bolo|bolen|দাও|দেন|দিন|পাঠান|বলুন|বলো|বলেন)?$/i.test(clean) ||
    /^(voice\s*dao|voice\s*den|voice\s*din|ভয়েস\s*দাও|ভয়েস\s*দাও|ভয়েস\s*দেন|ভয়েস\s*দেন|ভয়েস\s*দিন|বয়েজ\s*দাও|বয়েজ\s*দেন|বয়েজ\s*দিন|মুখে\s*বলুন|মুখে\s*বলো|কথা\s*বলুন)$/i.test(clean) ||
    /(porte\s*pari\s*na|পড়তে\s*পারি\s*না|পড়তে\s*পারিনা|পড়তে\s*পারি\s*না|ভয়েসে\s*বলুন|ভয়েসে\s*বলুন|voice\s*a\s*bolte|voice\s*e\s*bolen|ভয়েসে\s*কথা\s*বলুন)/i.test(clean)
  );
}

function isVoiceRequested(text) {
  if (!text) return false;
  const clean = text.trim().toLowerCase();

  // Negative intent: customer wants to STOP voice or doesn't want voice
  if (
    /(?:voice|voyes|ভয়েস|ভয়েস|ভয়েজ|ভয়েজ).*(?:dio\s*na|diyo\s*na|lagbe\s*na|bondho|off|চাই\s*না|দিবেন\s*না|দিও\s*না|লাগবে\s*না|বন্ধ|off\s*koro)/i.test(clean) ||
    /(?:dio\s*na|lagbe\s*na|না\s*দিয়ে|না\s*দিয়ে).*(?:voice|voyes|ভয়েস|ভয়েস|ভয়েজ|ভয়েজ)/i.test(clean)
  ) {
    return false;
  }

  return (
    /voice|voyes|ভয়েস|ভয়েস|ভয়েজ|ভয়েজ|কথা বলুন|মুখে বলুন|মুখে বলেন|মুখে বলো|অডিও|audio/i.test(clean) ||
    /(?:shunte|sunte|shunbo|sunbo)\s*chai/i.test(clean) ||
    /(?:shunte|sunte)\s*parbo/i.test(clean) ||
    /মুখে\s*(?:শুনতে|শুনব|বলুন|বলেন)/i.test(clean)
  );
}

function isTextModeRequested(text) {
  if (!text) return false;
  const clean = text.trim().toLowerCase();
  return (
    // Explicit text / txt / sms / message requests
    /\b(text|txt|sms|msg|message)\b.*(dao|den|din|bolen|bolun|bolo|pathan|pathao|koro|koren|দাও|দেন|দিন|বলেন|বলুন|পাঠান|পাঠাও)/i.test(clean) ||
    /(টেক্সট|টেক্সটে|মেসেজ|মেসেজে?|এসএমএস)\s*(দাও|দেন|দিন|বলেন|বলুন|বলো|পাঠান|পাঠাও|করুন|লিখুন|করো)/i.test(clean) ||
    /^(text|txt|sms|মেসেজ|message|text koro|text dao|text den)$/i.test(clean) ||
    // Negative voice expressions ("voice dio na", "voice lagbe na", "voice bondho koro", "ভয়েস বন্ধ", etc.)
    /(?:voice|voyes|boyes|বয়েস|ভয়েস|ভয়েস)\s*(?:dio\s*na|diyo\s*na|lagbe\s*na|bondho|off|চাই\s*না|দিবেন\s*না|দিও\s*না|লাগবে\s*না|বন্ধ|off\s*koro|শুনতে\s*পারব\s*না|sunte\s*parbo\s*na|shunte\s*parbo\s*na)/i.test(clean) ||
    // "lekhe dao" / "lekehe dao" / "likhe dao" / "lekhe pathao" Banglish variations
    /(?:lekehe|lekhe|lekh[ea]|likhe|likh[ea]|leke|like)\s*(?:dao|den|din|patho|pathao|pathan|de|daw|dile|koro|koren|bolo|bolen|bolun)/i.test(clean) ||
    /^(?:lekehe|lekhe|likhe|leke)\s*(?:dao|den|din|bolen|bolun)$/i.test(clean) ||
    // Bengali variations ("লিখে দাও", "লেখে দাও", "লিখে পাঠান", etc.)
    /(লিখে|লেখে|লিখিয়া|লিখিয়ে)\s*(দাও|দেন|দিন|পাঠাও|পাঠান|বলুন|বলেন|বলো|করুন)/i.test(clean) ||
    /^(লিখে|লেখে|লিখুন|লেখা|লিখে দাও|লিখে দিন|লেখে দিন|লেখে দাও)$/i.test(clean)
  );
}

// ── Detect if customer is asking about ORDER INFO / HOW TO ORDER ──────────────
// When this is true, ALWAYS send text (even in voice mode) so customer can read & fill the form

function isPhoneNumberRequest(text, replyText) {
  if (!text && !replyText) return false;
  const clean = (text || "").trim().toLowerCase();

  const askedForNumber =
    /(?:number|namber|numbor|nombor|নম্বর|নাম্বার|ফোন|মোবাইল|phone|mobile|হেল্পলাইন|helpline|হটলাইন|hotline)\s*(?:den|din|dite|দাও|দেন|দিন|পাঠান|দিতে|কত|koto|plz|please|lagbe|হবে|চাই|পাব|হবে\s*কি)?/i.test(clean) ||
    /(?:kotha\s*bolbo|কথা\s*বলব|কথা\s*বলতে|যোগাযোগ|jogajog|call\s*korbo|কল\s*করব|কল\s*দিতে).*(?:number|নাম্বার|নম্বর|phone|ফোন|দিন|দেন|চাই|কিসে)/i.test(clean) ||
    /(?:bkash|নগদ|nagad|বিকাশ).*(?:number|নাম্বার|নম্বর|টাকা|পাঠাব)/i.test(clean) ||
    /(?:নাম্বার|নম্বর|phone|number)\s*(?:টা|টি)?\s*(?:দেন|দিন|দাও|বলেন|বলুন)/i.test(clean);

  if (askedForNumber) return true;

  if (replyText && /(?:01870-023804|01870023804|শূন্য\s*এক\s*আট\s*সাত)/i.test(replyText)) {
    if (/(?:number|নাম্বার|নম্বর|phone|ফোন|call|কল|কথা|যোগাযোগ|বিকাশ|নগদ)/i.test(clean)) {
      return true;
    }
  }

  return false;
}

function isOrderInfoRequest(text, replyText) {
  if (!text && !replyText) return false;
  const clean = (text || "").trim().toLowerCase();

  // 1. Customer asking how to order, what is needed, or placing order
  const customerAsked =
    /(ki\s*ki|কি\s*কি|কী\s*কী)\s*(lagbe|dite|দিতে|দরকার|পাঠাতে)/i.test(clean) ||
    /(order|অর্ডার)\s*.*(kivabe|ki\s*vabe|kiভাবে|কিভাবে|কীভাবে|korbo|করব|করবো|debo|দেব|দিব|korte|করতে|chai|চাই)/i.test(clean) ||
    /(kivabe|ki\s*vabe|কিভাবে|কীভাবে)\s*.*(order|অর্ডার|kinbo|kini|কিনব|কিনবো|nibo|nebo|নেব|নেবো|pabo|পাব|পাবো|পাঠাব)/i.test(clean) ||
    /(order|অর্ডার)\s*(form|ফর্ম|format|ফরম্যাট|ki|কি|কী)/i.test(clean) ||
    /(nite|নিতে|pete|পেতে|kinte|কিনতে)\s*(chaile?|চাইলে|hole?|হলে)\s*(ki|কি|কী)/i.test(clean) ||
    /(nam|নাম|phone|ফোন|number|নম্বর|thikana|ঠিকানা).*(dite|দিতে|pathate|পাঠাতে)\s*(hobe|হবে)/i.test(clean) ||
    /order.*info|order.*detail|অর্ডার.*তথ্য|অর্ডার.*বিস্তারিত/i.test(clean);

  if (customerAsked) return true;

  // 2. The reply itself contains order instructions / asking for name, address, phone
  if (replyText) {
    const hasName = /নাম|name/i.test(replyText);
    const hasAddress = /ঠিকানা|address|জেলা|থানা/i.test(replyText);
    const hasPhone = /ফোন|নাম্বার|নম্বর|mobile|phone|number/i.test(replyText);
    const hasOrderWord = /অর্ডার|order|ডেলিভারি|কুরিয়ার|পার্সেল/i.test(replyText);
    if ((hasName && hasAddress && (hasPhone || hasOrderWord)) ||
        /অর্ডার\s*(করতে|কনফার্ম\s*করতে|দিতে)/i.test(replyText) ||
        /(?:নাম|ঠিকানা|নাম্বার|নম্বর)\s*[:=]/i.test(replyText)) {
      return true;
    }
  }

  return false;
}

// Preload processed IDs from file if exists
try {
  if (fs.existsSync(PROCESSED_FILE)) {
    const data = JSON.parse(fs.readFileSync(PROCESSED_FILE, "utf-8"));
    for (const id of data) processedIds.add(id);
  }
} catch {}

function isProcessedId(id) {
  if (!id) return false;
  if (inFlightMsgIds.has(id)) return true;
  if (processedIds.has(id)) return true;
  try {
    if (fs.existsSync(PROCESSED_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROCESSED_FILE, "utf-8"));
      if (Array.isArray(data) && data.includes(id)) {
        processedIds.add(id);
        return true;
      }
    }
  } catch {}
  return false;
}

function saveProcessedId(id) {
  if (!id) return;
  processedIds.add(id);
  try {
    const dir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let list = [];
    if (fs.existsSync(PROCESSED_FILE)) {
      try {
        list = JSON.parse(fs.readFileSync(PROCESSED_FILE, "utf-8"));
      } catch {}
    }
    if (!list.includes(id)) {
      list.push(id);
      if (list.length > 500) list = list.slice(-500);
      fs.writeFileSync(PROCESSED_FILE, JSON.stringify(list), "utf-8");
    }
  } catch {}
}

function loadThreadMemory() {
  try {
    if (fs.existsSync(THREAD_MEMORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(THREAD_MEMORY_FILE, "utf-8"));
      const now = Date.now();
      for (const [k, v] of Object.entries(data)) {
        // Retain thread context for up to 7 days
        if (v && v.time && (now - v.time < 7 * 24 * 60 * 60 * 1000)) {
          threadMemory.set(k, v);
        }
      }
      console.log(`[FB_BOT] Loaded ${threadMemory.size} active conversation threads into memory.`);
    }
  } catch (e) {
    console.warn("[FB_BOT] Thread memory load error:", e.message);
  }
}

function saveThreadMemory() {
  try {
    const obj = {};
    for (const [k, v] of threadMemory.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(THREAD_MEMORY_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (e) {
    console.warn("[FB_BOT] Thread memory save error:", e.message);
  }
}

function normalizeStr(s) {
  return (s || "")
    .toLowerCase()
    .replace(/['"’`\-_.,()\/\\+!?:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Order Data Validator — checks phone & address before saving ───────────────
// Returns: { valid: true } or { valid: false, issues: [...] }
function validateOrderDetails(phone, district, thana, address) {
  const issues = [];

  // ── PHONE VALIDATION ──────────────────────────────────────────────────────
  // Bangladesh mobile: 01[3-9]XXXXXXXX (11 digits total)
  const enPhone = (phone || "").replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d)).replace(/[\s\-+]/g, "");
  const validBdPhone = /^(?:\+?88)?01[3-9]\d{8}$/.test(enPhone);

  if (!phone || phone.trim() === "") {
    issues.push({ field: "phone", msg: "📱 আপনার মোবাইল নম্বরটি দেননি। সঠিক বাংলাদেশি নম্বর দিন (যেমন: 01712345678)" });
  } else if (!validBdPhone) {
    // Check for obviously wrong: too short/long, fake like 0000000000, sequential 12345...
    const digits = enPhone.replace(/\D/g, "");
    const isAllSame = digits.length >= 8 && /^(.)\1+$/.test(digits);
    const isSequential = ["0123456789", "9876543210", "1234567890", "01234567890"].some(seq => enPhone.includes(seq.slice(0, 8)));
    if (isAllSame || isSequential) {
      issues.push({ field: "phone", msg: "📱 এই নম্বরটি বাস্তব মনে হচ্ছে না (যেমন: 0000000000 বা 01234567890)। সঠিক ১১ সংখ্যার বাংলাদেশি মোবাইল নম্বর দিন।" });
    } else {
      issues.push({ field: "phone", msg: `📱 "${phone}" এই নম্বরটি সঠিক বাংলাদেশি মোবাইল নম্বর মনে হচ্ছে না। সঠিক নম্বর হবে: 01712345678 (11 সংখ্যার)।` });
    }
  }

  // ── ADDRESS VALIDATION ────────────────────────────────────────────────────
  // Valid Bangladesh districts (all 64)
  const BD_DISTRICTS = [
    "ঢাকা","dhaka","চট্টগ্রাম","chittagong","সিলেট","sylhet","রাজশাহী","rajshahi",
    "খুলনা","khulna","বরিশাল","barishal","barisal","ময়মনসিংহ","mymensingh",
    "রংপুর","rangpur","কুমিল্লা","comilla","নোয়াখালী","noakhali","ফেনী","feni",
    "গাজীপুর","gazipur","নারায়ণগঞ্জ","narayanganj","মুন্সিগঞ্জ","munshiganj",
    "মানিকগঞ্জ","manikganj","নরসিংদী","narsingdi","কিশোরগঞ্জ","kishoreganj",
    "টাঙ্গাইল","tangail","ফরিদপুর","faridpur","গোপালগঞ্জ","gopalganj",
    "মাদারীপুর","madaripur","শরীয়তপুর","shariatpur","রাজবাড়ী","rajbari",
    "ময়মনসিংহ","জামালপুর","jamalpur","শেরপুর","sherpur","নেত্রকোণা","netrokona",
    "সুনামগঞ্জ","sunamganj","মৌলভীবাজার","moulvibazar","হবিগঞ্জ","habiganj",
    "কক্সবাজার","cox","বান্দরবান","bandarban","রাঙামাটি","rangamati","খাগড়াছড়ি","khagrachhari",
    "লক্ষ্মীপুর","lakshmipur","চাঁদপুর","chandpur","ব্রাহ্মণবাড়িয়া","brahmanbaria",
    "বগুড়া","bogura","bogra","পাবনা","pabna","সিরাজগঞ্জ","sirajganj","নাটোর","natore",
    "জয়পুরহাট","joypurhat","নওগাঁ","naogaon","চাঁপাইনবাবগঞ্জ","chapainawabganj",
    "দিনাজপুর","dinajpur","নীলফামারী","nilphamari","লালমনিরহাট","lalmonirhat",
    "গাইবান্ধা","gaibandha","ঠাকুরগাঁও","thakurgaon","পঞ্চগড়","panchagarh",
    "কুড়িগ্রাম","kurigram","যশোর","jashore","ঝিনাইদহ","jhenaidah","মাগুরা","magura",
    "নড়াইল","narail","সাতক্ষীরা","satkhira","মেহেরপুর","meherpur","চুয়াডাঙ্গা","chuadanga",
    "কুষ্টিয়া","kushtia","ঝালকাঠি","jhalokati","পটুয়াখালী","patuakhali",
    "বরগুনা","barguna","পিরোজপুর","pirojpur","ভোলা","bhola"
  ];

  // Check if district/address has any recognizable Bangladesh location
  const combinedAddr = [district, thana, address].filter(Boolean).join(" ").toLowerCase();

  if (!combinedAddr.trim() || combinedAddr.trim().length < 4) {
    issues.push({ field: "address", msg: "📍 আপনার ঠিকানা দেননি বা অসম্পূর্ণ দিয়েছেন। সঠিক ঠিকানা (জেলা, থানা, গ্রাম/রোড) দিন।" });
  } else {
    // Check meaninglessness — too many random/English chars or very short
    const isMeaningless = !district && !thana && address && address.trim().length < 4;
    const isGibberish = /^[a-z]{1,3}$/.test((address || "").trim().toLowerCase()) ||
                        /^[0-9]+$/.test((address || "").trim()) ||
                        /^(test|abc|xyz|aaa|bbb|111|000|dummy|fake|n\/a|none|null|xxx)$/i.test((district || address || "").trim());

    if (isGibberish) {
      issues.push({ field: "address", msg: "📍 ঠিকানাটি সঠিক মনে হচ্ছে না। সঠিক জেলা, থানা ও গ্রাম/রোড নম্বর দিন।" });
    } else if (district) {
      // Validate district against known BD districts
      const districtLow = district.toLowerCase().trim();
      const isValidDistrict = BD_DISTRICTS.some(d => districtLow.includes(d) || d.includes(districtLow));
      if (!isValidDistrict && districtLow.length > 2) {
        issues.push({ field: "address", msg: `📍 "${district}" বাংলাদেশের পরিচিত কোনো জেলা নয়। সঠিক জেলার নাম দিন (যেমন: ঢাকা, চট্টগ্রাম, সিলেট)।` });
      }
    }
  }

  if (issues.length === 0) return { valid: true };
  return { valid: false, issues };
}

// ── Live Product Database Loader & Bilingual Matcher ────────────────────────
function findMatchedProduct(query, master) {
  if (!query) return null;
  const normQ = normalizeStr(query);
  const compactQ = normQ.replace(/\s+/g, "");

  const aliases = {
    "যৌবনের রাজা": ["যৌবনের রাজা", "যৌবন রাজা", "jouboner raja", "yowboner raja", "yauboner raja", "শামসুর ইসলাম", "কালাম ভাইয়ের মার্কেট", "আলীকদম"],
    "কস্তুরী পাউডার": ["কস্তুরী পাউডার", "কস্তুরি পাউডার", "kosturi powder", "kasturi powder", "কস্তুরী", "কস্তুরি", "আব্দুল করিম", "হাকিম আব্দুল করিম", "হাকিম মোহাম্মদ আব্দুল করিম", "abdul karim", "জনতা ইউনানী", "আলীকদম, বান্দরবান পার্বত্য জেলা", "দোকান ৩৩"],
    "বাজীকরণ হালুয়া": ["বাজীকরণ হালুয়া", "বাজীকরণ", "bajikaran halua", "bajikoron halua", "আরিফ", "কবিরাজ আরিফ", "রাঙ্গামাটি", "রিজার্ভ বাজার", "ব্যাংক এশিয়া", "ন্যাচারাল হারবাল", "ন্যাচারাল", "natural herbal", "natural", "হারবাল", "ইউনানি প্রস্তুতি", "বাজিকরন"],
    "soul mate": ["soul mate", "soulmate", "সোল মেট", "সোলমেট", "সুল মেট", "কস্তুরী", "কস্তুরি", "হরিণের কস্তুরী", "হরিণের কস্তুরি", "kosturi", "kasturi", "horiner kosturi", "শিলাজিৎ", "জাফরান"],
    "amber": ["amber", "ambar", "amber premium", "ambar premium", "আম্বার", "অম্বর", "অ্যাম্বার", "অंबर", "अंबर", "যৌন বিছানা রাজা", "বিছানা রাজা", "bistar raja", "tantra sutra"],
    "dream touch": ["dream touch", "dreamtouch", "ড্রিম টাচ", "ড্রিমটাচ", "ড্রিম"],
    "men's burner": ["men's burner", "mens burner", "men burner", "মেনস বার্নার", "বার্নার"],
    "men's black velvet": ["men's black velvet", "mens black velvet", "black velvet", "ব্ল্যাক ভেলভেট", "ভেলভেট"],
    "black ginseng": ["black ginseng", "ginseng", "ব্ল্যাক জিনসেং", "জিনসেং"],
    "egypt gawa": ["egypt gawa", "egypt", "gawa", "ইজিপ্ট", "গাওয়া", "গাওয়া"],
    "enjoy hunter": ["enjoy hunter", "enjoy", "hunter", "হান্টার"],
    "sex king": ["sex king", "সেক্স কিং", "সেক্সকিং", "সেক্স"],
    "vigrex": ["vigrex", "vigrex plus", "ভিগরেক্স", "ভিগরেক্স প্লাস"],
    "parsian": ["parsian zobli", "parsian", "zobli", "পার্সিয়ান জোবলি", "পার্সিয়ান", "জোবলি", "জোব্লি"],
    "maxdrive": ["maxdrive", "ম্যাক্সড্রাইভ", "ম্যাক্স ড্রাইভ"],
    "passion wave": ["passion wave", "প্যাশন ওয়েভ", "প্যাশন"],
    "black lion": ["black lion", "ব্ল্যাক লায়ন", "লায়ন স্ট্রং"],
    "jomdobe": ["jomdobe dosto", "jomdobe", "জুমদো বি দোস্তো", "দোস্তো"],
    "desire play": ["desire play", "ডিজায়ার প্লে", "ডিজায়ার"],
    "hera power": ["hera power", "হেরা পাওয়ার"],
    "love spark": ["love spark", "লাভ স্পার্ক", "সুপার স্পার্ক লাভ"],
    "penis prime": ["penis prime", "পেনিস প্রাইম"],
    "hammer of thor": ["hammer of thor", "hammer", "হ্যামার"],
    "maxman": ["maxman", "ম্যাক্সম্যান"],
    "titan gel": ["titan gel", "টাইটান জেল"],
    "viga": ["viga", "ভিগা"],
    "shark": ["shark", "শার্ক"],
    "tiger king": ["tiger king", "tiger", "টাইগার কিং"],
    "rheumarex": ["rheumarex", "রিউমারেক্স"],
  };

  // 1. Check known aliases
  for (const [key, aliasList] of Object.entries(aliases)) {
    if (aliasList.some(a => normQ.includes(normalizeStr(a)) || compactQ.includes(normalizeStr(a).replace(/\s+/g, "")))) {
      const found = master.find(p => {
        const name = normalizeStr(p["ওষুধের নাম (Brand Name)"] || "");
        return name.includes(key);
      });
      if (found) return found;
    }
  }

  // 2. Clean brand name match (with punctuation removed & compact space matching)
  for (const p of master) {
    const rawName = p["ওষুধের নাম (Brand Name)"] || "";
    const cleanName = rawName.replace(/\s*\([^)]*\)/g, "").trim();
    const normClean = normalizeStr(cleanName);
    const compactClean = normClean.replace(/\s+/g, "");

    if (compactClean.length >= 3 && (compactQ.includes(compactClean) || normQ.includes(normClean))) {
      return p;
    }
  }

  // 3. Full raw name match
  for (const p of master) {
    const normRaw = normalizeStr(p["ওষুধের নাম (Brand Name)"]);
    const compactRaw = normRaw.replace(/\s+/g, "");
    if (compactRaw.length >= 3 && (compactQ.includes(compactRaw) || normQ.includes(normRaw))) {
      return p;
    }
  }

  // 4. Multi-word token match (e.g. "black" + "velvet")
  const stopWords = new Set(["koto", "dam", "ki", "ase", "akhon", "ta", "er", "apnader", "eta", "aita", "price", "bhai"]);
  const qWords = normQ.split(" ").filter(w => w.length >= 4 && !stopWords.has(w));
  if (qWords.length >= 2) {
    for (const p of master) {
      const normRaw = normalizeStr(p["ওষুধের নাম (Brand Name)"]);
      if (qWords.every(w => normRaw.includes(w))) {
        return p;
      }
    }
  }

  return null;
}

function getLiveProductInfo(query, senderId = null, recentHistory = [], pageName = "") {
  try {
    const masterPath = path.join(process.cwd(), "data", "medicine_master_complete_db.json");
    const editsPath = path.join(process.cwd(), "data", "custom_user_edits.json");

    if (!fs.existsSync(masterPath)) return { context: "", matched: null };
    const master = JSON.parse(fs.readFileSync(masterPath, "utf-8"));
    const edits = fs.existsSync(editsPath) ? JSON.parse(fs.readFileSync(editsPath, "utf-8")) : {};

    const q = (query || "").toLowerCase();
    
    // 1. First priority: Check if current query explicitly names any medicine
    let matched = findMatchedProduct(q, master);

    // 2. If current message didn't name a product, check thread memory for this sender
    if (!matched && senderId && threadMemory.has(senderId)) {
      const saved = threadMemory.get(senderId);
      if (saved && saved.sl) {
        matched = master.find(p => String(p.SL) === String(saved.sl));
      }
    }

    // 3. If still no match, inspect recent conversation history
    if (!matched && recentHistory && recentHistory.length > 0) {
      for (const line of recentHistory) {
        const hMatch = findMatchedProduct(line, master);
        if (hMatch) {
          matched = hMatch;
          break;
        }
      }
    }

    // Save/update thread memory when a product is identified
    if (matched && senderId) {
      threadMemory.set(senderId, {
        sl: String(matched.SL),
        name: matched["ওষুধের নাম (Brand Name)"],
        time: Date.now()
      });
      saveThreadMemory();
    }

    // 4. ONLY if NO product was found in current query, thread memory, or recent history,
    // check if this is a general ad inquiry (e.g. initial click on our page ad)
    const isGeneralAdQuery = /^(দাম|কত|প্রাইস|price|কাজ|উপকার|কিভাবে|অর্ডার|ডেলিভারি|খাব|নিয়ম|order|koto|dam|kaj|rule)/i.test(q) ||
      q.includes("খাওয়ার") || q.includes("কাজ কি") || q.includes("দাম কত") || q.includes("নিতে চাই");

    const isNaturalHerbal = /ন্যাচারাল|হারবাল|natural/i.test(pageName || "") || /ন্যাচারাল|হারবাল/i.test(q);

    if (!matched && (isGeneralAdQuery || isNaturalHerbal)) {
      const defaultSl = isNaturalHerbal ? "61" : "60";
      const defaultName = isNaturalHerbal ? "বাজীকরণ হালুয়া (Bajikaran Halua)" : "কস্তুরী পাউডার (Kasturi Powder)";
      matched = master.find(p => String(p.SL) === defaultSl);
      if (senderId) {
        threadMemory.set(senderId, {
          sl: defaultSl,
          name: defaultName,
          time: Date.now()
        });
        saveThreadMemory();
      }
    }

    if (matched) {
      const sl = String(matched.SL);
      const edit = edits[sl] || {};
      const name = matched["ওষুধের নাম (Brand Name)"] || "প্রাকৃতিক ফর্মুলা";
      const price = edit.discount_price || edit.custom_price || "২,৯০০";
      const regPrice = edit.custom_price || "৩,৫০০";
      const note = edit.custom_note || "ক্যাশ অন ডেলিভারি, সারা দেশে ফ্রি হোম ডেলিভারি।";
      const pitch = edit.custom_pitch || matched["১. কাস্টমারের আসল সমস্যা ও পেইন পয়েন্ট (Pain Point Mapping)"] || "";
      const dosage = edit.dosageForm || matched["১৩. স্ট্যান্ডার্ড মেডিকেল ডোজ ও সেবন প্রোটোকল (Dosage & Protocols)"] || matched["ডোজ ফর্ম ও শক্তি (Dosage Form & Strength)"] || "";
      const indications = matched["১. কাস্টমারের আসল সমস্যা ও পেইন পয়েন্ট (Pain Point Mapping)"] || "";
      const dietary = matched["৬. পুষ্টি ও দ্রুত ফলাফল পাওয়ার খাদ্যাভ্যাস (Dietary Blueprint)"] || "";
      const superiority = matched["২. বাজারের অন্যান্য ওষুধের সাথে শ্রেষ্ঠত্ব (Superiority Matrix)"] || "";
      const ageSolutions = matched["৩. বয়স ভিত্তিক কাস্টমাইজড সমাধান (Age-Specific Solutions)"] || "";

      const context = `
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
      `.trim();

      return {
        context,
        matched: {
          sl,
          name,
          price,
          regPrice,
          note,
          dosage,
          pitch,
        }
      };
    }
  } catch (err) {
    console.error("DB error:", err);
  }
  return { context: "", matched: null };
}

// ── Gemini AI Generator ──────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

function buildStoreCatalog(master, edits) {
  return master.map(p => {
    const sl = String(p.SL);
    const ed = edits[sl] || {};
    const name = p["ওষুধের নাম (Brand Name)"];
    const price = ed.discount_price || ed.custom_price || "২,৯০০";
    const note = ed.custom_note || "ক্যাশ অন ডেলিভারি, সারা দেশে ফ্রি হোম ডেলিভারি।";
    return `#${sl} | ${name} | অফার মূল্য: ${price} টাকা | ডেলিভারি: ${note}`;
  }).join("\n");
}

function detectLanguage(text) {
  if (!text) return "Bengali";
  if (/[\u0600-\u06FF]/.test(text)) return "Arabic";
  if (/[\u0900-\u097F]/.test(text)) return "Hindi";
  if (/[\u0980-\u09FF]/.test(text)) return "Bengali";
  if (/^[a-zA-Z0-9\s.,!?'"()\-+%$&@#/*]+$/.test(text.trim())) {
    const isBanglish = /\b(koto|dam|aita|eta|apnader|kibhabe|khabo|ase|ki|bhai|bhaiya|vai|vaiya|valo|osudh|medicine|kaj|kore|kirokom|order|korbo|kori|lingo|choto|chikon|durbol|bhirjo)\b/i.test(text);
    if (isBanglish) {
      return "Bengali (Banglish inquiry - reply in natural, conversational Bengali)";
    }
    return "English";
  }
  return "Bengali";
}


function getClinicalConsultationReply(senderId = "", senderName = "", customerMessage = "", isVoiceMode = false) {
  const clean = (customerMessage || "").toLowerCase().trim();
  if (senderId && customerMessage) {
    try { if (typeof customerMemory !== "undefined" && customerMemory.extractCustomerFacts) customerMemory.extractCustomerFacts(senderId, customerMessage, senderName); } catch (e) {}
  }
  const prof = senderId ? (typeof customerMemory !== "undefined" && customerMemory.getCustomerProfile ? customerMemory.getCustomerProfile(senderId, senderName) : { symptoms: [] }) : { symptoms: [] };

  const nameSalute = (prof.name && prof.name !== "Customer" && prof.name !== "কাস্টমার" && prof.name !== "ভাইয়া")
    ? `${prof.name} ভাইয়া`
    : (senderName && senderName !== "Customer" && senderName !== "কাস্টমার" && senderName !== "ভাইয়া")
      ? `${senderName} ভাইয়া`
      : "ভাইয়া";

  // Check collected diagnostic factors
  const hasAge = Boolean(prof.age);
  const hasDuration = Boolean(prof.duration);
  const hasPathology = Boolean(prof.timing || prof.erectionQuality || prof.semenQuality || prof.preCum);
  const hasLifestyle = Boolean(prof.gastric || prof.sleepQuality || prof.probashi);
  const hasMarriage = Boolean(prof.maritalStatus);
  const hasBloodOrChronic = Boolean(prof.bloodGroup || prof.diabetes || prof.bloodPressure);
  const hasMedicationHistory = Boolean(prof.previousMedication);

  // Count total diagnostic aspects collected
  let aspectsCount = 0;
  if (hasAge) aspectsCount++;
  if (hasDuration) aspectsCount++;
  if (hasPathology) aspectsCount++;
  if (hasLifestyle) aspectsCount++;
  if (hasMarriage) aspectsCount++;
  if (hasBloodOrChronic) aspectsCount++;
  if (hasMedicationHistory) aspectsCount++;

  // ──────────────────────────────────────────────────────────────────────────
  // STAGE 7: ALL KEY CLINICAL FACTS COLLECTED -> COMPREHENSIVE DIAGNOSIS & OFFER
  // ──────────────────────────────────────────────────────────────────────────

  // ── Pre-Stage-7 interceptor: "কতদিনে ফলাফল পাব?" — answer first, THEN offer ──
  const isResultTimelineQuestion =
    /(?:কতদিন|কত\s*দিন|কত\s*দিনে|কত\s*সময়|কতটা\s*সময়|কয়\s*দিন|kotdin|koto\s*din|koy\s*din).*(?:ফলাফল|উপকার|কাজ|পরিবর্তন|বুঝ|ফিল|feel|result|change|boro)/i.test(customerMessage) ||
    /(?:ফলাফল|result|পরিবর্তন|উপকার|কাজ).*(?:কতদিন|কত\s*দিন|কয়\s*দিন|পর|পরে|পাব|পাবো|বুঝব|বুঝব|ফিল)/i.test(customerMessage) ||
    /(?:koto\s*din\s*por|kotodine|kodin\s*por|koydin\s*por|কতদিন\s*পর|কয়দিন\s*পর).*(?:bujhbo|bujte|feel|result|kaj|ফিল|বুঝব|বুঝতে)/i.test(customerMessage) ||
    /(?:কতদিন\s*সেবনের\s*পর|কতদিন\s*খেলে|কত\s*দিন\s*খাওয়ার\s*পর|koto\s*din\s*sebon|kotdin\s*khele)/i.test(customerMessage);

  if (isResultTimelineQuestion) {
    const timelineReplies = [
      `জি ভাইয়া, এটা খুবই ভালো প্রশ্ন করেছেন। সাধারণত:

🔹 ৩-৫ দিনের মধ্যে: শরীরে হালকা উষ্ণতা ও এনার্জি বৃদ্ধি বুঝতে শুরু করবেন।
🔹 ৭-১০ দিনের মধ্যে: রক্তসঞ্চালন বৃদ্ধির কারণে স্নায়ুর সতেজতা ও নিয়ন্ত্রণ উন্নতি বুঝতে পারবেন।
🔹 ১৫-২০ দিনের মধ্যে: সহবাসের সময় ও স্ট্যামিনায় লক্ষণীয় পরিবর্তন আসবে।
🔹 ১ মাস পূর্ণ হলে: সম্পূর্ণ রিকভারি এবং স্থায়ী ফলাফল অনুভব করবেন ইনশাআল্লাহ।

তবে ফলাফলের গতি একটু বয়স ও সমস্যার গভীরতার উপর নির্ভর করে। আপনি কি অর্ডার করে আজই শুরু করতে চান ভাইয়া?`,

      `ভাইয়া, খুব সুন্দর প্রশ্ন করেছেন। কস্তুরী পাউডারের ক্লিনিক্যাল রেজাল্ট সাধারণত এভাবে আসে:

• প্রথম সপ্তাহ: শরীরে তাজা এনার্জি ও ঘুমের উন্নতি শুরু হয়
• ২য় সপ্তাহ: নার্ভের শিথিলতা কমে — নিয়ন্ত্রণ ও কঠিনতা বৃদ্ধি পায়
• ৩য় সপ্তাহ: টেস্টোস্টেরন বৃদ্ধির প্রভাবে টাইমিং উল্লেখযোগ্যভাবে বাড়ে
• ৪র্থ সপ্তাহ (ফুল কোর্স): সম্পূর্ণ ও স্থায়ী রিকভারি ইনশাআল্লাহ

আর ওষুধটি ১০০% প্রাকৃতিক ও কেমিক্যালমুক্ত হওয়ায় কোনো পার্শ্বপ্রতিক্রিয়া নেই। আপনার কি এখনই অর্ডার দেওয়ার সুযোগ আছে ভাইয়া?`,

      `জি ভাইয়া, আমাদের কস্তুরী পাউডার সেবনের ফলাফল সাধারণত এভাবে আসে:

প্রথম ৩-৭ দিন — শরীরে উষ্ণতা ও তাজা শক্তি অনুভব শুরু।
১০-১৫ দিন — রক্তসঞ্চালন ভালো হয়, নার্ভ সক্রিয় হয়, কঠিনতা ও নিয়ন্ত্রণে পরিবর্তন আসে।
২০-৩০ দিন — মিলন সময় ২০-২৫ মিনিটে উন্নীত হয় এবং বীর্যের ঘনত্ব স্বাভাবিক হয়।

তবে দীর্ঘদিনের পুরনো সমস্যায় মাঝে মাঝে পূর্ণ ১ মাসের কোর্স শেষ করতে হয়। আপনি কি অর্ডার করে আজই শুরু করে দিতে চান ভাইয়া?`
    ];
    const timelineReply = timelineReplies[Math.floor(Math.random() * timelineReplies.length)];
    if (senderId) customerMemory.appendChatMessage(senderId, "model", timelineReply, isVoiceMode);
    return timelineReply;
  }

  if (hasAge && (hasDuration || hasPathology) && hasMarriage && (hasBloodOrChronic || hasMedicationHistory || aspectsCount >= 5)) {
    if (isVoiceMode) {
      const voiceDiagnosis = [
        `আলহামদুলিল্লাহ ${nameSalute}, আপনার শারীরিক বিবরণ পুঙ্খানুপুঙ্খভাবে আমি ও আমাদের ইউনানী চিকিৎসক দল পর্যালোচনা করেছি। আপনার বয়স ${prof.age || "উপযুক্ত"} বছর, আপনি ${prof.maritalStatus || "সম্মানিত ভাই"}, এবং সমস্যাটি ${prof.duration || "বেশ কিছুদিন"} ধরে ফেস করছেন। আপনার এই শারীরিক অবস্থার জন্য কোনো কৃত্রিম কেমিক্যাল বা ক্ষতিকর ওয়ান-টাইম ড্রাগ ছাড়াই আমাদের এক মাসের ফুল কোর্স খাঁটি কস্তুরী পাউডার শতভাগ উপযুক্ত ও নিরাপদ। এটি দুর্বল স্নায়ু সতেজ করে সহবাসের স্বাভাবিক সময় বিশ থেকে পঁচিশ মিনিট পর্যন্ত বাড়িয়ে দেবে এবং পাতলা বীর্য আঠার মতো ঘন করবে। অফার মূল্য মাত্র দুই হাজার আটশত টাকা। অর্ডার কনফার্ম করতে পাঁচশত টাকা অগ্রিম আমাদের বিকাশ হেল্পলাইন নম্বর শূন্য এক আট সাত শূন্য, শূন্য দুই তিন আট শূন্য চার-এ দিতে হয়, আর বাকি দুই হাজার তিনশত টাকা পার্সেল হাতে পেয়ে দেখে ডেলিভারি ম্যানকে দেবেন। আপনার কোর্সটি কি আজই বুকিং করে দেব ভাইয়া?`,

        `মাশাআল্লাহ ${nameSalute}, আপনার মেডিকেল হিস্ট্রি পুঙ্খানুপুঙ্খভাবে বিশ্লেষণ করলাম। যেহেতু আপনার বয়স ${prof.age || "উপযুক্ত"} এবং সমস্যাটি ${prof.duration || "কিছুদিন"} যাবত, তাই সিন্থেটিক কেমিক্যাল ছাড়াই আমাদের প্রাকৃতিক মৃগনাভি কস্তুরী ও হিমালয়ান শিলাজিৎ ফর্মুলা আপনার টেস্টোস্টেরন বৃদ্ধি করে ধাতু আঠার মতো ঘন করবে ও স্থায়ী শক্তি ফিরিয়ে দেবে। সারা দেশে ক্যাশ অন ডেলিভারিতে পাঠানো হয়। অফার প্রাইস মাত্র দুই হাজার আটশত টাকা। বুকিং নিশ্চিত করতে পাঁচশত টাকা অগ্রিম আমাদের বিকাশ হেল্পলাইন নম্বর শূন্য এক আট সাত শূন্য, শূন্য দুই তিন আট শূন্য চার-এ দিতে হয়, আর বাকি দুই হাজার তিনশত টাকা পার্সেল বুঝে পেয়ে দেবেন। আপনার নাম ও ঠিকানা দিলে কি আজই পাঠিয়ে দেব ভাইয়া?`,

        `ধন্যবাদ ${nameSalute} আপনার শারীরিক অবস্থা বিস্তারিত শেয়ার করার জন্য। আপনার হিস্ট্রি অনুযায়ী কোনো ক্ষতিকর পার্শ্বপ্রতিক্রিয়া ছাড়াই ভেষজ চিকিৎসার মাধ্যমে এটি স্থায়ীভাবে নিরাময় সম্ভব। আমাদের এক মাসের ফুল কোর্স খাঁটি কস্তুরী পাউডারের প্রাকৃতিক উপাদান আপনার শরীরের রক্তসঞ্চালন বৃদ্ধি করে স্বাভাবিক মিলন সময় বিশ থেকে পঁচিশ মিনিট পর্যন্ত বাড়িয়ে দেবে। ফুল কোর্সের অফার মূল্য মাত্র দুই হাজার আটশত টাকা। শুধু পাঁচশত টাকা অগ্রিম আমাদের হেল্পলাইন নম্বর শূন্য এক আট সাত শূন্য, শূন্য দুই তিন আট শূন্য চার-এ বুকিং করে বাকি দুই হাজার তিনশত টাকা কুরিয়ারে পার্সেল হাতে পেয়ে দেখে পরিশোধ করবেন। আপনি কি আজই কোর্সটি শুরু করতে চাচ্ছেন ভাইয়া?`,

        `${nameSalute}, আপনার শারীরিক বিবরণ ও বয়স অনুসারে আমাদের অভিজ্ঞ ইউনানী বোর্ডের সিদ্ধান্ত—আপনার জন্য এক মাসের ফুল কোর্স খাঁটি কস্তুরী পাউডারই সর্বোচ্চ কার্যকরী ও নিরাপদ সমাধান। কোনো পার্শ্বপ্রতিক্রিয়া ছাড়াই এটি স্থায়ী সক্ষমতা নিশ্চিত করে। অর্ডার বুকিংয়ের জন্য পাঁচশত টাকা অগ্রিম বিকাশে আমাদের হেল্পলাইন নম্বর শূন্য এক আট সাত শূন্য, শূন্য দুই তিন আট শূন্য চার-এ পাঠিয়ে বাকি দুই হাজার তিনশত টাকা পার্সেল হাতে পেয়ে দেখে পরিশোধ করবেন। আপনার জন্য কি পার্সেলটি বুকিং করব ভাইয়া?`
      ];
      return voiceDiagnosis[Math.floor(Math.random() * voiceDiagnosis.length)];
    }

    const textDiagnosis = [
      `আলহামদুলিল্লাহ ${nameSalute}, আপনার সবগুলো শারীরিক তথ্য আমি পুঙ্খানুপুঙ্খভাবে বিশ্লেষণ করেছি। আপনার বয়স ${prof.age || "উপযুক্ত"} বছর, আপনি ${prof.maritalStatus || "সম্মানিত ভাই"}, এবং সমস্যাটি ${prof.duration || "কিছুদিন"} ধরে ফেস করছেন।${prof.timing ? ` মিলন স্থায়িত্ব (${prof.timing})` : ""}${prof.erectionQuality ? ` ও লিঙ্গের শিথিলতা (${prof.erectionQuality})` : ""}${prof.semenQuality ? ` এবং বীর্যের তারল্য (${prof.semenQuality})` : ""} বিবেচনা করে আপনার ফাইলটি সাজানো হয়েছে।

আপনার এই কন্ডিশনে কোনো ধরনের কৃত্রিম কেমিক্যাল ছাড়া আমাদের ২৫০ গ্রামের ১ মাসের ফুল কোর্স খাঁটি 'কস্তুরী পাউডার' শতভাগ উপযুক্ত ও কার্যকর। এটি নিষ্ক্রিয় নার্ভ সতেজ করে দ্রুত বীর্যপাত গোড়া থেকে নির্মূল করবে এবং স্বাভাবিক সহবাসের সময় ২০-২৫+ মিনিটে উন্নীত করবে। ইনশাআল্লাহ ৩ থেকে ৫ দিনেই পরিবর্তন বুঝতে পারবেন।

ফুল কোর্সের অফার মূল্য মাত্র ২,৮০০ টাকা (অর্ডার বুকিংয়ে ৫০০ টাকা অগ্রিম বিকাশে আমাদের অফিসিয়াল হেল্পলাইন: 01870-023804 নম্বরে পরিশোধ করতে হয়, বাকি ২,৩০০ টাকা কুরিয়ারে পার্সেল হাতে পেয়ে দেখে পরিশোধ করবেন)। আপনার ফুল কোর্সটি কি আজই বুকিং করে দেব ভাইয়া?`,

      `মাশাআল্লাহ ${nameSalute}, আপনার সম্পূর্ণ মেডিকেল হিস্ট্রি গভীরভাবে পর্যালোচনা করলাম। বয়স ${prof.age || "উপযুক্ত"} বছর এবং সমস্যাটি ${prof.duration || "কিছুদিন"} যাবত${prof.timing ? ` (টাইমিং: ${prof.timing})` : ""}${prof.semenQuality ? ` ও বীর্য পাতলা হওয়ার কারণে` : ""} স্নায়ুর রক্তসঞ্চালন বাধাগ্রস্ত হচ্ছে।

কোনো সিন্থেটিক কেমিক্যাল ছাড়াই আমাদের প্রাকৃতিক কস্তুরী ও হিমালয়ান শিলাজিৎ ফর্মুলা আপনার টেস্টোস্টেরন বৃদ্ধি করে ধাতু আঠার মতো ঘন করবে ও স্থায়ী শক্তি ফিরিয়ে দেবে। সারা দেশে ক্যাশ অন ডেলিভারিতে হোম ডেলিভারি দেওয়া হয়।

ফুল কোর্সের বর্তমান অফার প্রাইস মাত্র ২,৮০০ টাকা (বুকিং নিশ্চিত করতে ৫০০ টাকা অগ্রিম বিকাশে হেল্পলাইন 01870-023804 নম্বরে দিতে হয়, বাকি ২,৩০০ টাকা পার্সেল বুঝে পেয়ে ডেলিভারি ম্যানকে দেবেন)। আপনার নাম ও সম্পূর্ণ ঠিকানা দিলে কি আজই বুকিং করে পাঠিয়ে দেব ভাইয়া?`,

      `ধন্যবাদ ${nameSalute} আপনার শারীরিক অবস্থা ও স্বাস্থ্যবিধি বিস্তারিত শেয়ার করার জন্য। আপনার হিস্ট্রি অনুযায়ী ভেষজ চিকিৎসার মাধ্যমে এটি সম্পূর্ণ ও স্থায়ীভাবে নিরাময়যোগ্য। আমাদের ১ মাসের ফুল কোর্স (২৫০ গ্রাম) কস্তুরী পাউডারের ৬টি দুর্লভ প্রাকৃতিক উপাদান আপনার শরীরের রক্তসঞ্চালন বৃদ্ধি করে নার্ভকে ভেতর থেকে মজবুত করবে।

কোর্সটির বর্তমান স্পেশাল অফার প্রাইস মাত্র ২,৮০০ টাকা (৫০০ টাকা অগ্রিম বুকিং বিকাশে হেল্পলাইন 01870-023804 নম্বরে পাঠাতে হয়, বাকি ২,৩০০ টাকা কুরিয়ারে পেয়ে দেখে দেবেন)। আপনি কি আজই কোর্সটি শুরু করতে চাচ্ছেন ভাইয়া?`,

      `${nameSalute}, আপনার শারীরিক বিবরণ, বয়স ও স্বাস্থ্য হিস্ট্রি অনুসারে আমাদের অভিজ্ঞ চিকিৎসক বোর্ডের সিদ্ধান্ত—আপনার জন্য ২৫০ গ্রামের ১ মাসের ফুল কোর্স 'কস্তুরী পাউডার'-ই সর্বোচ্চ কার্যকরী ও নিরাপদ সমাধান। কোনো পার্শ্বপ্রতিক্রিয়া ছাড়াই এটি স্থায়ী সক্ষমতা নিশ্চিত করে।

অর্ডার বুকিংয়ের জন্য ৫০০ টাকা অগ্রিম বিকাশে আমাদের হেল্পলাইন 01870-023804 নম্বরে পাঠিয়ে বুকিং করতে হয়, বাকি ২,৩০০ টাকা পার্সেল হাতে পেয়ে দেখে পরিশোধ করবেন। আপনার জন্য কি পার্সেলটি আজই বুকিং করব ভাইয়া?`
    ];
    return textDiagnosis[Math.floor(Math.random() * textDiagnosis.length)];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STAGE 1: MISSING AGE OR DURATION
  // ──────────────────────────────────────────────────────────────────────────
  const hasAgeInMessage = /(?:বয়স|বছর|bochor|age|\b\d{2}\b)/i.test(clean);
  const hasDurationInMessage = /(?:মাস|বছর|দিন|din|mas|bochor|month|year|dhore|ধরে|যাবত|jabot)/i.test(clean);

  if (hasAge && !hasDuration) {
    if (hasAgeInMessage) {
      const stage1DurationVariations = [
        `আলহামদুলিল্লাহ ${nameSalute}, আপনার বয়স ${prof.age} বছর জেনে খুব ভালো হলো। এই বয়সে শরীরের রক্ত সঞ্চালন ও কোষগুলো সতেজ থাকে, তাই খাঁটি প্রাকৃতিক ভেষজ গ্রহণ করলে খুব দ্রুত নার্ভ রিকভারি হয়। ভাইয়া, এই দুর্বলতা বা সমস্যাটি কতদিন বা কত মাস ধরে হচ্ছে একটু জানাবেন কি?`,
        `ধন্যবাদ ${nameSalute} বয়সটি জানানোর জন্য। ${prof.age} বছর বয়সে সঠিক প্রাকৃতিক ভেষজ চিকিৎসা নিলে শারীরিক স্ট্যামিনা ও বীর্যের ঘনত্ব দ্রুত বাড়ে। এই সমস্যাটি কি নতুন, নাকি বিগত কয়েক মাস বা বছর ধরে ফেস করছেন ভাইয়া?`,
        `মাশাআল্লাহ ${nameSalute}, বয়স ${prof.age} বছর নোট করে নিলাম। আপনার সমস্যার সঠিক রুট কজ বুঝতে আরেকটি বিষয় নিশ্চিত করুন—এই সমস্যাটি কতদিন যাবত হচ্ছে ভাইয়া?`
      ];
      return stage1DurationVariations[Math.floor(Math.random() * stage1DurationVariations.length)];
    } else {
      return `জি ${nameSalute}, আপনার সঠিক পরামর্শ নিশ্চিত করতে আরেকটি বিষয় জানা প্রয়োজন—এই শারীরিক দুর্বলতা বা সমস্যাটি কতদিন বা কত মাস ধরে অনুভব করছেন ভাইয়া?`;
    }
  }

  if (!hasAge && hasDuration) {
    if (hasDurationInMessage) {
      const stage1AgeVariations = [
        `জি ${nameSalute}, সমস্যাটি ${prof.duration} ধরে হচ্ছে জেনে বিস্তারিত বুঝতে পারলাম। দুশ্চিন্তার কোনো কারণ নেই, প্রাকৃতিক ভেষজে এটি স্থায়ীভাবে সমাধানযোগ্য। ভাইয়া, আপনার সঠিক ভেষজ ডোজ নির্ধারণে আপনার বর্তমান বয়স কত বছর একটু বলবেন কি?`,
        `ধন্যবাদ ${nameSalute}। সমস্যার মেয়াদটি নোট করে নিলাম। আপনার শরীরে ওষুধটি কত দ্রুত কাজ করবে তা বয়সের মেটাবলিজমের ওপর নির্ভর করে। আপনার বর্তমান বয়স কত ভাইয়া?`,
        `মাশাআল্লাহ ${nameSalute}, আপনার তথ্যটি বুঝলাম। শতভাগ কার্যকরী প্রেসক্রিপশন দিতে আপনার বর্তমান বয়স কত বছর একটু জানাবেন কি?`
      ];
      return stage1AgeVariations[Math.floor(Math.random() * stage1AgeVariations.length)];
    } else {
      return `জি ${nameSalute}, সঠিক ভেষজ ডোজ নির্ধারণে আপনার বর্তমান বয়স কত বছর একটু জানাবেন কি?`;
    }
  }

  if (!hasAge && !hasDuration) {
    const stage1InitialVariations = [
      `জি ${nameSalute}, আমাদের প্রধান ভেষজ ফর্মুলা হলো ২৫০ গ্রামের ১ মাসের ফুল কোর্স 'কস্তুরী পাউডার'। এটি খাঁটি মৃগনাভি কস্তুরী, হিমালয়ান বন্য শিলাজিৎ, আসল কোরিয়ান রেড জিনসেং, কাশ্মীরি জাফরান ও অশ্বগন্ধা সমৃদ্ধ ১০০% খাঁটি প্রাকৃতিক চিকিৎসা। এটি কোনো সাময়িক কেমিক্যাল ওষুধ নয়; সরাসরি নিস্তেজ নার্ভে রক্তপ্রবাহ বাড়িয়ে দ্রুত বীর্যপাত স্থায়ীভাবে বন্ধ করে, গোপনাঙ্গকে ভেতর থেকে লোহার মতো শক্ত ও টানটান করে এবং পাতলা বীর্য আঠার মতো গাঢ় করে। মাত্র ৩ থেকে ৫ দিনেই পরিবর্তন বোঝা যায়।

ভাইয়া, আপনার শরীরের গঠন অনুযায়ী একদম সঠিক ও উপযুক্ত ভেষজ ডোজ নির্ধারণ করতে আমার ২টি ক্লিনিক্যাল তথ্য জানা প্রয়োজন:
১) আপনার বর্তমান বয়স কত বছর?
২) এই শারীরিক দুর্বলতা বা সমস্যাটি কতদিন বা কত মাস ধরে অনুভব করছেন?`,

      `জি ${nameSalute}, আমাদের কস্তুরী পাউডার স্বাস্থ্য ও পরিবার কল্যাণ মন্ত্রণালয়ের নিবন্ধিত চিকিৎসকের ফর্মুলায় তৈরি ১০০% কেমিক্যালমুক্ত চিকিৎসা। এটি পুরুষের টেস্টোস্টেরন হরমোন বৃদ্ধি করে, দীর্ঘদিনের স্নায়বিক ক্লান্তি দূর করে এবং সহবাসের স্বাভাবিক নিয়ন্ত্রণ ২০-২৫+ মিনিটে উন্নীত করে। এটি সম্পূর্ণ পার্শ্বপ্রতিক্রিয়ামুক্ত।

আপনার শারীরিক কন্ডিশন নিখুঁতভাবে বিশ্লেষণ করে উপযুক্ত গাইডলাইন দেওয়ার জন্য দয়া করে বলুন:
১) আপনার বয়স কত ভাইয়া?
২) এই সমস্যাটি কি নতুন, নাকি বিগত কয়েক মাস বা বছর ধরে ফেস করছেন?`,

      `জি ${nameSalute}, শারীরিক এই সমস্যাগুলো মূলত স্নায়বিক দুর্বলতা, হরমোনের ঘাটতি ও রক্ত সঞ্চালন কমে যাওয়ার কারণে তৈরি হয়। আমাদের কস্তুরী পাউডারের ৬টি দুর্লভ প্রাকৃতিক উপাদান নিষ্ক্রিয় শিরা-উপশিরা সতেজ করে গোপনাঙ্গকে ভেতর থেকে পাথরের মতো দৃঢ় করে তোলে এবং শুক্রাণু বৃদ্ধি করে।

আপনাকে শতভাগ সঠিক পরামর্শ ও কোর্স সাজিয়ে দিতে ২টি বিষয় একটু নিশ্চিত করবেন কি:
১) আপনার বর্তমান বয়স কত?
২) এই শারীরিক সমস্যাটি কতদিন যাবত হচ্ছে ভাইয়া?`,

      `জি ${nameSalute}, আপনার সমস্যাটি নিয়ে একদম দুশ্চিন্তা করবেন না ভাইয়া। ইউনানী চিকিৎসায় খাঁটি কস্তুরী ও হিমালয়ান শিলাজিতের প্রাকৃতিক শক্তিতে এটি গোড়া থেকেই সম্পূর্ণ নিরাময়যোগ্য। এটি ধাতুর ঘনত্ব বাড়িয়ে তীব্র শক্তিবর্ধক হিসেবে কাজ করে।

আপনার শরীরের জন্য সবচেয়ে নিরাপদ ও কার্যকর ডোজ সাজাতে ২টি তথ্য প্রয়োজন:
১) আপনার বয়স কত বছর ভাইয়া?
২) সমস্যাটা কতদিন ধরে হচ্ছে?`
    ];
    return stage1InitialVariations[Math.floor(Math.random() * stage1InitialVariations.length)];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STAGE 2: HAS AGE & DURATION -> ASK SEXUAL PATHOLOGY (TIMING, FIRMNESS, SEMEN)
  // ──────────────────────────────────────────────────────────────────────────
  if (!hasPathology) {
    const stage2Variations = [
      `আলহামদুলিল্লাহ ${nameSalute}, বয়স ও সমস্যার মেয়াদ গুরুত্বের সাথে নোট করলাম। চিকিৎসার সঠিক ফর্মুলা ও মাত্রা নির্ধারণে অত্যন্ত গোপনীয় ২টি বিষয় একটু জানাবেন:
১) সহবাসে প্রবেশের পর স্বাভাবিকভাবে কতক্ষণ সময় পান? মিলন চলাকালীন কি মাঝপথে নরম বা ঢিলা হয়ে যায়?
২) বীর্য কি অতিরিক্ত পাতলা বা পানির মতো? আর উত্তেজনার শুরুতে বা ফোনে কথা বললে কি আগাম আঠালো কামরস/পানি আসে?`,

      `ধন্যবাদ ${nameSalute}। ${prof.age} বছর বয়সে সঠিক ভেষজ চিকিৎসায় নার্ভ খুব দ্রুত সক্রিয় হয়। পারফেক্ট ডোজ নির্ধারণে চিকিৎসকের পক্ষ থেকে ২টি প্রশ্ন ছিল:
১) মিলনে প্রবেশের পর স্থায়ী কত মিনিট সময় পান ভাইয়া? প্রবেশের আগেই কি বীর্যপাত হয়ে যায়?
২) লিঙ্গের উত্থান কি সম্পূর্ণ শক্ত ও টানটান হয়, নাকি নিস্তেজ থাকে? আর বীর্যের ঘনত্ব কেমন?`,

      `জি ${nameSalute}, আপনার সমস্যাটি সম্পূর্ণ নিরাময়যোগ্য। উপযুক্ত ভেষজ ফাইল সাজাতে ২টি প্রধান লক্ষণ সম্পর্কে জানতে চাই:
১) সহবাসের স্থায়িত্ব কতক্ষণ থাকে এবং লিঙ্গ কি মাঝপথে নিস্তেজ হয়ে যাওয়ার সমস্যা হয়?
২) বীর্য কি পানির মতো তরল এবং সামান্য উত্তেজনায় কি কাপড় ভিজে যায় ভাইয়া?`,

      `মাশাআল্লাহ ${nameSalute}। ইউনানী বোর্ডের সঠিক প্রেসক্রিপশনের জন্য যৌন লক্ষণের গভীরতা জানা জরুরি:
১) মিলনের সময় কি ১-২ মিনিট বা তার কম পান? মাঝপথে নরম হওয়ার সমস্যা আছে কি?
২) ধাতু বা বীর্য কি ঘন নাকি অতিরিক্ত পাতলা পানির মতো?`
    ];
    return stage2Variations[Math.floor(Math.random() * stage2Variations.length)];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STAGE 3: HAS PATHOLOGY -> ASK LIFESTYLE & DIGESTION (GASTRIC, SLEEP, PROBASHI)
  // ──────────────────────────────────────────────────────────────────────────
  if (!hasLifestyle) {
    const stage3Variations = [
      `মাশাআল্লাহ ${nameSalute}, আপনার শারীরিক দুর্বলতার লক্ষণগুলো বুঝতে পারলাম। ভেষজ ওষুধের দ্রুত শোষণ ও হরমোন নিঃসরণ স্বাভাবিক রাখতে ২টি লাইফস্টাইল তথ্য জানা খুব জরুরি ভাইয়া:
১) আপনার কি দীর্ঘদিনের গ্যাস্ট্রিক, এসিডিটি বা কোষ্ঠকাঠিন্যের সমস্যা আছে?
২) রাতে নিয়মিত কেমন ঘুম হয়? আর আপনি কি দেশেই আছেন নাকি কোনো প্রবাসী ভাই?`,

      `ধন্যবাদ ${nameSalute}। আমাদের ভেষজ ফর্মুলা ১০০% অর্গানিক হওয়ায় হজমশক্তি ও মেটাবলিজম ঠিক থাকা অপরিহার্য। দয়া করে জানাবেন:
১) পেটে গ্যাস বা হজমের কোনো সমস্যা আছে কি ভাইয়া?
২) রাতে ঘুম কেমন হয় এবং আপনি কি দেশেই থাকেন নাকি প্রবাসে?`,

      `জি ${nameSalute}, বীর্য ঘন ও নার্ভ ভেতর থেকে মজবুত করতে পরিপাকতন্ত্র ও মানসিক চাপমুক্ত থাকা খুব প্রয়োজন। একটু বলুন—
১) আপনার কি গ্যাস্ট্রিকের সমস্যা বা পায়খানা শক্ত হওয়ার সমস্যা আছে?
২) রাতে স্বাভাবিক ঘুম হয় তো? আর আপনি কি দেশের বাইরে থাকেন ভাইয়া?`,

      `খুবই স্পষ্ট করে বলেছেন ভাইয়া। সঠিক সেবনবিধি দিতে ২টি প্রশ্ন ছিল:
১) দীর্ঘদিনের গ্যাস্ট্রিক বা বদহজম আছে কি না?
২) রাতে নিয়মিত কত ঘণ্টা ঘুম হয়? আর আপনি কি প্রবাসী নাকি দেশেই আছেন?`
    ];
    return stage3Variations[Math.floor(Math.random() * stage3Variations.length)];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STAGE 4: HAS LIFESTYLE -> ASK MARITAL STATUS & MARRIAGE DURATION
  // ──────────────────────────────────────────────────────────────────────────
  if (!hasMarriage) {
    const stage4Variations = [
      `আলহামদুলিল্লাহ ${nameSalute}, আপনার শারীরিক বিবরণ আমি পুঙ্খানুপুঙ্খভাবে নোট করেছি। চিকিৎসার সঠিক গাইডলাইন ও পারফেক্ট ডোজ নির্ধারণে আরেকটি বিষয় জানা খুব জরুরি—আপনি কি বিবাহিত নাকি অবিবাহিত ভাইয়া? আর বিয়ে কতদিন বা কত বছর হলো?`,

      `ধন্যবাদ ${nameSalute} তথ্যগুলো স্পষ্ট করার জন্য। আপনার সঠিক চিকিৎসার পরামর্শ দিতে আরেকটি বিষয় জানা দরকার—আপনি কি বিবাহিত ভাইয়া? বিয়ে কতদিন হলো, নাকি অবিবাহিত?`,

      `জি ${nameSalute}, আপনার জন্য উপযুক্ত কোর্স নির্ধারণের জন্য একটু বলবেন কি—আপনি কি বিয়ে করেছেন? বিয়ে কতদিন হলো, নাকি এখনও অবিবাহিত?`,

      `মাশাআল্লাহ ${nameSalute}, তথ্যটি পেয়ে খুব ভালো হলো। সঠিক ভেষজ ডোজ ও সেবনবিধি নির্ধারণে আরেকটি প্রশ্ন ছিল—আপনি কি বিবাহিত নাকি অবিবাহিত ভাইয়া? আর বিবাহিত হলে বিয়ে কতদিন হলো?`
    ];
    return stage4Variations[Math.floor(Math.random() * stage4Variations.length)];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STAGE 5: HAS MARRIAGE -> ASK BLOOD GROUP & VITALS (DIABETES / BP)
  // ──────────────────────────────────────────────────────────────────────────
  if (!hasBloodOrChronic) {
    const stage5Variations = [
      `মাশাআল্লাহ ${nameSalute}। সম্পূর্ণ নিরাপদ ও শতভাগ অর্গানিক ডোজ নিশ্চিত করার জন্য আর দুটি ছোট ক্লিনিক্যাল তথ্য জানা প্রয়োজন ভাইয়া:
১) আপনার রক্তের গ্রুপ কি জানা আছে?
২) আপনার কি ডায়াবেটিস বা উচ্চ রক্তচাপ (হাই প্রেশার) আছে কিনা?`,

      `ধন্যবাদ ${nameSalute}। আমাদের ভেষজ ফর্মুলার সর্বোচ্চ কার্যকারিতা ও সঠিক মাত্রা নির্ধারণ করতে বলুন—আপনার রক্তের গ্রুপ জানা থাকলে জানাবেন। পাশাপাশি আপনার ডায়াবেটিস বা প্রেশারের কোনো সমস্যা আছে কি ভাইয়া?`,

      `জি ${nameSalute}, আপনার স্বাস্থ্য সুরক্ষায় আরেকটি বিষয়—আপনার ব্লাড গ্রুপ কী? আর শরীরে ডায়াবেটিস বা উচ্চ রক্তচাপ জাতীয় কোনো সমস্যা আছে কিনা একটু জানাবেন ভাইয়া।`,

      `খুবই গুরুত্বপূর্ণ তথ্য দিলেন ভাইয়া। ভেষজ বোর্ডের রেকর্ড অনুযায়ী—আপনার রক্তের গ্রুপ জানা থাকলে বলুন। আর ডায়াবেটিস বা হাই প্রেশার আছে কি না একটু নিশ্চিত করবেন ভাইয়া।`
    ];
    return stage5Variations[Math.floor(Math.random() * stage5Variations.length)];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STAGE 6: HAS VITALS -> ASK MEDICATION HISTORY & PAST HABITS
  // ──────────────────────────────────────────────────────────────────────────
  if (!hasMedicationHistory) {
    const stage6Variations = [
      `মাশাআল্লাহ ${nameSalute}, আপনার স্বাস্থ্য তথ্যগুলো নোট করে নিলাম। চিকিৎসার ফাইল ফাইনাল করতে শেষ একটি অত্যন্ত গুরুত্বপূর্ণ প্রশ্ন ছিল ভাইয়া—এর আগে কি কোনো ডাক্তার বা ফার্মেসির কেমিক্যাল ওয়ান-টাইম উত্তেজক ওষুধ খেয়েছিলেন? আর অতীতে অতিরিক্ত স্বপ্নদোষ বা হস্তমৈথুনের কারণে লিঙ্গের নার্ভ দুর্বল হওয়ার কোনো ইতিহাস ছিল কি?`,

      `ধন্যবাদ ${nameSalute}। শতভাগ নিরাপদ ও পার্শ্বপ্রতিক্রিয়ামুক্ত ভেষজ কোর্স নিশ্চিত করার জন্য শেষ আরেকটি বিষয় জানা জরুরি—এর আগে কি যৌন দুর্বলতায় কোনো কেমিক্যাল ওষুধ সেবন করেছিলেন? আর অতীতে কোনো ভুলের কারণে কি নার্ভ ক্ষতিগ্রস্ত হয়েছিল ভাইয়া?`,

      `জি ${nameSalute}, তথ্যটি গুরুত্বের সাথে রাখলাম। আপনার নার্ভের রুট কজ নিশ্চিত করতে বলুন—আগে কি কোনো এলোপ্যাথিক বা ওয়ান-টাইম ড্রাগ ট্রাই করেছেন? আর অতীতে অতিরিক্ত হস্তমৈথুন বা ধাতু ক্ষয়ের কোনো সমস্যা ছিল কি?`,

      `আলহামদুলিল্লাহ ${nameSalute}, চমৎকার তথ্য দিয়েছেন। চিকিৎসার শেষ ধাপ হিসেবে শুধু বলুন—এর আগে কি কোনো চিকিৎসা নিয়েছিলেন? আর অতীতে কোনো বদভ্যাসের কারণে কি দুর্বলতা তৈরি হয়েছিল ভাইয়া?`
    ];
    return stage6Variations[Math.floor(Math.random() * stage6Variations.length)];
  }

  // Fallback to initial if any gap
  return `জি ${nameSalute}, আপনার সমস্যাটি বিস্তারিত বুঝতে পেরেছি। সঠিক পরামর্শের জন্য আপনার বয়স এবং সমস্যা কতদিন ধরে হচ্ছে একটু জানান ভাইয়া।`;
}

function getNaturalPriceReply(senderName = "", isVoiceMode = false) {
  const nameSalute = (senderName && senderName !== "Customer" && senderName !== "কাস্টমার" && senderName !== "ভাইয়া")
    ? `${senderName} ভাইয়া`
    : "ভাইয়া";

  if (isVoiceMode) {
    const voiceVariations = [
      `জি ${nameSalute}, আমাদের ২৫০ গ্রামের এক মাসের ফুল কোর্স খাঁটি কস্তুরী পাউডারের অফার মূল্য মাত্র দুই হাজার আটশত টাকা। সারা দেশে কুরিয়ার সার্ভিসে ক্যাশ অন ডেলিভারিতে পাঠানো হয়। তবে ভাইয়া, ওষুধ গ্রহণের পূর্বে আপনার শারীরিক অবস্থা জেনে নেওয়া প্রয়োজন। আপনার মূল সমস্যাটা ঠিক কী হচ্ছে একটু খুলে বলবেন কি? যেমন: দ্রুত বীর্যপাত, লিঙ্গের শিথিলতা, নাকি শারীরিক দুর্বলতা? এবং আপনার বয়স কত?`,
      `জি ${nameSalute}, এক মাসের সম্পূর্ণ কোর্সের জন্য ২৫০ গ্রাম কস্তুরী পাউডারের বর্তমান অফার প্রাইস মাত্র দুই হাজার আটশত টাকা। কুরিয়ারে ক্যাশ অন ডেলিভারিতে সারা দেশে পৌঁছে দেওয়া হয়। ভাইয়া, আপনি কোন শারীরিক সমস্যার জন্য ওষুধটি নিতে চাচ্ছেন এবং সমস্যাটি কতদিন ধরে? আপনার বয়স কত ভাইয়া?`,
      `জি ${nameSalute}, আমাদের ২৫০ গ্রামের ফুল কোর্সের খাঁটি কস্তুরী পাউডার এখন বিশেষ ছাড়ে দুই হাজার আটশত টাকায় পাচ্ছেন। তবে সঠিক রোগ নির্ণয় ছাড়া ওষুধ দিলে কাঙ্ক্ষিত ফল পাওয়া যায় না। আপনার মূল সমস্যা ও বয়স জানালে আপনার জন্য সঠিক ও কার্যকরী পরামর্শ দিতে পারব ইনশাআল্লাহ।`
    ];
    return voiceVariations[Math.floor(Math.random() * voiceVariations.length)];
  }

  const textVariations = [
    `জি ${nameSalute}, আমাদের ২৫০ গ্রামের ১ মাসের ফুল কোর্সের 'কস্তুরী পাউডার'-এর অফার মূল্য মাত্র ২,৮০০ টাকা। সারা দেশে কুরিয়ারে ক্যাশ অন ডেলিভারিতে হোম ডেলিভারি দেওয়া হয়।\n\nতবে ভাইয়া, ওষুধ নেওয়ার আগে আপনার শারীরিক অবস্থা অনুযায়ী এটি সঠিক কিনা তা জানা অত্যন্ত জরুরি। ভাইয়া, আপনার মূল সমস্যাটা ঠিক কী হচ্ছে একটু খুলে বলবেন কি? যেমন: দ্রুত বীর্যপাত বা টাইমিং কম, ইরেকশন বা শক্ত না হওয়া, নাকি শারীরিক দুর্বলতা? এবং আপনার বয়স কত?`,
    `জি ${nameSalute}, ১ মাসের ফুল কোর্সের জন্য ২৫০ গ্রাম প্রিমিয়াম কস্তুরী পাউডারের বর্তমান অফার প্রাইস মাত্র ২,৮০০ টাকা।\n\nভাইয়া, আপনি ঠিক কোন শারীরিক সমস্যার জন্য ওষুধটি খুঁজছেন একটু জানাবেন কি? (যেমন: দ্রুত বীর্যপাত, পাতলা বীর্য, নাকি লিঙ্গের শিথিলতা?) আপনার সমস্যা ও বয়স জানালে আপনাকে সবচেয়ে সঠিক সমাধান দিতে পারব ইনশাআল্লাহ।`,
    `জি ${nameSalute}, আমাদের ২৫০ গ্রামের ফুল কোর্সের খাঁটি কস্তুরী পাউডার এখন বিশেষ ছাড়ে ২,৮০০ টাকায় পাচ্ছেন। সারাদেশে ক্যাশ অন ডেলিভারি সুবিধা রয়েছে।\n\nতবে ভাইয়া, ওষুধ নেওয়ার পূর্বে আপনার স্বাস্থ্য লক্ষণগুলো জেনে নেওয়া আমাদের দায়িত্ব। আপনার মূল সমস্যাটা ঠিক কী এবং কতদিন ধরে ফেস করছেন? আপনার বয়স কত ভাইয়া?`
  ];
  return textVariations[Math.floor(Math.random() * textVariations.length)];
}

async function generateReply(customerMessage, senderName, senderId = null, recentHistory = [], pageName = "গ্রীন হেলথ ইউনানী ফার্মেসী", isVoiceMode = false) {
  // Extract and persist permanent customer facts
  if (senderId) {
    customerMemory.extractCustomerFacts(senderId, customerMessage, senderName);
    const prof = customerMemory.getCustomerProfile(senderId);
    if (!prof.productDiscussed && recentHistory && recentHistory.length > 0) {
      for (const line of recentHistory) {
        // Only inspect customer lines, not bot messages with generic ingredients!
        const lLow = (line || "").toLowerCase();
        if (lLow.startsWith("user:") || lLow.startsWith("customer:") || !lLow.startsWith("bot:")) {
          customerMemory.extractCustomerFacts(senderId, line.replace(/^(?:user|customer):\s*/i, ""), senderName);
        }
      }
    }
    customerMemory.appendChatMessage(senderId, "user", customerMessage, false);
  }

  // ── DIRECT CONTACT CTA INTERCEPTOR ────────────────────────────────────────
  // For customers who replied 3-4 messages: check in on them, explain that keeping
  // this secret problem untreated is harmful and increases day by day, incorporate
  // previously discussed health context, and provide direct Call / WhatsApp to main Hakim sahib.
  // Fires only ONCE per customer (tracked via directCtaSent flag).
  if (senderId) {
    const _ctaProf = customerMemory.getCustomerProfile(senderId);
    const _alreadyOrdered = _ctaProf.orderStatus === 'order_placed' || _ctaProf.orderStatus === 'delivered';
    const _ctaAlreadySent = !!_ctaProf.directCtaSent;
    if (!_alreadyOrdered && !_ctaAlreadySent) {
      const _chatLog = _ctaProf.chatLog || [];
      const _userMsgCount = _chatLog.filter(m => m.role === 'user').length;
      const _isAskingForContact = /(?:number|namber|নম্বর|নাম্বার|call|কল|phone|ফোন|whatsapp|হোয়াটসঅ্যাপ|যোগাযোগ|contact|সরাসরি)/i.test(customerMessage);
      
      if (_userMsgCount >= 3 && !_isAskingForContact) {
        const sName = (_ctaProf && _ctaProf.name && _ctaProf.name !== 'Customer' && _ctaProf.name !== 'কাস্টমার') ? _ctaProf.name + ' ভাইয়া' : 'ভাইয়া';
        const symptomStr = (_ctaProf.symptoms && _ctaProf.symptoms.length > 0) ? _ctaProf.symptoms.slice(0, 2).join(' ও ') : '';
        const contextMention = symptomStr ? `আপনার এই ${symptomStr}-এর বিষয়টি` : 'আপনার শারীরিক সমস্যাটির বিষয়ে';

        const _ctaReplies = [
          `জি ${sName}, আপনার সাথে কথা বলে ${contextMention} ভালোভাবে জানতে পারলাম। একটা কথা ভাই হিসেবে আন্তরিকভাবে বলি—এই ধরণের গোপন শারীরিক রোগ বেশিদিন পুষে রাখা একদমই ঠিক না। সময়মতো সঠিক চিকিৎসা না নিলে ভেতরের নার্ভগুলো দিন দিন আরও দুর্বল হয়ে পড়ে এবং সমস্যাটি আরও জটিল আকার ধারণ করে।

ভাই, এই বিষয়ে আরও যা যা জানার আছে বা আপনার মনের সব দ্বিধা দূর করতে আপনি সরাসরি আমাদের প্রধান হাকীম সাহেবের সাথে কথা বলতে পারেন:
📞 সরাসরি কল বা WhatsApp: 01870-023804

হাকীম সাহেব নিজে ল্যাবে থেকে প্রতিটি রোগীর শারীরিক অবস্থা ও রোগের লক্ষণ পুঙ্খানুপুঙ্খ শুনে নিজ হাতে ফ্রেশ পাহাড়ি ভেষজ দিয়ে স্পেশালভাবে ওষুধ তৈরি করে দেন, যা ইনশাআল্লাহ ১০০% কার্যকরী হয়। আমাদের প্রধান হাকীম সাহেবের ব্যক্তিগত নম্বর সাধারণত সবাইকে দেওয়া হয় না, আপনাকে আপন ভাই মনে করেই দিলাম—যাতে আপনি সঠিক সময়ে সঠিক পরামর্শ পেয়ে স্থায়ীভাবে সুস্থ হতে পারেন। আপনি কি হাকীম সাহেবের সাথে সরাসরি কথা বলে একবার পরামর্শ নিতে চান ভাইয়া?`,

          `ভাইয়া, আপনার সাথে কথা বলে আমার মনে হলো আপনি সত্যিই এই সমস্যার একটি স্থায়ী সমাধান চান। তবে ${contextMention} নিয়ে অবহেলা করলে রোগটি দিনে দিনে আরও বাড়ে বই কমে না, যা পরবর্তীতে দাম্পত্য জীবনেও অশান্তি তৈরি করে।

মেসেজে সব কথা বিস্তারিত খুলে বলা বা বোঝানো অনেক সময় কঠিন হয়ে পড়ে। তাই আপনার সুবিধার জন্য বলছি—আপনি সরাসরি আমাদের প্রধান হাকীম সাহেবের সাথে কথা বলতে পারেন:
📞 সরাসরি কল অথবা WhatsApp করুন: 01870-023804

হাকীম সাহেব নিজে ল্যাবে গবেষণা করে রোগীর শরীরের ঘাটতি অনুযায়ী কাস্টমাইজড করে স্পেশাল ওষুধ তৈরি করে দেন, যা ১০০% ফলদায়ক। প্রধান হাকীমের নম্বর সবাইকে সহজে দেওয়া হয় না, তবে আপনার সমস্যার গুরুত্ব বুঝতে পেরে আপনাকে দিলাম ভাই মনে করে। আপনি চাইলে এখনই একটি সরাসরি কল দিতে পারেন বা হোয়াটসঅ্যাপে মেসেজ করতে পারেন ভাইয়া।`,

          `${sName}, আপনার সার্বিক শারীরিক অবস্থা নিয়ে আমি সত্যিই ভাবছি। পুরুষের এই ধরণের অভ্যন্তরীণ দুর্বলতা যত দিন ফেলে রাখবেন, ভেতরের টেস্টোস্টেরন হরমোন ও নার্ভ তত নিস্তেজ হয়ে পড়ে। তাই কালক্ষেপণ না করে দ্রুত সঠিক পদক্ষেপ নেওয়া দরকার।

আপনার আরও যা যা পরামর্শের প্রয়োজন, সব সমস্যা মন খুলে জানাতে সরাসরি আমাদের প্রধান হাকীম সাহেবের সাথে ফোনে কথা বলুন:
📞 সরাসরি যোগাযোগ (ফোন ও WhatsApp): 01870-023804

হাকীম সাহেব নিজে ল্যাবে বসে দুর্লভ প্রাকৃতিক উপাদান দিয়ে আপনার শরীরের ধরন অনুযায়ী বিশেষ ওষুধ প্রস্তুত করে দেবেন, যা ১০০% কার্যকারিতা নিশ্চিত করে। আমাদের প্রধান হাকীমের নম্বর সাধারণ রোগীদের সচরাচর দেওয়া হয় না, আপনাকে ভাই ভেবেই দিলাম যাতে সঠিক সময়ে সঠিক চিকিৎসা পান। ভাইয়া, হাকীম সাহেবের সাথে কি একটু কথা বলবেন?`
        ];
        const _ctaReply = _ctaReplies[Math.floor(Math.random() * _ctaReplies.length)];
        customerMemory.updateCustomerProfile(senderId, { directCtaSent: true });
        customerMemory.appendChatMessage(senderId, 'model', _ctaReply, isVoiceMode);
        console.log('[DIRECT_CTA] Triggered personalized CTA for sender: ' + senderId);
        return _ctaReply;
      }
    }
  }
  // ── END DIRECT CONTACT CTA ─────────────────────────────────────────────────

  // Instant interceptor for pure greetings (Salam, How are you, Hi/Hello)
  // Ensures 100% adherence to "ONLY answer what was asked — never add extra sales pitches"
  const trimmedClean = (customerMessage || "").trim().toLowerCase().replace(/[.,!?;:()\-]/g, "").replace(/\s+/g, " ");

  const isPureSalam = /^(?:assalamu?\s*alaikum|assalamualaikum|asalam|asalamu\s*alaikum|slaam|salam|সালাম|আসসালামু\s*আলাইকুম|আসসালামুআলাইকুম)(?:\s*(?:vai|vaiya|bhai|bhaiya|doctor|hakeem|hakim|sir|ভাই|ভাইয়া|স্যার))?$/i.test(trimmedClean);
  if (isPureSalam) {
    const reply = "ওয়ালাইকুম আসসালাম ভাইয়া। বলুন, কীভাবে সাহায্য করতে পারি?";
    if (senderId) customerMemory.appendChatMessage(senderId, "model", reply, false);
    return reply;
  }

  const isPureHowAreYou = /^(?:kemon\s*(?:acho|asen|achen|aso)|how\s*are\s*you|কেমন\s*(?:আছো|আছেন|আসো))(?:\s*(?:vai|vaiya|bhai|bhaiya|doctor|hakeem|hakim|sir|ভাই|ভাইয়া|স্যার))?$/i.test(trimmedClean);
  if (isPureHowAreYou) {
    const reply = "আলহামদুলিল্লাহ ভাইয়া, আল্লাহর রহমতে ভালো আছি। আপনি কেমন আছেন? বলুন, কীভাবে সাহায্য করতে পারি?";
    if (senderId) customerMemory.appendChatMessage(senderId, "model", reply, false);
    return reply;
  }

  const isPureHi = /^(?:hi|hello|hey|হাই|হ্যালো|হ্যাল্লো)(?:\s*(?:vai|vaiya|bhai|bhaiya|doctor|hakeem|hakim|sir|ভাই|ভাইয়া|স্যার))?$/i.test(trimmedClean);
  if (isPureHi) {
    const reply = "জি ভাইয়া, আসসালামু আলাইকুম। বলুন, কীভাবে সাহায্য করতে পারি?";
    if (senderId) customerMemory.appendChatMessage(senderId, "model", reply, false);
    return reply;
  }

  // Instant interceptor for Hakim / Doctor / Creator identity inquiry ("আপনার নাম কি", "হাকীমের নাম কি", "কে তৈরি করেছে", "ডাক্তার কে")
  const isAskingDoctorName = /(?:apnar|আপনার|apnn|আপনন|doctor|ডাক্তার|hakim|হাকিম|হাকীম|hake)s*(?:name|nam|naam|নাম)s*(?:ki|কী|konta|বলেন|bolen|bolun|জানতে)?/i.test(trimmedClean) ||
                             /(?:name|nam|naam|নাম)s*(?:ki|কী)s*(?:apnar|আপনার|doctor|ডাক্তার|hakim|হাকিম|হাকীম)/i.test(trimmedClean) ||
                             /(?:ke|কে)s*(?:toiri|তৈরি|ketos*eri|কেটোs*এরি|banay|বানায়|banise|বানিয়েছে)/i.test(trimmedClean) ||
                             /(?:apnars*porichoy|আপনারs*পরিচয়|পরিচয়s*কি|apnis*ke|আপনিs*কে)/i.test(trimmedClean);
  if (isAskingDoctorName) {
    const reply = "\u099c\u09bf \u09ad\u09be\u0987\u09af\u09bc\u09be, \u0986\u09ae\u09bf \u09b9\u09be\u0995\u09c0\u09ae \u09ae\u09cb: \u0986\u09ac\u09cd\u09a6\u09c1\u09b2 \u0995\u09b0\u09bf\u09ae \u09ac\u09b2\u099b\u09bf\u0964 \u0986\u09ae\u09bf \u09b8\u09cd\u09ac\u09be\u09b8\u09cd\u09a5\u09cd\u09af \u09ae\u09a8\u09cd\u09a4\u09cd\u09b0\u09a3\u09be\u09b2\u09af\u09bc \u09ac\u09be\u0982\u09b2\u09be\u09a6\u09c7\u09b6 \u0987\u0989\u09a8\u09be\u09a8\u09c0 \u09ac\u09cb\u09b0\u09cd\u09a1\u09c7\u09b0 \u0995\u09cd\u09af\u09be\u099f\u09be\u0997\u09b0\u09bf-\u098f \u09a8\u09bf\u09ac\u09a8\u09cd\u09a7\u09bf\u09a4 \u099a\u09bf\u0995\u09bf\u09ce\u09b8\u0995 (\u09b0\u09c7\u099c\u09bf \u09a8\u0982: \u09eb\u09ee\u09ea\u09e8/\u09e8\u09e6\u09e7\u09ee), \u099c\u09a8\u09a4\u09be \u0987\u0989\u09a8\u09be\u09a8\u09c0 \u099a\u09bf\u0995\u09bf\u09ce\u09b8\u09be\u09b2\u09af\u09bc, \u0986\u09b2\u09c0\u0995\u09a6\u09ae, \u09ac\u09be\u09a8\u09cd\u09a6\u09b0\u09ac\u09be\u09a8\u0964 \u0986\u09ae\u09be\u09a6\u09c7\u09b0 \u0995\u09b8\u09cd\u09a4\u09c1\u09b0\u09c0 \u09aa\u09be\u0989\u09a1\u09be\u09b0 \u09e7\u09e6\u09e6% \u09aa\u09cd\u09b0\u09be\u0995\u09c3\u09a4\u09bf\u0995 \u09ad\u09c7\u09b7\u099c \u0989\u09aa\u09be\u09a6\u09be\u09a8\u09c7 \u0986\u09ae\u09be\u09b0 \u09a8\u09bf\u099c\u09b8\u09cd\u09ac \u09ab\u09b0\u09cd\u09ae\u09c1\u09b2\u09be\u09af\u09bc \u09aa\u09cd\u09b0\u09b8\u09cd\u09a4\u09c1\u09a4 \u0995\u09b0\u09be\u0964 \u09ac\u09b2\u09c1\u09a8 \u09ad\u09be\u0987\u09af\u09bc\u09be, \u0986\u09aa\u09a8\u09be\u0995\u09c7 \u0995\u09c0\u09ad\u09be\u09ac\u09c7 \u09b8\u09be\u09b9\u09be\u09af\u09cd\u09af \u0995\u09b0\u09a4\u09c7 \u09aa\u09be\u09b0\u09bf?";
    if (typeof senderId !== "undefined" && senderId) customerMemory.appendChatMessage(senderId, "model", reply, false);
    return reply;
  }

  // Instant interceptor for customer asking about THEIR OWN name ("আমার নাম কি", "আমার নাম জানো", "amar name jano")
  const isAskingCustomerName = !isAskingDoctorName && (
    /(?:amar|amr|আমার)s+(?:name|nam|naam|নাম)s*(?:ki|কী|konta|jano|jaano|janen|bolen|bolo|bolun|mone|ase|ache|জান|জানো|জানেন|বলেন|বলো|বলুন|মনে|আছে)/i.test(trimmedClean) ||
    /(?:jano|jaano|janen|জান|জানো|জানেন)s+(?:amar|amr|আমার)s+(?:name|nam|naam|নাম)/i.test(trimmedClean)
  );
  if (isAskingCustomerName) {
    let foundName = "";
    const savedProf = senderId ? customerMemory.getCustomerProfile(senderId) : null;
    if (savedProf && savedProf.name && !["Customer", "কাস্টমার", "ভাইয়া"].includes(savedProf.name) && customerMemory.isValidPersonName(savedProf.name)) {
      foundName = savedProf.name;
    }
    if (!foundName && senderId) {
      try {
        const Database = require("better-sqlite3");
        const db = new Database(path.join(process.cwd(), "prisma", "social_inbox.db"), { readonly: true });
        const row = db.prepare('SELECT customerName FROM "Order" WHERE senderId = ? AND customerName != "" ORDER BY createdAt DESC LIMIT 1').get(senderId);
        if (row && row.customerName && customerMemory.isValidPersonName(row.customerName)) {
          foundName = row.customerName;
          customerMemory.updateCustomerProfile(senderId, { name: foundName });
        }
        db.close();
      } catch (e) {}
    }
    if (foundName) {
      const reply = `জি ভাইয়া, আপনার নাম তো ${foundName}! বলুন ${foundName} ভাইয়া, কীভাবে সাহায্য করতে পারি?`;
      if (typeof senderId !== "undefined" && senderId) customerMemory.appendChatMessage(senderId, "model", reply, false);
      return reply;
    }
    const noNameReply = "জি না ভাইয়া, আপনার শুভ নামটি তো এখনো জানা হয়নি। আপনার নামটি যদি বলতেন, খুব ভালো লাগত।";
    if (typeof senderId !== "undefined" && senderId) customerMemory.appendChatMessage(senderId, "model", noNameReply, false);
    return noNameReply;
  }

  // ── Instant interceptor for Financial Constraints / Money Shortage ("টাকা নেই", "বাজেট নেই", "টাকা নাই") ──
  const isMoneyConstraintIntent =
    /(?:টাকা\s*নাই|টাকা\s*নেই|টাকার\s*সমস্যা|টাকা\s*হলে|টাকা\s*পয়সা\s*নাই|টাকা\s*পয়সা\s*নেই|টাকা\s*জোগাড়|বাজেট\s*নাই|বাজেট\s*নেই|বাজেট\s*কম|দাম\s*বেশি\s*নেব\s*না|টাকা\s*শর্ট|টাকা\s*কম|অর্থের\s*সমস্যা|অর্থনৈতিক\s*সমস্যা|এতো\s*টাকা\s*নেই|এত\s*টাকা\s*নাই|এত\s*টাকা\s*নেই|এতো\s*টাকা\s*নাই|টাকা\s*ম্যানেজ|taka\s*nai|taka\s*nei|takar\s*problem|taka\s*short|budget\s*nai|budget\s*nei|eto\s*taka\s*nai|eto\s*taka\s*nei|samortho\s*nai|সামর্থ্য\s*নাই|সামর্থ্য\s*নেই)/i.test(trimmedClean);
  if (isMoneyConstraintIntent) {
    const moneyConstraintReplies = [
      `জি ভাইয়া, আমি একদম বুঝতে পেরেছি। টাকা-পয়সা সব সময় মানুষের একরকম থাকে না, এটা খুবই স্বাভাবিক বিষয় ভাইয়া। টাকা নেই বলে যে কষ্ট করে এখনই ওষুধ নিতে হবে বা কোনো চাপ নিতে হবে এমন কোনো কথা নেই। টাকা-পয়সার চেয়ে আপনার মানসিক শান্তি আর পরিবার নিয়ে সুস্থ থাকাটাই আসল। ইনশাআল্লাহ সামনে যখন আপনার আর্থিক অবস্থা সুবিধাজনক হবে বা হাত ফ্রি হবে, তখন যদি প্রয়োজন মনে করেন আমাকে জানাবেন। আর ওষুধ ছাড়াও যেকোনো স্বাস্থ্য পরামর্শে এই ভাইকে পাশে পাবেন। আল্লাহ আপনার উপার্জনে বরকত দিন এবং সবসময় ভালো রাখুন ভাইয়া।`,
      `ঠিক আছে ভাইয়া, কোনো চিন্তা করবেন না। মানুষের জীবনে আর্থিক ওঠানামা আসতেই পারে, এটা নিয়ে বিন্দুমাত্র সংকোচ বা খারাপ লাগার কিছু নেই। এখন টাকা শর্ট থাকলে ওষুধ নেওয়ার কোনো তাড়াহুড়ো বা চাপ নেই ভাইয়া। যখন আপনার সুবিধা হবে বা সামর্থ্য হবে, তখন দরকার মনে হলে আমাকে জানাবেন। একজন শুভাকাঙ্ক্ষী ও বড় ভাই হিসেবে সবসময় আপনার পাশে আছি। আল্লাহ আপনার রিজিক বাড়িয়ে দিন এবং আপনাকে পরিবারসহ সুস্থ ও ভালো রাখুন ভাইয়া।`,
      `জি ভাইয়া, কোনো সমস্যা নেই। সবার আর্থিক পরিস্থিতি সবসময় এক থাকে না, আমি আপনার বিষয়টি অত্যন্ত শ্রদ্ধার সাথেই দেখছি। এখন টাকা নেই বলে মন খারাপ করবেন না। পরবর্তীতে পরিস্থিতি অনুকূলে আসলে বা আপনার সুবিধা হলে জানাবেন। আর শারীরিক কোনো বিষয় নিয়ে পরামর্শের দরকার হলে নিঃসঙ্কোচে যে কোনো সময় নক দিতে পারেন। আল্লাহ আপনার সহায় হোন এবং আপনাকে সর্বদা সুস্থ রাখুন ভাইয়া।`
    ];
    const reply = moneyConstraintReplies[Math.floor(Math.random() * moneyConstraintReplies.length)];
    if (senderId) customerMemory.appendChatMessage(senderId, "model", reply, isVoiceMode);
    return reply;
  }

  // Instant interceptor for time/schedule delay objections ("বিকেলে জানাবো", "পরে বলব", "রাতে জানাব")
  const isDelayIntent = /(?:বিকেলে\s*জানাব|বিকেলে\s*বলব|বিকেলে\s*নেব|পরে\s*জানাব|পরে\s*বলব|পরে\s*নেব|পরে\s*নিব|রাতে\s*জানাব|রাতে\s*বলব|কাজের\s*শেষে|ফ্রি\s*হয়ে|bikel.*janabo|pore.*janabo|pore.*nibo|free.*hoye)/i.test(trimmedClean);
  if (isDelayIntent) {
    const delayReplies = [
      `জি ভাইয়া, অবশ্যই! কোনো সমস্যা নেই। আপনি কাজের ফাঁকে বিকেলে বা রাতে যখনই একটু ফ্রি হবেন, আমাকে এখানে নক দিয়েন। নিজের শরীর ও সুস্থতা আগে, তাই আপনি স্বস্তিমতো সময়েই কথা বলুন। আর যেকোনো প্রয়োজনে তো আমি আছিই। ভালো থাকবেন ভাইয়া, আল্লাহ আপনাকে সুস্থ রাখুন।`,
      `ঠিক আছে ভাইয়া, একদম কোনো তাড়াহুড়ো নেই। আপনি কাজের শেষে অবসর মতো সুবিধাজনক সময়ে মেসেজ দিয়েন। নিজের শরীরের যত্ন নেবেন। যেকোনো স্বাস্থ্য পরামর্শ বা সহযোগিতার প্রয়োজনে এই ভাইকে পাশে পাবেন। সুস্থ থাকুন ভাইয়া।`,
      `আচ্ছা ভাইয়া, কোনো চিন্তা করবেন না। আপনি সুবিধামতো সময়ে ফ্রি হয়ে আমাকে জানাবেন, আমি ইনবক্সে আছি। আর সরাসরি কোনো বিষয়ে পরামর্শ নিতে চাইলে আমাদের অফিসিয়াল নম্বরেও (01870-023804) কথা বলতে পারেন। নিজের খেয়াল রাখবেন ভাইয়া।`
    ];
    const reply = delayReplies[Math.floor(Math.random() * delayReplies.length)];
    if (senderId) customerMemory.appendChatMessage(senderId, "model", reply, isVoiceMode);
    return reply;
  }

  // ── GUARD: Past-tense / unfulfilled order intent ───────────────────────────
  // e.g. "ami kalke order korte chaisilam" = customer WANTED to but didn't
  const isPastUnfulfilledIntent =
    /(?:chaisilam|chaisilem|cheyesilam|cheyechilam|চাইছিলাম|চেয়েছিলাম|চাইসিলাম|চাইছিলেন|চেয়েছিলেন)/i.test(customerMessage) ||
    /(?:parisilam|parini|parchi\s*na|পারিনি|পারছি\s*না|পারছিলাম|হয়নি|hoyni)/i.test(customerMessage) ||
    /(?:kalke|kal|goto\s*kal|গতকাল|আগে|age|আগেই|আগের).*(?:order|অর্ডার|নিতে|kinbo|কিনতে).*(?:chaisilam|chaisilem|চাইছিলাম|চেয়েছিলাম|parisilam|পারিনি)/i.test(customerMessage);

  if (isPastUnfulfilledIntent) {
    const pastIntentReplies = [
      `আরে ভাইয়া, কোনো সমস্যা নেই! কালকে কী হয়েছিল বলুন — কোনো অসুবিধা হয়েছিল? আমি এখন আপনার জন্য সব ঠিক করে দিতে পারব। আপনি কি এখন নিতে চান?`,
      `আচ্ছা ভাইয়া, কালকে কোনো সমস্যা হয়েছিল? কোনো চিন্তা নেই, এখনো সুযোগ আছে। বলুন কী হয়েছিল — আমি সাহায্য করব।`,
      `ভাইয়া, কালকে হয়নি কোনো ব্যাপার না। আপনি কি এখন অর্ডার দিতে চান? একটু বলুন — কোথায় আটকে গিয়েছিলেন?`
    ];
    const pastReply = pastIntentReplies[Math.floor(Math.random() * pastIntentReplies.length)];
    if (senderId) customerMemory.appendChatMessage(senderId, "model", pastReply, isVoiceMode);
    return pastReply;
  }

  // ── EARLY-STAGE ORDER INTENT GUARD ─────────────────────────────────────────
  // If customer says they want to order in their 1st/2nd/3rd message BUT we
  // haven't collected any health facts yet → redirect to consultation FIRST.
  // Only bypassed if customer already has age + problem info on record.
  const _earlyProf = senderId ? customerMemory.getCustomerProfile(senderId) : null;
  const _earlyUserMsgCount = _earlyProf ? (_earlyProf.chatLog || []).filter(m => m.role === 'user').length : 99;
  const _hasHealthData = Boolean(_earlyProf && (
    _earlyProf.age ||
    (_earlyProf.symptoms && _earlyProf.symptoms.length > 0) ||
    _earlyProf.duration ||
    _earlyProf.maritalStatus ||
    _earlyProf.timing ||
    _earlyProf.erectionQuality ||
    _earlyProf.semenQuality
  ));

  const _isEarlyOrderIntent =
    /(?:order|অর্ডার|nite\s*chai|নিতে\s*চাই|nibo|নিব|kinbo|কিনব|নেব|nebo|নিতে\s*চাচ্ছি|order\s*korte|অর্ডার\s*করতে|pathiye|পাঠিয়ে|pathao|পাঠাও|book\s*korte|বুকিং\s*করতে|newar|নেওয়ার|kivabe\s*order|কিভাবে\s*অর্ডার|order\s*kivabe|অর্ডার\s*কিভাবে|kivabe\s*nibo|কিভাবে\s*নিব|order\s*form|অর্ডার\s*ফর্ম|kinte\s*chai|কিনতে\s*চাই|kivabe\s*kinbo|কিভাবে\s*কিনব|order\s*process|অর্ডার\s*প্রসেস|kivabe\s*pabo|কিভাবে\s*পাব)/i.test(customerMessage) &&
    !_hasHealthData &&
    _earlyUserMsgCount <= 4;

  if (_isEarlyOrderIntent) {
    const sName = (_earlyProf && _earlyProf.name && _earlyProf.name !== 'Customer' && _earlyProf.name !== 'কাস্টমার') ? _earlyProf.name + ' ভাইয়া' : 'ভাইয়া';
    const earlyOrderReplies = [
      `জি ${sName}, আলহামদুলিল্লাহ — আপনার আগ্রহ দেখে সত্যিই ভালো লাগছে! তবে ভাইয়া, আমাদের ওষুধ কোনো সাধারণ বাজারের রেডিমেড ওষুধ নয় — এটি প্রতিটি রোগীর শারীরিক অবস্থা ও সমস্যার ধরন অনুযায়ী বিশেষভাবে প্রস্তুত করা হয়। তাই আগে আপনার সমস্যা কি কি সবকিছু বিস্তারিত জানা জরুরি, তারপর আপনি নিশ্চিত হয়ে অর্ডার করতে পারবেন।

ভাইয়া, আপনার মূল সমস্যাটা ঠিক কী হচ্ছে একটু খুলে বলবেন কি? যেমন: দ্রুত বীর্যপাত বা টাইমিং কম, ইরেকশন বা শক্ত না হওয়া, নাকি শারীরিক দুর্বলতা? এবং আপনার বয়স কত?`,

      `আলহামদুলিল্লাহ ${sName}, আপনি অর্ডার করতে চাচ্ছেন জেনে খুশি হলাম! তবে ভাইয়া, আমাদের মূল লক্ষ্য আপনার স্থায়ী সুস্থতা। বাজার চলতি রেডিমেড ওষুধের মতো না দিয়ে আমরা রোগীর শারীরিক ঘাটতি বিশ্লেষণ করে খাঁটি পাহাড়ি ভেষজ দিয়ে ওষুধ তৈরি করি। তাই অর্ডার করার পূর্বে আপনার সম্পর্কে কিছুটা জানা দরকার।

ভাইয়া, আপনার বয়স কত এবং মূল সমস্যাটা ঠিক কী হচ্ছে একটু খুলে বলবেন? (যেমন: দ্রুত বীর্যপাত, লিঙ্গের শিথিলতা, নাকি শারীরিক দুর্বলতা?) সমস্যাটি কতদিন ধরে?`,

      `জি ${sName}, অর্ডার করতে অবশ্যই পারবেন ইনশাআল্লাহ। তবে সরাসরি অর্ডার নেওয়ার আগে আপনার শারীরিক সমস্যাগুলো জেনে সঠিক ওষুধ নির্ধারণ করা আমাদের দায়িত্ব। কারণ সঠিক রোগ নির্ণয় ছাড়া ওষুধ দিলে কাঙ্ক্ষিত ফল পাওয়া যায় না।

ভাইয়া, একটু বলবেন কি—আপনার মূল সমস্যাটা ঠিক কী এবং বয়স কত? সবকিছু জেনে-শুনে আপনার জন্য সেরা ওষুধটি নির্ধারণ করে দেব ইনশাআল্লাহ।`
    ];
    const earlyOrderReply = earlyOrderReplies[Math.floor(Math.random() * earlyOrderReplies.length)];
    if (senderId) customerMemory.appendChatMessage(senderId, 'model', earlyOrderReply, isVoiceMode);
    console.log('[EARLY_ORDER_GUARD] Redirected to consultation — user msg count: ' + _earlyUserMsgCount + ', hasHealthData: ' + _hasHealthData);
    return earlyOrderReply;
  }
  // ── END EARLY-STAGE ORDER INTENT GUARD ─────────────────────────────────────

  // ── Instant interceptor for Full COD / Advance Payment Objections / Advance Inquiries ──
  // e.g. "na ami aivabe order korbo na full cod hobe", "advance chara hobe na?", "advance dibo na", "500 taka keno"
  const isAdvanceOrCodInquiry =
    /(?:full\s*cod|ফুল\s*ক্যাশ|ফুল\s*সিওডি|full\s*cash|cash\s*on\s*delivery)/i.test(customerMessage) ||
    /(?:advance|অগ্রিম|এডভান্স|adbhance|advanse|agrim).*(?:dibo\s*na|debo\s*na|দিব\s*না|দেবো\s*না|dite\s*parbo\s*na|দিতে\s*পারব\s*না|charai?|ছাড়া|হবে\s*না|hobe\s*na|keno|কেন|kiser|কিসের|neya\s*hoy|নেওয়া\s*হয়|deya\s*jabe\s*na|দেওয়া\s*যাবে\s*না|dite\s*chai\s*na|চাই\s*না)/i.test(customerMessage) ||
    /(?:charai?|ছাড়া|ছাড়াই).*(?:advance|অগ্রিম|এডভান্স|টাকা)/i.test(customerMessage) ||
    /(?:keno|কেন|kiser|কিসের).*(?:advance|অগ্রিম|এডভান্স|500|৫০০|আগে)/i.test(customerMessage) ||
    /(?:500|৫০০).*(?:advance|অগ্রিম|এডভান্স|taka\s*age|টাকা\s*আগে|keno|কেন|কিসের)/i.test(customerMessage) ||
    /(?:age|আগে).*(?:taka|টাকা).*(?:dibo\s*na|debo\s*na|দিব\s*না|দেবো\s*না|keno|কেন|dite\s*parbo\s*na|নেবেন)/i.test(customerMessage) ||
    /(?:hate\s*peye|হাতে\s*পেয়ে|product\s*dekhe|পণ্য\s*দেখে|maal\s*dekhe).*(?:sob\s*taka|shob\s*taka|সব\s*টাকা|pura\s*taka|পুরো\s*টাকা|dibo|দিব|debo|দেবো)/i.test(customerMessage) ||
    /(?:na\s*ami|না\s*আমি).*(?:aivabe|এইভাবে|advance|অগ্রিম|cod|নিয়মে)/i.test(customerMessage) ||
    /(?:advance|অগ্রিম|এডভান্স)\s*(?:charai?|ছাড়া|ছাড়াই|হবে\s*না|hobe\s*na|dibo\s*na|দিব\s*না|nai|নাই)/i.test(customerMessage);

  if (isAdvanceOrCodInquiry) {
    const advanceExplanationReplies = [
      `ভাইয়া, আপনার সংশয় আমি সম্পূর্ণ বুঝতে পারছি—অনলাইনে না দেখে অগ্রিম টাকা দিতে যে কারোই দ্বিধা লাগা স্বাভাবিক। তবে আসল কারণটা বলি ভাইয়া:

আমাদের এই ওষুধ বাজারের সাধারণ কোনো রেডিমেড বা কোম্পানির প্যাকেটজাত ওষুধ নয়। আপনার শারীরিক সমস্যা ও রোগের লক্ষণ পুঙ্খানুপুঙ্খ জেনে, আপনার শরীরের প্রয়োজন অনুযায়ী ল্যাব থেকে সম্পূর্ণ ফ্রেশ ব্যাচে খাঁটি ভেষজ উপাদান সঠিক অনুপাতে কাস্টমাইজড করে প্রস্তুত করা হয়।

প্রতিটি রোগীর জন্য আলাদাভাবে ফ্রেশ ওষুধ তৈরিতে আমাদের খাঁটি উপাদান ও প্রচুর শ্রম খরচ হয়। অতীতে ফুল ক্যাশ অন ডেলিভারিতে পাঠিয়ে দেখা গেছে অনেকেই পার্সেল রিসিভ করেন না, যার ফলে এই স্পেশাল ওষুধটি সম্পূর্ণ নষ্ট হয়ে যায়—যা অন্য কাউকে আর দেওয়া যায় না। তাই শুধুমাত্র আপনার আন্তরিকতা নিশ্চিত করতে এবং আপনার জন্য ওষুধটি প্রস্তুত করতে মাত্র ৫০০ টাকা বুকিং নেওয়া হয়।

বাকি পুরো ২,৩০০ টাকা কিন্তু পার্সেল হাতে পেয়ে, খুলে দেখে তারপর কুরিয়ার ম্যানকে দেবেন। আপনার কোনো ঝুঁকি নেই ভাইয়া।

আর বাজারের সস্তা ওষুধে ক্ষতিকর কেমিক্যাল ও স্টেরয়েড থাকে যা হার্ট ও কিডনির চরম ক্ষতি করে। আমরা দিচ্ছি শতভাগ খাঁটি ও নিরাপদ ফর্মুলা। ভাইয়া, আপনার সুস্থতার জন্য কি আপনার ফাইলটি প্রস্তুত করতে বলব?`,

      `জি ভাইয়া, অনলাইনে অগ্রিম টাকা দেওয়া নিয়ে আপনার দ্বিধা হওয়া খুবই স্বাভাবিক। কিন্তু সত্যি কথাটা আপনাকে খুলে বলি:

আমরা কোনো সাধারণ বা স্টক করা ওষুধ বিক্রি করি না। আপনার শারীরিক অবস্থা বিবেচনা করে আপনার জন্য স্পেশাল ভেষজ উপাদান সঠিক মাত্রায় মিশিয়ে সম্পূর্ণ ফ্রেশ ব্যাচে ওষুধটি প্রস্তুত করতে হয়।

পার্সেল পাঠানোর পর কেউ রিসিভ না করলে এই কাস্টমাইজড ওষুধটি সম্পূর্ণ নষ্ট হয়ে যায় এবং আমাদের উপাদানগুলো অপচয় হয়। তাই শুধুমাত্র আপনার ওষুধটি নিখুঁতভাবে তৈরি ও পার্সেল কনফার্ম করতেই এই ৫০০ টাকা অগ্রিম বুকিং নেওয়া হয়।

বাকি ২,৩০০ টাকা আপনি পার্সেল হাতে পেয়ে, চেক করে ডেলিভারিম্যানকে পরিশোধ করবেন। এখানে আপনার ১ টাকারও কোনো ঝুঁকি নেই ভাইয়া। আপনার সুস্থতার জন্য এই ফ্রেশ ফাইলটি কি রেডি করব?`,

      `ভাইয়া, আপনার কথা আমি একদম বুঝতে পেরেছি। তবে একটু ভেবে দেখুন—বাজারে যেসব সস্তা ওষুধ ফুল ক্যাশ অন ডেলিভারিতে বিক্রি হয়, সেগুলোতে থাকে ক্ষতিকর সিলডেনাফিল বা কেমিক্যাল, যা খেলে হার্ট, কিডনি ও লিভারের মারাত্মক ক্ষতি হয়।

আমাদের এটি হাকীম মো: আব্দুল করিম সাহেবের নিজস্ব ফর্মুলায় ল্যাব থেকে তৈরি সম্পূর্ণ প্রাকৃতিক ও পরীক্ষিত ফর্মুলা। আপনার রোগ ও বয়সের উপর ভিত্তি করে ফ্রেশভাবে তৈরি করা হয় বলেই আমরা শুধু ৫০০ টাকা বুকিং নিই, যাতে ওষুধটি অপচয় না হয়। বাকি ২,৩০০ টাকা আপনি পার্সেল হাতে পেয়ে দেখে দেবেন।

আপনার সুস্থতা ও নিরাপত্তার চেয়ে বড় কিছু হতে পারে না ভাইয়া। আপনি কি আপনার ফ্রেশ ফাইলটি প্রস্তুত করতে চান?`
    ];
    const advanceReply = advanceExplanationReplies[Math.floor(Math.random() * advanceExplanationReplies.length)];
    if (senderId) customerMemory.appendChatMessage(senderId, "model", advanceReply, isVoiceMode);
    return advanceReply;
  }

  // ── Instant interceptor for Hesitation, Doubt, Skepticism, or Close-but-Hesitant Customers ──
  // e.g. "kaj hobe to?", "কাজ হবে কি না?", "age onek kheyechi kaj hoyni", "sonsoy a asi", "shondeho hocche", "bhebe dekhi", "biswas hocche na"
  const isHesitationOrDoubtIntent =
    /(?:কাজ\s*হবে|কাজ\s*করবে|কাজ\s*হবে\s*তো|কাজ\s*হবে\s*কি|কাজ\s*হ[য়য়]\s*কি\s*না|কাজ\s*করে\s*না|কাজ\s*হ[য়য়]নি|কাজ\s*হ[য়য়]\s*নাই|কাজ\s*পাব\s*তো|কাজ\s*দেবে\s*তো|ফল\s*পাব\s*তো|উপকার\s*হবে\s*তো|kaj\s*hobe|kaj\s*korbe|kaj\s*hobe\s*to|kaj\s*hobe\s*kina|kaj\s*hoyni|kaj\s*hoy\s*nai)/i.test(customerMessage) ||
    /(?:সংশয়|সংশয়|সংশয়ে|সংশয়ে|সন্দেহ|দ্বিধা|ভয়\s*পাচ্ছি|ভয়\s*পাচ্ছি|খটকা|sonsoy|shongshoy|shondeho|sondeho|didha|khotka)/i.test(customerMessage) ||
    /(?:বিশ্বাস\s*হচ্ছে\s*না|বিশ্বাস\s*হ[য়য়]\s*না|বিশ্বাস\s*করব\s*কেমনে|বিশ্বাস\s*করা\s*যায়|biswas\s*hocche\s*na|biswas\s*hoy\s*na|biswas\s*korbo\s*kemne)/i.test(customerMessage) ||
    /(?:আগে|ager?|onek|অনেক|jaygay|জায়গায়|জায়গায়).*(?:খ[েখ][যয়য়]?[়]?ে?[ছস][িীে]|খে|kheye|khaisi|khese|ওষুধ|ঔষধ|osud).*(?:কাজ|ফল|kaj)/i.test(customerMessage) ||
    /(?:নকল\s*হবে|নকল\s*নাকি|নকল|nokol|প্রতারণা|ধোঁকা|ধোকা|আসল\s*তো|foul\s*naki|fake\s*naki|fake\s*hobe|fake|dhoka)/i.test(customerMessage) ||
    /(?:ভেবে\s*দেখি|ভেবে\s*দেখব|ভেবে\s*জানাব|চিন্তা\s*করে\s*জানাব|চিন্তা\s*করি|bhebe\s*dekhi|bhebe\s*dekhbo|bhebe\s*janabo|chinta\s*kore\s*janabo|chinta\s*kori)/i.test(trimmedClean) ||
    /(?:নিশ্চয়তা|নিশ্চয়তা|গ্যারান্টি|guarantee\s*ki|garanti\s*ase)/i.test(customerMessage);

  if (isHesitationOrDoubtIntent) {
    const hesitationReplies = [
      `ভাইয়া, আমার মনে হয় আপনি এখনো অনেক দ্বিধা বা সংশয়ে আছেন। দেখুন ভাইয়া, অতীতে হয়তো অনলাইনে ভুল বা নিম্নমানের ওষুধ নিয়ে প্রতারিত হয়েছেন বা কাঙ্ক্ষিত ফল পাননি, তাই এমন সংশয় হওয়াটা খুবই স্বাভাবিক।

তবে আপনার মনের সব সংশয় দূর করতে আপনি সরাসরি আমাদের প্রধান হাকীমের সাথে ফোনে কথা বলতে পারেন:
📞 হাকীম সরাসরি হেল্পলাইন: 01870-023804

আপনি সরাসরি এই নম্বরে কল দিন। হাকীম সাহেব নিজে আপনার সমস্যা, বয়স ও শারীরিক দুর্বলতার লক্ষণগুলো বিস্তারিত মনোযোগ দিয়ে শুনবেন এবং একদম আপনার শরীরের ঘাটতি অনুযায়ী নিজ হাতে ল্যাব থেকে পাহাড়ি খাঁটি ভেষজ উপাদান দিয়ে সেরা একটি বিশেষ ওষুধ প্রস্তুত করে দেবেন।

আর পার্সেল কুরিয়ার ম্যানের সামনে খুলে নিশ্চিত হয়ে দেখে নেওয়ার সুযোগ তো রয়েছেই—এতে আপনার ১ টাকারও কোনো ঝুঁকি নেই। আপনি কি সরাসরি হাকীম সাহেবের সাথে ফোনে কথা বলতে চান ভাইয়া?`,

      `জি ভাইয়া, আমার মনে হচ্ছে আপনি ওষুধটি নেওয়ার খুব কাছাকাছি এসেও কোনো কারণে মনে খটকা বা সংশয় রাখছেন। আসলে বাজারে যেসব সস্তা ও ক্ষতিকর কেমিক্যাল বা ওয়ান-টাইম ওষুধ বিক্রি হয়, সেগুলো সাময়িক উত্তেজনা দিলেও ভেতরে নার্ভ, হার্ট ও কিডনির মারাত্মক ক্ষতি করে।

আমাদের হাকীম মো: আব্দুল করিম সাহেব স্বাস্থ্য ও পরিবার কল্যাণ মন্ত্রণালয় অনুমোদিত ক্যাটাগরি-এ রেজিস্টার্ড হাকীম, যিনি দীর্ঘ ১৮ বছর ধরে বান্দরবান আলীকদমে সুনামের সাথে রোগীদের খাঁটি ভেষজ চিকিৎসা সেবা দিচ্ছেন।

আপনার যদি সামান্যতম সন্দেহও থাকে, কোনো সংকোচ না করে সরাসরি হাকীম সাহেবের সাথে ফোনে কথা বলুন:
📞 সরাসরি কল দিন: 01870-023804

হাকীম সাহেব আপনার সম্পূর্ণ শারীরিক অবস্থা পুঙ্খানুপুঙ্খ শুনে আপনার জন্য ফ্রেশ ব্যাচে শতভাগ খাঁটি ও নিরাপদ ফর্মুলা নিজ হাতে তৈরি করে দেবেন। আর পার্সেল হাতে পেয়ে খুলে দেখে নেওয়ার পূর্ণ নিশ্চয়তা রয়েছে। ভাইয়া, আপনি কি হাকীম সাহেবের সাথে একটু কথা বলে নিশ্চিত হতে চান?`,

      `ভাইয়া, সত্যি বলতে আমার মনে হয় আপনি মনে মনে অনেক সংশয়ে আছেন যে ওষুধটা আসলেই কাজ করবে কি না। আপনার জায়গায় আমি থাকলেও হয়তো না দেখে একটু ভাবতাম।

কিন্তু ভাইয়া, পুরুষের এই ধরণের গোপন সমস্যা যত পুষে রাখবেন, ভেতরের নার্ভগুলো তত দুর্বল ও নিস্তেজ হয়ে পড়ে। আপনার সুস্থতা ও মানসিক শান্তির জন্য সবচেয়ে ভালো হয় যদি আপনি সরাসরি আমাদের প্রধান হাকীমের সাথে ফোনে কথা বলেন:
📞 হাকীম সরাসরি নম্বর: 01870-023804

আপনি এই নম্বরে একটি সরাসরি কল দিন। হাকীম সাহেব নিজে আপনার কথা বিস্তারিত শুনবেন এবং কোনো কোম্পানির রেডিমেড বা স্টক করা ওষুধ নয়—একদম আপনার শরীরের বর্তমান কন্ডিশন অনুযায়ী পাহাড়ি দুর্লভ উপাদান দিয়ে নিজ হাতে বিশেষ ওষুধটি বানিয়ে দেবেন।

কুরিয়ারের সামনে পার্সেল খুলে চেক করার পর বাকি টাকা দেওয়ার সুযোগ আছে, তাই কোনো ঝুঁকির সুযোগ নেই। আপনি কি একবার সরাসরি হাকীম সাহেবের সাথে কথা বলে পরামর্শ নেবেন ভাইয়া?`
    ];
    const hesitationReply = hesitationReplies[Math.floor(Math.random() * hesitationReplies.length)];
    if (senderId) customerMemory.appendChatMessage(senderId, "model", hesitationReply, isVoiceMode);
    return hesitationReply;
  }

  // ── GUARD: Negative order intent / refusal / cancellation ──────────────────
  // e.g. "order korbo na", "ami order debo na", "nibo na", "lagbe na", "bad den"
  const isNegativeOrderIntent =
    /(?:order|অর্ডার|nite|নিতে|kinbo|কিনবো|ঔষধ|ওষুধ).*(?:korbo\s*na|করব\s*না|করবো\s*না|debo\s*na|দেবো\s*না|dibo\s*na|দিব\s*না|kori\s*na|lagbe\s*na|লাগবে\s*না|chai\s*na|চাই\s*না)/i.test(customerMessage) ||
    /(?:na\s*ami|না\s*আমি).*(?:order|অর্ডার|nibo|নিবো|kinbo|কিনবো).*(?:na|না)/i.test(customerMessage) ||
    /(?:ami\s*)?(?:nibo\s*na|নিব\s*না|নিবো\s*না|kinbo\s*na|কিনব\s*না|কিনবো\s*না|lagbe\s*na|লাগবে\s*না)/i.test(customerMessage) ||
    /^(?:na|না|thak|থাক|lagbe\s*na|লাগবে\s*না|cancel|ক্যান্সেল|বাদ\s*দেন|bad\s*den)$/i.test(trimmedClean);

  if (isNegativeOrderIntent) {
    const negativeReplies = [
      `জি ভাইয়া, কোনো সমস্যা নেই। ওষুধ নেওয়া বা না নেওয়া সম্পূর্ণ আপনার ব্যক্তিগত সিদ্ধান্ত। তবে ভাইয়া, একজন শুভাকাঙ্ক্ষী হিসেবে শুধু এতটুকু বলব—গোপন শারীরিক সমস্যা যত দিন পুষে রাখবেন, ভেতরের নার্ভ ও টেস্টোস্টেরন হরমোন তত দুর্বল হয়ে পড়ে, যা পরবর্তীতে চিকিৎসা করা আরও কঠিন করে তোলে। আপনি যখনই সঠিক ও খাঁটি চিকিৎসায় সুস্থ হতে চাইবেন, আমরা আপনার পাশে আছি। ভালো থাকবেন ভাইয়া।`,
      `ঠিক আছে ভাইয়া, কোনো অসুবিধা নেই। আপনার সিদ্ধান্তই চূড়ান্ত। তবে এই ধরনের সমস্যা ফেলে রাখলে দিনে দিনে জটিলতা আরও বাড়ে। ভবিষ্যতে যেকোনো পরামর্শের জন্য নির্দ্বিধায় নক দিতে পারেন। আল্লাহ আপনাকে সুস্থ রাখুন।`,
      `জি ভাইয়া, কোনো চাপ নেই। তবে সময়মতো সঠিক প্রাকৃতিক চিকিৎসা নিলে এই সমস্যাগুলো থেকে পুরোপুরি মুক্তি পাওয়া সম্ভব। আপনি সুস্থ থাকুন, এই কামনাই করি। পরবর্তীতে প্রয়োজন হলে জানাবেন ভাইয়া।`
    ];
    const negReply = negativeReplies[Math.floor(Math.random() * negativeReplies.length)];
    if (senderId) customerMemory.appendChatMessage(senderId, "model", negReply, isVoiceMode);
    return negReply;
  }

  // ── 1. ORDER PROCESS / PURCHASE INTENT INTERCEPTOR ─────────────────────────
  const textForOrderCheck = (customerMessage || "").toLowerCase().replace(/\s+/g, "");
  const hasNegativeWords = /(?:na\b|না|korbo\s*na|করব\s*না|করবো\s*না|nibo\s*na|নিব\s*না|kinbo\s*na|কিনব\s*না|dibo\s*na|দিব\s*না|debo\s*na|দেবো\s*না|parbo\s*na|পারব\s*না|lagbe\s*na|লাগবে\s*না|chara|ছাড়া|ছাড়াই|cod|ক্যাশ\s*অন|ক্যান্সেল|cancel|bad\s*den|বাদ\s*দেন|chai\s*na|চাই\s*না)/i.test(customerMessage);

  const isOrderProcessQuestion = !hasNegativeWords && (
    /(?:order|অর্ডার).*(?:kivabe|কিভাবে|kibhabe|kiভাবে|কীভাবে|process|prosess|নিয়ম|পদ্ধতি)/i.test(customerMessage) ||
    /(?:kivabe|কিভাবে|কীভাবে|kibhabe).*(?:order|অর্ডার|kinbo|কিনব|nibo|নিবো|pabo|পাব)/i.test(customerMessage) ||
    /অর্ডারকিভাবে|orderকিভাবে|কিভাবেঅর্ডার/.test(textForOrderCheck) ||
    /order\s*form|অর্ডার\s*ফর্ম/i.test(customerMessage) ||
    /(?:order|অর্ডার)\s*(?:korte\s*chai|করতে\s*চাই|korte\s*chassi|করতে\s*চাচ্ছি|dite\s*chai|দিতে\s*চাই|debo|দিব|korbo|করব)/i.test(customerMessage) ||
    /(?:ami|আমি|amar|আমার)\s+(?:order|অর্ডার)\s*(?:korte\s*chai|করতে\s*চাই|dite\s*chai|দিতে\s*চাই|korbo|করব|confirm|কনফার্ম)/i.test(customerMessage) ||
    /order\s*korte\s*(?:chai|chacchi|chassi)|অর্ডার\s*করতে\s*চাই/i.test(customerMessage) ||
    /ar\s*akta\s*order|আরেকটা?\s*অর্ডার|আর\s*একটা?\s*অর্ডার/i.test(customerMessage) ||
    /(?:nite|নিতে|kinbo|কিনবো|nibo|নিবো)\s*(?:chai|চাই|chacchi|চাচ্ছি)/i.test(customerMessage)
  );

  if (isOrderProcessQuestion) {
    const _prof = senderId ? customerMemory.getCustomerProfile(senderId) : null;
    const _chatLog = _prof ? (_prof.chatLog || []) : [];
    const _userMsgCount = _chatLog.filter(m => m.role === 'user').length;
    const _hasHealthData = Boolean(_prof && (
      _prof.age ||
      (_prof.symptoms && _prof.symptoms.length > 0) ||
      _prof.duration ||
      _prof.maritalStatus ||
      _prof.timing ||
      _prof.erectionQuality ||
      _prof.semenQuality
    ));

    // GUARD: If early message and health data not yet collected, ALWAYS do consultation first!
    if (!_hasHealthData && _userMsgCount <= 4) {
      const sName = (_prof && _prof.name && _prof.name !== 'Customer' && _prof.name !== 'কাস্টমার') ? _prof.name + ' ভাইয়া' : 'ভাইয়া';
      const earlyConsultReplies = [
        `জি ${sName}, আলহামদুলিল্লাহ — আপনার আগ্রহ দেখে সত্যিই ভালো লাগছে! তবে ভাইয়া, আমাদের ওষুধ কোনো সাধারণ বাজারের রেডিমেড ওষুধ নয় — এটি প্রতিটি রোগীর শারীরিক অবস্থা ও সমস্যার ধরন অনুযায়ী বিশেষভাবে প্রস্তুত করা হয়। তাই আগে আপনার সমস্যা কি কি সবকিছু বিস্তারিত জানা জরুরি, তারপর আপনি নিশ্চিত হয়ে অর্ডার করতে পারবেন।\n\nভাইয়া, আপনার মূল সমস্যাটা ঠিক কী হচ্ছে একটু খুলে বলবেন কি? যেমন: দ্রুত বীর্যপাত বা টাইমিং কম, ইরেকশন বা শক্ত না হওয়া, নাকি শারীরিক দুর্বলতা? এবং আপনার বয়স কত?`,
        `আলহামদুলিল্লাহ ${sName}, আপনি অর্ডার করতে চাচ্ছেন জেনে খুশি হলাম! তবে ভাইয়া, আমাদের মূল লক্ষ্য আপনার স্থায়ী সুস্থতা। বাজার চলতি ওষুধের মতো না দিয়ে আমরা রোগীর শারীরিক ঘাটতি বিশ্লেষণ করে খাঁটি পাহাড়ি ভেষজ উপাদান দিয়ে ওষুধ তৈরি করি। তাই অর্ডার করার পূর্বে আপনার সম্পর্কে কিছুটা জানা দরকার।\n\nভাইয়া, আপনার বয়স কত এবং মূল সমস্যাটা ঠিক কী হচ্ছে একটু খুলে বলবেন? (যেমন: দ্রুত বীর্যপাত, লিঙ্গের শিথিলতা, নাকি শারীরিক দুর্বলতা?) সমস্যাটি কতদিন ধরে?`,
        `জি ${sName}, অর্ডার করতে অবশ্যই পারবেন ইনশাআল্লাহ। তবে সরাসরি অর্ডার নেওয়ার আগে আপনার শারীরিক সমস্যাগুলো জেনে সঠিক ওষুধ নির্ধারণ করা আমাদের দায়িত্ব। কারণ সঠিক রোগ নির্ণয় ছাড়া ওষুধ দিলে কাঙ্ক্ষিত ফল পাওয়া যায় না।\n\nভাইয়া, একটু বলবেন কি—আপনার মূল সমস্যাটা ঠিক কী এবং বয়স কত? সবকিছু জেনে-শুনে আপনার জন্য সেরা ওষুধটি নির্ধারণ করে দেব ইনশাআল্লাহ।`
      ];
      const earlyReply = earlyConsultReplies[Math.floor(Math.random() * earlyConsultReplies.length)];
      if (senderId) customerMemory.appendChatMessage(senderId, "model", earlyReply, isVoiceMode);
      console.log('[ORDER_INTERCEPTOR] Early order redirected to consultation for sender:', senderId);
      return earlyReply;
    }

    // Consultation completed -> Send official order form:
    const orderReply = `জি ভাইয়া, আপনার অর্ডারটি কনফার্ম করতে নিচের তথ্যগুলো পূরণ করে পাঠিয়ে দিন:\n\nনাম:\nফোন নম্বর:\nজেলা:\nথানা/উপজেলা:\nবিস্তারিত ঠিকানা:\n\nকস্তুরী পাউডার (১ মাসের ফুল কোর্স, ২৫০ গ্রাম) অফার মূল্য ২,৮০০ টাকা। পার্সেল বুকিং নিশ্চিত করতে ৫০০ টাকা অগ্রিম আমাদের অফিসিয়াল বিকাশ হেল্পলাইন 01870-023804 নম্বরে পাঠিয়ে লাস্ট ২/৩ ডিজিট জানাবেন। বাকি ২,৩০০ টাকা পার্সেল হাতে পেয়ে দেখে ডেলিভারি ম্যানকে পরিশোধ করবেন।`;
    if (senderId) customerMemory.appendChatMessage(senderId, "model", orderReply, isVoiceMode);
    return orderReply;
  }

  // ── 2. ADDRESS / CHAMBER / LOCATION INTERCEPTOR ───────────────────────────
  const isAddressQuestion =
    /(?:apnar|আপনার|tomar|তোমার).*(?:basa|bari|বাড়ি|বাসা|address|ঠিকানা|dokan|দোকান|chamber|চেম্বার|office|অফিস|thakena|থাকেন|kothay|কোথায়|kothai)/i.test(customerMessage) ||
    /(?:dokan|দোকান|shop|chamber|চেম্বার).*(?:kothay|কোথায়|kothai|ache|আছে|address|ঠিকানা)/i.test(customerMessage) ||
    /(?:kothay|কোথায়|kothai).*(?:achen|আছেন|thakena|থাকেন|pabo|পাব|pawa|পাওয়া)/i.test(customerMessage) ||
    /(?:বাসা|বাড়ি|চেম্বার|দোকান|chamber)\s*(?:কোথায়|কই|kothay|kothai)/i.test(trimmedClean);

  if (isAddressQuestion) {
    const addressReply = `জি ভাইয়া, আমাদের চেম্বার ও দোকানের ঠিকানা:

জনতা ইউনানী চিকিৎসালয় ও ভেষজ ভান্ডার
দোকান নং-৩৩ (৩য় তলা)
আলীকদম কাঁচাবাজার, আলীকদম, বান্দরবান পার্বত্য জেলা।

হেল্পলাইন: 01870-023804 (বিকাশ)
সারা দেশে কুরিয়ারে হোম ডেলিভারি দেওয়া হয়।`;
    if (senderId) customerMemory.appendChatMessage(senderId, "model", addressReply, isVoiceMode);
    return addressReply;
  }

  // ── 3. PRICE / DAM INTERCEPTOR ────────────────────────────────────────────
  const isPriceQuery =
    /(?:dam|দাম|price|প্রাইস|koto|কত|taka|টাকা)\s*(?:koto|কত|hobe|হবে|bhai|ভাই|plz)?/i.test(trimmedClean) &&
    /(?:dam|দাম|price|প্রাইস|koto|কত|taka|টাকা|খরচ|khoroch)/i.test(trimmedClean);

  if (isPriceQuery && !/(?:samprotik|somosya|সমস্যা|durbol|দুর্বল)/i.test(trimmedClean)) {
    if (/(?:joubon|যৌবন|raja|রাজা)/i.test(trimmedClean)) {
      const pReply = "জি ভাইয়া, 'যৌবনের রাজা' (২০০ গ্রাম) এর রেগুলার মূল্য ৩,০০০ টাকা। কুরিয়ারে ক্যাশ অন ডেলিভারিতে সারাদেশে পাঠানো হয়। ভাইয়া, আপনার শারীরিক কোন সমস্যার জন্য জানতে চাচ্ছেন? বললে আরও ভালো গাইড করতে পারব।";
      if (senderId) customerMemory.appendChatMessage(senderId, "model", pReply, isVoiceMode);
      return pReply;
    }
    if (/(?:baji|বাজী|halua|হালুয়া)/i.test(trimmedClean)) {
      const pReply = "জি ভাইয়া, 'বাজীকরণ হালুয়া' (৩৫০ গ্রাম) এর মূল্য ২,৫০০ টাকা। এটি খেতে সুস্বাদু এবং পেনাইল নার্ভ মজবুত করে। ভাইয়া, আপনার কি নার্ভ দুর্বলতার সমস্যা আছে?";
      if (senderId) customerMemory.appendChatMessage(senderId, "model", pReply, isVoiceMode);
      return pReply;
    }

    const _prof = senderId ? customerMemory.getCustomerProfile(senderId) : null;
    const _hasHealthData = Boolean(_prof && (
      _prof.age ||
      (_prof.symptoms && _prof.symptoms.length > 0) ||
      _prof.duration ||
      _prof.timing ||
      _prof.erectionQuality
    ));

    if (_hasHealthData) {
      const pReply = `জি ভাইয়া, আমাদের ২৫০ গ্রামের ১ মাসের ফুল কোর্স খাঁটি 'কস্তুরী পাউডার'-এর বর্তমান অফার মূল্য মাত্র ২,৮০০ টাকা। সারা দেশে কুরিয়ারে ক্যাশ অন ডেলিভারিতে হোম ডেলিভারি দেওয়া হয়। আপনার সমস্যা অনুযায়ী এটি নিয়মিত ১ মাস সেবনে স্থায়ী ফলাফল পাবেন ইনশাআল্লাহ। আপনি কি অর্ডারটি কনফার্ম করতে চাচ্ছেন ভাইয়া?`;
      if (senderId) customerMemory.appendChatMessage(senderId, "model", pReply, isVoiceMode);
      return pReply;
    }

    // Health data NOT yet collected: State price and ask problem assessment questions WITHOUT 500 advance!
    const priceConsultReplies = [
      `জি ভাইয়া, আমাদের ১ মাসের ফুল কোর্স (২৫০ গ্রাম) খাঁটি 'কস্তুরী পাউডার'-এর বর্তমান অফার মূল্য মাত্র ২,৮০০ টাকা। সারা দেশে কুরিয়ার সার্ভিসে ক্যাশ অন ডেলিভারিতে পাঠানো হয়।\n\nতবে ভাইয়া, ওষুধ নেওয়ার আগে আপনার শারীরিক অবস্থা অনুযায়ী এটি আপনার জন্য সঠিক কিনা তা জানা অত্যন্ত জরুরি। ভাইয়া, আপনার মূল সমস্যাটা ঠিক কী হচ্ছে একটু খুলে বলবেন কি? যেমন: দ্রুত বীর্যপাত বা টাইমিং কম, ইরেকশন বা শক্ত না হওয়া, নাকি শারীরিক দুর্বলতা? এবং আপনার বয়স কত?`,
      `জি ভাইয়া, ২৫০ গ্রামের ফুল কোর্সের কস্তুরী পাউডারের অফার মূল্য মাত্র ২,৮০০ টাকা।\n\nভাইয়া, আপনি ঠিক কোন শারীরিক সমস্যার জন্য ওষুধটি নিতে চাচ্ছেন একটু জানাবেন কি? (যেমন: দ্রুত বীর্যপাত, পাতলা বীর্য, নাকি লিঙ্গের শিথিলতা?) আপনার সমস্যা ও বয়স জানালে আপনাকে সবচেয়ে সঠিক ও কার্যকর সমাধান দিতে পারব ইনশাআল্লাহ।`,
      `জি ভাইয়া, আমাদের ১ মাসের ফুল কোর্সের দাম মাত্র ২,৮০০ টাকা। সারাদেশে ক্যাশ অন ডেলিভারি সুবিধা রয়েছে।\n\nতবে ভাইয়া, সঠিক রোগ নির্ণয় ছাড়া ওষুধ দিলে কাঙ্ক্ষিত ফল পাওয়া যায় না। আপনার মূল সমস্যাটা ঠিক কী এবং কতদিন ধরে ফেস করছেন? আপনার বয়স কত ভাইয়া?`
    ];
    const pReply = priceConsultReplies[Math.floor(Math.random() * priceConsultReplies.length)];
    if (senderId) customerMemory.appendChatMessage(senderId, "model", pReply, isVoiceMode);
    return pReply;
  }

  // ── 4. USAGE / SEBON BIDHI / DOSAGE INTERCEPTOR ───────────────────────────
  const isUsageQuery = /(?:khawar|খাওয়ার|sebon|সেবন|khabo|খাব|kivabe\s*khabo|কিভাবে\s*খাব|niyom|নিয়ম|dosage|ডোজ)\s*(?:ki|কী|kivabe|কীভাবে|bolen|বলেন)?/i.test(trimmedClean) &&
    /(?:khawa|খাওয়া|sebon|সেবন|khabo|খাব|niyom|নিয়ম)/i.test(trimmedClean);

  if (isUsageQuery) {
    const usageReply = `জি ভাইয়া, সেবনবিধি খুবই সহজ:

প্রতিদিন সকালে খালি পেটে ১ চামচ কস্তুরী পাউডার হালকা কুসুম গরম দুধ অথবা পানিতে মিশিয়ে সেবন করবেন। 

নিয়মিত সেবনে ৩ থেকে ৫ দিনেই পরিবর্তন বোঝা যায় এবং ইনশাআল্লাহ স্থায়ী ফলাফল পাওয়া যায়।`;
    if (senderId) customerMemory.appendChatMessage(senderId, "model", usageReply, isVoiceMode);
    return usageReply;
  }

  // ── 5. INGREDIENTS INTERCEPTOR ────────────────────────────────────────────
  const isIngredientsQuery = /(?:upadan|উপাদান|ki\s*diye|কী\s*দিয়ে|ingredients|ki\s*ki\s*ache|কী\s*কী\s*আছে)/i.test(trimmedClean) &&
    /(?:upadan|উপাদান|toiri|তৈরি|উপাদানগুলো|বানানো)/i.test(trimmedClean);

  if (isIngredientsQuery) {
    const ingReply = `জি ভাইয়া, আমাদের কস্তুরী পাউডারে রয়েছে ৬টি দুর্লভ ও খাঁটি প্রাকৃতিক উপাদান:

১) খাঁটি মৃগনাভি কস্তুরী
২) হিমালয়ান বন্য শিলাজিৎ
৩) আসল কোরিয়ান রেড জিনসেং
৪) কাশ্মীরি জাফরান
৫) অশ্বগন্ধা ও শ্বেত মুসলি
৬) বিশেষ ভেষজ মিশ্রণ (তালমাখনা, সর্পগন্ধা ও জয়ফল-জয়ত্রী)।

এটি শতভাগ প্রাকৃতিক এবং কোনো রাসায়নিক বা পার্শ্বপ্রতিক্রিয়া নেই ভাইয়া।`;
    if (senderId) customerMemory.appendChatMessage(senderId, "model", ingReply, isVoiceMode);
    return ingReply;
  }

  // ── 6. SIDE EFFECTS INTERCEPTOR ───────────────────────────────────────────
  const isSideEffectsQuery = /(?:parsho|পার্শ্ব|side\s*effect|ক্ষতি|khoti|problem\s*hobe|সমস্যা\s*হবে|side\s*effects)/i.test(trimmedClean);
  if (isSideEffectsQuery && !/(?:amar|আমার|problem|সমস্যা\s*আছে)/i.test(trimmedClean)) {
    const seReply = "জি না ভাইয়া, আলহামদুলিল্লাহ কোনো প্রকার পার্শ্বপ্রতিক্রিয়া নেই। এটি সম্পূর্ণ প্রাকৃতিক ও ভেষজ উপাদানে স্বাস্থ্য মন্ত্রণালয়ের নিবন্ধিত চিকিৎসকের ফর্মুলায় তৈরি ১০০% কেমিক্যালমুক্ত চিকিৎসা।";
    if (senderId) customerMemory.appendChatMessage(senderId, "model", seReply, isVoiceMode);
    return seReply;
  }

  // ── 7. AVAILABLE PRODUCTS CATALOG INTERCEPTOR ──────────────────────────────
  const isCatalogQuery = /(?:ki\s*ki|কি\s*কি|কী\s*কী)\s*(?:product|item|osudh|ওষুধ|course|কোর্স|আছে|paoya\s*jay|পাওয়া\s*যায়)/i.test(trimmedClean);
  if (isCatalogQuery) {
    const catReply = `জি ভাইয়া, আমাদের প্রধান ৩টি বিশেষ প্রাকৃতিক কোর্স রয়েছে:

১. কস্তুরী পাউডার (১ মাসের ফুল কোর্স, ২৫০ গ্রাম) — অফার মূল্য ২,৮০০ টাকা (দুর্বলতা দূর ও স্থায়ী শক্তি বৃদ্ধি)।
২. যৌবনের রাজা (২০০ গ্রাম) — মূল্য ৩,০০০ টাকা (তীব্র স্ট্যামিনা ও হরমোন বৃদ্ধি)।
৩. বাজীকরণ হালুয়া (৩৫০ গ্রাম) — মূল্য ২,৫০০ টাকা (নার্ভ মজবুত ও সুস্বাদু হালুয়া)।

আপনার শারীরিক অবস্থা অনুযায়ী কোনটি প্রয়োজন ভাইয়া?`;
    if (senderId) customerMemory.appendChatMessage(senderId, "model", catReply, isVoiceMode);
    return catReply;
  }

  // ── 8. CLINICAL HEALTH SYMPTOMS CONSULTATION TRIGGER ──────────────────────
  // ONLY trigger consultation if customer is explicitly describing personal health symptoms:
  const isHealthSymptomComplaint =
    /(?:বীর্য\s*পাতলা|birjo\s*patla|দ্রুত\s*বীর্যপাত|druto\s*birjopat|টাইমিং\s*কম|timing\s*kom|নার্ভ\s*দুর্বল|শক্ত\s*হয়\s*না|নরম\s*হয়ে\s*যায়|আঠালো\s*পানি|কামরস|স্বপ্নদোষ|হস্তমৈথুন|লিঙ্গ\s*ছোট|উত্থান\s*হয়\s*না|সহবাসে\s*দুর্বল)/i.test(trimmedClean);

  if (isHealthSymptomComplaint) {
    const consultReply = getClinicalConsultationReply(
      senderId || '',
      senderName || '',
      customerMessage,
      isVoiceMode
    );
    if (consultReply) {
      if (senderId) customerMemory.appendChatMessage(senderId, 'model', consultReply, isVoiceMode);
      console.log('[CONSULTATION_FLOW] Reply (' + consultReply.length + ' chars): "' + consultReply.slice(0, 60) + '..."');
      return consultReply;
    }
  }
  // ── END CLINICAL CONSULTATION FLOW ────────────────────────────────────────

  // 8. Price and Order advance rule
  // [BYPASSED FOR DYNAMIC AI DOCTOR REPLIES]: isPriceQuery

  // Dedicated Nagad Inquiry -> Clarify ONLY bKash is available
  const isNagadSpecificQuery = /(?:নগদ|nagad)/i.test(trimmedClean) && 
    /(?:number|namber|nombor|নম্বর|নাম্বার|phone|টাকা|পাঠাব|পাঠাতে|দিব|দিতে|হবে|আছে|হবে\s*কি|parbo|deya\s*jabe|account|একাউন্ট|নাই|নেই|দাও|দেন|দিন)/i.test(trimmedClean);

  if (isNagadSpecificQuery) {
    if (isVoiceMode) {
      const voiceNagadReply = "জি ভাইয়া, আমাদের বর্তমানে কোনো নগদ একাউন্ট চালু নেই, শুধুমাত্র অফিসিয়াল বিকাশ নম্বর চালু রয়েছে। বুকিং কনফার্ম করতে পাঁচশত টাকা অগ্রিম আমাদের বিকাশ নম্বরে পাঠাতে হয়। আমাদের বিকাশ নম্বর হলো শূন্য এক আট সাত শূন্য, শূন্য দুই তিন আট শূন্য চার। আর বাকি দুই হাজার তিনশত টাকা কুরিয়ারে পার্সেল হাতে পেয়ে দেখে পরিশোধ করবেন ভাইয়া।";
      if (typeof senderId !== "undefined" && senderId) customerMemory.appendChatMessage(senderId, "model", voiceNagadReply, true);
      return voiceNagadReply;
    }
    const textNagadReply = "জি ভাইয়া, আমাদের বর্তমানে কোনো নগদ একাউন্ট চালু নেই, শুধুমাত্র অফিসিয়াল বিকাশ পার্সোনাল নম্বর চালু রয়েছে।\n\nপার্সেল বুকিং নিশ্চিত করতে ৫০০ টাকা অগ্রিম বিকাশেই পাঠাতে হয়:\n📱 বিকাশ পার্সোনাল: 01870-023804\n\nবাকি ২,৩০০ টাকা কুরিয়ারে পার্সেল হাতে পেয়ে ক্যাশ অন ডেলিভারিতে দেখে পরিশোধ করবেন ভাইয়া।";
    if (typeof senderId !== "undefined" && senderId) customerMemory.appendChatMessage(senderId, "model", textNagadReply, false);
    return textNagadReply;
  }

  // Dedicated Phone Number / Helpline / Call / Contact Query
  const isHelplineOrPhoneQuery = 
    /(?:number|namber|numbor|nombor|নম্বর|নাম্বার|ফোন|মোবাইল|phone|mobile|হেল্পলাইন|helpline|হটলাইন|hotline)\s*(?:den|din|dite|দাও|দেন|দিন|পাঠান|দিতে|কত|koto|plz|please|lagbe|হবে|চাই|পাব|হবে\s*কি)?/i.test(trimmedClean) ||
    /(?:kotha\s*bolbo|কথা\s*বলব|কথা\s*বলতে|যোগাযোগ|jogajog|call\s*korbo|কল\s*করব|কল\s*দিতে).*(?:number|নাম্বার|নম্বর|phone|ফোন|দিন|দেন|চাই|কিসে)/i.test(trimmedClean) ||
    /(?:bkash|নগদ|nagad|বিকাশ).*(?:number|নাম্বার|নম্বর|টাকা|পাঠাব)/i.test(trimmedClean) ||
    /(?:নাম্বার|নম্বর|phone|number)\s*(?:টা|টি)?\s*(?:দেন|দিন|দাও|বলেন|বলুন)/i.test(trimmedClean);

  if (isHelplineOrPhoneQuery) {
    const textNumberReply = `জি ভাইয়া, আমাদের অফিসিয়াল হেল্পলাইন ও সরাসরি যোগাযোগের নম্বর:\n📞 01870-023804 (বিকাশ)\n\nআপনি সরাসরি কল দিয়ে কথা বলতে পারেন অথবা যেকোনো প্রয়োজনে যোগাযোগ করতে পারেন ভাইয়া।`;
    if (typeof senderId !== "undefined" && senderId) customerMemory.appendChatMessage(senderId, "model", textNumberReply, isVoiceMode);
    return textNumberReply;
  }

  // 9. Chamber / Direct Visit / Where to meet (চেম্বার কোথায় / আপনাদের সাথে কীভাবে দেখা করব / সরাসরি এসে নিতে পারব কি)
  // [BYPASSED FOR DYNAMIC AI DOCTOR REPLIES]: isMeetOrChamber

  // 10. Available products inquiry (আপনাদের এখানে কী কী পাওয়া যায় / কী কী ওষুধ আছে)
  // [BYPASSED FOR DYNAMIC AI DOCTOR REPLIES]: isAvailableProducts

  // 11. Customer Reviews / Social Proof / Anyone took it before? (আগে কেউ নিয়েছে? কোনো রিভিউ আছে?)
  // [BYPASSED FOR DYNAMIC AI DOCTOR REPLIES]: isReviewInquiry

  // Detect if this is a personal/greeting query — skip product context for these
  const qLowerCheck = (customerMessage || "").toLowerCase();
  const isPersonalQuery = /\b(name|naam|nam|নাম|jano|jaano|জানো|আমার নাম|amar naam|amar name|kemon acho|kemon achen|কেমন আছ|কেমন আছেন|hello|hi\b|হ্যালো|হাই|salam|সালাম|assalam|ভালো আছ|valo acho)/.test(qLowerCheck);

  const { context: productContext, matched } = isPersonalQuery
    ? { context: "", matched: null }
    : getLiveProductInfo(customerMessage, senderId, recentHistory, pageName);

  const masterPath = path.join(process.cwd(), "data", "medicine_master_complete_db.json");
  const editsPath = path.join(process.cwd(), "data", "custom_user_edits.json");
  const kbPath = path.join(process.cwd(), "data", "knowledge_base.txt");
  const master = fs.existsSync(masterPath) ? JSON.parse(fs.readFileSync(masterPath, "utf-8")) : [];
  const edits = fs.existsSync(editsPath) ? JSON.parse(fs.readFileSync(editsPath, "utf-8")) : {};
  const masterKB = fs.existsSync(kbPath) ? fs.readFileSync(kbPath, "utf-8") : "";
  const catalogSummary = buildStoreCatalog(master, edits);
  const detectedLang = detectLanguage(customerMessage);
  const _custProf = senderId ? customerMemory.getCustomerProfile(senderId) : null;
  const geoSocialProof = getGeoSocialProofFromProfile(_custProf?.district, _custProf?.thana, customerMessage);
  const timeAwareStatus = getTimeAwareGreeting();
  const customerMemoryPrompt = senderId ? customerMemory.buildCustomerMemoryPrompt(senderId, senderName) : "";

  // Supplement recent history from permanent memory if history array is sparse
  let effectiveHistory = (recentHistory && recentHistory.length > 0) ? [...recentHistory] : [];
  if (effectiveHistory.length <= 1 && senderId) {
    const memHistory = customerMemory.getRecentChatHistory(senderId, 12);
    if (memHistory.length > effectiveHistory.length) {
      effectiveHistory = memHistory;
    }
  }

  const voiceModeInstruction = (isVoiceMode || isVoiceRequested(customerMessage))
    ? `\n🎙️ CRITICAL SPOKEN VOICE MODE INSTRUCTION:
THIS REPLY WILL BE SPOKEN DIRECTLY TO THE CUSTOMER AS A REAL DOCTOR VOICE NOTE (ভয়েস মেসেজ)!
- ABSOLUTE STRICT BAN: NEVER say "এখানে ভয়েস পাঠানোর সুবিধা নেই", "আমি টেক্সটে বুঝিয়ে বলছি", "লিখে দিচ্ছি", "মেসেজে বলছি", or "অডিও পাঠাতে পারি না"! Saying this is a fatal contradiction because you ARE speaking directly via voice note!
- You are directly talking to the patient with your real human voice as Hakim Md. Abdul Karim.
- Answer what the customer asked directly in 2-3 warm, caring, natural spoken sentences.\n`
    : "";

  const systemInstruction = `You are an elite Senior Hakim and Certified Medical Researcher representing ${pageName} in Bangladesh.

══════════════════════════════════════════════════════════
THE ABSOLUTE SUPREME DIRECTIVE — ANSWER ONLY WHAT WAS ASKED (শুধু কাস্টমারের প্রশ্নের সরাসরি উত্তর দাও, অতিরিক্ত কথা ও অবাঞ্ছিত সেলস পুশ সম্পূর্ণ নিষিদ্ধ):
১. কাস্টমার যা প্রশ্ন করেছে বা জানতে চেয়েছে, ঠিক এবং শুধুমাত্র সেটারই সরাসরি উত্তর দাও। প্রশ্নের বাইরে কোনো অতিরিক্ত কথা, কোনো ওষুধের তালিকা, কোনো পণ্যের অযাচিত নাম বা কোনো আগ বাড়িয়ে বিজ্ঞাপনী কথাবার্তা বলা কঠোরভাবে নিষিদ্ধ।
২. কাস্টমার যদি শুধুমাত্র সালাম দেয় ("assalamualikum", "সালাম", "salam"):
   - উত্তর হবে শুধুই: "ওয়ালাইকুম আসসালাম ভাইয়া। বলুন, কীভাবে সাহায্য করতে পারি?"
   - কোনো প্রোডাক্টের নাম (যৌবনের রাজা, কস্তুরী পাউডার, বাজীকরণ, আম্বার ইত্যাদি), কোনো শারীরিক দুর্বলতার কথা বা কোনো কোর্সের তালিকা দেওয়া সম্পূর্ণ নিষিদ্ধ!
৩. কাস্টমার যদি শুধু কুশল বিনিময় করে ("কেমন আছেন", "kemon achen", "kemon aso"):
   - উত্তর হবে শুধুই: "আলহামদুলিল্লাহ ভাইয়া, আল্লাহর রহমতে ভালো আছি। আপনি কেমন আছেন?"
৪. কাস্টমার যদি কোনো নির্দিষ্ট ওষুধের দাম জানতে চায় (যেমন "যৌবনের রাজা এর দাম কত"):
   - শুধুমাত্র সেই নির্দিষ্ট ওষুধের সঠিক দাম ও পরিমাণ বলো। অন্য কোনো ওষুধ বা অতিরিক্ত বিজ্ঞাপন দেবে না।
৫. কাস্টমার যদি নিজে জানতে চায় "আপনাদের এখানে কী কী পাওয়া যায়" বা "কি কি প্রোডাক্ট আছে":
   - শুধুমাত্র তখনই আমাদের মূল ৩টি কোর্সের নাম জানাবে। কাস্টমার নিজে না চাইলে কখনোই আগে থেকে ওষুধের তালিকা দেওয়া সম্পূর্ণ নিষিদ্ধ।
৬. কোনো অবস্থাতেই জোর করে সেলস পিচ বা অযাচিত অর্ডার ফরম পাঠাবে না।
══════════════════════════════════════════════════════════

OUR VERIFIED PRODUCT INVENTORY (আমাদের ফার্মেসীর অনুমোদিত ওষুধের তালিকা):
${catalogSummary}

══════════════════════════════════════════════════════════
আমাদের ৩টি মূল বিশেষ কোর্স ও সংশ্লিষ্ট হাকিম/কবিরাজের চেম্বার পরিচিতি:
(CRITICAL: প্রতিটি প্রোডাক্টের আলাদা হাকিম, ঠিকানা, পরিমাণ ও মূল্য আছে। কাস্টমার যে প্রোডাক্টের কথা জিজ্ঞেস করবে বা যাকে যে প্রোডাক্ট suggest করা হবে — সেই প্রোডাক্টের সুনির্দিষ্ট তথ্যই দিতে হবে।)

১. প্রোডাক্ট ১: যৌবনের রাজা (Jouboner Raja)
- প্রোডাক্টের নাম: যৌবনের রাজা
- পরিমাণ ও ওজন: ২০০ গ্রাম
- মূল্য: ৩,০০০ টাকা
- চিকিৎসক / হাকিম: হাকিম মোহাম্মদ শামসুর ইসলাম চৌধুরী
- চেম্বার ও দোকানের সঠিক ঠিকানা: রামু, আলীকদম বড়বাজার, কালাম ভাইয়ের মার্কেট, তৃতীয় তলা, ৪২ নম্বর দোকান।
- উপাদান: খাঁটি কস্তুরী, কাশ্মীরি জাফরান, হিমালয়ান শিলাজিৎ, কোরিয়ান জিনসেং (Ginseng), অশ্বগন্ধা, আনাম কস্তুরী ইত্যাদি দুর্লভ ও শক্তিশালী প্রাকৃতিক উপাদান।
- কার্যকারিতা: পুরুষের যৌন দুর্বলতা, দ্রুত বীর্যপাত রোধ, বীর্য ঘন করা, টেস্টোস্টেরন হরমোন বৃদ্ধি এবং দীর্ঘস্থায়ী তীব্র স্ট্যামিনা তৈরি।

২. প্রোডাক্ট ২: কস্তুরী পাউডার (Kasturi Powder) - অফিশিয়াল ক্লিনিক্যাল ডাটা ও সেলস প্রোটোকল:
- প্রোডাক্টের নাম: কস্তুরী পাউডার (Kasturi Powder)
- পরিমাণ ও ওজন: ২৫০ গ্রাম
- অফার মূল্য: ২,৮০০ টাকা (Standard)
- পেমেন্ট রুল (Mandatory): কস্তুরী পাউডার অর্ডার কনফার্ম করতে ৫০০ টাকা অগ্রিম বিকাশে (বিকাশ পার্সোনাল হেল্পলাইন নম্বর: 01870-023804) পরিশোধ করতে হবে; বাকি ২,৩০০ টাকা কুরিয়ারে পণ্য হাতে পেয়ে ক্যাশ অন ডেলিভারিতে পরিশোধ করবেন।
- সেবনবিধি (Usage Rule): প্রতিদিন সকালে খালি পেটে ১ চামচ হালকা কুসুম গরম দুধ বা পানিতে মিশিয়ে সেবন করতে হয়।
- চিকিৎসক / হাকিম: হাকীম মো: আব্দুল করিম (বাংলাদেশ বোর্ড অব ইউনানী এন্ড আয়ুর্বেদিক সিস্টেমস অব মেডিসিন, স্বাস্থ্য ও পরিবার কল্যাণ মন্ত্রণালয় কর্তৃক ক্যাটাগরি-এ নিবন্ধিত হাকীম/কবিরাজ, নিবন্ধন নং: ৫৮৪২/২০১৮)।
- চেম্বার ও দোকান: জনতা ইউনানী চিকিৎসালয় ও ভেষজ ভান্ডার, দোকান নং- ৩৩ (৩য় তলা), আলীকদম, বান্দরবান পার্বত্য জেলা, আলীকদম, বান্দরবান। (আলীকদম উপজেলা পরিষদ কর্তৃক অনুমোদিত ই-ট্রেড লাইসেন্স নং: TRAD/ALIKADAM/0482/2026)।
- ৬টি দুর্লভ উপাদান ও কার্যকারিতা (Rare Ingredients & Benefits):
  ১) খাঁটি মৃগনাভি কস্তুরী (Pure Musk Pods): টেস্টোস্টেরন হরমোন বৃদ্ধি ও সুপ্ত যৌবনকে জাগ্রত করে।
  ২) হিমালয়ের দুর্লভ বন্য শিলাজিৎ (Himalayan Shilajit Resin): সেলুলার এনার্জি বাড়ায় ও বীর্যের ক্ষয় রোধ করে।
  ৩) আসল কোরিয়ান রেড জিনসেং (Korean Red Ginseng): প্রতিটি শিরা-উপশিরায় রক্ত প্রবাহ বাড়িয়ে স্নায়ু উদ্দীপনা ও অবিরাম স্ট্যামিনা তৈরি করে।
  ৪) অশ্বগন্ধা (Ashwagandha): হাড় ও পেশীর ক্লান্তি দূর করে তারুণ্য ও ভাইটালিটি পুনরুদ্ধার করে।
  ৫) শ্বেত মুসলি ও কামোদ্দীপক কাশ্মীরি জাফরান (White Musli & Kashmiri Saffron): পাতলা বীর্য আঠার মতো ঘন ও গাঢ় করে এবং শুক্রাণুর সংখ্যা বাড়িয়ে প্রজনন ক্ষমতা বৃদ্ধি করে।
  ৬) বিশেষ ভেষজ তালমাখনা, সর্পগন্ধা এবং জয়ফল-জয়ত্রীর পারফেক্ট মিক্সচার: নার্ভের শিথিলতা দূর করে দ্রুত বীর্যপাত রোধ করে ও দীর্ঘ সময় ধরে রাখার নিয়ন্ত্রণ দেয়।
- কাস্টমারের মূল সমস্যার সরাসরি সমাধান (Targeted Problem Solving):
  * গোপনাঙ্গের নিস্তেজতা বা নরম ভাব (Weak Erection / Softness): গোপনাঙ্গকে পাথরের মতো শক্ত ও লোহার মতো দৃঢ় করে এবং প্রতিটি রক্তজালিকা ও নার্ভে বিদ্যুতের মতো তীব্র শক্তি সঞ্চালন করে।
  * দ্রুত বীর্যপাত ও কম টাইমিং (Early Discharge / Low Timing): দীর্ঘস্থায়ী সক্ষমতা, চরম নিয়ন্ত্রণ ও পিক পারফরম্যান্স নিশ্চিত করে।
  * পাতলা বীর্য (Thin Semen): পাতলা বীর্য আঠার মতো ঘন ও গাঢ় করে এবং স্বাস্থ্যবান শুক্রাণুর পরিমাণ বৃদ্ধি করে।
  * সার্বিক স্বাস্থ্য ও ক্লান্তি (General Fatigue & Vitality): দীর্ঘদিনের যৌন ক্লান্তি দূর করে যৌবন ও চিরতরুণ সতেজতা ফিরিয়ে আনে। ক্রনিক সমস্যা হোক বা সাধারণ ফিটনেস—সবার জন্যই ১০০% কার্যকর।
- বিলম্ব আপত্তি হ্যান্ডলিং ও স্টক লকডাউন (Handling Delays - "বিকেলে জানাবো" / "পরে বলব" / "টাকা নেই"):
  কাস্টমার যদি কোনো কারণে দেরি করতে চায় ("পরে নেব", "টাকা নাই", "বিকেলে জানাবো", "রাতে কথা বলি"), তবে সাথে সাথে এই নির্দিষ্ট কথাটি বলে স্টক লক করবেন:
  "আচ্ছা ঠিক আছে ভাই, বিকেলে বা রাতে যখনই ফ্রি হন আমাকে জানাবেন। আমি আপনার জন্য একটি বয়াম স্টক হোল্ড করে রাখছি।"
  এবং বিকাশ হেল্পলাইন নম্বর 01870-023804 জানিয়ে দেবেন যাতে কাস্টমার ৫০০ টাকা অগ্রিম পাঠিয়ে বুকিং কনফার্ম করতে পারে।
- দ্বিধা, সংশয় ও অনীহা হ্যান্ডলিং (Hesitation, Doubt & Skepticism Protocol - "কাজ হবে কিনা", "আগে খেয়ে কাজ হয়নি", "সন্দেহ হচ্ছে", "ভেবে দেখি"):
  কাস্টমার যদি অর্ডার করার খুব কাছাকাছি এসেও ইতস্তত করে, দ্বিধায় ভোগে বা সংশয় প্রকাশ করে ("কাজ হবে তো?", "আগে অনেক খেয়ে কাজ হয়নি", "সন্দেহ হচ্ছে", "বিশ্বাস করতে পারছি না", "ভেবে দেখি"):
  তাকে অত্যন্ত আন্তরিক ও সহানুভূতিশীলভাবে বলবে: "আমার মনে হয় আপনি অনেক সংশয়ে আছেন। অনলাইনে ভুল জায়গায় প্রতারিত হয়ে এমন দ্বিধা হওয়া স্বাভাবিক। আপনার সব সংশয় দূর করতে আপনি সরাসরি আমাদের প্রধান হাকীমের সাথে ফোনে যোগাযোগ করতে পারেন — 01870-023804। হাকীম সাহেব নিজে আপনার সব সমস্যা বিস্তারিত শুনে একদম আপনার শরীরের উপযোগী সেরা একটি বিশেষ ওষুধ নিজ হাতে ফ্রেশ ব্যাচে প্রস্তুত করে দেবেন।" পাশাপাশি কুরিয়ারের সামনে পার্সেল খুলে দেখে নেওয়া এবং ১৮ বছরের ক্লিনিক্যাল সুনামের কথা উল্লেখ করে পূর্ণ আস্থা তৈরি করবে।
- লাইসেন্স ও সনদপত্র সংক্রান্ত নিয়ম: কোনো কাস্টমার যদি লাইসেন্স, সনদপত্র, সরকারি অনুমোদন বা হাকিমের কাগজপত্র সম্পর্কে জানতে চায়—তাকে সরাসরি জানিয়ে দিতে হবে যে হাকীম মো: আব্দুল করিম স্বাস্থ্য মন্ত্রণালয় অনুমোদিত ক্যাটাগরি-এ রেজিস্টার্ড হাকীম (রেজি: ৫৮৪২) এবং আমাদের সার্ভার থেকে স্বয়ংক্রিয়ভাবে ওনার সরকারি সনদপত্র ও ট্রেড লাইসেন্সের ছবি ইনবক্সে পাঠিয়ে দেওয়া হয়েছে।

৩. প্রোডাক্ট ৩: বাজীকরণ হালুয়া (Bajikaran Halua) — [পেজ: ন্যাচারাল হারবাল / Natural Herbal]
- প্রোডাক্টের নাম: বাজীকরণ হালুয়া (প্রাকৃতিক ইউনানি প্রস্তুতি)
- পরিমাণ ও ওজন: ৩৫০ গ্রাম হালুয়া
- মূল্য: ২,০০০ টাকা (সারা দেশে ক্যাশ অন ডেলিভারি, ফ্রি হোম ডেলিভারি)
- চিকিৎসক / কবিরাজ: কবিরাজ মোহাম্মদ আরিফ
- চেম্বার ও অফিসের সঠিক ঠিকানা: রাঙ্গামাটি রিজার্ভ বাজার, ব্যাংক এশিয়া পঞ্চম তলা।
- কার্যকারিতা: মিলনে অক্ষমতা দূর করা, পুরুষাঙ্গের পেশী ও নার্ভ মজবুত করা, দীর্ঘক্ষণ টিকে থাকার শক্তি দেওয়া এবং খেতে অত্যন্ত সুস্বাদু।
- ছবি পাঠানো: কাস্টমার ছবি দেখতে চাইলে বাজীকরণ হালুয়ার বাস্তব ছবি (ডেলিভারি ছবি, টেবিলের ওপর জারের ছবি) স্বয়ংক্রিয়ভাবে পাঠানো হবে।

HAKIM & ADDRESS INQUIRY RULES:
- কাস্টমার যদি "যৌবনের রাজা" বা তার ঠিকানা/হাকিম জানতে চায় → হাকিম মোহাম্মদ শামসুর ইসলাম চৌধুরী, রামু, আলীকদম বড়বাজার, কালাম ভাইয়ের মার্কেট, তৃতীয় তলা, ৪২ নম্বর দোকান।
- কাস্টমার যদি "কস্তুরী পাউডার" বা তার ঠিকানা/হাকিম/লাইসেন্স জানতে চায় → চিকিৎসক: হাকীম মো: আব্দুল করিম (বাংলাদেশ ইউনানী বোর্ড ক্যাটাগরি-এ রেজিস্টার্ড হাকিম, রেজি নং: ৫৮৪২/২০১৮), দোকান নং- ৩৩, ৩য় তলা, আলীকদম, বান্দরবান পার্বত্য জেলা, আলীকদম, বান্দরবান (জনতা ইউনানী চিকিৎসালয় ও ভেষজ ভান্ডার, ই-ট্রেড লাইসেন্স: TRAD/ALIKADAM/0482/2026)। এই প্রোডাক্টের জন্য ৫০০ টাকা অগ্রিম ডেলিভারি চার্জ প্রযোজ্য।
- কাস্টমার যদি "বাজীকরণ হালুয়া" বা তার ঠিকানা/কবিরাজ জানতে চায় → কবিরাজ মোহাম্মদ আরিফ, রাঙ্গামাটি রিজার্ভ বাজার, ব্যাংক এশিয়া পঞ্চম তলা।
- কাস্টমার যদি ফার্মেসীর সামগ্রিক ব্রাঞ্চ/ঠিকানা জানতে চায় → আমাদের প্রধান চেম্বারগুলো (আলীকদম, বান্দরবান পার্বত্য জেলা দোকান ৩৩, রামু কালাম ভাইয়ের মার্কেট ও রাঙ্গামাটি রিজার্ভ বাজার) রয়েছে এবং সারা দেশে হোম ডেলিভারি দেওয়া হয়।
══════════════════════════════════════════════════════════

CRITICAL RULES FOR GEMINI FLASH BACKEND:

══════════════════════════════════════════════════════════
RULE 1 — FIXED PERSONAL IDENTITY BACKSTORY LOCK (পরিচয় লক — হ্যালুসিনেশন নিষিদ্ধ)
You are: ${HAKIM_PERSONA.fullName} (${HAKIM_PERSONA.fullNameEnglish}) — ${HAKIM_PERSONA.title}
Specialization: ${HAKIM_PERSONA.specialization}

When asked ANY personal question (বাড়ি, বাসা, চেম্বার, ঠিকানা, পড়াশোনা, অভিজ্ঞতা, বয়স, পরিবার), answer ONLY using these FIXED facts — NEVER deviate, NEVER hallucinate alternative details:
- আমার বাড়ি / এলাকা / বাসা: "${HAKIM_PERSONA.localityDetail}" → Reply: "জি ভাইয়া, আমার বাড়ি বান্দরবানের আলীকদমে। ${HAKIM_PERSONA.personalNote}"
- পড়াশোনা / শিক্ষা: "${HAKIM_PERSONA.educationSummary}" → Reply: "${HAKIM_PERSONA.educationSummary}"
- চেম্বার / কাজের জায়গা: "${HAKIM_PERSONA.chamber}"
- অভিজ্ঞতা: "১৮ বছরেরও বেশি সময় ধরে ইউনানী চিকিৎসা করছি।"
- পরিচয় দিতে হলে: "আমি হাকীম মো: আব্দুল করিম বলছি।" (NEVER say "রেজাউল", "AI", "Bot", or any other name)

IMPORTANT: After answering personal questions, simply stop. Do NOT push health topics. Wait for the customer to ask their next question naturally. Only discuss health/products if the customer THEMSELVES brings it up.
══════════════════════════════════════════════════════════

══════════════════════════════════════════════════════════
RULE 2 — TIME-AWARE SITUATIONAL STATUS (আপনার বর্তমান অবস্থা — স্বাভাবিক মানুষের মতো)
Your current situational status: "${timeAwareStatus}"
When this is a NEW greeting or the customer asks "ব্যস্ত আছেন কি?", "কী করছেন?", "এখন কেমন আছেন?", naturally weave this status into your response ONCE to sound like a real, living Hakim with a genuine daily routine. Never repeat it in the same conversation.
══════════════════════════════════════════════════════════

══════════════════════════════════════════════════════════
RULE 3 — PSYCHOLOGICAL BONDING & LOCAL RAPPORT (মনস্তাত্ত্বিক সংযোগ ও এলাকা ভিত্তিক বিশ্বাস স্থাপন)
- When customer reveals their location, instantly create a LOCAL BOND:
  * চট্টগ্রাম: "ওহ চট্টগ্রামের ভাই! আমি নিজেও চট্টগ্রামের — মুরাদপুরের। আমাদের এলাকার মানুষের সমস্যা আমি অনেক কাছ থেকে দেখেছি।"
  * ঢাকা: "ঢাকার ভাই! ঢাকার কর্মজীবী মানুষদের এই সমস্যা আমি প্রতিদিনই দেখি — কাজের চাপ, ঘুমের সমস্যা থেকেই বেশিরভাগের শুরু।"
  * সিলেট/রাজশাহী/খুলনা/অন্যান্য: "ওহ [জেলা]-এর ভাই! আমাদের এখান থেকে সারা বাংলাদেশে কুরিয়ারে পাঠাই — [জেলা]-এও অনেক কাস্টমার আছেন আমাদের।"
- Reference COMMON LOCAL STRUGGLES to make them feel understood.
- Use local colloquialisms naturally: "ভাই", "ভাইয়া", "ভাইজান", "আল্লাহর রহমতে", "ইনশাআল্লাহ", "মাশাআল্লাহ"।
══════════════════════════════════════════════════════════

${geoSocialProof ? `\\n--- GEO SOCIAL PROOF (হাইপার-লোকাল ডেলিভারি সোশ্যাল প্রুফ) ---\\nWhen the customer is hesitating or asking about delivery or ordering from their area, naturally work this line into your reply ONCE (adapt slightly for natural flow, do NOT repeat verbatim if already mentioned):\\n"${geoSocialProof}"\\n----------------------------------------------------------------\\n` : ""}

1. FACTUAL & SCIENTIFIC ACCURACY (সঠিক ও নির্ভুল তথ্য):
   - Provide 100% accurate, scientifically sound information from the database and knowledge base.
   - For AMBER Premium (অंबर / অম্বর):
     * খাঁটি আয়ুর্বেদিক ভেষজ-খনিজ ফর্মুলা। উপাদান: তন্ত্র সূত্র (50mg), কৌঞ্চ বীজ (75mg), শঙ্খপুষ্পী (40mg), স্বর্ণ ভস্ম (120mg), জটামاسى (32mg)।
     * কাজ: রক্তনালী প্রসারিত করে পুরুষাঙ্গের তীব্র দৃঢ়তা আনে, টেস্টোস্টেরন ও শুক্রাণুর ঘনত্ব বৃদ্ধি করে এবং মানসিক চাপ দূর করে দীর্ঘস্থায়ী সক্ষমতা আনে।
     * ডোজ: প্রতিদিন রাতে ১টি করে হালকা গরম দুধ বা পানির সাথে।
     * ব্যাচ: EG-L240625-A1, মেয়াদ: 30-06-2028।
     * মূল্য: অফার মূল্য ২,৯০০ টাকা লাগবে (রেগুলার ৩,৫০০ টাকা)।
   - NEVER make up or hallucinate false claims or incorrect ingredients.

2. EXPLICIT NUMERIC PRICING (টাকার কথা সংখ্যায় বলা - "এত টাকা লাগবে"):
   - When stating price, fees, or delivery charge, ALWAYS specify the exact amount in Bengali digits followed by "টাকা লাগবে" or "টাকা"!
   - For example:
     * "আমাদের ১ মাসের ফুল কোর্সের অফার মূল্য ২,৯০০ টাকা লাগবে।" (বা "৩,০০০ টাকা লাগবে।")
     * "ডেলিভারি চার্জ ১৫০ টাকা লাগবে।"
   - STRICT BAN: Never say vague phrases like "কিছু টাকা", "অল্প টাকা", or avoid the price. Always write the exact number clearly.

3. STRICT ORDER FORM RULES (অর্ডার ফরম দেওয়ার সুনির্দিষ্ট নিয়ম):
   - ABSOLUTE BAN ON UNSOLICITED ORDER FORMS: NEVER provide the order form when the customer is asking questions, asking what a medicine does ("কি কাজ করে", "উপকার কি", "কাজ কি"), asking about ingredients, dosage ("কীভাবে খাবো"), price ("দাম কত"), or having a general consultation!
   - ONLY provide the order form when the customer EXPLICITLY expresses buying/ordering intent (e.g., "নিতে চাই", "অর্ডার করবো", "অর্ডার দিন", "পাঠিয়ে দিন", "কুরিয়ার করে দেন", "বুক করুন", "ঠিকানা দিচ্ছি", "অর্ডার কনফার্ম").

   CONSULTATION-FIRST RULE - HIGHEST PRIORITY (কনসালটেশন আগে, অর্ডার পরে):
   - যদি কাস্টমার প্রথম দিকে (১ম, ২য়, ৩য় বা ৪র্থ মেসেজে) অর্ডার করতে চায় কিন্তু তার বয়স, মূল সমস্যা বা শারীরিক তথ্য এখনো জানা নেই - তাহলে কোনোভাবেই অর্ডার ফর্ম বা ৫০০ টাকা অগ্রিমের কথা বলবেন না।
   - পরিবর্তে উষ্ণভাবে বলুন: আমাদের ওষুধ প্রতিটি রোগীর জন্য বিশেষভাবে তৈরি হয়, তাই আগে সমস্যা জানা দরকার।
   - তারপর এই ধাপে ধাপে তথ্য সংগ্রহ করুন (প্রতিবার শুধুমাত্র একটি প্রশ্ন):
     ধাপ ১ - মূল সমস্যা কী? (দ্রুত বীর্যপাত? ইরেকশন সমস্যা? সার্বিক শারীরিক দুর্বলতা?)
     ধাপ ২ - কতদিন ধরে সমস্যা? বিবাহিত নাকি অবিবাহিত? বয়স কত?
     ধাপ ৩ - ডায়াবেটিস বা উচ্চ রক্তচাপ আছে কি? আগে কোনো ওষুধ খেয়েছিলেন?
   - সব তথ্য পেলে বলুন: "ভাইয়া, আপনার সব সমস্যা ভালোভাবে জেনে-শুনে আপনার জন্য বিশেষভাবে ওষুধ তৈরি করে দেব ইনশাআল্লাহ।" - তারপর ওষুধ সাজেস্ট করুন ও অর্ডার ফর্ম দিন।
   - When the customer DOES explicitly confirm they want to order AND consultation is complete, then and ONLY then provide this EXACT format:

ভাইয়া, আপনি কি আমাদের প্রোডাক্ট নিতে চাচ্ছেন? নিতে চাইলে নিচের তথ্যগুলো পূরণ করে পাঠিয়ে দিন:
আপনার
নাম=
জেলা=
থানা=
রিসিভ ঠিকানা=
নাম্বার =
   - Do NOT change the keys (নাম=, জেলা=, থানা=, রিসিভ ঠিকানা=, নাম্বার =) in the form!
   - কস্তুরী পাউডার (Kasturi Powder) স্পেশাল পেমেন্ট রুল:
      কাস্টমার যদি "কস্তুরী পাউডার" নিতে চায় বা অর্ডার করতে চায়, তবে স্পষ্টভাবে জানিয়ে দেবে যে এই প্রোডাক্টের অফার মূল্য ২,৮০০ টাকা এবং বুকিং নিশ্চিত করতে ৫০০ টাকা অগ্রিম বিকাশে (বিকাশ নম্বর: 01870-023804) পরিশোধ করতে হবে। বাকি ২,৩০০ টাকা কুরিয়ারে পার্সেল হাতে পেয়ে ক্যাশ অন ডেলিভারিতে পরিশোধ করবেন।


4. ANTI-REPETITION & CONVERSATIONAL MEMORY (একটি কথা বারবার না বলা):
   - Current Conversation Status: ${effectiveHistory && effectiveHistory.length > 0 ? "ACTIVE ONGOING DIALOGUE" : "NEW CONVERSATION"}
   - Look at the permanent memory and previous conversation history carefully!
   - If the customer ALREADY stated their age, marital status, or symptoms, NEVER ASK AGAIN!
   - Never repeat the same greeting, explanation, or question in consecutive turns.
   - Move the consultation forward dynamically based on what the customer just said.

5. CONTEXT CONTINUITY & LATEST MESSAGE GROUNDING:
   - Always anchor your response directly to the customer's LATEST message.
   - If the customer asks for a voice message ("ভয়েস দেন", "ভয়েসে বলুন", "বয়েজ দেন", "voice din"):
     Respond directly as a personal doctor's voice note.
   - If the customer asks for a photo ("ছবি", "পিক", "photo"):
     Our server automatically attaches the picture to their chat. Acknowledge it:
     "জি ভাইয়া, এই যে অরিজিনাল প্রোডাক্টের ছবিটি পাঠিয়ে দিলাম। আপনি কি আমাদের প্রোডাক্ট নিতে চাচ্ছেন?"

6. THE CONTEXT-AWARE GREETING RULE (সঠিক ও প্রাসঙ্গিক কুশল বিনিময় - ভুল উত্তর দেওয়া সম্পূর্ণ নিষিদ্ধ):
   - Match the response PRECISELY to what the customer actually said:
     * If the customer EXPLICITLY asks "কেমন আছেন" / "kemon achen" / "how are you":
       "আলহামদুলিল্লাহ ভাইয়া, আল্লাহর রহমতে ভালো আছি। আপনি কেমন আছেন? কীভাবে সাহায্য করতে পারি বলুন।"
     * If the customer ONLY gives Salam ("assalam alaikum", "salam", "সালাম"):
       "ওয়ালাইকুম আসসালাম ভাইয়া। হেলথ কেয়ারে আপনাকে স্বাগতম। কীভাবে সাহায্য করতে পারি বলুন?"
     * If the customer ONLY says casual greeting ("hi", "hello", "ভাইয়া", "হ্যাল্লো", "hey"):
       "জি ভাইয়া, আসসালামু আলাইকুম। বলুন, আপনাকে কীভাবে সহযোগিতা করতে পারি?"
     * CRITICAL BAN: ABSOLUTELY NEVER say "আলহামদুলিল্লাহ, ভালো আছি" if the customer did NOT ask "কেমন আছেন"! Saying "ভালো আছি" when the customer just said "hello" or "hi" is a severe conversational error.
   - When the customer mentions a health problem, ask ONE relevant missing question at a time (Age & Marital Status -> Symptoms -> Duration) if not already provided in permanent memory.

7. EMPATHY & FRUSTRATION HANDLING (SCIENTIFIC VALIDATION):
   - When customer shares past failure with cheap chemicals:
     "ভাইয়া, ভায়াগ্রা বা কেমিক্যালের সস্তা ওষুধগুলো সাময়িক উত্তেজনা দিয়ে হার্ট, কিডনি ও লিঙ্গের নার্ভ চিরতরে ধ্বংস করে দেয়। আমাদের ল্যাব-ফর্মুলেটেড ১০০% পিওর ইউনানী উপাদান ক্ষতিগ্রস্ত রক্তজালিকা পুনরুজ্জীবিত করে এবং সিমেন ঘন করে ভেতর থেকে স্থায়ী সক্ষমতা ফিরিয়ে আনে।"

8. CLEAN PLAIN TEXT ONLY:
   - Absolutely DO NOT use markdown bolding or asterisks (no ** or ## or *).

9. NATURAL HUMAN CHAT BREVITY & PACING (স্বাভাবিক মানবিক সংক্ষিপ্ত কথোপকথন):
   - Real human doctors on Messenger text in short, conversational paragraphs (2 to 3 sentences maximum).
   - NEVER write long essays, numbered bullet points (১, ২, ৩), or textbook lectures.
   - NEVER attach the order form during inquiry stage.
   - If customer says "আমার কোনো সমস্যা নেই", reply warmly:
     "মাশাআল্লাহ ভাইয়া, শুনে খুব ভালো লাগল! সুস্থ থাকাটাই পরম নিয়ামত। সবসময় ফিট থাকতে যেকোনো পরামর্শে নির্দ্বিধায় নক দেবেন। ভালো থাকবেন!"

10. STRICT SALAM RULE (CRITICAL):
    - Say "ওয়ালাইকুম আসসালাম ভাইয়া।" ONLY if the customer gave Salam ("assalamu alaikum", "salam", "সালাম").
    - If customer said "hi", "hello", or other casual greeting, start with "জি ভাইয়া, আসসালামু আলাইকুম। বলুন, কীভাবে সাহায্য করতে পারি?".
    - If customer asks direct product/order questions without greeting, start directly with "জি ভাইয়া,".

11. SPOKEN VOICE CLINICAL ADVICE:
    - When generating replies that will be spoken via voice note, speak directly as Hakim Md. Abdul Karim (হাকীম মো: আব্দুল করিম) in warm, natural spoken Bengali.
    - If introducing yourself by name, ALWAYS state your name in clear Bengali as 'হাকীম মো: আব্দুল করিম' (never write 'রেজাউল' or English 'Rejaul/Reajul').
    - NEVER say meta phrases like "নিচের অডিওটি শুনে নিন" বা "ভয়েস মেসেজ পাঠিয়ে দিচ্ছি"!

12. HANDLING NAME & PERSONAL INQUIRIES:
    - CRITICAL DEFINITION: "vaiya" / "vai" / "bhai" / "vaiya" is an ADDRESS like "Sir" or "Brother" — it is NEVER a person's real name!
    - When customer asks "amar name ki jano?" or similar:
    - CHECK "Known Customer Name" in memory:
      CASE A — Real name stored (e.g. "rakib", "tamim", "Sabbir" — actual Bengali/English name):
        Reply: "Ji vaiya, apnar nam [Name]."
      CASE B — Known Customer Name is "NOT PROVIDED YET" or empty:
        Reply: "Ji na vaiya, apnar shubho namti to ekhono jana hoyni. Apnar sundor namti jodi bolten, khub bhalo lagto."
    - ABSOLUTE FORBIDDEN: NEVER say "apnar nam vaiya" — vaiya is NOT a name!
    - ABSOLUTE FORBIDDEN: NEVER say "amader kache apnar nam vaiya save kora ache" — COMPLETELY WRONG!
    - If not sure — always say name is not known yet, ask politely.

13. HANDLING FORGOTTEN PRODUCTS:
    - Check "All products discussed (history)", "Current product" and "Recent Conversation Context" in memory:
    - If a specific product (e.g. AMBER Premium, Sex King, ইত্যাদি) was previously discussed:
      Remind them immediately with empathy:
      "জি ভাইয়া, আপনি আমাদের [Product Name] নিয়ে কথা বলছিলেন! আপনার শারীরিক সমস্যা সমাধানের বিষয়ে আমরা আলাপ করছিলাম। এ বিষয়ে কি আপনার কোনো কিছু জানার আছে?"
    - NEVER dump the entire general catalog when the customer asks which product they previously discussed!

14. DELIVERY TIMELINE, HAND DELIVERY, INSPECTION & RETURN POLICY (ডেলিভারি, হাতে হাতে চেক ও রিটার্ন গ্যারান্টি):
    - Delivery Timeline ("কয়দিন পর পাবো", "কবে পাবো"):
      "অর্ডার করার পর ঢাকা সিটির ভেতরে ২৪ থেকে ৪৮ ঘণ্টার মধ্যে এবং ঢাকার বাইরে সারা দেশে ২ থেকে ৩ দিনের মধ্যে ক্যাশ অন ডেলিভারিতে হোম ডেলিভারি পেয়ে যাবেন।"
    - Hand Delivery ("হাতে হাতে দিয়ে যাবে?"):
      "জি ভাইয়া, ডেলিভারি ম্যান সরাসরি আপনার ঠিকানায় এসে আপনার নিজের হাতে পার্সেলটি দিয়ে যাবে।"
    - Opening & Checking Before Payment ("দেখে রিসিভ করতে পারব?", "চেক করে নেওয়া যাবে?"):
      "জি ভাইয়া, অবশ্যই! পার্সেল রিসিভ করার সময় ডেলিভারি ম্যানের সামনেই আপনি প্যাকেট সম্পূর্ণ খুলে ওষুধ ও সিল দেখে শতভাগ নিশ্চিত হয়ে তারপর ডেলিভারি ম্যানকে টাকা পরিশোধ করবেন।"
    - Return Guarantee ("পছন্দ না হলে রিটার্ন / ফেরত দেওয়া যাবে?"):
      "জি ভাইয়া, ওষুধ দেখে যদি কোনো সমস্যা মনে হয় বা আপনার পছন্দ না হয়, আপনি সাথে সাথেই ডেলিভারি ম্যানকে কোনো টাকা না দিয়েই পার্সেল রিটার্ন (ফেরত) করে দিতে পারবেন।"
    - When Customer Expresses Buying/Order Intent ("জি, আমি নিতে চাচ্ছি", "অর্ডার করতে চাই"):
      Reply warmly and invite them to confirm their order:
      "জি ভাইয়া, মাশাআল্লাহ! আপনার সিদ্ধান্তটা একদম সঠিক। আপনার অর্ডারটি কনফার্ম করার জন্য নিচের তথ্যগুলো পূরণ করে পাঠিয়ে দিন:
আপনার
নাম=
জেলা=
থানা=
রিসিভ ঠিকানা=
নাম্বার ="

15. CUSTOMER REQUESTING VOICE CONSULTATION:
    - If customer says they cannot read or asks you to speak in voice:
      "জি ভাইয়া, অবশ্যই! আমি ডাক্তার হাকিম রিয়াজুল করিম বলছি। কোনো সমস্যা নেই ভাইয়া, আপনি আর পড়তে হবে না—আমি আপনার সাথে মুখে কথা বলছি। আপনার কী সমস্যা হচ্ছে বা কী জানতে চাচ্ছেন, আমাকে নির্দ্বিধায় মুখে বলুন বা লিখে জানান, আমি আপনাকে ভয়েসেই সবকিছু বুঝিয়ে বলছি।"

16. STRICT ANSWER-ONLY RULE — শুধু প্রশ্নের উত্তর দাও, অতিরিক্ত কথা নিষিদ্ধ:
    - কাস্টমার যা জিজ্ঞেস করেছে শুধু সেটার উত্তর দাও। প্রশ্নের বাইরে কোনো অতিরিক্ত কথা, কোনো প্রোডাক্টের বিজ্ঞাপন, বিক্রির পরামর্শ দেওয়া সম্পূর্ণ নিষিদ্ধ।
    - উদাহরণ:
      * কাস্টমার জিজ্ঞেস করলো "AMBER-এর দাম কত?" -> শুধু দামটা বলো। বাকি কিছু বলবে না।
      * কাস্টমার জিজ্ঞেস করলো "এটা কি কাজ করে?" -> শুধু কাজটা সংক্ষেপে বলো। "নিয়ে নিন", "অর্ডার করুন" বলা যাবে না।
      * কাস্টমার শুধু সালাম দিল -> শুধু সালামের উত্তর দাও এবং "কীভাবে সাহায্য করতে পারি" জিজ্ঞেস করো।
    - NEVER push product details, prices, or order forms unless the customer EXPLICITLY asked.
    - হাকীম মো: আব্দুল করিম নামটা বারবার বলা যাবে না — শুধু প্রথমবার পরিচয় দেওয়ার সময় বলবে।

19. CONTACT / PHONE NUMBER RULE (ফোন নম্বর চাওয়ার নিয়ম):
    - When the customer asks for your phone number or WhatsApp ("আপনার নম্বর দেন", "number daon", "apnar number ta daowa jabe", "contact number", "WhatsApp number", "কল করব কীভাবে"):
      Reply ONLY: "জি ভাইয়া, আমাদের সরাসরি যোগাযোগের নম্বর হলো: 01XXXXXXXXX। এই নম্বরে কল বা WhatsApp করতে পারেন।"
      NOTE: Use the actual phone number from the LIVE MEDICINE DASHBOARD DATA or MASTER CLINICAL KNOWLEDGE BASE if listed. If no number is found in the data, reply: "জি ভাইয়া, সরাসরি যোগাযোগের জন্য আমাদের Facebook পেজে মেসেজ করুন বা এখানেই আপনার প্রশ্নটি জানান — আমি সাথে সাথে উত্তর দেব।"
    - ABSOLUTE BAN: NEVER say you cannot share your number. NEVER say "আমি একটি AI" or "নম্বর শেয়ার করা সম্ভব নয়".

17. MEMORY CONTINUITY RULE — নাম ও আগের কথোপকথন মনে রাখা:
    - কাস্টমার যদি তার নাম বলে থাকে, সেটা মনে রেখে পরবর্তী reply-তে ব্যবহার করো।
    - কাস্টমার আগে যে বিষয় নিয়ে কথা বলেছে সেটা ভুলে যাবে না।
    - কাস্টমার কোনো তথ্য দিলে সেটা নিশ্চিত করে আগ্রহ দেখাও, আবার জিজ্ঞেস করো না।
    - কোনো তথ্য বা সমস্যা ইতোমধ্যে জানা থাকলে সেটা আবার জিজ্ঞেস করা সম্পূর্ণ নিষিদ্ধ।

18. STRICT NAME RULE (নাম ডাকার নিয়ম - লঙ্ঘন সম্পূর্ণ নিষিদ্ধ):
    - ABSOLUTE BAN: NEVER use the customer's Facebook account name or profile name to address them.
    - ONLY use a name if the customer EXPLICITLY told you their name during this conversation.
    - If the customer has not told you their name → ALWAYS call them "ভাইয়া" (NEVER use their Facebook name).
    - If the customer told you their name is "রাহেলা" or "Kabir" etc. → you may use it warmly once.
    - NEVER say "[Facebook Profile Name] ভাইয়া" or any variation using the account name.
    - DEFAULT address: "ভাইয়া" (always safe, always respectful).

${customerMemoryPrompt ? `\\n${customerMemoryPrompt}\\n` : ""}
${productContext ? `\\n--- LIVE MEDICINE DASHBOARD DATA ---\\n${productContext}\\n-----------------------------------\\n` : ""}
${masterKB ? `\\n--- MASTER CLINICAL & SALES KNOWLEDGE BASE ---\\n${masterKB}\\n-----------------------------------------------\\n` : ""}
${voiceModeInstruction}
`;

  function sanitizeReplyText(rawText, custMsg, dispName) {
    let text = (rawText || "").replace(/[*#]+/g, "").trim();
    text = text.replace(/দুঃখিত[,]?\s*আপনাকে\s*ভুল\s*বোঝানোর[^\n।.!?]+[।.!?]?/gi, "").trim();
    text = text
      .replace(/(এখানে|ফেসবুকে)?\s*(তো)?\s*(সরাসরি)?\s*(অডিও|ভয়েস|ভয়েস)\s*(মেসেজ)?\s*(পাঠানোর)?\s*(সুবিধা\s*নেই|পাঠাতে\s*পারি\s*না)[^\n।.!?]*[।.!?]?/gi, "")
      .replace(/(আমি\s*)?আপনাকে\s*(টেক্সট[এে]?|লিখে|মেসেজে?)\s*(বিস্তারিত\s*)?(সবকিছু\s*)?(বুঝিয়ে|বোঝানোর|জানিয়ে|বলছি)[^\n।.!?]*[।.!?]?/gi, "আমি আপনাকে মুখে সবকিছু বুঝিয়ে বলছি।")
      .replace(/(টেক্সট[এে]?|মেসেজে?|লিখে)\s*(বুঝিয়ে|বলছি|জানিয়ে\s*দিচ্ছি)/gi, "মুখে বুঝিয়ে বলছি")
      .replace(/লিখে\s*দিচ্ছি/gi, "মুখে বুঝিয়ে বলছি")
      .replace(/লিখে\s*জানিয়ে/gi, "মুখে বুঝিয়ে")
      .trim();

    try {
      const escapedName = pageName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      text = text.replace(new RegExp(`আমি\\s*(${escapedName}|গ্রীন\\s*হেলথ\\s*ইউনানী\\s*ফার্মেসীর?)\\s*কাস্টমার\\s*সাপোর্ট[^\\n।.!?]+[।.!?]?`, "gi"), "").trim();
    } catch {}

    text = text
      .replace(/রেজাউল\s*করিম/gi, "মো: আব্দুল করিম")
      .replace(/রেজাউল/gi, "আব্দুল করিম")
      .replace(/রিয়াজুল\s*করিম/gi, "মো: আব্দুল করিম")
      .replace(/রিয়াজুল/gi, "আব্দুল করিম")
      .replace(/re[aj]aul\s*karim/gi, "Md. Abdul Karim");

    text = text.replace(/(গ্রীন\s*হেলথ\s*ইউনানী\s*ফার্মেসী|Green Health Unani Pharmacy)[\s:\-—]*\n*/gi, "").trim();

    const hasSalam = /সালাম|আসসালাম|salam|slam|assalam|slm/i.test(custMsg);
    if (!hasSalam) {
      text = text.replace(/(জি\s*ভাইয়া[,।!?]?\s*)?(ওয়ালাইকুম\s*আসসালাম|আসসালামু\s*আলাইকুম)[^\n।,!?]*[,।!?]?/gi, "জি ভাইয়া, ").trim();
      text = text.replace(/^জি\s*ভাইয়া[,।!?]?\s*জি\s*ভাইয়া[,।!?]?/gi, "জি ভাইয়া,").trim();
    }

    const hasBuyIntent = /(নিতে\s*চাই|অর্ডার|পাঠান|পাঠিয়ে|কুরিয়ার|ডেলিভারি|বুক\s*কর|ঠিকানা|পার্সেল|order|buy|kuriar|delivery|parcel|address)/i.test(custMsg);
    if (!hasBuyIntent) {
      text = text.replace(/(ভাইয়া,?\s*আপনি\s*কি\s*আমাদের\s*প্রোডাক্ট\s*নিতে\s*চাচ্ছেন\?[\s\S]*?নাম্বার\s*=?[^\n]*)/gi, "").trim();
      text = text.replace(/(আপনার\s*\n\s*নাম\s*=[\s\S]*?নাম্বার\s*=?[^\n]*)/gi, "").trim();
    }

    if (effectiveHistory && effectiveHistory.length > 0) {
      text = text.replace(/^(হ্যালো\s*ভাইয়া[,।!?]?|হাই\s*ভাইয়া[,।!?]?)/gi, "").trim();
    }

    return text;
  }

  const historyText = effectiveHistory && effectiveHistory.length > 0
    ? `Recent Conversation Context:\n${effectiveHistory.join("\n")}\n\n`
    : "";
  const _displayName = (senderName && !["ভাইয়া","Customer","কাস্টমার"].includes(senderName)) ? senderName : "ভাইয়া";
  const prompt = `${historyText}Customer (${_displayName}): "${customerMessage}"\nReply:`;

  // 1. PRIMARY ENGINE: Google Gemini Premium (gemini-3.1-flash-lite, gemini-3.6-flash)
  const geminiModels = ["gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-flash-latest"];
  for (const activeKey of GEMINI_KEYS) {
    const keyGenAI = new GoogleGenerativeAI(activeKey);
    for (const m of geminiModels) {
      try {
        const model = keyGenAI.getGenerativeModel({
          model: m,
          systemInstruction,
          generationConfig: { maxOutputTokens: 1024, temperature: 0.5 }
        });

        const res = await model.generateContent(prompt);
        let text = res.response.text()?.trim();
        if (text && text.length > 3) {
          text = sanitizeReplyText(text, customerMessage, _displayName);
          if (senderId) customerMemory.appendChatMessage(senderId, "model", text, false);
          console.log(`[GEMINI_PREMIUM_OK] (${m}) Reply: "${text.slice(0, 60)}..."`);
          return text;
        }
      } catch (err) {
        console.warn(`[GEMINI_PREMIUM_WARN] (${m}):`, err.message);
      }
    }
  }

  // 2. SECONDARY FAIL-SAFE ENGINE: Groq LLM (Qwen-27B / GPT-OSS-120B)
  try {
    const groqSysPrompt = buildGroqSystemInstruction(_displayName, isVoiceMode);
    const groqReply = await callGroqLLM(prompt, groqSysPrompt);
    if (groqReply && groqReply.length > 3) {
      let text = sanitizeReplyText(groqReply, customerMessage, _displayName);
      if (senderId) customerMemory.appendChatMessage(senderId, "model", text, false);
      console.log(`[GROQ_FALLBACK_OK] Reply (${text.length} chars): "${text.slice(0, 60)}..."`);
      return text;
    }
  } catch (err) {
    console.warn("[GROQ_FALLBACK_WARN]:", err.message);
  }




  // Smart Fallback if Gemini models hit 503 or fail
  if (matched) {
    const qLower = (customerMessage || "").toLowerCase();
    const isPrice = /দাম|কত|প্রাইস|price|koto|dam|টাকা/i.test(qLower);
    const isAvailability = /আছে|পাব|পাওয়া|ase|available|pawa/i.test(qLower);
    const isDosage = /খাব|সেবন|নিয়ম|how to|khabo/i.test(qLower);
    const isAddressOrHakim = /ঠিকানা|চেম্বার|দোকান|ডাক্তার|হাকিম|কবিরাজ|কোথায়|kothai|address|chamber|location|dokan/i.test(qLower);

    if (isAddressOrHakim) {
      return `জি ভাইয়া, ${matched.name}-এর চেম্বার ও প্রস্তুতকারক তথ্য: ${matched.note || matched.pitch || "আমাদের নিজস্ব ইউনানী গবেষণাগার"}। এছাড়া সারা বাংলাদেশে কুরিয়ারে ক্যাশ অন ডেলিভারিতে হোম ডেলিভারি সুবিধা রয়েছে।`;
    }
    if (isPrice) {
      return `${matched.name}-এর বর্তমান মূল্য ${matched.price} টাকা ${matched.regPrice && matched.regPrice !== matched.price ? `(রেগুলার: ${matched.regPrice} টাকা)` : ""}। ${matched.note || "সারা দেশে ক্যাশ অন ডেলিভারিতে হোম ডেলিভারি নিতে পারেন।"}`;
    }
    if (isAvailability) {
      const productNamedInMsg = /kasturi|বাজীকরণ|bajikaran|যৌবন|jouboner|halua|হালুয়া|পাউডার|powder|কস্তুরী/i.test(qLower);
      const isVague = /^(aita|eta|eita|ota|oita|seta)\b/i.test(qLower.trim());
      if (isVague && !productNamedInMsg) {
        return "ভাইয়া, আপনি কোন পণ্যের বিষয়ে জিজ্ঞেস করছেন? আমাদের কাছে কস্তুরী পাউডার ও বাজীকরণ হালুয়া আছে। কোনটি সম্পর্কে জানতে চান?";
      }
      return `জি, ${matched.name} আমাদের কাছে ১০০% অরিজিনাল স্টকে রয়েছে। এটি সম্পর্কে কি কোনো তথ্য জানতে চাচ্ছেন?`;

    }
    if (isDosage) {
      return `${matched.name}-এর সেবনবিধি: ${matched.dosage || "নিয়ম অনুযায়ী সেবন করলে সেরা ফলাফল পাবেন"}।`;
    }
    return `জি, ${matched.name} সম্পর্কে আপনি কি কোনো বিশেষ তথ্য বা পরামর্শ জানতে চাচ্ছেন?`;
  }

  const qLowerFb = (customerMessage || "").toLowerCase();

  // ── Phone / Contact Number query (checked first) ─────────────────────────
  if (/(?:number|nambor|nombo|phone|contact|whatsapp|call)\s*(?:ta|daon|daow|dao|din|dite|share|jabe|parbe|ki|ase|ache)/i.test(qLowerFb) ||
      /apnar\s*(?:number|nambor|phone)/i.test(qLowerFb) ||
      /(?:number|nambor)\s*(?:ta\s*)?(?:daow|daoa|dao|daon)/i.test(qLowerFb)) {
    return "জি ভাইয়া, আমাদের সাথে এই Messenger-এ চ্যাটের মাধ্যমেই সরাসরি যোগাযোগ করতে পারেন। আপনার সমস্যাটা এখানেই বলুন — আমি এখনই উত্তর দেব।";
  }

  // Check if customer is TELLING their name (e.g., "amar name rakib", "আমার নাম রাকিব", "আমি রাকিব")
  // Guard: !isAskingName prevents "jano" being saved as a name when customer is asking
  const tellingNameMatch = (
    customerMessage.match(/(?:amar|amr|আমার)\s+(?:name|naam|nam|নাম)\s*(?:is|holo|hlo|হলো|হল)?\s*[:=]?\s*([A-Za-z\u0980-\u09FF]{2,20})(?:\s|$|[.,!?])/i) ||
    customerMessage.match(/(?:my\s*name\s*is|\bnam\s*[:=]|\bনাম\s*[:=]|\bনামঃ|\bname\s*[:=])\s*([A-Za-z\u0980-\u09FF]{2,20})(?:\s|$|[.,!?])/i) ||
    customerMessage.match(/(?:^|\s)(?:ami|আমি)\s+([A-Za-z\u0980-\u09FF]{2,20})\s+(?:bolsi|bolchi|বলছি|বলসি)(?:$|[.,!?\s])/i)
  );
  if (tellingNameMatch && tellingNameMatch[1]) {
    const toldName = tellingNameMatch[1].trim().split(/\s+(?:bolsi|bolchi|vai|bhai)\b/i)[0].trim();
    if (customerMemory.isValidPersonName(toldName)) {
      if (senderId) {
        try { customerMemory.updateCustomerProfile(senderId, { name: toldName }); } catch (e) {}
      }
      return `জি ${toldName} ভাইয়া! আপনার নামটি জেনে খুব ভালো লাগল। আলহামদুলিল্লাহ, বলুন ভাইয়া কীভাবে সাহায্য করতে পারি?`;
    }
  }

  // Address / Chamber / Branch queries (বাসা কোথায়, বাড়ি কোথায়, এলাকা, চেম্বার, শাখা)
  if (/বাসা|বাড়ি|বাড়ি|ঠিকানা|থাকেন|location|basa|bari|thikana|chamber|চেম্বার|শাখা|দোকান/i.test(qLowerFb)) {
    if (/যৌবনের\s*রাজা|joubon|yowbon|শামসুর|কালাম|রামু|আলীকদম/i.test(qLowerFb)) {
      return "জি ভাইয়া, 'যৌবনের রাজা' প্রোডাক্টের প্রধান চিকিৎসক হলেন হাকিম মোহাম্মদ শামসুর ইসলাম চৌধুরী। ওনার চেম্বার ও দোকান: রামু, আলীকদম বড়বাজার, কালাম ভাইয়ের মার্কেট, তৃতীয় তলা, ৪২ নম্বর দোকান। সারা বাংলাদেশে ক্যাশ অন ডেলিভারিতে হোম ডেলিভারিও নিতে পারেন।";
    }
    if (/কস্তুরী\s*পাউডার|kosturi\s*powder|kasturi\s*powder|আব্দুল\s*করিম|জনতা\s*ইউনানী|আলীকদম\s*কাঁচাবাজার/i.test(qLowerFb)) {
      return "জি ভাইয়া, 'কস্তুরী পাউডার'-এর প্রধান চিকিৎসক হলেন হাকীম মো: আব্দুল করিম (বাংলাদেশ ইউনানী ও আয়ুর্বেদিক বোর্ড এবং স্বাস্থ্য মন্ত্রণালয় কর্তৃক ক্যাটাগরি-এ নিবন্ধিত হাকীম, রেজি নং: ৫৮৪২/২০১৮)। ওনার চেম্বার ও দোকান: জনতা ইউনানী চিকিৎসালয় ও ভেষজ ভান্ডার, দোকান নং- ৩৩ (৩য় তলা), আলীকদম, বান্দরবান পার্বত্য জেলা, আলীকদম, বান্দরবান। (আলীকদম উপজেলা পরিষদ ই-ট্রেড লাইসেন্স নং: TRAD/ALIKADAM/0482/2026)। এই প্রোডাক্টের জন্য ৫০০ টাকা অগ্রিম ডেলিভারি চার্জ প্রযোজ্য।";
    }
    if (/বাজীকরণ\s*হালুয়া|bajikaran|bajikoron|আরিফ|রাঙ্গামাটি|রিজার্ভ\s*বাজার|ব্যাংক\s*এশিয়া/i.test(qLowerFb)) {
      return "জি ভাইয়া, 'বাজীকরণ হালুয়া'-র চিকিৎসক হলেন কবিরাজ মোহাম্মদ আরিফ। ওনার চেম্বার: রাঙ্গামাটি রিজার্ভ বাজার, ব্যাংক এশিয়া পঞ্চম তলা।";
    }
    return "জি ভাইয়া, আমাদের ৩টি প্রধান শাখা ও চেম্বার রয়েছে:\n১. আলীকদম, বান্দরবান পার্বত্য জেলা শাখা: হাকীম মো: আব্দুল করিম — জনতা ইউনানী চিকিৎসালয়, দোকান নং ৩৩ (৩য় তলা), আলীকদম, বান্দরবান পার্বত্য জেলা (কস্তুরী পাউডার, রেজি: ৫৮৪২, ৫০০ টাকা অগ্রিম ডেলিভারি চার্জ)।\n২. রামু/আলীকদম বড়বাজার শাখা: হাকিম মোহাম্মদ শামসুর ইসলাম চৌধুরী — কালাম ভাইয়ের মার্কেট, ৩য় তলা, ৪২ নম্বর দোকান (যৌবনের রাজা)।\n৩. রাঙ্গামাটি শাখা: কবিরাজ মোহাম্মদ আরিফ — রাঙ্গামাটি রিজার্ভ বাজার, ব্যাংক এশিয়া ৫ম তলা (বাজীকরণ হালুয়া)।\n\nএছাড়া সারা দেশে কুরিয়ারে হোম ডেলিভারি সুবিধা রয়েছে। আপনি কোন প্রোডাক্টটি সম্পর্কে জানতে চাচ্ছেন?";
  }

  // License / Certificate / Proof request
  if (isCertificateOrLicenseRequest(customerMessage || qLowerFb)) {
    return "জি ভাইয়া, আমাদের কস্তুরী পাউডার স্বাস্থ্য ও পরিবার কল্যাণ মন্ত্রণালয়ের অধীন বাংলাদেশ ইউনানী ও আয়ুর্বেদিক বোর্ডের ক্যাটাগরি-এ নিবন্ধিত চিকিৎসক হাকীম মো: আব্দুল করিম (রেজি নং: ৫৮৪২/২০১৮)-এর নিজস্ব প্রস্তুতকৃত (জনতা ইউনানী চিকিৎসালয়, আলীকদম, বান্দরবান পার্বত্য জেলা; ই-ট্রেড লাইসেন্স নং: TRAD/ALIKADAM/0482/2026)। আপনার দেখার সুবিধার্থে ওনার সরকারি রেজিস্ট্রেশন সনদপত্র এবং ট্রেড লাইসেন্সের ছবি ইনবক্সে পাঠিয়ে দেওয়া হয়েছে। এটি ১০০% প্রাকৃতিক ও সম্পূর্ণ পার্শ্বপ্রতিক্রিয়ামুক্ত।";
  }

  if (geoSocialProof && (/order|অর্ডার|নিতে চাই|পাঠিয়ে|পাঠান|delivery|পার্সেল/i.test(qLowerFb) || qLowerFb.includes("থেকে"))) {
    const isKasturi = /কস্তুরী|kosturi|kasturi|আব্দুল করিম/i.test(qLowerFb);
    if (isKasturi) {
      return `${geoSocialProof} কস্তুরী পাউডার অর্ডার কনফার্ম করতে আপনার: ১. নাম, ২. সম্পূর্ণ ডেলিভারি ঠিকানা (জেলা ও থানা সহ), ৩. সচল মোবাইল নম্বর লিখে পাঠান। উল্লেখ্য, এই প্রোডাক্টের জন্য ৫০০ টাকা ডেলিভারি চার্জ অগ্রিম প্রযোজ্য, বাকি টাকা পার্সেল হাতে পেয়ে পরিশোধ করবেন।`;
    }
    return `${geoSocialProof} অর্ডার কনফার্ম করতে অনুগ্রহ করে আপনার: ১. নাম, ২. সম্পূর্ণ ডেলিভারি ঠিকানা (জেলা ও থানা সহ), ৩. সচল মোবাইল নম্বর লিখে পাঠান। কোনো অগ্রিম পেমেন্ট নেই, পার্সেল হাতে পেয়ে মূল্য পরিশোধ করবেন।`;
  }
  if (qLowerFb.includes("kemon") || qLowerFb.includes("কেমন")) {
    return "আলহামদুলিল্লাহ ভাইয়া, আল্লাহর রহমতে ভালো আছি। আপনি কেমন আছেন? আপনাকে কীভাবে সাহায্য করতে পারি বলুন।";
  }
  if (qLowerFb.includes("salam") || qLowerFb.includes("assalamu") || qLowerFb.includes("সালাম")) {
    return "ওয়ালাইকুম আসসালাম ভাইয়া। গ্রীন হেলথ ইউনানী ফার্মেসীতে আপনাকে স্বাগতম। কীভাবে সহযোগিতা করতে পারি বলুন?";
  }
  if (qLowerFb.includes("hi") || qLowerFb.includes("hello") || qLowerFb.includes("হাই") || qLowerFb.includes("হ্যালো")) {
    return "জি ভাইয়া, আসসালামু আলাইকুম। বলুন, কীভাবে সাহায্য করতে পারি?";
  }

  // Available products / Catalog query ("ki ki paoya jai", "ki ki product ase", "কি কি প্রোডাক্ট আছে", "কি কি ওষুধ আছে", etc.)
  if (/(?:ki\s*ki|kiki|কী\s*কী|কি\s*কি)\s*(?:product|item|osudh|oushodh|medicine|মেডিসিন|ওষুধ|ঔষধ|আইটেম|প্রোডাক্ট|মাল)/i.test(qLowerFb) ||
      /(?:product|item|osudh|oushodh|medicine|ওষুধ|ঔষধ)\s*(?:list|ক্যাটালগ|catalog|নাম|name|ki\s*ki)/i.test(qLowerFb) ||
      /(?:akhane|ekhane|এখানে|ফার্মেসীতে|কাছে|kache)\s*(?:ki\s*ki|kiki|কী\s*কী|কি\s*কি)\s*(?:paoya|pawa|আছে|ase|ache|পাওয়া|পাওয়া)/i.test(qLowerFb) ||
      /(?:ki\s*ki|kiki|কী\s*কী|কি\s*কি)\s*(?:paoya|pawa|পাওয়া|পাওয়া)\s*(?:jai|jay|যায়|যায়)/i.test(qLowerFb) ||
      /(?:ki\s*ki|kiki|কী\s*কী|কি\s*কি)\s*(?:ase|ache|আছে)/i.test(qLowerFb)) {
    return "জি ভাইয়া, আমাদের এখানে মূলত পুরুষদের স্বাস্থ্য ও শারীরিক শক্তি বৃদ্ধির ৩টি বিশেষ কোর্স পাওয়া যায়:\n\n১. যৌবনের রাজা (২০০ গ্রাম) — ৩,০০০ টাকা\nচিকিৎসক: হাকিম মোহাম্মদ শামসুর ইসলাম চৌধুরী (রামু, আলীকদম বড়বাজার, কালাম ভাইয়ের মার্কেট, ৩য় তলা, ৪২ নম্বর দোকান)।\n\n২. কস্তুরী পাউডার (২৫০ গ্রাম) — ২,৮০০ টাকা (৫০০ টাকা অগ্রিম ডেলিভারি চার্জ প্রযোজ্য)\nচিকিৎসক: হাকীম মো: আব্দুল করিম (জনতা ইউনানী চিকিৎসালয়, দোকান ৩৩, ৩য় তলা, আলীকদম, বান্দরবান পার্বত্য জেলা। ক্যাটাগরি-এ রেজি: ৫৮৪২)।\n\n৩. বাজীকরণ হালুয়া (৩৫০ গ্রাম) — ২,৫০০ টাকা\nচিকিৎসক: কবিরাজ মোহাম্মদ আরিফ (রাঙ্গামাটি রিজার্ভ বাজার, ব্যাংক এশিয়া ৫ম তলা)।\n\nআপনার শারীরিক সমস্যা অনুযায়ী কোন প্রোডাক্টটি প্রয়োজন ভাইয়া?";

  }

  // "Ji na" / "No" / negative short reply — respond warmly, never push sales
  if (/^(ji\s*na|jina|na$|nah|no$|nope)$/i.test(qLowerFb.trim())) {
    return "আচ্ছা ভাইয়া, কোনো সমস্যা নেই! মাশাআল্লাহ, সুস্থ থাকাটাই সবচেয়ে বড় নিয়ামত। যখন কোনো প্রয়োজন হবে, নির্দ্বিধায় জানাবেন। ভালো থাকবেন!";
  }

  // Smart contextual fallback — give relevant reply based on keywords
  if (/(?:সমস্যা|problem|দুর্বল|শক্তি|stamina|power)/i.test(qLowerFb)) {
    return "জি ভাইয়া, আপনার সমস্যাটা কতদিন ধরে? এবং আপনার বয়স কত? এই তথ্যগুলো দিলে সঠিক পরামর্শ দিতে পারব।";
  }
  if (/(?:দাম|price|টাকা|koto|কত|প্রাইস)/i.test(qLowerFb)) {
    if (/বাজীকরণ|bajikaran|halua|হালুয়া|ন্যাচারাল|natural/i.test(qLowerFb)) {
      return "জি ভাইয়া, আমাদের বাজীকরণ হালুয়ার অফার মূল্য ২,০০০ টাকা (৩৫০ গ্রাম হালুয়া)। সারা দেশে ক্যাশ অন ডেলিভারিতে পার্সেল হাতে পেয়ে পরিশোধ করবেন।";
    }
    return "জি ভাইয়া, আমাদের প্রিমিয়াম ১ মাসের ফুল কোর্সের অফার মূল্য ২,৯০০ টাকা লাগবে। ক্যাশ অন ডেলিভারিতে পার্সেল হাতে পেয়ে পরিশোধ করবেন।";
  }
  // Final safe fallback
  return "জি ভাইয়া, বলুন — আপনার কী জানার ছিল বা কোন সমস্যা নিয়ে কথা বলতে চাচ্ছেন? আমি এখানেই আছি।";
}


// ── Send Sender Action (typing_on, mark_seen) via Facebook Graph API ───────────
async function sendSenderAction(recipientId, action = "typing_on", pageAccessToken = PAGE_TOKEN) {
  try {
    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        sender_action: action
      })
    });
  } catch (err) {}
}

// ── Calculate Realistic Human Typing Delay ───────────────────────────────────
function calculateHumanTypingDelay(replyText) {
  const charCount = (replyText || "").length;
  // Natural reading & thinking baseline: 1.8s
  // Human typing speed: ~25ms per character
  // Short message (30-60 chars): ~2.2 - 3.2s
  // Medium message (70-150 chars): ~3.8 - 6.0s
  // Long message (160+ chars): ~6.5 - 9.5s
  const rawDelay = 1800 + (charCount * 25);
  const jitter = (Math.random() * 800) - 400; // ±400ms random variation
  const finalDelay = Math.min(9500, Math.max(2200, Math.round(rawDelay + jitter)));
  return finalDelay;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ── Send Message via Facebook Graph API ──────────────────────────────────────
async function sendFacebookMessage(recipientId, text, pageAccessToken = PAGE_TOKEN, replyToMid = null, messageTag = null) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`;
  const payload = {
    recipient: { id: recipientId },
    messaging_type: messageTag ? "MESSAGE_TAG" : "RESPONSE",
    message: { text }
  };
  if (messageTag) {
    payload.tag = messageTag;
  }
  if (replyToMid && !messageTag) {
    payload.reply_to = { mid: replyToMid };
  }

  let res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  let data = await res.json().catch(() => null);

  // If outside 24-hour messaging window (FB error code 10), retry with MESSAGE_TAG
  if (!res.ok && data?.error?.code === 10 && !messageTag) {
    console.log(`[FB_SEND_TAG_RETRY] Customer ${recipientId} is outside 24h window. Retrying with MESSAGE_TAG CONFIRMED_EVENT_UPDATE...`);
    payload.messaging_type = "MESSAGE_TAG";
    payload.tag = "CONFIRMED_EVENT_UPDATE";
    delete payload.reply_to;
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    data = await res.json().catch(() => null);
  }

  // If Facebook rejects reply_to parameter, fall back automatically to standard send
  if (!res.ok && replyToMid && data?.error) {
    console.warn(`[FB_SEND_REPLY_TO_WARN] Error with reply_to (${replyToMid}):`, data.error.message, "- Falling back to standard send without reply_to");
    delete payload.reply_to;
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    data = await res.json().catch(() => null);
  }

  if (data?.message_id) {
    recordBotSentMessage(data.message_id, text);
  } else if (text) {
    recordBotSentMessage(null, text);
  }

  return { status: res.status, data };
}

// Send Product Video via Facebook
async function sendFacebookVideo(recipientId, productName, pageAccessToken = PAGE_TOKEN) {
  const videoDirs = [
    path.join(process.cwd(), "data", "Product Video"),
    path.join(process.cwd(), "public", "videos"),
    path.join(process.cwd(), "public", "Product Video"),
  ];
  const exts = [".mp4", ".mov", ".avi", ".webm"];
  const norm = (s) => (s || "").toLowerCase().replace(/[\s_-]+/g, "");
  const productNorm = norm(productName);
  for (const dir of videoDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const vfile of files) {
      const fileLower = vfile.toLowerCase();
      const hasVideoExt = exts.some(e => fileLower.endsWith(e));
      if (!hasVideoExt) continue;
      if (!productNorm || norm(fileLower).includes(productNorm)) {
        const fullPath = path.join(dir, vfile);
        try {
          const fileBuffer = fs.readFileSync(fullPath);
          const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`;
          const formData = new FormData();
          formData.append("recipient", JSON.stringify({ id: recipientId }));
          formData.append("message", JSON.stringify({ attachment: { type: "video", payload: { is_reusable: true } } }));
          formData.append("filedata", new Blob([fileBuffer], { type: "video/mp4" }), vfile);
          const res = await fetch(url, { method: "POST", body: formData });
          if (res.ok) { console.log(`[FB_BOT_VIDEO_OK] Sent video "${vfile}" to ${recipientId}`); return true; }
        } catch (e) { console.warn("[FB_BOT_VIDEO_ERR]", e.message); }
      }
    }
  }
  return false;
}

const KASTURI_POWDER_IMAGES = [
  "kasturi_powder_1.jpg",
  "kasturi_powder_2.jpg",
  "kasturi_powder_3.jpg",
  "kasturi_powder_4.jpg",
  "kasturi_powder_5.jpg",
];

function isMultiplePicturesRequest(text) {
  if (!text) return false;
  const q = text.toLowerCase();
  return (
    /কয়েকটা|কয়েকটি|কয়েকটা|কয়েকটি|সব|সবগুলো|সবগুলি|আরও|আরো|বেশ\s*কয়েক|কয়টা|কয়টা/i.test(q) ||
    /multiple|several|all\s*pics?|more\s*pics?|all\s*photos?|different\s*pics?/i.test(q) ||
    /(?:২|3|৩|4|৪|কয়েক|কয়েক)\s*(?:টা|টি)\s*(?:ছবি|সবি|pic|photo)/i.test(q) ||
    /(?:aro|koyekta|sob|gula|shob)\s*(?:chobi|sobi|pic|photo)/i.test(q)
  );
}

function getNextKasturiImages(previouslySent = [], isMultiple = false) {
  let available = KASTURI_POWDER_IMAGES.filter(img => !previouslySent.includes(img));
  if (available.length === 0) {
    available = [...KASTURI_POWDER_IMAGES];
  }

  let imagesToSend = [];
  if (isMultiple) {
    const count = Math.min(available.length, 3);
    imagesToSend = available.slice(0, count);
  } else {
    imagesToSend = [available[0]];
  }

  const combined = [...new Set([...previouslySent, ...imagesToSend])];
  const updatedHistory = combined.length >= KASTURI_POWDER_IMAGES.length ? imagesToSend : combined;

  return { imagesToSend, updatedHistory };
}

const BAJIKARAN_HALUA_IMAGES = [
  "bajikaran_halua_delivery.jpg",
  "bajikaran_halua_table.jpg",
  "bajikaran_halua_chamber.jpg",
  "bajikaran_1.jpg",
  "bajikaran_2.jpg"
];

function getNextBajikaranImages(previouslySent = [], isMultiple = false) {
  let available = BAJIKARAN_HALUA_IMAGES.filter(img => !previouslySent.includes(img));
  if (available.length === 0) {
    available = [...BAJIKARAN_HALUA_IMAGES];
  }

  let imagesToSend = [];
  if (isMultiple) {
    const count = Math.min(available.length, 3);
    imagesToSend = available.slice(0, count);
  } else {
    imagesToSend = [available[0]];
  }

  const combined = [...new Set([...previouslySent, ...imagesToSend])];
  const updatedHistory = combined.length >= BAJIKARAN_HALUA_IMAGES.length ? imagesToSend : combined;

  return { imagesToSend, updatedHistory };
}

function isPictureRequest(text) {
  if (!text) return false;
  const q = text.toLowerCase();
  return (
    /chobi|cobi|sobi|shobi|pic|pik|photo|foto|picture|image|img/i.test(q) ||
    /ছবি|সবি|ছবিকি|সবিকি|পিক|পিকচার|ফটো|ইমেজ/i.test(q) ||
    /dekhte|dekte|দেখতে কেমন|কি রকম দেখতে|কিরকম দেখতে|কেমন দেখতে|বাস্তবে কেমন|সামনে থেকে|দেখব|দেখবো|দেখান|দেখাবেন|দেখতে চাই|দেতে পারবা|দেখতে পারি/i.test(q)
  );
}

function isVideoRequest(text) {
  if (!text) return false;
  const q = text.toLowerCase();
  return (
    /video|vedeo|vedio|ভিডিও|vid/i.test(q) &&
    !/chobi|pic|photo|ছবি/i.test(q)
  );
}

function isCertificateOrLicenseRequest(text) {
  if (!text) return false;
  const q = text.toLowerCase();
  return (
    /certificate|licen[sc]e|regist|\breg\b|proof|dokhol|kagoj|sanad|onumodon/i.test(q) ||
    /সা[রট্রি]+ফিকে[টড]|লাই[সছ][েএ]?[নন][্সস]|সন[দত]|নিবন্ধন|অনুমোদন|কাগজ|প্রমা[ণন]|প্রুফ|ডকুমেন্ট/i.test(q) ||
    /(?:ডাক্তার|হাকিম|প্রোডাক্ট|ওষুধ|ঔষধ|কোম্পানি|পেজ).*(?:প্রমা[ণন]|আসল|বৈধ|সত্য|অনুমোদন|কিনা|কে|নাম|সা[রট্রি]+ফিকে|লাই[সছ])/i.test(q) ||
    /(?:তৈরি|বানাইছে|বানায়|বানায়|প্রস্তুত).*(?:কে|কার|নাম|হাকিম|ডাক্তার)/i.test(q) ||
    /(?:ছবি|সবি|pic|photo|দেখ|দাও|দেন|পাঠা|দেখা).*(?:সা[রট্রি]+ফিকে|লাই[সছ]|সন[দত]|কাগজ|অনুমোদন|প্রমা[ণন])/i.test(q) ||
    /(?:সা[রট্রি]+ফিকে|লাই[সছ]|সন[দত]|কাগজ|অনুমোদন|প্রমা[ণন]).*(?:ছবি|সবি|pic|photo|দেখ|দাও|দেন|পাঠা|দেখা|আসে|আছে|হবে|পাব)/i.test(q) ||
    /(?:হাকিম|ডাক্তার|কবিরাজ|চিকিৎসক).*(?:সার্টিফিকেট|সাটিফিকেট|লাইসেন্স|লাইসন্স|সনদ|কাগজ|প্রমাণ|প্রমান)/i.test(q)
  );
}

const CUSTOMER_REVIEW_IMAGES = [
  "customer_review_1.jpg",
];

function isReviewRequest(text) {
  if (!text) return false;
  const q = text.toLowerCase();
  return (
    /review|riview|rebiw|feed\s*back|customer\s*review|client\s*review/i.test(q) ||
    /রিভিউ|রিভিউস|ফিডব্যাক|প্রুফ|কাস্টমার\s*রিভিউ/i.test(q) ||
    /(?:আগে|আগে\s*কেহ|এর\s*আগে)\s*(?:কেউ|কেহ|কোনো\s*ভাই|কোন\s*ভাই)\s*(?:নিয়েছে|নিছে|নিছেন|ব্যবহার|উপকার|পাইছে|পেয়েছে|খাইছে|খেয়েছে)/i.test(q) ||
    /(?:কেউ\s*কি|কেহ\s*কি)\s*(?:উপকার|রেজাল্ট|ফল)\s*(?:পাইছে|পেয়েছে|পায়|পেয়েছেন|পাইছেন)/i.test(q) ||
    /(?:age\s*keu|keu\s*ki)\s*(?:nise|babsar|upokar|result|paise|paice|khaise)/i.test(q) ||
    /(?:রিভিউ|ফিডব্যাক|প্রমাণ|প্রমান).*(?:দেখান|দেখবো|দেখব|পাঠান|দেন|দাও|আছে|আসে|হবে|পাব|দেখতে)/i.test(q) ||
    /(?:কাস্টমার|গ্রাহক).*(?:মতামত|ছবি|সবি|রিভিউ|উপকার|রেজাল্ট)/i.test(q)
  );
}

const DOKAN_IMAGE_FILE = "jonota_unani_dokan.jpg";

function isDokanOrChamberRequest(text) {
  if (!text) return false;
  const q = text.toLowerCase();
  return (
    /dokan|chamber|thikana|address|location|chember|shorashori/i.test(q) ||
    /দোকান|চেম্বার|ঠিকানা|লোকেশন|সরাসরি|আলীকদম|বান্দরবান/i.test(q) ||
    /(?:dekha|দেখা|meet|chamber|চেম্বার|ঠিকানা|thikana|address|dokan|দোকান|location|লোকেশন|shorashori|সরাসরি)\s*(?:kora|korbo|korte|করব|করতে|করবো|kothay|কোথায়|ase|আছে|jabo|যাব|পাবো|pabo)?/i.test(q) ||
    /(?:kothay|কোথায়|koy|কই)\s*(?:dekha|chamber|চেম্বার|dokan|দোকান|apnader|আপনাদের|pabo|পাবো)/i.test(q) ||
    /(?:apnader\s*bari|আপনার\s*বাড়ি|apnar\s*bari|আপনাদের\s*বাসা)/i.test(q) ||
    /(?:দোকান|চেম্বার|দোকানের|চেম্বারের|ঠিকানার).*(?:ছবি|ফটো|পিক|পিকচার|pic|photo|image|view|দেখান|পাঠান|দেন)/i.test(q) ||
    /(?:ছবি|ফটো|পিক|পিকচার|pic|photo).*(?:দোকান|চেম্বার|দোকানের|চেম্বারের)/i.test(q)
  );
}

async function sendFacebookImage(recipientId, imageFileOrPath, pageAccessToken = PAGE_TOKEN) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`;
  const filename = path.basename(imageFileOrPath);

  const candidateDirs = [
    path.join(process.cwd(), "public", "reviews"),
    path.join(process.cwd(), "data", "reviews"),
    path.join(process.cwd(), "public", "certificates"),
    path.join(process.cwd(), "data", "certificates"),
    path.join(process.cwd(), "data", "Product Image"),
    path.join(process.cwd(), "public", "products"),
    path.join(process.cwd(), "public", "Product Image"),
    path.join(process.cwd(), "public", "dokan"),
    path.join(process.cwd(), "data", "dokan"),
  ];

  let localPath = null;
  if (fs.existsSync(imageFileOrPath)) {
    localPath = imageFileOrPath;
  } else {
    for (const dir of candidateDirs) {
      const p = path.join(dir, filename);
      if (fs.existsSync(p)) {
        localPath = p;
        break;
      }
    }
  }

  // 1. Upload directly from disk via FormData
  if (localPath) {
    try {
      const fileBuffer = fs.readFileSync(localPath);
      const ext = path.extname(localPath).slice(1).toLowerCase() || "jpeg";
      const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

      const formData = new FormData();
      formData.append("recipient", JSON.stringify({ id: recipientId }));
      formData.append("message", JSON.stringify({
        attachment: {
          type: "image",
          payload: { is_reusable: true }
        }
      }));
      formData.append("filedata", new Blob([fileBuffer], { type: mimeType }), filename);

      const res = await fetch(url, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        if (data?.message_id) recordBotSentMessage(data.message_id);
        console.log(`[FB_BOT_IMG_FILE_OK] Sent ${filename} to ${recipientId}`);
        return true;
      } else {
        console.warn(`[FB_BOT_IMG_FILE_WARN] Status ${res.status}:`, data);
      }
    } catch (fileErr) {
      console.warn(`[FB_BOT_IMG_FILE_ERR]`, fileErr.message);
    }
  }

  // 2. Fallback: URL send
  try {
    const publicUrl = `https://greenhelth.duckdns.org/api/products/image?file=${encodeURIComponent(filename)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "image",
            payload: {
              url: publicUrl,
              is_reusable: true
            }
          }
        },
        messaging_type: "RESPONSE"
      })
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      console.log(`[FB_BOT_IMG_URL_OK] Sent via URL ${publicUrl} to ${recipientId}`);
      return true;
    }
  } catch (urlErr) {}

  return false;
}


const BENGALI_WORDS_1_TO_100 = {
  0: 'শূন্য', 1: 'এক', 2: 'দুই', 3: 'তিন', 4: 'চার', 5: 'পাঁচ', 6: 'ছয়', 7: 'সাত', 8: 'আট', 9: 'নয়', 10: 'দশ',
  11: 'এগারো', 12: 'বারো', 13: 'তেরো', 14: 'চৌদ্দ', 15: 'পনেরো', 16: 'ষোলো', 17: 'সতেরো', 18: 'আঠারো', 19: 'উনিশ', 20: 'বিশ',
  21: 'একুশ', 22: 'বাইশ', 23: 'তেইশ', 24: 'চব্বিশ', 25: 'পঁচিশ', 26: 'ছাব্বিশ', 27: 'সাতাশ', 28: 'আঠাশ', 29: 'উনত্রিশ', 30: 'ত্রিশ',
  31: 'একত্রিশ', 32: 'বত্রিশ', 33: 'তেত্রিশ', 34: 'চৌত্রিশ', 35: 'পঁয়ত্রিশ', 36: 'ছত্রিশ', 37: 'সাঁইত্রিশ', 38: 'আটত্রিশ', 39: 'উনচল্লিশ', 40: 'চল্লিশ',
  41: 'একচল্লিশ', 42: 'বিয়াল্লিশ', 43: 'তেতাল্লিশ', 44: 'চুয়াল্লিশ', 45: 'পঁয়তাল্লিশ', 46: 'ছেচল্লিশ', 47: 'সাতচল্লিশ', 48: 'আটচল্লিশ', 49: 'উনপঞ্চাশ', 50: 'পঞ্চাশ',
  51: 'একান্ন', 52: 'বায়ান্ন', 53: 'তিপ্পান্ন', 54: 'চুয়ান্ন', 55: 'পঞ্চান্ন', 56: 'ছাপ্পান্ন', 57: 'সাতান্ন', 58: 'আটান্ন', 59: 'উনষাট', 60: 'ষাট',
  61: 'একষট্টি', 62: 'বাষট্টি', 63: 'তেষট্টি', 64: 'চৌষট্টি', 65: 'পঁয়ষট্টি', 66: 'ছেষট্টি', 67: 'সাতষট্টি', 68: 'আটষট্টি', 69: 'উনসত্তর', 70: 'সত্তর',
  71: 'একাত্তর', 72: 'বাহাত্তর', 73: 'তিয়াত্তর', 74: 'চুয়াত্তর', 75: 'পঁচাত্তর', 76: 'ছিয়াত্তর', 77: 'সাতাত্তর', 78: 'আটাত্তর', 79: 'উনাশি', 80: 'আশি',
  81: 'একাশি', 82: 'বিরাশি', 83: 'তিরাশি', 84: 'চুরাশি', 85: 'পঁচাশি', 86: 'ছিয়াশি', 87: 'সাতাশি', 88: 'অষ্টআশি', 89: 'উননব্বই', 90: 'নব্বই',
  91: 'একানব্বই', 92: 'বিরানব্বই', 93: 'তিরানব্বই', 94: 'চুরানব্বই', 95: 'পঁচানব্বই', 96: 'ছিয়ানব্বই', 97: 'সাতানব্বই', 98: 'আটানব্বই', 99: 'নিরানব্বই', 100: 'একশত'
};

function convertBengaliNumbersToWords(text) {
  if (!text) return '';
  let t = text;

  // 1. Phone numbers: 01XXXXXXXXX or ০১৮XXXXXXXX
  t = t.replace(/(?:\+?880|0)?1[3-9]\d{2}[-\s]?\d{6}/g, (match) => {
    const digits = match.replace(/\D/g, '');
    const digitWords = ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
    const clean = digits.length === 11 ? digits : ('0' + digits);
    const p1 = clean.slice(0, 5).split('').map(d => digitWords[parseInt(d, 10)]).join(' ');
    const p2 = clean.slice(5).split('').map(d => digitWords[parseInt(d, 10)]).join(' ');
    return p1 + ', ' + p2;
  });

  t = t.replace(/(?:০)?১[৩-৯][০-৯]{2}[-\s]?[০-৯]{6}/g, (match) => {
    const en = match.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)).replace(/\D/g, '');
    const digitWords = ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
    const clean = en.length === 11 ? en : ('0' + en);
    const p1 = clean.slice(0, 5).split('').map(d => digitWords[parseInt(d, 10)]).join(' ');
    const p2 = clean.slice(5).split('').map(d => digitWords[parseInt(d, 10)]).join(' ');
    return p1 + ', ' + p2;
  });

  // 2. Specific registration / license codes & years
  t = t.replace(/৫৮৪২\/২০১৮|5842\/2018/g, 'পাঁচ আট চার দুই, বাই, দুই হাজার আঠারো');
  t = t.replace(/৫৮৪২|5842/g, 'পাঁচ আট চার দুই');
  t = t.replace(/TRAD\/ALIKADAM\/0482\/2026/gi, 'ট্রেড লাইসেন্স শূন্য চার আট দুই, বাই, দুই হাজার ছাব্বিশ');
  t = t.replace(/০৪৮২|0482/g, 'শূন্য চার আট দুই');
  t = t.replace(/২০২৬|2026/g, 'দুই হাজার ছাব্বিশ');
  t = t.replace(/২০১৮|2018/g, 'দুই হাজার আঠারো');

  // 3. Ordinals (১ম, ২য়, ৩য়, ইত্যাদি)
  t = t.replace(/[১1]ম/g, 'প্রথম');
  t = t.replace(/[২2]য়/g, 'দ্বিতীয়');
  t = t.replace(/[৩3]য়/g, 'তৃতীয়');
  t = t.replace(/[৪4]র্থ/g, 'চতুর্থ');
  t = t.replace(/[৫5]ম/g, 'পঞ্চম');

  // 4. Large amounts & common prices
  t = t.replace(/[২2][,.]?[৮8][০0][০0]/g, 'দুই হাজার আটশত');
  t = t.replace(/[২2][,.]?[৩3][০0][০0]/g, 'দুই হাজার তিনশত');
  t = t.replace(/[২2][,.]?[৯9][০0][০0]/g, 'দুই হাজার নয়শত');
  t = t.replace(/[৩3][,.]?[৫5][০0][০0]/g, 'তিন হাজার পাঁচশত');
  t = t.replace(/[৩3][,.]?[০0][০0][০0]/g, 'তিন হাজার');
  t = t.replace(/[৪4][,.]?[৫5][০0][০0]/g, 'চার হাজার পাঁচশত');
  t = t.replace(/[১1][,.]?[৫5][০0][০0]/g, 'এক হাজার পাঁচশত');
  t = t.replace(/[১1][,.]?[০0][০0][০0]/g, 'এক হাজার');
  t = t.replace(/[৫5][০0][০0]/g, 'পাঁচশত');
  t = t.replace(/[২2][৫5][০0]/g, 'দুইশত পঞ্চাশ');
  t = t.replace(/[২2][০0][০0]/g, 'দুইশত');
  t = t.replace(/[১1][৫5][০0]/g, 'একশত পঞ্চাশ');
  t = t.replace(/[১1][২2][০0]/g, 'একশত বিশ');
  t = t.replace(/[১1][০0][০0]/g, 'একশত');

  // 5. Bullet lists (১), ২), ৩) or ১., ২., ৩. or 1), 2) etc.)
  t = t.replace(/(?:^|\n)\s*(?:[১1][\)\.\-:]|\([১1]\))\s*/g, '\nএক, ');
  t = t.replace(/(?:^|\n)\s*(?:[২2][\)\.\-:]|\([২2]\))\s*/g, '\nদুই, ');
  t = t.replace(/(?:^|\n)\s*(?:[৩3][\)\.\-:]|\([৩3]\))\s*/g, '\nতিন, ');
  t = t.replace(/(?:^|\n)\s*(?:[৪4][\)\.\-:]|\([৪4]\))\s*/g, '\nচার, ');
  t = t.replace(/(?:^|\n)\s*(?:[৫5][\)\.\-:]|\([৫5]\))\s*/g, '\nপাঁচ, ');
  t = t.replace(/(?:^|\n)\s*(?:[৬6][\)\.\-:]|\([৬6]\))\s*/g, '\nছয়, ');
  t = t.replace(/(?:^|\n)\s*(?:[৭7][\)\.\-:]|\([৭7]\))\s*/g, '\nসাত, ');
  t = t.replace(/(?:^|\n)\s*(?:[৮8][\)\.\-:]|\([৮8]\))\s*/g, '\nআট, ');
  t = t.replace(/(?:^|\n)\s*(?:[৯9][\)\.\-:]|\([৯9]\))\s*/g, '\nনয়, ');
  t = t.replace(/(?:^|\n)\s*(?:(?:১০|10)[\)\.\-:]|\((?:১০|10)\))\s*/g, '\nদশ, ');

  t = t.replace(/\b(?:[১1][\)\.]|\([১1]\))\s*/g, 'এক, ');
  t = t.replace(/\b(?:[২2][\)\.]|\([২2]\))\s*/g, 'দুই, ');
  t = t.replace(/\b(?:[৩3][\)\.]|\([৩3]\))\s*/g, 'তিন, ');
  t = t.replace(/\b(?:[৪4][\)\.]|\([৪4]\))\s*/g, 'চার, ');
  t = t.replace(/\b(?:[৫5][\)\.]|\([৫5]\))\s*/g, 'পাঁচ, ');
  t = t.replace(/\b(?:[৬6][\)\.]|\([৬6]\))\s*/g, 'ছয়, ');

  // 6. Common phrases with numbers
  t = t.replace(/[৩3]\s*(?:থেকে|-)\s*[৫5]\s*দিন/g, 'তিন থেকে পাঁচ দিন');
  t = t.replace(/[১1]\s*(?:থেকে|-)\s*[২2]\s*দিন/g, 'এক থেকে দুই দিন');
  t = t.replace(/[২2]\s*(?:থেকে|-)\s*[৪4]\s*দিন/g, 'দুই থেকে চার দিন');
  t = t.replace(/[১1]\s*মাস/g, 'এক মাস');
  t = t.replace(/[১1]\s*চামচ/g, 'এক চামচ');
  t = t.replace(/[৬6]\s*টি/g, 'ছয়টি');
  t = t.replace(/[১1]\s*টি/g, 'একটি');
  t = t.replace(/[২2]\s*টি/g, 'দুটি');
  t = t.replace(/[৩3]\s*টি/g, 'তিনটি');
  t = t.replace(/[৪4]\s*টি/g, 'চারটি');
  t = t.replace(/[৫5]\s*টি/g, 'পাঁচটি');
  t = t.replace(/[১1][০0]\s*টি/g, 'দশটি');

  // 7. Numbers 0-100 (both Bengali and English digits)
  t = t.replace(/[০-৯0-9]{1,3}/g, (match) => {
    const en = match.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
    const num = parseInt(en, 10);
    if (!isNaN(num) && BENGALI_WORDS_1_TO_100[num]) {
      return BENGALI_WORDS_1_TO_100[num];
    }
    return match;
  });

  // 8. Any remaining single digits
  const singleDigits = ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
  t = t.replace(/[০-৯]/g, d => singleDigits['০১২৩৪৫৬৭৮৯'.indexOf(d)] || d);
  t = t.replace(/[0-9]/g, d => singleDigits[parseInt(d, 10)] || d);

  return t;
}

function prepareBangladeshiTTSAudioText(rawText) {
  if (!rawText) return "";
  // Strip any accidental text-referencing words from spoken voice notes
  rawText = rawText
    .replace(/(এখানে|ফেসবুকে)?\s*(তো)?\s*(সরাসরি)?\s*(অডিও|ভয়েস|ভয়েস)\s*(মেসেজ)?\s*(পাঠানোর)?\s*(সুবিধা\s*নেই|পাঠাতে\s*পারি\s*না)[^\n।.!?]*[।.!?]?/gi, "")
    .replace(/(আমি\s*)?আপনাকে\s*(টেক্সট[এে]?|লিখে|মেসেজে?)\s*(বিস্তারিত\s*)?(সবকিছু\s*)?(বুঝিয়ে|বোঝানোর|জানিয়ে|বলছি)[^\n।.!?]*[।.!?]?/gi, "আমি আপনাকে মুখে সবকিছু বুঝিয়ে বলছি।")
    .replace(/(টেক্সট[এে]?|মেসেজে?|লিখে)\s*(বুঝিয়ে|বলছি|জানিয়ে\s*দিচ্ছি)/gi, "মুখে বুঝিয়ে বলছি")
    .replace(/\bটেক্সটে?\b/gi, "ভয়েসে")
    .replace(/লিখে\s*দিচ্ছি/gi, "মুখে বুঝিয়ে বলছি")
    .replace(/লিখে\s*জানিয়ে/gi, "মুখে বুঝিয়ে");
  if (!rawText) return "";
  let t = rawText.replace(/[*#_~`>|]/g, "").replace(/\s+/g, " ").trim();
  t = t
    .replace(/\(\s*(?:বিকাশ\s*\/?\s*নগদ\s*)?হেল্পলাইন\s*[:=]?\s*([0-9০-৯\-]+)\s*\)/gi, "আমাদের হেল্পলাইন নম্বর $1, ")
    .replace(/\(\s*([0-9০-৯\-]{10,15})\s*\)/gi, "আমাদের হেল্পলাইন নম্বর $1, ")
    .replace(/হেল্পলাইন\s*[:=]/gi, "হেল্পলাইন নম্বর ")
    .replace(/[()]/g, ", ")
    .replace(/রেজাউল\s*করিম/gi, "মো: আব্দুল করিম")
    .replace(/রেজাউল/gi, "রিয়াজুল")
    .replace(/re[aj]aul\s*karim/gi, "মো: আব্দুল করিম")
    .replace(/re[aj]aul/gi, "রিয়াজুল")
    .replace(/\bদেবেন\b/g, "দিবেন")
    .replace(/\bনেবেন\b/g, "নিবেন")
    .replace(/\bজল\b/g, "পানি")
    .replace(/\bদাদা\b/g, "ভাইয়া")
    .replace(/নাম\s*=/gi, "নাম, ")
    .replace(/জেলা\s*=/gi, "জেলা, ")
    .replace(/থানা\s*=/gi, "থানা, ")
    .replace(/রিসিভ ঠিকানা\s*=/gi, "রিসিভ ঠিকানা, ")
    .replace(/নাম্বার\s*=/gi, "মোবাইল নাম্বার, ")
    .replace(/=/g, " ")
    .replace(/২[,.]?৯০০|2[,.]?900/g, "দুই হাজার নয়শত");
  t = convertBengaliNumbersToWords(t);

  t = t
    .replace(/জি\s*ভাইয়া(?![,\s]*[,])/gi, "জি ভাইয়া, ")
    .replace(/রিয়াজুল\s*করিম\s*বলছি(?![,\s]*[,।])/gi, "মো: আব্দুল করিম বলছি। ")
    .replace(/ইনশাআল্লাহ(?![,\s]*[,])/gi, "ইনশাআল্লাহ, ")
    .replace(/আল্লাহর\s*রহমতে(?![,\s]*[,])/gi, "আল্লাহর রহমতে, ")
    .replace(/কোনো\s*চিন্তা\s*করবেন\s*না(?![,\s]*[,])/gi, "কোনো চিন্তা করবেন না ভাইয়া, ")
    .replace(/,\s*,+/g, ",")
    .replace(/\s+/g, " ")
    .trim();

  return t;
}

// ── Transcribe Customer Voice Notes (Groq Whisper Large V3 Primary + Gemini Fallback) ───
const VALID_GROQ_STT_KEY = "gsk_Do7rt6SmudBYJ3qbWbG0" + "WGdyb3FYSCZWQMKoFMjIvG5QJazFokds";
const GROQ_STT_KEY = (process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes("yb0FY")) ? process.env.GROQ_API_KEY : VALID_GROQ_STT_KEY;

async function transcribeAudioWithGemini(audioUrl, pageAccessToken = PAGE_TOKEN) {
  try {
    const url = audioUrl.includes("access_token") ? audioUrl : audioUrl + (audioUrl.includes("?") ? "&" : "?") + "access_token=" + pageAccessToken;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(12000) });
    if (!res.ok) return "";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) return "";

    // 1. Primary: Groq Whisper Large V3 (Industry leader in Bengali accuracy)
    if (GROQ_STT_KEY) {
      try {
        const mime = (res.headers.get("content-type") || "audio/ogg").split(";")[0];
        const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "mp3";
        const blob = new Blob([buf], { type: mime });
        const form = new FormData();
        form.append("file", blob, `voice.${ext}`);
        form.append("model", "whisper-large-v3");
        form.append("language", "bn");
        form.append("temperature", "0");
        form.append("prompt", "আসসালামু আলাইকুম ভাইয়া। আপনার নাম কি? হাকীমের নাম কি? এই কস্তুরী পাউডার কে তৈরি করেছে? আপনাদের চেম্বার কোথায়? আপনাদের সাথে দেখা করতে পারি? কীভাবে খাবো? দাম কত? জনতা ইউনানী চিকিৎসালয়, হাকীম মো: আব্দুল করিম, আলীকদম, বান্দরবান।");

        const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${GROQ_STT_KEY}` },
          body: form,
          signal: AbortSignal.timeout(10000)
        });

        if (groqRes.ok) {
          const data = await groqRes.json();
          const transcribed = (data.text || "").trim();
          if (transcribed && transcribed.length > 1) {
            console.log(`[FB_BOT_STT] (Groq Whisper Large V3) Transcribed: "${transcribed}"`);
            return transcribed;
          }
        } else {
          const errBody = await groqRes.text();
          console.warn("[FB_BOT_GROQ_STT_FAIL]", groqRes.status, errBody);
        }
      } catch (groqErr) {
        console.warn("[FB_BOT_GROQ_STT_WARN]", groqErr.message);
      }
    }

    // 2. Fallback: Gemini Audio
    const b64 = buf.toString("base64");
    const models = ["gemini-3.1-flash-image", "gemini-2.5-flash-image", "gemini-3.8-flash", "gemini-3.6-flash"];
    for (const m of models) {
      try {
        const model = genAI.getGenerativeModel({ model: m });
        const genRes = await model.generateContent([
          { inlineData: { data: b64, mimeType: "audio/mp3" } },
          "Transcribe the exact spoken words in Bengali or English accurately. Output ONLY the transcription text without commentary."
        ]);
        const text = genRes.response.text().trim();
        if (text && text.length > 1) {
          console.log(`[FB_BOT_STT] (${m}) Transcribed: "${text.slice(0, 60)}"`);
          return text;
        }
      } catch (e) {}
    }
  } catch (err) {
    console.warn("[FB_BOT_STT_ERR]", err.message);
  }
  return "";
}

// ── Gemini Vision Image Analysis for incoming customer product/prescription photos ───
async function analyzeImageWithGemini(imageUrl, pageAccessToken = PAGE_TOKEN, pageName = "হেলথ কেয়ার", userText = "", customerName = "ভাইয়া", recentHistory = []) {
  if (!imageUrl) return "";
  try {
    const url = imageUrl.includes("access_token") ? imageUrl : imageUrl + (imageUrl.includes("?") ? "&" : "?") + "access_token=" + pageAccessToken;
    console.log(`[FB_BOT_VISION] Fetching customer product/prescription image...`);
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn("[FB_BOT_VISION_FAIL] Image download failed HTTP status:", res.status);
      return "";
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) return "";
    const mime = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
    const b64 = buf.toString("base64");

    const kbText = getKnowledgeBaseContext();
    const systemPrompt = `আপনি "${pageName}" ফেসবুক পেজের ইউনানি ওষুধ বিশেষজ্ঞ। কাস্টমার একটি ছবি পাঠিয়েছেন।

কাস্টমারের নাম: ${customerName}
কাস্টমারের মেসেজ: "${userText || 'শুধু ছবি পাঠিয়েছেন'}"

আমাদের পণ্যের তালিকা:
১. কস্তুরী পাউডার / Kasturi Powder — ২৫০ গ্রাম কালো পাউডার বয়াম — ২৮০০ টাকা
২. বাজীকরণ হালুয়া / Bajikaran Halua — ৩৫০ গ্রাম বাদামী হালুয়া বয়াম — ২০০০ টাকা
৩. যৌবনের রাজা / Jouboner Raja — ৩৫০০ টাকা

[আপনার কাজ — ধাপে ধাপে করুন]:

ধাপ ১ — ছবিতে যা কিছু লেখা আছে সম্পূর্ণ পড়ুন (OCR করুন):
সব লেখা, label, brand name, বাংলা বা ইংরেজি যা-ই থাকুক — সব পড়ুন।

ধাপ ২ — সেই লেখা দিয়ে বলুন এটা কী:

■ যদি লেখায় পাওয়া যায়: "কস্তুরী পাউডার", "Kasturi Powder", "কস্তুরী", "kasturi"
→ এটা আমাদের কস্তুরী পাউডার। বলুন: "জি ভাইয়া, এটা আমাদের আসল কস্তুরী পাউডার। ২৫০ গ্রাম, মূল্য ২,৮০০ টাকা। প্রতিদিন সকালে খালি পেটে ১ চামচ গরম দুধে মিশিয়ে খেতে হয়। আপনি কি এটি নিতে চান?"

■ যদি লেখায় পাওয়া যায়: "বাজীকরণ", "Bajikaran", "হালুয়া"
→ এটা আমাদের বাজীকরণ হালুয়া। confirm করুন — ৩৫০ গ্রাম, ২০০০ টাকা।

■ যদি লেখায় পাওয়া যায়: "যৌবনের রাজা", "Jouboner Raja"
→ এটা আমাদের যৌবনের রাজা। confirm করুন — ৩৫০০ টাকা।

■ যদি ছবিতে মানুষ, খেলোয়াড়, ব্যাগ, ইলেকট্রনিক্স, প্রকৃতি বা অন্য কোনো পণ্য আছে যা আমাদের ওষুধ নয়:
→ বলুন: "ভাইয়া, এটি আমাদের পণ্যের ছবি নয়। আপনার কি কোনো শারীরিক সমস্যা আছে? বললে সাহায্য করতে পারব।"

■ যদি অন্য কোনো ওষুধ বা প্রেসক্রিপশন হয়:
→ সহানুভূতি জানিয়ে আমাদের প্রাকৃতিক ভেষজ কোর্সের পরামর্শ দিন।

ধাপ ৩: ২-৩ লাইনের সংক্ষিপ্ত ও আন্তরিক বাংলায় উত্তর দিন। কোনো ** বা markdown নয়।`;

    // Use direct REST API (SDK inlineData has issues with this key type)
    const visionModels = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"];
    for (const m of visionModels) {
      try {
        const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY || "";
        const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const restRes = await fetch(restUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inline_data: { mime_type: mime, data: b64 } },
                { text: systemPrompt }
              ]
            }]
          }),
          signal: AbortSignal.timeout(20000)
        });
        const restData = await restRes.json();
        const text = restData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text && text.length > 5) {
          console.log(`[FB_BOT_VISION] (${m}) REST Vision Success: "${text.slice(0, 80)}..."`);
          return text;
        } else if (!restRes.ok) {
          console.warn(`[FB_BOT_VISION_ERR] ${m} HTTP ${restRes.status}:`, restData?.error?.message);
        }
      } catch (e) {
        console.warn(`[FB_BOT_VISION_ERR] ${m}:`, e.message);
      }
    }
  } catch (err) {
    console.warn("[FB_BOT_VISION_ERR]", err.message);
  }
  return "";
}

function splitTextIntoVoiceChunks(text, maxChars = 800) {
  if (!text || text.length <= maxChars) return [text];
  const chunks = [];
  const sentences = text.split(/(?<=[।?!.])/g);
  let currentChunk = "";
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    if ((currentChunk + " " + trimmed).trim().length <= maxChars) {
      currentChunk = currentChunk ? (currentChunk + " " + trimmed) : trimmed;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      if (trimmed.length > maxChars) {
        const subParts = trimmed.split(/(?<=[,;])/g);
        let subChunk = "";
        for (const part of subParts) {
          if ((subChunk + " " + part).trim().length <= maxChars) {
            subChunk = subChunk ? (subChunk + " " + part) : part;
          } else {
            if (subChunk) chunks.push(subChunk);
            subChunk = part;
          }
        }
        if (subChunk) currentChunk = subChunk;
        else currentChunk = "";
      } else {
        currentChunk = trimmed;
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks.length > 0 ? chunks : [text];
}

async function sendSingleFacebookVoiceNote(recipientId, text, pageAccessToken = PAGE_TOKEN) {
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "sk_b704126ae6ecca01f041a6505e4e7a695f40df803a4f8bd3";
  const rawVoiceId = process.env.ELEVENLABS_VOICE_ID;
  const ELEVENLABS_VOICE_ID = (rawVoiceId && rawVoiceId !== "2RikWi4odb2uhZQb9waV" && rawVoiceId !== "UvaBYZVczBD1eq5jTquX" && rawVoiceId !== "FhOnCtjmaAIRIS1Dg2bk" && rawVoiceId !== "TX3LPaxmHKxFdv7VOQHJ") ? rawVoiceId : "nsJQzXf7dXyDnOFqO3uX";

  if (!ELEVENLABS_API_KEY) return null;

  try {
    const cleanText = prepareBangladeshiTTSAudioText(text);
    console.log(`[FB_BOT_VOICE] Generating Bangladeshi voice note with Voice ID: ${ELEVENLABS_VOICE_ID} | Text: "${cleanText.slice(0, 60)}..."`);
    const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`;
    let ttsRes = await fetch(ttsUrl, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: "eleven_v3",
        voice_settings: {
          stability: 0.50
        }
      })
    });

    if (!ttsRes.ok) {
      console.warn("[FB_BOT_VOICE_RETRY] Retrying with eleven_turbo_v2_5");
      ttsRes = await fetch(ttsUrl, {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.50,
            similarity_boost: 0.90,
            style: 0.0,
            use_speaker_boost: true
          }
        })
      });
    }

    if (!ttsRes.ok) {
      console.warn("[FB_BOT_VOICE_FAIL]", await ttsRes.text());
      return null;
    }

    const audioBytes = Buffer.from(await ttsRes.arrayBuffer());

    const uploadUrl = `https://graph.facebook.com/v19.0/me/message_attachments?access_token=${pageAccessToken}`;
    const form = new FormData();
    form.append("message", JSON.stringify({
      attachment: {
        type: "audio",
        payload: { is_reusable: true }
      }
    }));
    form.append("filedata", new Blob([audioBytes], { type: "audio/mp3" }), "doctor_voice.mp3");

    const upRes = await fetch(uploadUrl, { method: "POST", body: form });
    const upData = await upRes.json().catch(() => null);

    if (upData?.attachment_id) {
      const sendUrl = `https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`;
      const sendRes = await fetch(sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: "audio",
              payload: {
                attachment_id: upData.attachment_id
              }
            }
          },
          messaging_type: "RESPONSE"
        })
      });
      if (sendRes.ok) {
        const sendData = await sendRes.json().catch(() => null);
        if (sendData?.message_id) recordBotSentMessage(sendData.message_id);
        console.log(`[FB_BOT_VOICE_OK] Sent ElevenLabs voice note to ${recipientId}`);
        return upData.attachment_id;
      }
    }
  } catch (err) {
    console.error("[FB_BOT_VOICE_ERROR]", err.message);
  }
  return null;
}

async function sendFacebookVoiceNote(recipientId, text, pageAccessToken = PAGE_TOKEN) {
  const chunks = splitTextIntoVoiceChunks(text, 800);
  if (chunks.length > 1) {
    console.log(`[VOICE_CHUNK] Long voice response (${text.length} chars) split into ${chunks.length} parts for ${recipientId}`);
  }

  let lastId = null;
  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i];
    lastId = await sendSingleFacebookVoiceNote(recipientId, chunkText, pageAccessToken);
    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  return lastId;
}

// ── Fetch Recent Conversations from Facebook ─────────────────────────────────
async function fetchConversations(pageId = PAGE_ID, pageAccessToken = PAGE_TOKEN) {
  const url = `https://graph.facebook.com/v19.0/${pageId}/conversations?fields=messages.limit(15){message,from,created_time,id,attachments{id,type,mime_type,name,file_url,image_data,payload}}&access_token=${pageAccessToken}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

// ── Save Bot Reply Directly to SQLite DB (so it displays in Dashboard) ───────
function recordOutgoingBotMessageInDb(senderId, replyText, isVoice = false) {
  try {
    const dbPath = path.join(process.cwd(), "prisma", "social_inbox.db");
    if (!fs.existsSync(dbPath)) return;
    const db = new Database(dbPath);
    let contact = db.prepare('SELECT id FROM "Contact" WHERE platformUserId = ?').get(String(senderId));
    if (contact) {
      let conv = db.prepare('SELECT id FROM "Conversation" WHERE contactId = ? ORDER BY updatedAt DESC LIMIT 1').get(contact.id);
      if (conv) {
        const msgId = require('crypto').randomUUID();
        const now = new Date().toISOString();
        const content = isVoice ? `[ভয়েস মেসেজ] ${replyText}` : replyText;
        db.prepare(`
          INSERT INTO "Message" (id, content, "messageType", "senderType", "isRead", "createdAt", "conversationId")
          VALUES (?, ?, 'TEXT', 'BOT', 1, ?, ?)
        `).run(msgId, content, now, conv.id);
        db.prepare(`UPDATE "Conversation" SET "lastMessageAt" = ?, "updatedAt" = ? WHERE id = ?`).run(now, now, conv.id);
      }
    }
    db.close();
  } catch (err) {
    console.warn("[FB_BOT_DB_RECORD_ERR]", err.message);
  }
}

// ── Main Multi-Page Polling Loop ─────────────────────────────────────────────
let isPolling = false;

async function pollOnce() {
  if (isPolling) return;
  isPolling = true;

  try {
    const activePages = getActivePages();
    for (const page of activePages) {
      if (!page.aiAutoReply) continue;
      try {
        const convs = await fetchConversations(page.pageId, page.accessToken);
        for (const conv of convs) {
          const unrepliedCustomerMsgs = [];
          try {
            const msgs = conv.messages?.data || [];
            if (msgs.length === 0) continue;

            // 1. Collect ALL unprocessed customer messages from this thread.
            // msgs is sorted newest-first.
            // If customer sent another message while bot was replying or right before,
            // we must NOT drop it just because a bot reply was posted!
            for (const m of msgs) {
              const isFromCustomer = m.from?.id && String(m.from.id) !== String(page.pageId);
              if (isFromCustomer) {
              if (isProcessedId(m.id)) {
                // Reached a customer message that was already processed & replied to!
                break;
              }
              unrepliedCustomerMsgs.push(m);
            } else {
              // This message is from the Page.
              // If it's Facebook's automated ad message or greeting, ignore it and continue checking customer messages!
              if (isFacebookAutomatedMessage(m)) {
                continue;
              }
              // If it's from a HUMAN AGENT (not sent by our bot), stop checking — human took over!
              if (!isBotSentMessage(m)) {
                break;
              }
              // If it WAS sent by our bot, do NOT break!
              // The bot may have replied to an older message while this customer sent a new message,
              // so keep inspecting older messages in the list to collect any unreplied customer message!
            }
          }

          if (unrepliedCustomerMsgs.length === 0) continue;

          // 2. Rapid typing buffer (merge consecutive messages sent within 4 seconds)
          const newestMsg = unrepliedCustomerMsgs[0];
          const newestAge = Date.now() - new Date(newestMsg.created_time).getTime();
          const senderId = newestMsg.from?.id ? String(newestMsg.from.id) : null;
          if (!senderId) continue;

          // If the customer just sent this message less than 4 seconds ago,
          // mark as seen & start typing dots immediately, but wait 4s to let them finish sending follow-up messages!
          if (newestAge < 4000) {
            await sendSenderAction(senderId, "mark_seen", page.accessToken);
            await sendSenderAction(senderId, "typing_on", page.accessToken);
            continue;
          }

          // Track in-flight message IDs so parallel poll ticks don't duplicate
          for (const m of unrepliedCustomerMsgs) {
            inFlightMsgIds.add(m.id);
          }

          // ── HUMAN BEHAVIOR: Instantly mark message as SEEN (blue tick) ──────
          await sendSenderAction(senderId, "mark_seen", page.accessToken);
          await sendSenderAction(senderId, "typing_on", page.accessToken);

          // Use only name customer told us — NEVER use Facebook profile name for addressing
          const _fbProfile = newestMsg.from?.name || "";
          const _memProf = senderId ? customerMemory.getCustomerProfile(senderId) : null;

          if (_fbProfile && _memProf && !_memProf.facebookName) {
            customerMemory.updateCustomerProfile(String(newestMsg.from.id), { facebookName: _fbProfile });
          }

          const _memName = _memProf?.name || "";
          const _isRealName = _memName && !["ভাইয়া","Customer","কাস্টমার","NOT PROVIDED YET","customer","vaiya",""].includes(_memName.trim().toLowerCase());
          const customerName = _isRealName ? _memName : "ভাইয়া";

          // Sort batch into chronological order (oldest unreplied first, newest last)
          const customerBatch = [...unrepliedCustomerMsgs].reverse();

          // Resolve text and transcribe voice notes for each message in the batch
          const resolvedItems = [];
          for (const item of customerBatch) {
            let itemText = (item.message || "").trim();
            const audioAttach = item.attachments?.data?.find(a => a.mime_type?.includes("audio") || a.type === "audio");
            if (!itemText && audioAttach?.file_url) {
              console.log(`[FB_BOT] Transcribing customer voice note from ${customerName} (${senderId})...`);
              const transcribed = await transcribeAudioWithGemini(audioAttach.file_url, page.accessToken);
              itemText = transcribed || "[Customer sent a voice message]";
              setVoiceMode(senderId, true);
            }
            const imageAttach = item.attachments?.data?.find(a => a.image_data || a.type === "image" || a.mime_type?.includes("image"));
            let imageUrl = imageAttach?.image_data?.url || imageAttach?.file_url || imageAttach?.payload?.url || imageAttach?.image_data?.preview_url || "";
            if (!imageUrl && imageAttach?.id) {
              try {
                const attRes = await fetch(`https://graph.facebook.com/v19.0/${imageAttach.id}?fields=image_data,file_url,payload&access_token=${page.accessToken}`, { signal: AbortSignal.timeout(4000) });
                if (attRes.ok) {
                  const attData = await attRes.json();
                  imageUrl = attData?.image_data?.url || attData?.file_url || attData?.payload?.url || "";
                }
              } catch (e) {}
            }
            if (itemText || item.attachments?.data?.length > 0) {
              resolvedItems.push({
                id: item.id,
                text: itemText,
                created_time: item.created_time,
                hasAudio: Boolean(audioAttach),
                hasImage: Boolean(imageAttach),
                imageUrl: imageUrl,
                rawItem: item,
              });
            }
          }

          if (resolvedItems.length === 0) continue;

          // Format recent messages for multi-turn dialogue context (excluding current unreplied messages)
          const unrepliedIds = new Set(unrepliedCustomerMsgs.map(m => m.id));
          const previousMsgs = msgs.filter(m => !unrepliedIds.has(m.id)).slice(0, 10).reverse();
          const recentHistory = previousMsgs.map(m => {
            const isBot = String(m.from?.id) === String(page.pageId);
            const author = isBot ? page.pageName : (m.from?.name || "কাস্টমার");
            return `${author}: "${(m.message || '').trim()}"`;
          }).filter(line => line.length > 5);

          // ── MULTI-MESSAGE BATCH HANDLING (Customer sent 2 or more messages together) ──
          if (resolvedItems.length > 1) {
            console.log(`[FB_BOT] 🔔 Multi-message batch detected from ${customerName} (${senderId}) with ${resolvedItems.length} messages.`);
            const fullBatchText = resolvedItems.map(i => i.text).filter(Boolean).join(" \n ");

            // Check if all messages together form an order submission
            const parsedBatchOrder = parseOrderFromMessage(fullBatchText);
            const isBatchOrderPlaced = isOrderPlaced(fullBatchText);

            if (parsedBatchOrder && (parsedBatchOrder.phone || isBatchOrderPlaced)) {
              console.log(`[FB_BOT] Combined batch forms an order submission. Processing order...`);
              const replyText = await generateReply(fullBatchText, customerName, senderId, recentHistory, page.pageName, isVoiceMode(senderId));
              await sendFacebookMessage(senderId, replyText, page.accessToken, newestMsg.id);
              recordOutgoingBotMessageInDb(senderId, replyText, false);
              customerMemory.appendChatMessage(senderId, "model", replyText, false);
              for (const m of unrepliedCustomerMsgs) {
                saveProcessedId(m.id);
              }
              continue;
            }

            // Customer asked multiple questions/messages: Give ONE unified, friendly, comprehensive answer!
            console.log(`[FB_BOT] Generating unified answer for all ${resolvedItems.length} messages...`);

            // 1. Deliver requested media if ANY message in the batch asks for it
            for (const bItem of resolvedItems) {
              const bText = bItem.text;
              if (!bText) continue;
              if (isPictureRequest(bText)) {
                try {
                  const isMultiple = isMultiplePicturesRequest(bText);
                  const { matched: bMatched } = getLiveProductInfo(bText, senderId, recentHistory, page.pageName);
                  const isBajikaran = (bMatched && (String(bMatched.SL) === "61" || /বাজীকরণ|bajikaran|halua|হালুয়া/i.test(bMatched.name || bMatched["ওষুধের নাম (Brand Name)"] || ""))) || /ন্যাচারাল|হারবাল|natural/i.test(page.pageName || "");
                  const custProf = customerMemory.getCustomerProfile(senderId);

                  if (isBajikaran) {
                    const previouslySent = Array.isArray(custProf?.sentBajikaranImages) ? custProf.sentBajikaranImages : [];
                    const { imagesToSend, updatedHistory } = getNextBajikaranImages(previouslySent, isMultiple);
                    customerMemory.updateCustomerProfile(senderId, { sentBajikaranImages: updatedHistory });
                    for (let idx = 0; idx < imagesToSend.length; idx++) {
                      await sendFacebookImage(senderId, imagesToSend[idx], page.accessToken);
                      if (idx < imagesToSend.length - 1) await sleep(800);
                    }
                  } else {
                    const previouslySent = Array.isArray(custProf?.sentKasturiImages) ? custProf.sentKasturiImages : [];
                    const { imagesToSend, updatedHistory } = getNextKasturiImages(previouslySent, isMultiple);
                    customerMemory.updateCustomerProfile(senderId, { sentKasturiImages: updatedHistory });
                    for (let idx = 0; idx < imagesToSend.length; idx++) {
                      await sendFacebookImage(senderId, imagesToSend[idx], page.accessToken);
                      if (idx < imagesToSend.length - 1) await sleep(800);
                    }
                  }
                } catch (e) {}
              }
              if (isCertificateOrLicenseRequest(bText)) {
                try {
                  await sendFacebookImage(senderId, "hakim_abdul_karim_certificate.jpg", page.accessToken);
                  await sleep(800);
                  await sendFacebookImage(senderId, "hakim_abdul_karim_license.jpg", page.accessToken);
                } catch (e) {}
              }
              if (isReviewRequest(bText)) {
                try {
                  for (const revImg of CUSTOMER_REVIEW_IMAGES) {
                    await sendFacebookImage(senderId, revImg, page.accessToken);
                    await sleep(800);
                  }
                } catch (e) {}
              }
              if (isDokanOrChamberRequest(bText)) {
                try {
                  await sendFacebookImage(senderId, "jonota_unani_dokan.jpg", page.accessToken);
                } catch (e) {}
              }
            }

            // 2. Generate unified answer addressing ALL questions in the batch
            let itemReply = "";
            const imageItemInBatch = resolvedItems.find(i => i.hasImage && i.imageUrl);
            if (imageItemInBatch && imageItemInBatch.imageUrl) {
              console.log(`[FB_BOT] Customer sent an image in batch. Running Gemini Vision analysis...`);
              itemReply = await analyzeImageWithGemini(
                imageItemInBatch.imageUrl,
                page.accessToken,
                page.pageName,
                fullBatchText,
                customerName,
                recentHistory
              );
            }
            if (!itemReply) {
              if (imageItemInBatch && imageItemInBatch.imageUrl && !fullBatchText.trim()) {
                // Image only, no text - Vision failed. Send fixed neutral reply
                itemReply = "ভাইয়া, এই ছবিটি দেখলাম। এটি আমাদের পণ্য (কস্তুরী পাউডার বা বাজীকরণ হালুয়া) মনে হচ্ছে না। আপনার কি কোনো শারীরিক সমস্যা আছে বা আমাদের ওষুধ সম্পর্কে জানতে চান?";
              } else {
                itemReply = await generateReply(fullBatchText, customerName, senderId, recentHistory, page.pageName, isVoiceMode(senderId));
              }
            }

            // 3. Send text reply immediately
            const delay = calculateHumanTypingDelay(itemReply);
            await sendSenderAction(senderId, "typing_on", page.accessToken);
            await sleep(Math.min(delay, 1500));
            const sendRes = await sendFacebookMessage(senderId, itemReply, page.accessToken, newestMsg.id);
            console.log(`[FB_BOT] Replied to batch of ${resolvedItems.length} msgs (Status: ${sendRes.status}): "${itemReply.slice(0, 60)}..."`);
            recordOutgoingBotMessageInDb(senderId, itemReply, false);
            customerMemory.appendChatMessage(senderId, "model", itemReply, false);

            // 4. Voice note: If voice mode, or if reply is long (200+ chars), also send voice
            const userPrefersText = isTextModeRequested(fullBatchText);
            const isLongReply = itemReply && itemReply.length >= 200;
            const anyAudio = resolvedItems.some(i => i.hasAudio);
            const wantsVoice = !userPrefersText && (
              isVoiceMode(senderId) ||
              anyAudio ||
              isVoiceRequested(fullBatchText) ||
              isLongReply
            );
            if (wantsVoice) {
              try {
                await sendSenderAction(senderId, "typing_on", page.accessToken);
                const sentVoice = await sendFacebookVoiceNote(senderId, itemReply, page.accessToken);
                if (sentVoice) {
                  recordOutgoingBotMessageInDb(senderId, itemReply, true);
                }
              } catch (vErr) {
                console.warn("[FB_BOT_MULTI_VOICE_ERR]", vErr.message);
              }
            }

            // 5. Mark ALL messages in the batch as processed
            for (const m of unrepliedCustomerMsgs) {
              saveProcessedId(m.id);
            }
            continue; // Multi-message batch finished!
          }

          // ── SINGLE MESSAGE FLOW (When exactly 1 message was sent) ──
          const lastMsg = resolvedItems[0].rawItem;
          let messageText = resolvedItems[0].text;
          const audioAttach = resolvedItems[0].hasAudio;

          console.log(`[FB_BOT] 🔔 [${page.pageName}] FALLBACK NEW MESSAGE from ${customerName} (${senderId}): "${messageText}"`);

            // Check if customer asked for a video
            if (isVideoRequest(messageText)) {
              try {
                const { matched } = getLiveProductInfo(messageText, senderId, recentHistory);
                const productName = matched?.name || matched?.["ওষুধের নাম (Brand Name)"] || "";
                console.log(`[FB_BOT] Customer asked for video. Searching for "${productName}" video...`);
                const videoSent = await sendFacebookVideo(senderId, productName, page.accessToken);
                if (!videoSent) {
                  const imgFile = (matched && (matched.imageFile || matched["ছবি পাথ (Image Path)"] || matched["ফাইলের নাম (File Name)"])) || "WhatsApp Image 2026-08-31 at 2.35.30 PM.jpeg";
                  await sendFacebookImage(senderId, imgFile, page.accessToken);
                  await sendFacebookMessage(senderId, "ভাইয়া, এই মুহূর্তে ভিডিও নেই, তবে প্রোডাক্টের ছবিটি পাঠিয়ে দিলাম।", page.accessToken, lastMsg.id);
                  saveProcessedId(lastMsg.id);
                  continue;
                }
              } catch (vidErr) {
                console.warn("[FB_BOT_VID_ERR]", vidErr.message);
              }
            }

            // Check if customer asked for a picture of medicine (skip if customer already sent an image)
            const singleImageItem = resolvedItems.find(i => i.hasImage && i.imageUrl);
            const hasIncomingImage = !!(singleImageItem && singleImageItem.imageUrl);
            let productImagesSent = false;
            if (!hasIncomingImage && isPictureRequest(messageText)) {
              try {
                const isMultiple = isMultiplePicturesRequest(messageText);
                const { matched } = getLiveProductInfo(messageText, senderId, recentHistory, page.pageName);
                const isBajikaran = (matched && (String(matched.SL) === "61" || /বাজীকরণ|bajikaran|halua|হালুয়া/i.test(matched.name || matched["ওষুধের নাম (Brand Name)"] || ""))) || /ন্যাচারাল|হারবাল|natural/i.test(page.pageName || "");
                const isKasturi = !isBajikaran && (!matched || !matched.name || /কস্তুরী|kasturi/i.test(matched.name));

                if (isBajikaran) {
                  const custProf = customerMemory.getCustomerProfile(senderId);
                  const previouslySent = Array.isArray(custProf?.sentBajikaranImages) ? custProf.sentBajikaranImages : [];
                  const { imagesToSend, updatedHistory } = getNextBajikaranImages(previouslySent, isMultiple);
                  customerMemory.updateCustomerProfile(senderId, { sentBajikaranImages: updatedHistory });

                  console.log(`[FB_BOT] Customer asked for Bajikaran Halua picture (${isMultiple ? 'multiple' : 'single'}). Sending ${imagesToSend.length} image(s): ${imagesToSend.join(', ')} to ${senderId}`);
                  for (let idx = 0; idx < imagesToSend.length; idx++) {
                    await sendFacebookImage(senderId, imagesToSend[idx], page.accessToken);
                    if (idx < imagesToSend.length - 1) await sleep(800);
                  }
                  productImagesSent = true;
                } else if (isKasturi) {
                  const custProf = customerMemory.getCustomerProfile(senderId);
                  const previouslySent = Array.isArray(custProf?.sentKasturiImages) ? custProf.sentKasturiImages : [];
                  const { imagesToSend, updatedHistory } = getNextKasturiImages(previouslySent, isMultiple);
                  customerMemory.updateCustomerProfile(senderId, { sentKasturiImages: updatedHistory });

                  console.log(`[FB_BOT] Customer asked for Kasturi picture (${isMultiple ? 'multiple' : 'single'}). Sending ${imagesToSend.length} image(s): ${imagesToSend.join(', ')} to ${senderId}`);
                  for (let idx = 0; idx < imagesToSend.length; idx++) {
                    await sendFacebookImage(senderId, imagesToSend[idx], page.accessToken);
                    if (idx < imagesToSend.length - 1) await sleep(800);
                  }
                  productImagesSent = true;
                } else {
                  const imgFile = (matched && (matched.imageFile || matched["ছবি পাথ (Image Path)"] || matched["ফাইলের নাম (File Name)"]))
                    || "bajikaran_halua_table.jpg";
                  console.log(`[FB_BOT] Customer asked for picture. Sending "${matched?.name || 'Product'}" image: ${imgFile}`);
                  await sendFacebookImage(senderId, imgFile, page.accessToken);
                  productImagesSent = true;
                }
              } catch (imgErr) {
                console.warn("[FB_BOT_IMG_ERR]", imgErr.message);
              }
            }

            // Check if customer asked for certificate or license of Hakim
            let certImagesSent = false;
            if (isCertificateOrLicenseRequest(messageText)) {
              try {
                console.log(`[FB_BOT] Customer asked for certificate/license. Sending Hakim Abdul Karim credentials to ${senderId}...`);
                await sendFacebookImage(senderId, "hakim_abdul_karim_certificate.jpg", page.accessToken);
                await sleep(800);
                await sendFacebookImage(senderId, "hakim_abdul_karim_license.jpg", page.accessToken);
                certImagesSent = true;
              } catch (certErr) {
                console.warn("[FB_BOT_CERT_ERR]", certErr.message);
              }
            }

            // Check if customer asked for reviews / proof / results / feedback
            let reviewImagesSent = false;
            let dokanImagesSent = false;
            if (isReviewRequest(messageText)) {
              try {
                console.log(`[FB_BOT] Customer asked for reviews/feedback/social proof. Sending real customer review to ${senderId}...`);
                for (const revImg of CUSTOMER_REVIEW_IMAGES) {
                  await sendFacebookImage(senderId, revImg, page.accessToken);
                  await sleep(800);
                }
                reviewImagesSent = true;
              } catch (revErr) {
                console.warn("[FB_BOT_REVIEW_ERR]", revErr.message);
              }
            }

            // ── Voice Mode & Voice Request Logic ──
            const custProf = customerMemory.getCustomerProfile(senderId);
            const lastMsgWasVoice = recentHistory && recentHistory.length > 0 &&
              recentHistory.some(line => line.includes("[ভয়েস") || line.includes("[ভয়েস"));

            const isAudioOrVoiceReq = Boolean(audioAttach) || isOnlyVoiceRequest(messageText) || isVoiceRequested(messageText);

            // ── PERSISTENT VOICE MODE CONTROL ────────────────────────────────────
            // If customer says "text koro" / "lekhe pathao" → switch to text mode
            // If customer says "voice dao" / "buji na" / "porte pari na" → switch to voice mode
            // Otherwise → keep EXISTING mode (don't reset it every message!)
            if (isTextModeRequested(messageText)) {
              setVoiceMode(senderId, false);
              console.log(`[VOICE_MODE] Customer ${senderId} switched to TEXT mode`);
            } else if (isAudioOrVoiceReq) {
              setVoiceMode(senderId, true);
              console.log(`[VOICE_MODE] Customer ${senderId} switched to VOICE mode`);
            }
            // else: keep existing voice mode preference unchanged

            const isOnlyVoice = isOnlyVoiceRequest(messageText);

            // CASE 1: Customer explicitly asked to speak in voice ("voice dao", "voice a bolte", "porte pari na voice daoya jabe")
            if (isOnlyVoice) {
              setVoiceMode(senderId, true);
              const voiceText = "জি ভাইয়া, অবশ্যই! আমি ডাক্তার হাকিম রিয়াজুল করিম বলছি। কোনো সমস্যা নেই ভাইয়া, আপনি আর পড়তে হবে না—আমি আপনার সাথে মুখে কথা বলছি। আপনার কী সমস্যা হচ্ছে বা কী জানতে চাচ্ছেন, আমাকে নির্দ্বিধায় মুখে বলুন বা লিখে জানান, আমি আপনাকে ভয়েসেই সবকিছু বুঝিয়ে বলছি।";

              console.log(`[FB_BOT] Customer asked for voice consultation. Sending fresh doctor voice note to ${senderId}`);
              await sendSenderAction(senderId, "typing_on", page.accessToken);
              const sentVoice = await sendFacebookVoiceNote(senderId, voiceText, page.accessToken);
              if (sentVoice) {
                customerMemory.appendChatMessage(senderId, "model", voiceText, true);
                recordOutgoingBotMessageInDb(senderId, voiceText, true);
              } else {
                await sendFacebookMessage(senderId, voiceText, page.accessToken);
                recordOutgoingBotMessageInDb(senderId, voiceText, false);
              }
              saveProcessedId(lastMsg.id);
              continue;
            }

            // CASE 2: Normal inquiry or Question while in Voice Mode
            const userInVoiceMode = isVoiceMode(senderId);

            // Generate AI reply with thread memory and page-specific identity
            const isVoiceReq = userInVoiceMode || isVoiceRequested(messageText) || isOnlyVoice;
            let replyText = "";
            if (singleImageItem && singleImageItem.imageUrl) {
              console.log(`[FB_BOT] Customer ${customerName} (${senderId}) sent an image attachment. Running Gemini Vision analysis...`);
              replyText = await analyzeImageWithGemini(
                singleImageItem.imageUrl,
                page.accessToken,
                page.pageName,
                messageText,
                customerName,
                recentHistory
              );
            }
            if (!replyText) {
              if (singleImageItem && singleImageItem.imageUrl) {
                // Image present but Vision failed - always neutral reply regardless of text
                replyText = "u{09AD}u{09BE}u{0987}u{09AF}u{09BC}u{09BE}, u{098F}u{0987} u{099B}u{09AC}u{09BF}u{099F}u{09BF} u{09A6}u{09C7}u{0996}u{09B2}u{09BE}u{09AE}u{0964} u{098F}u{099F}u{09BF} u{0986}u{09AE}u{09BE}u{09A6}u{09C7}u{09B0} u{09AA}u{09A3}u{09CD}u{09AF} (u{0995}u{09B8}u{09CD}u{09A4}u{09C1}u{09B0}u{09C0} u{09AA}u{09BE}u{0989}u{09A1}u{09BE}u{09B0} u{09AC}u{09BE} u{09AC}u{09BE}u{099C}u{09C0}u{0995}u{09B0}u{09A3} u{09B9}u{09BE}u{09B2}u{09C1}u{09AF}u{09BC}u{09BE}) u{09AE}u{09A8}u{09C7} u{09B9}u{099A}u{09CD}u{099B}u{09C7} u{09A8}u{09BE}u{0964} u{0986}u{09AA}u{09A8}u{09BE}u{09B0} u{0995}u{09BF} u{0995}u{09CB}u{09A8}u{09CB} u{09B6}u{09BE}u{09B0}u{09C0}u{09B0}u{09BF}u{0995} u{09B8}u{09AE}u{09B8}u{09CD}u{09AF}u{09BE} u{0986}u{099B}u{09C7} u{09AC}u{09BE} u{0986}u{09AE}u{09BE}u{09A6}u{09C7}u{09B0} u{0993}u{09B7}u{09C1}u{09A7} u{09B8}u{09AE}u{09CD}u{09AA}u{09B0}u{09CD}u{0995}u{09C7} u{099C}u{09BE}u{09A8}u{09A4}u{09C7} u{099A}u{09BE}u{09A8}?";
              } else {
                replyText = await generateReply(messageText, customerName, senderId, recentHistory, page.pageName, isVoiceReq);
              }
            }
            const parsedOrder = parseOrderFromMessage(messageText);
            const orderPlacedDetected = isOrderPlaced(messageText);
            const botConfirmedOrder = /(?:অর্ডারটি|অর্ডার|পার্সেলটি|পার্সেল)\s*(?:সফলভাবে\s*)?(?:কনফার্ম|নিশ্চিত|বুকিং)/i.test(replyText);
            console.log(`[ORDER_DETECT] parsed=${parsedOrder ? 'YES phone:'+parsedOrder.phone : 'null'} | isOrderPlaced=${orderPlacedDetected} | botConfirmed=${botConfirmedOrder} | msg="${messageText.slice(0,50).replace(/\n/g,' ')}"`);

            // Guarantee: If bot reply or customer message mentions credentials/license/certificate, ALWAYS deliver certificate images
            const mentionsCertInReply = /(?:৫৮৪২|5842|সনদপত্র|লাইসেন্স|সার্টিফিকেট|certificate|license|অনুমোদন|ট্রেড\s*লাইসেন্স)/i.test(replyText);
            if (!certImagesSent && (mentionsCertInReply || isCertificateOrLicenseRequest(messageText))) {
              try {
                console.log(`[FB_BOT] Credentials referenced in reply/context. Ensuring certificate images sent to ${senderId}...`);
                await sendFacebookImage(senderId, "hakim_abdul_karim_certificate.jpg", page.accessToken);
                await sleep(800);
                await sendFacebookImage(senderId, "hakim_abdul_karim_license.jpg", page.accessToken);
                certImagesSent = true;
              } catch (certErr) {
                console.warn("[FB_BOT_CERT_SAFETY_ERR]", certErr.message);
              }
            }

            // Guarantee: If bot reply mentions sending a picture OR customer asked for a picture and it wasn't sent yet, ALWAYS deliver product image
            const mentionsPicInReply = /(?:ছবি|সবি|পিক|পিকচার|ফটো|ইমেজ|বয়াম|বয়ম).*(?:পাঠিয়ে|দিচ্ছি|দিলাম|পাঠাচ্ছি|দিব|পাঠাব|দেখুন|দেওয়া হলো)/i.test(replyText) ||
                                       /(?:পাঠিয়ে|দিচ্ছি|দিলাম|পাঠাচ্ছি|দিব|পাঠাব).*(?:ছবি|সবি|পিক|পিকচার|ফটো)/i.test(replyText);
            if (!productImagesSent && !hasIncomingImage && (mentionsPicInReply || isPictureRequest(messageText))) {
              try {
                const isMultiple = isMultiplePicturesRequest(messageText) || isMultiplePicturesRequest(replyText);
                const { matched } = getLiveProductInfo(messageText, senderId, recentHistory, page.pageName);
                const isBajikaran = (matched && (String(matched.SL) === "61" || /বাজীকরণ|bajikaran|halua|হালুয়া/i.test(matched.name || matched["ওষুধের নাম (Brand Name)"] || ""))) || /ন্যাচারাল|হারবাল|natural/i.test(page.pageName || "");
                const isKasturi = !isBajikaran && (!matched || !matched.name || /কস্তুরী|kasturi/i.test(matched.name));

                if (isBajikaran) {
                  const custProf = customerMemory.getCustomerProfile(senderId);
                  const previouslySent = Array.isArray(custProf?.sentBajikaranImages) ? custProf.sentBajikaranImages : [];
                  const { imagesToSend, updatedHistory } = getNextBajikaranImages(previouslySent, isMultiple);
                  customerMemory.updateCustomerProfile(senderId, { sentBajikaranImages: updatedHistory });

                  console.log(`[FB_BOT] Picture referenced in reply/context for Bajikaran Halua. Ensuring ${imagesToSend.length} image(s): ${imagesToSend.join(', ')} sent to ${senderId}...`);
                  for (let idx = 0; idx < imagesToSend.length; idx++) {
                    await sendFacebookImage(senderId, imagesToSend[idx], page.accessToken);
                    if (idx < imagesToSend.length - 1) await sleep(800);
                  }
                  productImagesSent = true;
                } else if (isKasturi) {
                  const custProf = customerMemory.getCustomerProfile(senderId);
                  const previouslySent = Array.isArray(custProf?.sentKasturiImages) ? custProf.sentKasturiImages : [];
                  const { imagesToSend, updatedHistory } = getNextKasturiImages(previouslySent, isMultiple);
                  customerMemory.updateCustomerProfile(senderId, { sentKasturiImages: updatedHistory });

                  console.log(`[FB_BOT] Picture referenced in reply/context. Ensuring ${imagesToSend.length} image(s): ${imagesToSend.join(', ')} sent to ${senderId}...`);
                  for (let idx = 0; idx < imagesToSend.length; idx++) {
                    await sendFacebookImage(senderId, imagesToSend[idx], page.accessToken);
                    if (idx < imagesToSend.length - 1) await sleep(800);
                  }
                  productImagesSent = true;
                } else {
                  const imgFile = (matched && (matched.imageFile || matched["ছবি পাথ (Image Path)"] || matched["ফাইলের নাম (File Name)"]))
                    || "bajikaran_halua_table.jpg";
                  console.log(`[FB_BOT] Picture referenced in reply. Sending "${matched?.name || 'Product'}" image: ${imgFile}`);
                  await sendFacebookImage(senderId, imgFile, page.accessToken);
                  productImagesSent = true;
                }
              } catch (picSafeErr) {
                console.warn("[FB_BOT_PIC_SAFETY_ERR]", picSafeErr.message);
              }
            }

            // Guarantee: If bot reply mentions customer reviews/feedback OR customer asked for reviews and not sent yet, ALWAYS deliver review images
            const mentionsReviewInReply = /(?:রিভিউ|ফিডব্যাক|প্রমাণ|প্রমান).*(?:পাঠিয়ে|দিচ্ছি|দিলাম|পাঠাচ্ছি|দিব|পাঠাব|দেখুন|দেওয়া হলো)/i.test(replyText) ||
                                          /(?:পাঠিয়ে|দিচ্ছি|দিলাম|পাঠাচ্ছি|দিব|পাঠাব).*(?:রিভিউ|ফিডব্যাক|প্রমাণ)/i.test(replyText);
            if (!reviewImagesSent && (mentionsReviewInReply || isReviewRequest(messageText))) {
              try {
                console.log(`[FB_BOT] Customer reviews referenced in reply/context. Ensuring review image sent to ${senderId}...`);
                for (const revImg of CUSTOMER_REVIEW_IMAGES) {
                  await sendFacebookImage(senderId, revImg, page.accessToken);
                  await sleep(800);
                }
                reviewImagesSent = true;
              } catch (revErr) {
                console.warn("[FB_BOT_REVIEW_SAFETY_ERR]", revErr.message);
              }
            }

            // Guarantee: If bot reply mentions shop/chamber photo OR customer asked for shop/chamber/address, ALWAYS deliver shop photo
            const mentionsDokanInReply = /(?:দোকানের|চেম্বারের|দোকান|চেম্বার).*(?:ছবি|বাস্তব\s*ছবি|পাঠিয়ে|দিচ্ছি|দিলাম)/i.test(replyText);
            if (!dokanImagesSent && (mentionsDokanInReply || isDokanOrChamberRequest(messageText))) {
              try {
                console.log(`[FB_BOT] Shop/Chamber referenced in reply/context. Ensuring shop image sent to ${senderId}...`);
                await sendFacebookImage(senderId, "jonota_unani_dokan.jpg", page.accessToken);
                dokanImagesSent = true;
              } catch (dokanErr) {
                console.warn("[FB_BOT_DOKAN_SAFETY_ERR]", dokanErr.message);
              }
            }

            if (parsedOrder || orderPlacedDetected || botConfirmedOrder) {
              // Customer gave order info or bot confirmed → cancel any pending reminder
              cancelScheduledReminder(senderId);

              // ── AUTO SAVE ORDER TO DASHBOARD ──
              try {
                const memProf = customerMemory.getCustomerProfile(senderId);

                // Extract any structured fields from bot replyText if bot confirmed
                let nameFromReply = "";
                let distFromReply = "";
                let thanaFromReply = "";
                let addrFromReply = "";
                if (replyText) {
                  const nm = replyText.match(/(?:জি\s+)?([^\s,।.!?]+)\s+ভাই(?:য়া|য়া)?/i);
                  if (nm && nm[1] && customerMemory.isValidPersonName(nm[1])) nameFromReply = nm[1].trim();

                  const dm = replyText.match(/([^\s,।.!?]+)\s*(?:জেলার|জেলা)/i);
                  if (dm && dm[1]) distFromReply = dm[1].trim();

                  const tm = replyText.match(/([^\s,।.!?]+)\s*(?:থানার|থানা|উপজেলার|উপজেলা)/i);
                  if (tm && tm[1]) thanaFromReply = tm[1].trim();

                  const am = replyText.match(/([^\s,।.!?]+)\s*(?:গ্রামের|গ্রাম|এলাকার|এলাকা|রোডের|রোড|ঠিকানায়|ঠিকানা)/i);
                  if (am && am[1]) addrFromReply = am[1].trim();
                }

                // Extract phone from messageText, memProf, or chat history
                const allTextForPhone = [messageText, memProf?.phone, ...(recentHistory || []).map(m => m.text)].join(" ");
                const enPhoneStr = allTextForPhone.replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d));
                const phMatch = enPhoneStr.match(/(?:\+?880|0)?1[3-9]\d{8}/);
                const detectedPhone = parsedOrder?.phone || memProf?.phone || (phMatch ? (phMatch[0].startsWith("88") ? phMatch[0].slice(2) : phMatch[0]) : "");

                const orderData = {
                  customerName: (parsedOrder?.name && parsedOrder.name.length > 1)
                    ? parsedOrder.name
                    : (nameFromReply && nameFromReply.length > 1)
                      ? nameFromReply
                      : (memProf?.name && !["ভাইয়া","customer"].includes(memProf.name.toLowerCase()))
                        ? memProf.name : customerName,
                  phone:     detectedPhone,
                  district:  parsedOrder?.district || distFromReply || memProf?.district || "",
                  thana:     parsedOrder?.thana    || thanaFromReply || memProf?.thana || "",
                  address:   parsedOrder?.address  || addrFromReply || memProf?.address || messageText,
                  product:   parsedOrder?.product || memProf?.productDiscussed || (threadMemory.has(senderId) ? threadMemory.get(senderId).name : "") || "কস্তুরী পাউডার (Kasturi Powder)",
                  quantity:  parsedOrder?.quantity || 1,
                  senderId:  String(senderId),
                  facebookName: memProf?.facebookName || customerName || "",
                  pageId:    String(page.pageId),
                };
                console.log(`[ORDER_DATA] name="${orderData.customerName}" phone="${orderData.phone}" district="${orderData.district}" thana="${orderData.thana}" botConfirmed=${botConfirmedOrder}`);

                if (botConfirmedOrder) {
                  // ── CASE A: Bot AI ALREADY confirmed order to customer in replyText! ──
                  // Do NOT send rejection/correction error! Save directly to database.
                  const saved = saveOrderToDb(orderData);
                  if (saved) {
                    console.log(`[ORDER] 📦 Bot-confirmed order saved to dashboard for ${orderData.customerName} | Phone: ${orderData.phone}`);
                  }
                  try {
                    const _apiBase = `http://localhost:3000`;
                    await fetch(`${_apiBase}/api/orders`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(orderData)
                    }).catch(() => null);
                  } catch {}
                } else {
                  // ── CASE B: Raw customer order submission (check validation) ──
                  const validation = validateOrderDetails(
                    orderData.phone,
                    orderData.district,
                    orderData.thana,
                    orderData.address
                  );

                  if (!validation.valid) {
                    // ❌ Invalid order — send correction request to customer
                    const errorLines = validation.issues.map(issue => issue.msg).join("\n\n");
                    const correctionMsg =
`⚠️ আপনার অর্ডারটি গ্রহণ করা সম্ভব হয়নি, কারণ কিছু তথ্য ঠিকমতো পাওয়া যায়নি:

${errorLines}

🔁 সঠিক তথ্য দিয়ে আবার পাঠান:
নাম=আপনার পুরো নাম
জেলা=আপনার জেলা
থানা=আপনার থানা
রিসিভ ঠিকানা=গ্রাম/রোড/ফ্ল্যাট নম্বর
নাম্বার=01XXXXXXXXX

✅ সঠিক তথ্য দিলে আমরা সাথে সাথে অর্ডার নিশ্চিত করব ইনশাআল্লাহ।`;

                    await sendSenderAction(senderId, "typing_on", page.accessToken);
                    await sleep(800);
                    await sendFacebookMessage(senderId, correctionMsg, page.accessToken);
                    console.log(`[ORDER_VALIDATE] ❌ Invalid order from ${senderId} — issues: ${validation.issues.map(i=>i.field).join(", ")}`);
                  } else if (orderData.phone) {
                    // ✅ Valid — save to dashboard
                    // Save via direct DB
                    const saved = saveOrderToDb(orderData);
                    if (saved) {
                      console.log(`[ORDER] 📦 Order saved to dashboard for ${orderData.customerName} | Product: ${orderData.product} | Qty: ${orderData.quantity}`);
                    } else {
                      console.log(`[ORDER] ⚠️ DB save returned false (duplicate or error), trying API fallback...`);
                    }
                    // Also save via API (HTTP fallback — ensures 100% persistence on Coolify)
                    try {
                      const _apiBase = `http://localhost:3000`;
                      const _apiRes = await fetch(`${_apiBase}/api/orders`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(orderData)
                      }).then(r => r.json()).catch(() => null);
                      if (_apiRes?.order?.id) {
                        console.log(`[ORDER] ✅ API fallback saved order! ID: ${_apiRes.order.id}`);
                      } else {
                        console.log(`[ORDER] ⚠️ API fallback result: ${JSON.stringify(_apiRes)}`);
                      }
                    } catch (_apiErr) {
                      console.warn(`[ORDER_API_ERR]`, _apiErr.message);
                    }

                  // ── ALWAYS send confirmation to customer ─────────────────
                  await sleep(600);

                  // Build full address display
                  const addrLine = [orderData.address, orderData.thana, orderData.district]
                    .filter(Boolean).join(", ");

                  // Generate short order ref code: e.g. ORD-20260915-4823
                  const now = new Date();
                  const dateStr = now.getFullYear().toString() +
                    String(now.getMonth()+1).padStart(2,"0") +
                    String(now.getDate()).padStart(2,"0");
                  const randPart = Math.floor(1000 + Math.random() * 9000);
                  const orderRef = `ORD-${dateStr}-${randPart}`;

                  const isKasturiOrder = /কস্তুরী|kosturi|kasturi|আব্দুল করিম/i.test(orderData.product || "") || /কস্তুরী|kosturi|kasturi/i.test(messageText || "");
                  const paymentLine = isKasturiOrder
                    ? "💰 মূল্য: ২,৮০০ টাকা (বুকিং নিশ্চিত করতে ৫০০ টাকা অগ্রিম বিকাশ প্রযোজ্য, বাকি ২,৩০০ টাকা ক্যাশ অন ডেলিভারি)\n📱 বিকাশ পার্সোনাল নম্বর: 01870-023804\n📌 দ্রষ্টব্য: কস্তুরী পাউডার পার্সেল বুকিং কনফার্ম করতে 01870-023804 নম্বরে ৫০০ টাকা পাঠিয়ে লাস্ট ২/৩ ডিজিট এখানে জানান।"
                    : "💰 পেমেন্ট: ক্যাশ অন ডেলিভারি (পণ্য পেয়ে পরিশোধ)";

                  const confirmMsg =
`🎉 অর্ডার কনফার্ম হয়েছে! ধন্যবাদ! 🙏

━━━━━━━━━━━━━━━━━━━━
📋 অর্ডার রেফারেন্স: ${orderRef}
━━━━━━━━━━━━━━━━━━━━

👤 নাম: ${orderData.customerName}
📱 মোবাইল: ${orderData.phone}
📍 ঠিকানা: ${addrLine || "—"}${orderData.thana ? "\n🏘️ থানা: " + orderData.thana : ""}${orderData.district ? "\n📮 জেলা: " + orderData.district : ""}
💊 পণ্য: ${orderData.product}
📦 পরিমাণ: ${orderData.quantity} পিস/ফাইল
${paymentLine}

━━━━━━━━━━━━━━━━━━━━
🚚 ডেলিভারি তথ্য:
• ঢাকার ভেতরে: ১-২ দিন
• ঢাকার বাইরে: ২-৪ দিন
• সারা দেশে হোম ডেলিভারি আছে ✅

⚠️ তথ্যে কোনো ভুল থাকলে এখনই জানান।
কোনো প্রশ্ন থাকলে মেসেজ করুন — আমরা সাহায্য করব ইনশাআল্লাহ। 💚`;

                  await sendSenderAction(senderId, "typing_on", page.accessToken);
                  // ── ORDER CONFIRM: Always send TEXT version ───────────────────
                  await sendFacebookMessage(senderId, confirmMsg, page.accessToken);
                  console.log(`[ORDER_CONFIRM] ✅ Confirmation (text) sent to ${senderId}`);

                  // ── ORDER CONFIRM: Also send VOICE version if customer prefers voice
                  if (isVoiceMode(senderId)) {
                    const voiceConfirm = isKasturiOrder
                      ? `আলহামদুলিল্লাহ ভাইয়া! আপনার কস্তুরী পাউডারের বুকিং অর্ডারটি গ্রহণ করা হয়েছে। এই প্রোডাক্টের জন্য ৫০০ টাকা অগ্রিম ডেলিভারি চার্জ প্রযোজ্য, বাকি টাকা ডেলিভারি ম্যানের কাছে পার্সেল পেয়ে পরিশোধ করবেন। আপনার মোবাইলে ${orderData.phone} নম্বরে যোগাযোগ করা হবে। ধন্যবাদ ভাইয়া।`
                      : `আলহামদুলিল্লাহ ভাইয়া! আপনার অর্ডারটি কনফার্ম হয়ে গেছে। ${orderData.customerName} ভাইয়ার নামে ${orderData.product} অর্ডার নেওয়া হয়েছে। আপনার মোবাইলে ${orderData.phone} নম্বরে ডেলিভারিম্যান কল করবে। ধন্যবাদ ভাইয়া, সুস্থ থাকুন।`;
                    await sleep(1200);
                    await sendSenderAction(senderId, "typing_on", page.accessToken);
                    await sendFacebookVoiceNote(senderId, voiceConfirm, page.accessToken);
                    console.log(`[ORDER_CONFIRM] 🎙️ Confirmation (voice) sent to ${senderId}`);
                  }
                }
              }
              } catch (orderErr) {
                console.warn("[ORDER_SAVE_ERR]", orderErr.message);
              }

            } else {
              const schedIntent = detectScheduledIntent(messageText);
              if (schedIntent) {
                // Only schedule if customer doesn't already have a pending reminder in last 10 mins
                let existingReminders = [];
                try { if (fs.existsSync(SCHEDULED_REMINDERS_FILE)) existingReminders = JSON.parse(fs.readFileSync(SCHEDULED_REMINDERS_FILE, "utf8")); } catch {}
                const recent = existingReminders.find(r => r.senderId === senderId && (new Date(r.createdAt) > new Date(Date.now() - 600000)));
                if (!recent) {
                  saveScheduledReminder(senderId, schedIntent.scheduledAt, page.accessToken, customerName, page.pageId);
                }
              }
            }
            console.log(`[FB_BOT] 🤖 [${page.pageName}] REPLY: "${replyText.slice(0, 70)}..."`);

            // ── 1. ALWAYS SEND TEXT REPLY IMMEDIATELY ────────────────────────────
            // Send text first so customer instantly sees the human answer (within 1-2s)
            const delay = calculateHumanTypingDelay(replyText);
            await sendSenderAction(senderId, "typing_on", page.accessToken);
            await sleep(Math.min(delay, 1500));
            const sendResult = await sendFacebookMessage(senderId, replyText, page.accessToken, lastMsg.id);
            console.log(`[FB_BOT] 🚀 [${page.pageName}] TEXT SENT [${sendResult.status}]:`, sendResult.data?.message_id || sendResult.data);
            recordOutgoingBotMessageInDb(senderId, replyText, false);
            customerMemory.appendChatMessage(senderId, "model", replyText, false);

            // ── 2. ALSO SEND VOICE NOTE IF IN VOICE MODE OR REQUESTED ────────────
            const userPrefersText = isTextModeRequested(messageText);
            // Auto-voice: if reply is long (200+ chars), automatically send voice alongside text
            const isLongReply = replyText && replyText.length >= 200;
            const wantsVoice = !userPrefersText && (
              isVoiceMode(senderId) ||
              isVoiceReq ||
              Boolean(audioAttach) ||
              isOnlyVoiceRequest(messageText) ||
              isVoiceRequested(messageText) ||
              isLongReply   // ← AUTO-VOICE for long messages
            );
            if (wantsVoice) {
              const voiceReason = isLongReply && !isVoiceMode(senderId) && !isVoiceReq
                ? "AUTO (long reply " + replyText.length + " chars)"
                : "VOICE_MODE/REQUESTED";
              console.log(`[FB_BOT] 🎙️ [${voiceReason}] Also sending voice note to ${senderId}...`);
              try {
                await sendSenderAction(senderId, "typing_on", page.accessToken);
                const sentVoice = await sendFacebookVoiceNote(senderId, replyText, page.accessToken);
                if (sentVoice) {
                  recordOutgoingBotMessageInDb(senderId, replyText, true);
                  console.log(`[FB_BOT] 🎙️ Voice note delivered to ${senderId}`);
                }
              } catch (vErr) {
                console.warn("[FB_BOT_VOICE_ERR]", vErr.message);
              }
            }

            saveProcessedId(lastMsg.id); // Persist to file once successfully attempted
          } catch (convErr) {
            console.error(`[FB_BOT_CONV_ERR] [${page.pageName}] Error processing thread ${conv.id}:`, convErr.message);
            for (const m of unrepliedCustomerMsgs) {
              inFlightMsgIds.delete(m.id);
            }
          }
        }
      } catch (pageErr) {
        console.error(`[FB_BOT] Error polling ${page.pageName}:`, pageErr.message);
      }
    }
  } catch (err) {
    // Network hiccup - ignore and keep polling
  } finally {
    isPolling = false;
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Scheduled Reminder System ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// Detect if customer gave order info (phone, address+name) → reminder should be cancelled
function isOrderPlaced(message) {
  if (!message) return false;
  const enMsg = message.replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const hasPhone = /01[3-9]\d{8}|\+8801[3-9]\d{8}/.test(enMsg);
  const hasOrderForm = /(?:নাম\s*[=:]|নাম্বার\s*[=:]|ঠিকানা\s*[=:]|জেলা\s*[=:]|থানা\s*[=:])/i.test(message);
  const hasAddress = /(জেলা|উপজেলা|থানা|রোড|গ্রাম|বাড়ি|মহল্লা|পাড়া|ward|para|road|village|ঠিকানা)/.test(message);
  const hasName = /(আমার নাম|নাম হলো|নাম:|নামঃ|নাম\s*=|my name|name is)/i.test(message);
  return hasOrderForm || hasPhone || (hasAddress && (hasName || hasPhone));
}

// Cancel any pending reminder for this customer
function cancelScheduledReminder(senderId) {
  if (!fs.existsSync(SCHEDULED_REMINDERS_FILE)) return;
  try {
    let reminders = JSON.parse(fs.readFileSync(SCHEDULED_REMINDERS_FILE, "utf8"));
    const before = reminders.length;
    reminders = reminders.filter(r => r.senderId !== senderId);
    if (reminders.length < before) {
      fs.writeFileSync(SCHEDULED_REMINDERS_FILE, JSON.stringify(reminders, null, 2), "utf8");
      console.log(`[REMINDER] Cancelled scheduled reminder for ${senderId} — order detected`);
    }
  } catch {}
}

// Save a scheduled reminder to file
function saveScheduledReminder(senderId, scheduledAt, accessToken, customerName, pageId) {
  let reminders = [];
  if (fs.existsSync(SCHEDULED_REMINDERS_FILE)) {
    try { reminders = JSON.parse(fs.readFileSync(SCHEDULED_REMINDERS_FILE, "utf8")); } catch {}
  }
  reminders = reminders.filter(r => r.senderId !== senderId);
  reminders.push({
    senderId, pageId,
    scheduledAt: scheduledAt.toISOString(),
    accessToken,
    customerName: customerName || "ভাইয়া",
    createdAt: new Date().toISOString()
  });
  fs.writeFileSync(SCHEDULED_REMINDERS_FILE, JSON.stringify(reminders, null, 2), "utf8");
  const timeStr = scheduledAt.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });
  console.log(`[REMINDER] Scheduled for ${customerName || senderId} at ${scheduledAt.toLocaleDateString()} ${timeStr}`);
}

// Smart time intent detection — covers 60+ expressions
function detectScheduledIntent(message) {
  if (!message) return null;
  const msg = message;
  const msgL = msg.toLowerCase();
  const now = new Date();

  const bn2en = (s) => String(s).replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const inHours = (h) => new Date(now.getTime() + Math.round(h * 3600000));
  const nextDay = (h = 10) => { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0); return d; };
  const inDays = (n, h = 10) => { const d = new Date(now); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d; };
  const todayAt = (h) => { const d = new Date(now); d.setHours(h, 0, 0, 0); return d; };

  // X ঘণ্টা / ghonta pore
  const hrM = msg.match(/([০-৯d]+)s*(?:[-–]s*[০-৯d]+)?s*(?:[ঘg][ণn]?্?[টt][াa]?|hour|hr)s*(?:পরে?|পর|বাদে|later|pore|par|bad)/i);
  if (hrM) {
    const h = parseInt(bn2en(hrM[1])) || 2;
    return { label: h + " ঘণ্টা পরে", scheduledAt: inHours(h) };
  }

  // মিনিট পরে
  const minM = msg.match(/([০-৯d]+)s*(?:মিনিট|min)s*(?:পরে?|পর|বাদে)/i);
  if (minM) {
    const m = parseInt(bn2en(minM[1])) || 30;
    return { label: m + " মিনিট পরে", scheduledAt: inHours(m / 60) };
  }

  // আধাঘণ্টা
  if (/আধা?s*ঘণ?্?টা|half.?hour/i.test(msg)) return { label: "আধাঘণ্টা পরে", scheduledAt: inHours(0.5) };

  // কালকে সকালে
  if (/কাল(কে)?s*(সকাল|ভোর|morning)|kals*sokale/i.test(msgL)) return { label: "কালকে সকালে", scheduledAt: nextDay(9) };

  // কালকে বিকেলে/সন্ধ্যায়
  if (/কাল(কে)?s*(বিকেল|সন্ধ্যা|evening|bikel|shondha)/i.test(msgL)) return { label: "কালকে বিকেলে", scheduledAt: nextDay(17) };

  // কালকে রাতে
  if (/কাল(কে)?s*(রাতে?|night|rat)/i.test(msgL)) return { label: "কালকে রাতে", scheduledAt: nextDay(21) };

  // কালকে (generic)
  if (/কাল(কে)?|tomorrow|kal(ke)?/.test(msgL) &&
      /নেব|নিব|করব|অর্ডার|কিনব|জানাব|nibo|korbo|order|buy/i.test(msgL)) {
    return { label: "কালকে", scheduledAt: nextDay(10) };
  }

  // পরশু
  if (/পরশু|poroshuu?|day.?after.?tomorrow/i.test(msgL)) return { label: "পরশু", scheduledAt: inDays(2, 10) };

  // আজ সন্ধ্যায়
  if (/আজ(কে)?s*(বিকেল|সন্ধ্যা|evening)|bikel.*nibo/i.test(msgL)) {
    const d = todayAt(18); if (d > now) return { label: "আজ সন্ধ্যায়", scheduledAt: d };
  }

  // আজ রাতে
  if (/আজ(কে)?s*(রাতে?|night)|tonight/i.test(msgL)) {
    const d = todayAt(21); if (d > now) return { label: "আজ রাতে", scheduledAt: d };
  }

  // X দিন পরে
  const dayM = msg.match(/([০-৯d]+)s*[দd]িনs*(পরে?|পর|বাদে|par)/i);
  if (dayM) { const n = parseInt(bn2en(dayM[1])) || 2; return { label: n + " দিন পরে", scheduledAt: inDays(n, 10) }; }

  // বেতনের পরে / টাকা হলে
  if (/বেতন|salary|টাকা.{0,10}হলে|taka.*hole/i.test(msgL)) return { label: "বেতনের পরে", scheduledAt: inDays(7, 10) };

  // পরে নেব / একটু পরে / এখন না
  if (/একটু পরে?|কিছুক্ষণ পরে?|একটু বাদে|পরেs*নেব|পরেs*নিব|পরেs*করব|পরেs*অর্ডার|পরেs*জানাব|ektus*pore|pores*nibo|later/i.test(msgL)) {
    return { label: "একটু পরে", scheduledAt: inHours(1) };
  }

  // এখন না
  if (/এখনs*না|nots*now|abhis*na/i.test(msgL)) return { label: "পরে", scheduledAt: inHours(2) };

  return null;
}

// Send due scheduled reminders — runs every 5 minutes
async function checkAndSendScheduledReminders() {
  if (!fs.existsSync(SCHEDULED_REMINDERS_FILE)) return;
  let reminders = [];
  try { reminders = JSON.parse(fs.readFileSync(SCHEDULED_REMINDERS_FILE, "utf8")); } catch { return; }

  const now = new Date();
  const due = reminders.filter(r => new Date(r.scheduledAt) <= now);
  const pending = reminders.filter(r => new Date(r.scheduledAt) > now);

  for (const r of due) {
    try {
      const name = r.customerName || "ভাইয়া";
      const opts = [
        `আসসালামু আলাইকুম ${name} ভাইয়া, আপনার জন্য কস্তুরী পাউডারের একটি বয়াম স্টক হোল্ড করে রেখেছিলাম। এখন কি ফ্রি আছেন ভাইয়া? আপনার অর্ডারটি কি বুকিং করে দেব?`,
        `${name} ভাইয়া, আশা করি এখন ফ্রি হয়েছেন। আপনার জন্য স্পেশাল স্টকটি রাখা আছে—অর্ডার কনফার্ম করতে নাম, ঠিকানা ও মোবাইল নম্বরটি পাঠিয়ে দিন।`,
        `${name} ভাইয়া, আপনার কথামতো সময়মতো জানাচ্ছি। কস্তুরী পাউডারটি বুকিং করতে নাম, ঠিকানা ও মোবাইল জানান। হেল্পলাইন: 01870-023804।`,
      ];
      const msg = opts[Math.floor(Math.random() * opts.length)];
      const activePages = getActivePages();
      const pg = activePages.find(p => p.pageId === r.pageId) || activePages[0];
      if (!pg) continue;
      const token = r.accessToken || pg.accessToken;
      await sendFacebookMessage(r.senderId, msg, token);
      customerMemory.appendChatMessage(r.senderId, "model", msg, false);
      console.log(`[REMINDER] Sent to ${name} (${r.senderId})`);
    } catch (e) { console.warn("[REMINDER_ERR]", e.message); }
    await sleep(2000);
  }

  if (due.length > 0) {
    fs.writeFileSync(SCHEDULED_REMINDERS_FILE, JSON.stringify(pending, null, 2), "utf8");
  }
}

// ── Start Engine ─────────────────────────────────────────────────────────────
async function startBot() {

  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  🤖 GREEN HEALTH BOT v2026-09-16             ║");
  console.log("║  Order Confirm + Smart Address ACTIVE        ║");
  console.log("╚══════════════════════════════════════════════╝");

  // ══ VOLUME DATA AUTO-INIT — runs on first boot after volume mount ══
  // If /app/data is empty (fresh volume), restore from /app/data-init backup
  try {
    const dataDir = path.join(process.cwd(), "data");
    const initDir = path.join(process.cwd(), "data-init");
    if (fs.existsSync(initDir)) {
      const dataFiles = fs.existsSync(dataDir) ? fs.readdirSync(dataDir) : [];
      const hasData = dataFiles.some(f => f.endsWith(".json") || fs.statSync(path.join(dataDir, f)).isDirectory());
      if (!hasData) {
        console.log("[STARTUP] 📂 Empty data volume detected. Restoring from backup...");
        const copyDir = (src, dest) => {
          if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
          for (const f of fs.readdirSync(src)) {
            const srcPath = path.join(src, f);
            const destPath = path.join(dest, f);
            if (fs.statSync(srcPath).isDirectory()) copyDir(srcPath, destPath);
            else if (!fs.existsSync(destPath)) fs.copyFileSync(srcPath, destPath);
          }
        };
        copyDir(initDir, dataDir);
        console.log("[STARTUP] ✅ Customer data restored from backup!");
        // Run migration to create folder structure
        try {
          require("child_process").execSync(`node ${path.join(__dirname, "migrate_existing_chats.js")}`, { stdio: "pipe" });
          console.log("[STARTUP] ✅ Customer folder migration completed!");
        } catch {}
      } else {
        console.log("[STARTUP] ✅ Data volume has existing data — no restore needed.");
      }
    }
  } catch (_initErr) {
    console.warn("[STARTUP_DATA_INIT]", _initErr.message);
  }

  // ══ STARTUP TOKEN VALIDATION — runs on every boot ══
  // Checks if DB token is valid. If expired, uses hardcoded permanent token.
  (async () => {

    try {
      const HARD_TOKEN = "EAAjkLPT8UegBSsQVgxm1fBW6D7N7oon9ZAudS1UKVLVbBEar1BGEvZCLJ3ibSLO6FmILQDf6mq4rcsL98cpxuuRwAHSwUprKUBLv6ZBBCSjYAGUPTU1SQIRDvR74D5aIivRiDoUG3zobZB83AIwZA8mZAhoqcBDpjii2KsvQshwZCCIdUSJk5NaDb5JZCFGt4YWKBfEZC";
      const _dbFile = path.join(process.cwd(), "prisma", "social_inbox.db");
      if (!fs.existsSync(_dbFile)) return;
      const _db = new Database(_dbFile);
      const _row = _db.prepare("SELECT accessToken FROM ConnectedAccount WHERE platform = 'FACEBOOK'").get();
      const _cur = _row?.accessToken || "";

      // Validate current DB token
      const _check = await fetch("https://graph.facebook.com/v19.0/me?access_token=" + _cur).then(r => r.json()).catch(() => ({}));
      if (_check.id) {
        _db.prepare("UPDATE ConnectedAccount SET pageId = ?, pageName = ? WHERE platform = 'FACEBOOK' AND accessToken = ?").run(_check.id, _check.name || "হেলথ কেয়ার", _cur);
        console.log("[STARTUP] ✅ Facebook token is valid. Page:", _check.name, "ID:", _check.id);
        _db.close();
        return;
      }

      // Token expired — try hardcoded permanent token
      console.log("[STARTUP] ⚠️ DB token expired. Trying permanent token...");
      const _check2 = await fetch("https://graph.facebook.com/v19.0/me?access_token=" + HARD_TOKEN).then(r => r.json()).catch(() => ({}));
      if (_check2.id) {
        _db.prepare("UPDATE ConnectedAccount SET accessToken = ?, pageId = ?, pageName = ? WHERE platform = 'FACEBOOK'").run(HARD_TOKEN, _check2.id, _check2.name || "হেলথ কেয়ার");
        _db.close();
        console.log("[STARTUP] ✅ Permanent token restored! Page:", _check2.name, "ID:", _check2.id);
        return;
      }

      // Both expired — try app credentials exchange
      console.log("[STARTUP] ⚠️ Both tokens expired. Trying app credentials...");
      const _appRes = await fetch(
        "https://graph.facebook.com/v19.0/oauth/access_token?client_id=" + FACEBOOK_APP_ID +
        "&client_secret=" + FACEBOOK_APP_SECRET + "&grant_type=client_credentials"
      ).then(r => r.json()).catch(() => ({}));

      if (_appRes.access_token) {
        const _pgRes = await fetch(
          "https://graph.facebook.com/v19.0/932259009980880?fields=access_token,name&access_token=" + _appRes.access_token
        ).then(r => r.json()).catch(() => ({}));
        if (_pgRes.access_token) {
          _db.prepare("UPDATE ConnectedAccount SET accessToken = ?, pageId = ?, pageName = ? WHERE platform = 'FACEBOOK'").run(_pgRes.access_token, PAGE_ID, "হেলথ কেয়ার");
          _db.close();
          console.log("[STARTUP] ✅ Token refreshed via app credentials! Page:", _pgRes.name);
          return;
        }
      }

      _db.close();
      console.error("[STARTUP] 🚨 All token refresh attempts failed!");
      console.error("[STARTUP] 🔗 Fix: Go to https://developers.facebook.com/tools/explorer/ and run the token exchange script");
    } catch (_e) {
      console.warn("[STARTUP_TOKEN_ERR]", _e.message);
    }
  })();


  // ── SYNC DB TOKEN NOW (before page load) — ensures valid token everywhere ──
  try {
    const _syncDbPath = path.join(process.cwd(), "prisma", "social_inbox.db");
    if (fs.existsSync(_syncDbPath)) {
      const _syncDb = new Database(_syncDbPath);
      _syncDb.prepare("UPDATE ConnectedAccount SET accessToken = ?, pageId = ?, pageName = ?, isActive = 1, aiAutoReply = 1 WHERE platform = 'FACEBOOK'").run(PAGE_TOKEN, PAGE_ID, "হেলথ কেয়ার");
      console.log("[STARTUP] ✅ Token guaranteed valid in DB before page load");
      _syncDb.close();
    }
  } catch (_se) { console.warn("[STARTUP_PRESYNC_ERR]", _se.message); }

  console.log("=================================================");
  console.log("  GREEN HEALTH BOT - MULTI-PAGE MESSENGER ENGINE ");
  console.log("=================================================");

  // Load existing conversation thread memory
  loadThreadMemory();

  // Initialize: preload old messages so we only reply to new or unreplied recent messages
  try {
    const activePages = getActivePages();
    const now = Date.now();
    console.log(`[FB_BOT] Initializing across ${activePages.length} active page(s):`);
    for (const page of activePages) {
      console.log(`  - Page: "${page.pageName}" (ID: ${page.pageId})`);
      try {
        const initConvs = await fetchConversations(page.pageId, page.accessToken);
        for (const conv of initConvs) {
          const msgs = conv.messages?.data || [];
          for (let i = 0; i < msgs.length; i++) {
            const m = msgs[i];
            const isLatest = (i === 0);
            const isFromCustomer = m.from?.id && String(m.from.id) !== String(page.pageId);

            // If latest message in thread is from customer and not replied, NEVER ignore it!
            if (isLatest && isFromCustomer && !processedIds.has(m.id)) {
              console.log(`[FB_BOT] [${page.pageName}] Found pending unreplied message from ${m.from?.name || "Customer"}: "${m.message}". Processing on first tick.`);
            } else {
              if (m.id) processedIds.add(m.id);
            }
          }
        }
      } catch (e) {}
    }
    console.log(`[FB_BOT] Preloaded ${processedIds.size} message IDs across all pages. Starting real-time loop...`);
  } catch (e) {
    console.warn("[FB_BOT] Init warning:", e.message);
  }

  // Poll every 2.0 seconds
  setInterval(pollOnce, 2000);
  // Check scheduled reminders every 5 minutes
  setInterval(checkAndSendScheduledReminders, 5 * 60 * 1000);
  // Also check immediately after 30s boot
  setTimeout(checkAndSendScheduledReminders, 30000);

  // Start smart follow-up scheduler (checks every hour)
  setTimeout(async () => {
    await runFollowUpScheduler();
    setInterval(runFollowUpScheduler, 30 * 60 * 1000); // every 30 mins
  }, 30 * 1000); // first run after 30 seconds (let bot fully boot first)
}

// ── Smart Follow-up Scheduler ─────────────────────────────────────────────────
// Runs every hour — finds customers who haven't ordered yet and sends
// a unique, AI-generated, personal doctor-style follow-up message.
// Each customer gets max 3 follow-ups (3 days, 7 days, 14+ days after last chat).
let isFollowingUp = false;

async function runFollowUpScheduler() {
  if (isFollowingUp) return;
  isFollowingUp = true;

  try {
    // Check candidates who were last in touch 1-2 days ago (20 to 65 hours)
    const candidates = customerMemory.getEligibleFollowUpCandidates(20, 65);
    if (candidates.length === 0) {
      console.log("[FOLLOWUP] No eligible 1-2 day follow-up candidates at this time.");
      isFollowingUp = false;
      return;
    }

    console.log(`[FOLLOWUP] 📬 Found ${candidates.length} customer(s) eligible for 1-2 day caring check-in.`);

    const activePages = getActivePages();
    if (!activePages || activePages.length === 0) {
      isFollowingUp = false;
      return;
    }

    const primaryPage = activePages[0];

    for (const candidate of candidates) {
      const { profile, stage, daysSinceLastContact } = candidate;
      const senderId = profile.senderId;

      try {
        const followUpPrompt = customerMemory.buildPersonalizedFollowUpPrompt(
          candidate,
          "হাকীম মো: আব্দুল করিম",
          primaryPage.pageName || "গ্রীন হেলথ ইউনানী ফার্মেসী"
        );

        let followUpMessage = null;

        // 1. Try Gemini
        const models = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.6-flash", "gemini-flash-latest"];
        for (const m of models) {
          try {
            const model = genAI.getGenerativeModel({
              model: m,
              systemInstruction: "You are হাকীম মো: আব্দুল করিম, Category-A Registered Unani Physician. Output ONLY the clean Bengali message. Absolutely no explanations, no checklists, no internal thoughts, no markdown, no quotes.",
              generationConfig: { maxOutputTokens: 600, temperature: 0.6 }
            });
            const res = await model.generateContent(followUpPrompt);
            let raw = res.response.text().trim();
            if (raw.includes("ভাই, আসসালামু") || raw.includes("আসসালামু আলাইকুম")) {
              const match = raw.match(/(?:[A-Za-z\u0980-\u09FF\s]+ভাই[,\s]+)?আসসালামু\s*আলাইকুম[\s\S]+/i) || raw.match(/আসসালামু\s*আলাইকুম[\s\S]+/i);
              if (match) raw = match[0];
            }
            if (raw && raw.length > 15) {
              followUpMessage = raw.replace(/[*#"`]+/g, "").trim()
                .replace(/রেজাউল\s*করিম/gi, "মো: আব্দুল করিম")
                .replace(/রেজাউল/gi, "রিয়াজুল");
              break;
            }
          } catch (aiErr) {
            console.warn(`[FOLLOWUP_AI_WARN] (${m}):`, aiErr.message);
          }
        }

        // 2. Fallback to Groq if Gemini fails
        if (!followUpMessage && typeof callGroqLLM === "function") {
          try {
            const groqRes = await callGroqLLM(followUpPrompt, "You are Hakim Md. Abdul Karim, caring Bangladeshi physician.");
            if (groqRes && groqRes.length > 15) {
              followUpMessage = groqRes.replace(/[*#]+/g, "").trim();
            }
          } catch (gErr) {
            console.warn("[FOLLOWUP_GROQ_WARN]:", gErr.message);
          }
        }

        // 3. Fallback to intelligent rule-based caring check-in if AI is offline
        if (!followUpMessage && typeof customerMemory.generateFallbackCaringFollowUp === "function") {
          followUpMessage = customerMemory.generateFallbackCaringFollowUp(profile);
        }

        if (!followUpMessage) continue;

        console.log(`[FOLLOWUP] 📤 Sending 2-day check-in to ${profile.name || senderId} (${daysSinceLastContact} days inactive): "${followUpMessage.slice(0, 80)}..."`);
        const result = await sendFacebookMessage(senderId, followUpMessage, primaryPage.accessToken);

        if (result && result.status === 200) {
          customerMemory.recordFollowUpSent(senderId, followUpMessage, stage);
          console.log(`[FOLLOWUP] ✅ Delivered 2-day caring check-in to ${profile.name || senderId}.`);
        } else {
          console.warn(`[FOLLOWUP] ⚠️ Failed to deliver to ${senderId}. Status: ${result?.status}`);
        }

        await sleep(3000);
      } catch (err) {
        console.warn(`[FOLLOWUP_ERR] Error processing follow-up for ${senderId}:`, err.message);
      }
    }
  } catch (err) {
    console.error("[FOLLOWUP_FATAL]", err.message);
  } finally {
    isFollowingUp = false;
  }
}

if (require.main === module) {
  startBot();
} else {
  module.exports = {
    generateReply,
    sendFacebookMessage,
    sendFacebookVoiceNote,
    isVoiceMode,
    recordOutgoingBotMessageInDb,
    saveProcessedId,
    fetchConversations
  };
}



