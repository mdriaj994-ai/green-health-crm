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

function saveMemory() {
  try {
    const obj = {};
    for (const [id, prof] of memoryCache.entries()) {
      obj[id] = prof;
    }
    // DATA_DIR already guaranteed at module load
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (err) {
    console.warn("[CUSTOMER_MEMORY_SAVE_WARN]", err.message, "| Path:", MEMORY_FILE);
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

  // Init missing array fields
  if (!profile.symptoms)             profile.symptoms = [];
  if (!profile.productsDiscussedAll) profile.productsDiscussedAll = [];
  if (!profile.ordersPlaced)         profile.ordersPlaced = [];
  if (!profile.sessionSummaries)     profile.sessionSummaries = [];
  if (!profile.extraFacts)           profile.extraFacts = [];
  if (!profile.mentionedLocations)   profile.mentionedLocations = [];
  if (!profile.allHealthKeywords)    profile.allHealthKeywords = [];
  if (!profile.budgetMentioned)      profile.budgetMentioned = [];

  // 1. NAME
  if (senderName && (!profile.name || profile.name === "Customer" ||
      /e\s*ki\s*jano|ki\s*jano/i.test(profile.name))) {
    profile.name = senderName;
  }
  const isAskingName = /(?:name|nam)\s*(?:ki|konta|jano|bolen)/i.test(clean);
  if (!isAskingName) {
    const nm = clean.match(/(?:my\s*name\s*is|\bnam\s*[:=])\s*([A-Za-z\u0980-\u09FF\s]{2,25})/i);
    if (nm && nm[1]) {
      const n = nm[1].trim();
      if (n.length >= 2 && !/^(doctor|hakim|ki|jano)/i.test(n)) profile.name = n;
    }
  }
  if (profile.name && (/e\s*ki\s*jano|ki\s*jano/i.test(profile.name) || profile.name.length < 2)) {
    profile.name = senderName || "";
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
    [/amber|ambar/i,           "AMBER Premium", "19"],
    [/soul\s*mate/i,           "Soul Mate",     "39"],
    [/ginseng/i,               "Black Ginseng", "6" ],
    [/velvet/i,                "Black Velvet",  "18"],
    [/dream\s*touch/i,         "Dream Touch",   "22"],
    [/energy\s*plus/i,         "Energy Plus",   "12"],
    [/majoon|maju/i,           "Majoon",        "5" ],
    [/jaoshanda/i,             "Jaoshanda",     "8" ],
    [/habbe/i,                 "Habbe",         "10"],
    [/qurs|kurs/i,             "Qurs",          "11"],
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

  var parts = [
    '=== COMPLETE CUSTOMER MEMORY (PERMANENT) ===',
    'ID: ' + profile.senderId,
    'Name: ' + (profile.name || fallbackName || 'Vai'),
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
    '3. Address customer by name: ' + (profile.name || fallbackName || 'Vai'),
    '4. If order placed before (' + ordersCount + '), ask about delivery/results first.',
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
    const daysSinceContact = Math.max(1, Math.floor(hoursSinceContact / 24));

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

