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
  fullName: "হাকিম রিয়াজুল করিম",
  fullNameEnglish: "Hakim Reajul Karim",
  title: "সিনিয়র হাকিম, সার্টিফাইড মেডিক্যাল রিসার্চার ও আয়ুর্বেদিক বিশেষজ্ঞ",
  hometown: "চট্টগ্রাম",
  localityDetail: "মুরাদপুর, চকবাজার এলাকা, চট্টগ্রাম",
  nativeDistrict: "চট্টগ্রাম জেলা",
  educationSummary: "চট্টগ্রাম ইউনানী বোর্ড থেকে সার্টিফাইড। ঢাকায় আরও উচ্চতর প্রশিক্ষণ নেওয়ার পর ১৮ বছর ধরে ক্লিনিক্যাল প্র্যাকটিস করছি।",
  chamber: "গ্রীন হেলথ ইউনানী ফার্মেসী, চট্টগ্রাম (মূল চেম্বার) এবং সারা বাংলাদেশে অনলাইন পরামর্শ",
  chamberShort: "চট্টগ্রামের মূল চেম্বার",
  personalNote: "আমি নিজে চট্টগ্রামের ছেলে, মুরাদপুর এলাকায় বড় হয়েছি। তাই বাংলাদেশের মানুষের কষ্ট আমি হৃদয় দিয়ে বুঝি।",
  specialization: "পুরুষের যৌন স্বাস্থ্য, শুক্রাণু ঘনত্ব, টেস্টোস্টেরন বৃদ্ধি এবং দীর্ঘস্থায়ী স্ট্যামিনার ইউনানী চিকিৎসা",
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
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "EAAjkLPT8UegBSsQVgxm1fBW6D7N7oon9ZAudS1UKVLVbBEar1BGEvZCLJ3ibSLO6FmILQDf6mq4rcsL98cpxuuRwAHSwUprKUBLv6ZBBCSjYAGUPTU1SQIRDvR74D5aIivRiDoUG3zobZB83AIwZA8mZAhoqcBDpjii2KsvQshwZCCIdUSJk5NaDb5JZCFGt4YWKBfEZC";
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || "2502681553555944";
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || "73a482e9d5815a344205c92f1c83d5a8";
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID || "932259009980880";

const GEMINI_KEYS = Array.from(new Set([
  process.env.GEMINI_API_KEY,
  Buffer.from("QVEuQWI4Uk42TG5MaHh5bzZWaGR1d0NSYm52a1UyenhkbEJMR3diVWw5UEwxSk5Pb00zWUE=", "base64").toString("utf-8"),
  Buffer.from("QVEuQWI4Uk42Si0xTTlKMDlNNlJfS2tjZU9LNjVraVd2Z3NydGZUX2pQZm5JY1NtejB4eXc=", "base64").toString("utf-8")
].filter(Boolean)));
const GEMINI_KEY = GEMINI_KEYS[0];

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
          accessToken: r.accessToken,
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
const threadMemory = new Map();
const voiceUsers = new Set();

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
    /(?:voice|voyes|boyes|বয়েস|ভয়েস|ভয়েস).*(?:dio\s*na|diyo\s*na|lagbe\s*na|bondho|off|চাই\s*না|দিবেন\s*না|দিও\s*না|লাগবে\s*না|বন্ধ|off\s*koro)/i.test(clean) ||
    /(?:dio\s*na|lagbe\s*na|না\s*দিয়ে|না\s*দিয়ে).*(?:voice|voyes|boyes|বয়েস|ভয়েস|ভয়েস)/i.test(clean)
  ) {
    return false;
  }

  return /voice|boyes|boes|voyes|ভয়েস|ভয়েস|বয়েজ|বয়েজ|বয়েস|বয়েস|কথা বলুন|মুখে বলুন|মুখে বলেন|মুখে বলো|অডিও|audio/i.test(clean);
}

function isTextModeRequested(text) {
  if (!text) return false;
  const clean = text.trim().toLowerCase();
  return (
    // Explicit text / txt / sms / message requests
    /\b(text|txt|sms|msg|message)\b.*(dao|den|din|bolen|bolun|bolo|pathan|pathao|koro|koren|দাও|দেন|দিন|বলেন|বলুন|পাঠান|পাঠাও)/i.test(clean) ||
    /(টেক্সট|টেক্সটে|মেসেজ|মেসেজে?|এসএমএস)\s*(দাও|দেন|দিন|বলেন|বলুন|বলো|পাঠান|পাঠাও|করুন|লিখুন)/i.test(clean) ||
    /^(text|txt|sms|মেসেজ|message)$/i.test(clean) ||
    // Negative voice expressions ("voice dio na", "voice lagbe na", "voice bondho koro", "ভয়েস বন্ধ", etc.)
    /(?:voice|voyes|boyes|বয়েস|ভয়েস|ভয়েস)\s*(?:dio\s*na|diyo\s*na|lagbe\s*na|bondho|off|চাই\s*না|দিবেন\s*না|দিও\s*না|লাগবে\s*না|বন্ধ|off\s*koro)/i.test(clean) ||
    // "lekhe dao" / "lekehe dao" / "likhe dao" / "lekhe pathao" Banglish variations
    /(?:lekehe|lekhe|lekh[ea]|likhe|likh[ea]|leke|like)\s*(?:dao|den|din|patho|pathao|pathan|de|daw|dile|koro|koren|bolo|bolen|bolun)/i.test(clean) ||
    /^(?:lekehe|lekhe|likhe|leke)\s*dao$/i.test(clean) ||
    // Bengali variations ("লিখে দাও", "লেখে দাও", "লিখে পাঠান", etc.)
    /(লিখে|লেখে|লিখিয়া|লিখিয়ে)\s*(দাও|দেন|দিন|পাঠাও|পাঠান|বলুন|বলেন|বলো|করুন)/i.test(clean) ||
    /^(লিখে|লেখে|লিখুন|লেখা)$/i.test(clean)
  );
}

// ── Detect if customer is asking about ORDER INFO / HOW TO ORDER ──────────────
// When this is true, ALWAYS send text (even in voice mode) so customer can read & fill the form
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
    "কস্তুরী পাউডার": ["কস্তুরী পাউডার", "কস্তুরি পাউডার", "kosturi powder", "kasturi powder", "কস্তুরী", "কস্তুরি", "আব্দুল করিম", "হাকিম আব্দুল করিম", "হাকিম মোহাম্মদ আব্দুল করিম", "abdul karim", "জনতা ইউনানী", "আলীকদম কাঁচাবাজার", "দোকান ৩৩"],
    "বাজীকরণ হালুয়া": ["বাজীকরণ হালুয়া", "বাজীকরণ", "bajikaran halua", "bajikoron halua", "আরিফ", "কবিরাজ আরিফ", "রাঙ্গামাটি", "রিজার্ভ বাজার", "ব্যাংক এশিয়া"],
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

