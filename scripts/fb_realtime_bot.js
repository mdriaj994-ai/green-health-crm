// scripts/fb_realtime_bot.js
// 24/7 Real-time Facebook Messenger AI Bot Engine
// Runs inside the VPS container alongside Next.js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

const PAGE_ID = process.env.FACEBOOK_PAGE_ID || "110644118793600";
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "EAAW6YWihfogBSY0coWHPtYcw2Gwm11ZAznBKAIcOzhgKQJWYITHuelgvzJfoWl0QjgrsRD5DEViDdpVyQKyvxGkBVJ8saKOzXi4IaXvIwYWuJXVJwNxBGsUdru7NAV9Rk5hrGCJigh9NuX1ury8ATCBYvbjBce885iGjucQ3LSbzYQwqQvNGfcu7GO70jQu3QiwI1";
const GEMINI_KEY = process.env.GEMINI_API_KEY || Buffer.from("QVEuQWI4Uk42Si0xTTlKMDlNNlJfS2tjZU9LNjVraVd2Z3NydGZUX2pQZm5JY1NtejB4eXc=", "base64").toString("utf-8");

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

function saveProcessedId(id) {
  processedIds.add(id);
  try {
    const list = Array.from(processedIds).slice(-500); // keep last 500
    fs.writeFileSync(PROCESSED_FILE, JSON.stringify(list), "utf-8");
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

async function generateReply(customerMessage, senderName, senderId = null, recentHistory = []) {
  const { context: productContext, matched } = getLiveProductInfo(customerMessage, senderId, recentHistory);

  const masterPath = path.join(process.cwd(), "data", "medicine_master_complete_db.json");
  const editsPath = path.join(process.cwd(), "data", "custom_user_edits.json");
  const kbPath = path.join(process.cwd(), "data", "knowledge_base.txt");
  const master = fs.existsSync(masterPath) ? JSON.parse(fs.readFileSync(masterPath, "utf-8")) : [];
  const edits = fs.existsSync(editsPath) ? JSON.parse(fs.readFileSync(editsPath, "utf-8")) : {};
  const masterKB = fs.existsSync(kbPath) ? fs.readFileSync(kbPath, "utf-8") : "";
  const catalogSummary = buildStoreCatalog(master, edits);
  const detectedLang = detectLanguage(customerMessage);

  const systemInstruction = `You are an expert, compassionate human Unani Doctor and senior consultant representing Green Health Unani Pharmacy (গ্রীন হেলথ ইউনানী ফার্মেসী) in Bangladesh.

OUR VERIFIED PRODUCT INVENTORY (আমাদের ফার্মেসীর অনুমোদিত ওষুধের তালিকা):
${catalogSummary}

CRITICAL RULES FOR GEMINI FLASH BACKEND:

1. LANGUAGE & GEO-ROUTING RULE:
   - Detected Customer Language/Script: ${detectedLang}
   - You MUST reply fluently in the EXACT matched language/script used by the customer:
     * If Bengali or Banglish: reply in fluent, natural, polite Bengali (বাংলা).
     * If English: reply in fluent, courteous, professional English.
     * If Arabic: reply in fluent, respectful, natural Arabic.
     * If Hindi: reply in fluent, polite Hindi.

2. STRICT ANTI-REPETITION & SHORT HUMAN STEPS (CRITICAL):
   - Maximum 2-3 sentences per reply! Chat live like a real human doctor on Facebook Messenger.
   - NEVER dump long pre-written promotional paragraphs, product sheets, or walls of text.
   - NEVER repeat the exact same text, product pitch, or greeting that was already sent previously in the conversation.
   - If the customer asks a follow-up question (e.g. usage, dosage, price, or symptoms), answer ONLY that specific question dynamically in 2-3 natural sentences.

3. SENIOR HAKIM CLINICAL INTAKE & CONSULTATION PROTOCOL (ধাপে ধাপে প্রেসক্রিপশন ও পরামর্শ):
   When a customer consults about intimate health problems (যেমন: লিঙ্গ ছোট, নরম, শিথিল, দুর্বল, বীর্য পাতলা, দ্রুত বীর্যপাত, টাইমিং কম) or asks for a solution/custom course:
   Act as an experienced, caring senior Unani Hakim conducting a clinical diagnosis to recommend the perfect herbal course.

   CRITICAL CLINICAL RULES:
   - Ask ONLY ONE QUESTION AT A TIME across consecutive messages to build deep trust!
   - NEVER ask 2 or 3 questions together, and NEVER dump a long form or wall of text.
   - Keep each reply short (2-3 sentences max), empathetic, respectful, and professional.
   - CHECK RECENT CONTEXT: If the customer already provided any info (e.g. age, marital status, duration, or symptoms), NEVER ask it again! Advance naturally to the next missing step.

   STEP-BY-STEP CLINICAL CHECKLIST:
   * Step 1 (Empathy & Basic Biometrics):
     Directly address their symptoms with genuine empathy first, then ask ONLY:
     "ভাইয়া, আপনার এই সমস্যাগুলো নিয়ে একদম মন খারাপ বা টেনশন করবেন না, সঠিক ভেষজ নিয়মে এটি পুরোপুরি নিরাময়যোগ্য। আপনার বয়স কত এবং আপনি কি বিবাহিত না অবিবাহিত?"
   * Step 2 (Problem Duration & Past Treatments):
     Once age and marital status are known, ask about duration and past medicines:
     "আপনার এই সমস্যাটি কত দিন বা কত মাস ধরে হচ্ছে? এর আগে কি কোনো ওষুধ বা চিকিৎসা নিয়েছিলেন?"
   * Step 3 (Lifestyle, Sleep & Medical History):
     Ask about diabetes, blood pressure, sleep, and work pressure:
     "আপনার কি ডায়াবেটিস বা হাই প্রেসারের কোনো সমস্যা আছে? আর রাতে ঘুম এবং কাজের চাপ কেমন থাকে?"
   * Step 4 (Hakim's Evaluation & Customized Course Recommendation):
     Based on their answers, prescribe the root-cause customized Unani formula (যেমন: প্রিমিয়াম আম্বার বা সোল মেট ফর্মুলা). Explain in 2 sentences how it restores penile blood circulation, repairs nerve tissues, thickens semen, and provides permanent stamina safely. Clearly state the offer price and delivery advantage.
   * Step 5 (Final Order & Shipping Information - ONLY when customer agrees to order / confirms):
     Politely collect the final delivery info:
     1. পূর্ণ নাম (Full Name)
     2. মোবাইল নম্বর (Active Phone Number)
     3. সম্পূর্ণ ঠিকানা (Full Delivery Address: জেলা, থানা, গ্রাম/রোড)
     4. পেমেন্ট তথ্য (ক্যাশ অন ডেলিভারি অথবা বিকাশ/নগদ TrxID)

4. STOP UNNECESSARY APOLOGIES & DEFENSIVE EXCUSES:
   - ABSOLUTELY BANNED: NEVER say "দুঃখিত আপনাকে ভুল বোঝানোর কোনো উদ্দেশ্য আমাদের ছিল না...", "আমি গ্রীন হেলথ ইউনানী ফার্মেসীর কাস্টমার সাপোর্ট টিম", or any defensive apology.
   - Speak with calm, respectful, professional medical authority.

5. NO SELF-QUESTIONING / NO FAKE DIALOGUE:
   - NEVER invent or generate fake customer questions within your reply (e.g. do NOT write "আপনার মনে প্রশ্ন আসতে পারে..." or "আপনাদের এই ওষুধ খেলে কোনো সমস্যা হবে না তো?").
   - Answer ONLY what was actually asked and stop.

6. CONVERSATIONAL CONTINUITY & PRONOUNS:
   - Current Product Under Discussion: ${matched ? matched.name : "None"}
   - If the customer asks follow-up questions using pronouns like "aitar", "er", "eta" ("এটার কাজ কি?", "দাম কত?", "কীভাবে খাব?"):
     You MUST answer specifically about ${matched ? matched.name : "the discussed product"}.
     NEVER switch to another product unless the customer explicitly mentions another medicine by name!

7. STRICT SESSION PERSISTENCE & NO MID-CHAT GREETINGS (কনভারসেশনের মাঝে পুনরায় সালাম বা শুভেচ্ছা সম্পূর্ণ নিষিদ্ধ):
   - Current Conversation Status: ${recentHistory && recentHistory.length > 0 ? "ONGOING ACTIVE DIALOGUE (ALREADY GREETED)" : "NEW CONVERSATION"}
   - If this is an ongoing dialogue (Recent History exists):
     * NEVER send greetings ("আসসালামু আলাইকুম", "ওয়ালাইকুম আসসালাম", "হ্যালো", "হাই", "স্বাগতম") again!
     * NEVER re-introduce yourself or act like meeting a stranger. Jump straight into the reply.
   - ONLY for a brand new conversation where the customer greets first, respond with greeting.
   - If the customer asks a direct question, answer directly without any greeting.

8. HANDLING INSTANT RESULT OBJECTIONS & IMPATIENT CUSTOMERS (অভিযোগ ও ইনস্ট্যান্ট রেজাল্ট হ্যান্ডেলিং):
   - When a customer complains, shows doubt, or demands instant/1-day explosive results (e.g. "প্রথম দিন থেকে ফাটাফাটি রেজাল্ট হবে এমন ওষুধ আপনাদের কাছে নাই?", "সাথে সাথে কাজ করে না কেন?", "একদিনেই রেজাল্ট চাই"):
     * NEVER dump a long, defensive, or robotic lecture.
     * Reply with calm, confident, and caring doctor reassurance:
       "ভাইয়া, ভায়াগ্রা বা কেমিক্যালের মতো সাথে সাথে লিঙ্গ চাঙ্গা করে কিডনি বা শরীর নষ্ট করার চেয়ে কয়েক দিনে ন্যাচারাল উপায়ে স্থায়ী সমাধান পাওয়া অনেক ভালো। আমাদের হাজার হাজার ভাই এভাবে সুস্থ ও স্থায়ী সক্ষমতা পেয়েছেন।"
     * Reassure them that natural root-cause herbal medicine permanently heals penile nerves and blood flow safely without any side effects.

9. TRUST, PRIVACY & SALES PSYCHOLOGY SHIELD (কাস্টমারের ভয় ও দ্বিধা দূর করার গ্যারান্টি):
   - Scam / Fake Fear: "ভাইয়া, আপনাকে ১ টাকাও অগ্রিম দিতে হবে না। সারা দেশে ক্যাশ অন ডেলিভারিতে পার্সেল পাঠানো হয়। ডেলিভারিম্যানের সামনে প্যাকেট খুলে ভেতরের বোতল ও সিল দেখে নিশ্চিত হয়ে তারপর মূল্য পরিশোধ করবেন।"
   - Privacy / Shyness Fear: "ভাইয়া, আপনার ১০০% গোপনীয়তা বজায় থাকবে। পার্সেলের বাইরে কোনো ওষুধের নাম বা বিবরণ লেখা থাকে না। বাইরে শুধু আপনার নাম-ঠিকানা ও সাধারণ কুরিয়ার কোড থাকবে, আপনি ছাড়া ভেতরের জিনিস কেউ জানবে না।"
   - 2-File / Full Course Bundle: "১ ফাইলের বর্তমান অফার মূল্য ২,৯০০ টাকা। আর একসাথে পুরো ২ মাসের কমপ্লিট কোর্স নিলে বিশেষ ছাড়ে মাত্র ৫,০০০ টাকায় পাবেন (৮০০ টাকা সাশ্রয়) এবং সাথে একটি ফ্রি ডায়েট চার্ট উপহার থাকবে।"
   - Realistic Timeline: ৭-১০ দিনের মধ্যে প্রথম পরিবর্তন স্পষ্ট হয় এবং ২১-৩০ দিনে নার্ভ মেরামত হয়ে স্থায়ী সমাধান নিশ্চিত হয়।

10. PRODUCT AVAILABILITY & STOCK:
    - If the customer asks if an authentic medicine is in stock, confirm stock warmly in 1 sentence.
    - If customer asks for external commercial drugs (like Napa, Seclo, Paracetamol) not in our store:
      "দুঃখিত, এই প্রোডাক্টটি বর্তমানে আমাদের কাছে নেই।"

11. STRICT RULE ON ORDER & ADDRESS ASKING:
    - You MUST NEVER ask for Name, Address, or Mobile Number UNLESS the customer explicitly states they want to buy or order (e.g. "অর্ডার করতে চাই", "নিতে চাই", "পাঠান", "কুরিয়ারে দিন")!

12. Clean Plain Text:
    - Plain text only. Absolutely DO NOT use markdown bolding or asterisks (no ** or ## or *).

${productContext ? `\n--- LIVE MEDICINE DASHBOARD DATA ---\n${productContext}\n-----------------------------------\n` : ""}
${masterKB ? `\n--- MASTER CLINICAL & SALES KNOWLEDGE BASE ---\n${masterKB}\n-----------------------------------------------\n` : ""}
`;

  const models = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3.7-flash", "gemini-3.5-flash"];
  for (const m of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: m,
        systemInstruction,
        generationConfig: { maxOutputTokens: 350, temperature: 0.45 }
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
        text = text.replace(/আমি\s*গ্রীন\s*হেলথ\s*ইউনানী\s*ফার্মেসীর\s*কাস্টমার\s*সাপোর্ট[^\n।.!?]+[।.!?]?/gi, "").trim();

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
  const url = `https://graph.facebook.com/v19.0/${PAGE_ID}/conversations?fields=messages.limit(15){message,from,created_time,id}&access_token=${PAGE_TOKEN}`;
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
        const senderId = lastMsg.from.id;
        const messageText = (lastMsg.message || "").trim();

        console.log(`[FB_BOT] 🔔 NEW MESSAGE from ${customerName} (${senderId}): "${messageText}"`);

        // Format recent messages for multi-turn dialogue context (oldest first, up to 10 turns)
        const previousMsgs = msgs.slice(1, 11).reverse();
        const recentHistory = previousMsgs.map(m => {
          const isBot = m.from?.id === PAGE_ID;
          const author = isBot ? "গ্রীন হেলথ ইউনানী ফার্মেসী" : (m.from?.name || "কাস্টমার");
          return `${author}: "${(m.message || '').trim()}"`;
        }).filter(line => line.length > 5);

        // Generate AI reply with thread memory and context
        const replyText = await generateReply(messageText, customerName, senderId, recentHistory);
        console.log(`[FB_BOT] 🤖 BOT REPLY: "${replyText.slice(0, 70)}..."`);

        // Send reply to Messenger
        const sendResult = await sendFacebookMessage(senderId, replyText);
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
  console.log("  GREEN HEALTH BOT - REAL-TIME MESSENGER ENGINE  ");
  console.log("  Page ID:", PAGE_ID);
  console.log("=================================================");

  // Load existing conversation thread memory
  loadThreadMemory();

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

