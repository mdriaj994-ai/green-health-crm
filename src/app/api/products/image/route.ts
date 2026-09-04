import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { NextRequest } from "next/server";

const IMAGE_FOLDER = process.env.IMAGE_FOLDER || path.join(process.cwd(), "public", "products");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file");

  if (!file) {
    return NextResponse.json({ error: "file param required" }, { status: 400 });
  }

  // Security: only allow jpg/jpeg/png/webp, no path traversal
  const safeFile = path.basename(file);
  if (!safeFile.match(/\.(jpe?g|png|webp|gif)$/i)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  const filePath = path.join(IMAGE_FOLDER, safeFile);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const imageBuffer = fs.readFileSync(filePath);
  const ext = safeFile.split(".").pop()?.toLowerCase();
  const contentType =
    ext === "png" ? "image/png" :
    ext === "webp" ? "image/webp" :
    ext === "gif" ? "image/gif" :
    "image/jpeg";

  return new NextResponse(imageBuffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