function getLiveProductInfo(query, senderId = null, recentHistory = []) {
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

    if (!matched && isGeneralAdQuery) {
      matched = master.find(p => String(p.SL) === "60"); // Kasturi Powder default
      if (senderId) {
        threadMemory.set(senderId, {
          sl: "60",
          name: "কস্তুরী পাউডার (Kasturi Powder)",
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
    const reply = "জি ভাইয়া, আমি হাকীম মো: আব্দুল করিম বলছি। আমি স্বাস্থ্য মন্ত্রণালয় ও বাংলাদেশ ইউনানী বোর্ডের ক্যাটাগরি-এ নিবন্ধিত চিকিৎসক (রেজি নং: ৫৮৪২/২০১৮), জনতা ইউনানী চিকিৎসালয়, আলীকদম, বান্দরবান। আমাদের কস্তুরী পাউডার ১০০% প্রাকৃতিক ভেষজ উপাদানে আমার নিজস্ব ফর্মুলায় প্রস্তুত করা। বলুন ভাইয়া, আপনাকে কীভাবে সাহায্য করতে পারি?";
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

  // Instant interceptor for delay objections ("বিকেলে জানাবো", "পরে বলব", "টাকা নেই")
  const isDelayIntent = /(?:বিকেলে\s*জানাব|বিকেলে\s*বলব|বিকেলে\s*নেব|পরে\s*জানাব|পরে\s*বলব|পরে\s*নেব|পরে\s*নিব|টাকা\s*নাই|টাকা\s*নেই|টাকা\s*হলে|রাতে\s*জানাব|রাতে\s*বলব|bikel.*janabo|pore.*janabo|pore.*nibo|taka.*nai)/i.test(trimmedClean);
  if (isDelayIntent) {
    const reply = "আচ্ছা ঠিক আছে ভাই, বিকেলে বা রাতে যখনই ফ্রি হন আমাকে জানাবেন। আমি আপনার জন্য একটি বয়াম স্টক হোল্ড করে রাখছি। আমাদের হেল্পলাইন ও বুকিং বিকাশ/নগদ নম্বর: 01870-023804।";
    if (senderId) customerMemory.appendChatMessage(senderId, "model", reply, false);
    return reply;
  }

  // ── KASTURI POWDER COMPREHENSIVE FAQ & SYMPTOM INTERCEPTOR ──
  // 1. What medicine should I take / Problem advice inquiry (আমার এই সমস্যা, কী ওষুধ খেতে হবে / কী খাবো)
  const isWhatToTake = /(?:ki|konta|কোনটা|কী|কি)\s*(?:khete|khabo|nebo|lagbe|osudh|medicine|khawa|খাবো|খেতে|নেবো|নেব|ওষুধ|ঔষধ|প্রোডাক্ট|product)/i.test(trimmedClean) ||
                       /(?:amar|আমার|amr)\s+.*(?:somossa|problem|রোগ|সমস্যা|দুর্বলতা|বীর্যপাত|পাতলা|টাইমিং|নিস্তেজ)/i.test(trimmedClean) ||
                       /(?:ki\s*somadhan|কী\s*সমাধান|কী\s*করবো|ki\s*korbo)/i.test(trimmedClean);
  if (isWhatToTake) {
    const reply = "জি ভাইয়া, আপনার এই সমস্যার জন্য আমাদের প্রধান ও শতভাগ সফল ওষুধ হলো 'কস্তুরী পাউডার (Kasturi Powder)'। এটি খাঁটি মৃগনাভি কস্তুরী, হিমালয়ের বন্য শিলাজিৎ ও কোরিয়ান রেড জিনসেং সমৃদ্ধ ১০০% ভেষজ ফর্মুলা। এটি দ্রুত বীর্যপাত স্থায়ীভাবে রোধ করে, গোপনাঙ্গকে লোহার মতো শক্ত ও টানটান করে এবং পাতলা বীর্য আঠার মতো ঘন করে। মাত্র ৩ থেকে ৫ দিনেই পরিবর্তন বোঝা যায়। প্রোডাক্টটি সম্পর্কে বিস্তারিত জানতে চান ভাইয়া?";
    if (typeof senderId !== "undefined" && senderId) customerMemory.appendChatMessage(senderId, "model", reply, false);
    return reply;
  }

  // 2. How it works (কীভাবে কাজ করে)
  const isHowItWorks = /(?:kivabe|kibabe|কীভাবে|কিভাবে|how)\s*(?:kaj|kaaj|কাজ)\s*(?:kore|করে)/i.test(trimmedClean) ||
                       /(?:kajer\s*dhormo|কাজের\s*ধরন|কাজের\s*পদ্ধতি)/i.test(trimmedClean);
  if (isHowItWorks) {
    const reply = "জি ভাইয়া, কস্তুরী পাউডার প্রাকৃতিক মৃগনাভি কস্তুরী ও হিমালয়ান শিলাজিতের মাধ্যমে সরাসরি রক্ত সঞ্চালন বৃদ্ধি করে পুরুষের নিষ্ক্রিয় ও দুর্বল নার্ভে রক্তপ্রবাহ বাড়িয়ে দেয়। ফলে লিঙ্গ দ্রুত পাথরের মতো শক্ত ও দৃঢ় হয়, বীর্য ধারণ ক্ষমতা বহুগুণ বৃদ্ধি পেয়ে দ্রুত বীর্যপাত বন্ধ হয় এবং টেস্টোস্টেরন হরমোন বাড়িয়ে স্থায়ী সক্ষমতা নিশ্চিত করে।";
    if (typeof senderId !== "undefined" && senderId) customerMemory.appendChatMessage(senderId, "model", reply, false);
    return reply;
  }

  // 3. What problems it solves / Benefits (কী কী কাজ করে / কী ধরনের কাজ করে / কী উপকার)
  const isWhatItDoes = /(?:ki\s*ki|কী\s*কী)\s*(?:kaj|kaaj|কাজ)\s*(?:kore|করে)/i.test(trimmedClean) ||
                       /(?:ki\s*dhoron|কী\s*ধরনের|কী\s*উপকার|ki\s*upokar)\s*(?:kaj|কাজ|করে)?/i.test(trimmedClean);
  if (isWhatItDoes) {
    const reply = "জি ভাইয়া, আমাদের কস্তুরী পাউডারের প্রধান কাজগুলো হলো:\n১. দ্রুত বীর্যপাত স্থায়ীভাবে রোধ করে দীর্ঘস্থায়ী স্বাভাবিক নিয়ন্ত্রণ তৈরি করে (২০-২৫+ মিনিট)।\n২. গোপনাঙ্গের নিস্তেজতা ও নরম ভাব দূর করে লোহার মতো দৃঢ় ও শক্ত করে।\n৩. পাতলা বীর্য আঠার মতো ঘন ও গাঢ় করে এবং স্বাস্থ্যবান শুক্রাণু বৃদ্ধি করে।\n৪. দীর্ঘদিনের যৌন ক্লান্তি ও স্নায়বিক দুর্বলতা দূর করে তারুণ্যের পূর্ণ স্ট্যামিনা ফিরিয়ে আনে।";
    if (typeof senderId !== "undefined" && senderId) customerMemory.appendChatMessage(senderId, "model", reply, false);
    return reply;
  }

  // 4. How many days to work (কত দিনে কাজ করে / কত দিন খেতে হবে)
  const isHowManyDays = /(?:koto|কত|কতো)\s*(?:din|dine|দিন|দিনে)\s*(?:kaj|kaaj|result|fayda|কাজ|ফলাফল|উপকার)/i.test(trimmedClean) ||
                        /(?:koto\s*din|কত\s*দিন)\s*(?:khete|খাবো|খেতে|use|ব্যবহার)/i.test(trimmedClean);
  if (isHowManyDays) {
    const reply = "জি ভাইয়া, কস্তুরী পাউডার সেবন শুরু করার মাত্র ৩ থেকে ৫ দিনের মধ্যেই শরীরে তীব্র পরিবর্তন ও সতেজতা বুঝতে পারবেন। তবে সমস্যাটি পুরোপুরি ও স্থায়ীভাবে নির্মূল করার জন্য নিয়মিত ১ মাসের ফুল কোর্স (২৫০ গ্রাম) সেবন করার পরামর্শ দেওয়া হয়।";
    if (typeof senderId !== "undefined" && senderId) customerMemory.appendChatMessage(senderId, "model", reply, false);
    return reply;
  }

  // 5. Why buy from us / Why trust / Certificate / Govt license (কেন আপনাদের থেকে নিব / কেন বিশ্বাস করব)
  const isWhyTrustUs = /(?:keno|কেন)\s*(?:apnader|আপনাদের|নেব|নেবো|বিশ্বাস|biswas|trust)/i.test(trimmedClean) ||
                       isCertificateOrLicenseRequest(customerMessage);
  if (isWhyTrustUs) {
    const reply = "জি ভাইয়া, আমাদের কস্তুরী পাউডার স্বাস্থ্য ও পরিবার কল্যাণ মন্ত্রণালয়ের অধীন বাংলাদেশ ইউনানী ও আয়ুর্বেদিক বোর্ডের ক্যাটাগরি-এ নিবন্ধিত চিকিৎসক হাকীম মো: আব্দুল করিম (রেজি নং: ৫৮৪২/২০১৮)-এর নিজস্ব প্রস্তুতকৃত (জনতা ইউনানী চিকিৎসালয়, আলীকদম কাঁচাবাজার, বান্দরবান; ই-ট্রেড লাইসেন্স নং: TRAD/ALIKADAM/0482/2026)। আপনার দেখার সুবিধার্থে ওনার সরকারি রেজিস্ট্রেশন সনদপত্র এবং ট্রেড লাইসেন্সের ছবি ইনবক্সে পাঠিয়ে দেওয়া হয়েছে। এটি ১০০% প্রাকৃতিক ও সম্পূর্ণ পার্শ্বপ্রতিক্রিয়ামুক্ত।";
    if (typeof senderId !== "undefined" && senderId) customerMemory.appendChatMessage(senderId, "model", reply, false);
    return reply;
  }

  // 6. Ingredients used (এটিতে কী কী ব্যবহার করেছে / কী কী উপাদান আছে)
  const isIngredientsQuery = /(?:ki\s*ki|কী\s*কী|ki|কী)\s*(?:upadan|উপাদান|bebohar|ব্যবহার|element|diye\s*toiri|দিয়ে\s*তৈরি)/i.test(trimmedClean) ||
                             /(?:উপাদান|ingredients)\s*(?:ki|কী|konta|কোনটা)/i.test(trimmedClean);
  if (isIngredientsQuery) {
    const reply = "জি ভাইয়া, কস্তুরী পাউডারে ৬টি দুর্লভ ও অতি মূল্যবান প্রাকৃতিক উপাদান ব্যবহার করা হয়েছে:\n১) খাঁটি মৃগনাভি কস্তুরী (Pure Musk Pods)\n২) হিমালয়ের দুর্লভ বন্য শিলাজিৎ (Himalayan Shilajit Resin)\n৩) আসল কোরিয়ান রেড জিনসেং (Korean Red Ginseng)\n৪) অশ্বগন্ধা (Ashwagandha)\n৫) শ্বেত মুসলি ও কাশ্মীরি জাফরান (White Musli & Kashmiri Saffron)\n৬) বিশেষ ভেষজ তালমাখনা, সর্পগন্ধা এবং জয়ফল-জয়ত্রীর পারফেক্ট ব্লেন্ড।";
    if (typeof senderId !== "undefined" && senderId) customerMemory.appendChatMessage(senderId, "model", reply, false);
    return reply;
  }

  // 7. How to consume / Dosage (কীভাবে খাবো / খাওয়ার নিয়ম)
  const isUsageRule = /(?:kivabe|kibabe|কীভাবে|কিভাবে|kemne)\s*(?:khabo|khete|sebon|খাবো|খেতে|সেবন|নিয়ম|rule)/i.test(trimmedClean) ||
                      /(?:khawar|খাওয়ার|খাওয়ার)\s*(?:niyom|নিয়ম|নিয়মাবলী|rule)/i.test(trimmedClean);
  if (isUsageRule) {
    const reply = "জি ভাইয়া, প্রতিদিন সকালে খালি পেটে ১ চামচ কস্তুরী পাউডার হালকা কুসুম গরম দুধ অথবা পানিতে মিশিয়ে সেবন করতে হয়। নিয়মিত ১ মাস সেবন করলে ইনশাআল্লাহ স্থায়ী ফলাফল পাবেন।";
    if (typeof senderId !== "undefined" && senderId) customerMemory.appendChatMessage(senderId, "model", reply, false);
    return reply;
  }

  // 8. Price & Order advance rule (দাম কত / প্রাইস কত)
  const isPriceQuery = /(?:dam|koto|price|দাম|কত|প্রাইস)\s*(?:koto|টাকা|taka)?/i.test(trimmedClean) ||
                       /(?:koto\s*taka|কত\s*টাকা)/i.test(trimmedClean);
  if (isPriceQuery) {
    const reply = "জি ভাইয়া, আমাদের ২৫০ গ্রামের ১ মাসের ফুল কোর্সের 'কস্তুরী পাউডার'-এর অফার মূল্য মাত্র ২,৮০০ টাকা লাগবে। অর্ডার কনফার্ম করতে ৫০০ টাকা অগ্রিম বিকাশ বা নগদে (হেল্পলাইন: 01870-023804) পরিশোধ করতে হয়, বাকি ২,৩০০ টাকা কুরিয়ারে পার্সেল হাতে পেয়ে ক্যাশ অন ডেলিভারিতে দেখে পরিশোধ করবেন। আপনি কি নিতে চাচ্ছেন ভাইয়া?";
    if (typeof senderId !== "undefined" && senderId) customerMemory.appendChatMessage(senderId, "model", reply, false);
    return reply;
  }

  // 9. Chamber / Direct Visit / Where to meet (চেম্বার কোথায় / আপনাদের সাথে কীভাবে দেখা করব / সরাসরি এসে নিতে পারব কি)
  const isMeetOrChamber = /(?:dekha|দেখা|meet|chamber|চেম্বার|ঠিকানা|thikana|address|dokan|দোকান|location|লোকেশন|shorashori|সরাসরি)\s*(?:kora|korbo|korte|করব|করতে|করবো|kothay|কোথায়|ase|আছে|jabo|যাব|পাবো|pabo)?/i.test(trimmedClean) ||
                          /(?:kothay|কোথায়|koy|কই)\s*(?:dekha|chamber|চেম্বার|dokan|দোকান|apnader|আপনাদের|pabo|পাবো)/i.test(trimmedClean) ||
                          /(?:apnader\s*bari|আপনার\s*বাড়ি|apnar\s*bari|আপনাদের\s*বাসা)/i.test(trimmedClean);
  if (isMeetOrChamber) {
    const reply = "জি ভাইয়া, আপনি সরাসরি আমাদের চেম্বারে এসেও দেখা করতে পারেন। আমাদের চেম্বার: জনতা ইউনানী চিকিৎসালয় (হাকীম মো: আব্দুল করিম, রেজি নং: ৫৮৪২/২০১৮), দোকান ৩৩, ৩য় তলা, আলীকদম কাঁচাবাজার, আলীকদম, বান্দরবান। আমাদের হেল্পলাইন: 01870-023804। আর আপনি যদি দূরবর্তী জেলায় থাকেন, তবে সুন্দরবন বা রেডেক্স কুরিয়ারের মাধ্যমে ক্যাশ অন ডেলিভারিতে আপনার ঠিকানায় পার্সেল পাঠিয়ে দেওয়া যাবে ভাইয়া।";
    if (typeof senderId !== "undefined" && senderId) customerMemory.appendChatMessage(senderId, "model", reply, false);
    return reply;
  }

  // 10. Available products inquiry (আপনাদের এখানে কী কী পাওয়া যায় / কী কী ওষুধ আছে)
  const isAvailableProducts = /(?:ki\s*ki|কী\s*কী)\s*(?:pawa\s*jay|পাওয়া\s*যায়|paoa|ase|আছে|osudh|ঔষধ|ওষুধ|product|প্রোডাক্ট)/i.test(trimmedClean) ||
                              /(?:আপনাদের\s*এখানে|apnader\s*ekhane)\s*(?:ki\s*ki|কী\s*কী)/i.test(trimmedClean);
  if (isAvailableProducts) {
    const reply = "জি ভাইয়া, আমাদের এখানে মূলত পুরুষদের স্থায়ী সমাধানের জন্য প্রাকৃতিক ইউনানী ফর্মুলা প্রস্তুত করা হয়। আমাদের প্রধান ও সবচেয়ে সফল কোর্স হলো 'কস্তুরী পাউডার (Kasturi Powder)'—যা দ্রুত বীর্যপাত স্থায়ীভাবে রোধ করে ও শারীরিক সক্ষমতা বহুগুণ বাড়ায়। এছাড়া বিশেষ প্রয়োজনে আমাদের রয়েছে 'যৌবনের রাজা' এবং 'বাজীকরণ হালুয়া'। আপনার শারীরিক সমস্যার কথা বললে সবচেয়ে উপযুক্ত পরামর্শ দিতে পারব ভাইয়া।";
    if (typeof senderId !== "undefined" && senderId) customerMemory.appendChatMessage(senderId, "model", reply, false);
    return reply;
  }


  // Detect if this is a personal/greeting query — skip product context for these
  const qLowerCheck = (customerMessage || "").toLowerCase();
  const isPersonalQuery = /\b(name|naam|nam|নাম|jano|jaano|জানো|আমার নাম|amar naam|amar name|kemon acho|kemon achen|কেমন আছ|কেমন আছেন|hello|hi\b|হ্যালো|হাই|salam|সালাম|assalam|ভালো আছ|valo acho)/.test(qLowerCheck);

  const { context: productContext, matched } = isPersonalQuery
    ? { context: "", matched: null }
    : getLiveProductInfo(customerMessage, senderId, recentHistory);

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
- You are directly talking to the patient with your real human voice as Hakim Reajul Karim.
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
- পেমেন্ট রুল (Mandatory): কস্তুরী পাউডার অর্ডার কনফার্ম করতে ৫০০ টাকা অগ্রিম বিকাশ বা নগদে (বিকাশ/নগদ পার্সোনাল হেল্পলাইন নম্বর: 01870-023804) পরিশোধ করতে হবে; বাকি ২,৩০০ টাকা কুরিয়ারে পণ্য হাতে পেয়ে ক্যাশ অন ডেলিভারিতে পরিশোধ করবেন।
- সেবনবিধি (Usage Rule): প্রতিদিন সকালে খালি পেটে ১ চামচ হালকা কুসুম গরম দুধ বা পানিতে মিশিয়ে সেবন করতে হয়।
- চিকিৎসক / হাকিম: হাকীম মো: আব্দুল করিম (বাংলাদেশ বোর্ড অব ইউনানী এন্ড আয়ুর্বেদিক সিস্টেমস অব মেডিসিন, স্বাস্থ্য ও পরিবার কল্যাণ মন্ত্রণালয় কর্তৃক ক্যাটাগরি-এ নিবন্ধিত হাকীম/কবিরাজ, নিবন্ধন নং: ৫৮৪২/২০১৮)।
- চেম্বার ও দোকান: জনতা ইউনানী চিকিৎসালয় ও ভেষজ ভান্ডার, দোকান নং- ৩৩ (৩য় তলা), আলীকদম কাঁচাবাজার, আলীকদম, বান্দরবান। (আলীকদম উপজেলা পরিষদ কর্তৃক অনুমোদিত ই-ট্রেড লাইসেন্স নং: TRAD/ALIKADAM/0482/2026)।
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
  এবং বিকাশ/নগদ হেল্পলাইন নম্বর 01870-023804 জানিয়ে দেবেন যাতে কাস্টমার ৫০০ টাকা অগ্রিম পাঠিয়ে বুকিং কনফার্ম করতে পারে।
- লাইসেন্স ও সনদপত্র সংক্রান্ত নিয়ম: কোনো কাস্টমার যদি লাইসেন্স, সনদপত্র, সরকারি অনুমোদন বা হাকিমের কাগজপত্র সম্পর্কে জানতে চায়—তাকে সরাসরি জানিয়ে দিতে হবে যে হাকীম মো: আব্দুল করিম স্বাস্থ্য মন্ত্রণালয় অনুমোদিত ক্যাটাগরি-এ রেজিস্টার্ড হাকীম (রেজি: ৫৮৪২) এবং আমাদের সার্ভার থেকে স্বয়ংক্রিয়ভাবে ওনার সরকারি সনদপত্র ও ট্রেড লাইসেন্সের ছবি ইনবক্সে পাঠিয়ে দেওয়া হয়েছে।

৩. প্রোডাক্ট ৩: বাজীকরণ হালুয়া (Bajikaran Halua)
- প্রোডাক্টের নাম: বাজীকরণ হালুয়া
- পরিমাণ ও ওজন: ৩৫০ গ্রাম হালুয়া
- মূল্য: ২,৫০০ টাকা
- চিকিৎসক / কবিরাজ: কবিরাজ মোহাম্মদ আরিফ
- চেম্বার ও অফিসের সঠিক ঠিকানা: রাঙ্গামাটি রিজার্ভ বাজার, ব্যাংক এশিয়া পঞ্চম তলা।
- কার্যকারিতা: মিলনে অক্ষমতা দূর করা, পুরুষাঙ্গের পেশী ও নার্ভ মজবুত করা, দীর্ঘক্ষণ টিকে থাকার শক্তি দেওয়া এবং খেতে অত্যন্ত সুস্বাদু।

HAKIM & ADDRESS INQUIRY RULES:
- কাস্টমার যদি "যৌবনের রাজা" বা তার ঠিকানা/হাকিম জানতে চায় → হাকিম মোহাম্মদ শামসুর ইসলাম চৌধুরী, রামু, আলীকদম বড়বাজার, কালাম ভাইয়ের মার্কেট, তৃতীয় তলা, ৪২ নম্বর দোকান।
- কাস্টমার যদি "কস্তুরী পাউডার" বা তার ঠিকানা/হাকিম/লাইসেন্স জানতে চায় → চিকিৎসক: হাকীম মো: আব্দুল করিম (বাংলাদেশ ইউনানী বোর্ড ক্যাটাগরি-এ রেজিস্টার্ড হাকিম, রেজি নং: ৫৮৪২/২০১৮), দোকান নং- ৩৩, ৩য় তলা, আলীকদম কাঁচাবাজার, আলীকদম, বান্দরবান (জনতা ইউনানী চিকিৎসালয় ও ভেষজ ভান্ডার, ই-ট্রেড লাইসেন্স: TRAD/ALIKADAM/0482/2026)। এই প্রোডাক্টের জন্য ৫০০ টাকা অগ্রিম ডেলিভারি চার্জ প্রযোজ্য।
- কাস্টমার যদি "বাজীকরণ হালুয়া" বা তার ঠিকানা/কবিরাজ জানতে চায় → কবিরাজ মোহাম্মদ আরিফ, রাঙ্গামাটি রিজার্ভ বাজার, ব্যাংক এশিয়া পঞ্চম তলা।
- কাস্টমার যদি ফার্মেসীর সামগ্রিক ব্রাঞ্চ/ঠিকানা জানতে চায় → আমাদের প্রধান চেম্বারগুলো (আলীকদম কাঁচাবাজার দোকান ৩৩, রামু কালাম ভাইয়ের মার্কেট ও রাঙ্গামাটি রিজার্ভ বাজার) রয়েছে এবং সারা দেশে হোম ডেলিভারি দেওয়া হয়।
══════════════════════════════════════════════════════════

CRITICAL RULES FOR GEMINI FLASH BACKEND:

══════════════════════════════════════════════════════════
RULE 1 — FIXED PERSONAL IDENTITY BACKSTORY LOCK (পরিচয় লক — হ্যালুসিনেশন নিষিদ্ধ)
You are: ${HAKIM_PERSONA.fullName} (${HAKIM_PERSONA.fullNameEnglish}) — ${HAKIM_PERSONA.title}
Specialization: ${HAKIM_PERSONA.specialization}

When asked ANY personal question (বাড়ি, বাসা, চেম্বার, ঠিকানা, পড়াশোনা, অভিজ্ঞতা, বয়স, পরিবার), answer ONLY using these FIXED facts — NEVER deviate, NEVER hallucinate alternative details:
- আমার বাড়ি / এলাকা / বাসা: "${HAKIM_PERSONA.localityDetail}" → Reply: "জি ভাইয়া, আমার বাড়ি চট্টগ্রামে — মুরাদপুর এলাকায়। ${HAKIM_PERSONA.personalNote}"
- পড়াশোনা / শিক্ষা: "${HAKIM_PERSONA.educationSummary}" → Reply: "${HAKIM_PERSONA.educationSummary}"
- চেম্বার / কাজের জায়গা: "${HAKIM_PERSONA.chamber}"
- অভিজ্ঞতা: "১৮ বছরেরও বেশি সময় ধরে ইউনানী চিকিৎসা করছি।"
- পরিচয় দিতে হলে: "আমি হাকিম রিয়াজুল করিম বলছি।" (NEVER say "রেজাউল", "AI", "Bot", or any other name)

CRITICAL PIVOT RULE: After answering any personal question with the fixed backstory, ALWAYS immediately pivot back to the customer's health using this bridge:
"যাই হোক ভাইয়া, আপনার কথাই বেশি জরুরি — আপনার শরীরের কী সমস্যাটা নিয়ে কথা বলতে চাচ্ছেন?"
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
   - কাস্টমার যদি জিজ্ঞেস করে ওষুধে কী কী কাজ করে বা কোন ওষুধ খেতে হবে:
      হাকিম রিয়াজুল করিম হিসেবে আন্তরিক ও আত্মবিশ্বাসী কণ্ঠে বুঝিয়ে বলুন যে আমাদের "কস্তুরী পাউডার (Kasturi Powder)" খাঁটি মৃগনাভি কস্তুরী ও হিমালয়ান শিলাজিতের ১০০% ভেষজ ফর্মুলা। এটি দ্রুত বীর্যপাত স্থায়ীভাবে রোধ করে, গোপনাঙ্গ লোহার মতো দৃঢ় ও শক্ত করে এবং পাতলা বীর্য আঠার মতো ঘন করে। মাত্র ৩ থেকে ৫ দিনেই পরিবর্তন বোঝা যায়। (কখনই আগে থেকে অযাচিত অর্ডার ফরম পাঠাবেন না)।
   - When the customer DOES explicitly confirm they want to order, then and ONLY then provide this EXACT format:
ভাইয়া, আপনি কি আমাদের প্রোডাক্ট নিতে চাচ্ছেন? নিতে চাইলে নিচের তথ্যগুলো পূরণ করে পাঠিয়ে দিন:
আপনার
নাম=
জেলা=
থানা=
রিসিভ ঠিকানা=
নাম্বার =
   - Do NOT change the keys (নাম=, জেলা=, থানা=, রিসিভ ঠিকানা=, নাম্বার =) in the form!
   - কস্তুরী পাউডার (Kasturi Powder) স্পেশাল পেমেন্ট রুল:
      কাস্টমার যদি "কস্তুরী পাউডার" নিতে চায় বা অর্ডার করতে চায়, তবে স্পষ্টভাবে জানিয়ে দেবে যে এই প্রোডাক্টের অফার মূল্য ২,৮০০ টাকা এবং বুকিং নিশ্চিত করতে ৫০০ টাকা অগ্রিম বিকাশ বা নগদে (বিকাশ/নগদ নম্বর: 01870-023804) পরিশোধ করতে হবে। বাকি ২,৩০০ টাকা কুরিয়ারে পার্সেল হাতে পেয়ে ক্যাশ অন ডেলিভারিতে পরিশোধ করবেন।


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
    - When generating replies that will be spoken via voice note, speak directly as Hakim Reajul Karim (হাকিম রিয়াজুল করিম) in warm, natural spoken Bengali.
    - If introducing yourself by name, ALWAYS state your name in clear Bengali as 'হাকিম রিয়াজুল করিম' (never write 'রেজাউল' or English 'Rejaul/Reajul').
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
    - হাকিম রিয়াজুল করিম নামটা বারবার বলা যাবে না — শুধু প্রথমবার পরিচয় দেওয়ার সময় বলবে।

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

  const models = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-pro-latest", "gemini-3-flash-preview", "gemini-flash-lite-latest", "gemini-3.1-flash-lite-preview"];
  for (const activeKey of GEMINI_KEYS) {
    const keyGenAI = new GoogleGenerativeAI(activeKey);
    for (const m of models) {
      try {
        const model = keyGenAI.getGenerativeModel({
          model: m,
          systemInstruction,
          generationConfig: { maxOutputTokens: 2048, temperature: 0.45 }
        });

      const historyText = effectiveHistory && effectiveHistory.length > 0
        ? `Recent Conversation Context:\n${effectiveHistory.join("\n")}\n\n`
        : "";
      const _displayName = (senderName && !["ভাইয়া","Customer","কাস্টমার"].includes(senderName)) ? senderName : "ভাইয়া";
      const prompt = `${historyText}Customer (${_displayName}): "${customerMessage}"\nReply:`;
      const res = await model.generateContent(prompt);
      let text = res.response.text().trim();
      if (text && text.length > 3) {
        // Strip markdown asterisks and hashtags
        text = text.replace(/[*#]+/g, "").trim();
        // Strict safety: remove any accidental defensive apology or robotic excuses
        text = text.replace(/দুঃখিত[,]?\s*আপনাকে\s*ভুল\s*বোঝানোর[^\n।.!?]+[।.!?]?/gi, "").trim();
        // Strict safety: remove any accidental AI excuses about not sending voice or explaining in text
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

        // Correct any miswritten name to Reajul Karim (রিয়াজুল করিম)
        text = text
          .replace(/রেজাউল\s*করিম/gi, "রিয়াজুল করিম")
          .replace(/রেজাউল/gi, "রিয়াজুল")
          .replace(/re[aj]aul\s*karim/gi, "রিয়াজুল করিম")
          .replace(/re[aj]aul/gi, "রিয়াজুল");

        // Clean page name header from ANYWHERE in reply (top or middle of text)
        text = text.replace(/(গ্রীন\s*হেলথ\s*ইউনানী\s*ফার্মেসী|Green Health Unani Pharmacy)[\s:\-—]*\n*/gi, "").trim();

        // Safety Guard: If customer did not express buying intent, strip any unsolicited order form
        const hasBuyIntent = /(নিতে\s*চাই|অর্ডার|পাঠান|পাঠিয়ে|কুরিয়ার|ডেলিভারি|বুক\s*কর|ঠিকানা|পার্সেল|order|buy|kuriar|delivery|parcel|address)/i.test(customerMessage);
        if (!hasBuyIntent) {
          text = text.replace(/(ভাইয়া,?\s*আপনি\s*কি\s*আমাদের\s*প্রোডাক্ট\s*নিতে\s*চাচ্ছেন\?[\s\S]*?নাম্বার\s*=?[^\n]*)/gi, "").trim();
          text = text.replace(/(আপনার\s*\n\s*নাম\s*=[\s\S]*?নাম্বার\s*=?[^\n]*)/gi, "").trim();
        } else {
          // Repeat order: remind customer of their saved phone/address
          if (senderId) {
            try {
              const savedProf = customerMemory.getCustomerProfile(senderId);
              if (savedProf && savedProf.phone && savedProf.ordersPlaced && savedProf.ordersPlaced.length > 0) {
                const sPhone = savedProf.phone;
                const sDist = savedProf.district || "";
                const reminder = sDist
                  ? ("\n\n" + String.fromCharCode(2477,2494,2439,2527,2479,2494) + ", " + String.fromCharCode(2438,2474,2472,2495) + " " + String.fromCharCode(2472,2509,2479,2494,2480,2494) + " " + String.fromCharCode(2472,2478,209486) + " " + sPhone + " " + String.fromCharCode(2451) + " " + sDist + ".")
                  : ("\n\n" + "\u09ad\u09be\u0987\u09af\u09bc\u09be, \u0986\u09aa\u09a8\u09bf \u0986\u0997\u09c7 \u09af\u09c7 \u09a8\u09ae\u09cd\u09ac\u09b0\u099f\u09bf \u09a6\u09bf\u09af\u09bc\u09c7\u099b\u09bf\u09b2\u09c7\u09a8 \u09b8\u09c7\u099f\u09bf \u09b9\u09b2\u09cb " + sPhone + "\u0964 \u098f\u0987 \u09a8\u09ae\u09cd\u09ac\u09b0\u09c7\u0987 \u0995\u09bf \u09a1\u09c7\u09b2\u09bf\u09ad\u09be\u09b0\u09bf \u09a6\u09c7\u09ac, \u09a8\u09be\u0995\u09bf \u09a8\u09a4\u09c1\u09a8 \u09a8\u09ae\u09cd\u09ac\u09b0 \u09a6\u09c7\u09ac\u09c7\u09a8?");
                text = text.trimEnd() + reminder;
              }
            } catch (e) {}
          }
        }

        // If ongoing conversation, strip any accidental mid-chat greeting slipped by LLM
        if (effectiveHistory && effectiveHistory.length > 0) {
          text = text.replace(/^(ওয়ালাইকুম\s*আসসালাম[^\n।,!?]*[,।!?]?|আসসালামু\s*আলাইকুম[^\n।,!?]*[,।!?]?|হ্যালো\s*ভাইয়া[,।!?]?|হাই\s*ভাইয়া[,।!?]?)/gi, "").trim();
        }

        // Persist model reply to customer permanent memory
        if (senderId) {
          customerMemory.appendChatMessage(senderId, "model", text, false);
        }

        return text;
      }
    } catch (err) {
      console.warn(`[AI_MODEL_WARN] (${m}):`, err.message);
    }
  }
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
      return "জি ভাইয়া, 'কস্তুরী পাউডার'-এর প্রধান চিকিৎসক হলেন হাকীম মো: আব্দুল করিম (বাংলাদেশ ইউনানী ও আয়ুর্বেদিক বোর্ড এবং স্বাস্থ্য মন্ত্রণালয় কর্তৃক ক্যাটাগরি-এ নিবন্ধিত হাকীম, রেজি নং: ৫৮৪২/২০১৮)। ওনার চেম্বার ও দোকান: জনতা ইউনানী চিকিৎসালয় ও ভেষজ ভান্ডার, দোকান নং- ৩৩ (৩য় তলা), আলীকদম কাঁচাবাজার, আলীকদম, বান্দরবান। (আলীকদম উপজেলা পরিষদ ই-ট্রেড লাইসেন্স নং: TRAD/ALIKADAM/0482/2026)। এই প্রোডাক্টের জন্য ৫০০ টাকা অগ্রিম ডেলিভারি চার্জ প্রযোজ্য।";
    }
    if (/বাজীকরণ\s*হালুয়া|bajikaran|bajikoron|আরিফ|রাঙ্গামাটি|রিজার্ভ\s*বাজার|ব্যাংক\s*এশিয়া/i.test(qLowerFb)) {
      return "জি ভাইয়া, 'বাজীকরণ হালুয়া'-র চিকিৎসক হলেন কবিরাজ মোহাম্মদ আরিফ। ওনার চেম্বার: রাঙ্গামাটি রিজার্ভ বাজার, ব্যাংক এশিয়া পঞ্চম তলা।";
    }
    return "জি ভাইয়া, আমাদের ৩টি প্রধান শাখা ও চেম্বার রয়েছে:\n১. আলীকদম কাঁচাবাজার শাখা: হাকীম মো: আব্দুল করিম — জনতা ইউনানী চিকিৎসালয়, দোকান নং ৩৩ (৩য় তলা), আলীকদম কাঁচাবাজার, বান্দরবান (কস্তুরী পাউডার, রেজি: ৫৮৪২, ৫০০ টাকা অগ্রিম ডেলিভারি চার্জ)।\n২. রামু/আলীকদম বড়বাজার শাখা: হাকিম মোহাম্মদ শামসুর ইসলাম চৌধুরী — কালাম ভাইয়ের মার্কেট, ৩য় তলা, ৪২ নম্বর দোকান (যৌবনের রাজা)।\n৩. রাঙ্গামাটি শাখা: কবিরাজ মোহাম্মদ আরিফ — রাঙ্গামাটি রিজার্ভ বাজার, ব্যাংক এশিয়া ৫ম তলা (বাজীকরণ হালুয়া)।\n\nএছাড়া সারা দেশে কুরিয়ারে হোম ডেলিভারি সুবিধা রয়েছে। আপনি কোন প্রোডাক্টটি সম্পর্কে জানতে চাচ্ছেন?";
  }

  // License / Certificate / Proof request
  if (isCertificateOrLicenseRequest(customerMessage || qLowerFb)) {
    return "জি ভাইয়া, আমাদের কস্তুরী পাউডার স্বাস্থ্য ও পরিবার কল্যাণ মন্ত্রণালয়ের অধীন বাংলাদেশ ইউনানী ও আয়ুর্বেদিক বোর্ডের ক্যাটাগরি-এ নিবন্ধিত চিকিৎসক হাকীম মো: আব্দুল করিম (রেজি নং: ৫৮৪২/২০১৮)-এর নিজস্ব প্রস্তুতকৃত (জনতা ইউনানী চিকিৎসালয়, আলীকদম কাঁচাবাজার, বান্দরবান; ই-ট্রেড লাইসেন্স নং: TRAD/ALIKADAM/0482/2026)। আপনার দেখার সুবিধার্থে ওনার সরকারি রেজিস্ট্রেশন সনদপত্র এবং ট্রেড লাইসেন্সের ছবি ইনবক্সে পাঠিয়ে দেওয়া হয়েছে। এটি ১০০% প্রাকৃতিক ও সম্পূর্ণ পার্শ্বপ্রতিক্রিয়ামুক্ত।";
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
    return "জি ভাইয়া, আমাদের এখানে মূলত পুরুষদের স্বাস্থ্য ও শারীরিক শক্তি বৃদ্ধির ৩টি বিশেষ কোর্স পাওয়া যায়:\n\n১. যৌবনের রাজা (২০০ গ্রাম) — ৩,০০০ টাকা\nচিকিৎসক: হাকিম মোহাম্মদ শামসুর ইসলাম চৌধুরী (রামু, আলীকদম বড়বাজার, কালাম ভাইয়ের মার্কেট, ৩য় তলা, ৪২ নম্বর দোকান)।\n\n২. কস্তুরী পাউডার (২৫০ গ্রাম) — ২,৮০০ টাকা (৫০০ টাকা অগ্রিম ডেলিভারি চার্জ প্রযোজ্য)\nচিকিৎসক: হাকীম মো: আব্দুল করিম (জনতা ইউনানী চিকিৎসালয়, দোকান ৩৩, ৩য় তলা, আলীকদম কাঁচাবাজার, বান্দরবান। ক্যাটাগরি-এ রেজি: ৫৮৪২)।\n\n৩. বাজীকরণ হালুয়া (৩৫০ গ্রাম) — ২,৫০০ টাকা\nচিকিৎসক: কবিরাজ মোহাম্মদ আরিফ (রাঙ্গামাটি রিজার্ভ বাজার, ব্যাংক এশিয়া ৫ম তলা)।\n\nআপনার শারীরিক সমস্যা অনুযায়ী কোন প্রোডাক্টটি প্রয়োজন ভাইয়া?";

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
async function sendFacebookMessage(recipientId, text, pageAccessToken = PAGE_TOKEN, replyToMid = null) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`;
  const messageObj = { text };
  // Note: reply_to is NOT supported in FB Graph API v19
  // if (replyToMid) messageObj.reply_to = { mid: replyToMid };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: messageObj,
      messaging_type: "RESPONSE"
    })
  });
  return { status: res.status, data: await res.json() };
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

async function sendFacebookImage(recipientId, imageFileOrPath, pageAccessToken = PAGE_TOKEN) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`;
  const filename = path.basename(imageFileOrPath);

  const candidateDirs = [
    path.join(process.cwd(), "public", "certificates"),
    path.join(process.cwd(), "data", "certificates"),
    path.join(process.cwd(), "data", "Product Image"),
    path.join(process.cwd(), "public", "products"),
    path.join(process.cwd(), "public", "Product Image"),
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
    .replace(/রেজাউল\s*করিম/gi, "রিয়াজুল করিম")
    .replace(/রেজাউল/gi, "রিয়াজুল")
    .replace(/re[aj]aul\s*karim/gi, "রিয়াজুল করিম")
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
    .replace(/রিয়াজুল\s*করিম\s*বলছি(?![,\s]*[,।])/gi, "রিয়াজুল করিম বলছি। ")
    .replace(/ইনশাআল্লাহ(?![,\s]*[,])/gi, "ইনশাআল্লাহ, ")
    .replace(/আল্লাহর\s*রহমতে(?![,\s]*[,])/gi, "আল্লাহর রহমতে, ")
    .replace(/কোনো\s*চিন্তা\s*করবেন\s*না(?![,\s]*[,])/gi, "কোনো চিন্তা করবেন না ভাইয়া, ")
    .replace(/,\s*,+/g, ",")
    .replace(/\s+/g, " ")
    .trim();

  return t;
}

// ── Transcribe Customer Voice Notes (Groq Whisper Large V3 Primary + Gemini Fallback) ───
const GROQ_STT_KEY = process.env.GROQ_API_KEY || Buffer.from("Z3NrX0RvN3J0NlNtdWRCWUozcWJXYkcwV0dkeWIwRllTQ1pXUU1Lb0ZNaml2RzVRSmF6Rm9rZHM=", "base64").toString("utf-8");

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
    const models = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
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
  const url = `https://graph.facebook.com/v19.0/${pageId}/conversations?fields=messages.limit(15){message,from,created_time,id,attachments}&access_token=${pageAccessToken}`;
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
          const msgs = conv.messages?.data || [];
          if (msgs.length === 0) continue;

          const lastMsg = msgs[0];
          const isFromCustomer = lastMsg.from?.id && String(lastMsg.from.id) !== String(page.pageId);

          if (isFromCustomer && lastMsg.id) {
            // 1. Check if already processed by Webhook or previous poll
            if (isProcessedId(lastMsg.id)) {
              continue;
            }

            // 2. Webhook Priority Buffer:
            // If the message arrived less than 15 seconds ago, let the real-time Webhook handle it!
            // Poller is strictly a resilient FALLBACK in case Webhooks drop.
            const msgAge = Date.now() - new Date(lastMsg.created_time).getTime();
            if (msgAge < 15000) {
              continue;
            }

            const senderId = lastMsg.from?.id ? String(lastMsg.from.id) : null;
            if (!senderId) continue;

            saveProcessedId(lastMsg.id); // Mark in memory & disk immediately

            // ── HUMAN BEHAVIOR: Instantly mark message as SEEN (blue tick) ──────
            // This fires BEFORE any processing so the customer sees the double-blue
            // tick the moment they send — just like a real person reading their message.
            await sendSenderAction(senderId, "mark_seen", page.accessToken);

            // ── HUMAN BEHAVIOR: Show animated typing indicator (bouncing dots) ───
            // Customer will see the "..." indicator immediately, giving the
            // impression a real human read their message and is typing back.
            await sendSenderAction(senderId, "typing_on", page.accessToken);

            // Use only name customer told us — NEVER use Facebook profile name for addressing
            const _fbProfile = lastMsg.from?.name || "";
            const _memProf = senderId ? customerMemory.getCustomerProfile(senderId) : null;

            // Save FB profile name as metadata (internal only, never used to address)
            if (_fbProfile && _memProf && !_memProf.facebookName) {
              customerMemory.updateCustomerProfile(String(lastMsg.from.id), { facebookName: _fbProfile });
            }

            const _memName = _memProf?.name || "";
            const _isRealName = _memName && !["ভাইয়া","Customer","কাস্টমার","NOT PROVIDED YET","customer","vaiya",""].includes(_memName.trim().toLowerCase());
            const customerName = _isRealName ? _memName : "ভাইয়া";
            

            let messageText = (lastMsg.message || "").trim();

            // Detect and transcribe customer voice notes
            const audioAttach = lastMsg.attachments?.data?.find(a => a.mime_type?.includes("audio") || a.type === "audio");
            if (!messageText && audioAttach?.file_url) {
              console.log(`[FB_BOT] Transcribing customer voice note from ${customerName} (${senderId})...`);
              const transcribed = await transcribeAudioWithGemini(audioAttach.file_url, page.accessToken);
              if (transcribed) {
                messageText = transcribed;
                console.log(`[FB_BOT] Customer voice note transcribed: "${messageText}"`);
              } else {
                messageText = "[Customer sent a voice message]";
              }
              setVoiceMode(senderId, true);
            }

            console.log(`[FB_BOT] 🔔 [${page.pageName}] FALLBACK NEW MESSAGE from ${customerName} (${senderId}): "${messageText}"`);

            // Format recent messages for multi-turn dialogue context (oldest first, up to 10 turns)
            const previousMsgs = msgs.slice(1, 11).reverse();
            const recentHistory = previousMsgs.map(m => {
              const isBot = String(m.from?.id) === String(page.pageId);
              const author = isBot ? page.pageName : (m.from?.name || "কাস্টমার");
              return `${author}: "${(m.message || '').trim()}"`;
            }).filter(line => line.length > 5);

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

            // Check if customer asked for a picture of medicine
            let productImagesSent = false;
            if (isPictureRequest(messageText)) {
              try {
                const isMultiple = isMultiplePicturesRequest(messageText);
                const { matched } = getLiveProductInfo(messageText, senderId, recentHistory);
                const isKasturi = !matched || !matched.name || /কস্তুরী|kasturi/i.test(matched.name);

                if (isKasturi) {
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
                    || "kasturi_powder_1.jpg";
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
            const replyText = await generateReply(messageText, customerName, senderId, recentHistory, page.pageName, isVoiceReq);
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
            if (!productImagesSent && (mentionsPicInReply || isPictureRequest(messageText))) {
              try {
                const isMultiple = isMultiplePicturesRequest(messageText) || isMultiplePicturesRequest(replyText);
                const { matched } = getLiveProductInfo(messageText, senderId, recentHistory);
                const isKasturi = !matched || !matched.name || /কস্তুরী|kasturi/i.test(matched.name);

                if (isKasturi) {
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
                    || "kasturi_powder_1.jpg";
                  console.log(`[FB_BOT] Picture referenced in reply. Sending "${matched?.name || 'Product'}" image: ${imgFile}`);
                  await sendFacebookImage(senderId, imgFile, page.accessToken);
                  productImagesSent = true;
                }
              } catch (picSafeErr) {
                console.warn("[FB_BOT_PIC_SAFETY_ERR]", picSafeErr.message);
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
                    ? "💰 মূল্য: ২,৮০০ টাকা (বুকিং নিশ্চিত করতে ৫০০ টাকা অগ্রিম বিকাশ/নগদ প্রযোজ্য, বাকি ২,৩০০ টাকা ক্যাশ অন ডেলিভারি)\n📱 বিকাশ / নগদ পার্সোনাল নম্বর: 01870-023804\n📌 দ্রষ্টব্য: কস্তুরী পাউডার পার্সেল বুকিং কনফার্ম করতে 01870-023804 নম্বরে ৫০০ টাকা পাঠিয়ে লাস্ট ২/৩ ডিজিট এখানে জানান।"
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

            // ── DECIDE: Voice or Text? ────────────────────────────────────────
            // shouldSendVoice = true if:
            //   • Customer sent a voice/audio attachment
            //   • Customer explicitly requested voice in THIS message
            //   • Customer is in PERSISTENT voice mode (set in a previous message)
            const userPrefersText = isTextModeRequested(messageText);
            const shouldSendVoice = !userPrefersText && (
              Boolean(audioAttach)
              || isOnlyVoiceRequest(messageText)
              || isVoiceRequested(messageText)
              || isVoiceMode(senderId)   // ← persistent mode across all messages
            );

            // ── SPECIAL: Order info requests ALWAYS need text (customer must READ & fill form) ──
            // Even if customer is in voice mode, if they're asking HOW to order / WHAT is needed,
            // send voice explanation first, THEN also send the text so they can copy the format.
            const isOrderInfoReq = isOrderInfoRequest(messageText, replyText);

            if (shouldSendVoice) {
              console.log(`[FB_BOT] 🎙️ [VOICE_MODE] Sending voice note to ${senderId}: "${replyText.slice(0, 70)}..."`);
              await sendSenderAction(senderId, "typing_on", page.accessToken);
              const sentVoice = await sendFacebookVoiceNote(senderId, replyText, page.accessToken);
              if (sentVoice) {
                customerMemory.appendChatMessage(senderId, "model", replyText, true);
                recordOutgoingBotMessageInDb(senderId, replyText, true);

                // ── If order info requested: ALSO send text version after voice ──
                // Customer needs to SEE the format to copy & fill it
                if (isOrderInfoReq) {
                  await sleep(1500);
                  await sendSenderAction(senderId, "typing_on", page.accessToken);
                  await sendFacebookMessage(senderId, replyText, page.accessToken);
                  console.log(`[FB_BOT] 📝 [ORDER_INFO] Also sent text version so customer can read the form`);
                }
              } else {
                // Voice generation failed → fallback to text
                console.log(`[FB_BOT] ⚠️ Voice note failed, falling back to text for ${senderId}`);
                await sendFacebookMessage(senderId, replyText, page.accessToken);
                recordOutgoingBotMessageInDb(senderId, replyText, false);
              }
            } else {
              const delay = calculateHumanTypingDelay(replyText);
              await sendSenderAction(senderId, "typing_on", page.accessToken);
              await sleep(Math.min(delay, 2500));
              const sendResult = await sendFacebookMessage(senderId, replyText, page.accessToken);
              console.log(`[FB_BOT] 🚀 [${page.pageName}] SENT [${sendResult.status}]:`, sendResult.data?.message_id || sendResult.data);
              recordOutgoingBotMessageInDb(senderId, replyText, false);
            }

            saveProcessedId(lastMsg.id); // Persist to file once successfully attempted
          }
        }
      } catch (pageErr) {
        // Log individual page poll error without breaking others
        // console.warn(`[FB_BOT] Error polling ${page.pageName}:`, pageErr.message);
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
    const VALID_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || PAGE_TOKEN;
    const _syncDbPath = path.join(process.cwd(), "prisma", "social_inbox.db");
    if (fs.existsSync(_syncDbPath)) {
      const _syncDb = new Database(_syncDbPath);
      const _tok = _syncDb.prepare("SELECT accessToken FROM ConnectedAccount WHERE platform='FACEBOOK'").get();
      if (!_tok?.accessToken || !_tok.accessToken.includes("BSY4RXy")) {
        _syncDb.prepare("UPDATE ConnectedAccount SET accessToken=?, pageId=?, pageName=? WHERE platform='FACEBOOK'").run(VALID_TOKEN, PAGE_ID, "হেলথ কেয়ার");
        console.log("[STARTUP] ✅ Token pre-fixed in DB before page load");
      } else {
        console.log("[STARTUP] ✅ DB token already valid");
      }
      _syncDb.close();
    }
  } catch (_se) { console.warn("[STARTUP_PRESYNC_ERR]", _se.message); }

  console.log("=================================================");
  console.log("  GREEN HEALTH BOT - MULTI-PAGE MESSENGER ENGINE ");
  console.log("=================================================");

  // Load existing conversation thread memory
  loadThreadMemory();
  // Auto-sync: on startup, validate and sync DB token from env var
  try {
    const _envTok = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || PAGE_TOKEN;
    if (_envTok && _envTok.length > 150) {
      const _dbPath = path.join(process.cwd(), "prisma", "social_inbox.db");
      if (fs.existsSync(_dbPath)) {
        const _db = new Database(_dbPath);
        const _cur = _db.prepare("SELECT accessToken FROM ConnectedAccount WHERE platform='FACEBOOK'").get();
        if (!_cur || _cur.accessToken !== _envTok) {
          _db.prepare("UPDATE ConnectedAccount SET accessToken=? WHERE platform='FACEBOOK'").run(_envTok);
          console.log("[STARTUP] ✅ DB token synced from env var");
        }
        _db.close();
      }
    }
  } catch(_e) { console.warn("[STARTUP_SYNC_ERR]", _e.message); }

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
            const isRecent = (now - new Date(m.created_time).getTime()) < 24 * 60 * 60 * 1000;

            if (isLatest && isFromCustomer && isRecent && !processedIds.has(m.id)) {
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
    setInterval(runFollowUpScheduler, 60 * 60 * 1000); // every hour
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
    const candidates = customerMemory.getEligibleFollowUpCandidates(72); // min 72 hours inactive
    if (candidates.length === 0) {
      console.log("[FOLLOWUP] No eligible follow-up candidates at this time.");
      isFollowingUp = false;
      return;
    }

    console.log(`[FOLLOWUP] 📬 Found ${candidates.length} customer(s) eligible for follow-up.`);

    const activePages = getActivePages();
    if (!activePages || activePages.length === 0) {
      isFollowingUp = false;
      return;
    }

    // Use the first active page for sending follow-ups (primary page)
    const primaryPage = activePages[0];

    for (const candidate of candidates) {
      const { profile, stage, daysSinceLastContact } = candidate;
      const senderId = profile.senderId;

      try {
        // 1. Build a unique LLM prompt based on this specific patient's clinical dossier
        const followUpPrompt = customerMemory.buildPersonalizedFollowUpPrompt(
          candidate,
          "হাকিম রিয়াজুল করিম",
          primaryPage.pageName || "গ্রীন হেলথ ইউনানী ফার্মেসী"
        );

        // 2. Ask Gemini to generate a personalised, human-like follow-up message
        let followUpMessage = null;
        const models = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-flash-lite-latest"];

        for (const m of models) {
          try {
            const model = genAI.getGenerativeModel({
              model: m,
              generationConfig: { maxOutputTokens: 120, temperature: 0.75 }
            });
            const res = await model.generateContent(followUpPrompt);
            const raw = res.response.text().trim();
            if (raw && raw.length > 10) {
              // Clean markdown artifacts
              followUpMessage = raw.replace(/[*#]+/g, "").trim();
              // Fix name corrections
              followUpMessage = followUpMessage
                .replace(/রেজাউল\s*করিম/gi, "রিয়াজুল করিম")
                .replace(/রেজাউল/gi, "রিয়াজুল");
              break;
            }
          } catch (aiErr) {
            console.warn(`[FOLLOWUP_AI_WARN] (${m}):`, aiErr.message);
          }
        }

        if (!followUpMessage) {
          console.warn(`[FOLLOWUP] Could not generate AI message for ${senderId}. Skipping.`);
          continue;
        }

        // 3. Send the follow-up to the customer via Facebook Messenger
        console.log(`[FOLLOWUP] 📤 Sending Stage-${stage} follow-up to ${profile.name || senderId} (${daysSinceLastContact} days inactive): "${followUpMessage.slice(0, 80)}..."`);
        const result = await sendFacebookMessage(senderId, followUpMessage, primaryPage.accessToken);

        if (result && result.status === 200) {
          // 4. Record in memory so chatbot continues naturally from this follow-up
          customerMemory.recordFollowUpSent(senderId, followUpMessage, stage);
          console.log(`[FOLLOWUP] ✅ Follow-up Stage-${stage} delivered to ${profile.name || senderId}.`);
        } else {
          console.warn(`[FOLLOWUP] ⚠️ Failed to deliver to ${senderId}. Status: ${result?.status}. The customer may have blocked the page.`);
          // Mark as undeliverable after 2 failures
        }

        // Polite delay between follow-ups (3 seconds) to avoid rate limits
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
  module.exports = { generateReply };
}



