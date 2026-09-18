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
    [/কস্তুরী\s*পাউডার|কস্তুরি\s*পাউডার|kasturi\s*powder|kosturi\s*powder/i, "কস্তুরী পাউডার (Kasturi Powder)"],
    [/কস্তুরী|কস্তুরি|হরিণের\s*কস্তুর|kasturi|kosturi|আব্দুল\s*করিম/i, "কস্তুরী পাউডার (Kasturi Powder)"],
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

// BD_DISTRICT_LIST for smart address splitting
const BD_DISTRICT_LIST = [
  "ঢাকা","চট্টগ্রাম","সিলেট","রাজশাহী","খুলনা","বরিশাল","ময়মনসিংহ","রংপুর",
  "কুমিল্লা","নোয়াখালী","ফেনী","গাজীপুর","নারায়ণগঞ্জ","মুন্সিগঞ্জ","মানিকগঞ্জ",
  "নরসিংদী","কিশোরগঞ্জ","টাঙ্গাইল","ফরিদপুর","গোপালগঞ্জ","মাদারীপুর","শরীয়তপুর",
  "রাজবাড়ী","জামালপুর","শেরপুর","নেত্রকোণা","সুনামগঞ্জ","মৌলভীবাজার","হবিগঞ্জ",
  "কক্সবাজার","বান্দরবান","রাঙামাটি","খাগড়াছড়ি","লক্ষ্মীপুর","চাঁদপুর","ব্রাহ্মণবাড়িয়া",
  "বগুড়া","পাবনা","সিরাজগঞ্জ","নাটোর","জয়পুরহাট","নওগাঁ","চাঁপাইনবাবগঞ্জ",
  "দিনাজপুর","নীলফামারী","লালমনিরহাট","গাইবান্ধা","ঠাকুরগাঁও","পঞ্চগড়","কুড়িগ্রাম",
  "যশোর","ঝিনাইদহ","মাগুরা","নড়াইল","সাতক্ষীরা","মেহেরপুর","চুয়াডাঙ্গা","কুষ্টিয়া",
  "ঝালকাঠি","পটুয়াখালী","বরগুনা","পিরোজপুর","ভোলা",
  // English variants
  "dhaka","chittagong","sylhet","rajshahi","khulna","barishal","barisal","mymensingh",
  "rangpur","comilla","noakhali","feni","gazipur","narayanganj","munshiganj",
  "manikganj","narsingdi","kishoreganj","tangail","faridpur","gopalganj","madaripur",
  "shariatpur","rajbari","jamalpur","sherpur","netrokona","sunamganj","moulvibazar",
  "habiganj","cox","bandarban","rangamati","khagrachhari","lakshmipur","chandpur",
  "brahmanbaria","bogura","bogra","pabna","sirajganj","natore","joypurhat","naogaon",
  "chapainawabganj","dinajpur","nilphamari","lalmonirhat","gaibandha","thakurgaon",
  "panchagarh","kurigram","jashore","jhenaidah","magura","narail","satkhira","meherpur",
  "chuadanga","kushtia","jhalokati","patuakhali","barguna","pirojpur","bhola"
];

// Smart address parser — handles comma-separated addresses like:
// বামনগ্রাম,কালাই,জয়পুরহাট  →  address=বামনগ্রাম, thana=কালাই, district=জয়পুরহাট
function smartSplitAddress(rawAddress, existingDistrict, existingThana) {
  if (!rawAddress) return { address: "", thana: existingThana || "", district: existingDistrict || "" };

  // If district/thana already provided explicitly, just use address as-is
  if (existingDistrict && existingThana) {
    return { address: rawAddress, thana: existingThana, district: existingDistrict };
  }

  // Try comma split: last part = district, middle = thana, first = village/street
  const parts = rawAddress.split(/[,،،،]/g).map(p => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    // Format: গ্রাম, থানা, জেলা  OR  রোড, এলাকা, থানা, জেলা
    const lastPart = parts[parts.length - 1];
    const midPart  = parts[parts.length - 2];
    const restParts = parts.slice(0, parts.length - 2).join(", ");
    // Check if last part is a known district
    const lastLow = lastPart.toLowerCase();
    const isDistrictName = BD_DISTRICT_LIST.some(d => lastLow.includes(d) || d.includes(lastLow));
    if (isDistrictName) {
      return {
        address: restParts || parts[0] || rawAddress,
        thana: existingThana || midPart,
        district: existingDistrict || lastPart
      };
    }
  } else if (parts.length === 2) {
    // Format: থানা, জেলা — address field becomes thana+district, no village given
    const lastLow = parts[parts.length - 1].toLowerCase();
    const isDistrictName = BD_DISTRICT_LIST.some(d => lastLow.includes(d) || d.includes(lastLow));
    if (isDistrictName) {
      return {
        address: existingDistrict ? rawAddress : "",
        thana: existingThana || parts[0],
        district: existingDistrict || parts[1]
      };
    }
  }

  // Also check if the combined address string contains a district name
  if (!existingDistrict) {
    for (const d of BD_DISTRICT_LIST) {
      if (rawAddress.toLowerCase().includes(d)) {
        return { address: rawAddress, thana: existingThana || "", district: d };
      }
    }
  }

  return { address: rawAddress, thana: existingThana || "", district: existingDistrict || "" };
}

