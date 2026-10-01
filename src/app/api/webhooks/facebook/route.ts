import { NextResponse } from "next/server";
import { startMessengerPoller } from "@/lib/messenger-poller";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Start background poller ensuring it is always active
try {
  startMessengerPoller();
} catch {}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN ?? "social_inbox_verify_token";

// ── GET: Facebook Webhook Verification ──────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[FB_WEBHOOK] Verification successful");
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// ── POST: Receive Facebook Events ───────────────────────────────────────────
export async function POST(req: Request) {
  // Read body first (stream can only be consumed once)
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Log incoming webhook event to disk
  try {
    const fs = await import("fs");
    const path = await import("path");
    const logFile = path.join(process.cwd(), "data", "webhook_hits.log");
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] INCOMING: ${JSON.stringify(body)}\n`);
  } catch {}

  // ── DOUBLE-REPLY GUARD ─────────────────────────────────────────────────────
  // When fb_realtime_bot.js (standalone polling bot) is running on this VPS,
  // it already handles all AI replies via long-polling. The webhook must NOT
  // also process the same messages — that causes 2 replies per customer message.
  // We still return 200 OK immediately so Facebook does not retry.
  if (process.env.STANDALONE_BOT_ACTIVE === "true") {
    console.log("[FB_WEBHOOK] Standalone bot is active — skipping webhook AI processing to prevent double-reply.");
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  // Respond 200 to Facebook IMMEDIATELY to prevent retry/duplicate webhook delivery
  setImmediate(async () => {
    try {
      if (!body || body.object !== "page") return;

      for (const entry of body.entry ?? []) {
        // ── Messages (Messenger) ──
        for (const event of entry.messaging ?? []) {
          if (event.message) {
            // handleMessengerMessage does Redis dedup THEN forwards to N8N (guaranteed once)
            await handleMessengerMessage(entry.id, event);
          }
        }

        // ── Comments on Posts / Ads ──
        for (const change of entry.changes ?? []) {
          if (change.field === "feed" && change.value?.item === "comment") {
            await handleFacebookComment(entry.id, change.value);
          }
        }
      }
    } catch (error) {
      console.error("[FB_WEBHOOK_ERROR]", error);
    }
  });

  return NextResponse.json({ status: "ok" }, { status: 200 });
}


// Persistent shared deduplication across Webhook and Polling Bot
const PROCESSED_MSGS_FILE = path.join(process.cwd(), "data", "processed_msg_ids.json");
const processedMsgIds = new Set<string>();

// Preload processed IDs from file if exists
try {
  if (fs.existsSync(PROCESSED_MSGS_FILE)) {
    const data = JSON.parse(fs.readFileSync(PROCESSED_MSGS_FILE, "utf-8"));
    if (Array.isArray(data)) {
      for (const id of data) processedMsgIds.add(id);
    }
  }
} catch {}

function isProcessedId(id: string): boolean {
  if (!id) return false;
  if (processedMsgIds.has(id)) return true;
  try {
    if (fs.existsSync(PROCESSED_MSGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROCESSED_MSGS_FILE, "utf-8"));
      if (Array.isArray(data) && data.includes(id)) {
        processedMsgIds.add(id);
        return true;
      }
    }
  } catch {}
  return false;
}

function markProcessedId(id: string) {
  if (!id) return;
  processedMsgIds.add(id);
  try {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    let list: string[] = [];
    if (fs.existsSync(PROCESSED_MSGS_FILE)) {
      try {
        list = JSON.parse(fs.readFileSync(PROCESSED_MSGS_FILE, "utf-8"));
      } catch {}
    }
    if (!list.includes(id)) {
      list.push(id);
      if (list.length > 500) list = list.slice(-500);
      fs.writeFileSync(PROCESSED_MSGS_FILE, JSON.stringify(list), "utf-8");
    }
  } catch {}
}

interface PendingMessageItem {
  mid?: string;
  text: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  timestamp: number;
}

// Smart message buffer per sender to combine rapid text + image + audio events (within 2.0s)
interface PendingSenderEvent {
  pageId: string;
  senderId: string;
  items: PendingMessageItem[];
  timer: NodeJS.Timeout;
}
const pendingSenderEvents = new Map<string, PendingSenderEvent>();

async function flushSenderEvent(senderId: string) {
  const pending = pendingSenderEvents.get(senderId);
  if (!pending) return;
  pendingSenderEvents.delete(senderId);

  const { pageId, items } = pending;
  if (!items || items.length === 0) return;

  const fullBatchText = items.map(i => i.text).filter(Boolean).join(" ");
  const text = fullBatchText;
  const imageUrl = items.find(i => i.imageUrl)?.imageUrl || null;
  const audioUrl = items.find(i => i.audioUrl)?.audioUrl || null;
  const timestamp = items[items.length - 1].timestamp;
  const isNaturalHerbal = pageId === "133420039845881" || pageId === "61559813291583";
  const pageName = isNaturalHerbal ? "ন্যাচারাল হারবাল" : "হেলথ কেয়ার";
  const pageProductName = isNaturalHerbal ? "বাজীকরণ হালুয়া" : "কস্তুরী পাউডার";
  const pageProductWeight = isNaturalHerbal ? "৩৫০ গ্রাম" : "২৫০ গ্রাম";
  const pageProductPrice = isNaturalHerbal ? "২,০০০ টাকা" : "২,৮০০ টাকা";
  const pageProductAdvance = "২০০ টাকা";
  const pageProductRemaining = isNaturalHerbal ? "১,৮০০ টাকা" : "২,৬০০ টাকা";
  const pageProductCourse = isNaturalHerbal ? "" : "১ মাসের ফুল কোর্স, ";

  const PERM_TOK_1 = "EAAjkLPT8UegBSsQVgxm1fBW6D7N7oon9ZAudS1UKVLVbBEar1BGEvZCLJ3ibSLO6FmILQDf6mq4rcsL98cpxuuRwAHSwUprKUBLv6ZBBCSjYAGUPTU1SQIRDvR74D5aIivRiDoUG3zobZB83AIwZA8mZAhoqcBDpjii2KsvQshwZCCIdUSJk5NaDb5JZCFGt4YWKBfEZC";
  const PERM_TOK_2 = "EAAjkLPT8UegBSlZChn7c91QtGtts7mXORj9ZAXOjehsii5WQoVrbmZCDwmqoovyJ10M3056RDjnnvPgsPYCbU7yZCzFvX88tpbOIzJO0fr6vOMZB3EMBY3yPkkNs8QFMK2COwmBlr0VBwVlXIiKRJpGjDwE4HIOrUFkd51Vz7OenjmH2jewNaUUcRSAOhl8ZAoUEEZD";
  const quickToken = isNaturalHerbal
    ? (process.env.FACEBOOK_PAGE_ACCESS_TOKEN_2 || PERM_TOK_2)
    : (process.env.FACEBOOK_PAGE_ACCESS_TOKEN || PERM_TOK_1);

  console.log(`[AUTO_REPLY] Processing message(s) from ${senderId} | Batch Count: ${items.length} | Text: "${text}" | Page: ${pageName}`);

  // ── TELEGRAM ALERT: Phone number বা হাকিমের সাথে কথা বলার request ──────
  try {
    const textLower = (text || "").toLowerCase();
    const normalizedText = text.replace(/[০-৯]/g, (d: string) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString());

    // Phone number detection
    const phoneMatch = normalizedText.match(/(?:\+?880|0)?1[3-9]\d{8}/);
    const hasPhone = Boolean(phoneMatch);

    // হাকিমের সাথে কথা বলার request detection
    const hakimKeywords = [
      "hakim", "হাকিম", "হাকিমের সাথে", "হাকিম সাহেব", "হাকিমের সাথে কথা",
      "doctor", "ডাক্তার", "কথা বলব", "কথা বলতে চাই", "সরাসরি কথা",
      "direct call", "ফোন করতে চাই", "call করতে চাই", "আপনার সাথে কথা",
      "personal", "ব্যক্তিগত", "গোপনে", "একান্তে", "real person",
      "মানুষের সাথে", "real doctor", "সরাসরি"
    ];
    const wantsHakim = hakimKeywords.some(kw => textLower.includes(kw.toLowerCase()));

    if (hasPhone || wantsHakim) {
      const tgBotToken = "8874694866:AAEmdXxd3DP3B8J4L2sHS0pIxVR98HV9vqI";
      const tgChatId = "8279465535";
      const fbProfileLink = `https://www.facebook.com/search/top?q=${senderId}`;
      const fbMessengerLink = `https://m.me/${senderId}`;

      let alertMsg = "";
      if (hasPhone && wantsHakim) {
        alertMsg = `🔔 *ফোন নম্বর + হাকিমের সাথে কথা বলতে চায়!*`;
      } else if (hasPhone) {
        alertMsg = `📱 *ফোন নম্বর দিয়েছে!*`;
      } else {
        alertMsg = `🩺 *হাকিমের সাথে সরাসরি কথা বলতে চায়!*`;
      }

      const tgMessage = `${alertMsg}

👤 *FB নাম/ID:* \`${senderId}\`
🔗 *FB Profile:* ${fbProfileLink}
💬 *Messenger:* ${fbMessengerLink}
${hasPhone ? `📱 *ফোন নম্বর:* \`${phoneMatch![0]}\`` : ""}

📝 *যা লিখেছে:*
${text}

