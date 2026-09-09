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
  followUpCount?: number;
  lastFollowUpTime?: number;
  followUpHistory?: FollowUpRecord[];
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
      reason: "à¦¬à§‡à¦¤à¦¨ à¦ªà§‡à¦²à§‡ à¦¬à¦¾ à¦¨à¦¿à¦°à§à¦¦à¦¿à¦·à§à¦Ÿ à¦¤à¦¾à¦°à¦¿à¦–à§‡ à¦…à¦°à§à¦¡à¦¾à¦° à¦•à¦°à¦¬à§‡à¦¨ à¦¬à¦²à§‡à¦›à§‡à¦¨",
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
    const ageMatch = clean.match(/(?:age|à¦¬à¦¯à¦¼à¦¸|boys|boyos|bochor|à¦¬à¦›à¦°)\s*[:=]?\s*(\d{2})|(\d{2})\s*(?:years?|bochor|à¦¬à¦›à¦°|yr)/i);
    if (ageMatch) {
      const num = parseInt(ageMatch[1] || ageMatch[2], 10);
      if (num >= 15 && num <= 85) profile.age = String(num);
    } else {
      const directNum = clean.match(/\b(1[6-9]|[2-6]\d|7[0-5])\b/);
      if (directNum && /bochor|years?|boyos|boish|à¦¬à¦›à¦°/i.test(clean)) {
        profile.age = directNum[1];
      }
    }
  }

  // 3. MARITAL STATUS
  if (!profile.maritalStatus) {
    if (/unmarried|à¦…à¦¬à¦¿à¦¬à¦¾à¦¹à¦¿à¦¤|single|biye\s*kori\s*ni|à¦¬à¦¿à§Ÿà¦¾\s*à¦•à¦°à¦¿\s*à¦¨à¦¾à¦‡/i.test(clean)) {
      profile.maritalStatus = "à¦…à¦¬à¦¿à¦¬à¦¾à¦¹à¦¿à¦¤ (Unmarried)";
    } else if (/\bmarried\b|à¦¬à¦¿à¦¬à¦¾à¦¹à¦¿à¦¤|biye\s*korechi|à¦¸à¦‚à¦¸à¦¾à¦°|à¦¸à§à¦¤à§à¦°à§€|à¦“à¦¯à¦¼à¦¾à¦‡à¦«|wife|bou/i.test(clean)) {
      profile.maritalStatus = "à¦¬à¦¿à¦¬à¦¾à¦¹à¦¿à¦¤ (Married)";
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
  doctorName: string = "à¦¹à¦¾à¦•à¦¿à¦® à¦°à¦¿à¦¯à¦¼à¦¾à¦œà§à¦² à¦•à¦°à¦¿à¦®",
  pharmacyName: string = "à¦—à§à¦°à§€à¦¨ à¦¹à§‡à¦²à¦¥ à¦‡à¦‰à¦¨à¦¾à¦¨à§€ à¦«à¦¾à¦°à§à¦®à§‡à¦¸à§€"
): string {
  const { profile, stage, daysSinceLastContact } = candidate;

  const symptomStr =
    profile.symptoms && profile.symptoms.length > 0
      ? profile.symptoms.join(", ")
      : profile.productDiscussed
      ? `${profile.productDiscussed}-à¦à¦° à¦•à§‹à¦°à§à¦¸ à¦¸à¦®à§à¦ªà¦°à§à¦•à¦¿à¦¤ à¦ªà¦°à¦¾à¦®à¦°à§à¦¶`
      : "à¦¶à¦¾à¦°à§€à¦°à¦¿à¦• à¦¸à§à¦¸à§à¦¥à¦¤à¦¾à¦° à¦ªà¦°à¦¾à¦®à¦°à§à¦¶";

  const patientFirstName = (profile.name || "à¦­à¦¾à¦‡à¦¯à¦¼à¦¾").split(" ")[0];

  return `
You are ${doctorName} (à¦¹à¦¾à¦•à¦¿à¦® à¦°à¦¿à¦¯à¦¼à¦¾à¦œà§à¦² à¦•à¦°à¦¿à¦®), Senior Ayurvedic Hakim at ${pharmacyName}, Bangladesh.
You are personally reaching out to a patient who consulted you ${daysSinceLastContact} days ago.
PATIENT FILE:
- Name: ${profile.name || "à¦­à¦¾à¦‡à¦¯à¦¼à¦¾"}
- Age: ${profile.age ? profile.age + " à¦¬à¦›à¦°" : "unknown"}
- Problem: ${symptomStr}
- Product: ${profile.productDiscussed || "Unani herbal formula"}

RULES:
1. Zero marketing / NO templates.
2. Natural Bangladeshi caring brotherly doctor tone.
3. Max 2-3 sentences.
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


