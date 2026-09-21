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
  bloodGroup?: string;
  diabetes?: string;
  bloodPressure?: string;
  previousMedication?: string;
  marriageDuration?: string;
  diagnosticStage?: number;
  timing?: string;
  erectionQuality?: string;
  semenQuality?: string;
  preCum?: string;
  sleepQuality?: string;
  gastric?: string;
  probashi?: string;
  sessionSummaries: { time: number; summary: string }[];
  lastVoiceTranscript: string;
  chatLog: ChatMessageEntry[];
  firstContact: number;
  lastContact: number;
  followUpCount?: number;
  lastFollowUpTime?: number;
  followUpHistory?: FollowUpRecord[];
  sentKasturiImages?: string[];
  prefersVoice?: boolean;
  scheduledFollowUpAt?: number;
  followUpReason?: string;
  followUpPromiseText?: string;
  followUpStatus?: "pending" | "sent" | "cancelled";
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

export function saveCustomerDossier(profile: CustomerProfile): void {
  try {
    const custDir = path.join(getDataDir(), "customers");
    if (!fs.existsSync(custDir)) fs.mkdirSync(custDir, { recursive: true });
    const filename = `${profile.senderId}.json`;
    fs.writeFileSync(path.join(custDir, filename), JSON.stringify(profile, null, 2), "utf-8");
  } catch (err: any) {
    console.warn("[CUSTOMER_DOSSIER_SAVE_WARN]", err.message);
  }
}