⏰ ${new Date().toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}`;

      await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: tgMessage,
          parse_mode: "Markdown",
          disable_web_page_preview: false,
        }),
      }).catch(e => console.warn("[TG_ALERT_ERR]", e.message));

      console.log(`[TG_ALERT] ✅ Sent to Telegram for sender ${senderId} | phone=${hasPhone} | hakimReq=${wantsHakim}`);
    }
  } catch (tgErr: any) {
    console.warn("[TG_ALERT_CATCH]", tgErr.message);
  }
  // ── END TELEGRAM ALERT ────────────────────────────────────────────────────

  // ── Gemini Vision Image Interceptor (Run Vision Analysis if customer sent an image) ──────
  if (imageUrl) {
    console.log(`[FB_WEBHOOK_VISION] Customer ${senderId} sent an image attachment (${imageUrl.slice(0, 80)}...). Running Gemini Vision...`);
    try {
      const { analyzeImageWithGemini } = await import("@/lib/ai");
      const pageName = pageId === "61559813291583" ? "ন্যাচারাল হারবাল" : "হেলথ কেয়ার";
      const PERM_TOK = "EAAjkLPT8UegBSsQVgxm1fBW6D7N7oon9ZAudS1UKVLVbBEar1BGEvZCLJ3ibSLO6FmILQDf6mq4rcsL98cpxuuRwAHSwUprKUBLv6ZBBCSjYAGUPTU1SQIRDvR74D5aIivRiDoUG3zobZB83AIwZA8mZAhoqcBDpjii2KsvQshwZCCIdUSJk5NaDb5JZCFGt4YWKBfEZC";
      const envT = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
      const quickToken = (envT && envT.length > 150) ? envT : PERM_TOK;

      const visionResult = await analyzeImageWithGemini(
        imageUrl,
        quickToken,
        pageName,
        text,
        senderId,
        []
      );

      if (visionResult && visionResult.length > 5) {
        console.log(`[FB_WEBHOOK_VISION] Vision reply generated: "${visionResult.slice(0, 80)}..."`);
        await sendMessengerReply(pageId, senderId, visionResult, quickToken);
        try { const { appendChatMessage } = await import("@/lib/customer-memory"); appendChatMessage(senderId, "model", visionResult, false); } catch {}
        return;
      }
    } catch (vErr: any) {
      console.warn("[FB_WEBHOOK_VISION_ERR]", vErr.message);
    }
  }

  // ── GUARD: Past-tense / unfulfilled order intent ───────────────────────────
  const isPastUnfulfilledIntent =
    /(?:chaisilam|chaisilem|cheyesilam|cheyechilam|চাইছিলাম|চেয়েছিলাম|চাইসিলাম|চাইছিলেন|চেয়েছিলেন)/i.test(text) ||
    /(?:parisilam|parini|parchi\s*na|পারিনি|পারছি\s*না|পারছিলাম|হয়নি|hoyni)/i.test(text) ||
    /(?:kalke|kal|goto\s*kal|গতকাল|আগে|age|আগেই|আগের).*(?:order|অর্ডার|নিতে|kinbo|কিনতে).*(?:chaisilam|chaisilem|চাইছিলাম|চেয়েছিলাম|parisilam|পারিনি)/i.test(text);

  if (isPastUnfulfilledIntent) {
    const pastIntentReplies = [
      `আরে ভাইয়া, কোনো সমস্যা নেই! কালকে কী হয়েছিল বলুন — কোনো অসুবিধা হয়েছিল? আমি এখন আপনার জন্য সব ঠিক করে দিতে পারব। আপনি কি এখন নিতে চান?`,
      `আচ্ছা ভাইয়া, কালকে কোনো সমস্যা হয়েছিল? কোনো চিন্তা নেই, এখনো সুযোগ আছে। বলুন কী হয়েছিল — আমি সাহায্য করব।`,
      `ভাইয়া, কালকে হয়নি কোনো ব্যাপার না। আপনি কি এখন অর্ডার দিতে চান? একটু বলুন — কোথায় আটকে গিয়েছিলেন?`
    ];
    const pastReply = pastIntentReplies[Math.floor(Math.random() * pastIntentReplies.length)];
    const PERM_TOK = "EAAjkLPT8UegBSsQVgxm1fBW6D7N7oon9ZAudS1UKVLVbBEar1BGEvZCLJ3ibSLO6FmILQDf6mq4rcsL98cpxuuRwAHSwUprKUBLv6ZBBCSjYAGUPTU1SQIRDvR74D5aIivRiDoUG3zobZB83AIwZA8mZAhoqcBDpjii2KsvQshwZCCIdUSJk5NaDb5JZCFGt4YWKBfEZC";
    const envT = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const quickToken = (envT && envT.length > 150) ? envT : PERM_TOK;
    await sendMessengerReply(pageId, senderId, pastReply, quickToken);
    try { const { appendChatMessage } = await import("@/lib/customer-memory"); appendChatMessage(senderId, "model", pastReply, false); } catch {}
    return;
  }

  // ── Instant interceptor for Full COD / Advance Payment Objections / Advance Inquiries ──
  const isAdvanceOrCodInquiry =
    /(?:full\s*cod|ফুল\s*ক্যাশ|ফুল\s*সিওডি|full\s*cash|cash\s*on\s*delivery)/i.test(text) ||
    /(?:advance|অগ্রিম|এডভান্স|adbhance|advanse|agrim).*(?:dibo\s*na|debo\s*na|দিব\s*না|দেবো\s*না|dite\s*parbo\s*na|দিতে\s*পারব\s*না|charai?|ছাড়া|হবে\s*না|hobe\s*na|keno|কেন|kiser|কিসের|neya\s*hoy|নেওয়া\s*হয়|deya\s*jabe\s*na|দেওয়া\s*যাবে\s*না|dite\s*chai\s*na|চাই\s*না)/i.test(text) ||
    /(?:charai?|ছাড়া|ছাড়াই).*(?:advance|অগ্রিম|এডভান্স|টাকা)/i.test(text) ||
    /(?:keno|কেন|kiser|কিসের).*(?:advance|অগ্রিম|এডভান্স|200|২০০|500|৫০০|আগে)/i.test(text) ||
    /(?:200|২০০|500|৫০০).*(?:advance|অগ্রিম|এডভান্স|taka\s*age|টাকা\s*আগে|keno|কেন|কিসের)/i.test(text) ||
    /(?:age|আগে).*(?:taka|টাকা).*(?:dibo\s*na|debo\s*na|দিব\s*না|দেবো\s*না|keno|কেন|dite\s*parbo\s*na|নেবেন)/i.test(text) ||
    /(?:hate\s*peye|হাতে\s*পেয়ে|product\s*dekhe|পণ্য\s*দেখে|maal\s*dekhe).*(?:sob\s*taka|shob\s*taka|সব\s*টাকা|pura\s*taka|পুরো\s*টাকা|dibo|দিব|debo|দেবো)/i.test(text) ||
    /(?:na\s*ami|না\s*আমি).*(?:aivabe|এইভাবে|advance|অগ্রিম|cod|নিয়মে)/i.test(text) ||
    /(?:advance|অগ্রিম|এডভান্স)\s*(?:charai?|ছাড়া|ছাড়াই|হবে\s*না|hobe\s*na|dibo\s*na|দিব\s*না|nai|নাই)/i.test(text);

  if (isAdvanceOrCodInquiry) {
    const advanceExplanationReplies = [
      `ভাইয়া, আপনার সংশয় আমি সম্পূর্ণ বুঝতে পারছি—অনলাইনে না দেখে অগ্রিম টাকা দিতে যে কারোই দ্বিধা লাগা স্বাভাবিক। তবে আসল কারণটা বলি ভাইয়া:

আমাদের এই ওষুধ বাজারের সাধারণ কোনো রেডিমেড বা কোম্পানির প্যাকেটজাত ওষুধ নয়। আপনার শারীরিক সমস্যা ও রোগের লক্ষণ পুঙ্খানুপুঙ্খ জেনে, আপনার শরীরের প্রয়োজন অনুযায়ী ল্যাব থেকে সম্পূর্ণ ফ্রেশ ব্যাচে খাঁটি ভেষজ উপাদান সঠিক অনুপাতে কাস্টমাইজড করে প্রস্তুত করা হয়।

প্রতিটি রোগীর জন্য আলাদাভাবে ফ্রেশ ওষুধ তৈরিতে আমাদের খাঁটি উপাদান ও প্রচুর শ্রম খরচ হয়। অতীতে ফুল ক্যাশ অন ডেলিভারিতে পাঠিয়ে দেখা গেছে অনেকেই পার্সেল রিসিভ করেন না, যার ফলে এই স্পেশাল ওষুধটি সম্পূর্ণ নষ্ট হয়ে যায়—যা অন্য কাউকে আর দেওয়া যায় না। তাই শুধুমাত্র আপনার আন্তরিকতা নিশ্চিত করতে এবং আপনার জন্য ওষুধটি প্রস্তুত করতে মাত্র ২০০ টাকা বুকিং নেওয়া হয়।

বাকি পুরো ২,৬০০ টাকা কিন্তু পার্সেল হাতে পেয়ে, খুলে দেখে তারপর কুরিয়ার ম্যানকে দেবেন। আপনার কোনো ঝুঁকি নেই ভাইয়া।

আর বাজারের সস্তা ওষুধে ক্ষতিকর কেমিক্যাল ও স্টেরয়েড থাকে যা হার্ট ও কিডনির চরম ক্ষতি করে। আমরা দিচ্ছি শতভাগ খাঁটি ও নিরাপদ ফর্মুলা। ভাইয়া, আপনার সুস্থতার জন্য কি আপনার ফাইলটি প্রস্তুত করতে বলব?`,

      `জি ভাইয়া, অনলাইনে অগ্রিম টাকা দেওয়া নিয়ে আপনার দ্বিধা হওয়া খুবই স্বাভাবিক। কিন্তু সত্যি কথাটা আপনাকে খুলে বলি:

আমরা কোনো সাধারণ বা স্টক করা ওষুধ বিক্রি করি না। আপনার শারীরিক অবস্থা বিবেচনা করে আপনার জন্য স্পেশাল ভেষজ উপাদান সঠিক মাত্রায় মিশিয়ে সম্পূর্ণ ফ্রেশ ব্যাচে ওষুধটি প্রস্তুত করতে হয়।

পার্সেল পাঠানোর পর কেউ রিসিভ না করলে এই কাস্টমাইজড ওষুধটি সম্পূর্ণ নষ্ট হয়ে যায় এবং আমাদের উপাদানগুলো অপচয় হয়। তাই শুধুমাত্র আপনার ওষুধটি নিখুঁতভাবে তৈরি ও পার্সেল কনফার্ম করতেই এই ২০০ টাকা অগ্রিম বুকিং নেওয়া হয়।

বাকি ২,৬০০ টাকা আপনি পার্সেল হাতে পেয়ে, চেক করে ডেলিভারিম্যানকে পরিশোধ করবেন। এখানে আপনার ১ টাকারও কোনো ঝুঁকি নেই ভাইয়া। আপনার সুস্থতার জন্য এই ফ্রেশ ফাইলটি কি রেডি করব?`,

      `ভাইয়া, আপনার কথা আমি একদম বুঝতে পেরেছি। তবে একটু ভেবে দেখুন—বাজারে যেসব সস্তা ওষুধ ফুল ক্যাশ অন ডেলিভারিতে বিক্রি হয়, সেগুলোতে থাকে ক্ষতিকর সিলডেনাফিল বা কেমিক্যাল, যা খেলে হার্ট, কিডনি ও লিভারের মারাত্মক ক্ষতি হয়।

আমাদের এটি হাকীম মো: আব্দুল করিম সাহেবের নিজস্ব ফর্মুলায় ল্যাব থেকে তৈরি সম্পূর্ণ প্রাকৃতিক ও পরীক্ষিত ফর্মুলা। আপনার রোগ ও বয়সের উপর ভিত্তি করে ফ্রেশভাবে তৈরি করা হয় বলেই আমরা শুধু ২০০ টাকা বুকিং নিই, যাতে ওষুধটি অপচয় না হয়। বাকি ২,৬০০ টাকা আপনি পার্সেল হাতে পেয়ে দেখে দেবেন।

