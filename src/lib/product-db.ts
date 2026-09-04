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
export function findProductInDB(query: string): MergedProduct | null {
  const db = loadMergedDB();
  const q = query.toLowerCase().replace(/['"’`]/g, "").trim();
  if (!q) return null;

  const aliases: Record<string, string[]> = {
    "dream touch": ["dream touch", "dreamtouch", "ড্রিম টাচ", "ড্রিমটাচ", "ড্রিম"],
    "men's burner": ["men's burner", "mens burner", "men burner", "মেনস বার্নার", "বার্নার"],
    "soul mate": ["soul mate", "soulmate", "সোল মেট", "সোলমেট", "সুল মেট"],
    "black ginseng": ["black ginseng", "ginseng", "ব্ল্যাক জিনসেং", "জিনসেং"],
    "egypt gawa": ["egypt gawa", "egypt", "gawa", "ইজিপ্ট", "গাওয়া", "গাওয়া"],
    "enjoy hunter": ["enjoy hunter", "enjoy", "hunter", "হান্টার"],
    "hammer of thor": ["hammer of thor", "hammer", "হ্যামার"],
    "maxman": ["maxman", "ম্যাক্সম্যান"],
    "titan gel": ["titan gel", "টাইটান জেল"],
    "viga": ["viga", "ভিগা"],
    "shark": ["shark", "শার্ক"],
    "rheumarex": ["rheumarex", "রিউমারেক্স"]
  };

  // 1. Alias match
  for (const [key, aliasList] of Object.entries(aliases)) {
    if (aliasList.some(a => q.includes(a))) {
      const found = db.find(p => p.name.toLowerCase().includes(key));
      if (found) return found;
    }
  }

  // 2. Clean brand name match (without parentheses)
  for (const p of db) {
    const cleanName = p.name.toLowerCase().replace(/\s*\([^)]*\)/g, "").trim();
    if (cleanName && cleanName.length >= 3 && q.includes(cleanName)) {
      return p;
    }
  }

  // 3. Fallback to scoring
  const results = db.map((item) => {
    const name = item.name.toLowerCase();
    const mfg = item.manufacturer.toLowerCase();
    const dosage = item.dosageForm.toLowerCase();
    const pain = item.painPoints.toLowerCase();
    const generic = item.generic.toLowerCase();
    const customPitch = item.custom_pitch.toLowerCase();
    const customNote = item.custom_note.toLowerCase();

    let score = 0;
    const words = q.split(/\s+/).filter(Boolean);
    for (const word of words) {
      if (word.length < 2) continue;
      if (name.includes(word)) score += 15;
      if (customPitch.includes(word)) score += 8;
      if (customNote.includes(word)) score += 6;
      if (pain.includes(word)) score += 5;
      if (generic.includes(word)) score += 4;
      if (mfg.includes(word)) score += 3;
      if (dosage.includes(word)) score += 2;
    }

    return { item, score };
  });

  results.sort((a, b) => b.score - a.score);
  const best = results[0];

  if (!best || best.score === 0) return null;
  return best.item;
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