export function saveMemory(): void {
  try {
    const obj: Record<string, CustomerProfile> = {};
    for (const [id, prof] of memoryCache.entries()) {
      obj[id] = prof;
      saveCustomerDossier(prof);
    }
    const memPath = path.join(getDataDir(), "customer_memory.json");
    const dir = path.dirname(memPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(memPath, JSON.stringify(obj, null, 2), "utf-8");
  } catch (err: any) {
    console.warn("[CUSTOMER_MEMORY_SAVE_WARN]", err.message);
}
}

export function isValidPersonName(n: any): boolean {
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

export function getAllCustomerProfiles(): CustomerProfile[] {
  loadMemory();
  return Array.from(memoryCache.values()).sort((a, b) => (b.lastContact || 0) - (a.lastContact || 0));
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
      sessionSummaries: [],
      lastVoiceTranscript: "",
      chatLog: [],
      firstContact: Date.now(),
      lastContact: Date.now(),
      prefersVoice: false,
    };
    memoryCache.set(idStr, newProfile);
    saveMemory();
    return newProfile;
  }
  const prof = memoryCache.get(idStr)!;
  if (defaultName && (!prof.name || prof.name === "Customer" || prof.name === "à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦°")) {
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
  const bDigits = ["à§¦", "à§§", "à§¨", "à§©", "à§ª", "à§«", "à§¬", "à§­", "à§®", "à§¯"];
  return String(str).replace(/\d/g, (d) => bDigits[parseInt(d, 10)] || d);
}

// â”€â”€ Dynamic Customer Commitment & Follow-up Time Parser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function parseDeferredCommitment(text: string): { scheduledAt: number; reason: string; promiseText: string } | null {
  if (!text) return null;
  const clean = text.toLowerCase().trim();
  const now = Date.now();

  // If customer explicitly says they already bought or cancelled or do not want
  if (/(à¦¨à¦¿à¦¤à§‡\s*à¦šà¦¾à¦‡\s*à¦¨à¦¾|à¦¦à¦°à¦•à¦¾à¦°\s*à¦¨à§‡à¦‡|à¦•à§à¦¯à¦¾à¦¨à§à¦¸à§‡à¦²|cancel|à¦…à¦°à§à¦¡à¦¾à¦°\s*à¦•à¦°à§‡à¦›à¦¿|à¦Ÿà¦¾à¦•à¦¾\s*à¦¨à¦¾à¦‡\s*à¦†à¦°\s*à¦®à§‡à¦¸à§‡à¦œ\s*à¦¦à¦¿à§Ÿà§‡à¦¨\s*à¦¨à¦¾)/i.test(clean)) {
    return null;
  }

  // 1. "X à¦˜à¦¨à§à¦Ÿà¦¾ à¦ªà¦°" / "X hour por"
  const hourMatch = clean.match(/(\d+|à¦à¦•|à¦¦à§à¦‡|à¦¤à¦¿à¦¨|à¦šà¦¾à¦°|à¦ªà¦¾à¦à¦š|à¦›à§Ÿ|à¦¸à¦¾à¦¤|à¦†à¦Ÿ|à¦¦à¦¶)\s*(?:à¦˜à¦¨à§à¦Ÿà¦¾|à¦˜à¦£à§à¦Ÿà¦¾|ghonta|hour|hr)\s*(?:à¦ªà¦°|por|bade)/i);
  if (hourMatch) {
    let hours = 2;
    const rawVal = hourMatch[1];
    const wordMap: Record<string, number> = { "à¦à¦•": 1, "à¦¦à§à¦‡": 2, "à¦¤à¦¿à¦¨": 3, "à¦šà¦¾à¦°": 4, "à¦ªà¦¾à¦à¦š": 5, "à¦›à§Ÿ": 6, "à¦¸à¦¾à¦¤": 7, "à¦†à¦Ÿ": 8, "à¦¦à¦¶": 10 };
    if (wordMap[rawVal]) hours = wordMap[rawVal];
    else if (!isNaN(parseInt(rawVal, 10))) hours = parseInt(rawVal, 10);
    hours = Math.min(24, Math.max(1, hours));
    return {
      scheduledAt: now + (hours * 60 * 60 * 1000),
      reason: `${hours} à¦˜à¦£à§à¦Ÿà¦¾ à¦ªà¦° à¦¯à§‹à¦—à¦¾à¦¯à§‹à¦— à¦•à¦°à¦¾à¦° à¦•à¦¥à¦¾ à¦¬à¦²à§‡à¦›à§‡à¦¨`,
      promiseText: text.trim()
    };
  }

  // 2. "à¦ªà¦°à§‡ à¦…à¦°à§à¦¡à¦¾à¦° à¦•à¦°à¦¬" / "à¦ªà¦°à§‡ à¦¨à¦¿à¦¬" / "à¦ªà¦°à§‡ à¦œà¦¾à¦¨à¦¾à¦šà§à¦›à¦¿" / "à¦ªà¦°à§‡ à¦•à¦¥à¦¾ à¦¬à¦²à¦¬" / "à¦ªà¦°à§‡ à¦œà¦¾à¦¨à¦¾à¦¬" -> 4 to 5 hours (4.5h)
  if (/(à¦ªà¦°à§‡\s*à¦…à¦°à§à¦¡à¦¾à¦°|à¦ªà¦°à§‡\s*à¦¨à¦¿à¦¬|à¦ªà¦°à§‡\s*à¦¨à§‡à¦¬|à¦ªà¦°à§‡\s*à¦œà¦¾à¦¨à¦¾à¦¬|à¦ªà¦°à§‡\s*à¦œà¦¾à¦¨à¦¾à¦šà§à¦›à¦¿|à¦ªà¦°à§‡\s*à¦•à¦¥à¦¾|à¦ªà¦°à§‡\s*à¦¨à¦•|pore\s*order|pore\s*nibo|pore\s*janabo|pore\s*kotha|pore\s*nok|free\s*hoye|à¦«à§à¦°à¦¿\s*à¦¹à§Ÿà§‡|à¦à¦•à¦Ÿà§\s*à¦¬à§à¦¯à¦¸à§à¦¤|busy\s*asi|à¦ªà¦°à§‡\s*à¦¬à¦²à¦¬|pore\s*bolbo)/i.test(clean)) {
    return {
      scheduledAt: now + (4.5 * 60 * 60 * 1000),
      reason: "à¦ªà¦°à§‡ à¦«à§à¦°à¦¿ à¦¹à§Ÿà§‡ à¦œà¦¾à¦¨à¦¾à¦¬à§‡à¦¨ à¦¬à¦¾ à¦…à¦°à§à¦¡à¦¾à¦° à¦•à¦°à¦¬à§‡à¦¨ à¦¬à¦²à§‡à¦›à§‡à¦¨",
      promiseText: text.trim()
    };
  }

  // 3. "à¦•à¦¾à¦² à¦¸à¦•à¦¾à¦²à§‡" / "à¦•à¦¾à¦²à¦•à§‡ à¦¸à¦•à¦¾à¦²à§‡" / "à¦¸à¦•à¦¾à¦²à§‡ à¦œà¦¾à¦¨à¦¾à¦¬" -> Next day morning 10:30 AM
  if (/(à¦•à¦¾à¦²\s*à¦¸à¦•à¦¾à¦²à§‡|à¦•à¦¾à¦²à¦•à§‡\s*à¦¸à¦•à¦¾à¦²à§‡|à¦†à¦—à¦¾à¦®à§€à¦•à¦¾à¦²\s*à¦¸à¦•à¦¾à¦²à§‡|à¦¸à¦•à¦¾à¦²à§‡\s*à¦œà¦¾à¦¨à¦¾à¦¬|à¦¸à¦•à¦¾à¦²à§‡\s*à¦…à¦°à§à¦¡à¦¾à¦°|kal\s*sokale|kalke\s*sokale|sokale\s*janabo)/i.test(clean)) {
    const nextMorning = new Date();
    nextMorning.setDate(nextMorning.getDate() + 1);
    nextMorning.setHours(10, 30, 0, 0);
    return {
      scheduledAt: nextMorning.getTime(),
      reason: "à¦•à¦¾à¦² à¦¸à¦•à¦¾à¦²à§‡ à¦…à¦°à§à¦¡à¦¾à¦° à¦•à¦¨à¦«à¦¾à¦°à§à¦® à¦•à¦°à¦¬à§‡à¦¨ à¦¬à¦²à§‡à¦›à§‡à¦¨",
      promiseText: text.trim()
    };
  }

  // 4. "à¦•à¦¾à¦² à¦¬à¦¿à¦•à§‡à¦²à§‡" / "à¦•à¦¾à¦² à¦¦à§à¦ªà§à¦°à§‡" / "à¦•à¦¾à¦² à¦°à¦¾à¦¤à§‡" / "à¦•à¦¾à¦²à¦•à§‡" / "à¦•à¦¾à¦² à¦œà¦¾à¦¨à¦¾à¦¬" -> Next day afternoon/evening
  if (/(à¦•à¦¾à¦²\s*à¦¬à¦¿à¦•à§‡à¦²à§‡|à¦•à¦¾à¦²\s*à¦¦à§à¦ªà§à¦°à§‡|à¦•à¦¾à¦²\s*à¦°à¦¾à¦¤à§‡|à¦•à¦¾à¦²à¦•à§‡\s*à¦œà¦¾à¦¨à¦¾à¦¬|à¦•à¦¾à¦²\s*à¦…à¦°à§à¦¡à¦¾à¦°|kalke\s*order|kal\s*janabo|kalke\s*janabo)/i.test(clean)) {
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    if (/à¦°à¦¾à¦¤à§‡|rate/i.test(clean)) nextDay.setHours(20, 30, 0, 0);
    else nextDay.setHours(15, 0, 0, 0);
    return {
      scheduledAt: nextDay.getTime(),
      reason: "à¦•à¦¾à¦²à¦•à§‡ à¦¯à§‹à¦—à¦¾à¦¯à§‹à¦— à¦•à¦°à¦¬à§‡à¦¨ à¦¬à¦²à§‡à¦›à§‡à¦¨",
      promiseText: text.trim()
    };
  }

  // 5. "à§¨ à¦¦à¦¿à¦¨ à¦ªà¦°" / "à¦ªà¦°à¦¶à§" / "à¦ªà¦°à¦¶à§ à¦¦à¦¿à¦¨" -> 48 hours later
  if (/(à§¨\s*à¦¦à¦¿à¦¨\s*à¦ªà¦°|2\s*din\s*por|dui\s*din\s*por|à¦¦à§à¦‡\s*à¦¦à¦¿à¦¨\s*à¦ªà¦°|à¦ªà¦°à¦¶à§|porshu)/i.test(clean)) {
    return {
      scheduledAt: now + (48 * 60 * 60 * 1000),
      reason: "à§¨ à¦¦à¦¿à¦¨ à¦ªà¦° à¦¯à§‹à¦—à¦¾à¦¯à§‹à¦— à¦•à¦°à¦¬à§‡à¦¨ à¦¬à¦²à§‡à¦›à§‡à¦¨",
      promiseText: text.trim()
    };
  }

  // 6. "à§© à¦¦à¦¿à¦¨ à¦ªà¦°" / "à¦•à§Ÿà§‡à¦• à¦¦à¦¿à¦¨ à¦ªà¦°" -> 72 hours later
  if (/(à§©\s*à¦¦à¦¿à¦¨\s*à¦ªà¦°|3\s*din\s*por|tin\s*din\s*por|à¦¤à¦¿à¦¨\s*à¦¦à¦¿à¦¨\s*à¦ªà¦°|à¦•à§Ÿà§‡à¦•\s*à¦¦à¦¿à¦¨\s*à¦ªà¦°|koyek\s*din\s*por)/i.test(clean)) {
    return {
      scheduledAt: now + (72 * 60 * 60 * 1000),
      reason: "à¦•à§Ÿà§‡à¦• à¦¦à¦¿à¦¨ à¦ªà¦° à¦…à¦°à§à¦¡à¦¾à¦° à¦•à¦°à¦¤à§‡ à¦šà§‡à§Ÿà§‡à¦›à§‡à¦¨",
      promiseText: text.trim()
    };
  }

  // 7. "à¦¬à§‡à¦¤à¦¨ à¦ªà§‡à¦²à§‡" / "à§§ à¦¤à¦¾à¦°à¦¿à¦–à§‡" / "à§§à§¦ à¦¤à¦¾à¦°à¦¿à¦–à§‡" / "à¦®à¦¾à¦¸ à¦¶à§‡à¦·à§‡"
  if (/(à¦¬à§‡à¦¤à¦¨\s*à¦ªà§‡à¦²à§‡|à¦¬à§‡à¦¤à¦¨\s*à¦ªà¦¾à¦¬|salary\s*peye|à¦®à¦¾à¦¸\s*à¦¶à§‡à¦·à§‡|à§§\s*à¦¤à¦¾à¦°à¦¿à¦–à§‡|1\s*tarikh|à§§à§¦\s*à¦¤à¦¾à¦°à¦¿à¦–à§‡|10\s*tarikh)/i.test(clean)) {
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
      reason: "à¦¬à§‡à¦¤à¦¨ à¦ªà§‡à¦²à§‡ à¦¬à¦¾ à¦¨à¦¿à¦°à§ à¦¦à¦¿à¦·à§ à¦Ÿ à¦¤à¦¾à¦°à¦¿à¦–à§‡ à¦…à¦°à§ à¦¡à¦¾à¦° à¦•à¦°à¦¬à§‡à¦¨ à¦¬à¦²à§‡à¦›à§‡à¦¨",
      promiseText: text.trim()
    };
  }

  return null;
}

