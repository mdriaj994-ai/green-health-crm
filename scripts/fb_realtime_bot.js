// scripts/fb_realtime_bot.js
// 24/7 Real-time Facebook Messenger AI Bot Engine
// Runs inside the VPS container alongside Next.js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

const Database = require("better-sqlite3");

const PAGE_ID = process.env.FACEBOOK_PAGE_ID || "110644118793600";
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "EAAW6YWihfogBSY0coWHPtYcw2Gwm11ZAznBKAIcOzhgKQJWYITHuelgvzJfoWl0QjgrsRD5DEViDdpVyQKyvxGkBVJ8saKOzXi4IaXvIwYWuJXVJwNxBGsUdru7NAV9Rk5hrGCJigh9NuX1ury8ATCBYvbjBce885iGjucQ3LSbzYQwqQvNGfcu7GO70jQu3QiwI1";
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
    pageName: "গ্রীন হেলথ ইউনানী ফার্মেসী",
    accessToken: PAGE_TOKEN,
    aiAutoReply: true
  }];
}

const PROCESSED_FILE = path.join(process.cwd(), "data", "processed_msg_ids.json");
const THREAD_MEMORY_FILE = path.join(process.cwd(), "data", "thread_memory.json");
const processedIds = new Set();
const threadMemory = new Map();

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

