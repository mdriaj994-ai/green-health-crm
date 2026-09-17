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
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "EAAjkLPT8UegBSS7FFS7CknaL7eRbabMG9g7TJZCu4SQ20ea2sRDLSEZBX2RJlV0yYXneKCHX50m43kYnNUE6LKE6WizMRwsnoCw7fBzyeF88NEZCdb0nu68OmfDZC6rExH9LiWIjxJTPtZBw9m6cSUT98VoIzToz6ZAGV7BJylUTKo1WZC4wFEBk6aAs9KuhsSN17Jp";
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || "1612302413561480";
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || "a41c4fa1bcb53a17c301a2e68263a65c";
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID || "932259009980880";

const GEMINI_KEY = process.env.GEMINI_API_KEY || Buffer.from("QVEuQWI4Uk42Si0xTTlKMDlNNlJfS2tjZU9LNjVraVd2Z3NydGZUX2pQZm5JY1NtejB4eXc=", "base64").toString("utf-8");

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
  // Fallback to .env configuration if DB is empty or inaccessible
  return [{
    id: "default-env",
    pageId: PAGE_ID,
    pageName: "হেলথ কেয়ার",
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
  return /voice|boyes|boes|voyes|ভয়েস|ভয়েস|বয়েজ|বয়েজ|বয়েস|বয়েস|কথা বলুন|মুখে বলুন|মুখে বলেন|মুখে বলো|অডিও|audio/i.test(text);
}

function isTextModeRequested(text) {
  if (!text) return false;
  const clean = text.trim().toLowerCase();
  return (
    /\b(text|txt)\b.*(dao|den|din|bolen|bolun|bolo|pathan|koro|koren|দাও|দেন|দিন|বলেন|বলুন|পাঠান)/i.test(clean) ||
    /(টেক্সট|টেক্সটে|মেসেজে?|লিখে|লেখা)\s*(দাও|দেন|দিন|বলেন|বলুন|বলো|পাঠান|করুন|লিখুন)/i.test(clean) ||
    /^(text|txt|লিখে|লিখুন|লেখা|মেসেজ|message)$/i.test(clean)
  );
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
      matched = master.find(p => String(p.SL) === "39"); // Soul Mate default
      if (senderId) {
        threadMemory.set(senderId, {
          sl: "39",
          name: "সোল মেট (Soul Mate)",
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

  const systemInstruction = `You are an elite Senior Hakim, Certified Medical Researcher, and Master Sales Closer representing ${pageName} in Bangladesh.

OUR VERIFIED PRODUCT INVENTORY (আমাদের ফার্মেসীর অনুমোদিত ওষুধের তালিকা):
${catalogSummary}

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
   - If the customer asks what AMBER or any medicine does:
     Reply in 2 to 3 warm, reassuring sentences as Hakim Reajul Karim. Explain that it naturally improves blood flow, testosterone, and stamina with pure Ayurvedic herbs and Swarna Bhasma without any side effects. End with a caring consultation question (e.g. "আপনার সমস্যাটা কত দিনের ভাইয়া?"). NEVER ATTACH THE ORDER FORM!
   - When the customer DOES explicitly confirm they want to order, then and ONLY then provide this EXACT format:
ভাইয়া, আপনি কি আমাদের প্রোডাক্ট নিতে চাচ্ছেন? নিতে চাইলে নিচের তথ্যগুলো পূরণ করে পাঠিয়ে দিন:
আপনার
নাম=
জেলা=
থানা=
রিসিভ ঠিকানা=
নাম্বার =
   - Do NOT change the keys (নাম=, জেলা=, থানা=, রিসিভ ঠিকানা=, নাম্বার =) in the form!

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

  const models = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-flash-lite-latest"];
  for (const m of models) {
    try {
      const model = genAI.getGenerativeModel({
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



  // Smart Fallback if Gemini models hit 503 or fail
  if (matched) {
    const qLower = (customerMessage || "").toLowerCase();
    const isPrice = /দাম|কত|প্রাইস|price|koto|dam|টাকা/i.test(qLower);
    const isAvailability = /আছে|পাব|পাওয়া|ase|available|pawa/i.test(qLower);
    const isDosage = /খাব|সেবন|নিয়ম|how to|khabo/i.test(qLower);

    if (isPrice) {
      return `${matched.name}-এর বর্তমান অফার মূল্য ${matched.price} টাকা ${matched.regPrice && matched.regPrice !== matched.price ? `(রেগুলার: ${matched.regPrice} টাকা)` : ""}। ${matched.note || "সারা দেশে ক্যাশ অন ডেলিভারিতে হোম ডেলিভারি নিতে পারেন।"}`;
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
  // Check if customer is ASKING what their name is or if bot knows it (e.g. "amar name jano", "আমার নাম কি জানো", "amar name ki")
  const isAskingName = /(?:name|nam|naam|নাম)\s*(?:ki|konta|koto|jano|jaano|janen|bolen|bolo|bolun|boloto|mone|mon|ase|ache|জান|জানো|জানেন|বলেন|বলো|বলুন|কি|কী|মনে\s*আছে|আছে)/i.test(qLowerFb) ||
                       /(?:jano|jaano|janen|জান|জানো|জানেন)\s+(?:amar|amr|আমার)\s+(?:name|nam|naam|নাম)/i.test(qLowerFb) ||
                       /(?:amar|amr|আমার)\s+(?:name|naam|nam|নাম)\s*(?:ki|jano|jaano|janen|bolen|bolo)/i.test(qLowerFb);

  if (isAskingName) {
    const savedProf = senderId ? customerMemory.getCustomerProfile(senderId) : null;
    if (savedProf && savedProf.name && !["Customer", "কাস্টমার", "ভাইয়া"].includes(savedProf.name) && customerMemory.isValidPersonName(savedProf.name)) {
      return `জি ভাইয়া, আপনার নাম তো ${savedProf.name}! বলুন ${savedProf.name} ভাইয়া, কীভাবে সাহায্য করতে পারি?`;
    }
    return "জি না ভাইয়া, আপনার শুভ নামটি তো এখনো জানা হয়নি। আপনার নামটি যদি বলতেন, খুব ভালো লাগত।";
  }

  // Check if customer is TELLING their name (e.g., "amar name rakib", "আমার নাম রাকিব", "আমি রাকিব")
  const tellingNameMatch = customerMessage.match(/(?:amar|amr|আমার)\s+(?:name|naam|nam|নাম)\s*(?:is|holo|hlo|হলো|হল)?\s*[:=]?\s*([A-Za-z\u0980-\u09FF\s]{2,25})/i) ||
                           customerMessage.match(/(?:my\s*name\s*is|\bnam\s*[:=]|\bনাম\s*[:=]|\bনামঃ|\bname\s*[:=])\s*([A-Za-z\u0980-\u09FF\s]{2,25})/i) ||
                           customerMessage.match(/(?:^|\s)(?:ami|আমি)\s+([A-Za-z\u0980-\u09FF]{2,20})\s+(?:bolsi|bolchi|বলছি|বলসি)(?:$|[.,!?\s])/i);
  if (tellingNameMatch && tellingNameMatch[1]) {
    const toldName = tellingNameMatch[1].trim().split(/\s+(?:bolsi|bolchi|vai|bhai)\b/i)[0].trim();
    if (customerMemory.isValidPersonName(toldName)) {
      if (senderId) {
        try { customerMemory.updateCustomerProfile(senderId, { name: toldName }); } catch (e) {}
      }
      return `জি ${toldName} ভাইয়া! আপনার নামটি জেনে খুব ভালো লাগল। আলহামদুলিল্লাহ, বলুন ভাইয়া কীভাবে সাহায্য করতে পারি?`;
    }
  }
  // Address / Home queries (বাসা কোথায়, বাড়ি কোথায়, এলাকা, চেম্বার)
  if (/বাসা|বাড়ি|বাড়ি|ঠিকানা|থাকেন|location|basa|bari|thikana|chamber|চেম্বার/i.test(qLowerFb)) {
    return "জি ভাইয়া, আমার বাড়ি চট্টগ্রামে — মুরাদপুর এলাকায়। আমাদের মূল চেম্বার চট্টগ্রামে হলেও সারা বাংলাদেশেই আমরা কুরিয়ারে ক্যাশ অন ডেলিভারিতে পার্সেল পাঠিয়ে থাকি। আপনার শারীরিক কী সমস্যা নিয়ে কথা বলতে চাচ্ছিলেন ভাইয়া?";
  }
  if (geoSocialProof && (/order|অর্ডার|নিতে চাই|পাঠিয়ে|পাঠান|delivery|পার্সেল/i.test(qLowerFb) || qLowerFb.includes("থেকে"))) {
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


  // "Ji na" / "No" / negative short reply — respond warmly, never push sales
  if (/^(ji\s*na|jina|na$|nah|no$|nope)$/i.test(qLowerFb.trim())) {
    return "আচ্ছা ভাইয়া, কোনো সমস্যা নেই! মাশাআল্লাহ, সুস্থ থাকাটাই সবচেয়ে বড় নিয়ামত। যখন কোনো প্রয়োজন হবে, নির্দ্বিধায় জানাবেন। ভালো থাকবেন!";
  }

  // Safe general fallback
  return "জি ভাইয়া, আপনার স্বাস্থ্যগত যেকোনো সমস্যা বা আমাদের প্রাকৃতিক ওষুধ সম্পর্কে জানতে নির্দ্বিধায় বলুন, আমি আপনাকে প্রয়োজনীয় তথ্য দিয়ে সাহায্য করছি।";
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
function isPictureRequest(text) {
  if (!text) return false;
  const q = text.toLowerCase();
  return (
    /chobi|cobi|pic|pik|photo|foto|picture|image|img/i.test(q) ||
    /ছবি|পিক|পিকচার|ফটো|ইমেজ/i.test(q) ||
    /dekhte kemon|দেখতে কেমন|samne theke|সামনে থেকে|bastebe kemon|বাস্তবে কেমন/i.test(q)
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

async function sendFacebookImage(recipientId, imageFileOrPath, pageAccessToken = PAGE_TOKEN) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`;
  const filename = path.basename(imageFileOrPath);

  const candidateDirs = [
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
    .replace(/২[,.]?৯০০|2[,.]?900/g, "দুই হাজার নয়শত")
    .replace(/৩[,.]?৫০০|3[,.]?500/g, "তিন হাজার পাঁচশত")
    .replace(/৩[,.]?০০০|3[,.]?000/g, "তিন হাজার")
    .replace(/৪[,.]?৫০০|4[,.]?500/g, "চার হাজার পাঁচশত")
    .replace(/১[,.]?৫০০|1[,.]?500/g, "এক হাজার পাঁচশত")
    .replace(/১৫০|150/g, "একশত পঞ্চাশ")
    .replace(/১২০|120/g, "একশত বিশ")
    .replace(/১০০|100/g, "একশত");

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

// ── Transcribe Customer Voice Notes with Gemini 100% Reliably ───────────────
async function transcribeAudioWithGemini(audioUrl, pageAccessToken = PAGE_TOKEN) {
  try {
    const url = audioUrl.includes("access_token") ? audioUrl : audioUrl + (audioUrl.includes("?") ? "&" : "?") + "access_token=" + pageAccessToken;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(9000) });
    if (!res.ok) return "";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) return "";
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
            if (isPictureRequest(messageText)) {
              try {
                const { matched } = getLiveProductInfo(messageText, senderId, recentHistory);
                const imgFile = (matched && (matched.imageFile || matched["ছবি পাথ (Image Path)"] || matched["ফাইলের নাম (File Name)"]))
                  || "WhatsApp Image 2026-08-31 at 2.35.30 PM.jpeg";
                console.log(`[FB_BOT] Customer asked for picture. Sending "${matched?.name || matched?.["ওষুধের নাম (Brand Name)"] || 'Product'}" image: ${imgFile}`);
                await sendFacebookImage(senderId, imgFile, page.accessToken);
              } catch (imgErr) {
                console.warn("[FB_BOT_IMG_ERR]", imgErr.message);
              }
            }

            // ── Voice Mode & Voice Request Logic ──
            const custProf = customerMemory.getCustomerProfile(senderId);
            const lastMsgWasVoice = recentHistory && recentHistory.length > 0 &&
              recentHistory.some(line => line.includes("[ভয়েস") || line.includes("[ভয়েস"));

            const isAudioOrVoiceReq = Boolean(audioAttach) || isOnlyVoiceRequest(messageText) || isVoiceRequested(messageText);
            if (isAudioOrVoiceReq) {
              setVoiceMode(senderId, true);
            } else {
              setVoiceMode(senderId, false);
            }

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
            console.log(`[ORDER_DETECT] parsed=${parsedOrder ? 'YES phone:'+parsedOrder.phone : 'null'} | isOrderPlaced=${orderPlacedDetected} | msg="${messageText.slice(0,50).replace(/\n/g,' ')}"`);

            if (parsedOrder || orderPlacedDetected) {
              // Customer gave order info → cancel any pending reminder
              cancelScheduledReminder(senderId);

              // ── AUTO SAVE ORDER TO DASHBOARD ──
              try {
                const memProf = customerMemory.getCustomerProfile(senderId);
                const orderData = {
                  customerName: (parsedOrder?.name && parsedOrder.name.length > 1)
                    ? parsedOrder.name
                    : (memProf?.name && !["ভাইয়া","customer"].includes(memProf.name.toLowerCase()))
                      ? memProf.name : customerName,
                  phone:     parsedOrder?.phone   || memProf?.phone || "",
                  district:  parsedOrder?.district || memProf?.district || "",
                  thana:     parsedOrder?.thana    || memProf?.thana || "",
                  address:   parsedOrder?.address  || memProf?.address || "",
                  product:   parsedOrder?.product || memProf?.productDiscussed || (threadMemory.has(senderId) ? threadMemory.get(senderId).name : "") || "Soul Mate (খাঁটি কস্তুরী ফর্মুলা)",
                  quantity:  parsedOrder?.quantity || 1,
                  senderId:  String(senderId),
                  facebookName: memProf?.facebookName || customerName || "",
                  pageId:    String(page.pageId),
                };
                console.log(`[ORDER_DATA] name="${orderData.customerName}" phone="${orderData.phone}" district="${orderData.district}"`);


                // ── VALIDATE phone & address BEFORE saving ────────────────
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
💰 পেমেন্ট: ক্যাশ অন ডেলিভারি (পণ্য পেয়ে পরিশোধ)

━━━━━━━━━━━━━━━━━━━━
🚚 ডেলিভারি তথ্য:
• ঢাকার ভেতরে: ১-২ দিন
• ঢাকার বাইরে: ২-৪ দিন
• সারা দেশে হোম ডেলিভারি আছে ✅

⚠️ তথ্যে কোনো ভুল থাকলে এখনই জানান।
কোনো প্রশ্ন থাকলে মেসেজ করুন — আমরা সাহায্য করব ইনশাআল্লাহ। 💚`;

                  await sendSenderAction(senderId, "typing_on", page.accessToken);
                  await sendFacebookMessage(senderId, confirmMsg, page.accessToken);
                  console.log(`[ORDER_CONFIRM] ✅ Confirmation sent to ${senderId}`);
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

            const shouldSendVoice = Boolean(audioAttach) || isOnlyVoiceRequest(messageText) || isVoiceRequested(messageText);

            if (shouldSendVoice) {
              console.log(`[FB_BOT] 🎙️ Sending answer as voice note to ${senderId}: "${replyText.slice(0, 70)}..."`);
              await sendSenderAction(senderId, "typing_on", page.accessToken);
              const sentVoice = await sendFacebookVoiceNote(senderId, replyText, page.accessToken);
              if (sentVoice) {
                customerMemory.appendChatMessage(senderId, "model", replyText, true);
                recordOutgoingBotMessageInDb(senderId, replyText, true);
              } else {
                // Voice failed → send text instead
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
        `${name}, আপনি বলেছিলেন একটু পরে অর্ডার করবেন। এখন কি সুবিধা হবে? আমি প্রস্তুত আছি।`,
        `${name}, আশা করি এখন সুবিধা হয়েছে। অর্ডারটা দিয়ে দিন — দ্রুত পাঠিয়ে দেব ইনশাআল্লাহ।`,
        `${name}, আপনার কথামতো সময়মতো জানাচ্ছি। অর্ডার করতে চাইলে নাম, ঠিকানা ও মোবাইল জানান।`,
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
      const HARD_TOKEN = "EAAW6YWihfogBSY4RXyOpTmUMHfuJKokNMjlEQ3rdBuQc6BELYPwGLhfrMldpWsZA2CwZBXrjuB6bfpH2VrqVm2AVcs3lkZApVZA8bEPyivSudibUjN5vdNNuBY82ZBezIOlyL8g7mBOoxgVhyJtKt7MJMTFrbFZC77ZCshT4ZATflRUkhhkUC9lkib8O3sfMpaN1mtwZD";
      const _dbFile = path.join(process.cwd(), "prisma", "social_inbox.db");
      if (!fs.existsSync(_dbFile)) return;
      const _db = new Database(_dbFile);
      const _row = _db.prepare("SELECT accessToken FROM ConnectedAccount WHERE platform = 'FACEBOOK'").get();
      const _cur = _row?.accessToken || "";

      // Validate current DB token
      const _check = await fetch("https://graph.facebook.com/v19.0/me?access_token=" + _cur).then(r => r.json()).catch(() => ({}));
      if (_check.id) {
        console.log("[STARTUP] ✅ Facebook token is valid. Page:", _check.name);
        _db.close();
        return;
      }

      // Token expired — try hardcoded permanent token
      console.log("[STARTUP] ⚠️ DB token expired. Trying permanent token...");
      const _check2 = await fetch("https://graph.facebook.com/v19.0/me?access_token=" + HARD_TOKEN).then(r => r.json()).catch(() => ({}));
      if (_check2.id) {
        _db.prepare("UPDATE ConnectedAccount SET accessToken = ?, pageId = ?, pageName = ? WHERE platform = 'FACEBOOK'").run(HARD_TOKEN, PAGE_ID, "হেলথ কেয়ার");
        _db.close();
        console.log("[STARTUP] ✅ Permanent token restored! Page:", _check2.name);
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



