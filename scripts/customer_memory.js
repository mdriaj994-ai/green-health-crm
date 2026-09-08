// scripts/customer_memory.js
// 24/7 Permanent Long-term Customer Memory & Profile Engine (CommonJS for Bot Runners)
const fs = require("fs");
const path = require("path");

const MEMORY_FILE = path.join(process.cwd(), "data", "customer_memory.json");
const memoryCache = new Map();
let isLoaded = false;

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

function saveMemory() {
  try {
    const obj = {};
    for (const [id, prof] of memoryCache.entries()) {
      obj[id] = prof;
    }
    const dir = path.dirname(MEMORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (err) {
    console.warn("[CUSTOMER_MEMORY_SAVE_WARN]", err.message);
  }
}

function getCustomerProfile(senderId, defaultName = "") {
  if (!isLoaded) loadMemory();
  const idStr = String(senderId);
  if (!memoryCache.has(idStr)) {
    const newProfile = {
      senderId: idStr,
      name: defaultName || "",
      age: "",
      maritalStatus: "",
      symptoms: [],
      duration: "",
      productDiscussed: "",
      productSl: "",
      orderStatus: "inquiry",
      phone: "",
      district: "",
      thana: "",
      address: "",
      lastVoiceTranscript: "",
      chatLog: [],
      firstContact: Date.now(),
      lastContact: Date.now(),
      totalMessages: 0,
    };
    memoryCache.set(idStr, newProfile);
    saveMemory();
    return newProfile;
  }
  const prof = memoryCache.get(idStr);
  if (defaultName && (!prof.name || prof.name === "কাস্টমার" || prof.name === "Customer")) {
    prof.name = defaultName;
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

function extractCustomerFacts(senderId, text, senderName) {
  const profile = getCustomerProfile(senderId, senderName);
  if (!text) return profile;

  profile.totalMessages = (profile.totalMessages || 0) + 1;
  profile.lastContact = Date.now();

  const clean = text.trim();

  // 1. Name extraction
  if (senderName && (!profile.name || profile.name === "কাস্টমার" || profile.name === "Customer")) {
    profile.name = senderName;
  }
  const nameMatch = clean.match(/(?:আমার\s*নাম|name\s*is|nam\s*[:=]?)\s*([A-Za-z\u0980-\u09FF\s]{2,25})/i);
  if (nameMatch && nameMatch[1]) {
    const n = nameMatch[1].trim();
    if (n.length > 2 && !/কাস্টমার|ভাই|doctor|hakim/i.test(n)) {
      profile.name = n;
    }
  }

  // 2. Age extraction
  if (!profile.age) {
    const ageMatch = clean.match(/(?:আমার\s*)?(?:বয়স|বয়স|boyos|bos|age)\s*(?:হলো|হবে|holo|hobe)?\s*[:=]?\s*([০-৯0-9]{2})/i) ||
                     clean.match(/([০-৯0-9]{2})\s*(?:বছর|bochor|years?)/i);
    if (ageMatch && ageMatch[1]) {
      profile.age = toBengaliNumerals(ageMatch[1]);
    } else {
      const directNum = clean.match(/^\s*([০-৯0-9]{2})\s*$/);
      if (directNum && directNum[1]) {
        const val = parseInt(directNum[1].replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d).toString()), 10);
        if (val >= 18 && val <= 80) {
          profile.age = toBengaliNumerals(directNum[1]);
        }
      }
    }
  }

  // 3. Marital status extraction
  if (!profile.maritalStatus) {
    if (/(?:আমি\s*)?অবিবাহিত|obibahito|unmarried|single|বিয়ে\s*করি\s*নাই|বিয়ে\s*করি\s*নি/i.test(clean)) {
      profile.maritalStatus = "অবিবাহিত";
    } else if (/(?:আমি\s*)?বিবাহিত|bibahito|married|বিয়ে\s*করেছি|বিয়ে\s*করছি/i.test(clean)) {
      profile.maritalStatus = "বিবাহিত";
    }
  }

  // 4. Symptoms extraction
  const symptomKeywords = [
    { regex: /druto\s*birjopat|দ্রুত\s*বীর্যপাত|বীর্য\s*পাতলা|birjo\s*patla|taratari\s*pore|তাড়াতাড়ি\s*পড়ে|দ্রুত\s*পড়ে/i, label: "দ্রুত বীর্যপাত ও বীর্য পাতলা" },
    { regex: /lingo\s*sithil|লিঙ্গ\s*শিথিল|দুর্বল|durbol|naram|নরম|উত্থান\s*হয়\s*না|utthan|rokto\s*chole\s*na/i, label: "লিঙ্গ শিথিলতা ও দুর্বল উত্থান" },
    { regex: /timing\s*kom|টাইমিং\s*কম|টাইম\s*পাই\s*না|সময়\s*কম|shomoy\s*kom|বেশি\s*সময়\s*থাকতে\s*পারি\s*না/i, label: "সহবাসে সময় স্বল্পতা (কম টাইমিং)" },
    { regex: /sopnodosh|স্বপ্নদোষ|khoy|ক্ষয়\s*রোগ|dhatu|ধাতু\s*দুর্বলতা|প্রস্রাবে\s*ধাতু/i, label: "অতিরিক্ত স্বপ্নদোষ ও ধাতু ক্ষয়" },
    { regex: /iccha\s*kom|ইচ্ছা\s*কম|রুচি\s*নাই|উত্তেজনা\s*আসে\s*না|sexual\s*desire/i, label: "যৌন আগ্রহ ও উত্তেজনার অভাব" },
    { regex: /choto|ছোট|bika|বাঁকা|আগামোটা\s*গোড়া\s*চিকন|agagora/i, label: "লিঙ্গের গঠনগত দুর্বলতা ও শিথিলতা" }
  ];

  for (const { regex, label } of symptomKeywords) {
    if (regex.test(clean) && !profile.symptoms.includes(label)) {
      profile.symptoms.push(label);
    }
  }

  // 5. Duration of problem (e.g. "২ বছর ধরে", "৬ মাস যাবৎ")
  if (!profile.duration) {
    const durMatch = clean.match(/(?:গত\s*)?([০-৯0-9 এক দুই তিন চার পাঁচ ছয়]+)\s*(?:বছর|মাস|দিন|year|month|সপ্তাহ)\s*(?:ধরে|যাবৎ|jabot|হলো|theke|থেকে)/i);
    if (durMatch && durMatch[0]) {
      profile.duration = durMatch[0].trim();
    }
  }

  // 6. Phone number extraction
  const phoneMatch = clean.match(/(?:\+?880|0)?1[3-9]\d{8}\b/);
  if (phoneMatch && phoneMatch[0]) {
    profile.phone = phoneMatch[0].replace(/^\+?88/, "");
    profile.orderStatus = "interested";
  }

  // 7. Order Form / Address parsing
  if (/নাম\s*=|জেলা\s*=|থানা\s*=|রিসিভ ঠিকানা\s*=|নাম্বার\s*=/i.test(clean)) {
    profile.orderStatus = "order_placed";
    const parseKey = (key) => {
      const reg = new RegExp(`${key}\\s*[:=]\\s*([^\\n,।]+)`, "i");
      const m = clean.match(reg);
      return m && m[1] ? m[1].trim() : "";
    };
    const fName = parseKey("নাম");
    const fDist = parseKey("জেলা");
    const fThana = parseKey("থানা");
    const fAddr = parseKey("রিসিভ ঠিকানা") || parseKey("ঠিকানা");
    const fNum = parseKey("নাম্বার") || parseKey("মোবাইল");

    if (fName && fName.length > 2) profile.name = fName;
    if (fDist) profile.district = fDist;
    if (fThana) profile.thana = fThana;
    if (fAddr) profile.address = fAddr;
    if (fNum) profile.phone = fNum;
  }

  // 8. Product discussion detection
  if (/amber|ambar|আম্বার|অম্বর|अंबर/i.test(clean)) {
    profile.productDiscussed = "AMBER Premium (অম্বর প্রিমিয়াম)";
    profile.productSl = "19";
  } else if (/soul\s*mate|সোল\s*মেট/i.test(clean)) {
    profile.productDiscussed = "সোল মেট (Soul Mate)";
    profile.productSl = "39";
  } else if (/black\s*ginseng|জিনসেং/i.test(clean)) {
    profile.productDiscussed = "Black Ginseng (ব্ল্যাক জিনসেং)";
    profile.productSl = "6";
  } else if (/black\s*velvet|ভেলভেট/i.test(clean)) {
    profile.productDiscussed = "Men's Black Velvet (ব্ল্যাক ভেলভেট)";
    profile.productSl = "18";
  }

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

  // Keep up to 40 recent multi-turn messages
  if (profile.chatLog.length > 40) {
    profile.chatLog = profile.chatLog.slice(-40);
  }

  profile.lastContact = Date.now();
  saveMemory();
}

function buildCustomerMemoryPrompt(senderId, fallbackName) {
  const profile = getCustomerProfile(senderId, fallbackName);

  const symptomStr = (profile.symptoms && profile.symptoms.length > 0)
    ? profile.symptoms.join(", ")
    : "এখনও নির্দিষ্ট করেননি";
  const addressStr = [profile.district, profile.thana, profile.address].filter(Boolean).join(", ");

  return `
=== 🧠 PERMANENT CUSTOMER CLINICAL MEMORY (কাস্টমারের আজীবনের মেমরি) ===
কাস্টমার আইডি: ${profile.senderId}
কাস্টমারের নাম: ${profile.name || fallbackName || "সম্মানিত ভাইয়া"}
বয়স: ${profile.age ? profile.age + " বছর" : "এখনও জানা যায়নি"}
বৈবাহিক অবস্থা: ${profile.maritalStatus || "এখনও জানা যায়নি"}
শারীরিক সমস্যা: ${symptomStr}
সমস্যার স্থায়িত্ব/মেয়াদ: ${profile.duration || "অজানা"}
আলোচিত প্রোডাক্ট: ${profile.productDiscussed || "প্রাকৃতিক কোর্স"}
অর্ডার অবস্থা: ${profile.orderStatus === "order_placed" ? "অর্ডার তথ্য দেওয়া হয়েছে" : profile.orderStatus === "interested" ? "আগ্রহী (ফোন দিয়েছেন)" : "পরামর্শ চলমান"}
সংরক্ষিত ফোন: ${profile.phone || "দেওয়া হয়নি"}
সংরক্ষিত ঠিকানা: ${addressStr || "দেওয়া হয়নি"}
গত ভয়েস নোটে ডাক্তার যা বলেছিলেন: ${profile.lastVoiceTranscript ? `"${profile.lastVoiceTranscript}"` : "কোনো ভয়েস পাঠানো হয়নি"}
======================================================================
⚠️ মেমরি গাইডলাইন (CRITICAL):
1. কাস্টমার যদি ইতিমধ্যে বয়স (${profile.age || "নেই"}), বৈবাহিক অবস্থা (${profile.maritalStatus || "নেই"}) বা সমস্যা জানিয়ে থাকেন, তবে দ্বিতীয়বার কখনোই তা জানতে চাইবেন না!
2. কাস্টমার পূর্ববর্তী মেসেজে যে তথ্য দিয়েছে তা এই মেমরিতে সংরক্ষিত আছে। তার অতীতের কথার ধারাবাহিকতা বজায় রেখে সম্মান ও আন্তরিকতার সাথে উত্তর দিন।
`.trim();
}

function getRecentChatHistory(senderId, limit = 15) {
  const profile = getCustomerProfile(senderId);
  if (!profile.chatLog || profile.chatLog.length === 0) return [];
  return profile.chatLog.slice(-limit).map(entry => {
    const author = entry.role === "user" ? (profile.name || "Customer") : "হাকিম রিয়াজুল করিম (Doctor)";
    const tag = entry.isVoice ? " [Voice Note]" : "";
    return `${author}${tag}: "${entry.text}"`;
  });
}

module.exports = {
  getCustomerProfile,
  updateCustomerProfile,
  extractCustomerFacts,
  appendChatMessage,
  buildCustomerMemoryPrompt,
  getRecentChatHistory,
  saveMemory,
};
