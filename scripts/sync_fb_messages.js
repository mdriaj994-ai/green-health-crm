// scripts/sync_fb_messages.js
// Synchronizes both Customer AND Page/Bot messages from Facebook Graph API into SQLite
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const PAGE_ID = process.env.FACEBOOK_PAGE_ID || "932259009980880";
// Always-valid permanent fallback token
const PERM_TOKEN = "EAAjkLPT8UegBSS7FFS7CknaL7eRbabMG9g7TJZCu4SQ20ea2sRDLSEZBX2RJlV0yYXneKCHX50m43kYnNUE6LKE6WizMRwsnoCw7fBzyeF88NEZCdb0nu68OmfDZC6rExH9LiWIjxJTPtZBw9m6cSUT98VoIzToz6ZAGV7BJylUTKo1WZC4wFEBk6aAs9KuhsSN17Jp";

// Resolve token: DB > env var > hardcoded
function getPageToken() {
  try {
    const dbPath = path.join(__dirname, "..", "prisma", "social_inbox.db");
    if (fs.existsSync(dbPath)) {
      const _db = new Database(dbPath);
      const row = _db.prepare("SELECT accessToken FROM ConnectedAccount WHERE platform = 'FACEBOOK'").get();
      _db.close();
      if (row?.accessToken && row.accessToken.length > 50) return row.accessToken;
    }
  } catch {}
  return process.env.FACEBOOK_PAGE_ACCESS_TOKEN || PERM_TOKEN;
}
const PAGE_TOKEN = getPageToken();

async function syncFacebookMessages() {
  const dbPath = path.join(__dirname, "..", "prisma", "social_inbox.db");
  if (!fs.existsSync(dbPath)) {
    console.error("[SYNC] Database not found at", dbPath);
    return;
  }
  const db = new Database(dbPath);

  // Get or create connected account
  let account = db.prepare("SELECT * FROM ConnectedAccount WHERE platform = 'FACEBOOK'").get();
  if (!account) {
    account = db.prepare("SELECT * FROM ConnectedAccount LIMIT 1").get();
  }
  if (!account) {
    const accId = require("crypto").randomUUID();
    const now = new Date().toISOString();
    db.prepare("INSERT INTO ConnectedAccount (id, platform, pageId, pageName, accessToken, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, ?, ?)").run(
      accId, "FACEBOOK", PAGE_ID, "হেলথ কেয়ার", PAGE_TOKEN, now, now
    );
    account = { id: accId };
  }
  const accountId = account.id;

  console.log(`[SYNC] Fetching conversations for Page ${PAGE_ID}...`);
  const url = `https://graph.facebook.com/v19.0/${PAGE_ID}/conversations?fields=messages.limit(50){message,from,created_time,id,attachments}&limit=40&access_token=${PAGE_TOKEN}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.data || !Array.isArray(data.data)) {
    console.warn("[SYNC] No conversations returned:", data);
    db.close();
    return;
  }

  let insertedCount = 0;

  for (const c of data.data) {
    const msgs = (c.messages?.data || []).slice().reverse(); // Oldest first
    if (msgs.length === 0) continue;

    // Find the customer participant
    const customerMsg = msgs.find(m => m.from && String(m.from.id) !== String(PAGE_ID));
    if (!customerMsg || !customerMsg.from) continue;

    const customerId = String(customerMsg.from.id);
    const customerName = customerMsg.from.name || "Facebook Customer";

    // Upsert Contact
    let contact = db.prepare("SELECT * FROM Contact WHERE platformUserId = ?").get(customerId);
    if (!contact) {
      const cId = require("crypto").randomUUID();
      const now = new Date().toISOString();
      db.prepare("INSERT INTO Contact (id, platformUserId, platform, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)").run(
        cId, customerId, "MESSENGER", customerName, now, now
      );
      contact = { id: cId };
    } else if (customerName && contact.name === "Facebook Customer") {
      db.prepare("UPDATE Contact SET name = ? WHERE id = ?").run(customerName, contact.id);
    }

    // Upsert Conversation
    const convId = `conv_${accountId}_${contact.id}`;
    let conv = db.prepare("SELECT * FROM Conversation WHERE id = ?").get(convId);
    if (!conv) {
      const now = new Date().toISOString();
      db.prepare("INSERT INTO Conversation (id, contactId, accountId, status, isRead, createdAt, updatedAt, lastMessageAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
        convId, contact.id, accountId, "OPEN", 1, now, now, now
      );
    }

    let lastTime = null;

    for (const m of msgs) {
      const isFromPage = String(m.from?.id) === String(PAGE_ID);
      const senderType = isFromPage ? "BOT" : "CUSTOMER";
      const content = m.message || "";
      if (!content.trim()) continue;

      const createdAt = m.created_time || new Date().toISOString();
      lastTime = createdAt;

      const existing = db.prepare("SELECT id FROM Message WHERE platformMsgId = ?").get(m.id);
      if (!existing) {
        const mId = require("crypto").randomUUID();
        db.prepare(`
          INSERT INTO Message (id, content, messageType, senderType, platformMsgId, isRead, createdAt, conversationId)
          VALUES (?, ?, 'TEXT', ?, ?, 1, ?, ?)
        `).run(mId, content, senderType, m.id, createdAt, convId);
        insertedCount++;
      }
    }

    if (lastTime) {
      db.prepare("UPDATE Conversation SET lastMessageAt = ?, updatedAt = ? WHERE id = ?").run(lastTime, lastTime, convId);
    }
  }

  const totalBots = db.prepare("SELECT COUNT(*) as c FROM Message WHERE senderType IN ('BOT', 'AGENT')").get().c;
  const totalCust = db.prepare("SELECT COUNT(*) as c FROM Message WHERE senderType = 'CUSTOMER'").get().c;
  console.log(`[SYNC] Success! Inserted ${insertedCount} new messages. (Now: ${totalBots} Bot/Agent replies, ${totalCust} Customer messages).`);

  db.close();
}

module.exports = { syncFacebookMessages };

if (require.main === module) {
  syncFacebookMessages().catch(console.error);
}
