import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { NextRequest } from "next/server";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "medicine_master_complete_db.json");
const EDITS_FILE = path.join(DATA_DIR, "custom_user_edits.json");
const IMAGE_FOLDER = path.join(DATA_DIR, "Product Image");
const BASE_URL = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";

// Cache uploaded Facebook attachment IDs
const fbAttachmentCache = new Map<string, string>();

async function uploadImageToFacebookAttachment(filePath: string): Promise<string | null> {
  const fileName = path.basename(filePath);
  if (fbAttachmentCache.has(fileName)) {
    return fbAttachmentCache.get(fileName)!;
  }

  if (!fs.existsSync(filePath)) return null;

  try {
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const fileBlob = new Blob([fs.readFileSync(filePath)], { type: mimeType });
    const form = new globalThis.FormData();
    form.append("message", JSON.stringify({ attachment: { type: "image", payload: { is_reusable: true } } }));
    form.append("filedata", fileBlob, fileName);

    const res = await fetch(`https://graph.facebook.com/v19.0/me/message_attachments?access_token=${PAGE_TOKEN}`, {
      method: "POST",
      body: form
    });
    const data = await res.json();
    if (data.attachment_id) {
      console.log(`[FB_IMAGE_ATTACHMENT_SUCCESS] File: ${fileName} -> Attachment ID: ${data.attachment_id}`);
      fbAttachmentCache.set(fileName, data.attachment_id);
      return data.attachment_id;
    }
    console.warn(`[FB_IMAGE_ATTACHMENT_FAILED]`, data);
    return null;
  } catch (err: any) {
    console.warn("[FB_IMAGE_ATTACHMENT_WARN]", err.message);
    return null;
  }
}

