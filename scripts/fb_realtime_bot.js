// scripts/fb_realtime_bot.js
// 24/7 Real-time Facebook Messenger AI Bot Engine
// Runs inside the VPS container alongside Next.js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

const PAGE_ID = process.env.FACEBOOK_PAGE_ID || "110644118793600";
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "EAAW6YWihfogBSY0coWHPtYcw2Gwm11ZAznBKAIcOzhgKQJWYITHuelgvzJfoWl0QjgrsRD5DEViDdpVyQKyvxGkBVJ8saKOzXi4IaXvIwYWuJXVJwNxBGsUdru7NAV9Rk5hrGCJigh9NuX1ury8ATCBYvbjBce885iGjucQ3LSbzYQwqQvNGfcu7GO70jQu3QiwI1";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

const PROCESSED_FILE = path.join(process.cwd(), "data", "processed_msg_ids.json");
const processedIds = new Set();

// Preload processed IDs from file if exists
try {
  if (fs.existsSync(PROCESSED_FILE)) {
    const data = JSON.parse(fs.readFileSync(PROCESSED_FILE, "utf-8"));
    for (const id of data) processedIds.add(id);
  }
} catch {}

function saveProcessedId(id) {
  processedIds.add(id);
  try {
    const list = Array.from(processedIds).slice(-500); // keep last 500
    fs.writeFileSync(PROCESSED_FILE, JSON.stringify(list), "utf-8");
  } catch {}
}

