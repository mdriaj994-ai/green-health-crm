// src/app/api/orders/route.ts
// Uses better-sqlite3 directly to ensure correct DB path (prisma/social_inbox.db)
import { NextRequest, NextResponse } from "next/server";
import path from "path";

function getDb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs");
  const dataDb = path.join(process.cwd(), "data", "social_inbox.db");
  const prismaDb = path.join(process.cwd(), "prisma", "social_inbox.db");
  const dbPath = fs.existsSync(dataDb) ? dataDb : prismaDb;
  const db = new Database(dbPath);
  // Ensure Order table always exists (runs on every connection)
  db.exec(`CREATE TABLE IF NOT EXISTS "Order" (
    id TEXT PRIMARY KEY,
    customerName TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    district TEXT NOT NULL DEFAULT '',
    thana TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    product TEXT NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 1,
    senderId TEXT NOT NULL DEFAULT '',
    facebookName TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'PENDING',
    notes TEXT NOT NULL DEFAULT '',
    pageId TEXT NOT NULL DEFAULT '',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  return db;
}

function syncOrdersBackup(db: any) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    const backupPath = path.join(process.cwd(), "data", "orders_backup.json");
    const all = db.prepare('SELECT * FROM "Order" ORDER BY createdAt DESC').all();
    fs.writeFileSync(backupPath, JSON.stringify(all, null, 2), "utf-8");
  } catch (_) {}
}

function generateId() {
  return "c" + require("crypto").randomBytes(16).toString("hex");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "100");

    const db = getDb();

    // Ensure Order table exists
    db.exec(`CREATE TABLE IF NOT EXISTS "Order" (
      id TEXT PRIMARY KEY,
      customerName TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      district TEXT NOT NULL DEFAULT '',
      thana TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      product TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      senderId TEXT NOT NULL DEFAULT '',
      facebookName TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'PENDING',
      notes TEXT NOT NULL DEFAULT '',
      pageId TEXT NOT NULL DEFAULT '',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

    let orders;
    let total;

    if (status && status !== "ALL") {
      orders = db.prepare(`SELECT * FROM "Order" WHERE status = ? ORDER BY createdAt DESC LIMIT ?`).all(status, limit);
      total = (db.prepare(`SELECT COUNT(*) as c FROM "Order" WHERE status = ?`).get(status) as any).c;
    } else {
      orders = db.prepare(`SELECT * FROM "Order" ORDER BY createdAt DESC LIMIT ?`).all(limit);
      total = (db.prepare(`SELECT COUNT(*) as c FROM "Order"`).get() as any).c;
    }

    db.close();
    return NextResponse.json({ orders, total });
  } catch (error: any) {
    console.error("[API/ORDERS GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDb();
    const id = generateId();
    const now = new Date().toISOString();

    db.prepare(`INSERT INTO "Order" (id, customerName, phone, district, thana, address, product, quantity, senderId, facebookName, status, notes, pageId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id,
      body.customerName || "অজ্ঞাত",
      body.phone || "",
      body.district || "",
      body.thana || "",
      body.address || "",
      body.product || "",
      body.quantity || 1,
      body.senderId || "",
      body.facebookName || "",
      "PENDING",
      body.notes || "",
      body.pageId || "",
      now, now
    );

    const order = db.prepare(`SELECT * FROM "Order" WHERE id = ?`).get(id);
    syncOrdersBackup(db);
    db.close();
    return NextResponse.json({ order });
  } catch (error: any) {
    console.error("[API/ORDERS POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json();
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`UPDATE "Order" SET status = ?, updatedAt = ? WHERE id = ?`).run(status, now, id);
    const order = db.prepare(`SELECT * FROM "Order" WHERE id = ?`).get(id);
    syncOrdersBackup(db);
    db.close();
    return NextResponse.json({ order });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