// ── Live Product Database Loader & Bilingual Matcher ────────────────────────
function findMatchedProduct(query, master) {
  if (!query) return null;
  const normQ = normalizeStr(query);
  const compactQ = normQ.replace(/\s+/g, "");

  const aliases = {
    "dream touch": ["dream touch", "dreamtouch", "ড্রিম টাচ", "ড্রিমটাচ", "ড্রিম"],
    "men's burner": ["men's burner", "mens burner", "men burner", "মেনস বার্নার", "বার্নার"],
    "men's black velvet": ["men's black velvet", "mens black velvet", "black velvet", "ব্ল্যাক ভেলভেট", "ভেলভেট"],
    "soul mate": ["soul mate", "soulmate", "সোল মেট", "সোলমেট", "সুল মেট"],
    "black ginseng": ["black ginseng", "ginseng", "ব্ল্যাক জিনসেং", "জিনসেং"],
    "egypt gawa": ["egypt gawa", "egypt", "gawa", "ইজিপ্ট", "গাওয়া", "গাওয়া"],
    "enjoy hunter": ["enjoy hunter", "enjoy", "hunter", "হান্টার"],
    "hammer of thor": ["hammer of thor", "hammer", "হ্যামার"],
    "maxman": ["maxman", "ম্যাক্সম্যান"],
    "titan gel": ["titan gel", "টাইটান জেল"],
    "viga": ["viga", "ভিগা"],
    "shark": ["shark", "শার্ক"],
    "tiger king": ["tiger king", "tiger", "টাইগার কিং"],
    "rheumarex": ["rheumarex", "রিউমারেক্স"]
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

async function generateReply(customerMessage, senderName, senderId = null, recentHistory = [], pageName = "গ্রীন হেলথ ইউনানী ফার্মেসী") {
  const { context: productContext, matched } = getLiveProductInfo(customerMessage, senderId, recentHistory);

  const masterPath = path.join(process.cwd(), "data", "medicine_master_complete_db.json");
  const editsPath = path.join(process.cwd(), "data", "custom_user_edits.json");
  const kbPath = path.join(process.cwd(), "data", "knowledge_base.txt");
  const master = fs.existsSync(masterPath) ? JSON.parse(fs.readFileSync(masterPath, "utf-8")) : [];
  const edits = fs.existsSync(editsPath) ? JSON.parse(fs.readFileSync(editsPath, "utf-8")) : {};
  const masterKB = fs.existsSync(kbPath) ? fs.readFileSync(kbPath, "utf-8") : "";
  const catalogSummary = buildStoreCatalog(master, edits);
  const detectedLang = detectLanguage(customerMessage);

  const systemInstruction = `You are an elite Senior Hakim, Certified Medical Researcher, and Master Sales Closer representing ${pageName} in Bangladesh.

OUR VERIFIED PRODUCT INVENTORY (আমাদের ফার্মেসীর অনুমোদিত ওষুধের তালিকা):
${catalogSummary}

CRITICAL RULES FOR GEMINI FLASH BACKEND:

1. CORE IDENTITY & PERSONA:
   - Your tone must be warm, deeply empathetic, highly authoritative, and reassuring—like a trusted personal physician who genuinely cares.
   - NEVER sound like a robotic automated bot or an aggressive salesperson.
   - Detected Customer Language/Script: ${detectedLang}. Reply fluently in natural, respectful Bengali (or customer's language).

2. THE CONSULTATION-FIRST & SYSTEMATIC DATA EXTRACTION RULE:
   - GREETING FIRST: If the customer ONLY says Salam ("assalam alaikum", "salam") or casual greeting ("hi", "hello", "vaiya") WITHOUT mentioning any health problem or product:
     DO NOT ask personal medical questions yet! Simply return the greeting warmly:
     "ওয়ালাইকুম আসসালাম ভাইয়া। আলহামদুলিল্লাহ, ভালো আছি। আপনি কেমন আছেন? আপনাকে কীভাবে সাহায্য করতে পারি বলুন।"
   - Only when the customer mentions a health problem, symptom, or asks about medicine, start systematic consultation (ONE question at a time):
     a) Patient's Age and Marital Status (বিবাহিত নাকি অবিবাহিত):
        "ভাইয়া, এই সমস্যাগুলো নিয়ে একদমই মন খারাপ বা টেনশন করবেন না, সঠিক ভেষজ নিয়মে এটি পুরোপুরি নিরাময়যোগ্য। আপনার বয়স কত এবং আপনি কি বিবাহিত না অবিবাহিত?"
     b) Physical Symptoms & Duration:
        "আপনার এই সমস্যাটি কত দিন বা কত মাস ধরে হচ্ছে? লিঙ্গ শিথিলতা নাকি দ্রুত বীর্যপাতের সমস্যা বেশি অনুভব করছেন?"
     c) Lifestyle, Sleep & Underlying Conditions:
        "আপনার কি ডায়াবেটিস বা হাই প্রেসারের কোনো সমস্যা আছে? আর রাতে ঘুম এবং কাজের মানসিক চাপ কেমন থাকে?"
     d) Past Failed Treatments:
        "এর আগে কি বাজার থেকে কোনো ট্যাবলেট বা কেমিক্যাল ওষুধ খেয়েছিলেন? কোনো ক্ষতিকর সাইড ইফেক্ট হয়েছিল কি?"
   - CONTEXT MEMORY: If the customer already provided age, marital status, or symptoms, NEVER re-ask! Advance naturally to the next missing step.

3. EMPATHY & FRUSTRATION HANDLING (SCIENTIFIC VALIDATION):
   - When the customer shares frustration (e.g., "আগে অনেক ওষুধ খেয়ে কাজ হয়নি", "ফাটাফাটি/একদিনের রেজাল্ট চাই", "সব ভুয়া"):
   - Validate their pain deeply and explain scientifically:
     "ভাইয়া, ভায়াগ্রা বা কেমিক্যালের সস্তা ওষুধগুলো সাময়িক উত্তেজনা দিয়ে হার্ট, কিডনি ও লিঙ্গের নার্ভ চিরতরে ধ্বংস করে দেয়। আমাদের ল্যাব-ফর্মুলেটেড ১০০% পিওর ইউনানী উপাদান ক্ষতিগ্রস্ত রক্তজালিকা পুনরুজ্জীবিত করে এবং সিমেন ঘন করে ভেতর থেকে স্থায়ী সক্ষমতা ফিরিয়ে আনে।"

4. THE 3,000 BDT HIGH-TICKET CLOSING OBJECTIVE:
   - Once diagnosis is completed, seamlessly position our flagship 3,000 BDT premium course (যেমন: প্রিমিয়াম আম্বার বা সোল মেট ফর্মুলা) as the ultimate, non-negotiable solution.
   - If the customer's condition is chronic or severe (যেমন: বহু বছরের সমস্যা বা মারাত্মক শিথিলতা), prescribe the primary 3,000 BDT course and suggest a complementary product/special organic oil to maximize results and order value.

5. DIRECT CALL OR PHONE NUMBER INQUIRIES:
   - If the customer asks for a phone number or wants to talk directly over phone:
     "জি ভাইয়া, আপনি চাইলে সরাসরি আমাদের সিনিয়র চিকিৎসকের সাথে কথা বলতে পারেন। আপনার মোবাইল নম্বরটি ইনবক্সে লিখে দিন, আমাদের কনসালট্যান্ট আপনাকে সরাসরি কল দিয়ে বিস্তারিত বুঝিয়ে দেবে।"
   - NEVER invent or provide fake dummy phone numbers!

6. SMART PAYMENT & DELIVERY POLICY:
   - When closing the order, take charge like a professional clinic:
     "আপনার সমস্যা অনুযায়ী ল্যাব থেকে ফ্রেশ ব্যাচ প্রস্তুত করে কুরিয়ারে বুকিং দেওয়ার জন্য আপনার ১) পূর্ণ নাম, ২) সচল মোবাইল নম্বর এবং ৩) জেলা ও থানাসহ সম্পূর্ণ ঠিকানাটি দিন।"
   - For booking: Explain that to prepare the fresh customized lab batch, a small advance booking/delivery charge (or full payment via bKash/Nagad) is taken to confirm genuine dispatch, and the rest can be paid on Cash on Delivery.

7. ANTI-LOOP & CASUAL GREETING RULE (CRITICAL - NO ROBOTIC REPETITION):
   - Current Conversation Status: ${recentHistory && recentHistory.length > 0 ? "ONGOING ACTIVE DIALOGUE" : "NEW CONVERSATION"}
   - If the customer says "hello", "hi", "ভাইয়া", "শুনছেন?", "বলেন", or expresses confusion like "aisob ki", "কী বললেন?":
     * STRICT BAN: NEVER repeat previous messages, and NEVER keep nagging "আমি আপনার তথ্যের অপেক্ষায় আছি" or demanding Name/Address!
     * Respond with warmth and attentiveness:
       "জি ভাইয়া, আমি শুনছি। আপনার কোনো কিছু জানার থাকলে বা কোনো সমস্যা থাকলে নির্ভয়ে বলুন, আমি আপনাকে সাহায্য করছি।"
     * If they ask "aisob ki" or seem confused, clarify gently: "ভাইয়া, আপনার সমস্যার স্থায়ী সমাধানের জন্যই আগের কথাগুলো বলছিলাম। আপনার কি কোনো বিষয়ে প্রশ্ন আছে?"

8. CONVERSATIONAL CONTINUITY & PRONOUNS:
   - Current Product Under Discussion: ${matched ? matched.name : "None"}
   - If the customer asks follow-up questions using pronouns like "aitar", "er", "eta" ("এটার কাজ কি?", "দাম কত?", "কীভাবে খাব?"):
     You MUST answer specifically about ${matched ? matched.name : "the discussed product"}.
     NEVER switch to another product unless the customer explicitly mentions another medicine by name!

9. STOP UNNECESSARY APOLOGIES & DEFENSIVE EXCUSES:
   - ABSOLUTELY BANNED: NEVER say "দুঃখিত আপনাকে ভুল বোঝানোর কোনো উদ্দেশ্য আমাদের ছিল না...", "আমি গ্রীন হেলথ ইউনানী ফার্মেসীর কাস্টমার সাপোর্ট টিম", or any defensive apology.
   - Speak with calm, respectful, professional medical authority.

10. PRODUCT AVAILABILITY & STOCK:
    - If the customer asks if an authentic medicine is in stock, confirm stock warmly in 1 sentence.
    - If customer asks for external commercial drugs (like Napa, Seclo, Paracetamol) not in our store:
      "দুঃখিত, এই প্রোডাক্টটি বর্তমানে আমাদের কাছে নেই।"

11. STRICT RULE ON ORDER & ADDRESS ASKING:
    - NEVER ask for Name, Address, or Mobile Number UNLESS the customer explicitly states they want to buy or order (e.g. "অর্ডার করতে চাই", "নিতে চাই", "পাঠান", "কুরিয়ারে দিন")!

12. CLEAN PLAIN TEXT ONLY:
    - Plain text only. Absolutely DO NOT use markdown bolding or asterisks (no ** or ## or *).

13. STRICT SALAM RULE (CRITICAL):
    - ABSOLUTELY NEVER say "ওয়ালাইকুম আসসালাম" or "আসসালামু আলাইকুম" UNLESS the customer's incoming message explicitly contains a greeting of salam (যেমন: "সালাম", "আসসালামু আলাইকুম", "salam", "slm", "assalam")!
    - If the customer did NOT give salam, DO NOT greet with salam! Start directly with "জি ভাইয়া,".

14. NATURAL HUMAN CHAT BREVITY & PACING (CRITICAL):
    - Real human doctors on Messenger text in short, conversational paragraphs (maximum 2 to 3 short sentences, under 40 words).
    - NEVER write long essays or multiple giant paragraphs!
    - Real human doctors on Messenger text in short, conversational paragraphs (2 to 4 sentences maximum).
    - NEVER write long essays or 4-5 giant paragraphs in a single reply! Customers immediately spot automated bots when given overwhelming text.
    - If the customer says "আমার কোনো সমস্যা নেই" or "amar kono problem e nai":
      Respond warmly in 2 sentences: "মাশাআল্লাহ ভাইয়া, শুনে খুব ভালো লাগল! সুস্থ থাকাটাই পরম নিয়ামত। সবসময় নিজেকে ফিট ও প্রাণবন্ত রাখতে চাইলে যেকোনো স্বাস্থ্য পরামর্শে নির্দ্বিধায় নক দেবেন। ভালো থাকবেন!"

15. VOICE MESSAGE REQUEST HANDLING (CRITICAL - WE SEND REAL VOICE NOTES!):
    - When the customer asks for voice or audio (যেমন: "voice dao", "voice den", "ভয়েস দিন", "ভয়েস পাঠান", "মুখে বলুন", "কথা বলুন", "অডিও দিন"):
      Our server AUTOMATICALLY generates and delivers an authentic Bengali voice note using ElevenLabs right to their Messenger!
      ABSOLUTELY NEVER SAY "ভয়েস মেসেজ পাঠানোর সুযোগ নেই" OR "ভয়েস অপশন নেই"!
      Always reply warmly affirming the voice message:
      "জি ভাইয়া, অবশ্যই! এই যে আমি ভয়েস মেসেজ পাঠিয়ে আপনাকে মুখে বুঝিয়ে দিচ্ছি, দয়া করে নিচের অডিওটি শুনে নিন।"

${productContext ? `\n--- LIVE MEDICINE DASHBOARD DATA ---\n${productContext}\n-----------------------------------\n` : ""}
${masterKB ? `\n--- MASTER CLINICAL & SALES KNOWLEDGE BASE ---\n${masterKB}\n-----------------------------------------------\n` : ""}
`;

  const models = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3.7-flash", "gemini-3.5-flash"];
  for (const m of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: m,
        systemInstruction,
        generationConfig: { maxOutputTokens: 140, temperature: 0.45 }
      });

      const historyText = recentHistory && recentHistory.length > 0
        ? `Recent Conversation Context:\n${recentHistory.join("\n")}\n\n`
        : "";
      const prompt = `${historyText}Customer (${senderName || "Customer"}): "${customerMessage}"\nReply:`;
      const res = await model.generateContent(prompt);
      let text = res.response.text().trim();
      if (text && text.length > 3) {
        // Strip markdown asterisks and hashtags
        text = text.replace(/[*#]+/g, "").trim();
        // Strict safety: remove any accidental defensive apology or robotic excuses
        text = text.replace(/দুঃখিত[,]?\s*আপনাকে\s*ভুল\s*বোঝানোর[^\n।.!?]+[।.!?]?/gi, "").trim();
        try {
          const escapedName = pageName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
          text = text.replace(new RegExp(`আমি\\s*(${escapedName}|গ্রীন\\s*হেলথ\\s*ইউনানী\\s*ফার্মেসীর?)\\s*কাস্টমার\\s*সাপোর্ট[^\\n।.!?]+[।.!?]?`, "gi"), "").trim();
        } catch {}

        // If ongoing conversation, strip any accidental mid-chat greeting slipped by LLM
        if (recentHistory && recentHistory.length > 0) {
          text = text.replace(/^(ওয়ালাইকুম\s*আসসালাম[^\n।,!?]*[,।!?]?|আসসালামু\s*আলাইকুম[^\n।,!?]*[,।!?]?|হ্যালো\s*ভাইয়া[,।!?]?|হাই\s*ভাইয়া[,।!?]?)/gi, "").trim();
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

  // Safe fallback for unavailable items
  return "দুঃখিত, এই প্রোডাক্টটি বর্তমানে আমাদের কাছে নেই।";
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
async function sendFacebookMessage(recipientId, text, pageAccessToken = PAGE_TOKEN) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`;
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

function isPictureRequest(text) {
  if (!text) return false;
  const q = text.toLowerCase();
  return (
    /chobi|cobi|pic|pik|photo|foto|picture|image|img/i.test(q) ||
    /ছবি|পিক|পিকচার|ফটো|ইমেজ/i.test(q) ||
    /dekhte kemon|দেখতে কেমন|samne theke|সামনে থেকে|bastebe kemon|বাস্তবে কেমন/i.test(q)
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

async function sendFacebookVoiceNote(recipientId, text, pageAccessToken = PAGE_TOKEN) {
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "sk_b704126ae6ecca01f041a6505e4e7a695f40df803a4f8bd3";
  const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "FhOnCtjmaAIRIS1Dg2bk";

  if (!ELEVENLABS_API_KEY) return null;

  try {
    const cleanText = (text || "").replace(/[*#_~`>|]/g, "").trim().slice(0, 400);
    const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`;
    const ttsRes = await fetch(ttsUrl, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8
        }
      })
    });

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

// ── Fetch Recent Conversations from Facebook ─────────────────────────────────
async function fetchConversations(pageId = PAGE_ID, pageAccessToken = PAGE_TOKEN) {
  const url = `https://graph.facebook.com/v19.0/${pageId}/conversations?fields=messages.limit(15){message,from,created_time,id}&access_token=${pageAccessToken}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
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

            saveProcessedId(lastMsg.id); // Mark in memory & disk immediately
            const customerName = lastMsg.from?.name || "Customer";
            const senderId = lastMsg.from.id;
            const messageText = (lastMsg.message || "").trim();

            console.log(`[FB_BOT] 🔔 [${page.pageName}] FALLBACK NEW MESSAGE from ${customerName} (${senderId}): "${messageText}"`);

            // Format recent messages for multi-turn dialogue context (oldest first, up to 10 turns)
            const previousMsgs = msgs.slice(1, 11).reverse();
            const recentHistory = previousMsgs.map(m => {
              const isBot = String(m.from?.id) === String(page.pageId);
              const author = isBot ? page.pageName : (m.from?.name || "কাস্টমার");
              return `${author}: "${(m.message || '').trim()}"`;
            }).filter(line => line.length > 5);

            // Check if customer asked for a picture of medicine
            if (isPictureRequest(messageText)) {
              try {
                const { matched } = getLiveProductInfo(messageText, senderId, recentHistory);
                const imgFile = matched && (matched["ছবি পাথ (Image Path)"] || matched["ফাইলের নাম (File Name)"]);
                if (imgFile) {
                  console.log(`[FB_BOT] Customer asked for picture. Sending "${matched["ওষুধের নাম (Brand Name)"]}" image: ${imgFile}`);
                  await sendFacebookImage(senderId, imgFile, page.accessToken);
                }
              } catch (imgErr) {
                console.warn("[FB_BOT_IMG_ERR]", imgErr.message);
              }
            }

            // Generate AI reply with thread memory and page-specific identity
            const replyText = await generateReply(messageText, customerName, senderId, recentHistory, page.pageName);
            console.log(`[FB_BOT] 🤖 [${page.pageName}] REPLY: "${replyText.slice(0, 70)}..."`);

            // Send reply to Messenger using this page's access token
            const sendResult = await sendFacebookMessage(senderId, replyText, page.accessToken);
            console.log(`[FB_BOT] 🚀 [${page.pageName}] SENT [${sendResult.status}]:`, sendResult.data?.message_id || sendResult.data);

            // If customer requested voice or audio, send ElevenLabs voice note
            const isVoiceRequested = /voice|boyes|boes|voyes|ভয়েস|ভয়েস|কথা বলুন|মুখে বলুন|অডিও|audio/i.test(messageText);
            if (isVoiceRequested) {
              console.log(`[FB_BOT] Voice requested by customer. Sending ElevenLabs voice note...`);
              await sendFacebookVoiceNote(senderId, replyText, page.accessToken);
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

// ── Start Engine ─────────────────────────────────────────────────────────────
async function startBot() {
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
}

startBot();

