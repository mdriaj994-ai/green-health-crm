// scripts/customer_memory.js
// 24/7 Permanent Long-term Customer Memory & Profile Engine (CommonJS for Bot Runners)
const fs = require("fs");
const path = require("path");

// ✅ Fixed: Use __dirname so path works regardless of where process starts (VPS, local, etc.)
const DATA_DIR = path.resolve(__dirname, "..", "data");
const MEMORY_FILE = path.join(DATA_DIR, "customer_memory.json");
const memoryCache = new Map();
let isLoaded = false;

// Ensure data directory exists on startup
try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}

function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const raw = fs.readFileSync(MEMORY_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      for (const [id, prof] of Object.entries(parsed)) {
        memoryCache.set(String(id), prof);
      }
    }
  } catch (err) {
    console.warn("[CUSTOMER_MEMORY_LOAD_WARN]", err.message);
  }
  isLoaded = true;
}

function saveCustomerDossier(profile) {
  try {
    // ── Folder-per-customer structure ──
    const customerFolder = path.join(DATA_DIR, "customers", String(profile.senderId));
    if (!fs.existsSync(customerFolder)) fs.mkdirSync(customerFolder, { recursive: true });

    // Save profile (without chatLog to keep it small)
    const profileData = Object.assign({}, profile);
    const chatLog = profileData.chatLog || [];
    delete profileData.chatLog; // store history separately
    fs.writeFileSync(path.join(customerFolder, "profile.json"), JSON.stringify(profileData, null, 2), "utf-8");

    // Save history (unlimited) to separate file
    const histFile = path.join(customerFolder, "history.json");
    let existingHistory = [];
    if (fs.existsSync(histFile)) {
      try { existingHistory = JSON.parse(fs.readFileSync(histFile, "utf-8")); } catch {}
    }
    // Merge: add new messages from chatLog that don't exist (by time)
    const existingTimes = new Set(existingHistory.map(m => m.time));
    const newMessages = chatLog.filter(m => !existingTimes.has(m.time));
    if (newMessages.length > 0) {
      const merged = [...existingHistory, ...newMessages];
      fs.writeFileSync(histFile, JSON.stringify(merged, null, 2), "utf-8");
    } else if (chatLog.length > 0 && existingHistory.length === 0) {
      fs.writeFileSync(histFile, JSON.stringify(chatLog, null, 2), "utf-8");
    }

    // Also keep legacy flat file for backward compat
    const legacyFile = path.join(DATA_DIR, "customers", `${profile.senderId}.json`);
    if (!fs.existsSync(legacyFile)) {
      fs.writeFileSync(legacyFile, JSON.stringify(profile, null, 2), "utf-8");
    }
  } catch (err) {
    console.warn("[CUSTOMER_DOSSIER_SAVE_WARN]", err.message);
  }
}