// ── Live Product Database Loader & Bilingual Matcher ────────────────────────
function findMatchedProduct(query, master) {
  if (!query) return null;
  const q = query.toLowerCase().replace(/['"’`]/g, "");

  const aliases = {
    "dream touch": ["dream touch", "dreamtouch", "ড্রিম টাচ", "ড্রিমটাচ", "ড্রিম"],
    "men's burner": ["men's burner", "mens burner", "men burner", "মেনস বার্নার", "বার্নার"],
    "soul mate": ["soul mate", "soulmate", "সোল মেট", "সোলমেট", "সুল মেট"],
    "black ginseng": ["black ginseng", "ginseng", "ব্ল্যাক জিনসেং", "জিনসেং"],
    "egypt gawa": ["egypt gawa", "egypt", "gawa", "ইজিপ্ট", "গাওয়া", "গাওয়া"],
    "enjoy hunter": ["enjoy hunter", "enjoy", "hunter", "হান্টার"],
    "hammer of thor": ["hammer of thor", "hammer", "হ্যামার"],
    "maxman": ["maxman", "ম্যাক্সম্যান"],
    "titan gel": ["titan gel", "টাইটান জেল"],
    "viga": ["viga", "ভিগা"],
    "shark": ["shark", "শার্ক"],
    "rheumarex": ["rheumarex", "রিউমারেক্স"]
  };

  // 1. Check known aliases
  for (const [key, aliasList] of Object.entries(aliases)) {
    if (aliasList.some(a => q.includes(a))) {
      const found = master.find(p => {
        const name = (p["ওষুধের নাম (Brand Name)"] || "").toLowerCase();
        return name.includes(key);
      });
      if (found) return found;
    }
  }

  // 2. Clean regex/substring match for every product in master (strip parentheses)
  for (const p of master) {
    const rawName = (p["ওষুধের নাম (Brand Name)"] || "").toLowerCase();
    const cleanName = rawName.replace(/\s*\([^)]*\)/g, "").trim();
    if (cleanName && cleanName.length >= 3 && q.includes(cleanName)) {
      return p;
    }
    const generic = (p["জেনেরিক ও ফার্মাকোলজিক্যাল ক্লাস (Generic & Class)"] || "").toLowerCase();
    if (generic && generic.length >= 5 && q.includes(generic)) {
      return p;
    }
  }

  return null;
}

function getLiveProductInfo(query) {
  try {
    const masterPath = path.join(process.cwd(), "data", "medicine_master_complete_db.json");
    const editsPath = path.join(process.cwd(), "data", "custom_user_edits.json");

    if (!fs.existsSync(masterPath)) return { context: "", matched: null };
    const master = JSON.parse(fs.readFileSync(masterPath, "utf-8"));
    const edits = fs.existsSync(editsPath) ? JSON.parse(fs.readFileSync(editsPath, "utf-8")) : {};

    const q = (query || "").toLowerCase();
    let matched = findMatchedProduct(q, master);

    // If query is general about ad / price / order without specifying another medicine, default to Soul Mate
    const isGeneralAdQuery = /^(দাম|কত|প্রাইস|price|কাজ|উপকার|কিভাবে|অর্ডার|ডেলিভারি|খাব|নিয়ম|order|koto|dam|kaj|rule)/i.test(q) ||
      q.includes("খাওয়ার") || q.includes("কাজ কি") || q.includes("দাম কত") || q.includes("নিতে চাই");

    if (!matched && isGeneralAdQuery) {
      matched = master.find(p => String(p.SL) === "39");
    }

    if (matched) {
      const sl = String(matched.SL);
      const edit = edits[sl] || {};
      const name = matched["ওষুধের নাম (Brand Name)"] || "প্রাকৃতিক ফর্মুলা";
      const price = edit.discount_price || edit.custom_price || "৩,০০০";
      const regPrice = edit.custom_price || "";
      const note = edit.custom_note || "ক্যাশ অন ডেলিভারি, পার্সেল হাতে পেয়ে পেমেন্ট।";
      const pitch = edit.custom_pitch || matched["১. কাস্টমারের আসল সমস্যা ও পেইন পয়েন্ট (Pain Point Mapping)"] || "";
      const dosage = edit.dosageForm || matched["১৩. স্ট্যান্ডার্ড মেডিকেল ডোজ ও সেবন প্রোটোকল (Dosage & Protocols)"] || matched["ডোজ ফর্ম ও শক্তি (Dosage Form & Strength)"] || "";
      const indications = matched["১. কাস্টমারের আসল সমস্যা ও পেইন পয়েন্ট (Pain Point Mapping)"] || "";
      const dietary = matched["৬. পুষ্টি ও দ্রুত ফলাফল পাওয়ার খাদ্যাভ্যাস (Dietary Blueprint)"] || "";
      const superiority = matched["২. বাজারের অন্যান্য ওষুধের সাথে শ্রেষ্ঠত্ব (Superiority Matrix)"] || "";
      const ageSolutions = matched["৩. বয়স ভিত্তিক কাস্টমাইজড সমাধান (Age-Specific Solutions)"] || "";

      const context = `
[লাইভ ড্যাশবোর্ড ও এনসাইক্লোপিডিয়া প্রোডাক্ট তথ্য / Live Encyclopedia Product Data]
ওষুধের নাম: ${name}
মূল্য: ${price} টাকা ${regPrice && regPrice !== price ? `(রেগুলার: ${regPrice} টাকা)` : ""}
অফার ও ডেলিভারি নোট: ${note}
কার্যকারিতা ও সমাধান: ${pitch}
সেবনবিধি / ডোজ: ${dosage}
সমস্যা ও ইন্ডিকেশন: ${indications}
${superiority ? `শ্রেষ্ঠত্ব ও কেন সেরা: ${superiority}` : ""}
${dietary ? `খাদ্যাভ্যাস ও পথ্য (Diet Plan): ${dietary}` : ""}
${ageSolutions ? `বয়স ভিত্তিক পরামর্শ: ${ageSolutions}` : ""}
      `.trim();

      return {
        context,
        matched: {
          sl,
          name,
          price,
          regPrice,
          note,
          dosage,
          pitch,
        }
      };
    }
  } catch (err) {
    console.error("DB error:", err);
  }
  return { context: "", matched: null };
}

// ── Gemini AI Generator ──────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

async function generateReply(customerMessage, senderName) {
  const { context: productContext, matched } = getLiveProductInfo(customerMessage);

  const systemInstruction = `You are an expert, empathetic, and persuasive human customer support and sales representative for our authentic healthcare & herbal medicine store in Bangladesh.

Core Communication Rules:
1. Natural Bengali: Always reply in fluent, natural, polite Bengali (বাংলা). Chat like a helpful human page admin chatting on Facebook Messenger.
2. Direct yet Persuasive: Answer the customer's exact question clearly and concisely, but also understand their psychology, hesitation, and situation to build trust and convince them.
3. Greetings Rule:
   - ONLY say "ওয়ালাইকুম আসসালাম" IF the customer explicitly greeted with "আসসালামু আলাইকুম" or "সালাম".
   - If the customer says "Hi", "Hello", "হাই", "হ্যালো", respond warmly and naturally, e.g.: "জি বলুন, কীভাবে সাহায্য করতে পারি?"
   - If the customer asks a direct question (e.g., "দাম কত?", "কি কাজ করে?", "খাব কিভাবে?"), do NOT include any greeting or introduction at all. Answer the question directly!
4. Product Availability & Unknown Items (CRITICAL):
   - If a customer asks for ANY medicine, product, brand, or illness treatment that is NOT in our provided database (for example: "নাপা আছে?", "প্যারাসিটামল আছে?", "টাইগার আছে?", "সারজেল আছে?", "ক্যান্সারের ওষুধ আছে?"):
     You MUST state clearly and directly: "দুঃখিত, এই প্রোডাক্টটি বর্তমানে আমাদের কাছে নেই।" (or "দুঃখিত, এটার ওষুধ আমাদের কাছে নেই।")
   - If a customer asks about something we do not know or do not have in our database:
     Reply: "দুঃখিত, এ বিষয়ে আমাদের কাছে তথ্য নেই।"
   - NEVER make up fake product info, and NEVER recommend an unrelated product like Soul Mate when an unavailable product was requested.
5. STRICTLY Answer ONLY What Was Asked (কাস্টমার যেটুকু জানতে চেয়েছেন শুধুমাত্র সেটুকুই উত্তর দিন):
   - Do NOT dump prices, dosages, pitches, or order requests when not asked.
   - Do NOT sound like an aggressive salesman or an automated robot.
   - Speak in natural, respectful, conversational Bengali like an attentive human healthcare consultant.

5.1. Product Availability Question ("আছে কি না?", "পাওয়া যাবে কি?"):
   - When a customer asks if a product is available (e.g. "Men's Burner aita ase apnader kase", "এটা কি আপনাদের কাছে আছে?"):
     Confirm availability simply and politely. DO NOT tell price, DO NOT pitch, and NEVER ask for an order or address.
     Example: "জি, [ওষুধের নাম] আমাদের কাছে ১০০% অরিজিনাল স্টকে রয়েছে। এটি সম্পর্কে কি কোনো তথ্য জানতে চাচ্ছেন?"

5.2. Price Question ("দাম কত?", "প্রাইস কত?"):
   - State ONLY the current price and offer clearly. Do NOT ask for address or tell them to order.
     Example: "এর বর্তমান অফার মূল্য [মূল্য] টাকা। সাথে ফ্রি হোম ডেলিভারি সুবিধা রয়েছে।"

5.3. Function / Benefits Question ("কাজ কি?", "কী উপকার হবে?"):
   - Explain the key health benefits, root-cause healing, and how it solves the issue gently using the dashboard data. Do NOT push to buy.

5.4. Usage / Dosage Question ("কীভাবে খাব?", "নিয়ম কি?"):
   - Explain the dosage instructions clearly and concisely.

5.5. STRICT RULE ON ORDER & ADDRESS ASKING (অর্ডার ও ঠিকানা চাওয়ার কঠোর নিয়ম):
   - You MUST NEVER ask for Name, Address, or Mobile Number ("আপনার নাম, ঠিকানা ও মোবাইল নম্বর দিন") UNLESS the customer explicitly states they want to buy or order (e.g. "অর্ডার করতে চাই", "নিতে চাই", "দেন", "পাঠান", "কুরিয়ারে দিন", "কীভাবে অর্ডার করব")!
   - Asking for an order or address prematurely scares customers away, creates confusion, and feels like an annoying robot.

6. Sales Psychology & Reassurance (When Customer Shows Hesitation):
   - Fraud/Scam Fear: If customer is afraid of being cheated or getting fake products, remove all risk: "আপনার এমন ভাবাটা স্বাভাবিক। তবে নিশ্চিন্ত থাকুন, আপনাকে ১ টাকাও অগ্রিম দিতে হবে না। সম্পূর্ণ ক্যাশ অন ডেলিভারিতে পার্সেল হাতে পেয়ে নিশ্চিত হয়ে তারপর মূল্য পরিশোধ করবেন।"
   - Price Objection (দাম বেশি মনে করলে): Politely explain the value of pure, rare herbal ingredients that give safe, permanent root-cause healing without any harmful side effects.

7. Self-Identity Rule:
   - NEVER introduce yourself as any individual doctor, hakim, or person. Do NOT say "আমি হাকিম...", "আমি অমুক বলছি", or "আমাদের প্রতিষ্ঠানে স্বাগতম". Speak naturally on behalf of the customer care team.

8. Product Context & Live Dashboard Truth:
   - If the customer asks for a specific medicine (like Men's Burner, Soul Mate, etc.), use that medicine's exact data from the dashboard.
   - If customer asks general ad questions without naming any medicine, use Soul Mate data.

9. Store Catalog & Available Offerings:
   - If the customer asks what kinds of products we sell or what is available (e.g., "কী কী প্রোডাক্ট আছে?", "কী কী ধরনের প্রোডাক্ট বিক্রি করেন?", "কী কী পাওয়া যায়?"):
     Reply warmly, professionally, and completely without pushing an order:
     "আমাদের এখানে মূলত পুরুষদের শারীরিক ও দাম্পত্য দুর্বলতা দূর করা, দ্রুত বীর্যপাত রোধ, দীর্ঘস্থায়ী স্ট্যামিনা বৃদ্ধি, নারীদের দুর্বলতা ও হরমোন ব্যালেন্স, লিভার ও গ্যাস্ট্রিক সমস্যা, এবং বাত-ব্যথা নিরাময়ের ১০০% প্রাকৃতিক ভেষজ ইউনানি ওষুধ রয়েছে। আমাদের অন্যতম জনপ্রিয় ও শীর্ষ কার্যকরী ফর্মুলা হলো Soul Mate (সোল মেট)। 

আপনার কি নির্দিষ্ট কোনো সমস্যা রয়েছে বা কোনো নির্দিষ্ট ওষুধ সম্পর্কে বিস্তারিত জানতে চান? জানালে সঠিক পরামর্শ দিতে পারব।"

10. Clean Plain Text:
   - Plain text only. Absolutely DO NOT use markdown bolding or asterisks (no ** or ## or *). Keep it completely clean.

${productContext ? `\n--- LIVE MEDICINE DASHBOARD DATA ---\n${productContext}\n-----------------------------------\n` : ""}
`;

  const models = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3.7-flash", "gemini-3.5-flash"];
  for (const m of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: m,
        systemInstruction,
        generationConfig: { maxOutputTokens: 1200, temperature: 0.2 }
      });

      const prompt = `Customer (${senderName || "Customer"}): "${customerMessage}"\nReply:`;
      const res = await model.generateContent(prompt);
      const text = res.response.text().trim();
      if (text && text.length > 3) {
        return text.replace(/[*#]+/g, "").trim();
      }
    } catch (err) {
      console.warn(`[AI_MODEL_WARN] (${m}):`, err.message);
    }
  }

  // Smart Fallback if Gemini models hit 503 or fail
  if (matched) {
    const qLower = (customerMessage || "").toLowerCase();
    const isPrice = /দাম|কত|প্রাইস|price|koto|dam|টাকা/i.test(qLower);
    const isAvailability = /আছে|পাব|পাওয়া|ase|available|pawa/i.test(qLower);
    const isDosage = /খাব|সেবন|নিয়ম|how to|khabo/i.test(qLower);

    if (isPrice) {
      return `${matched.name}-এর বর্তমান অফার মূল্য ${matched.price} টাকা ${matched.regPrice && matched.regPrice !== matched.price ? `(রেগুলার: ${matched.regPrice} টাকা)` : ""}। ${matched.note || "সারা দেশে ক্যাশ অন ডেলিভারিতে হোম ডেলিভারি নিতে পারেন।"}`;
    }
    if (isAvailability) {
      return `জি, ${matched.name} আমাদের কাছে ১০০% অরিজিনাল স্টকে রয়েছে। এটি সম্পর্কে কি কোনো তথ্য জানতে চাচ্ছেন?`;
    }
    if (isDosage) {
      return `${matched.name}-এর সেবনবিধি: ${matched.dosage || "নিয়ম অনুযায়ী সেবন করলে সেরা ফলাফল পাবেন"}।`;
    }
    return `জি, ${matched.name} সম্পর্কে আপনি কি কোনো বিশেষ তথ্য বা পরামর্শ জানতে চাচ্ছেন?`;
  }

  // Safe fallback for unavailable items
  return "দুঃখিত, এই প্রোডাক্টটি বর্তমানে আমাদের কাছে নেই।";
}

