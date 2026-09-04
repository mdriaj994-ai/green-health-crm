import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "master-report.html");
    if (!fs.existsSync(filePath)) {
      return new NextResponse("Report not found", { status: 404 });
    }
    const html = fs.readFileSync(filePath, "utf-8");
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: any) {
    return new NextResponse("Error loading report: " + err.message, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
