// scripts/migrate_existing_chats.js
// Migrates ALL existing customer data from flat files → folder-per-customer structure
// Safe to run multiple times (idempotent)
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "..", "data");
const MEMORY_FILE = path.join(DATA_DIR, "customer_memory.json");
const CUSTOMERS_DIR = path.join(DATA_DIR, "customers");

async function migrate() {
  console.log("🔄 Starting customer data migration...");
  console.log("   Source:", MEMORY_FILE);
  console.log("   Target:", CUSTOMERS_DIR);

  if (!fs.existsSync(DATA_DIR)) {
    console.log("❌ data/ directory not found.");
    return;
  }

  // ── Load all customer data from customer_memory.json ──
  let allCustomers = {};
  if (fs.existsSync(MEMORY_FILE)) {
    try {
      allCustomers = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
      console.log(`✅ Loaded ${Object.keys(allCustomers).length} customers from customer_memory.json`);
    } catch (e) {
      console.log("⚠️ Could not parse customer_memory.json:", e.message);
    }
  }

  // ── Also load from flat customer files (data/customers/{id}.json) ──
  if (!fs.existsSync(CUSTOMERS_DIR)) {
    fs.mkdirSync(CUSTOMERS_DIR, { recursive: true });
  }

  const flatFiles = fs.readdirSync(CUSTOMERS_DIR).filter(f => f.endsWith(".json") && !fs.statSync(path.join(CUSTOMERS_DIR, f)).isDirectory());
  console.log(`📁 Found ${flatFiles.length} flat customer files to migrate`);

  for (const file of flatFiles) {
    const senderId = file.replace(".json", "");
    try {
      const data = JSON.parse(fs.readFileSync(path.join(CUSTOMERS_DIR, file), "utf-8"));
      if (data.senderId && !allCustomers[senderId]) {
        allCustomers[senderId] = data;
      } else if (data.senderId && allCustomers[senderId]) {
        // Merge chatLogs
        const existing = allCustomers[senderId].chatLog || [];
        const fromFile = data.chatLog || [];
        const existingTimes = new Set(existing.map(m => m.time));
        const merged = [...existing, ...fromFile.filter(m => !existingTimes.has(m.time))];
        merged.sort((a, b) => a.time - b.time);
        allCustomers[senderId].chatLog = merged;
      }
    } catch {}
  }

  // ── Migrate each customer to folder structure ──
  let migrated = 0;
  let skipped = 0;

  for (const [senderId, profile] of Object.entries(allCustomers)) {
    const customerFolder = path.join(CUSTOMERS_DIR, String(senderId));

    // Create folder if not exists
    if (!fs.existsSync(customerFolder)) {
      fs.mkdirSync(customerFolder, { recursive: true });
    }

    const histFile = path.join(customerFolder, "history.json");
    const profFile = path.join(customerFolder, "profile.json");

    // ── Save history.json (all chat messages) ──
    const chatLog = profile.chatLog || [];
    let existingHistory = [];
    if (fs.existsSync(histFile)) {
      try { existingHistory = JSON.parse(fs.readFileSync(histFile, "utf-8")); } catch {}
    }

    // Merge and deduplicate by time
    const existingTimes = new Set(existingHistory.map(m => m.time));
    const newMsgs = chatLog.filter(m => m.time && !existingTimes.has(m.time));
    const mergedHistory = [...existingHistory, ...newMsgs].sort((a, b) => a.time - b.time);

    if (mergedHistory.length > 0) {
      fs.writeFileSync(histFile, JSON.stringify(mergedHistory, null, 2), "utf-8");
    }

    // ── Save profile.json (without chatLog) ──
    const profileData = Object.assign({}, profile);
    delete profileData.chatLog; // store history separately
    fs.writeFileSync(profFile, JSON.stringify(profileData, null, 2), "utf-8");

    migrated++;
    const name = profile.name || "Unknown";
    const msgs = mergedHistory.length;
    console.log(`  ✅ ${senderId} (${name}) → ${msgs} messages migrated`);
  }

  console.log(`\n🎉 Migration complete!`);
  console.log(`   ✅ ${migrated} customers migrated`);
  console.log(`   📁 Folder structure: data/customers/{senderId}/profile.json + history.json`);
  console.log(`   💾 Total message history preserved: unlimited`);
}

migrate().catch(console.error);
