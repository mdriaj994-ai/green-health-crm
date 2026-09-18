import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "medicine_master_complete_db.json");
const EDITS_FILE = path.join(DATA_DIR, "custom_user_edits.json");

export interface ProductEdit {
  custom_details?: string;
  custom_note?: string;
  custom_price?: string;
  discount_price?: string;
  stock_status?: "in_stock" | "limited" | "out_of_stock";
  stock_count?: string;
  custom_pitch?: string;
  custom_extra?: string;
  dosageForm?: string;
  painPoints?: string;
  last_updated?: string;
}

export interface MergedProduct {
  id: number;
  sl: string;
  name: string;
  imageFile: string;
  imagePath: string;
  imageUrl: string | null;
  generic: string;
  manufacturer: string;
  dosageForm: string;
  painPoints: string;
  superiority: string;
  ageSolutions: string;
  authenticity: string;
  objections: Array<{ objection: string; script: string }>;
  dietary: string;
  specialists: Array<{ name: string; institute: string; quote: string }>;
  custom_price: string;
  discount_price: string;
  custom_note: string;
  custom_pitch: string;
  custom_details: string;
  stock_status: "in_stock" | "limited" | "out_of_stock";
  stock_count: string;
  last_updated: string;
}

// Read raw master database
function readRawMaster(): any[] {
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[PRODUCT_DB] Failed to read DB_FILE:", err);
    return [];
  }
}

// Read raw edits file
export function readRawEdits(): Record<string, ProductEdit> {
  if (!fs.existsSync(EDITS_FILE)) return {};
  try {
    const raw = fs.readFileSync(EDITS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[PRODUCT_DB] Failed to read EDITS_FILE:", err);
    return {};
  }
}

// Load master products merged with user edits
export function loadMergedDB(): MergedProduct[] {
  const master = readRawMaster();
  const edits = readRawEdits();

  return master.map((item: Record<string, any>, index: number) => {
    const sl = String(item["SL"] || (index + 1));
    const edit = edits[sl] || {};

    const imagePath = (item["ছবি পাথ (Image Path)"] as string) || "";
    const imageFile = path.basename(imagePath) || (item["ফাইলের নাম (File Name)"] as string) || "";

    return {
      id: index + 1,
      sl,
      name: item["ওষুধের নাম (Brand Name)"] || "Unknown",
      imageFile,
      imagePath,
      imageUrl: imageFile ? `/api/products/image?file=${encodeURIComponent(imageFile)}` : null,
      generic: item["জেনেরিক ও ফার্মাকোলজিক্যাল ক্লাস (Generic & Class)"] || "",
      manufacturer: item["প্রস্তুতকারক ও ল্যাবরেটরি (Manufacturer & Lab)"] || "",
      dosageForm: edit.dosageForm || item["ডোজ ফর্ম ও শক্তি (Dosage Form & Strength)"] || "",
      painPoints: edit.painPoints || item["১. কাস্টমারের আসল সমস্যা ও পেইন পয়েন্ট (Pain Point Mapping)"] || item["১. কাস্টমারের আসল সমস্যা ও পেইন point (Pain Point Mapping)"] || item["১. কাস্টমারের আসল সমস্যা ও পেইন পয়েন্ট (Pain Point Mapping)"] || "",
      superiority: item["২. বাজারের অন্যান্য ওষুধের সাথে শ্রেষ্ঠত্ব (Superiority Matrix)"] || "",
      ageSolutions: item["৩. বয়স ভিত্তিক কাস্টমাইজড সমাধান (Age-Specific Solutions)"] || item["৩. বয়স ভিত্তিক কাস্টমাইজড সমাধান (Age-Specific Solutions)"] || "",
      authenticity: item["৪. আসল প্রোডাক্ট চেনার সিকিউরিটি প্রোটোকল (Authenticity System)"] || "",
      objections: item["৫. কাস্টমারের ৪টি কঠিন আপত্তি ও উত্তর (Objection Destroyers)"] || [],
      dietary: item["৬. পুষ্টি ও দ্রুত ফলাফল পাওয়ার খাদ্যাভ্যাস (Dietary Blueprint)"] || item["৬. পুষ্টি ও দ্রুত ফলাফল পাওয়ার খাদ্যাভ্যাস (Dietary Blueprint)"] || "",
      specialists: item["বিশ্বখ্যাত ৫ ডাক্তার ও হাকিমদের উক্তি (Named Specialists & Hakims)"] || [],
      custom_price: edit.custom_price || "",
      discount_price: edit.discount_price || "",
      custom_note: edit.custom_note || "",
      custom_pitch: edit.custom_pitch || "",
      custom_details: edit.custom_details || "",
      stock_status: edit.stock_status || "in_stock",
      stock_count: edit.stock_count || "",
      last_updated: edit.last_updated || ""
    };
  });
}

// Save edits atomically to custom_user_edits.json
export function saveProductEdit(sl: string, payload: Partial<ProductEdit>): MergedProduct | null {
  if (!sl) return null;
  const edits = readRawEdits();

  const current = edits[sl] || {};
  edits[sl] = {
    ...current,
    custom_details: payload.custom_details !== undefined ? payload.custom_details : (current.custom_details || ""),
    custom_note: payload.custom_note !== undefined ? payload.custom_note : (current.custom_note || ""),
    custom_price: payload.custom_price !== undefined ? payload.custom_price : (current.custom_price || ""),
    discount_price: payload.discount_price !== undefined ? payload.discount_price : (current.discount_price || ""),
    stock_status: payload.stock_status !== undefined ? payload.stock_status : (current.stock_status || "in_stock"),
    stock_count: payload.stock_count !== undefined ? payload.stock_count : (current.stock_count || ""),
    custom_pitch: payload.custom_pitch !== undefined ? payload.custom_pitch : (current.custom_pitch || ""),
    custom_extra: payload.custom_extra !== undefined ? payload.custom_extra : (current.custom_extra || ""),
    dosageForm: payload.dosageForm !== undefined ? payload.dosageForm : (current.dosageForm || ""),
    painPoints: payload.painPoints !== undefined ? payload.painPoints : (current.painPoints || ""),
    last_updated: new Date().toLocaleString("bn-BD")
  };

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(EDITS_FILE, JSON.stringify(edits, null, 2), "utf-8");
  } catch (err) {
    console.error("[PRODUCT_DB] Failed to save EDITS_FILE:", err);
    throw err;
  }

  const all = loadMergedDB();
  return all.find(p => p.sl === sl) || null;
}

