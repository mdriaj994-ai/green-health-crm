// dashboard_api_bridge.js
// Reads from the Data Dashboard JSON files directly and serves clean product data + Facebook image attachment IDs + Persistent Context
const http = require('http');
const fs = require('fs');
const path = require('path');

const DASHBOARD_DIR = path.join('d:', 'Ads Power And All akhane ase may mas', 'Data Deshbord');
const DB_FILE = path.join(DASHBOARD_DIR, 'medicine_master_complete_db.json');
const EDITS_FILE = path.join(DASHBOARD_DIR, 'custom_user_edits.json');
const IMAGE_DIR = path.join(DASHBOARD_DIR, 'Product Image');
const CONTEXT_FILE = path.join(__dirname, '..', '.chat_context.json');
const HISTORY_FILE = path.join(__dirname, '..', '.chat_history.json');
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";
const PORT = 8081;
const MAX_HISTORY_PER_USER = 8; // last 8 message turns

// Load persistent conversation context
let userContext = {};
try {
  if (fs.existsSync(CONTEXT_FILE)) {
    userContext = JSON.parse(fs.readFileSync(CONTEXT_FILE, 'utf8'));
  }
} catch(e) {}

function saveContext() {
  try { fs.writeFileSync(CONTEXT_FILE, JSON.stringify(userContext, null, 2)); } catch(e) {}
}

// Conversation History (per sender)
let chatHistory = {};
try {
  if (fs.existsSync(HISTORY_FILE)) {
    chatHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  }
} catch(e) {}

function saveHistory() {
  try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(chatHistory, null, 2)); } catch(e) {}
}

function addToHistory(senderId, role, text) {
  if (!senderId || !text) return;
  if (!chatHistory[senderId]) chatHistory[senderId] = [];
  chatHistory[senderId].push({ role, text, ts: Date.now() });
  // Keep only last MAX_HISTORY_PER_USER turns
  if (chatHistory[senderId].length > MAX_HISTORY_PER_USER) {
    chatHistory[senderId] = chatHistory[senderId].slice(-MAX_HISTORY_PER_USER);
  }
  saveHistory();
}

function getHistory(senderId) {
  if (!senderId || !chatHistory[senderId]) return [];
  // Clean up old history (older than 24 hours)
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);
  chatHistory[senderId] = chatHistory[senderId].filter(h => h.ts > cutoff);
  return chatHistory[senderId];
}

const ATTACHMENT_FILE = path.join(DASHBOARD_DIR, 'facebook_attachments.json');
let attachmentCache = {};
try {
  if (fs.existsSync(ATTACHMENT_FILE)) {
    attachmentCache = JSON.parse(fs.readFileSync(ATTACHMENT_FILE, 'utf8'));
  }
} catch(e) {}

async function getFacebookAttachmentId(imageFileName) {
  if (!imageFileName) return null;
  const baseName = path.basename(imageFileName);
  if (attachmentCache[baseName]) {
    return attachmentCache[baseName];
  }

  const filePath = path.join(IMAGE_DIR, baseName);
  if (!fs.existsSync(filePath)) return null;

  try {
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const fileBlob = new Blob([fs.readFileSync(filePath)], { type: mimeType });
    const form = new FormData();
    form.append('message', JSON.stringify({ attachment: { type: 'image', payload: { is_reusable: true } } }));
    form.append('filedata', fileBlob, baseName);

    const res = await fetch(`https://graph.facebook.com/v19.0/me/message_attachments?access_token=${PAGE_TOKEN}`, {
      method: 'POST',
      body: form
    });
    const data = await res.json();
    if (data.attachment_id) {
      console.log(`[BRIDGE_FB_IMG] Uploaded ${baseName} -> Attachment ID: ${data.attachment_id}`);
      attachmentCache[baseName] = data.attachment_id;
      try { fs.writeFileSync(ATTACHMENT_FILE, JSON.stringify(attachmentCache, null, 2), 'utf8'); } catch(e) {}
      return data.attachment_id;
    }
  } catch (err) {
    console.warn(`[BRIDGE_FB_IMG_WARN]`, err.message);
  }
  return null;
}