// ── Send Message via Facebook Graph API ──────────────────────────────────────
async function sendFacebookMessage(recipientId, text) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_TOKEN}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: "RESPONSE"
    })
  });
  return { status: res.status, data: await res.json() };
}

// ── Fetch Recent Conversations from Facebook ─────────────────────────────────
async function fetchConversations() {
  const url = `https://graph.facebook.com/v19.0/${PAGE_ID}/conversations?fields=messages.limit(2){message,from,created_time,id}&access_token=${PAGE_TOKEN}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

// ── Main Polling Loop ────────────────────────────────────────────────────────
let isPolling = false;

async function pollOnce() {
  if (isPolling) return;
  isPolling = true;

  try {
    const convs = await fetchConversations();
    for (const conv of convs) {
      const msgs = conv.messages?.data || [];
      if (msgs.length === 0) continue;

      const lastMsg = msgs[0];
      const isFromCustomer = lastMsg.from?.id && lastMsg.from.id !== PAGE_ID;

      if (isFromCustomer && lastMsg.id && !processedIds.has(lastMsg.id)) {
        processedIds.add(lastMsg.id); // Mark in memory to prevent duplicate in next tick
        const customerName = lastMsg.from?.name || "Customer";
        const messageText = (lastMsg.message || "").trim();

        console.log(`[FB_BOT] 🔔 NEW MESSAGE from ${customerName} (${lastMsg.from.id}): "${messageText}"`);

        // Generate AI reply
        const replyText = await generateReply(messageText, customerName);
        console.log(`[FB_BOT] 🤖 HAKIM REPLY: "${replyText.slice(0, 70)}..."`);

        // Send reply to Messenger
        const sendResult = await sendFacebookMessage(lastMsg.from.id, replyText);
        console.log(`[FB_BOT] 🚀 SENT [${sendResult.status}]:`, sendResult.data?.message_id || sendResult.data);
        saveProcessedId(lastMsg.id); // Persist to file once successfully attempted
      }
    }
  } catch (err) {
    // Network hiccup - ignore and keep polling
  } finally {
    isPolling = false;
  }
}

// ── Start Engine ─────────────────────────────────────────────────────────────
async function startBot() {
  console.log("=================================================");
  console.log("  GALAXY BOT - 24/7 REAL-TIME MESSENGER ENGINE   ");
  console.log("  Page ID:", PAGE_ID);
  console.log("=================================================");

  // Initialize: preload old messages so we only reply to new or unreplied recent messages
  try {
    const initConvs = await fetchConversations();
    const now = Date.now();
    for (const conv of initConvs) {
      const msgs = conv.messages?.data || [];
      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        const isLatest = (i === 0);
        const isFromCustomer = m.from?.id && m.from.id !== PAGE_ID;
        const isRecent = (now - new Date(m.created_time).getTime()) < 24 * 60 * 60 * 1000;

        if (isLatest && isFromCustomer && isRecent && !processedIds.has(m.id)) {
          console.log(`[FB_BOT] Found pending unreplied message from ${m.from?.name || "Customer"}: "${m.message}". Processing immediately.`);
        } else {
          if (m.id) processedIds.add(m.id);
        }
      }
    }
    console.log(`[FB_BOT] Preloaded ${processedIds.size} message IDs. Starting loop...`);
  } catch (e) {
    console.warn("[FB_BOT] Init warning:", e.message);
  }

  // Poll every 2.0 seconds
  setInterval(pollOnce, 2000);
}

startBot();