function saveMemory() {
  try {
    const obj = {};
    for (const [id, prof] of memoryCache.entries()) {
      obj[id] = prof;
      saveCustomerDossier(prof);
    }
    // DATA_DIR already guaranteed at module load
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (err) {
    console.warn("[CUSTOMER_MEMORY_SAVE_WARN]", err.message, "| Path:", MEMORY_FILE);
  }
}

function getAllCustomerProfiles() {
  if (!isLoaded) loadMemory();
  return Array.from(memoryCache.values()).sort((a, b) => (b.lastContact || 0) - (a.lastContact || 0));
}

function isValidPersonName(n) {
  if (!n) return false;
  const s = String(n).trim();
  if (s.length < 2 || s.length > 30) return false;
  if (/^(vai|bhai|vaiya|bhaiya|ভাই|ভাইয়া|ভাইয়া|ভায়া|customer|কাস্টমার|doctor|hakim|হাকিম|ডাক্তার|admin|এডমিন|ki|jano|jaano|janen|জান|জানো|জানেন|বলেন|bolo|bolun|boloto|mone|mon|ase|ache|konta|koto|কি|কী|বলুন|বলো|বলেন|মনে|আছে|ki\s*jano|e\s*ki\s*jano|unknown|অজ্ঞাত|facebook\s*user|facebook\s*customer|user|voice|boyes|audio|ভয়েস|ভয়েস|বয়েজ|বয়েস|অডিও)$/i.test(s)) {
    return false;
  }
  if (/চিকিৎসালয়|ফার্মেসী|হেলথ|health|pharmacy|herbal|ayurvedic|unani|মেডিসিন|ওষুধ|অর্ডার|order|price|দাম|ডেলিভারি|delivery/i.test(s)) {
    return false;
  }
  if (/^[\d\s]+$/.test(s)) return false;
  if (/^(kemon|valo|kothai|koto|ki|konta|amra|apni|tumi|apnar|amar|আমি|তুমি|আপনি|কেমন|porte|পারিনা|পারি|চাই|chai|bole|বলতে)/i.test(s)) return false;
  if (/(?:ki|jani|jano|to|bole|bolsi|bolchi|amar|amr|apnar|apni|tumi|shun|shuno|কী|কি|জানি|জানো|তো|বলে|বলছি|বলসি|আমার|আপনার|আপনি|তুমি|শুনুন|শোন)/i.test(s)) return false;
  return true;
}

function getCustomerProfile(senderId, defaultName = "") {
  if (!isLoaded) loadMemory();
  const idStr = String(senderId);
  const validName = (typeof defaultName === "string" && isValidPersonName(defaultName)) ? defaultName.trim() : "";
  if (!memoryCache.has(idStr)) {
    const newProfile = {
      senderId: idStr,
      name: validName,
      age: "",
      maritalStatus: "",
      symptoms: [],
      duration: "",
      productDiscussed: "",        // last product discussed
      productsDiscussedAll: [],   // ALL products ever discussed
      orderStatus: "inquiry",     // inquiry | interested | order_placed | delivered
      ordersPlaced: [],           // history of all orders
      phone: "",
      district: "",
      thana: "",
      address: "",
      lastVoiceTranscript: "",
      sessionSummaries: [],       // short one-liner per session
      chatLog: [],
      firstContact: Date.now(),
      lastContact: Date.now(),
      totalMessages: 0,
      prefersVoice: false,
      bloodGroup: "",
      diabetes: "",
      bloodPressure: "",
      previousMedication: "",
      marriageDuration: "",
      diagnosticStage: 0,
      timing: "",
      erectionQuality: "",
      semenQuality: "",
      preCum: "",
      sleepQuality: "",
      gastric: "",
      probashi: "",
    };
    memoryCache.set(idStr, newProfile);
    saveMemory();
    return newProfile;
  }
  const prof = memoryCache.get(idStr);
  if (!isValidPersonName(prof.name)) {
    prof.name = validName;
  }
  return prof;
}

function updateCustomerProfile(senderId, updates) {
  const profile = getCustomerProfile(senderId);
  Object.assign(profile, updates);
  profile.lastContact = Date.now();
  saveMemory();
  return profile;
}

function toBengaliNumerals(str) {
  const bDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(str).replace(/\d/g, (d) => bDigits[parseInt(d, 10)] || d);
}

// ── Dynamic Customer Commitment & Follow-up Time Parser ──────────────────────
function parseDeferredCommitment(text) {
  if (!text) return null;
  const clean = text.toLowerCase().trim();
  const now = Date.now();

  if (/(নিতে\s*চাই\s*না|দরকার\s*নেই|ক্যান্সেল|cancel|অর্ডার\s*করেছি|টাকা\s*নাই\s*আর\s*মেসেজ\s*দিয়েন\s*না)/i.test(clean)) {
    return null;
  }

  // 1. "X ঘন্টা পর" / "X hour por"
  const hourMatch = clean.match(/(\d+|এক|দুই|তিন|চার|পাঁচ|ছয়|সাত|আট|দশ)\s*(?:ঘন্টা|ঘণ্টা|ghonta|hour|hr)\s*(?:পর|por|bade)/i);
  if (hourMatch) {
    let hours = 2;
    const rawVal = hourMatch[1];
    const wordMap = { "এক": 1, "দুই": 2, "তিন": 3, "চার": 4, "পাঁচ": 5, "ছয়": 6, "সাত": 7, "আট": 8, "দশ": 10 };
    if (wordMap[rawVal]) hours = wordMap[rawVal];
    else if (!isNaN(parseInt(rawVal, 10))) hours = parseInt(rawVal, 10);
    hours = Math.min(24, Math.max(1, hours));
    return {
      scheduledAt: now + (hours * 60 * 60 * 1000),
      reason: `${hours} ঘণ্টা পর যোগাযোগ করার কথা বলেছেন`,
      promiseText: text.trim()
    };
  }

  // 2. "পরে অর্ডার করব" / "পরে নিব" / "পরে জানাচ্ছি" / "পরে কথা বলব" / "পরে জানাব" -> 4 to 5 hours (4.5h)
  if (/(পরে\s*অর্ডার|পরে\s*নিব|পরে\s*নেব|পরে\s*জানাব|পরে\s*জানাচ্ছি|পরে\s*কথা|পরে\s*নক|pore\s*order|pore\s*nibo|pore\s*janabo|pore\s*kotha|pore\s*nok|free\s*hoye|ফ্রি\s*হয়ে|একটু\s*ব্যস্ত|busy\s*asi|পরে\s*বলব|pore\s*bolbo)/i.test(clean)) {
    return {
      scheduledAt: now + (4.5 * 60 * 60 * 1000),
      reason: "পরে ফ্রি হয়ে জানাবেন বা অর্ডার করবেন বলেছেন",
      promiseText: text.trim()
    };
  }

  // 3. "কাল সকালে" / "কালকে সকালে" / "সকালে জানাব" -> Next day morning 10:30 AM
  if (/(কাল\s*সকালে|কালকে\s*সকালে|আগামীকাল\s*সকালে|সকালে\s*জানাব|সকালে\s*অর্ডার|kal\s*sokale|kalke\s*sokale|sokale\s*janabo)/i.test(clean)) {
    const nextMorning = new Date();
    nextMorning.setDate(nextMorning.getDate() + 1);
    nextMorning.setHours(10, 30, 0, 0);
    return {
      scheduledAt: nextMorning.getTime(),
      reason: "কাল সকালে অর্ডার কনফার্ম করবেন বলেছেন",
      promiseText: text.trim()
    };
  }

  // 4. "কাল বিকেলে" / "কাল দুপুরে" / "কাল রাতে" / "কালকে" / "কাল জানাব" -> Next day afternoon/evening
  if (/(কাল\s*বিকেলে|কাল\s*দুপুরে|কাল\s*রাতে|কালকে\s*জানাব|কাল\s*অর্ডার|kalke\s*order|kal\s*janabo|kalke\s*janabo)/i.test(clean)) {
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    if (/রাতে|rate/i.test(clean)) nextDay.setHours(20, 30, 0, 0);
    else nextDay.setHours(15, 0, 0, 0);
    return {
      scheduledAt: nextDay.getTime(),
      reason: "কালকে যোগাযোগ করবেন বলেছেন",
      promiseText: text.trim()
    };
  }

  // 5. "২ দিন পর" / "পরশু" / "পরশু দিন" -> 48 hours later
  if (/(২\s*দিন\s*পর|2\s*din\s*por|dui\s*din\s*por|দুই\s*দিন\s*পর|পরশু|porshu)/i.test(clean)) {
    return {
      scheduledAt: now + (48 * 60 * 60 * 1000),
      reason: "২ দিন পর যোগাযোগ করবেন বলেছেন",
      promiseText: text.trim()
    };
  }

  // 6. "৩ দিন পর" / "কয়েক দিন পর" -> 72 hours later
  if (/(৩\s*দিন\s*পর|3\s*din\s*por|tin\s*din\s*por|তিন\s*দিন\s*পর|কয়েক\s*দিন\s*পর|koyek\s*din\s*por)/i.test(clean)) {
    return {
      scheduledAt: now + (72 * 60 * 60 * 1000),
      reason: "কয়েক দিন পর অর্ডার করতে চেয়েছেন",
      promiseText: text.trim()
    };
  }

  // 7. "বেতন পেলে" / "১ তারিখে" / "১০ তারিখে" / "মাস শেষে"
  if (/(বেতন\s*পেলে|বেতন\s*পাব|salary\s*peye|মাস\s*শেষে|১\s*তারিখে|1\s*tarikh|১০\s*তারিখে|10\s*tarikh)/i.test(clean)) {
    const futureDate = new Date();
    if (futureDate.getDate() > 25) {
      futureDate.setMonth(futureDate.getMonth() + 1);
      futureDate.setDate(1);
      futureDate.setHours(11, 0, 0, 0);
    } else {
      futureDate.setDate(futureDate.getDate() + 5);
      futureDate.setHours(11, 0, 0, 0);
    }
    return {
      scheduledAt: futureDate.getTime(),
      reason: "বেতন পেলে বা নির্দিষ্ট তারিখে অর্ডার করবেন বলেছেন",
      promiseText: text.trim()
    };
  }

  return null;
}

function extractCustomerFacts(senderId, text, senderName) {
  const profile = getCustomerProfile(senderId, senderName);
  if (!text) return profile;

  profile.totalMessages = (profile.totalMessages || 0) + 1;
  profile.lastContact = Date.now();
  const clean = text.trim();

  // Dynamic commitment parsing for automated intelligent follow-up
  const commitment = parseDeferredCommitment(clean);
  if (commitment) {
    profile.scheduledFollowUpAt = commitment.scheduledAt;
    profile.followUpReason = commitment.reason;
    profile.followUpPromiseText = commitment.promiseText;
    profile.followUpStatus = "pending";
    console.log(`[FOLLOWUP_SCHEDULED] ${profile.name || senderId}: ${commitment.reason} (At: ${new Date(commitment.scheduledAt).toLocaleString()})`);
  } else if (/(নিতে\s*চাই|অর্ডার\s*করব|ঠিকানা|নাম্বার|কুরিয়ার)/i.test(clean) && !/(পরে|কাল)/i.test(clean)) {
    if (profile.followUpStatus === "pending") {
      profile.followUpStatus = "cancelled";
    }
  }

  // Init missing array fields
  if (!profile.symptoms)             profile.symptoms = [];
  if (!profile.productsDiscussedAll) profile.productsDiscussedAll = [];
  if (!profile.ordersPlaced)         profile.ordersPlaced = [];
  if (!profile.sessionSummaries)     profile.sessionSummaries = [];
  if (!profile.extraFacts)           profile.extraFacts = [];
  if (!profile.mentionedLocations)   profile.mentionedLocations = [];
  if (!profile.allHealthKeywords)    profile.allHealthKeywords = [];
  if (!profile.budgetMentioned)      profile.budgetMentioned = [];

  // 1. NAME EXTRACTION
  const isAskingName = /(?:name|nam|naam|নাম)\s*(?:ki|konta|jano|bolen|bolo|boloto|বলুন|বলো|জান|জানো|কিনা)/i.test(clean);
  if (!isAskingName) {
    const namePatterns = [
      /(?:amar|amr|আমার)\s+(?:name|naam|nam|নাম)\s*(?:is|holo|hlo|হলো|হল)?\s*[:=]?\s*([A-Za-z\u0980-\u09FF\s]{2,25})/i,
      /(?:my\s*name\s*is|\bnam\s*[:=]|\bনাম\s*[:=]|\bনামঃ|\bname\s*[:=])\s*([A-Za-z\u0980-\u09FF\s]{2,25})/i,
      /(?:^|\s)(?:ami|আমি)\s+([A-Za-z\u0980-\u09FF]{2,20})\s+(?:bolsi|bolchi|বলছি|বলসি)(?:$|[.,!?\s])/i
    ];

    for (const pat of namePatterns) {
      const match = clean.match(pat);
      if (match && match[1]) {
        let candidate = match[1].trim().split(/\s+(?:bolsi|bolchi|bolbo|vai|bhai|apni|amr|amar|age|boyos|bari)\b/i)[0].trim();
        if (isValidPersonName(candidate)) {
          profile.name = candidate;
          console.log(`[CUSTOMER_MEMORY] 👤 Name captured: "${candidate}" for ${senderId}`);
          break;
        }
      }
    }
  }

  // Sanitize existing profile name if invalid
  if (profile.name && !isValidPersonName(profile.name)) {
    profile.name = (senderName && isValidPersonName(senderName)) ? senderName.trim() : "";
  }

  // 2. AGE
  if (!profile.age) {
    const bDigits = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
    const toBN = (s) => String(s).replace(/\d/g, d => bDigits[parseInt(d,10)] || d);
    const toEN = (s) => String(s).replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d).toString());
    const am = clean.match(/(?:বয়স|বয়েস|boyos|age)\s*[:=]?\s*([০-৯0-9]{2})/i) ||
               clean.match(/([০-৯0-9]{2})\s*(?:বছর|বচর|bochor|bosor|bochhor|years?|yr)/i) ||
               clean.match(/(?:আমার\s*(?:বয়স|বয়েস))\s*([০-৯0-9]{2})/i);
    if (am && am[1]) {
      const v = parseInt(toEN(am[1]), 10);
      if (v >= 16 && v <= 85) profile.age = toBN(v);
    } else {
      const dn = clean.match(/^\s*([০-৯0-9]{2})\s*$/);
      if (dn) {
        const v = parseInt(toEN(dn[1]), 10);
        if (v >= 16 && v <= 85) profile.age = toBN(v);
      }
    }
  }

  // 3. MARITAL STATUS & MARRIAGE DURATION
  if (!profile.maritalStatus) {
    if (/অবিবাহিত|obibahito|unmarried|single|বিয়ে\s*করিনি|বিয়ে\s*করি\s*নি|বিয়ে\s*হয়নি|biye\s*kori\s*ni|সামনে\s*বিয়ে/i.test(clean)) {
      profile.maritalStatus = "অবিবাহিত";
    } else if (/বিবাহিত|bibahito|married|বিয়ে\s*করেছি|বিয়ে\s*হইছে|বিয়ে\s*হয়েছে|biye\s*korechi|সংসার|স্ত্রী|ওয়াইফ|wife|bou/i.test(clean)) {
      profile.maritalStatus = "বিবাহিত";
    }
  }
  if (!profile.marriageDuration) {
    const mdm = clean.match(/বিয়ে\s*(?:হয়েছে|করছি|করেছি|হইছে|হলো)?\s*([০-৯0-9]+)\s*(?:বছর|মাস|bochor|year|mash|month)/i) ||
                clean.match(/([০-৯0-9]+)\s*(?:বছর|মাস|bochor|year|mash)\s*(?:হলো\s*বিয়ে|ধরে\s*বিয়ে|হয়েছে\s*বিয়ে|বিয়ে)/i);
    if (mdm) profile.marriageDuration = mdm[0].trim();
  }

  // 4. BLOOD GROUP
  if (!profile.bloodGroup) {
    const bgMatch = clean.match(/(?:ব্লাড\s*গ্রুপ|রক্তের\s*গ্রুপ|blood\s*group)?\s*([A-Za-zএবিও\s+-]{1,6})\s*(?:পজিটিভ|নেগেটিভ|positive|negative|\+|\-)/i) ||
                    clean.match(/\b(A|B|AB|O)\s*[\(+-]\s*(?:positive|negative|\+|\-)?\b/i) ||
                    clean.match(/(?:রক্তের\s*গ্রুপ|blood\s*group)\s*[:=]?\s*([A-Za-z+-]{1,5}|[^\n,.!?]+)/i);
    if (bgMatch) {
      profile.bloodGroup = bgMatch[0].trim();
    } else if (/(?:রক্তের\s*গ্রুপ|ব্লাড\s*গ্রুপ).*?(?:জানা\s*নেই|জানা\s*নাই|জানি\s*না|mone\s*nai|jani\s*na)/i.test(clean)) {
      profile.bloodGroup = "জানা নেই";
    }
  }

  // 5. DIABETES & BLOOD PRESSURE
  if (!profile.diabetes) {
    if (/(?:ড[া়য়যায়]+বে[টত]ি[সশ]|diabet|sugar)\s*(?:আছে|ধরা|আসে|positive|ase)/i.test(clean)) {
      profile.diabetes = "ডায়াবেটিস আছে";
    } else if (/(?:ড[া়য়যায়]+বে[টত]ি[সশ]|diabet|sugar)\s*(?:নাই|নেই|নেগেটিভ|normal|nai|nei)/i.test(clean)) {
      profile.diabetes = "ডায়াবেটিস নেই";
    }
  }
  if (!profile.bloodPressure) {
    if (/(?:হাই\s*প্রেশার|উচ্চ\s*রক্তচাপ|high\s*pressure|high\s*bp)\s*(?:আছে|ase)/i.test(clean)) {
      profile.bloodPressure = "উচ্চ রক্তচাপ আছে";
    } else if (/(?:প্রেশার|প্রেসার|pressure)\s*(?:স্বাভাবিক|নরমাল|নেই|নাই|normal)/i.test(clean)) {
      profile.bloodPressure = "নরমাল";
    }
  }

  // 6. PREVIOUS MEDICATION HISTORY
  if (!profile.previousMedication) {
    if (/(?:আগে|ager?)\s*(?:onek|অনেক)?\s*(?:osudh|ওষুধ|ঔষধ|ডাক্তার|তাবিজ|ওয়ান\s*টাইম|viagra|হোমিও)\s*(?:kheyechi|খাইছি|খেয়েছি|খাইছিলাম|দেখাইছি)/i.test(clean) ||
        /(?:one\s*time|ওয়ান\s*টাইম|ভায়াগ্রা|সিলডেনাফিল|ক্ষতি\s*হইছে|কাজ\s*হয়নি|কাজ\s*হয়\s*নাই)/i.test(clean)) {
      profile.previousMedication = "আগে ওষুধ সেবনের ইতিহাস আছে";
    } else if (/(?:আগে|ager?|পূর্বে).*(?:কিছু\s*খাইনি|ওষুধ\s*খাই\s*নাই|ওষুধ\s*খাইনি|কোনো\s*ওষুধ\s*খাইনি|খাই\s*নাই|প্রথম\s*খাচ্ছি|প্রথম\s*আপনাদের)/i.test(clean)) {
      profile.previousMedication = "পূর্বে কোনো ওষুধ সেবন করেননি (নতুন)";
    }
  }

  // 7. SYMPTOMS — 23 types, captures ALL health keywords automatically
  const SYM = [
    [/druto\s*birjopat|birjo\s*patla|taratari\s*pore/i,   "দ্রুত বীর্যপাত"],
    [/lingo\s*sithil|durbol|naram|utthan/i,                 "লিঙ্গ শিথিলতা"],
    [/timing\s*kom|shomoy\s*kom/i,                          "কম টাইমিং"],
    [/sopnodosh|dhatu|khoy/i,                                "স্বপ্নদোষ ধাতু ক্ষয়"],
    [/iccha\s*kom|ruci\s*nai/i,                             "যৌন আগ্রহের অভাব"],
    [/choto|bika|agagora/i,                                  "লিঙ্গের গঠনগত সমস্যা"],
    [/masturbation|bad\s*habit/i,                            "হস্তমৈথুনের ইতিহাস"],
    [/kamar\s*batha|back\s*pain/i,                          "কোমর ব্যথা"],
    [/diabetes|diabet|sugar/i,                               "ডায়াবেটিস"],
    [/pressure|blood\s*pressure/i,                          "রক্তচাপ"],
    [/gastric|stomach\s*pain|acidity/i,                     "গ্যাস্ট্রিক"],
    [/motapa|weight\s*gain|fat/i,                            "ওজন সমস্যা"],
    [/hair\s*fall|chul\s*pora/i,                            "চুল পড়া"],
    [/insomnia|sleep\s*problem|gum\s*hoy\s*na/i,           "ঘুমের সমস্যা"],
    [/headache|matha\s*batha|migraine/i,                    "মাথা ব্যথা"],
    [/kidney|prostate|prostrate/i,                           "কিডনি প্রস্টেট"],
    [/infertility|conception/i,                              "সন্তান না হওয়া"],
    [/period|white\s*discharge/i,                            "মহিলা স্বাস্থ্য"],
    [/thyroid/i,                                              "থাইরয়েড"],
    [/arthritis|joint|bata\s*batha/i,                        "জয়েন্ট ব্যথা"],
    [/constipation|paykana\s*hoy\s*na/i,                    "কোষ্ঠকাঠিন্য"],
    [/asthma|shoash|breathing/i,                             "শ্বাসকষ্ট"],
    [/male\s*weakness|purush\s*dur/i,                       "পুরুষ দুর্বলতা"],
  ];
  for (const [rx, label] of SYM) {
    if (rx.test(clean)) {
      if (!profile.symptoms.includes(label)) profile.symptoms.push(label);
      if (!profile.allHealthKeywords.includes(label)) profile.allHealthKeywords.push(label);
    }
  }

  // 8. DURATION
  if (!profile.duration) {
    const dm = clean.match(/(?:সমস্যা|দুর্বলতা|রোগ|কষ্ট)?\s*(?:প্রায়|প্রায়)?\s*([\u09e6-\u09ef0-9]+|এক|দুই|তিন|চার|পাঁচ|ছয়|সাত|আট|দশ)\s*(?:বছর|মাস|দিন|bochor|year|mash|mas|month|din|day)\s*(?:ধরে|যাবত|থেকে|হলো|হচ্ছে|চলছে|ফেস\s*করছি)/i) ||
               clean.match(/([\u09e6-\u09ef0-9]+)\s*(?:বছর|মাস|দিন|bochor|year|mash|mas|month)\s*(?:ধরে|যাবত|থেকে|হলো|হচ্ছে|thaka|theke|hoise|hoyche)/i) ||
               clean.match(/(?:কয়েক|অনেক|কিছু)\s*(?:বছর|মাস|দিন)\s*(?:ধরে|যাবত|হলো)/i);
    if (dm) profile.duration = dm[0].trim();
  }

  // 9. TIMING / DURATION OF INTERCOURSE
  if (!profile.timing) {
    const tm = clean.match(/([০-৯0-9]+)\s*(?:মিনিট|সেকেন্ড|min|minute|sec)/i) ||
               clean.match(/(?:প্রবেশের\s*আগেই|ঢুকানোর\s*সাথেই|সাথে\s*সাথেই|১-২\s*মিনিট|১\s*মিনিট|২\s*মিনিট|time\s*kom|timing\s*kom)/i);
    if (tm) profile.timing = tm[0].trim();
  }

  // 10. ERECTION QUALITY
  if (!profile.erectionQuality) {
    if (/(?:মাঝপথে\s*নরম|করার\s*সময়\s*নরম|ঢুকানোর\s*পর\s*নরম|হঠাৎ\s*নরম|majhpoth|naram\s*hoye\s*jay)/i.test(clean)) {
      profile.erectionQuality = "মাঝপথে নরম হয়ে যায়";
    } else if (/(?:একেবারেই\s*দাঁড়ায়\s*না|একদম\s*দাঁড়ায়\s*না|দাঁড়ায়\s*না|shokto\s*hoy\s*na|daray\s*na)/i.test(clean)) {
      profile.erectionQuality = "উত্থান হয় না (নিস্তেজ)";
    } else if (/(?:আংশিক\s*শক্ত|অল্প\s*শক্ত|পুরো\s*শক্ত\s*হয়\s*না|shithil)/i.test(clean)) {
      profile.erectionQuality = "আংশিক শক্ত (শিথিল)";
    }
  }

  // 11. SEMEN QUALITY & PRE-CUM
  if (!profile.semenQuality) {
    if (/(?:পানির\s*মতো\s*পাতলা|অতিরিক্ত\s*পাতলা|birjo\s*patla|pani\s*moto|পাতলা\s*পানি)/i.test(clean)) {
      profile.semenQuality = "পানির মতো পাতলা";
    }
  }
  if (!profile.preCum) {
    if (/(?:উত্তেজিত\s*হলেই\s*পানি|কথা\s*বললেই\s*পানি|আঠালো\s*পানি|কামরস|আগাম\s*পানি|pani\s*ber\s*hoy)/i.test(clean)) {
      profile.preCum = "উত্তেজিত হলে আগাম কামরস/পানি আসে";
    }
  }

  // 12. SLEEP & GASTRIC
  if (!profile.sleepQuality) {
    if (/(?:ঘুম\s*কম\s*হয়|ঘুম\s*হয়\s*না|রাত\s*জাগা|রাত\s*জাগি|অনিদ্রা|insomnia|ghumer\s*problem)/i.test(clean)) {
      profile.sleepQuality = "ঘুমের সমস্যা / রাত জাগার অভ্যাস";
    } else if (/(?:ঘুম\s*ভালো\s*হয়|ঘুম\s*ঠিক\s*আছে|ঘুম\s*স্বাভাবিক|sleep\s*normal)/i.test(clean)) {
      profile.sleepQuality = "ঘুম স্বাভাবিক";
    }
  }
  if (!profile.gastric) {
    if (/(?:গ্যাস্ট্রিক\s*আছে|গ্যাস\s*আছে|কোষ্ঠকাঠিন্য|পায়খানা\s*শক্ত|বদহজম|gastric\s*ase)/i.test(clean)) {
      profile.gastric = "গ্যাস্ট্রিক বা হজমের সমস্যা আছে";
    } else if (/(?:গ্যাস্ট্রিক\s*নাই|গ্যাস\s*নেই|পেট\s*ভালো|gastric\s*nei)/i.test(clean)) {
      profile.gastric = "গ্যাস্ট্রিক নেই";
    }
  }

  // 13. PROBASHI / EXPATRIATE
  if (!profile.probashi) {
    if (/(?:প্রবাসী|সৌদি|দুবাই|কাতার|ওমান|মালয়েশিয়া|বাহরাইন|কুয়েত|ইতালি|লন্ডন|সিঙ্গাপুর|বদেশে\s*থাকি|probashi|bideshe\s*thaki)/i.test(clean)) {
      profile.probashi = "প্রবাসী";
    } else if (/(?:দেশেই\s*থাকি|দেশে\s*আছি|বাংলাদেশেই\s*থাকি|deshe\s*asi)/i.test(clean)) {
      profile.probashi = "দেশেই আছেন";
    }
  }

  // 9. PHONE
  const pm = clean.match(/(?:\+?880|0)?1[3-9]\d{8}\b/);
  if (pm) {
    const ph = pm[0].replace(/^\+?88/, "");
    if (ph !== profile.phone) { profile.phone = ph; profile.orderStatus = "interested"; }
  }

  // 7. ORDER FORM
  if (/nam\s*=|thana\s*=|number\s*=/i.test(clean) ||
      /\u09a8\u09be\u09ae\s*=|\u099c\u09c7\u09b2\u09be\s*=|\u09a5\u09be\u09a8\u09be\s*=/i.test(clean)) {
    const pk = (key) => {
      const r = new RegExp(key + "\\s*[:=]\\s*([^\\n,]+)", "i");
      const m = clean.match(r);
      return m && m[1] ? m[1].trim() : "";
    };
    const fName  = pk("নাম") || pk("nam");
    const fDist  = pk("জেলা") || pk("jela");
    const fThana = pk("থানা") || pk("thana");
    const fAddr  = pk("ঠিকানা") || pk("address");
    const fNum   = pk("নাম্বার") || pk("number");
    const fProd  = pk("প্রোডাক্ট") || pk("পণ্য") || pk("product");
    if (fName && fName.length > 2) profile.name = fName;
    if (fDist)  profile.district = fDist;
    if (fThana) profile.thana    = fThana;
    if (fAddr)  profile.address  = fAddr;
    if (fNum)   profile.phone    = fNum;

    // Check if order message mentions product directly (e.g. কস্তুরী, amber)
    let explicitProd = fProd;
    if (!explicitProd) {
      if (/কস্তুরী|কস্তুরি|হরিণের\s*কস্তুর|kasturi|kosturi/i.test(clean)) explicitProd = "Soul Mate (খাঁটি কস্তুরী ফর্মুলা)";
      else if (/amber|ambar|অম্বার|অম্বর|অ্যাম্বার/i.test(clean)) explicitProd = "AMBER Premium";
      else if (/sex\s*king|সেক্স\s*কিং/i.test(clean)) explicitProd = "Sex King (섹스킹)";
      else if (/dream\s*touch|ড্রিম\s*টাচ/i.test(clean)) explicitProd = "Dream Touch";
      else if (/black\s*ginseng|জিনসেং/i.test(clean)) explicitProd = "Black Ginseng";
      else if (/egypt\s*gawa|ইজিপ্ট\s*গাওয়া|গাওয়া/i.test(clean)) explicitProd = "Egypt Gawa";
      else if (/vigrex|ভিগরেক্স/i.test(clean)) explicitProd = "Vigrex Plus";
      else if (/maxdrive|ম্যাক্সড্রাইভ/i.test(clean)) explicitProd = "MaxDrive";
      else if (/parsian|জোবলি|জোব্লি/i.test(clean)) explicitProd = "PARSIAN ZOBLI";
    }
    if (explicitProd) {
      profile.productDiscussed = explicitProd;
      if (!profile.productsDiscussedAll.includes(explicitProd)) profile.productsDiscussedAll.push(explicitProd);
    }

    const snap = {
      time: Date.now(),
      name: fName || profile.name,
      district: fDist || profile.district,
      thana: fThana || profile.thana,
      address: fAddr || profile.address,
      phone: fNum || profile.phone,
      product: explicitProd || profile.productDiscussed || "Soul Mate (খাঁটি কস্তুরী ফর্মুলা)"
    };
    profile.ordersPlaced.push(snap);
    profile.orderStatus = "order_placed";
    console.log("[MEMORY] ✅ Order saved:", JSON.stringify(snap));
  }

  // 8. PRODUCT DETECTION — all products
  const PRODS = [
    [/কস্তুরী|কস্তুরি|হরিণের\s*কস্তুর|kasturi|kosturi/i,         "Soul Mate (খাঁটি কস্তুরী ফর্মুলা)", "39"],
    [/soul\s*mate|সোল\s*মেট|সুল\s*মেট/i,                        "Soul Mate",         "39"],
    [/amber|ambar|অম্বার|অম্বর|অ্যাম্বার|বিছানা\s*রাজা/i,           "AMBER Premium",     "19"],
    [/sex\s*king|সেক্স\s*কিং/i,                                 "Sex King (섹스킹)", "17"],
    [/black\s*ginseng|জিনসেং|ginseng/i,                         "Black Ginseng",     "6" ],
    [/black\s*velvet|velvet|ভেলভেট/i,                           "Black Velvet",      "18"],
    [/dream\s*touch|ড্রিম\s*টাচ|ড্রিমটাচ/i,                      "Dream Touch",       "1" ],
    [/hammer\s*of\s*thor|হ্যামার|thor/i,                        "Hammer of Thor",    "25"],
    [/titan\s*gel|টাইটান\s*জেল/i,                               "Titan Gel",         "26"],
    [/tiger\s*king|টাইগার\s*কিং/i,                               "Tiger King",        "27"],
    [/maxman|ম্যাক্সম্যান/i,                                     "Maxman",            "28"],
    [/viga|ভিগা/i,                                              "Viga Spray",        "29"],
    [/shark|শার্ক/i,                                            "Shark Extract",     "30"],
    [/vigrex|ভিগরেক্স/i,                                        "Vigrex Plus",       "23"],
    [/maxdrive|ম্যাক্সড্রাইভ/i,                                 "MaxDrive",          "28"],
    [/parsian|জোবলি|জোব্লি/i,                                   "PARSIAN ZOBLI",     "16"],
    [/passion\s*wave|প্যাশন/i,                                  "Passion Wave",      "29"],
    [/black\s*lion|ব্ল্যাক\s*লায়ন/i,                           "Black Lion",        "50"],
    [/energy\s*plus|এনার্জি\s*প্লাস/i,                           "Energy Plus",       "12"],
    [/men's\s*burner|mens\s*burner|বার্নার/i,                   "Men's Burner",      "3" ],
    [/egypt\s*gawa|গাওয়া|গাওয়া/i,                               "Egypt Gawa",        "4" ],
    [/rheumarex|রিউমারেক্স/i,                                   "Rheumarex",         "17"],
    [/majoon|maju/i,                                            "Majoon",            "5" ],
    [/jaoshanda/i,                                              "Jaoshanda",         "8" ],
    [/habbe/i,                                                  "Habbe",             "10"],
    [/qurs|kurs/i,                                              "Qurs",              "11"],
    [/রোজাউ|rojau|roja|রোজা|রোজার/i,                            "AMBER Premium (স্পেশাল ফর্মুলা)", "19"],
  ];
  for (const [rx, name, sl] of PRODS) {
    if (rx.test(clean)) {
      profile.productDiscussed = name;
      profile.productSl = sl;
      if (!profile.productsDiscussedAll.includes(name)) profile.productsDiscussedAll.push(name);
      break;
    }
  }

  // 9. LOCATION
  const lm = clean.match(/\b(dhaka|chittagong|sylhet|rajshahi|khulna|barishal|comilla|mymensingh|rangpur|noakhali|feni|gazipur|narayanganj)\b/i);
  if (lm) {
    const loc = lm[0];
    if (!profile.mentionedLocations.includes(loc)) profile.mentionedLocations.push(loc);
    if (!profile.district) profile.district = loc;
  }

  // 10. PROFESSION
  if (!profile.profession) {
    if (/farmer|krishok|chashibadi/i.test(clean))                   profile.profession = "Farmer";
    else if (/driver/i.test(clean))                                 profile.profession = "Driver";
    else if (/teacher|shikkhok/i.test(clean))                       profile.profession = "Teacher";
    else if (/business|byapari/i.test(clean))                       profile.profession = "Business";
    else if (/garments/i.test(clean))                               profile.profession = "Garments";
    else if (/probashi|malaysia|saudi|dubai|abroad/i.test(clean))   profile.profession = "Probashi";
    else if (/student/i.test(clean))                                profile.profession = "Student";
    else if (/service|chakri|govt/i.test(clean))                    profile.profession = "Service";
  }

  // 11. BUDGET
  const bm = clean.match(/budget\s*([0-9,]+)/i);
  if (bm) profile.budgetMentioned.push(bm[1] + " taka");

  // 12. EXTRA FACTS — catch-all
  if (/aage\s*kheye|before\s*use|try\s*koresi|onek\s*osud/i.test(clean) && !profile.extraFacts.includes("tried treatment before")) profile.extraFacts.push("tried treatment before");
  if (/taratari|urgent|joruri|asap/i.test(clean) && !profile.extraFacts.includes("wants urgent solution")) profile.extraFacts.push("wants urgent solution");
  if (/dam\s*beshi|costly|sosta|kom\s*dame/i.test(clean) && !profile.extraFacts.includes("price sensitive")) profile.extraFacts.push("price sensitive");
  if (/abar\s*nite|reorder/i.test(clean) && !profile.extraFacts.includes("wants repeat order")) {
    profile.extraFacts.push("wants repeat order");
    if (profile.orderStatus !== "order_placed") profile.orderStatus = "repeat_customer";
  }
  const cm = clean.match(/([0-9]+)\s*(?:son|daughter|shontan|baccha|child)/i);
  if (cm) { const f = "children: " + cm[0].trim(); if (!profile.extraFacts.includes(f)) profile.extraFacts.push(f); }
  if (profile.extraFacts.length > 30) profile.extraFacts = profile.extraFacts.slice(-30);

  saveMemory();
  return profile;
}

function appendChatMessage(senderId, role, text, isVoice = false) {
  if (!text || text.trim().length === 0) return;
  const profile = getCustomerProfile(senderId);

  if (role === "model" && isVoice) {
    profile.lastVoiceTranscript = text.trim();
  }

  if (!profile.chatLog) profile.chatLog = [];
  profile.chatLog.push({
    role,
    text: text.trim(),
    isVoice: !!isVoice,
    time: Date.now(),
  });

  // Keep up to 60 recent multi-turn messages (longer memory = better context)
  // Keep chatLog in memory cache for context — history.json stores full unlimited history
  if (profile.chatLog.length > 200) {
    // Before trimming, save a summary of the oldest messages
    const oldest = profile.chatLog.slice(0, profile.chatLog.length - 200);
    if (oldest.length > 0) {
      if (!profile.sessionSummaries) profile.sessionSummaries = [];
      const summary = oldest.slice(-5).map(m => `${m.role === 'user' ? 'কাস্টমার' : 'হাকিম'}: ${m.text.substring(0, 80)}`).join(' | ');
      profile.sessionSummaries.push({ time: Date.now(), summary });
      if (profile.sessionSummaries.length > 20) profile.sessionSummaries = profile.sessionSummaries.slice(-20);
    }
    profile.chatLog = profile.chatLog.slice(-200);
  }

  profile.lastContact = Date.now();
  saveMemory();
}

function buildCustomerMemoryPrompt(senderId, fallbackName) {
  const profile = getCustomerProfile(senderId, fallbackName);
  const symptomStr  = profile.symptoms && profile.symptoms.length > 0 ? profile.symptoms.join(', ') : 'not mentioned';
  const addressStr  = [profile.district, profile.thana, profile.address].filter(Boolean).join(', ');
  const allProducts = profile.productsDiscussedAll && profile.productsDiscussedAll.length > 0 ? profile.productsDiscussedAll.join(', ') : (profile.productDiscussed || 'none');
  const extraStr    = profile.extraFacts && profile.extraFacts.length > 0 ? profile.extraFacts.join(', ') : 'none';
  const locStr      = profile.mentionedLocations && profile.mentionedLocations.length > 0 ? profile.mentionedLocations.join(', ') : '';
  const ordersCount = profile.ordersPlaced ? profile.ordersPlaced.length : 0;
  const sessionCtx  = profile.sessionSummaries && profile.sessionSummaries.length > 0 ? profile.sessionSummaries.slice(-2).map(function(s) { return s.summary; }).join(' || ') : '';
  const orderLabel  = profile.orderStatus === 'order_placed' ? ('Order confirmed (total ' + ordersCount + ')')
                    : profile.orderStatus === 'repeat_customer' ? 'Wants repeat order'
                    : profile.orderStatus === 'interested' ? 'Interested (gave phone)'
                    : 'Consulting';

  const hasRealName = isValidPersonName(profile.name);
  const displayName = hasRealName ? profile.name : 'NOT PROVIDED YET (Do NOT assume his name is Vai, Brother, or guess)';

  var parts = [
    '=== COMPLETE CUSTOMER MEMORY (PERMANENT) ===',
    'ID: ' + profile.senderId,
    'Known Customer Name: ' + displayName,
    'Age: ' + (profile.age ? profile.age + ' bochor' : 'not known'),
    'Marital: ' + (profile.maritalStatus || 'not known'),
    'Profession: ' + (profile.profession || 'not known'),
    'Location: ' + (locStr || addressStr || 'not known'),
    'Full address: ' + (addressStr || 'not given'),
    'Phone: ' + (profile.phone || 'not given'),
    'Health problems: ' + symptomStr,
    'Duration of problem: ' + (profile.duration || 'unknown'),
    'All products discussed (history): ' + allProducts,
    'Current product: ' + (profile.productDiscussed || 'none'),
    'Order status: ' + orderLabel,
    'Extra facts: ' + extraStr,
    'Total messages sent: ' + (profile.totalMessages || 0),
    'First contact: ' + (profile.firstContact ? new Date(profile.firstContact).toLocaleDateString() : 'unknown'),
    'Last voice transcript: ' + (profile.lastVoiceTranscript ? profile.lastVoiceTranscript.substring(0, 100) : 'none'),
    sessionCtx ? ('Old conversation summary: ' + sessionCtx) : '',
    '=== ABSOLUTE CRITICAL RULES (DO NOT VIOLATE) ===',
    '1. NEVER ask for name again. Known name: ' + displayName,
    '2. NEVER ask for phone again. Known phone: ' + (profile.phone || 'NOT GIVEN'),
    '3. NEVER ask for address/district/thana again. Known: ' + (addressStr || 'NOT GIVEN'),
    '4. NEVER ask for age again. Known: ' + (profile.age || 'NOT GIVEN'),
    '5. NEVER ask for marital status again. Known: ' + (profile.maritalStatus || 'NOT GIVEN'),
    '6. NEVER ask about symptoms already mentioned. Known: ' + symptomStr,
    '7. Continue conversation naturally — do NOT repeat any question already answered.',
    '8. DEFAULT ADDRESS = "ভাইয়া" (like Sir/Brother, NOT a name). Only use real name if Known Customer Name shows actual name (NOT "NOT PROVIDED YET").',
    '9. If order placed before (' + ordersCount + '), ask about delivery/results first.',
    '10. DO NOT repeat welcome or introduction if totalMessages > 2.',
  ].filter(Boolean).join('\n');

  return parts;
}

function getRecentChatHistory(senderId, limit = 30) {
  const profile = getCustomerProfile(senderId);
  // First try to load from history.json file for complete context
  const histFile = path.join(DATA_DIR, "customers", String(senderId), "history.json");
  let messages = [];
  if (fs.existsSync(histFile)) {
    try {
      const allHistory = JSON.parse(fs.readFileSync(histFile, "utf-8"));
      messages = allHistory.slice(-limit);
    } catch {}
  }
  // Fallback to in-memory chatLog
  if (messages.length === 0 && profile.chatLog && profile.chatLog.length > 0) {
    messages = profile.chatLog.slice(-limit);
  }
  if (messages.length === 0) return [];
  return messages.map(entry => {
    const author = entry.role === "user" ? (profile.name || "Customer") : "হাকিম রিয়াজুল করিম (Doctor)";
    const tag = entry.isVoice ? " [Voice Note]" : "";
    return `${author}${tag}: "${entry.text}"`;
  });
}

// Get complete chat history for a customer (all messages ever)
function getAllCustomerHistory(senderId) {
  const histFile = path.join(DATA_DIR, "customers", String(senderId), "history.json");
  if (fs.existsSync(histFile)) {
    try { return JSON.parse(fs.readFileSync(histFile, "utf-8")); } catch {}
  }
  const profile = getCustomerProfile(senderId);
  return profile.chatLog || [];
}

// ── Smart Follow-up Engine ────────────────────────────────────────────────────

// Identify customers who were in touch 1-2 days ago (20 to 65 hours)
function getEligibleFollowUpCandidates(minHours = 20, maxHours = 65) {
  if (!isLoaded) loadMemory();
  const now = Date.now();
  const candidates = [];

  for (const profile of memoryCache.values()) {
    // Only target real Facebook PSIDs (minimum 10 digits)
    if (!profile.senderId || !/^\d{10,}$/.test(String(profile.senderId))) continue;

    // Skip if order already placed or delivered
    if (profile.orderStatus === "order_placed" || profile.orderStatus === "delivered") continue;

    // Check if customer discussed health/product or has interaction history
    const hasSymptoms = profile.symptoms && profile.symptoms.length > 0;
    const hasProduct = !!profile.productDiscussed;
    const hasChatLog = profile.chatLog && profile.chatLog.length >= 1;
    const hasOrderInterest = profile.orderStatus === "interested" || profile.followUpStatus === "pending" || hasChatLog;
    if (!hasSymptoms && !hasProduct && !hasOrderInterest) continue;

    // Safety limit: max 2 follow-ups per customer
    const count = profile.followUpCount || 0;
    if (count >= 2) continue;

    const msSinceContact = now - (profile.lastContact || profile.firstContact || now);
    const hoursSinceContact = msSinceContact / (1000 * 60 * 60);
    const daysSinceLastContact = Math.max(1, Math.floor(hoursSinceContact / 24));

    // Must be in the 1-2 day window (minHours to maxHours)
    if (hoursSinceContact < minHours) continue;
    if (maxHours && hoursSinceContact > maxHours) continue;

    // Must wait at least 24 hours between follow-ups
    if (profile.lastFollowUpTime) {
      const hoursSinceLastFollowUp = (now - profile.lastFollowUpTime) / (1000 * 60 * 60);
      if (hoursSinceLastFollowUp < 24) continue;
    }

    // Safety: ensure customer has not messaged in the last 30 minutes
    const lastMsg = profile.chatLog && profile.chatLog.length > 0 ? profile.chatLog[profile.chatLog.length - 1] : null;
    if (lastMsg && lastMsg.role === "user" && (now - lastMsg.time) < 30 * 60 * 1000) {
      continue;
    }

    candidates.push({ profile, stage: count + 1, daysSinceLastContact, hoursSinceContact });
  }

  return candidates;
}

// Generate an empathetic, human-friendly fallback follow-up if LLM call is unavailable
function generateFallbackCaringFollowUp(profile) {
  const name = (profile.name && !["Customer", "কাস্টমার", "ভাইয়া"].includes(profile.name))
    ? profile.name.split(" ")[0]
    : "ভাইয়া";

  let symptom = "শারীরিক সুস্থতা ও স্বাস্থ্য পরামর্শ";
  if (profile.symptoms && profile.symptoms.length > 0) {
    symptom = profile.symptoms.slice(0, 2).map(s => s.split(" (")[0]).join(" ও ");
  } else if (profile.productDiscussed) {
    symptom = `${profile.productDiscussed}-এর বিষয়ে ও স্বাস্থ্য পরামর্শ`;
  }

  const templates = [
    `আসসালামু আলাইকুম ${name} ভাইয়া, কেমন আছেন? গত পরশু আপনার সাথে ${symptom} নিয়ে কথা হয়েছিল। আপনার কথাটি মনে পড়ায় একজন শুভাকাঙ্ক্ষী হিসেবে খোঁজ নিতে নক দিলাম—এখন আপনার শরীর কেমন আছে? আপনার সুস্থতায় কোনো সঠিক পরামর্শ বা সহযোগিতার প্রয়োজন হলে নির্দ্বিধায় জানাবেন ভাইয়া, সবসময় পাশে আছি।`,
    `${name} ভাইয়া, আশা করি ভালো আছেন। গত পরশু কথা হয়েছিল, তাই ভাবলাম একটু খোঁজ নিই—এখন শরীরটা কেমন বোধ করছেন? শরীর সুস্থ রাখা সবার আগে ভাইয়া। আপনার যেকোনো পরামর্শ বা সহযোগিতার প্রয়োজন হলে আমাকে জানাবেন, ইনশাআল্লাহ পাশে পাবেন।`,
    `আসসালামু আলাইকুম ${name} ভাইয়া। পরশু আপনার সাথে স্বাস্থ্য বিষয়ে কথা হয়েছিল, তাই শুভাকাঙ্ক্ষী হিসেবে শারীরিক অবস্থার খোঁজ নিতে মেসেজ দিলাম। এখন কেমন আছেন ভাইয়া? কোনো বিষয়ে সঠিক পরামর্শের দরকার হলে জানাবেন। আল্লাহ আপনাকে সুস্থ রাখুন।`
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

// Record that a follow-up was sent — saves to profile and chatLog for seamless continuation
function recordFollowUpSent(senderId, message, stage) {
  const profile = getCustomerProfile(senderId);
  profile.followUpCount = (profile.followUpCount || 0) + 1;
  profile.lastFollowUpTime = Date.now();
  if (!profile.followUpHistory) profile.followUpHistory = [];
  profile.followUpHistory.push({
    stage,
    message: message.trim(),
    sentAt: Date.now(),
  });

  // Append to chatLog so regular chatbot continues context seamlessly
  appendChatMessage(senderId, "model", message.trim(), false);
  saveMemory();
}

// Build LLM prompt to generate a unique, personal, doctor-style follow-up message
function buildPersonalizedFollowUpPrompt(candidate, doctorName = "হাকীম মো: আব্দুল করিম", pharmacyName = "গ্রীন হেলথ ইউনানী ফার্মেসী") {
  const { profile, stage, daysSinceLastContact, hoursSinceContact } = candidate;

  // Gather past customer messages to know EXACTLY what they discussed
  const userMessages = (profile.chatLog || [])
    .filter(m => m.role === "user")
    .map(m => m.text.trim())
    .filter(Boolean);

  const lastUserMsg = userMessages.length > 0 ? userMessages[userMessages.length - 1] : "";
  const recentInquiries = userMessages.slice(-3).join(" | ");

  let symptomStr = "";
  if (profile.symptoms && profile.symptoms.length > 0) {
    symptomStr = profile.symptoms.map(s => s.split(" (")[0]).join(" ও ");
  } else if (profile.productDiscussed) {
    symptomStr = `${profile.productDiscussed}-এর বিষয়ে`;
  } else if (lastUserMsg) {
    symptomStr = `"${lastUserMsg.substring(0, 50)}" বিষয়ে`;
  } else {
    symptomStr = "শারীরিক সুস্থতা ও স্বাস্থ্য পরামর্শ";
  }

  let patientFirstName = "ভাইয়া";
  if (profile.name && !["Customer", "কাস্টমার", "ভাইয়া"].includes(profile.name)) {
    const parts = profile.name.trim().split(/\s+/);
    if (/^(?:md\.?|mohammad|muhammad|মোঃ|মো:)$/i.test(parts[0]) && parts.length > 1) {
      patientFirstName = parts[1];
    } else {
      patientFirstName = parts[0];
    }
  }

  const timeText = (hoursSinceContact && hoursSinceContact < 36) ? "গতকাল" : "গত পরশু";
  const greeting = (patientFirstName && patientFirstName !== "ভাইয়া")
    ? `${patientFirstName} ভাই, আসসালামু আলাইকুম, কেমন আছেন?`
    : `আসসালামু আলাইকুম ভাইয়া, কেমন আছেন?`;

  return `
You are ${doctorName}, Category-A Registered Unani Physician at ${pharmacyName}, Alikadam, Bandarban.
You are personally following up with a patient/brother named "${patientFirstName}" who contacted your page 1-2 days ago (${timeText}) discussing health or inquiring about medicines.
You remembered them naturally because you genuinely care about patient health and proper guidance.

PATIENT'S MEDICAL DOSSIER:
- Patient Name: ${profile.name || "ভাইয়া"} (call them: ${patientFirstName})
- Topic / Inquiry Discussed: ${symptomStr}
- Patient's exact words in past chat: "${recentInquiries || lastUserMsg || "স্বাস্থ্য পরামর্শ নিয়েছিলেন"}"
- Age: ${profile.age ? profile.age + " বছর" : "জানা যায়নি"}
- Marital Status: ${profile.maritalStatus || "জানা যায়নি"}
- Medicine Inquired: ${profile.productDiscussed || "কস্তুরী / ভেষজ কোর্স"}

CORE OBJECTIVE (SINCERE EMPATHY & DESIRE TO HELP — STRICTLY ZERO SALES PRESSURE):
The customer MUST feel 100% that you reached out as a caring doctor and well-wishing elder brother to check on their well-being and health guidance, NOT to push a sale.

MANDATORY RULES:
1. STRICT BAN ON SALES TALK:
   - ABSOLUTELY NEVER say: "অর্ডার করুন", "অফার চলছে", "দাম মাত্র", "বিকাশ করুন", "এখনই নিন", "পার্সেল পাঠাব", "কুরিয়ার চার্জ", "স্টক সীমিত", or any promotional phrases.
2. PERSONALIZED HEALTH CHECK-IN:
   - Start with this exact brotherly greeting: "${greeting}"
   - Naturally recall what they inquired/discussed ${timeText} (reference their symptom, inquiry, or question naturally).
   - Inquire about their health condition and offer gentle doctorly guidance: "আপনার শারীরিক বিষয়ে কোনো সঠিক পরামর্শ বা সহযোগিতার প্রয়োজন আছে কি ভাইয়া? যেকোনো প্রয়োজনে এই হাকীম ভাইকে পাশে পাবেন।"
   - If customer expressed hesitation, fear or doubt earlier, you may warmly reassure: "মনে কোনো দ্বিধা বা সংশয় থাকলে আপনি সরাসরি ফোনেও (01870-023804) কথা বলতে পারেন, আমি নিজে আপনার শরীরের জন্য সেরা সমাধানটি বুঝিয়ে দেব।"
3. FORMAT & TONE:
   - Maximum 2 to 3 short sentences.
   - Clean, natural Bangladeshi spoken Bengali.
   - Plain text only (NO markdown bolding, no emojis, no asterisks).

Write ONLY the Bengali message now:
`.trim();
}

module.exports = {
  getCustomerProfile,
  updateCustomerProfile,
  extractCustomerFacts,
  appendChatMessage,
  buildCustomerMemoryPrompt,
  getRecentChatHistory,
  getAllCustomerHistory,
  saveMemory,
  getEligibleFollowUpCandidates,
  recordFollowUpSent,
  buildPersonalizedFollowUpPrompt,
  generateFallbackCaringFollowUp,
  isValidPersonName,
};

