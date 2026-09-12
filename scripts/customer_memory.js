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
    const custDir = path.join(DATA_DIR, "customers");
    if (!fs.existsSync(custDir)) fs.mkdirSync(custDir, { recursive: true });
    const filename = `${profile.senderId}.json`;
    fs.writeFileSync(path.join(custDir, filename), JSON.stringify(profile, null, 2), "utf-8");
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
  if (/^(vai|bhai|vaiya|bhaiya|ভাই|ভাইয়া|ভাইয়া|ভায়া|customer|কাস্টমার|doctor|hakim|হাকিম|ডাক্তার|admin|এডমিন|ki|jano|জান|জানো|বলেন|bolo|bolun|ki\s*jano|e\s*ki\s*jano|unknown|অজ্ঞাত|facebook\s*user|facebook\s*customer|user|voice|boyes|audio|ভয়েস|ভয়েস|বয়েজ|বয়েস|অডিও)$/i.test(s)) {
    return false;
  }
  if (/চিকিৎসালয়|ফার্মেসী|হেলথ|health|pharmacy|herbal|ayurvedic|unani|মেডিসিন|ওষুধ|অর্ডার|order|price|দাম|ডেলিভারি|delivery/i.test(s)) {
    return false;
  }
  if (/^[\d\s]+$/.test(s)) return false;
  if (/^(kemon|valo|kothai|koto|ki|konta|amra|apni|tumi|apnar|amar|আমি|তুমি|আপনি|কেমন|porte|পারিনা|পারি|চাই|chai|bole|বলতে)/i.test(s)) return false;
  return true;
}