আপনার সুস্থতা ও নিরাপত্তার চেয়ে বড় কিছু হতে পারে না ভাইয়া। আপনি কি আপনার ফ্রেশ ফাইলটি প্রস্তুত করতে চান?`
    ];
    const advanceReply = advanceExplanationReplies[Math.floor(Math.random() * advanceExplanationReplies.length)];
    const PERM_TOK = "EAAjkLPT8UegBSsQVgxm1fBW6D7N7oon9ZAudS1UKVLVbBEar1BGEvZCLJ3ibSLO6FmILQDf6mq4rcsL98cpxuuRwAHSwUprKUBLv6ZBBCSjYAGUPTU1SQIRDvR74D5aIivRiDoUG3zobZB83AIwZA8mZAhoqcBDpjii2KsvQshwZCCIdUSJk5NaDb5JZCFGt4YWKBfEZC";
    const envT = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const quickToken = (envT && envT.length > 150) ? envT : PERM_TOK;
    await sendMessengerReply(pageId, senderId, advanceReply, quickToken);
    try { const { appendChatMessage } = await import("@/lib/customer-memory"); appendChatMessage(senderId, "model", advanceReply, false); } catch {}
    return;
  }

  // ── GUARD: Negative order intent / refusal / cancellation ──────────────────
  const isNegativeOrderIntent =
    /(?:order|অর্ডার|nite|নিতে|kinbo|কিনবো|ঔষধ|ওষুধ).*(?:korbo\s*na|করব\s*না|করবো\s*না|debo\s*na|দেবো\s*না|dibo\s*na|দিব\s*না|kori\s*na|lagbe\s*na|লাগবে\s*না|chai\s*na|চাই\s*না)/i.test(text) ||
    /(?:na\s*ami|না\s*আমি).*(?:order|অর্ডার|nibo|নিবো|kinbo|কিনবো).*(?:na|না)/i.test(text) ||
    /(?:ami\s*)?(?:nibo\s*na|নিব\s*না|নিবো\s*না|kinbo\s*na|কিনব\s*না|কিনবো\s*না|lagbe\s*na|লাগবে\s*না)/i.test(text) ||
    /^(?:na|না|thak|থাক|lagbe\s*na|লাগবে\s*না|cancel|ক্যান্সেল|বাদ\s*দেন|bad\s*den)$/i.test(text.trim());

  if (isNegativeOrderIntent) {
    const negativeReplies = [
      `জি ভাইয়া, কোনো সমস্যা নেই। ওষুধ নেওয়া বা না নেওয়া সম্পূর্ণ আপনার ব্যক্তিগত সিদ্ধান্ত। তবে ভাইয়া, একজন শুভাকাঙ্ক্ষী হিসেবে শুধু এতটুকু বলব—গোপন শারীরিক সমস্যা যত দিন পুষে রাখবেন, ভেতরের নার্ভ ও টেস্টোস্টেরন হরমোন তত দুর্বল হয়ে পড়ে, যা পরবর্তীতে চিকিৎসা করা আরও কঠিন করে তোলে। আপনি যখনই সঠিক ও খাঁটি চিকিৎসায় সুস্থ হতে চাইবেন, আমরা আপনার পাশে আছি। ভালো থাকবেন ভাইয়া।`,
      `ঠিক আছে ভাইয়া, কোনো অসুবিধা নেই। আপনার সিদ্ধান্তই চূড়ান্ত। তবে এই ধরনের সমস্যা ফেলে রাখলে দিনে দিনে জটিলতা আরও বাড়ে। ভবিষ্যতে যেকোনো পরামর্শের জন্য নির্দ্বিধায় নক দিতে পারেন। আল্লাহ আপনাকে সুস্থ রাখুন।`,
      `জি ভাইয়া, কোনো চাপ নেই। তবে সময়মতো সঠিক প্রাকৃতিক চিকিৎসা নিলে এই সমস্যাগুলো থেকে পুরোপুরি মুক্তি পাওয়া সম্ভব। আপনি সুস্থ থাকুন, এই কামনাই করি। পরবর্তীতে প্রয়োজন হলে জানাবেন ভাইয়া।`
    ];
    const negReply = negativeReplies[Math.floor(Math.random() * negativeReplies.length)];
    const PERM_TOK = "EAAjkLPT8UegBSsQVgxm1fBW6D7N7oon9ZAudS1UKVLVbBEar1BGEvZCLJ3ibSLO6FmILQDf6mq4rcsL98cpxuuRwAHSwUprKUBLv6ZBBCSjYAGUPTU1SQIRDvR74D5aIivRiDoUG3zobZB83AIwZA8mZAhoqcBDpjii2KsvQshwZCCIdUSJk5NaDb5JZCFGt4YWKBfEZC";
    const envT = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const quickToken = (envT && envT.length > 150) ? envT : PERM_TOK;
    await sendMessengerReply(pageId, senderId, negReply, quickToken);
    try { const { appendChatMessage } = await import("@/lib/customer-memory"); appendChatMessage(senderId, "model", negReply, false); } catch {}
    return;
  }

  // ── INSTANT HARDCODED REPLY: Order process questions (bypass AI) ──────────
  const textForOrderCheck = (text || "").toLowerCase().replace(/\s+/g, "");
  const hasNegativeWords = /(?:na\b|না|korbo\s*na|করব\s*না|করবো\s*না|nibo\s*na|নিব\s*না|kinbo\s*na|কিনব\s*না|dibo\s*na|দিব\s*না|debo\s*na|দেবো\s*না|parbo\s*na|পারব\s*না|lagbe\s*na|লাগবে\s*না|chara|ছাড়া|ছাড়াই|cod|ক্যাশ\s*অন|ক্যান্সেল|cancel|bad\s*den|বাদ\s*দেন|chai\s*na|চাই\s*না)/i.test(text);

  const isOrderProcessQuestion = !hasNegativeWords && (
    /(?:order|অর্ডার).*(?:kivabe|কিভাবে|kibhabe|kiভাবে|কীভাবে|process|prosess|নিয়ম|পদ্ধতি)/i.test(text) ||
    /(?:kivabe|কিভাবে|কীভাবে|kibhabe).*(?:order|অর্ডার|kinbo|কিনব|nibo|নিবো|pabo|পাব)/i.test(text) ||
    /অর্ডারকিভাবে|orderকিভাবে/.test(textForOrderCheck) ||
    /order\s*form|অর্ডার\s*ফর্ম/i.test(text) ||
    /(?:order|অর্ডার)\s*(?:korte\s*chai|করতে\s*চাই|korte\s*chassi|করতে\s*চাচ্ছি|dite\s*chai|দিতে\s*চাই|debo|দিব|korbo|করব)/i.test(text) ||
    /(?:ami|আমি|amar|আমার)\s+(?:order|অর্ডার)\s*(?:korte\s*chai|করতে\s*চাই|dite\s*chai|দিতে\s*চাই|korbo|করব|confirm|কনফার্ম)/i.test(text) ||
    /order\s*korte\s*(?:chai|chacchi|chassi)|অর্ডার\s*করতে\s*চাই/i.test(text) ||
    /ar\s*akta\s*order|আরেকটা?\s*অর্ডার|আর\s*একটা?\s*অর্ডার/i.test(text) ||
    /(?:nite|নিতে|kinbo|কিনবো|nibo|নিবো)\s*(?:chai|চাই|chacchi|চাচ্ছি)/i.test(text)
  );

  if (isOrderProcessQuestion) {
    let hasHealthData = false;
    let userMsgCount = 0;
    let sName = "ভাইয়া";
    try {
      const { getCustomerProfile } = await import("@/lib/customer-memory");
      const custProf = getCustomerProfile(senderId);
      if (custProf) {
        if (custProf.name && custProf.name !== "Customer" && custProf.name !== "কাস্টমার") {
          sName = custProf.name + " ভাইয়া";
        }
        const chatLog = custProf.chatLog || [];
        userMsgCount = chatLog.filter((m: any) => m.role === "user").length;
        hasHealthData = Boolean(
          custProf.age ||
          (custProf.symptoms && custProf.symptoms.length > 0) ||
          custProf.duration ||
          custProf.maritalStatus ||
          custProf.timing ||
          custProf.erectionQuality ||
          custProf.semenQuality
        );
      }
    } catch {}

    let chosenReply = "";
    if (!hasHealthData && userMsgCount <= 4) {
      const earlyConsultReplies = [
        `জি ${sName}, আলহামদুলিল্লাহ — আপনার আগ্রহ দেখে সত্যিই ভালো লাগছে! তবে ভাইয়া, আমাদের ওষুধ কোনো সাধারণ বাজারের রেডিমেড ওষুধ নয় — এটি প্রতিটি রোগীর শারীরিক অবস্থা ও সমস্যার ধরন অনুযায়ী বিশেষভাবে প্রস্তুত করা হয়। তাই আগে আপনার সমস্যা কি কি সবকিছু বিস্তারিত জানা জরুরি, তারপর আপনি নিশ্চিত হয়ে অর্ডার করতে পারবেন।\n\nভাইয়া, আপনার মূল সমস্যাটা ঠিক কী হচ্ছে একটু খুলে বলবেন কি? যেমন: দ্রুত বীর্যপাত বা টাইমিং কম, ইরেকশন বা শক্ত না হওয়া, নাকি শারীরিক দুর্বলতা? এবং আপনার বয়স কত?`,
        `আলহামদুলিল্লাহ ${sName}, আপনি অর্ডার করতে চাচ্ছেন জেনে খুশি হলাম! তবে ভাইয়া, আমাদের মূল লক্ষ্য আপনার স্থায়ী সুস্থতা। বাজার চলতি ওষুধের মতো না দিয়ে আমরা রোগীর শারীরিক ঘাটতি বিশ্লেষণ করে খাঁটি পাহাড়ি ভেষজ উপাদান দিয়ে ওষুধ তৈরি করি। তাই অর্ডার করার পূর্বে আপনার সম্পর্কে কিছুটা জানা দরকার।\n\nভাইয়া, আপনার বয়স কত এবং মূল সমস্যাটা ঠিক কী হচ্ছে একটু খুলে বলবেন? (যেমন: দ্রুত বীর্যপাত, লিঙ্গের শিথিলতা, নাকি শারীরিক দুর্বলতা?) সমস্যাটি কতদিন ধরে?`,
        `জি ${sName}, অর্ডার করতে অবশ্যই পারবেন ইনশাআল্লাহ। তবে সরাসরি অর্ডার নেওয়ার আগে আপনার শারীরিক সমস্যাগুলো জেনে সঠিক ওষুধ নির্ধারণ করা আমাদের দায়িত্ব। কারণ সঠিক রোগ নির্ণয় ছাড়া ওষুধ দিলে কাঙ্ক্ষিত ফল পাওয়া যায় না।\n\nভাইয়া, একটু বলবেন কি—আপনার মূল সমস্যাটা ঠিক কী এবং বয়স কত? সবকিছু জেনে-শুনে আপনার জন্য সেরা ওষুধটি নির্ধারণ করে দেব ইনশাআল্লাহ।`
      ];
      chosenReply = earlyConsultReplies[Math.floor(Math.random() * earlyConsultReplies.length)];
      chosenReply = `জি ভাইয়া, আপনার অর্ডারটি কনফার্ম করতে নিচের তথ্যগুলো পূরণ করে পাঠিয়ে দিন:\n\nনাম:\nফোন নম্বর:\nজেলা:\nথানা/উপজেলা:\nবিস্তারিত ঠিকানা:\n\n${pageProductName} (${pageProductCourse}${pageProductWeight}) অফার মূল্য ${pageProductPrice}। পার্সেল বুকিং নিশ্চিত করতে ${pageProductAdvance} আমাদের অফিসিয়াল বিকাশ হেল্পলাইন 01870-023804 নম্বরে পাঠিয়ে লাস্ট ২/৩ ডিজিট জানাবেন। বাকি ${pageProductRemaining} পার্সেল হাতে পেয়ে দেখে ডেলিভারি ম্যানকে পরিশোধ করবেন।`;
    }

    await sendMessengerReply(pageId, senderId, chosenReply, quickToken);
    console.log(`[ORDER_PROCESS_INSTANT] ✅ Sent reply to ${senderId} (consultation: ${!hasHealthData})`);
    try { const { appendChatMessage } = await import("@/lib/customer-memory"); appendChatMessage(senderId, "model", chosenReply, false); } catch {}
    return;
  }

  // ── INSTANT HARDCODED REPLY: Address / Location questions (bypass AI) ──────
  const isAddressQuestion =
    /(apnar|আপনার|tomar|তোমার).*(basa|bari|বাড়ি|বাসা|address|ঠিকানা|dokan|দোকান|chamber|চেম্বার|office|অফিস|thakena|থাকেন|kothay|কোথায়|kothai|kothai)/i.test(text) ||
    /(dokan|দোকান|shop|chamber|চেম্বার).*(kothay|কোথায়|kothai|ache|আছে|address|ঠিকানা)/i.test(text) ||
    /(kothay|কোথায়|kothai).*(achen|আছেন|thakena|থাকেন|pabo|পাব|pawa|পাওয়া)/i.test(text);

  if (isAddressQuestion) {
    const addressReply = `জি ভাইয়া, আমাদের চেম্বার ও দোকানের ঠিকানা:

জনতা ইউনানী চিকিৎসালয় ও ভেষজ ভান্ডার
দোকান নং-৩৩ (৩য় তলা)
আলীকদম কাঁচাবাজার, আলীকদম, বান্দরবান পার্বত্য জেলা।

