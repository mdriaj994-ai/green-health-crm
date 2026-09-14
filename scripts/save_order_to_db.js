// scripts/save_order_to_db.js
// Parses order form from bot reply and saves to SQLite Order table
const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

function generateCuid() {
  return "c" + crypto.randomBytes(16).toString("hex");
}

function bnToEnNum(str) {
  if (!str) return "";
  const bn = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(str).replace(/[০-৯]/g, (d) => bn.indexOf(d));
}

function detectProductInText(text) {
  if (!text) return "";
  const prodMatch = text.match(/(?:প্রোডাক্ট|পণ্য|আইটেম|মেডিসিন|product|item|medicine)\s*[=:]\s*(.+)/i);
  if (prodMatch && prodMatch[1].trim()) return prodMatch[1].trim();

  const PRODS = [
    [/কস্তুরী|কস্তুরি|হরিণের\s*কস্তুর|kasturi|kosturi/i, "Soul Mate (খাঁটি কস্তুরী ফর্মুলা)"],
    [/amber|ambar|অম্বার|অম্বর|অ্যাম্বার|বিছানা\s*রাজা/i, "AMBER Premium"],
    [/soul\s*mate|সোল\s*মেট|সুল\s*মেট/i, "Soul Mate"],
    [/dream\s*touch|ড্রিম\s*টাচ|ড্রিমটাচ/i, "Dream Touch"],
    [/men'?s\s*burner|মেনস\s*বার্নার|বার্নার/i, "Men's Burner"],
    [/men'?s\s*black\s*velvet|black\s*velvet|ব্ল্যাক\s*ভেলভেট|ভেলভেট/i, "Men's Black Velvet"],
    [/black\s*ginseng|ব্ল্যাক\s*জিনসেং|জিনসেং|ginseng/i, "Black Ginseng"],
    [/egypt\s*gawa|ইজিপ্ট\s*গাওয়া|গাওয়া|গাওয়া/i, "Egypt Gawa"],
    [/enjoy\s*hunter|হান্টার/i, "Enjoy Hunter"],
    [/sex\s*king|সেক্স\s*কিং/i, "Sex King (섹스킹)"],
    [/titan\s*gel|টাইটান\s*জেল/i, "Titan Gel"],
    [/maxman|ম্যাক্সম্যান/i, "Maxman"],
    [/viga|ভিগা/i, "Viga Spray"],
    [/vigrex|ভিগরেক্স/i, "Vigrex Plus"],
    [/hammer\s*of\s*thor|হ্যামার/i, "Hammer of Thor"],
    [/tiger\s*king|টাইগার\s*কিং/i, "Tiger King"],
    [/maxdrive|ম্যাক্সড্রাইভ/i, "MaxDrive"],
    [/passion\s*wave|প্যাশন\s*ওয়েভ/i, "Passion Wave"],
    [/parsian\s*zobli|পার্সিয়ান\s*জোবলি|জোব্লি/i, "PARSIAN ZOBLI"],
    [/black\s*lion|ব্ল্যাক\s*লায়ন/i, "Black Lion"],
    [/jomdobe|দোস্তো/i, "Jomdobe Dosto"],
    [/penis\s*prime|পেনিস\s*প্রাইম/i, "Penis Prime"],
    [/hera\s*power|হেরা\s*পাওয়ার/i, "HERA POWER"],
    [/love\s*spark|লাভ\s*স্পার্ক/i, "Organic Love Spark"]
  ];
  for (const [rx, name] of PRODS) {
    if (rx.test(text)) return name;
  }
  return "";
}

function parseOrderFromMessage(text) {
  if (!text) return null;

  // Match the order form format:
  // নাম=...
  // জেলা=...
  // থানা=...
  // রিসিভ ঠিকানা=...
  // নাম্বার =...
  const nameMatch     = text.match(/(?:নাম|name)\s*[=:]\s*(.+)/i);
  const phoneMatch    = text.match(/(?:নাম্বার|number|phone|mobile|mob)\s*[=:]\s*([০-৯0-9\-\+\s]{7,15})/i);
  const districtMatch = text.match(/(?:জেলা|district|zela)\s*[=:]\s*(.+)/i);
  const thanaMatch    = text.match(/(?:থানা|thana|upazila|উপজেলা)\s*[=:]\s*(.+)/i);
  const addressMatch  = text.match(/(?:রিসিভ\s*ঠিকানা|ঠিকানা|address|thikana)\s*[=:]\s*(.+)/i);
  const qtyMatch      = text.match(/(?:পরিমাণ|কয়টা|সংখ্যা|quantity|qty|পিস|ফাইল)\s*[=:]\s*([০-৯0-9]+)/i) ||
                        text.match(/([০-৯0-9]+)\s*(?:টা|টি|ফাইল|পিস|কোটা|কৌটা|বোতল|pack|pcs|piece)/i);

  const name     = nameMatch?.[1]?.trim();
  const rawPhone = phoneMatch?.[1]?.trim().replace(/\s/g, "");
  const phone    = rawPhone ? bnToEnNum(rawPhone) : "";
  const district = districtMatch?.[1]?.trim();
  const thana    = thanaMatch?.[1]?.trim();
  const address  = addressMatch?.[1]?.trim();
  const product  = detectProductInText(text);

  let quantity = 1;
  if (qtyMatch && qtyMatch[1]) {
    const parsedQty = parseInt(bnToEnNum(qtyMatch[1]), 10);
    if (!isNaN(parsedQty) && parsedQty > 0) quantity = parsedQty;
  }

  // Need at least name + phone to consider it an order
  if (!name || !phone) return null;

  return {
    name,
    phone,
    district: district || "",
    thana: thana || "",
    address: address || "",
    product: product || "",
    quantity
  };
}

function ensureOrderTable(db) {
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
}

function saveOrderToDb(orderData) {
  try {
    const dbPath = path.join(process.cwd(), "prisma", "social_inbox.db");
    const db = new Database(dbPath);

    // Auto-create Order table if it doesn't exist (after Redeploy DB reset)
    ensureOrderTable(db);

    // Only prevent identical rapid double-click/spam within 20 seconds.
    // Legitimate 2nd orders, 3rd orders, or different products/quantities are ALWAYS allowed!
    const recent = db.prepare(
      "SELECT id FROM \"Order\" WHERE senderId = ? AND phone = ? AND createdAt > datetime('now', '-20 seconds')"
    ).get(orderData.senderId, orderData.phone);

    if (recent) {
      console.log(`[ORDER_SAVE] Rapid double-submit from ${orderData.senderId} within 20s, skipping duplicate`);
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
    console.log(`[ORDER_SAVE] ✅ Order saved! Customer: ${orderData.customerName} | Phone: ${orderData.phone} | Product: ${orderData.product || 'N/A'} | Qty: ${orderData.quantity || 1}`);
    return true;
  } catch (err) {
    console.error("[ORDER_SAVE] Error:", err.message);
    return false;
  }
}

module.exports = { parseOrderFromMessage, saveOrderToDb, detectProductInText };