function getCustomerProfile(senderId, defaultName = "") {
  if (!isLoaded) loadMemory();
  const idStr = String(senderId);
  const validName = isValidPersonName(defaultName) ? defaultName.trim() : "";
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
    const am = clean.match(/(?:boyos|age)\s*[:=]?\s*([\u09e6-\u09ef0-9]{2})/i) ||
               clean.match(/([\u09e6-\u09ef0-9]{2})\s*(?:bochor|years?)/i);
    if (am && am[1]) profile.age = toBN(am[1]);
    else {
      const dn = clean.match(/^\s*([\u09e6-\u09ef0-9]{2})\s*$/);
      if (dn) {
        const v = parseInt(dn[1].replace(/[\u09e6-\u09ef]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString()), 10);
        if (v >= 18 && v <= 80) profile.age = toBN(dn[1]);
      }
    }
  }

  // 3. MARITAL STATUS
  if (!profile.maritalStatus) {
    if (/obibahito|unmarried|single/i.test(clean))  profile.maritalStatus = "অবিবাহিত";
    else if (/bibahito|married/i.test(clean))        profile.maritalStatus = "বিবাহিত";
  }

  // 4. SYMPTOMS — 23 types, captures ALL health keywords automatically
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

  // 5. DURATION
  if (!profile.duration) {
    const dm = clean.match(/([\u09e6-\u09ef0-9]+)\s*(?:bochor|year|mash|month|din|day)\s*(?:dhore|jabot|theke|holo)/i);
    if (dm) profile.duration = dm[0].trim();
  }

  // 6. PHONE
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
    if (fName && fName.length > 2) profile.name = fName;
    if (fDist)  profile.district = fDist;
    if (fThana) profile.thana    = fThana;
    if (fAddr)  profile.address  = fAddr;
    if (fNum)   profile.phone    = fNum;
    const snap = { time: Date.now(), name: fName||profile.name, district: fDist||profile.district, thana: fThana||profile.thana, address: fAddr||profile.address, phone: fNum||profile.phone, product: profile.productDiscussed||"unknown" };
    profile.ordersPlaced.push(snap);
    profile.orderStatus = "order_placed";
    console.log("[MEMORY] ✅ Order saved:", JSON.stringify(snap));
  }

  // 8. PRODUCT DETECTION — all products
  const PRODS = [
    [/sex\s*king|সেক্স\s*কিং/i,                                 "Sex King (섹스킹)", "1"],
    [/amber|ambar|অম্বার|অম্বর|অ্যাম্বার|বিছানা\s*রাজা/i,           "AMBER Premium",     "19"],
    [/soul\s*mate|সোল\s*মেট|সুল\s*মেট/i,                        "Soul Mate",         "39"],
    [/black\s*ginseng|জিনসেং|ginseng/i,                         "Black Ginseng",     "6" ],
    [/black\s*velvet|velvet|ভেলভেট/i,                           "Black Velvet",      "18"],
    [/dream\s*touch|ড্রিম\s*টাচ|ড্রিমটাচ/i,                      "Dream Touch",       "22"],
    [/hammer\s*of\s*thor|হ্যামার|thor/i,                        "Hammer of Thor",    "25"],
    [/titan\s*gel|টাইটান\s*জেল/i,                               "Titan Gel",         "26"],
    [/tiger\s*king|টাইগার\s*কিং/i,                               "Tiger King",        "27"],
    [/maxman|ম্যাক্সম্যান/i,                                     "Maxman",            "28"],
    [/viga|ভিগা/i,                                              "Viga Spray",        "29"],
    [/shark|শার্ক/i,                                            "Shark Extract",     "30"],
    [/energy\s*plus|এনার্জি\s*প্লাস/i,                           "Energy Plus",       "12"],
    [/men's\s*burner|mens\s*burner|বার্নার/i,                   "Men's Burner",      "15"],
    [/egypt\s*gawa|গাওয়া|গাওয়া/i,                               "Egypt Gawa",        "16"],
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
  if (profile.chatLog.length > 60) {
    // Before trimming, save a summary of the oldest messages
    const oldest = profile.chatLog.slice(0, profile.chatLog.length - 60);
    if (oldest.length > 0) {
      if (!profile.sessionSummaries) profile.sessionSummaries = [];
      const summary = oldest.slice(-5).map(m => `${m.role === 'user' ? 'কাস্টমার' : 'হাকিম'}: ${m.text.substring(0, 80)}`).join(' | ');
      profile.sessionSummaries.push({ time: Date.now(), summary });
      if (profile.sessionSummaries.length > 10) profile.sessionSummaries = profile.sessionSummaries.slice(-10);
    }
    profile.chatLog = profile.chatLog.slice(-60);
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
    '=== CRITICAL RULES ===',
    '1. Do NOT ask again: age=' + (profile.age||'none') + ' marital=' + (profile.maritalStatus||'none'),
    '2. Continue conversation naturally using saved context above.',
    '3. Address customer respectfully: ' + (hasRealName ? profile.name + ' ভাই' : 'ভাইয়া'),
    '4. If customer asks "amar name ki jano" and Known Customer Name is NOT PROVIDED YET: Politely say you do not know his name yet and ask for his name.',
    '5. If order placed before (' + ordersCount + '), ask about delivery/results first.',
  ].filter(Boolean).join('\n');

  return parts;
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

// ── Smart Follow-up Engine ────────────────────────────────────────────────────

// Identify customers who discussed products/symptoms but haven't ordered yet
function getEligibleFollowUpCandidates(minHours = 72) {
  if (!isLoaded) loadMemory();
  const now = Date.now();
  const candidates = [];

  for (const profile of memoryCache.values()) {
    // Skip if order already placed or delivered
    if (profile.orderStatus === "order_placed" || profile.orderStatus === "delivered") continue;

    // Skip if customer never discussed symptoms or a product
    const hasSymptoms = profile.symptoms && profile.symptoms.length > 0;
    const hasProduct = !!profile.productDiscussed;
    if (!hasSymptoms && !hasProduct) continue;

    // Max 3 follow-ups per customer (doctor dignity — no spam)
    const count = profile.followUpCount || 0;
    if (count >= 3) continue;

    const msSinceContact = now - (profile.lastContact || profile.firstContact || now);
    const hoursSinceContact = msSinceContact / (1000 * 60 * 60);
    const daysSinceLastContact = Math.max(1, Math.floor(hoursSinceContact / 24));

    // Must be inactive for at least minHours
    if (hoursSinceContact < minHours) continue;

    // Must wait at least 72 hours between follow-ups
    if (profile.lastFollowUpTime) {
      const hoursSinceLastFollowUp = (now - profile.lastFollowUpTime) / (1000 * 60 * 60);
      if (hoursSinceLastFollowUp < 72) continue;
    }

    candidates.push({ profile, stage: count + 1, daysSinceLastContact });
  }

  return candidates;
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
function buildPersonalizedFollowUpPrompt(candidate, doctorName = "হাকিম রিয়াজুল করিম", pharmacyName = "গ্রীন হেলথ ইউনানী ফার্মেসী") {
  const { profile, stage, daysSinceLastContact } = candidate;

  const symptomStr =
    profile.symptoms && profile.symptoms.length > 0
      ? profile.symptoms.join(", ")
      : profile.productDiscussed
      ? `${profile.productDiscussed}-এর কোর্স সম্পর্কিত পরামর্শ`
      : "শারীরিক সুস্থতার পরামর্শ";

  const patientFirstName = (profile.name || "ভাইয়া").split(" ")[0];

  return `
You are ${doctorName} (হাকিম রিয়াজুল করিম), Senior Ayurvedic Hakim at ${pharmacyName}, Bangladesh.
You are personally reaching out to a patient who consulted you ${daysSinceLastContact} days ago, but did not finish their conversation or confirm their order. You remembered them naturally — not through any automated system.

PATIENT'S PERMANENT CLINICAL FILE:
- Name: ${profile.name || "ভাইয়া"} (first name: ${patientFirstName})
- Age: ${profile.age ? profile.age + " বছর" : "unknown"}
- Marital Status: ${profile.maritalStatus || "unknown"}
- Health Problems/Symptoms: ${symptomStr}
- Duration: ${profile.duration || "some time"}
- Product Discussed: ${profile.productDiscussed || "Unani herbal formula"}
- Follow-up Stage: ${stage} of 3 (${daysSinceLastContact} days since last conversation)
- Previous follow-ups sent: ${(profile.followUpHistory || []).length}

YOUR RULES FOR THIS MESSAGE:
1. ZERO MARKETING LANGUAGE:
   - NEVER say "প্রিয় গ্রাহক", "স্পেশাল অফার", "অর্ডার করুন", "সীমিত সময়", or any sales template phrase.
   - The patient MUST feel their personal doctor genuinely remembered them from a real clinical session.

2. TONE — Stage-based variation (generate a UNIQUE message, NOT the same template each time):
   - Stage 1 (${daysSinceLastContact} days passed, ~3-5 days):
     Open warmly, mention you were thinking about them, ask if their ${profile.symptoms[0] || "problem"} has improved since you last spoke, and whether they have started any treatment yet. Keep it curious and caring.
   - Stage 2 (~6-12 days):
     Open with concern, gently note that problems like theirs tend to worsen if left untreated for too long (nerve weakness and circulation issues compound). Ask how they are feeling today and if they need guidance to begin treatment.
   - Stage 3 (~13-30 days):
     Open with a warm hello, mention you have not heard from them in a while and wanted to make sure they are okay. Tell them your door (inbox) is always open for free personal advice, no pressure.

3. MUST INCLUDE — Natural personalisation:
   - Use their first name (${patientFirstName}) naturally in the greeting.
   - Reference their specific symptom or product discussed (${symptomStr}) — NOT generically.

4. LENGTH & FORMAT:
   - Maximum 3 sentences total.
   - Plain, natural spoken Bengali — like a caring doctor texting from their personal phone.
   - NO asterisks, bold, markdown, emojis, or hashtags.
   - NO sentence like "আমি আপনাকে ফলোআপ করছি" or anything that reveals this is automated.

Write ONLY the Bengali follow-up message now:
`.trim();
}

module.exports = {
  getCustomerProfile,
  updateCustomerProfile,
  extractCustomerFacts,
  appendChatMessage,
  buildCustomerMemoryPrompt,
  getRecentChatHistory,
  saveMemory,
  getEligibleFollowUpCandidates,
  recordFollowUpSent,
  buildPersonalizedFollowUpPrompt,
};

