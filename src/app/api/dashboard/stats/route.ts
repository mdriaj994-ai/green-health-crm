// @ts-nocheck
// src/app/api/dashboard/stats/route.ts
// Live dashboard statistics
import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

function getDb() {
  const dbFile = path.resolve(process.cwd(), "prisma", "social_inbox.db");
  if (!fs.existsSync(dbFile)) return null;
  const db = new (Database as any)(dbFile);
  db.pragma("journal_mode = WAL");
  return db;
}

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    let todayCustomers = 0;
    let todayMessages = 0;
    let pendingFollowUps = 0;
    let ordersCount = 0;

    const db = getDb();
    if (db) {
      const custRow: any = db.prepare(`SELECT COUNT(DISTINCT conversationId) as cnt FROM "Message" WHERE createdAt >= ? AND createdAt < ? AND senderType = 'CUSTOMER'`).get(todayStart, tomorrowStart);
      todayCustomers = custRow?.cnt ?? 0;

      const msgRow: any = db.prepare(`SELECT COUNT(*) as cnt FROM "Message" WHERE createdAt >= ? AND createdAt < ?`).get(todayStart, tomorrowStart);
      todayMessages = msgRow?.cnt ?? 0;

      db.close();
    }

    const customersDir = path.resolve(process.cwd(), "data", "customers");
    if (fs.existsSync(customersDir)) {
      const files = fs.readdirSync(customersDir).filter((f: string) => f.endsWith(".json"));
      for (const file of files) {
        try {
          const profile = JSON.parse(fs.readFileSync(path.join(customersDir, file), "utf-8"));
          if (profile.followUpStatus === "pending" && profile.scheduledFollowUpAt > 0) pendingFollowUps++;
          if (["order_placed","delivered","repeat_customer"].includes(profile.orderStatus)) {
            if (profile.lastContact >= Date.parse(todayStart) && profile.lastContact < Date.parse(tomorrowStart)) ordersCount++;
          }
        } catch {}
      }
    } else {
      const memFile = path.resolve(process.cwd(), "data", "customer_memory.json");
      if (fs.existsSync(memFile)) {
        try {
          const all: Record<string, any> = JSON.parse(fs.readFileSync(memFile, "utf-8"));
          for (const profile of Object.values(all)) {
            if (profile.followUpStatus === "pending" && profile.scheduledFollowUpAt) pendingFollowUps++;
            if (["order_placed","delivered","repeat_customer"].includes(profile.orderStatus) && profile.lastContact >= Date.parse(todayStart)) ordersCount++;
          }
        } catch {}
      }
    }

    return NextResponse.json({ todayCustomers, todayMessages, pendingFollowUps, ordersCount });
  } catch (err) {
    console.error("[dashboard/stats]", err);
    return NextResponse.json({ todayCustomers: 0, todayMessages: 0, pendingFollowUps: 0, ordersCount: 0 });
  }
}

