// src/lib/customer-memory.ts
// 24/7 Permanent Long-term Customer Memory & Clinical Profile Engine for Next.js Webhook & Bot
import fs from "fs";
import path from "path";

export interface ChatMessageEntry {
  role: "user" | "model";
  text: string;
  isVoice?: boolean;
  time: number;
}

export interface FollowUpRecord {
  stage: number;
  message: string;
  sentAt: number;
}

export interface CustomerProfile {
  senderId: string;
  name: string;
  age: string;
  maritalStatus: string;
  profession?: string;
  symptoms: string[];
  duration: string;
  productDiscussed: string;        // last product discussed
  productsDiscussedAll: string[];  // ALL products ever discussed
  orderStatus: "inquiry" | "interested" | "order_placed" | "delivered" | "repeat_customer";
  ordersPlaced: any[];             // history of all orders confirmed
  phone: string;
  district: string;
  thana: string;
  address: string;
  mentionedLocations: string[];
  allHealthKeywords: string[];
  budgetMentioned: string[];
  extraFacts: string[];
  sessionSummaries: { time: number; summary: string }[];
  lastVoiceTranscript: string;
  chatLog: ChatMessageEntry[];
  firstContact: number;
  lastContact: number;
  totalMessages: number;
  followUpCount?: number;
  lastFollowUpTime?: number;
  followUpHistory?: FollowUpRecord[];
  prefersVoice?: boolean;
}

export interface FollowUpCandidate {
  profile: CustomerProfile;
  stage: number;
  daysSinceLastContact: number;
}

function getDataDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "data"),
    path.resolve(__dirname, "..", "..", "data"),
    path.resolve(__dirname, "..", "data"),
    "/app/data"
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  const dir = path.resolve(process.cwd(), "data");
  try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}

const MEMORY_FILE = path.join(getDataDir(), "customer_memory.json");
const memoryCache = new Map<string, CustomerProfile>();
let isLoaded = false;

function loadMemory(): void {
  if (isLoaded) return;
  try {
    const memPath = path.join(getDataDir(), "customer_memory.json");
    if (fs.existsSync(memPath)) {
      const raw = fs.readFileSync(memPath, "utf-8");
      const parsed = JSON.parse(raw);
      for (const [id, prof] of Object.entries(parsed)) {
        memoryCache.set(String(id), prof as CustomerProfile);
      }
    }
  } catch (err: any) {
    console.warn("[CUSTOMER_MEMORY_LOAD_WARN]", err.message);
  }
  isLoaded = true;
}

