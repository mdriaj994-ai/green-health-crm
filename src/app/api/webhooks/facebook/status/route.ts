import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const logFile = path.join(process.cwd(), "data", "webhook_hits.log");
  let content = "No hits yet.";
  if (fs.existsSync(logFile)) {
    content = fs.readFileSync(logFile, "utf-8");
  }
  return NextResponse.json({
    status: "online",
    time: new Date().toISOString(),
    logs: content.split("\n").filter(Boolean).slice(-25),
  });
}

export const dynamic = "force-dynamic";
