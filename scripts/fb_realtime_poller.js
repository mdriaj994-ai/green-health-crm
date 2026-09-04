// fb_realtime_poller.js - Strict dedup real-time Facebook Messenger poller
// Uses a global port mutex to ensure ONLY ONE instance runs at a time
const https = require('https');
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

const LOCK_PORT = 8089;
const PAGE_ID = "110644118793600";
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";
const PROCESSED_FILE = path.join(__dirname, '..', '.processed_msg_ids.json');

// ─── Single-Instance Port Mutex ───────────────────────────────────────────
const lockServer = net.createServer();
lockServer.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('[FB_POLLER] ⚠️ Another instance of fb_realtime_poller is already running. Exiting.');
    process.exit(0);
  }
});

lockServer.listen(LOCK_PORT, () => {
  startPoller();
});

function startPoller() {
  // Load previously processed IDs from file
  let processedIds = new Set();
  try {
    const saved = JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf8'));
    const cutoff = Date.now() - 86400000;
    processedIds = new Set(Object.entries(saved).filter(([, ts]) => ts > cutoff).map(([id]) => id));
  } catch(e) { processedIds = new Set(); }

  function saveProcessed() {
    const obj = {};
    for (const id of processedIds) obj[id] = Date.now();
    try { fs.writeFileSync(PROCESSED_FILE, JSON.stringify(obj)); } catch(e) {}
  }

  let isPolling = false;
  console.log("[FB_POLLER] Starting for Page:", PAGE_ID, "| Loaded", processedIds.size, "processed IDs");

  function fetchConversations() {
    return new Promise((resolve) => {
      const url = `https://graph.facebook.com/v19.0/${PAGE_ID}/conversations?fields=messages.limit(2){message,from,created_time,id,attachments}&access_token=${PAGE_TOKEN}`;
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data).data || []); }
          catch(e) { resolve([]); }
        });
      }).on('error', () => resolve([]));
    });
  }

  function forwardToN8N(msg) {
    const attachmentImages = (msg.attachments?.data || []).filter(a => a.image_data || a.mime_type?.includes('image'));
    const imageUrl = attachmentImages[0]?.image_data?.url || attachmentImages[0]?.file_url || null;

    const attachmentAudios = (msg.attachments?.data || []).filter(a => a.audio_data || a.mime_type?.includes('audio') || a.mime_type?.includes('video'));
    const audioUrl = attachmentAudios[0]?.file_url || attachmentAudios[0]?.audio_data?.url || null;

    const attachments = [];
    if (imageUrl) attachments.push({ type: 'image', payload: { url: imageUrl } });
    if (audioUrl) attachments.push({ type: 'audio', payload: { url: audioUrl } });

    const payload = {
      object: 'page',
      entry: [{
        id: PAGE_ID,
        time: Date.now(),
        messaging: [{
          sender: { id: msg.from.id },
          recipient: { id: PAGE_ID },
          timestamp: new Date(msg.created_time).getTime(),
          message: {
            mid: msg.id,
            text: msg.message || '',
            attachments: attachments
          }
        }]
      }]
    };

    return new Promise((resolve) => {
      const req = http.request('http://localhost:5678/webhook/galaxy-messenger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => {
          console.log(`[FB_POLLER] ✅ Forwarded "${msg.message}" from ${msg.from.name} → N8N ${res.statusCode}`);
          resolve();
        });
      });
      req.on('error', (e) => { console.error('[FB_POLLER] N8N error:', e.message); resolve(); });
      req.write(JSON.stringify(payload));
      req.end();
    });
  }

  async function poll() {
    if (isPolling) return;
    isPolling = true;
    try {
      const convs = await fetchConversations();
      let foundNew = false;
      for (const conv of convs) {
        const msgs = conv.messages?.data || [];
        for (const msg of msgs) {
          if (msg.from?.id !== PAGE_ID && msg.id && !processedIds.has(msg.id)) {
            processedIds.add(msg.id);
            foundNew = true;
            console.log(`[FB_POLLER] 🔔 New: ${msg.from?.name} | "${msg.message}"`);
            await forwardToN8N(msg);
            await new Promise(r => setTimeout(r, 600));
          }
        }
      }
      if (foundNew) saveProcessed();
    } catch(err) {
      console.error('[FB_POLLER] Poll error:', err.message);
    } finally {
      isPolling = false;
    }
  }

  async function init() {
    const convs = await fetchConversations();
    for (const conv of convs) {
      for (const msg of conv.messages?.data || []) {
        if (msg.id) processedIds.add(msg.id);
      }
    }
    saveProcessed();
    console.log(`[FB_POLLER] ✅ Ready. Single-instance active (${processedIds.size} existing msgs ignored)...`);
    setInterval(poll, 2000);
  }

  init().catch(console.error);
}