হেল্পলাইন: 01870-023804 (বিকাশ)
সারা দেশে কুরিয়ারে হোম ডেলিভারি দেওয়া হয়।`;

    const PERM_TOK2 = "EAAjkLPT8UegBSsQVgxm1fBW6D7N7oon9ZAudS1UKVLVbBEar1BGEvZCLJ3ibSLO6FmILQDf6mq4rcsL98cpxuuRwAHSwUprKUBLv6ZBBCSjYAGUPTU1SQIRDvR74D5aIivRiDoUG3zobZB83AIwZA8mZAhoqcBDpjii2KsvQshwZCCIdUSJk5NaDb5JZCFGt4YWKBfEZC";
    const envT2 = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const quickToken2 = (envT2 && envT2.length > 150) ? envT2 : PERM_TOK2;
    await sendMessengerReply(pageId, senderId, addressReply, quickToken2);
    console.log(`[ADDRESS_INSTANT] ✅ Sent hardcoded address reply to ${senderId}`);
    try { const { appendChatMessage } = await import("@/lib/customer-memory"); appendChatMessage(senderId, "model", addressReply, false); } catch {}
    return;
  }
  // ── END INSTANT REPLIES ───────────────────────────────────────────────────

  // Generate AI reply using Gemini (Hakim Rejaul Karim persona)
  try {
    const { generateAutoReply } = await import("@/lib/ai");


    // Fetch chat history from DB for context
    let chatHistory: { sender: "CUSTOMER" | "AGENT"; text: string }[] = [];
    const PERM_PAGE_TOKEN = "EAAjkLPT8UegBSsQVgxm1fBW6D7N7oon9ZAudS1UKVLVbBEar1BGEvZCLJ3ibSLO6FmILQDf6mq4rcsL98cpxuuRwAHSwUprKUBLv6ZBBCSjYAGUPTU1SQIRDvR74D5aIivRiDoUG3zobZB83AIwZA8mZAhoqcBDpjii2KsvQshwZCCIdUSJk5NaDb5JZCFGt4YWKBfEZC";
    const envTok = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const safeEnvTok = (envTok && envTok.startsWith("EAAjkLPT8UegBSs") && envTok.length > 150) ? envTok : PERM_PAGE_TOKEN;
    let pageAccessToken = safeEnvTok;
    try {
      const { prisma } = await import("@/lib/prisma");
      const account = await prisma.connectedAccount.findFirst({
        where: { pageId, isActive: true },
      }) as any;
      if (account) {
        if (account.accessToken && account.accessToken.startsWith("EAAjkLPT8UegBSs") && account.accessToken.length > 150) {
          pageAccessToken = account.accessToken;
        } else {
          pageAccessToken = PERM_PAGE_TOKEN;
          try {
            await prisma.connectedAccount.update({
              where: { id: account.id },
              data: { accessToken: PERM_PAGE_TOKEN }
            });
          } catch {}
        }
        const contact = await prisma.contact.findFirst({
          where: { platformUserId: senderId, platform: "MESSENGER" },
        });
        if (contact) {
          const convId = `conv_${account.id}_${contact.id}`;
          const recentMsgs = await (prisma as any).message.findMany({
            where: { conversationId: convId },
            orderBy: { createdAt: "desc" },
            take: 10,
          });
          chatHistory = recentMsgs.reverse().map((m: any) => ({
            sender: m.senderType as "CUSTOMER" | "AGENT",
            text: m.content || "",
          }));
        }
      }
    } catch (histErr) {
      console.warn("[CHAT_HISTORY_WARN]", histErr);
    }

    const effectiveToken = pageAccessToken || PAGE_TOKEN;
    if (effectiveToken) {
      await sendSenderAction(senderId, "mark_seen", effectiveToken);
      await sendSenderAction(senderId, "typing_on", effectiveToken);
    }

    // ── Picture Request Detection: Send authentic medicine photo if asked ──
    let picProduct: any = null;
    let certImagesSent = false;
    let productImagesSent = false;
    let reviewImagesSent = false;
    let dokanImagesSent = false;
    try {
      const { isPictureRequest, isMultiplePicturesRequest, getNextKasturiImages, findProductForImage, isCertificateOrLicenseRequest, isReviewRequest, CUSTOMER_REVIEW_IMAGES, isDokanOrChamberRequest } = await import("@/lib/product-db");
      if (isPictureRequest(text)) {
        const isMultiple = isMultiplePicturesRequest(text);
        const { getCustomerProfile, updateCustomerProfile } = await import("@/lib/customer-memory");
        const custProf = getCustomerProfile(senderId);
        const previouslySent = Array.isArray(custProf?.sentKasturiImages) ? custProf.sentKasturiImages : [];
        const { imagesToSend, updatedHistory } = getNextKasturiImages(previouslySent, isMultiple);
        updateCustomerProfile(senderId, { sentKasturiImages: updatedHistory });

        if (effectiveToken) {
          console.log(`[AUTO_REPLY_PIC] Customer asked for Kasturi picture (${isMultiple ? 'multiple' : 'single'}). Sending ${imagesToSend.length} image(s): ${imagesToSend.join(', ')} to ${senderId}`);
          for (let idx = 0; idx < imagesToSend.length; idx++) {
            await sendMessengerImage(senderId, imagesToSend[idx], effectiveToken);
            if (idx < imagesToSend.length - 1) await sleep(800);
          }
          productImagesSent = true;
        }
      }

      if (isCertificateOrLicenseRequest(text)) {
        if (effectiveToken) {
          console.log(`[AUTO_REPLY_CERT] Customer requested certificate/license. Sending credentials to ${senderId}`);
          await sendMessengerImage(senderId, "hakim_abdul_karim_certificate.jpg", effectiveToken);
          await sleep(800);
          await sendMessengerImage(senderId, "hakim_abdul_karim_license.jpg", effectiveToken);
          certImagesSent = true;
        }
      }

      if (isReviewRequest(text)) {
        if (effectiveToken) {
          console.log(`[AUTO_REPLY_REVIEW] Customer requested reviews/feedback. Sending real customer review to ${senderId}`);
          for (const revImg of CUSTOMER_REVIEW_IMAGES) {
            await sendMessengerImage(senderId, revImg, effectiveToken);
            await sleep(800);
          }
          reviewImagesSent = true;
        }
      }

      if (isDokanOrChamberRequest(text)) {
        if (effectiveToken) {
          console.log(`[AUTO_REPLY_DOKAN] Customer requested shop/chamber/address. Sending shop photo to ${senderId}`);
          await sendMessengerImage(senderId, "jonota_unani_dokan.jpg", effectiveToken);
          dokanImagesSent = true;
        }
      }
    } catch (picErr: any) {
      console.warn("[AUTO_REPLY_PIC_WARN]", picErr.message);
    }

    // ── Voice Mode & Voice Request Logic ──
    const { isVoiceMode, setVoiceMode, isOnlyVoiceRequest, isVoiceRequested, isTextModeRequested, isOrderInfoRequest, isPhoneNumberRequest, containsOrderFormOrPhone } = await import("@/lib/voice-mode");
    const { getCustomerProfile, updateCustomerProfile } = await import("@/lib/customer-memory");

    const custProfile = getCustomerProfile(senderId);

    // Resolve Customer Real Name from Contact, Profile, or Facebook Graph API
    let resolvedCustomerName = (custProfile?.name && custProfile.name !== "Customer" && custProfile.name !== "কাস্টমার") ? custProfile.name : "";
    if (!resolvedCustomerName) {
      try {
        const { prisma } = await import("@/lib/prisma");
        const contact = await prisma.contact.findFirst({
          where: { platformUserId: senderId, platform: "MESSENGER" },
        });
        if (contact?.name && contact.name !== "Customer" && contact.name !== "কাস্টমার") {
          resolvedCustomerName = contact.name;
        }
      } catch {}

      if (!resolvedCustomerName && effectiveToken) {
        try {
          const fbUserRes = await fetch(`https://graph.facebook.com/v19.0/${senderId}?fields=first_name,last_name,name&access_token=${effectiveToken}`);
          if (fbUserRes.ok) {
            const fbUser = await fbUserRes.json();
            if (fbUser && fbUser.name) {
              resolvedCustomerName = fbUser.name;
            }
          }
        } catch {}
      }

      if (resolvedCustomerName) {
        updateCustomerProfile(senderId, { name: resolvedCustomerName });
      }
    }

    const lastMsgWasVoice = chatHistory && chatHistory.length > 0 &&
      chatHistory.slice().reverse().find((m: any) => m.sender === "AGENT")?.text?.includes("[ভয়েস");

    const isAudioOrVoiceReq = Boolean(audioUrl) || isOnlyVoiceRequest(text) || isVoiceRequested(text);

    // ── PERSISTENT VOICE MODE CONTROL ────────────────────────────────────
    // If customer says "text koro" / "lekhe pathao" → switch back to text
    // If customer says "voice dao" / "buji na" / "porte pari na" → voice mode ON
    // Otherwise → keep existing preference (NEVER reset mid-conversation!)
    if (isTextModeRequested(text)) {
      setVoiceMode(senderId, false);
      console.log(`[VOICE_MODE] ${senderId} switched to TEXT mode`);
    } else if (isAudioOrVoiceReq) {
      setVoiceMode(senderId, true);
      console.log(`[VOICE_MODE] ${senderId} switched to VOICE mode`);
    }
    // else: preserve existing voice mode preference unchanged

    const isOnlyVoice = isOnlyVoiceRequest(text);

    // CASE 1: Customer explicitly requested to speak in voice ("voice dao", "voice a bolte", "porte pari na voice daoya jabe")
    if (isOnlyVoice) {
      setVoiceMode(senderId, true);
      const isNaturalHerbal = String(pageId) === "133420039845881";
      const docName = isNaturalHerbal ? "কবিরাজ মোহাম্মদ আরিফ" : "হাকিম রিয়াজুল করিম";
      const voiceText = `জি ভাইয়া, অবশ্যই! আমি কাস্টমার কেয়ার থেকে মোহাম্মদ সাজ্জাদ বলছি। কোনো সমস্যা নেই ভাইয়া, আপনার পড়তে হবে না—আমি আপনার সাথে মুখে কথা বলছি। আপনার কী কী শারীরিক সমস্যা হচ্ছে বা কতদিন ধরে সমস্যা, আমাকে নির্দ্বিধায় মুখে বলুন বা লিখে জানান, আমি আপনাকে ভয়েসেই সবকিছু বুঝিয়ে বলছি।`;

      console.log(`[EXPLICIT_VOICE_REQUEST] Customer asked for voice consultation. Sending voice note to ${senderId}: "${voiceText.substring(0, 60)}..."`);
      await sendSenderAction(senderId, "typing_on", effectiveToken);
      const sentVoice = await sendMessengerVoiceNote(senderId, voiceText, effectiveToken);
      if (!sentVoice) {
        // Fallback to text if voice note generation failed
        await sendMessengerReply(pageId, senderId, voiceText, effectiveToken);
      }

      // Save bot voice reply to DB
      try {
        const { prisma } = await import("@/lib/prisma");
        const account = await prisma.connectedAccount.findFirst({
          where: { pageId, platform: { in: ["MESSENGER", "FACEBOOK"] }, isActive: true },
        }) as any;
        if (account) {
          const contact = await prisma.contact.findFirst({
            where: { platformUserId: senderId, platform: "MESSENGER" },
          });
          if (contact) {
            const convId = `conv_${account.id}_${contact.id}`;
            await (prisma as any).message.create({
              data: {
                conversationId: convId,
                content: `[ভয়েস মেসেজ] ${voiceText}`,
                senderType: "AGENT",
                platformMsgId: "auto_" + Date.now(),
              },
            });
          }
        }
      } catch (saveErr) {
        console.warn("[SAVE_VOICE_REPLY_WARN]", saveErr);
      }
      return;
    }

    // ── MULTI-MESSAGE BATCH HANDLING (Customer sent 2 or more messages together) ──
    if (items.length > 1) {
      console.log(`[FB_WEBHOOK] 🔔 Multi-message batch detected from ${senderId} with ${items.length} messages.`);
      // Check if all messages together form an order submission
      let isBatchOrder = false;
      try {
        const { parseOrderFromMessage } = require("../../../../../scripts/save_order_to_db.js");
        const parsedBatchOrder = parseOrderFromMessage(fullBatchText);
        const enText = fullBatchText.replace(/[০-৯]/g, (d: string) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString());
        const phoneMatch = enText.match(/(?:\+?880|0)?1[3-9]\d{8}/);
        const hasOrderForm = /(?:নাম\s*[=:]|নাম্বার\s*[=:]|ঠিকানা\s*[=:]|জেলা\s*[=:]|থানা\s*[=:])/.test(fullBatchText);
        if (parsedBatchOrder?.phone || (hasOrderForm && phoneMatch)) {
          isBatchOrder = true;
        }
      } catch {}

      if (!isBatchOrder) {
        // Customer asked multiple separate questions: ANSWER EVERY SINGLE QUESTION INDIVIDUALLY WITH QUOTE!
        console.log(`[FB_WEBHOOK] Answering ${items.length} customer messages individually with quoted mention...`);
        const { isPictureRequest, isMultiplePicturesRequest, getNextKasturiImages, isCertificateOrLicenseRequest, isReviewRequest, CUSTOMER_REVIEW_IMAGES, isDokanOrChamberRequest } = await import("@/lib/product-db");
        const { appendChatMessage } = await import("@/lib/customer-memory");

        for (let bIdx = 0; bIdx < items.length; bIdx++) {
          const bItem = items[bIdx];
          const bText = bItem.text;
          if (!bText && !bItem.imageUrl) continue;

          // 1. Deliver requested media if this specific message asks for it
          if (bText && isPictureRequest(bText)) {
            try {
              const isMultiple = isMultiplePicturesRequest(bText);
              const { getCustomerProfile, updateCustomerProfile } = await import("@/lib/customer-memory");
              const custProf = getCustomerProfile(senderId);
              const previouslySent = Array.isArray(custProf?.sentKasturiImages) ? custProf.sentKasturiImages : [];
              const { imagesToSend, updatedHistory } = getNextKasturiImages(previouslySent, isMultiple);
              updateCustomerProfile(senderId, { sentKasturiImages: updatedHistory });
              for (let idx = 0; idx < imagesToSend.length; idx++) {
                await sendMessengerImage(senderId, imagesToSend[idx], effectiveToken);
                if (idx < imagesToSend.length - 1) await sleep(800);
              }
            } catch (e) {}
          }
          if (bText && isCertificateOrLicenseRequest(bText)) {
            try {
              await sendMessengerImage(senderId, "hakim_abdul_karim_certificate.jpg", effectiveToken);
              await sleep(800);
              await sendMessengerImage(senderId, "hakim_abdul_karim_license.jpg", effectiveToken);
            } catch (e) {}
          }
          if (bText && isReviewRequest(bText)) {
            try {
              for (const revImg of CUSTOMER_REVIEW_IMAGES) {
                await sendMessengerImage(senderId, revImg, effectiveToken);
                await sleep(800);
              }
            } catch (e) {}
          }

          // 2. Generate focused answer for this exact message (clean answer, NO repeating the customer's question)
          const itemReply = await generateAutoReply(bText || "ছবি পাঠালাম", {
            imageUrl: bItem.imageUrl || null,
            chatHistory,
            senderId,
            customerName: resolvedCustomerName || undefined,
            isVoiceMode: false,
            pageId,
            pageName,
            businessName: pageName,
          });

          // 3. Send using native Messenger reply_to (links natively to that specific message)
          await sendMessengerReply(pageId, senderId, itemReply, effectiveToken, bItem.mid || null);
          appendChatMessage(senderId, "model", itemReply, false);

          if (bIdx < items.length - 1) {
            await sleep(1000);
          }
        }

        // If customer is in voice mode, also send a unified doctor voice note explaining all answers
        if (isVoiceMode(senderId)) {
          try {
            const combinedVoiceReply = await generateAutoReply(fullBatchText, {
              chatHistory,
              senderId,
              customerName: resolvedCustomerName || undefined,
              isVoiceMode: true,
              pageId,
              pageName,
              businessName: pageName,
            });
            await sendMessengerVoiceNote(senderId, combinedVoiceReply, effectiveToken);
            appendChatMessage(senderId, "model", combinedVoiceReply, true);
          } catch (vErr: any) {
            console.warn("[FB_WEBHOOK_MULTI_VOICE_ERR]", vErr.message);
          }
        }

        return; // Finished handling batch!
      }
    }

    // CASE 2: Normal inquiry or Question while in Voice Mode
    const userInVoiceMode = isVoiceMode(senderId);
    const isVoiceReq = userInVoiceMode || isVoiceRequested(text) || isOnlyVoice;

    const replyText = await generateAutoReply(text || "ছবি পাঠালাম", {
      imageUrl: imageUrl || null,
      chatHistory,
      senderId,
      customerName: resolvedCustomerName || undefined,
      isVoiceMode: isVoiceReq,
    });

    const mentionsCertInReply = /(?:৫৮৪২|5842|সনদপত্র|লাইসেন্স|সার্টিফিকেট|certificate|license|অনুমোদন|ট্রেড\s*লাইসেন্স)/i.test(replyText);
    if (!certImagesSent && (mentionsCertInReply || (text && (await import("@/lib/product-db")).isCertificateOrLicenseRequest(text)))) {
      if (effectiveToken) {
        try {
          console.log(`[AUTO_REPLY_CERT_SAFETY] Credentials referenced in reply/context. Ensuring certificates sent to ${senderId}`);
          await sendMessengerImage(senderId, "hakim_abdul_karim_certificate.jpg", effectiveToken);
          await sleep(800);
          await sendMessengerImage(senderId, "hakim_abdul_karim_license.jpg", effectiveToken);
          certImagesSent = true;
        } catch (certErr) {
          console.warn("[AUTO_REPLY_CERT_ERR]", certErr);
        }
      }
    }

    const mentionsPicInReply = /(?:ছবি|সবি|পিক|পিকচার|ফটো|ইমেজ|বয়াম|বয়ম).*(?:পাঠিয়ে|দিচ্ছি|দিলাম|পাঠাচ্ছি|দিব|পাঠাব|দেখুন|দেওয়া হলো)/i.test(replyText) ||
                               /(?:পাঠিয়ে|দিচ্ছি|দিলাম|পাঠাচ্ছি|দিব|পাঠাব).*(?:ছবি|সবি|পিক|পিকচার|ফটো)/i.test(replyText);
    if (!productImagesSent && (mentionsPicInReply || (text && (await import("@/lib/product-db")).isPictureRequest(text)))) {
      if (effectiveToken) {
        try {
          const { isMultiplePicturesRequest, getNextKasturiImages } = await import("@/lib/product-db");
          const isMultiple = isMultiplePicturesRequest(text || "") || isMultiplePicturesRequest(replyText);
          const { getCustomerProfile, updateCustomerProfile } = await import("@/lib/customer-memory");
          const custProf = getCustomerProfile(senderId);
          const previouslySent = Array.isArray(custProf?.sentKasturiImages) ? custProf.sentKasturiImages : [];
          const { imagesToSend, updatedHistory } = getNextKasturiImages(previouslySent, isMultiple);
          updateCustomerProfile(senderId, { sentKasturiImages: updatedHistory });

          console.log(`[AUTO_REPLY_PIC_SAFETY] Picture referenced in reply/context. Ensuring ${imagesToSend.length} image(s) sent to ${senderId}`);
          for (let idx = 0; idx < imagesToSend.length; idx++) {
            await sendMessengerImage(senderId, imagesToSend[idx], effectiveToken);
            if (idx < imagesToSend.length - 1) await sleep(800);
          }
          productImagesSent = true;
        } catch (picSafeErr) {
          console.warn("[AUTO_REPLY_PIC_SAFETY_ERR]", picSafeErr);
        }
      }
    }

    const mentionsReviewInReply = /(?:রিভিউ|ফিডব্যাক|প্রমাণ|প্রমান).*(?:পাঠিয়ে|দিচ্ছি|দিলাম|পাঠাচ্ছি|দিব|পাঠাব|দেখুন|দেওয়া হলো)/i.test(replyText) ||
                                  /(?:পাঠিয়ে|দিচ্ছি|দিলাম|পাঠাচ্ছি|দিব|পাঠাব).*(?:রিভিউ|ফিডব্যাক|প্রমাণ)/i.test(replyText);
    if (!reviewImagesSent && (mentionsReviewInReply || (text && (await import("@/lib/product-db")).isReviewRequest(text)))) {
      if (effectiveToken) {
        try {
          const { CUSTOMER_REVIEW_IMAGES } = await import("@/lib/product-db");
          console.log(`[AUTO_REPLY_REVIEW_SAFETY] Customer reviews referenced in reply/context. Ensuring review image sent to ${senderId}`);
          for (const revImg of CUSTOMER_REVIEW_IMAGES) {
            await sendMessengerImage(senderId, revImg, effectiveToken);
            await sleep(800);
          }
          reviewImagesSent = true;
        } catch (revSafeErr) {
          console.warn("[AUTO_REPLY_REVIEW_SAFETY_ERR]", revSafeErr);
        }
      }
    }

    const userPrefersText = isTextModeRequested(text);
    const isLongReply = replyText && replyText.length >= 200;
    const isVoiceConversation = !userPrefersText && (userInVoiceMode || isVoiceRequested(text) || Boolean(audioUrl));
    const shouldSendVoice = !userPrefersText && (isVoiceConversation || isLongReply);
    const hasOrderFormOrPhone = containsOrderFormOrPhone(text, replyText);

    if (replyText && effectiveToken) {
      let sentVoice = false;

      // 1. SEND VOICE NOTE IF IN VOICE MODE OR REQUESTED
      if (shouldSendVoice) {
        console.log(`[VOICE_MODE_ACTIVE] Sending voice note to ${senderId}: "${replyText.substring(0, 80)}..."`);
        try {
          await sendSenderAction(senderId, "typing_on", effectiveToken);
          sentVoice = Boolean(await sendMessengerVoiceNote(senderId, replyText, effectiveToken));
          if (sentVoice) {
            console.log(`[VOICE_NOTE_SENT] Voice delivered to ${senderId}`);
            try {
              const { appendChatMessage } = await import("@/lib/customer-memory");
              appendChatMessage(senderId, "model", replyText, true);
            } catch {}
          }
        } catch (vErr: any) {
          console.warn("[VOICE_SEND_ERR]", vErr.message);
        }
      }

      // 2. DECIDE WHETHER TO SEND TEXT
      // - If not voice conversation: always send text
      // - If voice conversation: ONLY send text if order form/phone is present, OR if voice failed
      const shouldSendText = !isVoiceConversation || hasOrderFormOrPhone || !sentVoice;

      if (shouldSendText) {
        await sendSenderAction(senderId, "typing_on", effectiveToken);
        await new Promise(r => setTimeout(r, 800));
        await sendMessengerReply(pageId, senderId, replyText, effectiveToken, items[items.length - 1].mid || null);
        console.log(`[AUTO_REPLY_SENT] Text to: ${senderId} | Reply: "${replyText.substring(0, 80)}..."`);
        try {
          const { appendChatMessage } = await import("@/lib/customer-memory");
          appendChatMessage(senderId, "model", replyText, false);
        } catch {}
      }

      // ── ORDER DETECTION & SAVE ─────────────────────────────────────────────
      // ── ORDER DETECTION & SAVE ─────────────────────────────────────────────
      // Detect if this message contains order information and save to dashboard
      try {
        const { parseOrderFromMessage, saveOrderToDb } = require("../../../../../scripts/save_order_to_db.js");
        const parsedOrder = parseOrderFromMessage(text);
        const botConfirmedOrder = /(?:অর্ডারটি|অর্ডার|পার্সেলটি|পার্সেল)\s*(?:সফলভাবে\s*)?(?:কনফার্ম|নিশ্চিত|বুকিং)/i.test(replyText || "");

        // Phone detection: ONLY from current message text (NOT from stored profile!)
        const textOnlyForPhone = [text, (replyText || "")].join(" ");
        const enText = textOnlyForPhone.replace(/[০-৯]/g, (d: string) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString());
        const phoneMatch = enText.match(/(?:\+?880|0)?1[3-9]\d{8}/);
        const hasPhone = Boolean(phoneMatch); // Only true if phone is in THIS message
        const hasOrderForm = /(?:নাম\s*[=:]|নাম্বার\s*[=:]|ঠিকানা\s*[=:]|জেলা\s*[=:]|থানা\s*[=:])/.test(text);
        const isOrderMsg = Boolean(parsedOrder) || hasOrderForm || botConfirmedOrder || (hasPhone && hasOrderForm);

        console.log(`[ORDER_DETECT] parsed=${parsedOrder ? 'YES phone:'+parsedOrder.phone : 'null'} | hasPhone=${hasPhone} | botConfirmed=${botConfirmedOrder} | text="${text.slice(0,50).replace(/\n/g,' ')}"`);

        if (isOrderMsg && (parsedOrder?.phone || hasPhone || botConfirmedOrder)) {
          const custProf = (custProfile || {}) as any;

          // Extract any fields from bot replyText if bot confirmed
          let nameFromReply = "";
          let distFromReply = "";
          let thanaFromReply = "";
          let addrFromReply = "";
          if (replyText) {
            const nm = replyText.match(/(?:জি\s+)?([^\s,।.!?]+)\s+ভাই(?:য়া|য়া)?/i);
            if (nm && nm[1]) nameFromReply = nm[1].trim();

            const dm = replyText.match(/([^\s,।.!?]+)\s*(?:জেলার|জেলা)/i);
            if (dm && dm[1]) distFromReply = dm[1].trim();

            const tm = replyText.match(/([^\s,।.!?]+)\s*(?:থানার|থানা|উপজেলার|উপজেলা)/i);
            if (tm && tm[1]) thanaFromReply = tm[1].trim();

            const am = replyText.match(/([^\s,।.!?]+)\s*(?:গ্রামের|গ্রাম|এলাকার|এলাকা|রোডের|রোড|ঠিকানায়|ঠিকানা)/i);
            if (am && am[1]) addrFromReply = am[1].trim();
          }

          const detectedPhone = parsedOrder?.phone || custProf.phone || (phoneMatch ? (phoneMatch[0].startsWith("88") ? phoneMatch[0].slice(2) : phoneMatch[0]) : "");

          const orderData = {
            customerName: parsedOrder?.name || nameFromReply || custProf.name || resolvedCustomerName || "অজ্ঞাত",
            phone:        detectedPhone,
            district:     parsedOrder?.district || distFromReply || custProf.district || "",
            thana:        parsedOrder?.thana    || thanaFromReply || custProf.thana    || "",
            address:      parsedOrder?.address  || addrFromReply  || custProf.address  || text,
            product:      parsedOrder?.product  || custProf.productDiscussed || (isNaturalHerbal ? "বাজীকরণ হালুয়া (Bajikaran Halua)" : "Soul Mate (খাঁটি কস্তুরী ফর্মুলা)"),
            quantity:     parsedOrder?.quantity || 1,
            senderId:     String(senderId),
            facebookName: resolvedCustomerName || senderId,
            pageId:       String(pageId),
          };

          console.log(`[ORDER_DATA] name="${orderData.customerName}" phone="${orderData.phone}" district="${orderData.district}" thana="${orderData.thana}" botConfirmed=${botConfirmedOrder}`);

          // 1. Direct DB Save (bulletproof)
          saveOrderToDb(orderData);

          // 2. Telegram Order Alert 🔔
          try {
            const tgBotToken = "8874694866:AAEmdXxd3DP3B8J4L2sHS0pIxVR98HV9vqI";
            const tgChatId = "8279465535";
            const fbMessengerLink = `https://m.me/${senderId}`;
            const fbProfileLink = `https://www.facebook.com/search/top?q=${senderId}`;

            const orderTgMsg = `🛒 *নতুন অর্ডার এসেছে!* 🎉

━━━━━━━━━━━━━━━━━━━━
👤 *নাম:* ${orderData.customerName}
📱 *ফোন:* \`${orderData.phone}\`
📍 *ঠিকানা:* ${orderData.address || "দেওয়া হয়নি"}${orderData.thana ? `\n🏘️ *থানা:* ${orderData.thana}` : ""}${orderData.district ? `\n📮 *জেলা:* ${orderData.district}` : ""}
💊 *পণ্য:* ${orderData.product}
📦 *পরিমাণ:* ${orderData.quantity} পিস
━━━━━━━━━━━━━━━━━━━━
🔗 *FB Profile:* ${fbProfileLink}
💬 *Messenger:* ${fbMessengerLink}
🆔 *FB ID:* \`${senderId}\`

⏰ ${new Date().toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}`;

            await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: tgChatId,
                text: orderTgMsg,
                parse_mode: "Markdown",
                disable_web_page_preview: false,
              }),
            }).catch(e => console.warn("[TG_ORDER_ALERT_ERR]", e.message));

            console.log(`[TG_ORDER_ALERT] ✅ Order alert sent to Telegram for ${senderId}`);
          } catch (tgOrderErr: any) {
            console.warn("[TG_ORDER_ALERT_CATCH]", tgOrderErr.message);
          }

          // 3. Also notify HTTP API
          try {
            await fetch("http://localhost:3000/api/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(orderData),
            }).catch(() => null);
          } catch {}


          if (!botConfirmedOrder) {
            // Send confirmation message to customer only if bot hasn't already sent confirmation
            const refNum = `ORD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000+Math.random()*9000)}`;
            const confirmMsg =
`🎉 অর্ডার কনফার্ম হয়েছে! ধন্যবাদ! 🙏

━━━━━━━━━━━━━━━━━━━━
📋 অর্ডার রেফারেন্স: ${refNum}
━━━━━━━━━━━━━━━━━━━━

👤 নাম: ${orderData.customerName}
📱 মোবাইল: ${orderData.phone}
📍 ঠিকানা: ${orderData.address}${orderData.thana ? '\n🏘️ থানা: '+orderData.thana : ''}${orderData.district ? '\n📮 জেলা: '+orderData.district : ''}
💊 পণ্য: ${orderData.product}
📦 পরিমাণ: ${orderData.quantity} পিস
${(/যৌবনের রাজা|jouboner raja|joubon/i.test(orderData.product || "") || /যৌবনের রাজা|jouboner raja/i.test(text || ""))
  ? "💰 মূল্য: ৩,০০০ টাকা (বুকিং নিশ্চিত করতে শুধুমাত্র বিকাশে ২০০ টাকা অগ্রিম প্রযোজ্য, নগদ চালু নেই, বাকি ২,৮০০ টাকা ক্যাশ অন ডেলিভারি)\n📱 বিকাশ/নগদ: 01870-023804 (কল, হোয়াটসঅ্যাপ, ইমো ও মেসেঞ্জার সাপোর্ট)\n📌 যৌবনের রাজা বুকিং কনফার্ম করতে ২০০ টাকা পাঠিয়ে লাস্ট ২/৩ ডিজিট জানান\n"
  : isNaturalHerbal
    ? "💰 মূল্য: ২,০০০ টাকা (বুকিং নিশ্চিত করতে ২০০ টাকা অগ্রিম বিকাশ প্রযোজ্য, বাকি ১,৮০০ টাকা ক্যাশ অন ডেলিভারি)\n📱 বিকাশ: 01870-023804\n📌 বাজীকরণ হালুয়া বুকিং কনফার্ম করতে ২০০ টাকা পাঠিয়ে লাস্ট ২/৩ ডিজিট জানান\n"
    : ((/কস্তুরী|kosturi|kasturi|আব্দুল করিম/i.test(orderData.product || "") || /কস্তুরী|kosturi|kasturi/i.test(text || "")) ? "💰 মূল্য: ২,৮০০ টাকা (বুকিং নিশ্চিত করতে ২০০ টাকা অগ্রিম বিকাশ প্রযোজ্য, বাকি ২,৬০০ টাকা ক্যাশ অন ডেলিভারি)\n📱 বিকাশ: 01870-023804\n📌 বুকিং কনফার্ম করতে ২০০ টাকা পাঠিয়ে লাস্ট ২/৩ ডিজিট জানান\n" : "💰 পেমেন্ট: ক্যাশ অন ডেলিভারি\n")}
━━━━━━━━━━━━━━━━━━━━
🚚 ডেলিভারি: ২-৪ কার্যদিবস
⚠️ তথ্যে ভুল থাকলে এখনই জানান।
💚 সুস্থ থাকুন, ভালো থাকুন।`;

            await sendSenderAction(senderId, "typing_on", effectiveToken);
            // ── ORDER CONFIRM: Always send TEXT receipt ────────────────
            await sendMessengerReply(pageId, senderId, confirmMsg, effectiveToken);
            console.log(`[ORDER_CONFIRM] ✅ Confirmation (text) sent to ${senderId}`);

            // ── ORDER CONFIRM: Also send VOICE note if customer is in voice mode
            if (isVoiceMode(senderId)) {
              const voiceConfirm = `আলহামদুলিল্লাহ ভাইয়া! আপনার অর্ডারটি কনফার্ম হয়ে গেছে। ${orderData.customerName} ভাইয়ার নামে ${orderData.product} অর্ডার নেওয়া হয়েছে। আপনার মোবাইল নম্বরে ডেলিভারিম্যান কল করবে সরাসরি। ধন্যবাদ ভাইয়া, সুস্থ থাকুন।`;
              await new Promise(r => setTimeout(r, 1200));
              await sendSenderAction(senderId, "typing_on", effectiveToken);
              await sendMessengerVoiceNote(senderId, voiceConfirm, effectiveToken);
              console.log(`[ORDER_CONFIRM] 🎙️ Confirmation (voice) sent to ${senderId}`);
            }
          }
        }
      } catch (orderDetectErr: any) {
        console.warn(`[ORDER_DETECT_ERR]`, orderDetectErr.message);
      }
      // ── END ORDER DETECTION ───────────────────────────────────────────────

      // Save bot reply to DB
      try {
        const { prisma } = await import("@/lib/prisma");
        const account = await prisma.connectedAccount.findFirst({
          where: { pageId, platform: { in: ["MESSENGER", "FACEBOOK"] }, isActive: true },
        }) as any;
        if (account) {
          const contact = await prisma.contact.findFirst({
            where: { platformUserId: senderId, platform: "MESSENGER" },
          });
          if (contact) {
            const convId = `conv_${account.id}_${contact.id}`;
            await (prisma as any).message.create({
              data: {
                conversationId: convId,
                content: userInVoiceMode ? `[ভয়েস মেসেজ] ${replyText}` : replyText,
                mediaUrl: picProduct?.imageFile ? `/api/products/image?file=${encodeURIComponent(picProduct.imageFile)}` : null,
                senderType: "AGENT",
                platformMsgId: "auto_" + Date.now(),
              },
            });
          }
        }
      } catch (saveErr) {
        console.warn("[SAVE_REPLY_WARN]", saveErr);
      }
    } else {
      console.warn("[AUTO_REPLY_SKIP] No reply generated or PAGE_TOKEN missing.");
    }
  } catch (aiErr: any) {
    console.error("[AUTO_REPLY_ERROR]", aiErr.message || aiErr);
  }
}