export function extractCustomerFacts(senderId: string, text: string, senderName?: string): CustomerProfile {
  const profile = getCustomerProfile(senderId, senderName);
  if (!text) return profile;

  profile.followUpCount = (profile.followUpCount || 0) + 1;
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
  } else if (/(à¦¨à¦¿à¦¤à§‡\s*à¦šà¦¾à¦‡|à¦…à¦°à§à¦¡à¦¾à¦°\s*à¦•à¦°à¦¬|à¦ à¦¿à¦•à¦¾à¦¨à¦¾|à¦¨à¦¾à¦®à§à¦¬à¦¾à¦°|à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾à¦°)/i.test(clean) && !/(à¦ªà¦°à§‡|à¦•à¦¾à¦²)/i.test(clean)) {
    if (profile.followUpStatus === "pending") {
      profile.followUpStatus = "cancelled";
    }
  }

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
    const bDigits = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    const toBN = (s: any) => String(s).replace(/\d/g, d => bDigits[parseInt(d,10)] || d);
    const toEN = (s: any) => String(s).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
    const am = clean.match(/(?:বয়স|বয়েস|boyos|age)\s*[:=]?\s*([০-৯0-9]{2})/i) ||
               clean.match(/([০-৯0-9]{2})\s*(?:বছর|bochor|years?|yr)/i) ||
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
      profile.maritalStatus = 'অবিবাহিত';
    } else if (/বিবাহিত|bibahito|married|বিয়ে\s*করেছি|বিয়ে\s*হইছে|বিয়ে\s*হয়েছে|biye\s*korechi|সংসার|স্ত্রী|ওয়াইফ|wife|bou/i.test(clean)) {
      profile.maritalStatus = 'বিবাহিত';
    }
  }
  if (!profile.marriageDuration) {
    const mdm = clean.match(/বিয়ে\s*(?:হয়েছে|করছি|হইছে)?\s*([০-৯0-9]+)\s*(?:বছর|মাস|bochor|year|mash|month)/i) ||
                clean.match(/([০-৯0-9]+)\s*(?:বছর|মাস|bochor|year|mash)\s*(?:হলো\s*বিয়ে|ধরে\s*বিয়ে|হয়েছে\s*বিয়ে)/i);
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
      profile.bloodGroup = 'জানা নেই';
    }
  }

  // 5. DIABETES & BLOOD PRESSURE
  if (!profile.diabetes) {
    if (/(?:ড[া়য়যায়]+বে[টত]ি[সশ]|diabet|sugar)\s*(?:আছে|ধরা|আসে|positive|ase)/i.test(clean)) {
      profile.diabetes = 'ডায়াবেটিস আছে';
    } else if (/(?:ড[া়য়যায়]+বে[টত]ি[সশ]|diabet|sugar)\s*(?:নাই|নেই|নেগেটিভ|normal|nai|nei)/i.test(clean)) {
      profile.diabetes = 'ডায়াবেটিস নেই';
    }
  }
  if (!profile.bloodPressure) {
    if (/(?:হাই\s*প্রেশার|উচ্চ\s*রক্তচাপ|high\s*pressure|high\s*bp)\s*(?:আছে|ase)/i.test(clean)) {
      profile.bloodPressure = 'উচ্চ রক্তচাপ আছে';
    } else if (/(?:প্রেশার|প্রেসার|pressure)\s*(?:স্বাভাবিক|নরমাল|নেই|নাই|normal)/i.test(clean)) {
      profile.bloodPressure = 'নরমাল';
    }
  }

  // 6. PREVIOUS MEDICATION HISTORY
  if (!profile.previousMedication) {
    if (/(?:আগে|ager?)\s*(?:onek|অনেক)?\s*(?:osudh|ওষুধ|ঔষধ|ডাক্তার|তাবিজ|ওয়ান\s*টাইম|viagra|হোমিও)\s*(?:kheyechi|খাইছি|খেয়েছি|খাইছিলাম|দেখাইছি)/i.test(clean) ||
        /(?:one\s*time|ওয়ান\s*টাইম|ভায়াগ্রা|সিলডেনাফিল|ক্ষতি\s*হইছে|কাজ\s*হয়নি|কাজ\s*হয়\s*নাই)/i.test(clean)) {
      profile.previousMedication = 'আগে ওষুধ সেবনের ইতিহাস আছে';
    } else if (/(?:আগে|ager?|পূর্বে).*(?:কিছু\s*খাইনি|ওষুধ\s*খাই\s*নাই|ওষুধ\s*খাইনি|কোনো\s*ওষুধ\s*খাইনি|খাই\s*নাই|প্রথম\s*খাচ্ছি|প্রথম\s*আপনাদের)/i.test(clean)) {
      profile.previousMedication = 'পূর্বে কোনো ওষুধ সেবন করেননি (নতুন)';
    }
  }

  // 4. COMPREHENSIVE HEALTH SYMPTOMS (23 conditions)
  const symptomRules: [RegExp, string][] = [
    [/druto\s*paton|shighro\s*poton|à¦¶à§€à¦˜à§à¦°à¦ªà¦¤à¦¨|à¦¦à§à¦°à§à¦¤\s*à¦ªà¦¤à¦¨|timing\s*kom|time\s*kom|time\s*pa[yi]|à¦¬à§‡à¦¶à¦¿\s*à¦¸à¦®à§Ÿ\s*à¦¥à¦¾à¦•à§‡\s*à¦¨à¦¾/i, "à¦¦à§à¦°à§à¦¤ à¦¬à§€à¦°à§à¦¯à¦ªà¦¾à¦¤ (Premature Ejaculation)"],
    [/rokto\s*chalon|shokto\s*hoy\s*na|daray\s*na|naram|shithil|à¦¶à¦•à§à¦¤à¦¿\s*à¦ªà¦¾à¦‡\s*à¦¨à¦¾|à¦¦à¦¾à¦à§œà¦¾à§Ÿ\s*à¦¨à¦¾|à¦¨à¦°à¦®\s*à¦¹à§Ÿà§‡\s*à¦¥à¦¾à¦•à§‡|à¦‰à¦¤à§à¦¥à¦¾à¦¨/i, "à¦‰à¦¤à§à¦¥à¦¾à¦¨à¦œà¦¨à¦¿à¦¤ à¦¦à§à¦°à§à¦¬à¦²à¦¤à¦¾ (Erectile Dysfunction)"],
    [/patla\s*birjo|birjo\s*patla|à¦¬à§€à¦°à§à¦¯\s*à¦ªà¦¾à¦¤à¦²à¦¾|pani\s*moto|à¦ªà¦¾à¦¤à¦²à¦¾\s*à¦ªà¦¾à¦¨à¦¿|à¦¬à§€à¦°à§à¦¯\s*à¦˜à¦¨|semen\s*thin/i, "à¦¬à§€à¦°à§à¦¯ à¦ªà¦¾à¦¤à¦²à¦¾ à¦“ à¦¶à§à¦•à§à¦°à¦¾à¦£à§à¦° à¦˜à¦¾à¦Ÿà¦¤à¦¿ (Low Semen Density)"],
    [/hater\s*kaj|hothat\s*kore|hastomaithun|à¦¹à¦¸à§à¦¤à¦®à§ˆà¦¥à§à¦¨|à¦¹à¦¾à¦¤\s*à¦®à¦¾à¦°|hater\s*obves|khoti\s*koresi/i, "à¦…à¦¤à¦¿à¦°à¦¿à¦•à§à¦¤ à¦¹à¦¸à§à¦¤à¦®à§ˆà¦¥à§à¦¨à§‡à¦° à¦•à§à¦·à¦¤à¦¿ (Masturbation Damage)"],
    [/lingo\s*choto|chikon|bata|à¦¬à§‡à¦à¦•à§‡\s*à¦—à§‡à¦›à§‡|à¦›à§‹à¦Ÿ\s*à¦¹à§Ÿà§‡|à¦†à¦•à¦¾à¦°\s*à¦›à§‹à¦Ÿ|à¦šà¦¿à¦•à¦¨\s*à¦¹à§Ÿà§‡/i, "à¦²à¦¿à¦™à§à¦—à§‡à¦° à¦¶à¦¿à¦¥à¦¿à¦²à¦¤à¦¾ à¦“ à¦¸à¦‚à¦•à§‹à¦šà¦¨ (Penile Tissue Shrinkage)"],
    [/ghumer\s*moddhe|shopnodosh|à¦¸à§à¦¬à¦ªà§à¦¨à¦¦à§‹à¦·|nightfall|ratre\s*pore\s*jay/i, "à¦…à¦¤à¦¿à¦°à¦¿à¦•à§à¦¤ à¦¸à§à¦¬à¦ªà§à¦¨à¦¦à§‹à¦· (Frequent Nightfall)"],
    [/prosrab|peshab|jwalapora|jola|à¦ªà§à¦°à¦¸à§à¦°à¦¾à¦¬|à¦ªà§‡à¦¶à¦¾à¦¬à§‡\s*à¦œà§à¦¬à¦¾à¦²à¦¾à¦ªà§‹à§œà¦¾|khoy\s*rog|à¦•à§à¦·à§Ÿà¦°à§‹à¦—/i, "à¦ªà§à¦°à¦¸à§à¦°à¦¾à¦¬à§‡ à¦œà§à¦¬à¦¾à¦²à¦¾à¦ªà§‹à§œà¦¾ à¦“ à¦•à§à¦·à§Ÿà¦°à§‹à¦— (Urine Irritation)"],
    [/mon\s*bhalo\s*nei|agroho\s*nei|icchye\s*kore\s*na|à¦‰à¦¤à§à¦¤à§‡à¦œà¦¨à¦¾\s*à¦¨à§‡à¦‡|à¦®à§à¦¡\s*à¦¨à§‡à¦‡|desire\s*low/i, "à¦¯à§Œà¦¨ à¦†à¦•à¦¾à¦™à§à¦•à§à¦·à¦¾à¦° à¦˜à¦¾à¦Ÿà¦¤à¦¿ (Low Libido)"],
    [/sorir\s*durbol|shorir\s*durbol|durbolota|à¦¦à§à¦°à§à¦¬à¦²à¦¤à¦¾|shorir\s*khape|clash\s*lagar|energy\s*nei/i, "à¦¶à¦¾à¦°à§€à¦°à¦¿à¦• à¦¦à§à¦°à§à¦¬à¦²à¦¤à¦¾ à¦“ à¦•à§à¦²à¦¾à¦¨à§à¦¤à¦¿ (General Physical Fatigue)"],
    [/komor\s*betha|komor\s*batha|merudondo|à¦•à§‹à¦®à¦°\s*à¦¬à§à¦¯à¦¥à¦¾|mà¦¾à¦œà¦¾\s*à¦¬à§à¦¯à¦¥à¦¾|back\s*pain/i, "à¦•à§‹à¦®à¦° à¦“ à¦¸à§à¦¨à¦¾à§Ÿà§à¦¬à¦¿à¦• à¦¬à§à¦¯à¦¥à¦¾ (Lower Back / Nerve Pain)"],
    [/diabetes|diabetic|shugar|à¦¡à¦¾à¦¯à¦¼à¦¾à¦¬à§‡à¦Ÿà¦¿à¦¸|à¦¸à§à¦—à¦¾à¦°/i, "à¦¡à¦¾à¦¯à¦¼à¦¾à¦¬à§‡à¦Ÿà¦¿à¦¸à¦œà¦¨à¦¿à¦¤ à¦¦à§à¦°à§à¦¬à¦²à¦¤à¦¾ (Diabetic Sexual Weakness)"],
    [/gastric|gas|acidity|à¦—à§à¦¯à¦¾à¦¸|à¦—à§à¦¯à¦¾à¦¸à§à¦Ÿà§à¦°à¦¿à¦•|buk\s*jola/i, "à¦—à§à¦¯à¦¾à¦¸à§à¦Ÿà§à¦°à¦¿à¦•à§‡à¦° à¦¸à¦®à¦¸à§à¦¯à¦¾ (Gastric/Acidity)"],
    [/pre-ejaculation|pani\s*ber\s*hoy|kotha\s*bollei\s*pani|à¦‰à¦¤à§à¦¤à§‡à¦œà¦¿à¦¤\s*à¦¹à¦²à§‡à¦‡\s*à¦ªà¦¾à¦¨à¦¿/i, "à¦‰à¦¤à§à¦¤à§‡à¦œà¦¨à¦¾à¦¯à¦¼ à¦†à¦—à¦¾à¦® à¦ªà¦¾à¦¨à¦¿ à¦†à¦¸à¦¾à¦° à¦¸à¦®à¦¸à§à¦¯à¦¾ (Pre-cum Discharge)"],
    [/second\s*bar|ditio\s*bar|2nd\s*time|à¦†à¦¬à¦¾à¦°\s*à¦•à¦°à¦¤à§‡\s*à¦ªà¦¾à¦°à¦¿\s*à¦¨à¦¾|à¦à¦•à¦¬à¦¾à¦°à§‡à¦°\s*à¦ªà¦°/i, "à¦ªà§à¦¨à¦°à¦¾à§Ÿ à¦¸à¦•à§à¦·à¦®à¦¤à¦¾ à¦…à¦°à§à¦œà¦¨à§‡ à¦…à¦•à§à¦·à¦®à¦¤à¦¾ (Inability to Re-erect)"],
    [/chinta|tension|depression|à¦­à§Ÿ\s*à¦²à¦¾à¦—à§‡|à¦‰à¦¦à§à¦¬à§‡à¦—|à¦®à¦¾à¦¨à¦¸à¦¿à¦•\s*à¦šà¦¾à¦ª/i, "à¦®à¦¾à¦¨à¦¸à¦¿à¦• à¦šà¦¾à¦ª à¦“ à¦­à§€à¦¤à¦¿ (Psychological Anxiety)"],
    [/testosterone|hormone|à¦¹à¦°à¦®à§‹à¦¨\s*à¦•à¦®|à¦Ÿà§‡à¦¸à§à¦Ÿà§‹à¦¸à§à¦Ÿà§‡à¦°à¦¨/i, "à¦¹à¦°à¦®à§‹à¦¨ à¦¬à¦¾ à¦Ÿà§‡à¦¸à§à¦Ÿà§‹à¦¸à§à¦Ÿà§‡à¦°à¦¨ à¦˜à¦¾à¦Ÿà¦¤à¦¿ (Low Testosterone)"],
    [/baccha\s*hochhe\s*na|infertility|shontan|à¦¸à¦¨à§à¦¤à¦¾à¦¨\s*à¦¹à¦šà§à¦›à§‡\s*à¦¨à¦¾|à¦¨à¦¿à¦ƒà¦¸à¦¨à§à¦¤à¦¾à¦¨/i, "à¦¸à¦¨à§à¦¤à¦¾à¦¨ à¦§à¦¾à¦°à¦£à§‡ à¦œà¦Ÿà¦¿à¦²à¦¤à¦¾ (Infertility Concern)"],
    [/rattire\s*ghumer\s*shomossha|insomnia|à¦˜à§à¦®\s*à¦¹à§Ÿ\s*à¦¨à¦¾|à¦…à¦¨à¦¿à¦¦à§à¦°à¦¾/i, "à¦…à¦¨à¦¿à¦¦à§à¦°à¦¾ à¦“ à¦…à¦¸à§à¦¥à¦¿à¦°à¦¤à¦¾ (Insomnia)"],
    [/bichi\s*betha|testicle|à¦…à¦¨à§à¦¡à¦•à§‹à¦·\s*à¦¬à§à¦¯à¦¥à¦¾|à¦¬à¦¿à¦šà¦¿\s*à¦›à§‹à¦Ÿ/i, "à¦…à¦£à§à¦¡à¦•à§‹à¦·à§‡à¦° à¦¬à§à¦¯à¦¥à¦¾ à¦¬à¦¾ à¦¸à¦®à¦¸à§à¦¯à¦¾ (Testicle Pain)"],
    [/biman\s*chalao|drive\s*kori|night\s*shift|à¦°à¦¾à¦¤\s*à¦œà¦¾à¦—à¦¾/i, "à¦°à¦¾à¦¤ à¦œà¦¾à¦—à¦¾ à¦“ à¦¦à§€à¦°à§à¦˜ à¦¶à¦¿à¦«à¦Ÿà§‡à¦° à¦•à§à¦²à¦¾à¦¨à§à¦¤à¦¿ (Night Shift Exhaustion)"],
    [/bideshe\s*thaki|probashi|à¦¸à§Œà¦¦à¦¿|à¦¦à§à¦¬à¦¾à¦‡|à¦®à¦¾à¦²à¦¯à¦¼à§‡à¦¶à¦¿à¦¯à¦¼à¦¾|à¦ªà§à¦°à¦¬à¦¾à¦¸à§€/i, "à¦ªà§à¦°à¦¬à¦¾à¦¸à§€ à¦œà§€à¦¬à¦¨à§‡à¦° à¦®à¦¾à¦¨à¦¸à¦¿à¦• à¦“ à¦¶à¦¾à¦°à§€à¦°à¦¿à¦• à¦§à¦•à¦² (Expatriate Stress)"],
    [/dhompan|cigarette|shisa|à¦§à§‚à¦®à¦ªà¦¾à¦¨\s*à¦•à¦°à¦¿/i, "à¦§à§‚à¦®à¦ªà¦¾à¦¨à¦œà¦¨à¦¿à¦¤ à¦°à¦•à§à¦¤à¦¨à¦¾à¦²à§€à¦° à¦¸à¦‚à¦•à§‹à¦šà¦¨ (Smoking-induced Constriction)"],
    [/osudh\s*kheye|viagra|one\s*time|à¦“à¦¯à¦¼à¦¾à¦¨\s*à¦Ÿà¦¾à¦‡à¦®|à¦•à§‡à¦®à¦¿à¦•à§à¦¯à¦¾à¦²à§‡à¦°\s*à¦•à§à¦·à¦¤à¦¿/i, "à¦“à¦¯à¦¼à¦¾à¦¨-à¦Ÿà¦¾à¦‡à¦® à¦“à¦·à§à¦§à§‡à¦° à¦ªà¦¾à¦°à§à¦¶à§à¦¬à¦ªà§à¦°à¦¤à¦¿à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾ (One-Time Chemical Damage)"]
  ];

  for (const [pattern, label] of symptomRules) {
    if (pattern.test(clean) && !profile.symptoms.includes(label)) {
      profile.symptoms.push(label);
    }
  }

  // 5. DURATION
  if (!profile.duration) {
    const durMatch = clean.match(/(\d+|[à¦à¦•|à¦¦à§à¦‡|à¦¤à¦¿à¦¨|à¦šà¦¾à¦°|à¦ªà¦¾à¦à¦š|à¦›à¦¯à¦¼|à¦¸à¦¾à¦¤|à¦†à¦Ÿ|à¦¦à¦¶]+)\s*(?:bochor|mas|days?|à¦¬à¦›à¦°|à¦®à¦¾à¦¸|à¦¦à¦¿à¦¨|year|month)/i);
    if (durMatch) profile.duration = durMatch[0].trim();
    else if (/onk\s*din|onek\s*din|à¦…à¦¨à§‡à¦•\s*à¦¦à¦¿à¦¨|one\s*year|2\s*year|3\s*year|kotodin/i.test(clean)) {
      const dm = clean.match(/(?:pray|onk|onek|à¦ªà§à¦°à¦¾à¦¯à¦¼)?\s*([0-9]+\s*(?:bochor|mas|year|month|à¦¬à¦›à¦°|à¦®à¦¾à¦¸))/i);
      if (dm) profile.duration = dm[1].trim();
    }
  }

  // 5b. TIMING / DURATION OF INTERCOURSE
  if (!profile.timing) {
    const tm = clean.match(/([০-৯0-9]+)\s*(?:মিনিট|সেকেন্ড|min|minute|sec)/i) ||
               clean.match(/(?:প্রবেশের\s*আগেই|ঢুকানোর\s*সাথেই|সাথে\s*সাথেই|১-২\s*মিনিট|১\s*মিনিট|২\s*মিনিট|time\s*kom|timing\s*kom)/i);
    if (tm) profile.timing = tm[0].trim();
  }

  // 5c. ERECTION QUALITY
  if (!profile.erectionQuality) {
    if (/(?:মাঝপথে\s*নরম|করার\s*সময়\s*নরম|ঢুকানোর\s*পর\s*নরম|হঠাৎ\s*নরম|majhpoth|naram\s*hoye\s*jay)/i.test(clean)) {
      profile.erectionQuality = "মাঝপথে নরম হয়ে যায়";
    } else if (/(?:একেবারেই\s*দাঁড়ায়\s*না|একদম\s*দাঁড়ায়\s*না|দাঁড়ায়\s*না|shokto\s*hoy\s*na|daray\s*na)/i.test(clean)) {
      profile.erectionQuality = "উত্থান হয় না (নিস্তেজ)";
    } else if (/(?:আংশিক\s*শক্ত|অল্প\s*শক্ত|পুরো\s*শক্ত\s*হয়\s*না|shithil)/i.test(clean)) {
      profile.erectionQuality = "আংশিক শক্ত (শিথিল)";
    }
  }

  // 5d. SEMEN QUALITY & PRE-CUM
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

  // 5e. SLEEP & GASTRIC
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

  // 5f. PROBASHI / EXPATRIATE
  if (!profile.probashi) {
    if (/(?:প্রবাসী|সৌদি|দুবাই|কাতার|ওমান|মালয়েশিয়া|বাহরাইন|কুয়েত|ইতালি|লন্ডন|সিঙ্গাপুর|বদেশে\s*থাকি|probashi|bideshe\s*thaki)/i.test(clean)) {
      profile.probashi = "প্রবাসী";
    } else if (/(?:দেশেই\s*থাকি|দেশে\s*আছি|বাংলাদেশেই\s*থাকি|deshe\s*asi)/i.test(clean)) {
      profile.probashi = "দেশেই আছেন";
    }
  }

  // 6. PRODUCTS DISCUSSED
  const productPatterns: [RegExp, string][] = [
    [/amber|à¦…à¦®à§à¦¬à¦°|à¦…à¦®à§à¦­à¦°/i, "AMBER Premium (à¦…à¦®à§à¦¬à¦¾à¦°)"],
    [/majum|à¦®à¦¾à¦œà§à¦¨|salajeet|à¦«à¦¾à¦²à§‡à¦œà¦¿à¦¦|à¦¸à¦¾à¦²à¦¾à¦œà¦¿à§Ž/i, "à¦®à¦¾à¦œà§à¦¨ à¦“ à¦¸à¦¾à¦²à¦¾à¦œà¦¿à§Ž à¦•à§‹à¦°à§à¦¸"],
    [/kastoori|à¦•à¦¸à§à¦¤à§à¦°à§€|à¦—à§‹à¦²à§à¦¡|gold/i, "à¦•à¦¸à§à¦¤à§à¦°à§€ à¦—à§‹à¦²à§à¦¡ à¦¸à§à¦ªà§‡à¦¶à¦¾à¦²"],
    [/oil|tel|à¦®à¦¾à¦²à¦¿à¦¶|à¦®à§à¦¯à¦¾à¦¸à§‡à¦œ|à¦Ÿà§à¦°à¦¿à¦Ÿà¦®à§‡à¦¨à§à¦Ÿ\s*à¦¤à§‡à¦²/i, "à¦¹à¦¾à¦°à§à¦¬à¦¾à¦² à¦®à§à¦¯à¦¾à¦¸à§‡à¦œ à¦…à§Ÿà§‡à¦²"],
    [/combo|à¦«à§à¦²\s*à¦•à§‹à¦°à§à¦¸|à¦•à¦®à§à¦¬à§‹|à¦¸à¦®à§à¦ªà§‚à¦°à§à¦£\s*à¦•à§‹à¦°à§à¦¸/i, "à§§ à¦®à¦¾à¦¸à§‡à¦° à¦¸à§à¦ªà§‡à¦¶à¦¾à¦² à¦•à¦®à§à¦¬à§‹ à¦•à§‹à¦°à§à¦¸"],
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
  const hasOrderKeywords = /(?:confirm|order|à¦…à¦°à§à¦¡à¦¾à¦°|à¦ªà¦¾à¦ à¦¿à§Ÿà§‡\s*à¦¦à¦¿à¦¨|à¦ªà¦¾à¦ à¦¾à¦¨|à¦¨à¦¿à¦¬|à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾à¦°|à¦ à¦¿à¦•à¦¾à¦¨à¦¾\s*à¦¦à¦¿à¦¸à¦¿|à¦¬à§à¦•\s*à¦•à¦°à§à¦¨)/i.test(clean);
  const hasFullDetails = Boolean(profile.phone) && /(?:à¦œà§‡à¦²à¦¾|à¦¥à¦¾à¦¨à¦¾|à¦—à§à¦°à¦¾à¦®|à¦°à§‹à¦¡|à¦¢à¦¾à¦•à¦¾|à¦šà¦Ÿà§à¦Ÿà¦—à§à¦°à¦¾à¦®|à¦¬à¦¾à¦¸à¦¾|à¦¬à¦¾à§œà¦¿|à¦ à¦¿à¦•à¦¾à¦¨à¦¾)/i.test(clean);
  if ((hasOrderKeywords && Boolean(profile.phone)) || hasFullDetails) {
    profile.orderStatus = "order_placed";
    const orderSnapshot = {
      date: new Date().toISOString(),
      product: profile.productDiscussed || "Soul Mate (খাঁটি কস্তুরী ফর্মুলা)",
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
    else if (/driver|à¦—à¦¾à§œà¦¿\s*à¦šà¦¾à¦²à¦¾à¦‡/i.test(clean))                    profile.profession = "Driver";
    else if (/teacher|shikkhok|à¦¶à¦¿à¦•à§à¦·à¦•/i.test(clean))                profile.profession = "Teacher";
    else if (/business|byapari|à¦¬à§à¦¯à¦¬à¦¸à¦¾|à¦¦à§‹à¦•à¦¾à¦¨/i.test(clean))          profile.profession = "Business";
    else if (/garments|à¦—à¦¾à¦°à§à¦®à§‡à¦¨à§à¦Ÿà¦¸/i.test(clean))                    profile.profession = "Garments";
    else if (/probashi|malaysia|saudi|dubai|abroad|à¦ªà§à¦°à¦¬à¦¾à¦¸à§€/i.test(clean)) profile.profession = "Probashi";
    else if (/student|à¦›à¦¾à¦¤à§à¦°|à¦ªà§œà¦¾à¦¶à§‹à¦¨à¦¾/i.test(clean))                  profile.profession = "Student";
    else if (/service|chakri|govt|à¦šà¦¾à¦•à¦°à¦¿/i.test(clean))              profile.profession = "Service";
  }

  // 11. BUDGET
  const bm = clean.match(/budget\s*([0-9,]+)/i);
  if (bm) profile.budgetMentioned.push(bm[1] + " taka");

  // 12. EXTRA FACTS
  if (/aage\s*kheye|before\s*use|try\s*koresi|onek\s*osud/i.test(clean) && !profile.extraFacts.includes("tried treatment before")) profile.extraFacts.push("tried treatment before");
  if (/taratari|urgent|joruri|asap/i.test(clean) && !profile.extraFacts.includes("wants urgent solution")) profile.extraFacts.push("wants urgent solution");
  if (/dam\s*beshi|costly|sosta|kom\s*dame/i.test(clean) && !profile.extraFacts.includes("price sensitive")) profile.extraFacts.push("price sensitive");
  if (/abar\s*nite|reorder|à¦†à¦¬à¦¾à¦°\s*à¦¨à¦¿à¦¬/i.test(clean) && !profile.extraFacts.includes("wants repeat order")) {
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
      const summary = oldest.slice(-5).map(m => `${m.role === "user" ? "à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦°" : "à¦¹à¦¾à¦•à¦¿à¦®"}: ${m.text.substring(0, 80)}`).join(" | ");
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
    "Name: " + (profile.name || fallbackName || "à¦­à¦¾à¦‡à¦¯à¦¼à¦¾"),
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
    "2. CUSTOMER NAME RECALL: The customer's real name is: '" + (profile.name || fallbackName || "") + "'. If the customer asks 'amar name ki?', 'à¦†à¦®à¦¾à¦° à¦¨à¦¾à¦® à¦•à¦¿ à¦œà¦¾à¦¨à§‹?' -> State their real name with full confidence: 'à¦œà¦¿ à¦­à¦¾à¦‡à§Ÿà¦¾, à¦†à¦ªà¦¨à¦¾à¦° à¦¨à¦¾à¦® " + (profile.name || fallbackName || "à¦­à¦¾à¦‡à¦¯à¦¼à¦¾") + "à¥¤'",
    "3. PERSONAL CONTINUITY: Talk as their dedicated personal doctor who remembers their entire medical history and previous chats.",
    "4. AUTHENTIC BANGLADESHI TONE: Speak in natural, respectful Bangladeshi male tone ('à¦œà¦¿ à¦­à¦¾à¦‡à§Ÿà¦¾', 'à¦†à¦¸à¦¸à¦¾à¦²à¦¾à¦®à§ à¦†à¦²à¦¾à¦‡à¦•à§à¦®'). NEVER use Kolkata or Indian Bengali words ('à¦œà¦²', 'à¦¦à¦¾à¦¦à¦¾')."
  );

  return parts.join("\n");
}

export function getRecentChatHistory(senderId: string, limit: number = 15): string[] {
  const profile = getCustomerProfile(senderId);
  if (!profile.chatLog || profile.chatLog.length === 0) return [];
  return profile.chatLog.slice(-limit).map((entry) => {
    const author = entry.role === "user" ? (profile.name || "Customer") : "à¦¹à¦¾à¦•à¦¿à¦® à¦°à¦¿à¦¯à¦¼à¦¾à¦œà§à¦² à¦•à¦°à¦¿à¦® (Doctor)";
    const tag = entry.isVoice ? " [Voice Note]" : "";
    return `${author}${tag}: "${entry.text}"`;
  });
}

export function getEligibleFollowUpCandidates(minHours: number = 48): FollowUpCandidate[] {
  loadMemory();
  const now = Date.now();
  const candidates: FollowUpCandidate[] = [];

  for (const profile of memoryCache.values()) {
    if (profile.orderStatus === "order_placed" || profile.orderStatus === "delivered") continue;
    const hasSymptoms = profile.symptoms && profile.symptoms.length > 0;
    const hasProduct = !!profile.productDiscussed;
    const hasOrderInterest = profile.orderStatus === "interested" || profile.followUpStatus === "pending" || (profile.chatLog && profile.chatLog.length >= 2);
    if (!hasSymptoms && !hasProduct && !hasOrderInterest) continue;

    const count = profile.followUpCount || 0;
    if (count >= 3) continue;

    const msSinceContact = now - (profile.lastContact || profile.firstContact || now);
    const hoursSinceContact = msSinceContact / (1000 * 60 * 60);
    const daysSinceLastContact = Math.max(1, Math.floor(hoursSinceContact / 24));

    if (hoursSinceContact < minHours) continue;

    if (profile.lastFollowUpTime) {
      const hoursSinceLastFollowUp = (now - profile.lastFollowUpTime) / (1000 * 60 * 60);
      if (hoursSinceLastFollowUp < 48) continue;
    }

    const lastMsg = profile.chatLog && profile.chatLog.length > 0 ? profile.chatLog[profile.chatLog.length - 1] : null;
    if (lastMsg && lastMsg.role === "user" && (now - lastMsg.time) < 30 * 60 * 1000) {
      continue;
    }

    candidates.push({
      profile,
      stage: count + 1,
      daysSinceLastContact,
    });
  }

  return candidates;
}

export function generateFallbackCaringFollowUp(profile: CustomerProfile): string {
  const name = (profile.name && !["Customer", "কাস্টমার", "ভাইয়া"].includes(profile.name))
    ? profile.name.split(" ")[0]
    : "ভাইয়া";

  let symptom = "শারীরিক সমস্যা ও দুর্বলতা";
  if (profile.symptoms && profile.symptoms.length > 0) {
    symptom = profile.symptoms.slice(0, 2).map(s => s.split(" (")[0]).join(" ও ");
  } else if (profile.productDiscussed) {
    symptom = `${profile.productDiscussed}-এর কোর্স ও স্বাস্থ্য পরামর্শ`;
  }

  const templates = [
    `আসসালামু আলাইকুম ${name} ভাইয়া, কেমন আছেন? গত পরশু আপনার সাথে ${symptom}-এর বিষয়টি নিয়ে কথা হয়েছিল। আপনার কথাটি মনে পড়ায় একজন শুভাকাঙ্ক্ষী হিসেবে খোঁজ নিতে নক দিলাম—এখন আপনার শরীর কেমন আছে? এই ধরণের সমস্যা পুষে রাখলে নার্ভ দিনে দিনে আরও দুর্বল হয়ে পড়ে। আপনার সুস্থতায় কোনো সঠিক পরামর্শ বা সহযোগিতা লাগলে নির্দ্বিধায় জানাবেন ভাইয়া, পাশে আছি।`,
    `${name} ভাইয়া, আশা করি ভালো আছেন। আপনার ${symptom}-এর কথা মনে পড়ায় ভাবলাম একটু খোঁজ নিই। এখন কি আগের চেয়ে একটু ভালো অনুভব করছেন? শরীরটা সবার আগে ভাইয়া। আপনার কোনো পরামর্শ বা সহযোগিতার প্রয়োজন হলে আমাকে জানাবেন, ইনশাআল্লাহ পাশে পাবেন।`,
    `আসসালামু আলাইকুম ${name} ভাইয়া। পরশু আপনার শারীরিক সমস্যার কথা শুনেছিলাম, তাই শুভাকাঙ্ক্ষী হিসেবে আপনার শারীরিক অবস্থার খোঁজ নিতে মেসেজ দিলাম। এখন কেমন বোধ করছেন ভাইয়া? আপনার এই বিষয়ে কোনো সঠিক পরামর্শ বা সহযোগিতার প্রয়োজন হলে জানাবেন। সুস্থ থাকুন ভাইয়া, আল্লাহ আপনাকে সুস্থ রাখুন।`
  ];

  return templates[Math.floor(Math.random() * templates.length)];
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
  doctorName: string = "হাকীম মো: আব্দুল করিম",
  pharmacyName: string = "গ্রীন হেলথ ইউনানী ফার্মেসী"
): string {
  const { profile, stage, daysSinceLastContact } = candidate;

  let symptomStr = "";
  if (profile.symptoms && profile.symptoms.length > 0) {
    symptomStr = profile.symptoms.map(s => s.split(" (")[0]).join(" ও ");
  } else if (profile.productDiscussed) {
    symptomStr = `${profile.productDiscussed}-এর বিষয়ে ও শারীরিক সুস্থতার পরামর্শ`;
  } else {
    const recentMsgs = (profile.chatLog || []).filter(m => m.role === "user").slice(-3).map(m => m.text).join(" ");
    if (/durbol|দুর্বল|naram|নরম|daray\s*na/i.test(recentMsgs)) symptomStr = "গোপনাঙ্গের দুর্বলতা ও শিথিলতা";
    else if (/druto|দ্রুত|time\s*kom|টাইমিং/i.test(recentMsgs)) symptomStr = "দ্রুত বীর্যপাত ও টাইমিং সমস্যা";
    else if (/patla|পাতলা|birjo/i.test(recentMsgs)) symptomStr = "বীর্য পাতলা ও শুক্রাণুর সমস্যা";
    else symptomStr = "শারীরিক সুস্থতা ও পরামর্শ";
  }

  const patientFirstName = (profile.name && !["Customer", "কাস্টমার", "ভাইয়া"].includes(profile.name))
    ? profile.name.split(" ")[0]
    : "ভাইয়া";

  const lastUserMsg = (profile.chatLog || []).filter(m => m.role === "user").slice(-1)[0]?.text || "";

  return `
You are ${doctorName}, Category-A Registered Unani Physician at ${pharmacyName}, Alikadam, Bandarban.
You are personally following up with a patient who consulted you 2 days ago (${daysSinceLastContact} days ago) regarding their health concerns, but didn't conclude the discussion. You remembered them naturally because you genuinely care about their healing.

PATIENT'S MEDICAL DOSSIER:
- Patient Name: ${profile.name || "ভাইয়া"} (call them: ${patientFirstName})
- Health Issues Discussed: ${symptomStr}
- Age: ${profile.age ? profile.age + " বছর" : "জানা যায়নি"}
- Marital Status: ${profile.maritalStatus || "জানা যায়নি"}
- Medicine Inquired: ${profile.productDiscussed || "কস্তুরী পাউডার"}
- Patient's last remark: "${lastUserMsg || "পরামর্শ নিয়েছিলেন"}"
- Follow-up Interval: 2 days after last contact

CORE OBJECTIVE (SINCERE EMPATHY & DESIRE TO HELP — STRICTLY ZERO SALES PRESSURE):
The patient MUST feel 100% that you reached out as their caring doctor and well-wishing elder brother to check on their well-being, NOT to sell any product.

MANDATORY RULES:
1. STRICT BAN ON SALES TALK:
   - ABSOLUTELY NEVER say: "অর্ডার করুন", "অফার চলছে", "দাম মাত্র", "বিকাশ করুন", "এখনই নিন", "পার্সেল পাঠাব", "কুরিয়ার চার্জ", "স্টক সীমিত", or any promotional phrases.
2. PERSONALIZED HEALTH CHECK-IN:
   - Start with a warm Bangladeshi brotherly greeting: "আসসালামু আলাইকুম ${patientFirstName} ভাইয়া, কেমন আছেন?"
   - Naturally recall the specific disease/symptoms they discussed (${symptomStr}): e.g. "গত পরশু আপনার সাথে ${symptomStr}-এর বিষয়টি নিয়ে কথা হয়েছিল। আপনার কথাটি মনে পড়ায় একজন শুভাকাঙ্ক্ষী হিসেবে খোঁজ নিতে নক দিলাম..."
   - Inquire about their health condition: "এখন আপনার শারীরিক অবস্থা কেমন ভাইয়া? কোনো উন্নতি হয়েছে কি?"
   - Offer gentle doctorly support: "এই ধরণের সমস্যা ফেলে রাখলে নার্ভগুলো ধীরে ধীরে আরও দুর্বল হয়ে পড়ে। আপনার সুস্থতায় কোনো সঠিক পরামর্শ বা সহযোগিতার প্রয়োজন হলে আমাকে নির্দ্বিধায় জানাবেন ভাইয়া। আমরা সবসময় পাশে আছি।"
3. FORMAT & TONE:
   - Maximum 2 to 3 short sentences.
   - Clean, natural Bangladeshi spoken Bengali.
   - Plain text only (NO markdown bolding, no emojis, no asterisks).
   - DO NOT say meta phrases like "আমি ফলোআপ করছি".

Write ONLY the Bengali message now:
`.trim();
}

export function getPendingDynamicFollowUps(): CustomerProfile[] {
  loadMemory();
  const now = Date.now();
  const candidates: CustomerProfile[] = [];

  for (const profile of memoryCache.values()) {
    if (profile.orderStatus === "order_placed" || profile.orderStatus === "delivered") continue;
    if (profile.followUpStatus !== "pending") continue;
    if (!profile.scheduledFollowUpAt) continue;

    if (profile.scheduledFollowUpAt <= now) {
      // Safety: make sure customer hasn't messaged in the last 15 minutes
      const lastMsg = profile.chatLog && profile.chatLog.length > 0 ? profile.chatLog[profile.chatLog.length - 1] : null;
      if (lastMsg && lastMsg.role === "user" && (now - lastMsg.time) < 15 * 60 * 1000) {
        profile.followUpStatus = "cancelled";
        continue;
      }
      candidates.push(profile);
    }
  }

  return candidates;
}

export function buildDynamicFollowUpPrompt(
  profile: CustomerProfile,
  doctorName: string = "à¦¹à¦¾à¦•à¦¿à¦® à¦°à¦¿à¦¯à¦¼à¦¾à¦œà§à¦² à¦•à¦°à¦¿à¦®",
  pharmacyName: string = "à¦—à§à¦°à§€à¦¨ à¦¹à§‡à¦²à¦¥ à¦‡à¦‰à¦¨à¦¾à¦¨à§€ à¦«à¦¾à¦°à§à¦®à§‡à¦¸à§€"
): string {
  const symptomStr =
    profile.symptoms && profile.symptoms.length > 0
      ? profile.symptoms.join(", ")
      : profile.productDiscussed
      ? `${profile.productDiscussed}-à¦à¦° à¦•à§‹à¦°à§à¦¸`
      : "à¦¶à¦¾à¦°à§€à¦°à¦¿à¦• à¦¸à§à¦¸à§à¦¥à¦¤à¦¾à¦° à¦ªà¦°à¦¾à¦®à¦°à§à¦¶";

  const lastCustomerWords = profile.followUpPromiseText || profile.followUpReason || "à¦•à¦¿à¦›à§à¦•à§à¦·à¦£ à¦ªà¦° à¦œà¦¾à¦¨à¦¾à¦¬à§‡à¦¨ à¦¬à¦²à§‡à¦›à¦¿à¦²à§‡à¦¨";

  return `
You are ${doctorName}, Senior Ayurvedic Hakim at ${pharmacyName}, Bangladesh.
You are personally following up with your patient:
- Patient Name: ${profile.name || "à¦­à¦¾à¦‡à¦¯à¦¼à¦¾"}
- Health Condition / Problem: ${symptomStr}
- Medicine/Course Discussed: ${profile.productDiscussed || "à¦ªà§à¦°à¦¾à¦•à§ƒà¦¤à¦¿à¦• à¦‡à¦‰à¦¨à¦¾à¦¨à§€ à¦«à¦°à§à¦®à§à¦²à¦¾"}
- What Patient Said / Promised: "${lastCustomerWords}"
- Reason for Following Up Right Now: ${profile.followUpReason || "à¦—à§à¦°à¦¾à¦¹à¦•à§‡à¦° à¦¦à§‡à¦“à§Ÿà¦¾ à¦¸à¦®à§Ÿà§‡ à¦«à¦²à§‹-à¦†à¦ª"}

TASK:
Write a warm, authentic, personal Bengali check-in message (1 to 2 sentences max) as Hakim Reajul Karim.
CRITICAL RULES:
1. ABSOLUTELY ZERO TEMPLATES or rigid formulaic sales pitches!
2. Reference naturally what the patient said (e.g. 'à¦†à¦ªà¦¨à¦¿ à¦¬à¦²à§‡à¦›à¦¿à¦²à§‡à¦¨ à¦•à¦¾à¦² à¦¸à¦•à¦¾à¦²à§‡ à¦¯à§‹à¦—à¦¾à¦¯à§‹à¦— à¦•à¦°à¦¬à§‡à¦¨' or 'à¦†à¦ªà¦¨à¦¿ à¦à¦•à¦Ÿà§ à¦«à§à¦°à¦¿ à¦¹à§Ÿà§‡ à¦œà¦¾à¦¨à¦¾à¦¬à§‡à¦¨ à¦¬à¦²à§‡à¦›à¦¿à¦²à§‡à¦¨').
3. Ask with genuine doctor's care if they are ready to confirm delivery or if they have any remaining questions about their treatment.
4. Natural respectful Bangladeshi tone (e.g. 'à¦†à¦¸à¦¸à¦¾à¦²à¦¾à¦®à§ à¦†à¦²à¦¾à¦‡à¦•à§à¦® [à¦¨à¦¾à¦®] à¦­à¦¾à¦‡à¦¯à¦¼à¦¾à¥¤ à¦¹à¦¾à¦•à¦¿à¦® à¦°à¦¿à¦¯à¦¼à¦¾à¦œà§à¦² à¦•à¦°à¦¿à¦® à¦¬à¦²à¦›à¦¿à¦²à¦¾à¦®...').
5. DO NOT use markdown bolding (no ** or #).
`.trim();
}