export function saveMemory(): void {
  try {
    const obj: Record<string, CustomerProfile> = {};
    for (const [id, prof] of memoryCache.entries()) {
      obj[id] = prof;
    }
    const memPath = path.join(getDataDir(), "customer_memory.json");
    const dir = path.dirname(memPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(memPath, JSON.stringify(obj, null, 2), "utf-8");
  } catch (err: any) {
    console.warn("[CUSTOMER_MEMORY_SAVE_WARN]", err.message);
  }
}

export function getCustomerProfile(senderId: string, defaultName: string = ""): CustomerProfile {
  loadMemory();
  const idStr = String(senderId);
  if (!memoryCache.has(idStr)) {
    const newProfile: CustomerProfile = {
      senderId: idStr,
      name: defaultName || "",
      age: "",
      maritalStatus: "",
      profession: "",
      symptoms: [],
      duration: "",
      productDiscussed: "",
      productsDiscussedAll: [],
      orderStatus: "inquiry",
      ordersPlaced: [],
      phone: "",
      district: "",
      thana: "",
      address: "",
      mentionedLocations: [],
      allHealthKeywords: [],
      budgetMentioned: [],
      extraFacts: [],
      sessionSummaries: [],
      lastVoiceTranscript: "",
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
  const prof = memoryCache.get(idStr)!;
  if (defaultName && (!prof.name || prof.name === "Customer" || prof.name === "কাস্টমার")) {
    prof.name = defaultName;
  }
  return prof;
}

export function updateCustomerProfile(senderId: string, updates: Partial<CustomerProfile>): CustomerProfile {
  const profile = getCustomerProfile(senderId);
  Object.assign(profile, updates);
  profile.lastContact = Date.now();
  saveMemory();
  return profile;
}

function toBengaliNumerals(str: string | number): string {
  const bDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(str).replace(/\d/g, (d) => bDigits[parseInt(d, 10)] || d);
}

export function extractCustomerFacts(senderId: string, text: string, senderName?: string): CustomerProfile {
  const profile = getCustomerProfile(senderId, senderName);
  if (!text) return profile;

  profile.totalMessages = (profile.totalMessages || 0) + 1;
  profile.lastContact = Date.now();
  const clean = text.trim();

  // Ensure all arrays are initialized
  if (!profile.symptoms)             profile.symptoms = [];
  if (!profile.productsDiscussedAll) profile.productsDiscussedAll = [];
  if (!profile.ordersPlaced)         profile.ordersPlaced = [];
  if (!profile.sessionSummaries)     profile.sessionSummaries = [];
  if (!profile.extraFacts)           profile.extraFacts = [];
  if (!profile.mentionedLocations)   profile.mentionedLocations = [];
  if (!profile.allHealthKeywords)    profile.allHealthKeywords = [];
  if (!profile.budgetMentioned)      profile.budgetMentioned = [];

  // 1. NAME
  if (senderName && (!profile.name || profile.name === "Customer" || /e\s*ki\s*jano|ki\s*jano/i.test(profile.name))) {
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
    const ageMatch = clean.match(/(?:age|বয়স|boys|boyos|bochor|বছর)\s*[:=]?\s*(\d{2})|(\d{2})\s*(?:years?|bochor|বছর|yr)/i);
    if (ageMatch) {
      const num = parseInt(ageMatch[1] || ageMatch[2], 10);
      if (num >= 15 && num <= 85) profile.age = String(num);
    } else {
      const directNum = clean.match(/\b(1[6-9]|[2-6]\d|7[0-5])\b/);
      if (directNum && /bochor|years?|boyos|boish|বছর/i.test(clean)) {
        profile.age = directNum[1];
      }
    }
  }

  // 3. MARITAL STATUS
  if (!profile.maritalStatus) {
    if (/unmarried|অবিবাহিত|single|biye\s*kori\s*ni|বিয়া\s*করি\s*নাই/i.test(clean)) {
      profile.maritalStatus = "অবিবাহিত (Unmarried)";
    } else if (/\bmarried\b|বিবাহিত|biye\s*korechi|সংসার|স্ত্রী|ওয়াইফ|wife|bou/i.test(clean)) {
      profile.maritalStatus = "বিবাহিত (Married)";
    }
  }

  // 4. COMPREHENSIVE HEALTH SYMPTOMS (23 conditions)
  const symptomRules: [RegExp, string][] = [
    [/druto\s*paton|shighro\s*poton|শীঘ্রপতন|দ্রুত\s*পতন|timing\s*kom|time\s*kom|time\s*pa[yi]|বেশি\s*সময়\s*থাকে\s*না/i, "দ্রুত বীর্যপাত (Premature Ejaculation)"],
    [/rokto\s*chalon|shokto\s*hoy\s*na|daray\s*na|naram|shithil|শক্তি\s*পাই\s*না|দাঁড়ায়\s*না|নরম\s*হয়ে\s*থাকে|উত্থান/i, "উত্থানজনিত দুর্বলতা (Erectile Dysfunction)"],
    [/patla\s*birjo|birjo\s*patla|বীর্য\s*পাতলা|pani\s*moto|পাতলা\s*পানি|বীর্য\s*ঘন|semen\s*thin/i, "বীর্য পাতলা ও শুক্রাণুর ঘাটতি (Low Semen Density)"],
    [/hater\s*kaj|hothat\s*kore|hastomaithun|হস্তমৈথুন|হাত\s*মার|hater\s*obves|khoti\s*koresi/i, "অতিরিক্ত হস্তমৈথুনের ক্ষতি (Masturbation Damage)"],
    [/lingo\s*choto|chikon|bata|বেঁকে\s*গেছে|ছোট\s*হয়ে|আকার\s*ছোট|চিকন\s*হয়ে/i, "লিঙ্গের শিথিলতা ও সংকোচন (Penile Tissue Shrinkage)"],
    [/ghumer\s*moddhe|shopnodosh|স্বপ্নদোষ|nightfall|ratre\s*pore\s*jay/i, "অতিরিক্ত স্বপ্নদোষ (Frequent Nightfall)"],
    [/prosrab|peshab|jwalapora|jola|প্রস্রাব|পেশাবে\s*জ্বালাপোড়া|khoy\s*rog|ক্ষয়রোগ/i, "প্রস্রাবে জ্বালাপোড়া ও ক্ষয়রোগ (Urine Irritation)"],
    [/mon\s*bhalo\s*nei|agroho\s*nei|icchye\s*kore\s*na|উত্তেজনা\s*নেই|মুড\s*নেই|desire\s*low/i, "যৌন আকাঙ্ক্ষার ঘাটতি (Low Libido)"],
    [/sorir\s*durbol|shorir\s*durbol|durbolota|দুর্বলতা|shorir\s*khape|clash\s*lagar|energy\s*nei/i, "শারীরিক দুর্বলতা ও ক্লান্তি (General Physical Fatigue)"],
    [/komor\s*betha|komor\s*batha|merudondo|কোমর\s*ব্যথা|mাজা\s*ব্যথা|back\s*pain/i, "কোমর ও স্নায়ুবিক ব্যথা (Lower Back / Nerve Pain)"],
    [/diabetes|diabetic|shugar|ডায়াবেটিস|সুগার/i, "ডায়াবেটিসজনিত দুর্বলতা (Diabetic Sexual Weakness)"],
    [/gastric|gas|acidity|গ্যাস|গ্যাস্ট্রিক|buk\s*jola/i, "গ্যাস্ট্রিকের সমস্যা (Gastric/Acidity)"],
    [/pre-ejaculation|pani\s*ber\s*hoy|kotha\s*bollei\s*pani|উত্তেজিত\s*হলেই\s*পানি/i, "উত্তেজনায় আগাম পানি আসার সমস্যা (Pre-cum Discharge)"],
    [/second\s*bar|ditio\s*bar|2nd\s*time|আবার\s*করতে\s*পারি\s*না|একবারের\s*পর/i, "পুনরায় সক্ষমতা অর্জনে অক্ষমতা (Inability to Re-erect)"],
    [/chinta|tension|depression|ভয়\s*লাগে|উদ্বেগ|মানসিক\s*চাপ/i, "মানসিক চাপ ও ভীতি (Psychological Anxiety)"],
    [/testosterone|hormone|হরমোন\s*কম|টেস্টোস্টেরন/i, "হরমোন বা টেস্টোস্টেরন ঘাটতি (Low Testosterone)"],
    [/baccha\s*hochhe\s*na|infertility|shontan|সন্তান\s*হচ্ছে\s*না|নিঃসন্তান/i, "সন্তান ধারণে জটিলতা (Infertility Concern)"],
    [/rattire\s*ghumer\s*shomossha|insomnia|ঘুম\s*হয়\s*না|অনিদ্রা/i, "অনিদ্রা ও অস্থিরতা (Insomnia)"],
    [/bichi\s*betha|testicle|অন্ডকোষ\s*ব্যথা|বিচি\s*ছোট/i, "অণ্ডকোষের ব্যথা বা সমস্যা (Testicle Pain)"],
    [/biman\s*chalao|drive\s*kori|night\s*shift|রাত\s*জাগা/i, "রাত জাগা ও দীর্ঘ শিফটের ক্লান্তি (Night Shift Exhaustion)"],
    [/bideshe\s*thaki|probashi|সৌদি|দুবাই|মালয়েশিয়া|প্রবাসী/i, "প্রবাসী জীবনের মানসিক ও শারীরিক ধকল (Expatriate Stress)"],
    [/dhompan|cigarette|shisa|ধূমপান\s*করি/i, "ধূমপানজনিত রক্তনালীর সংকোচন (Smoking-induced Constriction)"],
    [/osudh\s*kheye|viagra|one\s*time|ওয়ান\s*টাইম|কেমিক্যালের\s*ক্ষতি/i, "ওয়ান-টাইম ওষুধের পার্শ্বপ্রতিক্রিয়া (One-Time Chemical Damage)"]
  ];

  for (const [pattern, label] of symptomRules) {
    if (pattern.test(clean) && !profile.symptoms.includes(label)) {
      profile.symptoms.push(label);
    }
  }

  // 5. DURATION
  if (!profile.duration) {
    const durMatch = clean.match(/(\d+|[এক|দুই|তিন|চার|পাঁচ|ছয়|সাত|আট|দশ]+)\s*(?:bochor|mas|days?|বছর|মাস|দিন|year|month)/i);
    if (durMatch) profile.duration = durMatch[0].trim();
    else if (/onk\s*din|onek\s*din|অনেক\s*দিন|one\s*year|2\s*year|3\s*year|kotodin/i.test(clean)) {
      const dm = clean.match(/(?:pray|onk|onek|প্রায়)?\s*([0-9]+\s*(?:bochor|mas|year|month|বছর|মাস))/i);
      if (dm) profile.duration = dm[1].trim();
    }
  }

  // 6. PRODUCTS DISCUSSED
  const productPatterns: [RegExp, string][] = [
    [/amber|অম্বর|অম্ভর/i, "AMBER Premium (অম্বার)"],
    [/majum|মাজুন|salajeet|ফালেজিদ|সালাজিৎ/i, "মাজুন ও সালাজিৎ কোর্স"],
    [/kastoori|কস্তুরী|গোল্ড|gold/i, "কস্তুরী গোল্ড স্পেশাল"],
    [/oil|tel|মালিশ|ম্যাসেজ|ট্রিটমেন্ট\s*তেল/i, "হার্বাল ম্যাসেজ অয়েল"],
    [/combo|ফুল\s*কোর্স|কম্বো|সম্পূর্ণ\s*কোর্স/i, "১ মাসের স্পেশাল কম্বো কোর্স"],
  ];
  for (const [pat, pName] of productPatterns) {
    if (pat.test(clean)) {
      profile.productDiscussed = pName;
      if (!profile.productsDiscussedAll.includes(pName)) {
        profile.productsDiscussedAll.push(pName);
      }
    }
  }

  // 7. PHONE NUMBER
  const phoneMatch = clean.match(/(?:\+?8801|01)[3-9]\d{8}/);
  if (phoneMatch) {
    profile.phone = phoneMatch[0];
    if (profile.orderStatus === "inquiry") profile.orderStatus = "interested";
  }

  // 8. ORDER CONFIRMATION
  const hasOrderKeywords = /(?:confirm|order|অর্ডার|পাঠিয়ে\s*দিন|পাঠান|নিব|কুরিয়ার|ঠিকানা\s*দিসি|বুক\s*করুন)/i.test(clean);
  const hasFullDetails = Boolean(profile.phone) && /(?:জেলা|থানা|গ্রাম|রোড|ঢাকা|চট্টগ্রাম|বাসা|বাড়ি|ঠিকানা)/i.test(clean);
  if ((hasOrderKeywords && Boolean(profile.phone)) || hasFullDetails) {
    profile.orderStatus = "order_placed";
    const orderSnapshot = {
      date: new Date().toISOString(),
      product: profile.productDiscussed || "AMBER Premium",
      phone: profile.phone,
      district: profile.district || "",
      address: profile.address || "",
    };
    if (!profile.ordersPlaced.some((o: any) => o.phone === orderSnapshot.phone && o.product === orderSnapshot.product)) {
      profile.ordersPlaced.push(orderSnapshot);
    }
  }

  // 9. LOCATION
  const lm = clean.match(/\b(dhaka|chittagong|sylhet|rajshahi|khulna|barishal|comilla|mymensingh|rangpur|noakhali|feni|gazipur|narayanganj|bogura|tangail|faridpur|jashore|kushtia|pabna|sirajganj|dinajpur|cox's\s*bazar)\b/i);
  if (lm) {
    const loc = lm[0];
    if (!profile.mentionedLocations.includes(loc)) profile.mentionedLocations.push(loc);
    if (!profile.district) profile.district = loc;
  }

  // 10. PROFESSION
  if (!profile.profession) {
    if (/farmer|krishok|chashibadi/i.test(clean))                   profile.profession = "Farmer";
    else if (/driver|গাড়ি\s*চালাই/i.test(clean))                    profile.profession = "Driver";
    else if (/teacher|shikkhok|শিক্ষক/i.test(clean))                profile.profession = "Teacher";
    else if (/business|byapari|ব্যবসা|দোকান/i.test(clean))          profile.profession = "Business";
    else if (/garments|গার্মেন্টস/i.test(clean))                    profile.profession = "Garments";
    else if (/probashi|malaysia|saudi|dubai|abroad|প্রবাসী/i.test(clean)) profile.profession = "Probashi";
    else if (/student|ছাত্র|পড়াশোনা/i.test(clean))                  profile.profession = "Student";
    else if (/service|chakri|govt|চাকরি/i.test(clean))              profile.profession = "Service";
  }

  // 11. BUDGET
  const bm = clean.match(/budget\s*([0-9,]+)/i);
  if (bm) profile.budgetMentioned.push(bm[1] + " taka");

  // 12. EXTRA FACTS
  if (/aage\s*kheye|before\s*use|try\s*koresi|onek\s*osud/i.test(clean) && !profile.extraFacts.includes("tried treatment before")) profile.extraFacts.push("tried treatment before");
  if (/taratari|urgent|joruri|asap/i.test(clean) && !profile.extraFacts.includes("wants urgent solution")) profile.extraFacts.push("wants urgent solution");
  if (/dam\s*beshi|costly|sosta|kom\s*dame/i.test(clean) && !profile.extraFacts.includes("price sensitive")) profile.extraFacts.push("price sensitive");
  if (/abar\s*nite|reorder|আবার\s*নিব/i.test(clean) && !profile.extraFacts.includes("wants repeat order")) {
    profile.extraFacts.push("wants repeat order");
    if (profile.orderStatus !== "order_placed") profile.orderStatus = "repeat_customer";
  }

  saveMemory();
  return profile;
}

export function appendChatMessage(senderId: string, role: "user" | "model", text: string, isVoice: boolean = false): void {
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

  if (profile.chatLog.length > 60) {
    const oldest = profile.chatLog.slice(0, profile.chatLog.length - 60);
    if (oldest.length > 0) {
      if (!profile.sessionSummaries) profile.sessionSummaries = [];
      const summary = oldest.slice(-5).map(m => `${m.role === "user" ? "কাস্টমার" : "হাকিম"}: ${m.text.substring(0, 80)}`).join(" | ");
      profile.sessionSummaries.push({ time: Date.now(), summary });
      if (profile.sessionSummaries.length > 10) profile.sessionSummaries = profile.sessionSummaries.slice(-10);
    }
    profile.chatLog = profile.chatLog.slice(-60);
  }

  profile.lastContact = Date.now();
  saveMemory();
}

export function buildCustomerMemoryPrompt(senderId: string, fallbackName?: string): string {
  const profile = getCustomerProfile(senderId, fallbackName);
  const symptomStr  = profile.symptoms && profile.symptoms.length > 0 ? profile.symptoms.join(", ") : "not mentioned";
  const addressStr  = [profile.district, profile.thana, profile.address].filter(Boolean).join(", ");
  const allProducts = profile.productsDiscussedAll && profile.productsDiscussedAll.length > 0 ? profile.productsDiscussedAll.join(", ") : (profile.productDiscussed || "none");
  const extraStr    = profile.extraFacts && profile.extraFacts.length > 0 ? profile.extraFacts.join(", ") : "none";
  const locStr      = profile.mentionedLocations && profile.mentionedLocations.length > 0 ? profile.mentionedLocations.join(", ") : "";
  const ordersCount = profile.ordersPlaced ? profile.ordersPlaced.length : 0;
  const sessionCtx  = profile.sessionSummaries && profile.sessionSummaries.length > 0 ? profile.sessionSummaries.slice(-2).map((s) => s.summary).join(" || ") : "";
  const orderLabel  = profile.orderStatus === "order_placed" ? ("Order confirmed (total " + ordersCount + ")")
                    : profile.orderStatus === "repeat_customer" ? "Wants repeat order"
                    : profile.orderStatus === "interested" ? "Interested (gave phone)"
                    : "Consulting";

  const parts = [
    "=== COMPLETE CUSTOMER MEMORY (PERMANENT) ===",
    "ID: " + profile.senderId,
    "Name: " + (profile.name || fallbackName || "ভাইয়া"),
    "Age: " + (profile.age ? profile.age + " bochor" : "not known"),
    "Marital: " + (profile.maritalStatus || "not known"),
    "Profession: " + (profile.profession || "not known"),
    "Location: " + (locStr || addressStr || "not known"),
    "Full address: " + (addressStr || "not given"),
    "Phone: " + (profile.phone || "not given"),
    "Health problems: " + symptomStr,
    "Duration of illness: " + (profile.duration || "not known"),
    "All products discussed: " + allProducts,
    "Current order status: " + orderLabel,
    "Previous orders count: " + ordersCount,
    "Extra patient facts: " + extraStr,
    "Last voice doctor said: " + (profile.lastVoiceTranscript ? '"' + profile.lastVoiceTranscript + '"' : "none"),
  ];

  if (sessionCtx) {
    parts.push("Past sessions context: " + sessionCtx);
  }

  parts.push(
    "=============================================",
    "CRITICAL MEMORY MANDATES FOR THIS REPLY:",
    "1. ABSOLUTE BAN ON RE-ASKING: Do NOT ask for age (" + (profile.age || "none") + "), marital status (" + (profile.maritalStatus || "none") + "), or symptoms (" + symptomStr + ") if already listed above!",
    "2. CUSTOMER NAME RECALL: The customer's real name is: '" + (profile.name || fallbackName || "") + "'. If the customer asks 'amar name ki?', 'আমার নাম কি জানো?' -> State their real name with full confidence: 'জি ভাইয়া, আপনার নাম " + (profile.name || fallbackName || "ভাইয়া") + "।'",
    "3. PERSONAL CONTINUITY: Talk as their dedicated personal doctor who remembers their entire medical history and previous chats.",
    "4. AUTHENTIC BANGLADESHI TONE: Speak in natural, respectful Bangladeshi male tone ('জি ভাইয়া', 'আসসালামু আলাইকুম'). NEVER use Kolkata or Indian Bengali words ('জল', 'দাদা')."
  );

  return parts.join("\n");
}

export function getRecentChatHistory(senderId: string, limit: number = 15): string[] {
  const profile = getCustomerProfile(senderId);
  if (!profile.chatLog || profile.chatLog.length === 0) return [];
  return profile.chatLog.slice(-limit).map((entry) => {
    const author = entry.role === "user" ? (profile.name || "Customer") : "হাকিম রিয়াজুল করিম (Doctor)";
    const tag = entry.isVoice ? " [Voice Note]" : "";
    return `${author}${tag}: "${entry.text}"`;
  });
}

export function getEligibleFollowUpCandidates(minHours: number = 72): FollowUpCandidate[] {
  loadMemory();
  const now = Date.now();
  const candidates: FollowUpCandidate[] = [];

  for (const profile of memoryCache.values()) {
    if (profile.orderStatus === "order_placed" || profile.orderStatus === "delivered") continue;
    const hasSymptoms = profile.symptoms && profile.symptoms.length > 0;
    const hasProduct = !!profile.productDiscussed;
    if (!hasSymptoms && !hasProduct) continue;

    const count = profile.followUpCount || 0;
    if (count >= 3) continue;

    const msSinceContact = now - (profile.lastContact || profile.firstContact || now);
    const hoursSinceContact = msSinceContact / (1000 * 60 * 60);
    const daysSinceLastContact = Math.max(1, Math.floor(hoursSinceContact / 24));

    if (hoursSinceContact < minHours) continue;

    if (profile.lastFollowUpTime) {
      const hoursSinceLastFollowUp = (now - profile.lastFollowUpTime) / (1000 * 60 * 60);
      if (hoursSinceLastFollowUp < 72) continue;
    }

    candidates.push({
      profile,
      stage: count + 1,
      daysSinceLastContact,
    });
  }

  return candidates;
}

export function recordFollowUpSent(senderId: string, followUpMessage: string, stage: number): void {
  const profile = getCustomerProfile(senderId);
  profile.followUpCount = (profile.followUpCount || 0) + 1;
  profile.lastFollowUpTime = Date.now();
  if (!profile.followUpHistory) profile.followUpHistory = [];
  profile.followUpHistory.push({
    stage,
    message: followUpMessage,
    sentAt: Date.now(),
  });
  appendChatMessage(senderId, "model", followUpMessage, false);
  saveMemory();
}

export function buildPersonalizedFollowUpPrompt(
  candidate: FollowUpCandidate,
  doctorName: string = "হাকিম রিয়াজুল করিম",
  pharmacyName: string = "গ্রীন হেলথ ইউনানী ফার্মেসী"
): string {
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
You are personally reaching out to a patient who consulted you ${daysSinceLastContact} days ago.
PATIENT FILE:
- Name: ${profile.name || "ভাইয়া"}
- Age: ${profile.age ? profile.age + " বছর" : "unknown"}
- Problem: ${symptomStr}
- Product: ${profile.productDiscussed || "Unani herbal formula"}

RULES:
1. Zero marketing / NO templates.
2. Natural Bangladeshi caring brotherly doctor tone.
3. Max 2-3 sentences.
`.trim();
}
