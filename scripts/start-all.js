// scripts/start-all.js
// Runs both Next.js and the 24/7 Real-time Facebook Messenger Engine in parallel inside Docker
const { spawn } = require("child_process");
const path = require("path");

console.log("==========================================");
console.log("  STARTING SOCIAL INBOX & FB REALTIME BOT ");
console.log("==========================================");

// 0. Ensure SQLite Database Persistence & Auto-Restore Orders across Coolify Redeploys
function initDatabasePersistence() {
  const fs = require("fs");
  const dataDir = path.join(process.cwd(), "data");
  const prismaDir = path.join(process.cwd(), "prisma");
  const persistentDb = path.join(dataDir, "social_inbox.db");
  const prismaDb = path.join(prismaDir, "social_inbox.db");
  const ordersBackupFile = path.join(dataDir, "orders_backup.json");

  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(prismaDir)) {
      fs.mkdirSync(prismaDir, { recursive: true });
    }

    // 1. Link / Sync SQLite DB with persistent volume (/app/data)
    if (fs.existsSync(persistentDb)) {
      console.log("[DB_PERSIST] 📁 Found persistent DB in data/social_inbox.db");
      try {
        if (fs.existsSync(prismaDb)) {
          try { fs.unlinkSync(prismaDb); } catch (_) {}
        }
        try {
          fs.symlinkSync(persistentDb, prismaDb);
          console.log("[DB_PERSIST] ✅ Symlinked prisma/social_inbox.db -> data/social_inbox.db");
        } catch (symErr) {
          fs.copyFileSync(persistentDb, prismaDb);
          console.log("[DB_PERSIST] 📋 Copied persistent DB to prisma/social_inbox.db");
        }
      } catch (e) {
        console.warn("[DB_PERSIST_WARN]", e.message);
      }
    } else if (fs.existsSync(prismaDb)) {
      console.log("[DB_PERSIST] 🚀 Initializing persistent DB from prisma/social_inbox.db");
      try {
        fs.copyFileSync(prismaDb, persistentDb);
        try {
          fs.unlinkSync(prismaDb);
          fs.symlinkSync(persistentDb, prismaDb);
        } catch (_) {}
      } catch (e) {
        console.warn("[DB_PERSIST_WARN]", e.message);
      }
    }

    // 2. Ensure Order table exists & auto-restore orders from orders_backup.json
    const Database = require("better-sqlite3");
    const activeDbPath = fs.existsSync(persistentDb) ? persistentDb : prismaDb;
    const db = new Database(activeDbPath);

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

    let backupOrders = [];
    if (fs.existsSync(ordersBackupFile)) {
      try {
        backupOrders = JSON.parse(fs.readFileSync(ordersBackupFile, "utf-8"));
      } catch (_) {}
    }

    const existingRows = db.prepare('SELECT * FROM "Order"').all();
    const existingIds = new Set(existingRows.map((o) => o.id));

    let restoredCount = 0;
    if (Array.isArray(backupOrders) && backupOrders.length > 0) {
      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO "Order" (id, customerName, phone, district, thana, address, product, quantity, senderId, facebookName, status, notes, pageId, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();
      for (const ord of backupOrders) {
        if (ord.id && !existingIds.has(ord.id)) {
          insertStmt.run(
            ord.id,
            ord.customerName || "অজ্ঞাত",
            ord.phone || "",
            ord.district || "",
            ord.thana || "",
            ord.address || "",
            ord.product || "",
            ord.quantity || 1,
            ord.senderId || "",
            ord.facebookName || "",
            ord.status || "PENDING",
            ord.notes || "",
            ord.pageId || "",
            ord.createdAt || now,
            ord.updatedAt || now
          );
          existingIds.add(ord.id);
          restoredCount++;
        }
      }
    }

    // Always keep backup JSON synchronized with all database orders
    const allCurrentOrders = db.prepare('SELECT * FROM "Order" ORDER BY createdAt DESC').all();
    fs.writeFileSync(ordersBackupFile, JSON.stringify(allCurrentOrders, null, 2), "utf-8");

    db.close();
    console.log(`[DB_PERSIST] 🎯 Orders in database: ${allCurrentOrders.length} (Restored from backup: ${restoredCount})`);
  } catch (initErr) {
    console.error("[DB_PERSIST_ERROR]", initErr.message);
  }
}

initDatabasePersistence();

// 1. Start Next.js Server on port 3000 binding to 0.0.0.0
function startNextServer() {
  console.log("[STARTUP] Launching Next.js Server on 0.0.0.0:3000...");
  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const nextProcess = spawn(process.execPath, [nextBin, "start", "-H", "0.0.0.0", "-p", "3000"], {
    stdio: "inherit",
    env: { ...process.env, HOSTNAME: "0.0.0.0", PORT: "3000" },
  });

  nextProcess.on("exit", (code) => {
    console.error(`[NEXTJS_STOPPED] Next.js process exited with code ${code}. Restarting in 3s...`);
    setTimeout(startNextServer, 3000);
  });
}

startNextServer();

// 2. Start 24/7 Facebook Realtime Bot Engine
function startBotProcess() {
  console.log("[STARTUP] Launching FB Realtime Bot Process...");
  const botScript = path.join(process.cwd(), "scripts", "fb_realtime_bot.js");
  const botProcess = spawn(process.execPath, [botScript], {
    stdio: "inherit",
    env: process.env,
  });

  botProcess.on("exit", (code) => {
    console.warn(`[FB_BOT_RESTART] Bot process exited with code ${code}. Restarting in 3s...`);
    setTimeout(startBotProcess, 3000);
  });
}

// Start bot 2 seconds after Next.js boots
setTimeout(startBotProcess, 2000);

// 3. Start Facebook Message Two-Way History Synchronizer
function runFbSync() {
  try {
    const { syncFacebookMessages } = require("./sync_fb_messages.js");
    syncFacebookMessages().catch((e) => console.warn("[FB_SYNC_WARN]", e.message));
  } catch (e) {
    console.warn("[FB_SYNC_LOAD_WARN]", e.message);
  }
}

// Initial sync after 5s, then every 60s
setTimeout(() => {
  runFbSync();
  setInterval(runFbSync, 60 * 1000);
}, 5000);

// Keep master process alive under all circumstances
process.on("uncaughtException", (err) => {
  console.error("[FATAL_UNCAUGHT_EXCEPTION]", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED_REJECTION]", reason);
});