// Find best matching product by customer query
function normalizeStr(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/['"’`\-_.,()\/\\+!?:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Find best matching product by customer query
export function findProductInDB(query: string): MergedProduct | null {
  const normQ = normalizeStr(query);
  const compactQ = normQ.replace(/\s+/g, "");
  if (!normQ) return null;

  const db = loadMergedDB();
  const kasturiProd = db.find(p => String(p.sl) === "60") || null;
  const joubonProd = db.find(p => String(p.sl) === "59") || null;
  const bajikaranProd = db.find(p => String(p.sl) === "61") || null;

  const qLower = (query || "").toLowerCase();

  // Ignore personal questions or greetings that have no medicine/product inquiry
  const isGeneralOrGreeting = /\b(name|naam|nam|নাম|jano|jaano|জানো|আমার নাম|amar naam|amar name|kemon acho|kemon achen|কেমন আছ|কেমন আছেন|hello|hi\b|হ্যালো|হাই|salam|সালাম|assalam|ভালো আছ|valo acho)\b/i.test(qLower);
  const mentionsMedicine = /\b(osudh|medicine|tablet|capsule|file|oil|cream|gel|ঔষধ|ওষুধ|ট্যাবলেট|ক্যাপসুল|ফাইল|তেল|ক্রিম|জেল|ডোজ|দাম|price|কস্তুরী|kasturi|হালুয়া|হালুয়া|যৌবনের রাজা)\b/i.test(qLower);
  if (isGeneralOrGreeting && !mentionsMedicine) {
    return null;
  }

  // 1. Explicit check for Jouboner Raja
  if (/যৌবনের\s*রাজা|joubon|yowbon|শামসুর/i.test(qLower)) {
    return joubonProd;
  }

  // 2. Explicit check for Bajikaran Halua
  if (/বাজীকরণ|bajikaran|bajikoron|আরিফ/i.test(qLower)) {
    return bajikaranProd;
  }

  // 3. Any medicine inquiry, symptom inquiry, or default -> ALWAYS map to Kasturi Powder (SL 60)
  return kasturiProd;
}

// Build comprehensive context for Gemini AI prompt
export function buildProductAIContext(product: MergedProduct): string {
  let priceText = "";
  if (product.discount_price && product.custom_price) {
    priceText = `রেগুলার মূল্য: ${product.custom_price} টাকা, অফার মূল্য: ${product.discount_price} টাকা।`;
  } else if (product.discount_price) {
    priceText = `অফার মূল্য: ${product.discount_price} টাকা।`;
  } else if (product.custom_price) {
    priceText = `মূল্য: ${product.custom_price} টাকা।`;
  }

  let doctorQuote = "";
  if (Array.isArray(product.specialists) && product.specialists.length > 0) {
    doctorQuote = `${product.specialists[0].name} (${product.specialists[0].institute}): ${product.specialists[0].quote}`;
  }

  let objText = "";
  if (Array.isArray(product.objections) && product.objections.length > 0) {
    objText = product.objections.map((o: any) => `প্রশ্ন: ${o.objection} -> উত্তর: ${o.script}`).join("\n");
  }

  return `
[লাইভ ড্যাশবোর্ড প্রোডাক্ট তথ্য]
ওষুধের নাম: ${product.name}
ডোজ ও প্যাকেজিং: ${product.dosageForm}
প্রস্তুতকারক: ${product.manufacturer}
${priceText ? "লাইভ মূল্য/অফার: " + priceText : ""}
${product.custom_note ? "বিশেষ অফার ও শর্ত: " + product.custom_note : ""}
${product.custom_pitch ? "বিশেষ কার্যকারিতা: " + product.custom_pitch : ""}
স্টক স্ট্যাটাস: ${product.stock_status === "out_of_stock" ? "স্টক শেষ" : product.stock_status === "limited" ? `সীমিত স্টক (${product.stock_count || "দ্রুত অর্ডার করুন"})` : "স্টক পর্যাপ্ত"}

কাস্টমারের মূল সমস্যা ও প্রতিকার:
${product.painPoints}

বাজারে অন্যান্য ওষুধের চেয়ে শ্রেষ্ঠত্ব:
${product.superiority}

বয়স ভিত্তিক সমাধান:
${product.ageSolutions}

${doctorQuote ? "ডাক্তার ও হাকিমদের উক্তি:\n" + doctorQuote : ""}

${objText ? "কাস্টমারের সম্ভাব্য আপত্তি ও নির্ভুল উত্তর:\n" + objText : ""}

খাদ্যাভ্যাস ও পথ্য:
${product.dietary}
`.trim();
}

// Check if a customer query is asking for a photo/picture/appearance of the medicine
export const KASTURI_POWDER_IMAGES = [
  "kasturi_powder_1.jpg",
  "kasturi_powder_2.jpg",
  "kasturi_powder_3.jpg",
  "kasturi_powder_4.jpg",
  "kasturi_powder_5.jpg",
];

// Check if customer asks for multiple / several / more pictures
export function isMultiplePicturesRequest(text: string): boolean {
  if (!text) return false;
  const q = text.toLowerCase();
  return (
    /কয়েকটা|কয়েকটি|কয়েকটা|কয়েকটি|সব|সবগুলো|সবগুলি|আরও|আরো|বেশ\s*কয়েক|কয়টা|কয়টা/i.test(q) ||
    /multiple|several|all\s*pics?|more\s*pics?|all\s*photos?|different\s*pics?/i.test(q) ||
    /(?:২|3|৩|4|৪|কয়েক|কয়েক)\s*(?:টা|টি)\s*(?:ছবি|সবি|pic|photo)/i.test(q) ||
    /(?:aro|koyekta|sob|gula|shob)\s*(?:chobi|sobi|pic|photo)/i.test(q)
  );
}

// Get next Kasturi Powder image(s) for a customer with smart rotation & variety
export function getNextKasturiImages(
  previouslySent: string[] = [],
  isMultiple: boolean = false
): { imagesToSend: string[]; updatedHistory: string[] } {
  let available = KASTURI_POWDER_IMAGES.filter(img => !previouslySent.includes(img));
  if (available.length === 0) {
    available = [...KASTURI_POWDER_IMAGES];
  }

  let imagesToSend: string[] = [];
  if (isMultiple) {
    const count = Math.min(available.length, 3);
    imagesToSend = available.slice(0, count);
  } else {
    imagesToSend = [available[0]];
  }

  const combined = [...new Set([...previouslySent, ...imagesToSend])];
  const updatedHistory = combined.length >= KASTURI_POWDER_IMAGES.length ? imagesToSend : combined;

  return { imagesToSend, updatedHistory };
}

// Check if a customer query is asking for a photo/picture/appearance of the medicine
export function isPictureRequest(text: string): boolean {
  if (!text) return false;
  const q = text.toLowerCase();
  return (
    /chobi|cobi|sobi|shobi|pic|pik|photo|foto|picture|image|img/i.test(q) ||
    /ছবি|সবি|ছবিকি|সবিকি|পিক|পিকচার|ফটো|ইমেজ/i.test(q) ||
    /dekhte|dekte|দেখতে কেমন|কি রকম দেখতে|কিরকম দেখতে|কেমন দেখতে|বাস্তবে কেমন|সামনে থেকে|দেখব|দেখবো|দেখান|দেখাবেন|দেখতে চাই|দেতে পারবা|দেখতে পারি/i.test(q)
  );
}

// Locate matching product with image for a query, falling back to chat history or Kasturi Powder
export function findProductForImage(
  text: string,
  chatHistory?: { sender: "CUSTOMER" | "AGENT"; text: string }[]
): MergedProduct | null {
  // 1. Direct match on current message
  const directMatch = findProductInDB(text);
  if (directMatch && directMatch.imageFile) {
    return directMatch;
  }

  // 2. Scan recent conversation history backwards (most recent messages first)
  if (chatHistory && chatHistory.length > 0) {
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const msg = chatHistory[i];
      if (!msg.text) continue;
      const histMatch = findProductInDB(msg.text);
      if (histMatch && histMatch.imageFile) {
        return histMatch;
      }
    }
  }

  // 3. Fallback to Kasturi Powder flagship
  const db = loadMergedDB();
  const kasturi = db.find(p => String(p.sl) === "60" || p.name.includes("কস্তুরী"));
  if (kasturi) {
    return {
      ...kasturi,
      imageFile: kasturi.imageFile || "kasturi_powder_1.jpg"
    };
  }

  return db[0] || null;
}

// Check if customer query is asking for certificate / trade license / govt approval / Hakim qualifications
export function isCertificateOrLicenseRequest(text: string): boolean {
  if (!text) return false;
  const q = text.toLowerCase();
  return (
    /certificate|licen[sc]e|regist|\breg\b|proof|dokhol|kagoj|sanad|onumodon/i.test(q) ||
    /সা[রট্রি]+ফিকে[টড]|লাই[সছ][েএ]?[নন][্সস]|সন[দত]|নিবন্ধন|অনুমোদন|কাগজ|প্রমা[ণন]|প্রুফ|ডকুমেন্ট/i.test(q) ||
    /(?:ডাক্তার|হাকিম|প্রোডাক্ট|ওষুধ|ঔষধ|কোম্পানি|পেজ).*(?:প্রমা[ণন]|আসল|বৈধ|সত্য|অনুমোদন|কিনা|কে|নাম|সা[রট্রি]+ফিকে|লাই[সছ])/i.test(q) ||
    /(?:তৈরি|বানাইছে|বানায়|বানায়|প্রস্তুত).*(?:কে|কার|নাম|হাকিম|ডাক্তার)/i.test(q) ||
    /(?:ছবি|সবি|pic|photo|দেখ|দাও|দেন|পাঠা|দেখা).*(?:সা[রট্রি]+ফিকে|লাই[সছ]|সন[দত]|কাগজ|অনুমোদন|প্রমা[ণন])/i.test(q) ||
    /(?:সা[রট্রি]+ফিকে|লাই[সছ]|সন[দত]|কাগজ|অনুমোদন|প্রমা[ণন]).*(?:ছবি|সবি|pic|photo|দেখ|দাও|দেন|পাঠা|দেখা|আসে|আছে|হবে|পাব)/i.test(q) ||
    /(?:হাকিম|ডাক্তার|কবিরাজ|চিকিৎসক).*(?:সার্টিফিকেট|সাটিফিকেট|লাইসেন্স|লাইসন্স|সনদ|কাগজ|প্রমাণ|প্রমান)/i.test(q)
  );
}