function parseOrderFromMessage(text) {
  if (!text) return null;

  // 1. Explicit form key match (নাম=, নাম্বার=, জেলা=, etc.)
  const nameMatch     = text.match(/(?:নাম|name)\s*[=:]\s*([^\n,]+)/i) || text.match(/(?:আমার নাম|নাম হলো|নামঃ)\s*([^\n,]+)/i);
  const phoneMatch    = text.match(/(?:নাম্বার|number|phone|mobile|mob)\s*[=:]\s*([০-৯0-9\-\+\s]{7,15})/i) ||
                        text.match(/(?:\+?880|0)?1[3-9][০-৯0-9\-\s]{8,12}/);
  const districtMatch = text.match(/(?:জেলা|district|zela)\s*[=:]\s*([^\n,]+)/i);
  const thanaMatch    = text.match(/(?:থানা|thana|upazila|উপজেলা)\s*[=:]\s*([^\n,]+)/i);
  const addressMatch  = text.match(/(?:রিসিভ\s*ঠিকানা|ঠিকানা|address|thikana)\s*[=:]\s*(.+)/i);
  const qtyMatch      = text.match(/(?:পরিমাণ|কয়টা|সংখ্যা|quantity|qty|পিস|ফাইল)\s*[=:]\s*([০-৯0-9]+)/i) ||
                        text.match(/([০-৯0-9]+)\s*(?:টা|টি|ফাইল|পিস|কোটা|কৌটা|বোতল|pack|pcs|piece)/i);

  const name     = nameMatch?.[1]?.trim() || "";
  const rawPhone = phoneMatch?.[1] ? phoneMatch[1].trim().replace(/\s/g, "") : (phoneMatch?.[0] ? phoneMatch[0].trim().replace(/\s/g, "") : "");
  const phone    = rawPhone ? bnToEnNum(rawPhone).replace(/^\+?88/, "") : "";
  let rawDistrict = districtMatch?.[1]?.trim() || "";
  let rawThana    = thanaMatch?.[1]?.trim() || "";
  let rawAddress  = addressMatch?.[1]?.trim() || "";
  const product  = detectProductInText(text);

  // If district not explicit, search BD_DISTRICT_LIST in text
  if (!rawDistrict) {
    const lowText = text.toLowerCase();
    for (const d of BD_DISTRICT_LIST) {
      if (lowText.includes(d)) {
        rawDistrict = d;
        break;
      }
    }
  }

  // If thana not explicit, search for word before "থানা" or "উপজেলা"
  if (!rawThana) {
    const tm = text.match(/([^\s,]+)\s*(?:থানা|উপজেলা)/i);
    if (tm && tm[1]) rawThana = tm[1].trim();
  }

  // If address not explicit, search for village / area keywords
  if (!rawAddress) {
    const am = text.match(/([^\s,]+)\s*(?:গ্রাম|রোড|মহল্লা|পাড়া|পাড়া)/i);
    if (am && am[1]) rawAddress = am[0].trim();
  }

  let quantity = 1;
  if (qtyMatch && qtyMatch[1]) {
    const parsedQty = parseInt(bnToEnNum(qtyMatch[1]), 10);
    if (!isNaN(parsedQty) && parsedQty > 0) quantity = parsedQty;
  }

  // If we have a phone number OR (name + address/district), consider it valid
  if (!phone && (!name || !rawDistrict)) return null;

  // Smart address split
  const addrParts = smartSplitAddress(rawAddress || text, rawDistrict, rawThana);

  return {
    name,
    phone,
    district: addrParts.district || rawDistrict,
    thana:    addrParts.thana    || rawThana,
    address:  addrParts.address  || rawAddress,
    product:  product || "",
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
