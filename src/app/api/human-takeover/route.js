// src/app/api/human-takeover/route.js
// API to manually pause/resume the bot for a specific customer
// POST   /api/human-takeover  { senderId, pageId }             → pause bot for this customer
// DELETE /api/human-takeover  { senderId, pageId }             → resume bot for this customer  
// GET    /api/human-takeover                                   → list all paused customers
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const HUMAN_TAKEOVER_FILE = path.join(process.cwd(), "data", "human_takeover.json");

function readTakeoverFile() {
  try {
    if (fs.existsSync(HUMAN_TAKEOVER_FILE)) {
      return JSON.parse(fs.readFileSync(HUMAN_TAKEOVER_FILE, "utf-8")) || {};
    }
  } catch {}
  return {};
}

function writeTakeoverFile(data) {
  try {
    const dir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(HUMAN_TAKEOVER_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {}
}

// GET — list all customers where bot is paused
export async function GET() {
  const data = readTakeoverFile();
  const now = Date.now();
  const TTL = 24 * 60 * 60 * 1000;
  const active = Object.entries(data)
    .filter(([, v]) => now - v.takenAt < TTL)
    .map(([key, v]) => ({
      key,
      senderId: v.senderId,
      pageId: v.pageId,
      reason: v.reason,
      takenAt: new Date(v.takenAt).toISOString(),
      expiresIn: Math.round((TTL - (now - v.takenAt)) / 60000) + " min"
    }));
  return NextResponse.json({ paused: active, total: active.length });
}

// POST — pause bot for a customer (human takes over)
export async function POST(req) {
  try {
    const { senderId, pageId, reason = "manual_admin_action" } = await req.json();
    if (!senderId || !pageId) {
      return NextResponse.json({ error: "senderId and pageId are required" }, { status: 400 });
    }
    const data = readTakeoverFile();
    const key = `${pageId}:${senderId}`;
    data[key] = { takenAt: Date.now(), pageId: String(pageId), senderId: String(senderId), reason };
    writeTakeoverFile(data);
    console.log(`[HUMAN_TAKEOVER_API] ✋ Bot paused for ${senderId} on page ${pageId}`);
    return NextResponse.json({ success: true, message: `Bot paused for customer ${senderId}. They will not receive bot replies.` });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE — resume bot for a customer (release takeover)
export async function DELETE(req) {
  try {
    const { senderId, pageId } = await req.json();
    if (!senderId || !pageId) {
      return NextResponse.json({ error: "senderId and pageId are required" }, { status: 400 });
    }
    const data = readTakeoverFile();
    const key = `${pageId}:${senderId}`;
    const existed = key in data;
    delete data[key];
    writeTakeoverFile(data);
    console.log(`[HUMAN_TAKEOVER_API] ✅ Bot resumed for ${senderId} on page ${pageId}`);
    return NextResponse.json({
      success: true,
      wasActive: existed,
      message: existed
        ? `Bot resumed for customer ${senderId}. They will now receive bot replies again.`
        : `Customer ${senderId} was not in takeover list.`
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
