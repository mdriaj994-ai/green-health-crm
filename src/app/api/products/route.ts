import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { loadMergedDB, saveProductEdit } from "@/lib/product-db";

// ── GET /api/products — list all products or filter by search/id ──────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.toLowerCase().trim() || "";
    const id = searchParams.get("id");
    const sl = searchParams.get("sl");

    let products = loadMergedDB();

    // Filter by ID or SL
    if (id || sl) {
      const product = products.find(
        (p) => String(p.id) === id || String(p.sl) === (sl || id)
      );
      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
      return NextResponse.json({ product });
    }

    // Filter by search query
    if (search) {
      products = products.filter((p) =>
        p.name.toLowerCase().includes(search) ||
        p.generic.toLowerCase().includes(search) ||
        p.manufacturer.toLowerCase().includes(search) ||
        p.painPoints.toLowerCase().includes(search) ||
        p.custom_pitch.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      products,
      total: products.length,
      dataSource: "VPS Live Database (medicine_master_complete_db.json + custom_user_edits.json)",
    });
  } catch (error: unknown) {
    console.error("[PRODUCTS_GET]", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST/PUT /api/products — 2s Debounced Auto-Save endpoint ─────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sl = String(body.sl || body.id || "").trim();

    if (!sl) {
      return NextResponse.json(
        { error: "Product SL is required for saving" },
        { status: 400 }
      );
    }

    const updatedProduct = saveProductEdit(sl, {
      custom_price: body.custom_price,
      discount_price: body.discount_price,
      custom_note: body.custom_note,
      custom_pitch: body.custom_pitch,
      custom_details: body.custom_details,
      stock_status: body.stock_status,
      stock_count: body.stock_count,
      dosageForm: body.dosageForm,
      painPoints: body.painPoints,
    });

    if (!updatedProduct) {
      return NextResponse.json(
        { error: "Product not found or failed to update" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: "success",
      message: "সফলভাবে ২ সেকেন্ডে সেভ হয়েছে!",
      product: updatedProduct,
      savedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("[PRODUCTS_SAVE_ERROR]", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  return POST(req);
}

export const dynamic = "force-dynamic";
