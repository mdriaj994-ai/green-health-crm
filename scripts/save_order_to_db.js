// scripts/save_order_to_db.js
// Parses order form from bot reply and saves to SQLite Order table
const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

function generateCuid() {
  return "c" + crypto.randomBytes(16).toString("hex");
}

function parseOrderFromMessage(text) {
  if (!text) return null;

  // Match the order form format:
  // নাম=...
  // জেলা=...
  // থানা=...
  // রিসিভ ঠিকানা=...
  // নাম্বার =...
  const nameMatch    = text.match(/(?:নাম|name)\s*[=:]\s*(.+)/i);
  const phoneMatch   = text.match(/(?:নাম্বার|number|phone|mobile|mob)\s*[=:]\s*([০-৯0-9\-\+\s]{7,15})/i);
  const districtMatch = text.match(/(?:জেলা|district|zela)\s*[=:]\s*(.+)/i);
  const thanaMatch   = text.match(/(?:থানা|thana|upazila|উপজেলা)\s*[=:]\s*(.+)/i);
  const addressMatch = text.match(/(?:রিসিভ\s*ঠিকানা|ঠিকানা|address|thikana)\s*[=:]\s*(.+)/i);

  const name    = nameMatch?.[1]?.trim();
  const phone   = phoneMatch?.[1]?.trim().replace(/\s/g, "");
  const district = districtMatch?.[1]?.trim();
  const thana   = thanaMatch?.[1]?.trim();
  const address = addressMatch?.[1]?.trim();

  // Need at least name + phone to consider it an order
  if (!name || !phone) return null;

  return { name, phone, district: district || "", thana: thana || "", address: address || "" };
}

function saveOrderToDb(orderData) {
  try {
    const dbPath = path.join(process.cwd(), "prisma", "social_inbox.db");
    const db = new Database(dbPath);

    // Check if Order table exists
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Order'").get();
    if (!tableExists) {
      console.log("[ORDER_SAVE] Order table does not exist yet, skipping");
      db.close();
      return false;
    }

    // Check for duplicate order from same sender in last 30 minutes
    const recent = db.prepare(
      "SELECT id FROM \"Order\" WHERE senderId = ? AND createdAt > datetime('now', '-30 minutes')"
    ).get(orderData.senderId);

    if (recent) {
      console.log(`[ORDER_SAVE] Recent order from ${orderData.senderId} already exists, skipping duplicate`);
      db.close();
      return false;
    }

    const id = generateCuid();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO "Order" (id, customerName, phone, district, thana, address, product, quantity, senderId, facebookName, status, notes, pageId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      orderData.customerName || "অজ্ঞাত",
      orderData.phone || "",
      orderData.district || "",
      orderData.thana || "",
      orderData.address || "",
      orderData.product || "",
      orderData.quantity || 1,
      orderData.senderId || "",
      orderData.facebookName || "",
      "PENDING",
      orderData.notes || "",
      orderData.pageId || "",
      now,
      now
    );

    db.close();
    console.log(`[ORDER_SAVE] ✅ Order saved! Customer: ${orderData.customerName} | Phone: ${orderData.phone}`);
    return true;
  } catch (err) {
    console.error("[ORDER_SAVE] Error:", err.message);
    return false;
  }
}

module.exports = { parseOrderFromMessage, saveOrderToDb };