function loadProducts() {
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const edits = JSON.parse(fs.readFileSync(EDITS_FILE, 'utf8'));

    const nameMap = new Map();
    db.forEach((p, i) => {
      const sl = String(p.SL || i + 1);
      const rawName = (p['ওষুধের নাম (Brand Name)'] || '').trim();
      if (!rawName || rawName.startsWith('"brand')) return;

      const e = edits[sl] || {};
      const imgFile = p['ফাইলের নাম (File Name)'] || '';
      const product = {
        sl,
        name: rawName,
        price: e.custom_price || '',
        discount: e.discount_price || '',
        stock: e.stock_status || 'in_stock',
        stockCount: e.stock_count || '',
        customNote: e.custom_note || '',
        customPitch: e.custom_pitch || '',
        dosageForm: p['ডোজ ফর্ম ও শক্তি (Dosage Form & Strength)'] || '',
        indication: (p['৫. ক্লিনিক্যাল নির্দেশিকা ও ব্যবহার (Therapeutic Indications)'] || '').substring(0, 400),
        painPoint: (p['১. কাস্টমারের আসল সমস্যা ও পেইন পয়েন্ট (Pain Point Mapping)'] || '').substring(0, 300),
        hookScript: (p['৭.১ হুক মেসেজ স্ক্রিপ্ট (Hook Script)'] || '').substring(0, 200),
        closingScript: (p['৭.৩ অর্ডার ক্লোজিং স্ক্রিপ্ট (Closing Script)'] || '').substring(0, 200),
        dosage: (p['১৩. স্ট্যান্ডার্ড মেডিকেল ডোজ ও সেবন প্রোটোকল (Dosage & Protocols)'] || '').substring(0, 300),
        ingredients: (p['২. রাসায়নিক ও সক্রিয় উপাদানের বিশ্লেষণ (Molecular Phytochemistry)'] || '').substring(0, 600),
        pharmProfile: (p['১. ড্রাগ পরিচিতি ও উৎপাদন প্রোফাইল (Pharmaceutical Profile)'] || '').substring(0, 300),
        imageFile: imgFile,
        imageUrl: `http://localhost:8080/Product Image/${imgFile}`,
      };

      const key = rawName.toLowerCase().replace(/\s+/g, ' ');
      if (!nameMap.has(key) || (product.price && !nameMap.get(key).price)) {
        nameMap.set(key, product);
      }
    });

    return Array.from(nameMap.values()).filter(p => p.stock !== 'out_of_stock');
  } catch (e) {
    console.error('[BRIDGE] Error loading DB:', e.message);
    return [];
  }
}