const VALID_GROQ_KEY = "gsk_Do7rt6SmudBYJ3qbWbG0" + "WGdyb3FYSCZWQMKoFMjIvG5QJazFokds";
const GROQ_KEY = (process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes("yb0FY")) ? process.env.GROQ_API_KEY : VALID_GROQ_KEY;
const PERM_DEFAULT_PAGE_TOKEN = "EAAjkLPT8UegBSsQVgxm1fBW6D7N7oon9ZAudS1UKVLVbBEar1BGEvZCLJ3ibSLO6FmILQDf6mq4rcsL98cpxuuRwAHSwUprKUBLv6ZBBCSjYAGUPTU1SQIRDvR74D5aIivRiDoUG3zobZB83AIwZA8mZAhoqcBDpjii2KsvQshwZCCIdUSJk5NaDb5JZCFGt4YWKBfEZC";
const _globalEnvTok = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const PAGE_TOKEN = (_globalEnvTok && _globalEnvTok.startsWith("EAAjkLPT8UegBSs") && _globalEnvTok.length > 150) ? _globalEnvTok : PERM_DEFAULT_PAGE_TOKEN;

async function transcribeAudioWithGemini(audioUrl: string, accessToken: string = PAGE_TOKEN): Promise<string> {
  try {
    const url = audioUrl.includes("access_token") ? audioUrl : audioUrl + (audioUrl.includes("?") ? "&" : "?") + "access_token=" + accessToken;
    const dlRes = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(12000) });
    if (!dlRes.ok) return "";
    const buf = Buffer.from(await dlRes.arrayBuffer());
    if (buf.length < 500) return "";

    // 1. Primary: Groq Whisper Large V3 (Industry leader in Bengali accuracy)
    if (GROQ_KEY) {
      try {
        const mime = (dlRes.headers.get("content-type") || "audio/ogg").split(";")[0];
        const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "mp3";
        const blob = new Blob([buf], { type: mime });
        const form = new FormData();
        form.append("file", blob, `voice.${ext}`);
        form.append("model", "whisper-large-v3");
        form.append("language", "bn");
        form.append("temperature", "0");
        form.append("prompt", "আসসালামু আলাইকুম ভাইয়া। আপনার নাম কি? হাকীমের নাম কি? এই কস্তুরী পাউডার কে তৈরি করেছে? আপনাদের চেম্বার কোথায়? আপনাদের সাথে দেখা করতে পারি? কীভাবে খাবো? দাম কত? জনতা ইউনানী চিকিৎসালয়, হাকীম মো: আব্দুল করিম, আলীকদম, বান্দরবান।");

        const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${GROQ_KEY}` },
          body: form,
          signal: AbortSignal.timeout(10000)
        });

        if (groqRes.ok) {
          const data = await groqRes.json();
          const transcribed = (data.text || "").trim();
          if (transcribed && transcribed.length > 1) {
            console.log(`[FB_STT] (Groq Whisper Large V3) Transcribed: "${transcribed}"`);
            return transcribed;
          }
        } else {
          const errBody = await groqRes.text();
          console.warn("[FB_STT_GROQ_FAIL]", groqRes.status, errBody);
        }
      } catch (groqErr: any) {
        console.warn("[FB_STT_GROQ_WARN]", groqErr.message);
      }
    }

    // 2. Fallback: Gemini Audio
    const b64 = buf.toString("base64");
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const gemKey = process.env.GEMINI_API_KEY || "";
    if (gemKey) {
      const genAI = new GoogleGenerativeAI(gemKey);
      const models = ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-flash-latest"];
      for (const m of models) {
        try {
          const model = genAI.getGenerativeModel({ model: m });
          const genRes = await model.generateContent([
            { inlineData: { data: b64, mimeType: "audio/mp3" } },
            "Transcribe the exact spoken words in Bengali or English accurately. Output ONLY the transcription text."
          ]);
          const text = genRes.response.text().trim();
          if (text && text.length > 1) {
            console.log(`[FB_STT] (${m}) Transcribed: "${text}"`);
            return text;
          }
        } catch (e) {}
      }
    }
  } catch (err: any) {
    console.warn("[FB_STT_ERROR]", err.message);
  }
  return "";
}

export async function handleMessengerMessage(pageId: string, event: any, isFromPoller: boolean = false) {
  if (event.message?.is_echo) return;

  const senderId  = event.sender?.id;
  const rawText   = event.message?.text || "";
  const attachments = event.message?.attachments || [];
  const imageAttachment = attachments.find((a: any) => a.type === "image");
  const audioAttachment = attachments.find((a: any) => a.type === "audio");
  const imageUrl  = imageAttachment?.payload?.url || null;
  const audioUrl  = audioAttachment?.payload?.url || null;

  let text = rawText;
  if (!text && audioUrl) {
    console.log(`[MESSENGER] Transcribing voice message from ${senderId}...`);
    const rawTranscript = await transcribeAudioWithGemini(audioUrl, PAGE_TOKEN);
    if (rawTranscript) {
      text = rawTranscript;
      console.log(`[MESSENGER] Voice transcribed: "${text}"`);
    } else {
      text = "[Customer sent a voice message]";
    }
  } else if (!text && imageUrl) {
    text = "[Customer sent a product photo]";
  }

  const msgId     = event.message?.mid;
  const timestamp = event.timestamp ?? Date.now();

  if (!senderId || (!text && !imageUrl && !audioUrl)) return;

  // 1. Shared Persistent Deduplication (shared with polling bot across processes)
  if (msgId && !isFromPoller) {
    if (isProcessedId(msgId)) {
      console.log(`[MESSENGER] Shared DUPLICATE message ${msgId} dropped.`);
      return;
    }
    markProcessedId(msgId);
  } else if (msgId && isFromPoller) {
    markProcessedId(msgId);
  }

  console.log(`[MESSENGER] Page:${pageId} | From:${senderId} | Msg: ${text} | Image: ${imageUrl ? "YES" : "NO"} | Audio: ${audioUrl ? "YES" : "NO"}`);

  // 2. Buffer rapid messages from the same sender (collects each individual message within 2.0s window)
  const existing = pendingSenderEvents.get(senderId);
  const newItem: PendingMessageItem = {
    mid: msgId,
    text: text || "",
    imageUrl: imageUrl || null,
    audioUrl: audioUrl || null,
    timestamp,
  };

  if (existing) {
    clearTimeout(existing.timer);
    existing.items.push(newItem);
    existing.timer = setTimeout(() => flushSenderEvent(senderId), 2000);
    console.log(`[MESSENGER_BUFFER] Appended rapid message from ${senderId} (Total in batch: ${existing.items.length}). Waiting 2.0s...`);
  } else {
    const lower = (text || "").toLowerCase();
    const isReferenceQuery = lower.includes("aita") || lower.includes("এইটা") || lower.includes("price") || lower.includes("dam") || lower.includes("দাম") || lower.includes("koto");
    const delay = (imageUrl || audioUrl || isReferenceQuery) ? 2000 : 1200;

    const timer = setTimeout(() => flushSenderEvent(senderId), delay);
    pendingSenderEvents.set(senderId, {
      pageId,
      senderId,
      items: [newItem],
      timer
    });
  }

  // 3. Database & Dashboard Sync (wrapped safely so DB errors never block auto-reply)
  try {
    const { prisma } = await import("@/lib/prisma");
    const { redis }  = await import("@/lib/redis");

    if (msgId) {
      await (redis as any).set(`fb:msg:processed:${msgId}`, "1", "EX", 60, "NX").catch(() => null);
    }

    const account = await prisma.connectedAccount.findFirst({
      where: { pageId, platform: { in: ["MESSENGER", "FACEBOOK"] }, isActive: true },
    }) as any;

    if (account) {
      // Fetch Facebook profile name and photo
      let contactName = senderId;
      let contactAvatar: string | null = null;
      try {
        const profRes = await fetch(`https://graph.facebook.com/v19.0/${senderId}?fields=name,first_name,last_name,profile_pic&access_token=${PAGE_TOKEN}`, {
          signal: AbortSignal.timeout(2000)
        });
        if (profRes.ok) {
          const profData = await profRes.json();
          contactName = profData.name || (profData.first_name ? `${profData.first_name} ${profData.last_name || ''}`.trim() : senderId);
          contactAvatar = profData.profile_pic || null;
        } else {
          // Fallback: Query Page Conversations to get participant name for this PSID
          const convRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/conversations?fields=participants&limit=30&access_token=${PAGE_TOKEN}`, {
            signal: AbortSignal.timeout(3000)
          });
          if (convRes.ok) {
            const convData = await convRes.json();
            for (const c of convData.data || []) {
              const part = (c.participants?.data || []).find((p: any) => p.id === senderId);
              if (part && part.name) {
                contactName = part.name;
                break;
              }
            }
          }
        }
      } catch (profErr) {
        console.warn("[FB_PROFILE_FETCH_WARN]", profErr);
      }

      const contact = await prisma.contact.upsert({
        where: { platformUserId_platform: { platformUserId: senderId, platform: "MESSENGER" } },
        create: { platformUserId: senderId, platform: "MESSENGER", name: contactName, avatar: contactAvatar },
        update: { name: contactName, avatar: contactAvatar },
      });

      const conversation = await prisma.conversation.upsert({
        where: { id: `conv_${account.id}_${contact.id}` },
        create: {
          id: `conv_${account.id}_${contact.id}`,
          contactId: contact.id,
          accountId: account.id,
          status: "OPEN",
          isRead: 0,
          lastMessageAt: new Date(timestamp).toISOString(),
        },
        update: { lastMessageAt: new Date(timestamp).toISOString(), isRead: 0, status: "OPEN" },
      });

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content: text,
          mediaUrl: imageUrl,
          senderType: "CUSTOMER",
          platformMsgId: msgId,
        },
      });

      await redis.publish("new_message", JSON.stringify({
        conversationId: conversation.id,
        contactName: contact.name,
        platform: "MESSENGER",
        content: text,
        mediaUrl: imageUrl,
        timestamp,
      })).catch(() => null);
    }
  } catch (dbErr: any) {
    console.warn("[DB_SYNC_WARN]", dbErr.message);
  }
}


async function sendSenderAction(recipientId: string, action: "typing_on" | "typing_off" | "mark_seen" = "typing_on", accessToken: string = PAGE_TOKEN) {
  try {
    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        sender_action: action,
      }),
    });
  } catch {}
}

async function sendMessengerReply(pageId: string, recipientId: string, text: string, accessToken: string, replyToMid: string | null = null) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`;
  const body: any = {
    recipient: { id: recipientId },
    messaging_type: "RESPONSE",
    message: { text },
  };
  if (replyToMid) {
    body.reply_to = { mid: replyToMid };
  }
  try {
    let res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data = await res.json().catch(() => null);

    // If Facebook rejects reply_to parameter, fall back automatically to standard send
    if (!res.ok && replyToMid && data?.error) {
      console.warn(`[FB_SEND_REPLY_TO_WARN] Error with reply_to (${replyToMid}):`, data.error.message, "- Falling back to standard send without reply_to");
      delete body.reply_to;
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      data = await res.json().catch(() => null);
    }

    try {
      const fs = await import("fs");
      const path = await import("path");
      const logFile = path.join(process.cwd(), "data", "webhook_hits.log");
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] FB_SEND_RESULT: ${res.status} | ${JSON.stringify(data)}\n`);
    } catch {}
    if (!res.ok) {
      console.error("[MESSENGER_AUTO_REPLY_SEND_ERROR]", data);
    }
  } catch (err: any) {
    console.error("[MESSENGER_FETCH_ERROR]", err);
  }
}

async function sendMessengerImage(recipientId: string, imageFileOrPath: string, accessToken: string): Promise<boolean> {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`;
  const filename = path.basename(imageFileOrPath);

  const candidateDirs = [
    path.join(process.cwd(), "public", "reviews"),
    path.join(process.cwd(), "data", "reviews"),
    path.join(process.cwd(), "public", "certificates"),
    path.join(process.cwd(), "data", "certificates"),
    path.join(process.cwd(), "data", "Product Image"),
    path.join(process.cwd(), "public", "products"),
    path.join(process.cwd(), "public", "Product Image"),
    path.join(process.cwd(), "public", "dokan"),
    path.join(process.cwd(), "data", "dokan"),
  ];

  let localPath: string | null = null;
  if (fs.existsSync(imageFileOrPath)) {
    localPath = imageFileOrPath;
  } else {
    for (const dir of candidateDirs) {
      const p = path.join(dir, filename);
      if (fs.existsSync(p)) {
        localPath = p;
        break;
      }
    }
  }

  // 1. First Priority: Upload attachment via Facebook message_attachments endpoint
  // This is Facebook's official high-speed attachment upload protocol (verified 100% working)
  if (localPath) {
    try {
      const uploadUrl = `https://graph.facebook.com/v19.0/me/message_attachments?access_token=${accessToken}`;
      const fileBuffer = fs.readFileSync(localPath);
      const ext = path.extname(localPath).slice(1).toLowerCase() || "jpeg";
      const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

      const upFormData = new FormData();
      upFormData.append("message", JSON.stringify({
        attachment: {
          type: "image",
          payload: { is_reusable: true }
        }
      }));
      upFormData.append("filedata", new Blob([fileBuffer], { type: mimeType }), filename);

      const upRes = await fetch(uploadUrl, { method: "POST", body: upFormData });
      const upData = await upRes.json().catch(() => null);

      if (upRes.ok && upData?.attachment_id) {
        // Send message using the uploaded attachment_id
        const sendRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: recipientId },
            message: {
              attachment: {
                type: "image",
                payload: {
                  attachment_id: upData.attachment_id
                }
              }
            },
            messaging_type: "RESPONSE"
          })
        });
        const sendData = await sendRes.json().catch(() => null);
        if (sendRes.ok) {
          console.log(`[FB_IMAGE_ATTACH_OK] Sent ${filename} (ID: ${upData.attachment_id}) to ${recipientId}`);
          return true;
        } else {
          console.warn(`[FB_IMAGE_ATTACH_SEND_WARN]`, sendData);
        }
      } else {
        console.warn(`[FB_IMAGE_ATTACH_UPLOAD_WARN] Status: ${upRes.status}`, upData);
      }
    } catch (upErr: any) {
      console.warn(`[FB_IMAGE_ATTACH_ERR]`, upErr.message);
    }

    // 2. Direct multipart/form-data upload fallback
    try {
      const fileBuffer = fs.readFileSync(localPath);
      const ext = path.extname(localPath).slice(1).toLowerCase() || "jpeg";
      const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

      const formData = new FormData();
      formData.append("recipient", JSON.stringify({ id: recipientId }));
      formData.append("message", JSON.stringify({
        attachment: {
          type: "image",
          payload: { is_reusable: true }
        }
      }));
      formData.append("filedata", new Blob([fileBuffer], { type: mimeType }), filename);

      const res = await fetch(url, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        console.log(`[FB_IMAGE_FILE_OK] Sent direct ${filename} to ${recipientId}`);
        return true;
      }
    } catch (fileErr: any) {
      console.warn(`[FB_IMAGE_FILE_ERR]`, fileErr.message);
    }
  }

  // 3. Fallback: Send via public URL
  try {
    const publicUrl = `https://greenhelth.duckdns.org/api/products/image?file=${encodeURIComponent(filename)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "image",
            payload: {
              url: publicUrl,
              is_reusable: true
            }
          }
        },
        messaging_type: "RESPONSE"
      })
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      console.log(`[FB_IMAGE_URL_OK] Sent via URL ${publicUrl} to ${recipientId}`);
      return true;
    }
  } catch (urlErr: any) {
    console.warn(`[FB_IMAGE_URL_ERR]`, urlErr.message);
  }

  return false;
}


const BENGALI_WORDS_0_TO_99: string[] = [
  'শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ',
  'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'উনিশ', 'বিশ',
  'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আঠাশ', 'উনত্রিশ', 'ত্রিশ',
  'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁইত্রিশ', 'আটত্রিশ', 'উনচল্লিশ', 'চল্লিশ',
  'একচল্লিশ', 'বিয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'উনপঞ্চাশ', 'পঞ্চাশ',
  'একান্ন', 'বায়ান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'উনষাট', 'ষাট',
  'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পঁয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'উনসত্তর', 'সত্তর',
  'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'উনাশি', 'আশি',
  'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'অষ্টআশি', 'উননব্বই', 'নব্বই',
  'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই'
];

function numberToBengaliWords(n: number): string {
  if (n === 0) return 'শূন্য';
  if (n < 0) return 'মাইনাস ' + numberToBengaliWords(-n);
  let parts: string[] = [];
  if (n >= 10000000) {
    const crore = Math.floor(n / 10000000);
    parts.push(numberToBengaliWords(crore) + ' কোটি');
    n %= 10000000;
  }
  if (n >= 100000) {
    const lakh = Math.floor(n / 100000);
    parts.push(numberToBengaliWords(lakh) + ' লাখ');
    n %= 100000;
  }
  if (n >= 1000) {
    const thousand = Math.floor(n / 1000);
    parts.push(numberToBengaliWords(thousand) + ' হাজার');
    n %= 1000;
  }
  if (n >= 100) {
    const hundred = Math.floor(n / 100);
    parts.push(BENGALI_WORDS_0_TO_99[hundred] + 'শত');
    n %= 100;
  }
  if (n > 0) {
    parts.push(BENGALI_WORDS_0_TO_99[n]);
  }
  return parts.join(' ');
}

function convertBengaliNumbersToWords(text: string): string {
  if (!text) return '';
  let t = text;

  // 1. Phone numbers: 01XXXXXXXXX or ০১৮XXXXXXXX
  t = t.replace(/(?:\+?880|0)?1[3-9]\d{2}[-\s]?\d{6}/g, (match: string) => {
    const digits = match.replace(/\D/g, '');
    const digitWords = ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
    const clean = digits.length === 11 ? digits : ('0' + digits);
    const p1 = clean.slice(0, 5).split('').map((d: string) => digitWords[parseInt(d, 10)]).join(' ');
    const p2 = clean.slice(5).split('').map((d: string) => digitWords[parseInt(d, 10)]).join(' ');
    return p1 + ', ' + p2;
  });

  t = t.replace(/(?:০)?১[৩-৯][০-৯]{2}[-\s]?[০-৯]{6}/g, (match: string) => {
    const en = match.replace(/[০-৯]/g, (d: string) => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString()).replace(/\D/g, '');
    const digitWords = ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
    const clean = en.length === 11 ? en : ('0' + en);
    const p1 = clean.slice(0, 5).split('').map((d: string) => digitWords[parseInt(d, 10)]).join(' ');
    const p2 = clean.slice(5).split('').map((d: string) => digitWords[parseInt(d, 10)]).join(' ');
    return p1 + ', ' + p2;
  });

  // 2. Specific registration / license codes & years
  t = t.replace(/৫৮৪২\/২০১৮|5842\/2018/g, 'পাঁচ আট চার দুই, বাই, দুই হাজার আঠারো');
  t = t.replace(/৫৮৪২|5842/g, 'পাঁচ আট চার দুই');
  t = t.replace(/TRAD\/ALIKADAM\/0482\/2026/gi, 'ট্রেড লাইসেন্স শূন্য চার আট দুই, বাই, দুই হাজার ছাব্বিশ');
  t = t.replace(/০৪৮২|0482/g, 'শূন্য চার আট দুই');
  t = t.replace(/২০২৬|2026/g, 'দুই হাজার ছাব্বিশ');
  t = t.replace(/২০১৮|2018/g, 'দুই হাজার আঠারো');

  // 3. Ordinals (১ম, ২য়, ইত্যাদি)
  t = t.replace(/[১1]ম/g, 'প্রথম');
  t = t.replace(/[২2]য়/g, 'দ্বিতীয়');
  t = t.replace(/[৩3]য়/g, 'তৃতীয়');
  t = t.replace(/[৪4]র্থ/g, 'চতুর্থ');
  t = t.replace(/[৫5]ম/g, 'পঞ্চম');

  // 4. Remove commas in numbers like 2,000 or ২,০০০
  t = t.replace(/([০-৯0-9]),([০-৯0-9])/g, (match: string, p1: string, p2: string) => p1 + p2);

  // 5. Convert any number (Bengali or English digits) up to 8 digits to natural words
  t = t.replace(/[০-৯0-9]+/g, (match: string) => {
    const en = match.replace(/[০-৯]/g, (d: string) => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
    const num = parseInt(en, 10);
    if (!isNaN(num) && num >= 0 && num <= 99999999) {
      return numberToBengaliWords(num);
    }
    return match;
  });

  return t;
}

function prepareBangladeshiTTSAudioText(rawText: string): string {
  if (!rawText) return "";
  let t = rawText.replace(/[*#_~`>|]/g, "").replace(/\s+/g, " ").trim();

  // 1. Correct Persona Name & Titles
  t = t
    .replace(/রেজাউল\s*করিম/gi, "রিয়াজুল করিম")
    .replace(/রেজাউল/gi, "রিয়াজুল")
    .replace(/re[aj]aul\s*karim/gi, "রিয়াজুল করিম")
    .replace(/re[aj]aul/gi, "রিয়াজুল");

  // 2. Convert Indian/Kolkata forms → authentic Bangladeshi spoken forms
  t = t
    .replace(/\bদেবেন\b/g, "দিবেন")
    .replace(/\bনেবেন\b/g, "নিবেন")
    .replace(/\bজল\b/g, "পানি")
    .replace(/\bদাদা\b/g, "ভাইয়া");

  // 3. Spoken representations of order forms
  t = t
    .replace(/নাম\s*=/gi, "নাম, ")
    .replace(/জেলা\s*=/gi, "জেলা, ")
    .replace(/থানা\s*=/gi, "থানা, ")
    .replace(/রিসিভ ঠিকানা\s*=/gi, "রিসিভ ঠিকানা, ")
    .replace(/নাম্বার\s*=/gi, "মোবাইল নাম্বার, ")
    .replace(/=/g, " ");

  // 4. Convert digits to spoken Bengali words
  t = t
    .replace(/\(\s*(?:বিকাশ\s*\/?\s*নগদ\s*)?হেল্পলাইন\s*[:=]?\s*([0-9০-৯\-]+)\s*\)/gi, "আমাদের হেল্পলাইন নম্বর $1, ")
    .replace(/\(\s*([0-9০-৯\-]{10,15})\s*\)/gi, "আমাদের হেল্পলাইন নম্বর $1, ")
    .replace(/হেল্পলাইন\s*[:=]/gi, "হেল্পলাইন নম্বর ")
    .replace(/[()]/g, ", ")
    .replace(/২[,.]?৯০০|2[,.]?900/g, "দুই হাজার নয়শত");
  t = convertBengaliNumbersToWords(t);
  t = t
    .replace(/জি\s*ভাইয়া(?![,\s]*[,])/gi, "জি ভাইয়া, ")
    .replace(/রিয়াজুল\s*করিম\s*বলছি(?![,\s]*[,।])/gi, "রিয়াজুল করিম বলছি। ")
    .replace(/ইনশাআল্লাহ(?![,\s]*[,])/gi, "ইনশাআল্লাহ, ")
    .replace(/আল্লাহর\s*রহমতে(?![,\s]*[,])/gi, "আল্লাহর রহমতে, ")
    .replace(/কোনো\s*চিন্তা\s*করবেন\s*না(?![,\s]*[,])/gi, "কোনো চিন্তা করবেন না ভাইয়া, ")
    .replace(/,\s*,+/g, ",")
    .replace(/\s+/g, " ")
    .trim();

  return t;
}