// Load Master DB merged with live user edits from http://localhost:8080/
function loadMergedDB() {
  if (!fs.existsSync(DB_FILE)) return [];
  const master = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  
  let edits: Record<string, any> = {};
  if (fs.existsSync(EDITS_FILE)) {
    try {
      edits = JSON.parse(fs.readFileSync(EDITS_FILE, "utf-8"));
    } catch {}
  }

  return master.map((item: Record<string, any>, idx: number) => {
    const sl = String(item["SL"] || (idx + 1));
    const edit = edits[sl] || {};

    return {
      ...item,
      sl,
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

// Find best matching product by keyword
function findProduct(query: string) {
  const db = loadMergedDB();
  const q = query.toLowerCase().replace(/[^\u0080-\uFFFF\w\s]/g, "").trim();

  const results = db.map((item: Record<string, any>) => {
    const name = (item["ওষুধের নাম (Brand Name)"] || "").toLowerCase();
    const manufacturer = (item["প্রস্তুতকারক ও ল্যাবরেটরি (Manufacturer & Lab)"] || "").toLowerCase();
    const dosage = (item["ডোজ ফর্ম ও শক্তি (Dosage Form & Strength)"] || "").toLowerCase();
    const pain = (item["১. কাস্টমারের আসল সমস্যা ও পেইন পয়েন্ট (Pain Point Mapping)"] || "").toLowerCase();
    const generic = (item["জেনেরিক ও ফার্মাকোলজিক্যাল ক্লাস (Generic & Class)"] || "").toLowerCase();
    const customPitch = (item.custom_pitch || "").toLowerCase();

    let score = 0;
    const words = q.split(/\s+/).filter(Boolean);
    for (const word of words) {
      if (name.includes(word)) score += 12;
      if (manufacturer.includes(word)) score += 3;
      if (dosage.includes(word)) score += 2;
      if (pain.includes(word)) score += 3;
      if (generic.includes(word)) score += 4;
      if (customPitch.includes(word)) score += 3;
    }

    return { item, score };
  });

  results.sort((a: {score: number}, b: {score: number}) => b.score - a.score);
  const best = results[0];

  if (!best || best.score === 0) return null;
  return best.item;
}

// Build comprehensive context for Gemini AI
function buildAIContext(product: Record<string, any>) {
  const name = product["ওষুধের নাম (Brand Name)"] || "";
  const dosage = product["ডোজ ফর্ম ও শক্তি (Dosage Form & Strength)"] || "";
  const mfg = product["প্রস্তুতকারক ও ল্যাবরেটরি (Manufacturer & Lab)"] || "";
  const pain = product["১. কাস্টমারের আসল সমস্যা ও পেইন পয়েন্ট (Pain Point Mapping)"] || "";
  const sup = product["২. বাজারের অন্যান্য ওষুধের সাথে শ্রেষ্ঠত্ব (Superiority Matrix)"] || "";
  const age = product["৩. বয়স ভিত্তিক কাস্টমাইজড সমাধান (Age-Specific Solutions)"] || "";
  const auth = product["৪. আসল প্রোডাক্ট চেনার সিকিউরিটি প্রোটোকল (Authenticity System)"] || "";
  const diet = product["৬. পুষ্টি ও দ্রুত ফলাফল পাওয়ার খাদ্যাভ্যাস (Dietary Blueprint)"] || "";
  const specialists = product["বিশ্বখ্যাত ৫ ডাক্তার ও হাকিমদের উক্তি (Named Specialists & Hakims)"] || [];
  const objections = product["৫. কাস্টমারের ৪টি কঠিন আপত্তি ও উত্তর (Objection Destroyers)"] || [];

  let priceText = "";
  if (product.discount_price && product.custom_price) {
    priceText = `রেগুলার মূল্য: ${product.custom_price} টাকা, অফার মূল্য: ${product.discount_price} টাকা।`;
  } else if (product.discount_price) {
    priceText = `অফার মূল্য: ${product.discount_price} টাকা।`;
  } else if (product.custom_price) {
    priceText = `মূল্য: ${product.custom_price} টাকা।`;
  }

  let doctorQuote = "";
  if (Array.isArray(specialists) && specialists.length > 0) {
    doctorQuote = `${specialists[0].name} (${specialists[0].institute}): ${specialists[0].quote}`;
  }

  let objText = "";
  if (Array.isArray(objections) && objections.length > 0) {
    objText = objections.map((o: any) => `প্রশ্ন: ${o.objection} -> সমাধান: ${o.script}`).join("\n");
  }

  return `
[LIVE DATA DESHBORD PRODUCT INFO]
ওষুধের নাম: ${name}
ডোজ ও প্যাকেজিং: ${dosage}
প্রস্তুতকারক: ${mfg}
${priceText ? "লাইভ ড্যাশবোর্ড প্রাইসিং: " + priceText : ""}
${product.custom_note ? "স্পেশাল অফার/নোট: " + product.custom_note : ""}
${product.custom_pitch ? "সেলস পিচ: " + product.custom_pitch : ""}
স্টক স্ট্যাটাস: ${product.stock_status === "out_of_stock" ? "স্টক শেষ" : product.stock_status === "limited" ? "সীমিত স্টক" : "স্টক আছে"}

কাস্টমারের মূল সমস্যা ও প্রতিকার:
${pain}

বাজারে অন্যান্য ওষুধের চেয়ে শ্রেষ্ঠত্ব:
${sup}

বয়স ভিত্তিক সমাধান:
${age}

ডাক্তার ও গবেষকের উক্তি:
${doctorQuote}

কাস্টমারের কমন আপত্তি ও নির্ভুল উত্তর:
${objText}

খাদ্যাভ্যাস ও সেবনবিধি:
${diet}
`.trim();
}

// GET /api/products/search?q=keyword
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";

  if (!q) {
    return NextResponse.json({ error: "q param required" }, { status: 400 });
  }

  const product = findProduct(q);

  if (!product) {
    return NextResponse.json({
      found: false,
      reply: "দুঃখিত, এই তথ্যের সাথে মিলে এমন ওষুধ ডাটাবেজে পাওয়া যায়নি। আপনি কী সমস্যায় ভুগছেন বা ওষুধের নামটি পরিষ্কার করে লিখে জানান।",
    });
  }

  const imageFile = path.basename((product["ছবি পাথ (Image Path)"] as string) || (product["ফাইলের নাম (File Name)"] as string) || "");
  const localImagePath = path.join(IMAGE_FOLDER, imageFile);
  const imageUrl = imageFile ? `${BASE_URL}/api/products/image?file=${encodeURIComponent(imageFile)}` : null;

  // Upload to Facebook attachment API for 100% reliable image delivery
  const imageAttachmentId = await uploadImageToFacebookAttachment(localImagePath);
  const aiContext = buildAIContext(product);

  return NextResponse.json({
    found: true,
    product: {
      sl: product.sl,
      name: product["ওষুধের নাম (Brand Name)"],
      dosageForm: product["ডোজ ফর্ম ও শক্তি (Dosage Form & Strength)"],
      manufacturer: product["প্রস্তুতকারক ও ল্যাবরেটরি (Manufacturer & Lab)"],
      custom_price: product.custom_price,
      discount_price: product.discount_price,
      custom_note: product.custom_note,
      custom_pitch: product.custom_pitch,
      stock_status: product.stock_status,
      imageUrl,
      imageFile,
      imageAttachmentId,
      aiContext
    }
  });
}
