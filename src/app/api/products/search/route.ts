import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { findProductInDB, buildProductAIContext, loadMergedDB } from "@/lib/product-db";

// GET /api/products/search?q=keyword
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";

  if (!q.trim()) {
    return NextResponse.json({ error: "Query 'q' is required" }, { status: 400 });
  }

  const product = findProductInDB(q);

  if (!product) {
    return NextResponse.json({
      found: false,
      message: `প্রোডাক্ট পাওয়া যায়নি: "${q}"`,
      query: q,
    });
  }

  const aiContext = buildProductAIContext(product);

  return NextResponse.json({
    found: true,
    product,
    aiContext,
    price: product.discount_price || product.custom_price || "দাম জানতে মেসেজ করুন",
    regularPrice: product.custom_price || "",
    offerPrice: product.discount_price || "",
    dosage: product.dosageForm,
    inStock: product.stock_status !== "out_of_stock",
    stockStatus: product.stock_status,
  });
}

export const dynamic = "force-dynamic";
