import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { NextRequest } from "next/server";

// ── Path to the Data Deshbord folder ─────────────────────────────────────────
const DATA_DESHBORD_PATH = "D:\\Ads Power And All akhane ase may mas\\Data Deshbord";
const DB_FILE = path.join(DATA_DESHBORD_PATH, "medicine_master_complete_db.json");
const IMAGE_FOLDER = path.join(DATA_DESHBORD_PATH, "Product Image");

// ── Load and normalize products ──────────────────────────────────────────────
function loadProducts() {
  if (!fs.existsSync(DB_FILE)) return [];
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  const data = JSON.parse(raw);

  return data.map((item: Record<string, unknown>, index: number) => {
    const imagePath = (item["ছবি পাথ (Image Path)"] as string) || "";
    const imageFile = path.basename(imagePath);

    return {
      id: index + 1,
      sl: item["SL"] || index + 1,
      name: item["ওষুধের নাম (Brand Name)"] || "Unknown",
      imageFile,
      imagePath,
      generic: item["জেনেরিক ও ফার্মাকোলজিক্যাল ক্লাস (Generic & Class)"] || "",
      manufacturer: item["প্রস্তুতকারক ও ল্যাবরেটরি (Manufacturer & Lab)"] || "",
      dosageForm: item["ডোজ ফর্ম ও শক্তি (Dosage Form & Strength)"] || "",
      painPoints: item["১. কাস্টমারের আসল সমস্যা ও পেইন পয়েন্ট (Pain Point Mapping)"] || "",
      superiority: item["২. বাজারের অন্যান্য ওষুধের সাথে শ্রেষ্ঠত্ব (Superiority Matrix)"] || "",
      ageSolutions: item["৩. বয়স ভিত্তিক কাস্টমাইজড সমাধান (Age-Specific Solutions)"] || "",
      authenticity: item["৪. আসল প্রোডাক্ট চেনার সিকিউরিটি প্রোটোকল (Authenticity System)"] || "",
      objections: item["৫. কাস্টমারের ৪টি কঠিন আপত্তি ও উত্তর (Objection Destroyers)"] || [],
      dietary: item["৬. পুষ্টি ও দ্রুত ফলাফল পাওয়ার খাদ্যাভ্যাস (Dietary Blueprint)"] || "",
      specialists: item["বিশ্বখ্যাত ৫ ডাক্তার ও হাকিমদের উক্তি (Named Specialists & Hakims)"] || [],
      // Add image API URL for serving locally
      imageUrl: imageFile ? `/api/products/image?file=${encodeURIComponent(imageFile)}` : null,
    };
  });
}

// ── GET /api/products — list all products ────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.toLowerCase() || "";
    const id = searchParams.get("id");

    let products = loadProducts();

    // Filter by ID if requested
    if (id) {
      const product = products.find((p: {id: number}) => p.id === parseInt(id));
      if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
      return NextResponse.json({ product });
    }

    // Filter by search term
    if (search) {
      products = products.filter((p: {name: string}) =>
        p.name.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      products,
      total: products.length,
      dataSource: "Data Deshbord / medicine_master_complete_db.json",
    });
  } catch (error: unknown) {
    console.error("[PRODUCTS_GET]", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── GET /api/products/image?file=xxx — serve product images ─────────────────
// This is handled in a separate route file below
export const dynamic = "force-dynamic";
