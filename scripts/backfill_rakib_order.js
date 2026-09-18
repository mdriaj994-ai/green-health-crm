// scripts/backfill_rakib_order.js
const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

function backfillRakibOrder() {
  try {
    const dbPath = path.join(process.cwd(), "prisma", "social_inbox.db");
    const db = new Database(dbPath);

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

    const existing = db.prepare('SELECT id FROM "Order" WHERE senderId = ? OR phone = ?').get('28803100815982665', '01989765690');
    if (existing) {
      console.log("Rakib's order already exists in database with ID:", existing.id);
      db.close();
      return;
    }

    const id = "c" + crypto.randomBytes(16).toString("hex");
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO "Order" (id, customerName, phone, district, thana, address, product, quantity, senderId, facebookName, status, notes, pageId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      "রাকিব",
      "01989765690",
      "জয়পুরহাট",
      "কালাই",
      "কোড়াড়িপাড়া",
      "Soul Mate (খাঁটি কস্তুরী ফর্মুলা)",
      1,
      "28803100815982665",
      "Riaj Khan",
      "PENDING",
      "Facebook Messenger Order",
      "932259009980880",
      now,
      now
    );

    console.log("✅ Successfully inserted Rakib's order! ID:", id);
    db.close();
  } catch (err) {
    console.error("Backfill error:", err.message);
  }
}

if (require.main === module) {
  backfillRakibOrder();
}

module.exports = { backfillRakibOrder };
