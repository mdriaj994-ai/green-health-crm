import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { NextRequest } from "next/server";

const CANDIDATE_DIRS = [
  path.join(process.cwd(), "data", "Product Image"),
  path.join(process.cwd(), "public", "products"),
  path.join(process.cwd(), "public", "Product Image"),
  process.env.IMAGE_FOLDER || "",
].filter(Boolean);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file");

  if (!file) {
    return NextResponse.json({ error: "file param required" }, { status: 400 });
  }

  // Security: sanitize file name to avoid path traversal
  const safeFile = path.basename(file);
  if (!safeFile.match(/\.(jpe?g|png|webp|gif)$/i)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  let foundPath: string | null = null;
  for (const dir of CANDIDATE_DIRS) {
    const candidate = path.join(dir, safeFile);
    if (fs.existsSync(candidate)) {
      foundPath = candidate;
      break;
    }
  }

  if (!foundPath) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const imageBuffer = fs.readFileSync(foundPath);
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

export const dynamic = "force-dynamic";