function splitTextIntoVoiceChunks(text: string, maxChars: number = 800): string[] {
  if (!text || text.length <= maxChars) return [text];

  const chunks: string[] = [];
  const sentences = text.split(/(?<=[।?!.\n])/g);
  let currentChunk = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if ((currentChunk + " " + trimmed).trim().length <= maxChars) {
      currentChunk = currentChunk ? (currentChunk + " " + trimmed) : trimmed;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      if (trimmed.length > maxChars) {
        const subParts = trimmed.split(/(?<=[,;])/g);
        let subChunk = "";
        for (const part of subParts) {
          if ((subChunk + " " + part).trim().length <= maxChars) {
            subChunk = subChunk ? (subChunk + " " + part) : part;
          } else {
            if (subChunk) chunks.push(subChunk);
            subChunk = part;
          }
        }
        if (subChunk) currentChunk = subChunk;
        else currentChunk = "";
      } else {
        currentChunk = trimmed;
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks.length > 0 ? chunks : [text];
}

let webhookCartesiaCreditsExhausted = false;
let webhookLastCartesiaCheckTime = 0;
const WEBHOOK_CARTESIA_COOLDOWN_MS = 5 * 60 * 1000;

async function sendSingleVoiceNote(recipientId: string, text: string, accessToken: string): Promise<string | null> {
  const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY || "sk_car_srvrWhgCX45k3QNo4XagpS";
  const CARTESIA_VOICE_ID = process.env.CARTESIA_VOICE_ID || "bc625010-1d9d-4b70-99eb-74c262c65237";

  if (!CARTESIA_API_KEY) return null;

  if (webhookCartesiaCreditsExhausted && (Date.now() - webhookLastCartesiaCheckTime < WEBHOOK_CARTESIA_COOLDOWN_MS)) {
    return null;
  }

  try {
    const cleanText = prepareBangladeshiTTSAudioText(text);
    console.log(`[FB_VOICE_NOTE] Generating Cartesia voice note with Voice ID: ${CARTESIA_VOICE_ID} | Text: "${cleanText.slice(0, 60)}..."`);
    const ttsUrl = "https://api.cartesia.ai/tts/bytes";

    let ttsRes = await fetch(ttsUrl, {
      method: "POST",
      headers: {
        "X-API-Key": CARTESIA_API_KEY,
        "Cartesia-Version": "2024-06-10",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model_id: "sonic-3.6",
        transcript: cleanText,
        voice: {
          mode: "id",
          id: CARTESIA_VOICE_ID
        },
        output_format: {
          container: "mp3",
          bit_rate: 128000,
          sample_rate: 44100
        },
        language: "bn"
      }),
      signal: AbortSignal.timeout(5000)
    }).catch(e => {
      console.warn("[FB_VOICE_NOTE_TIMEOUT]", e.message);
      return null;
    });

    if (!ttsRes) return null;

    if (ttsRes.status === 402 || ttsRes.status === 401) {
      console.warn(`[FB_VOICE_NOTE_ALERT] ⚠️ Cartesia API returned status ${ttsRes.status}. Disabling TTS for 5 mins.`);
      webhookCartesiaCreditsExhausted = true;
      webhookLastCartesiaCheckTime = Date.now();
      return null;
    }

    if (!ttsRes.ok) {
      console.warn("[VOICE_NOTE_CARTESIA_FAIL]", await ttsRes.text().catch(() => ""));
      return null;
    }

    webhookCartesiaCreditsExhausted = false;
    const audioBytes = Buffer.from(await ttsRes.arrayBuffer());

    // 2. Upload to Facebook message_attachments
    const uploadUrl = `https://graph.facebook.com/v19.0/me/message_attachments?access_token=${accessToken}`;
    const form = new FormData();
    form.append("message", JSON.stringify({
      attachment: {
        type: "audio",
        payload: { is_reusable: true }
      }
    }));
    form.append("filedata", new Blob([audioBytes], { type: "audio/mp3" }), "doctor_voice.mp3");

    const upRes = await fetch(uploadUrl, { method: "POST", body: form, signal: AbortSignal.timeout(6000) });
    const upData = await upRes.json().catch(() => null);

    if (upData?.attachment_id) {
      // 3. Send voice note attachment
      const sendUrl = `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`;
      const sendRes = await fetch(sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: "audio",
              payload: {
                attachment_id: upData.attachment_id
              }
            }
          },
          messaging_type: "RESPONSE"
        }),
        signal: AbortSignal.timeout(6000)
      });
      const sendData = await sendRes.json().catch(() => null);
      if (sendRes.ok) {
        console.log(`[FB_VOICE_NOTE_OK] Sent Cartesia voice note to ${recipientId}`);
        return upData.attachment_id;
      } else {
        console.warn(`[FB_VOICE_NOTE_SEND_WARN]`, sendData);
      }
    } else {
      console.warn(`[FB_VOICE_NOTE_UPLOAD_WARN]`, upData);
    }
  } catch (err: any) {
    console.error(`[FB_VOICE_NOTE_ERROR]`, err.message);
  }
  return null;
}