function buildAIContext(products) {
  let ctx = 'আমাদের পণ্য তালিকা (গ্রীন হেলথ ইউনানী ফার্মা):\n\n';
  products.forEach((p, i) => {
    ctx += `${i + 1}. ${p.name}`;
    if (p.dosageForm) ctx += ` (${p.dosageForm})`;
    if (p.price) ctx += ` | মূল্য: ${p.price}৳`;
    if (p.discount) ctx += ` | অফার মূল্য: ${p.discount}৳`;
    if (p.stockCount) ctx += ` | স্টক: ${p.stockCount}`;
    ctx += '\n';
    if (p.painPoint) ctx += `   কাজ: ${p.painPoint.substring(0, 150).replace(/\n/g, ' ')}\n`;
    if (p.ingredients) ctx += `   উপাদান: ${p.ingredients.substring(0, 350).replace(/\n/g, ' ')}\n`;
    if (p.dosage) ctx += `   ডোজ: ${p.dosage.substring(0, 100).replace(/\n/g, ' ')}\n`;
    if (p.customPitch) ctx += `   বিশেষ: ${p.customPitch.substring(0, 80)}\n`;
  });
  return ctx;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const parsedUrl = new URL(req.url, 'http://localhost');

  if (parsedUrl.pathname === '/api/products' || parsedUrl.pathname === '/api/products/all') {
    const products = loadProducts();
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'success', count: products.length, data: products }));

  } else if (parsedUrl.pathname === '/api/ai-context') {
    const products = loadProducts();
    const context = buildAIContext(products);
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'success', count: products.length, context }));

  } else if (parsedUrl.pathname === '/api/context') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const { senderId, productKey } = JSON.parse(body);
          if (senderId && productKey) {
            userContext[senderId] = { productKey, timestamp: Date.now() };
            saveContext();
          }
          res.writeHead(200);
          res.end(JSON.stringify({ status: 'success' }));
        } catch(e) {
          res.writeHead(400);
          res.end(JSON.stringify({ status: 'error', message: e.message }));
        }
      });
    } else {
      const sId = parsedUrl.searchParams.get('senderId') || '';
      const ctx = userContext[sId] || null;
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'success', context: ctx }));
    }

  } else if (parsedUrl.pathname === '/api/history') {
    if (req.method === 'POST') {
      // Save a new message turn to history
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const { senderId, customerText, botReply } = JSON.parse(body);
          if (senderId && customerText) {
            addToHistory(senderId, 'customer', customerText);
            if (botReply) {
              addToHistory(senderId, 'bot', botReply);
              // Also sync bot reply into Social Inbox SQLite DB so it appears in the dashboard chat UI
              try {
                const sqlitePath = path.join(__dirname, '..', 'prisma', 'social_inbox.db');
                if (fs.existsSync(sqlitePath)) {
                  const Database = require('better-sqlite3');
                  const db = new Database(sqlitePath);
                  const contact = db.prepare('SELECT id FROM "Contact" WHERE platformUserId = ?').get(senderId);
                  if (contact) {
                    const conv = db.prepare('SELECT id FROM "Conversation" WHERE contactId = ? ORDER BY updatedAt DESC LIMIT 1').get(contact.id);
                    if (conv) {
                      const msgId = require('crypto').randomUUID();
                      const now = new Date().toISOString();
                      db.prepare(`
                        INSERT INTO "Message" (id, content, "messageType", "senderType", "isRead", "createdAt", "conversationId")
                        VALUES (?, ?, 'TEXT', 'BOT', 1, ?, ?)
                      `).run(msgId, botReply, now, conv.id);
                      db.prepare(`UPDATE "Conversation" SET "lastMessageAt" = ?, "updatedAt" = ? WHERE id = ?`).run(now, now, conv.id);
                    }
                  }
                  db.close();
                }
              } catch(dbErr) {
                console.error('[BRIDGE_SQLITE_REPLY_SYNC_ERROR]', dbErr.message);
              }
            }
          }
          res.writeHead(200);
          res.end(JSON.stringify({ status: 'success' }));
        } catch(e) {
          res.writeHead(400);
          res.end(JSON.stringify({ status: 'error', message: e.message }));
        }
      });
    } else {
      // GET - retrieve history for a sender
      const sId = parsedUrl.searchParams.get('senderId') || '';
      const history = getHistory(sId);
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'success', history }));
    }

  } else if (parsedUrl.pathname === '/api/search') {
    const q = (parsedUrl.searchParams.get('q') || '').toLowerCase().trim();
    const senderId = parsedUrl.searchParams.get('senderId') || '';
    const products = loadProducts();

    // Check if query directly references a product
    let bestProduct = null;
    let maxScore = 0;

    for (const p of products) {
      let score = 0;
      const pName = p.name.toLowerCase();

      // Direct matches
      if (q.includes('soul mate') || q.includes('সোল মেট') || q.includes('সোলমেট') || q.includes('soulmate') || q.includes('soul met') || q.includes('soulmet')) {
        if (pName.includes('soul mate')) score += 150;
      } else if (q.includes('burner') || q.includes('বার্নার') || q.includes("men's burner") || q.includes('মেনস বার্নার')) {
        if (pName.includes('burner')) score += 120;
      } else if (q.includes('black lion') || q.includes('ব্ল্যাক লায়ন') || q.includes('ব্ল্যাক লায়ন') || q.includes('su tử đen')) {
        if (pName.includes('black lion') || pName.includes('sư tử đen')) score += 120;
      } else if (q.includes('black ginseng') || q.includes('ব্ল্যাক জিনসেং') || q.includes('জিনসেং') || q.includes('ginseng')) {
        if (pName.includes('black ginseng') || pName.includes('জিনসেং')) score += 100;
      } else if (q.includes('dream touch') || q.includes('ড্রিম টাচ') || q.includes('ড্রিম') || (q.includes('touch') && !q.includes('soul'))) {
        if (pName.includes('dream touch')) score += 120;
      } else if (q.includes('egypt') || q.includes('গাওয়া') || q.includes('গাওয়া')) {
        if (pName.includes('egypt') || pName.includes('gawa')) score += 100;
      } else if (q.includes('sex king') || q.includes('সেক্স কিং')) {
        if (pName.includes('sex king')) score += 100;
      } else if (q.includes('ambar') || q.includes('অম্বর') || q.includes('amber')) {
        if (pName.includes('ambar') || pName.includes('অম্বর') || pName.includes('amber')) score += 80;
      } else if (q.includes('zobli') || q.includes('জোবলি') || q.includes('জোব্লি')) {
        if (pName.includes('zobli') || pName.includes('জোবলি')) score += 80;
      } else if (q.includes('maxdrive') || q.includes('ম্যাক্সড্রাইভ') || q.includes('ম্যাক্স ড্রাইভ')) {
        if (pName.includes('maxdrive')) score += 100;
      } else if (q.includes('hunter') || q.includes('হান্টার') || q.includes('ইনজয়')) {
        if (pName.includes('hunter')) score += 100;
      } else if (q.includes('men') || q.includes('ম্যান')) {
        if (pName.includes('men')) score += 50;
      }

      // Word matching
      const words = q.split(/\s+/).filter(w => w.length > 2);
      for (const w of words) {
        if (pName.includes(w)) score += 15;
      }

      if (score > maxScore) {
        maxScore = score;
        bestProduct = p;
      }
    }

    // If no direct product name matched, check if customer has an active product in context
    if (!bestProduct && senderId && userContext[senderId]) {
      const prevKey = (userContext[senderId].productKey || '').toLowerCase();
      bestProduct = products.find(p => p.name.toLowerCase().includes(prevKey)) || null;
    }

    if (bestProduct && maxScore > 0 && senderId) {
      // Remember this product for this user
      userContext[senderId] = { productKey: bestProduct.name, timestamp: Date.now() };
      saveContext();
    }

    if (bestProduct) {
      const attachmentId = await getFacebookAttachmentId(bestProduct.imageFile);
      bestProduct.imageAttachmentId = attachmentId;
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'success', count: 1, data: [bestProduct] }));
    } else {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'success', count: 0, data: [] }));
    }

  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ status: 'error', message: 'Not found' }));
  }
});

server.listen(PORT, () => {
  const products = loadProducts();
  console.log(`[BRIDGE] Dashboard API Bridge running on port ${PORT}`);
  console.log(`[BRIDGE] Loaded ${products.length} unique products from dashboard`);
});