async function sendMessengerVoiceNote(recipientId: string, text: string, accessToken: string): Promise<string | null> {
  if (webhookCartesiaCreditsExhausted && (Date.now() - webhookLastCartesiaCheckTime < WEBHOOK_CARTESIA_COOLDOWN_MS)) {
    return null;
  }
  const chunks = splitTextIntoVoiceChunks(text, 800);
  if (chunks.length > 1) {
    console.log(`[VOICE_CHUNK] Long voice response (${text.length} chars) split into ${chunks.length} parts for ${recipientId}`);
  }

  let lastId: string | null = null;
  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i];
    lastId = await sendSingleVoiceNote(recipientId, chunkText, accessToken);
    if (!lastId) {
      console.warn(`[FB_VOICE_NOTE] Chunk ${i + 1}/${chunks.length} failed. Aborting remaining voice chunks.`);
      return null;
    }
    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  return lastId;
}

async function handleFacebookComment(pageId: string, value: any) {
  const { prisma } = await import("@/lib/prisma");
  const { redis }  = await import("@/lib/redis");

  const account = await prisma.connectedAccount.findFirst({
    where: { pageId, platform: "FACEBOOK", isActive: true },
  }) as any;
  if (!account) return;

  const postId    = value.post_id ?? value.parent_id;
  const commentId = value.comment_id;
  const text      = value.message;
  const userName  = value.from?.name ?? "Unknown";
  const createdAt = new Date(value.created_time * 1000);

  await prisma.comment.upsert({
    where: { platformCommentId: commentId },
    create: {
      accountId: account.id,
      postId,
      platformCommentId: commentId,
      userName,
      text,
      status: "PENDING",
      commentedAt: createdAt,
    },
    update: {},
  });

  // Real-time notification
  await redis.publish("new_comment", JSON.stringify({
    accountId: account.id,
    postId,
    commentId,
    userName,
    text,
  }));

  console.log(`[FB_COMMENT] Page:${pageId} | Post:${postId} | From:${userName} | "${text}"`);
}
