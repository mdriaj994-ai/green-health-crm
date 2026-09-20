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

  console.log(`[AUTO_REPLY] Processing message(s) from ${senderId} | Batch Count: ${items.length} | Text: "${text}"`);

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

  // ── INSTANT HARDCODED REPLY: Order process questions (bypass AI) ──────────
  const textForOrderCheck = (text || "").toLowerCase().replace(/\s+/g, "");
  const isOrderProcessQuestion =
    // How to order questions
    /(order|অর্ডার).*(kivabe|কিভাবে|kibhabe|kiভাবে|কীভাবে|process|prosess)/i.test(text) ||
    /(kivabe|কিভাবে|কীভাবে|kibhabe).*(order|অর্ডার|kinbo|কিনব|nibo|নিবো|pabo|পাব)/i.test(text) ||
    /অর্ডারকিভাবে|orderকিভাবে/.test(textForOrderCheck) ||
    /order\s*form|অর্ডার\s*ফর্ম/i.test(text) ||
    // "I want to order / buy / take" — clear purchase intent
    /(order|অর্ডার|nite|নিতে|kinbo|কিনব|কিনতে|কিনবো).*(chai|চাই|chassi|চাছি|চাচ্ছি|chacchi|korte|করতে|debo|দেব|dibo|দিব)/i.test(text) ||
    /(ami|আমি|amar|আমার).*(order|অর্ডার|nibo|নিবো|nite chai|নিতে চাই|kinbo|কিনব|নিতে চাচ্ছি)/i.test(text) ||
    /order\s*korte\s*(chai|chacchi|chassi)|অর্ডার\s*করতে\s*চাই/i.test(text) ||
    /ar\s*akta\s*order|আরেকটা?\s*অর্ডার|আর\s*একটা?\s*অর্ডার/i.test(text) ||
    /(nite|নিতে|kinbo|কিনবো|nibo|নিবো)\s*(chai|চাই|chacchi|চাচ্ছি)/i.test(text);


  if (isOrderProcessQuestion) {
    const orderReply = `জি ভাইয়া, অর্ডার করা খুবই সহজ! শুধু নিচের তথ্যগুলো এখানে পাঠিয়ে দিন:

নাম:
ফোন নম্বর:
জেলা:
থানা/উপজেলা:
বিস্তারিত ঠিকানা:
পণ্য ও পরিমাণ:

তারপর ৫০০ টাকা অগ্রিম বিকাশ করুন: 01870-023804। বাকি ২,৩০০ টাকা পার্সেল হাতে পেয়ে দেবেন। ইনশাআল্লাহ ২-৩ দিনের মধ্যে পৌঁছে যাবে।`;

    const PERM_TOK = "EAAjkLPT8UegBSsQVgxm1fBW6D7N7oon9ZAudS1UKVLVbBEar1BGEvZCLJ3ibSLO6FmILQDf6mq4rcsL98cpxuuRwAHSwUprKUBLv6ZBBCSjYAGUPTU1SQIRDvR74D5aIivRiDoUG3zobZB83AIwZA8mZAhoqcBDpjii2KsvQshwZCCIdUSJk5NaDb5JZCFGt4YWKBfEZC";
    const envT = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const quickToken = (envT && envT.length > 150) ? envT : PERM_TOK;
    await sendMessengerReply(pageId, senderId, orderReply, quickToken);
    console.log(`[ORDER_PROCESS_INSTANT] ✅ Sent hardcoded order instructions to ${senderId}`);
    try { const { appendChatMessage } = await import("@/lib/customer-memory"); appendChatMessage(senderId, "model", orderReply, false); } catch {}
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
    const { isVoiceMode, setVoiceMode, isOnlyVoiceRequest, isVoiceRequested, isTextModeRequested, isOrderInfoRequest, isPhoneNumberRequest } = await import("@/lib/voice-mode");
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
      const voiceText = "জি ভাইয়া, অবশ্যই! আমি ডাক্তার হাকিম রিয়াজুল করিম বলছি। কোনো সমস্যা নেই ভাইয়া, আপনি আর পড়তে হবে না—আমি আপনার সাথে মুখে কথা বলছি। আপনার কী সমস্যা হচ্ছে বা কী জানতে চাচ্ছেন, আমাকে নির্দ্বিধায় মুখে বলুন বা লিখে জানান, আমি আপনাকে ভয়েসেই সবকিছু বুঝিয়ে বলছি।";

      console.log(`[EXPLICIT_VOICE_REQUEST] Customer asked for voice consultation. Sending voice note only to ${senderId}: "${voiceText.substring(0, 60)}..."`);
      await sendSenderAction(senderId, "typing_on", effectiveToken);
      const sentVoice = await sendMessengerVoiceNote(senderId, voiceText, effectiveToken);
      if (!sentVoice) {
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
    const shouldSendVoice = !userPrefersText && (userInVoiceMode || isVoiceRequested(text) || Boolean(audioUrl));

    if (replyText && effectiveToken) {
      // 1. ALWAYS SEND TEXT FIRST (Instant 1s response)
      await sendSenderAction(senderId, "typing_on", effectiveToken);
      await new Promise(r => setTimeout(r, 800));
      await sendMessengerReply(pageId, senderId, replyText, effectiveToken, items[items.length - 1].mid || null);
      console.log(`[AUTO_REPLY_SENT] Text to: ${senderId} | Reply: "${replyText.substring(0, 80)}..."`);
      try {
        const { appendChatMessage } = await import("@/lib/customer-memory");
        appendChatMessage(senderId, "model", replyText, false);
      } catch {}

      // 2. ALSO SEND VOICE NOTE IF REQUESTED
      if (shouldSendVoice) {
        console.log(`[VOICE_MODE_ACTIVE] Also sending voice note to ${senderId}: "${replyText.substring(0, 80)}..."`);
        try {
          await sendSenderAction(senderId, "typing_on", effectiveToken);
          const sentVoice = await sendMessengerVoiceNote(senderId, replyText, effectiveToken);
          if (sentVoice) {
            console.log(`[VOICE_NOTE_SENT] Voice delivered to ${senderId}`);
          }
        } catch (vErr: any) {
          console.warn("[VOICE_SEND_ERR]", vErr.message);
        }
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
            product:      parsedOrder?.product  || custProf.productDiscussed || "Soul Mate (খাঁটি কস্তুরী ফর্মুলা)",
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
${(/কস্তুরী|kosturi|kasturi|আব্দুল করিম/i.test(orderData.product || "") || /কস্তুরী|kosturi|kasturi/i.test(text || "")) ? "💰 মূল্য: ২,৮০০ টাকা (বুকিং নিশ্চিত করতে ৫০০ টাকা অগ্রিম বিকাশ প্রযোজ্য, বাকি ২,৩০০ টাকা ক্যাশ অন ডেলিভারি)\n📱 বিকাশ: 01870-023804\n📌 বুকিং কনফার্ম করতে ৫০০ টাকা পাঠিয়ে লাস্ট ২/৩ ডিজিট জানান\n" : "💰 পেমেন্ট: ক্যাশ অন ডেলিভারি\n"}
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

export async function handleMessengerMessage(pageId: string, event: any) {
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
  if (msgId) {
    if (isProcessedId(msgId)) {
      console.log(`[MESSENGER] Shared DUPLICATE message ${msgId} dropped.`);
      return;
    }
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


const BENGALI_WORDS_1_TO_100 = {
  0: 'শূন্য', 1: 'এক', 2: 'দুই', 3: 'তিন', 4: 'চার', 5: 'পাঁচ', 6: 'ছয়', 7: 'সাত', 8: 'আট', 9: 'নয়', 10: 'দশ',
  11: 'এগারো', 12: 'বারো', 13: 'তেরো', 14: 'চৌদ্দ', 15: 'পনেরো', 16: 'ষোলো', 17: 'সতেরো', 18: 'আঠারো', 19: 'উনিশ', 20: 'বিশ',
  21: 'একুশ', 22: 'বাইশ', 23: 'তেইশ', 24: 'চব্বিশ', 25: 'পঁচিশ', 26: 'ছাব্বিশ', 27: 'সাতাশ', 28: 'আঠাশ', 29: 'উনত্রিশ', 30: 'ত্রিশ',
  31: 'একত্রিশ', 32: 'বত্রিশ', 33: 'তেত্রিশ', 34: 'চৌত্রিশ', 35: 'পঁয়ত্রিশ', 36: 'ছত্রিশ', 37: 'সাঁইত্রিশ', 38: 'আটত্রিশ', 39: 'উনচল্লিশ', 40: 'চল্লিশ',
  41: 'একচল্লিশ', 42: 'বিয়াল্লিশ', 43: 'তেতাল্লিশ', 44: 'চুয়াল্লিশ', 45: 'পঁয়তাল্লিশ', 46: 'ছেচল্লিশ', 47: 'সাতচল্লিশ', 48: 'আটচল্লিশ', 49: 'উনপঞ্চাশ', 50: 'পঞ্চাশ',
  51: 'একান্ন', 52: 'বায়ান্ন', 53: 'তিপ্পান্ন', 54: 'চুয়ান্ন', 55: 'পঞ্চান্ন', 56: 'ছাপ্পান্ন', 57: 'সাতান্ন', 58: 'আটান্ন', 59: 'উনষাট', 60: 'ষাট',
  61: 'একষট্টি', 62: 'বাষট্টি', 63: 'তেষট্টি', 64: 'চৌষট্টি', 65: 'পঁয়ষট্টি', 66: 'ছেষট্টি', 67: 'সাতষট্টি', 68: 'আটষট্টি', 69: 'উনসত্তর', 70: 'সত্তর',
  71: 'একাত্তর', 72: 'বাহাত্তর', 73: 'তিয়াত্তর', 74: 'চুয়াত্তর', 75: 'পঁচাত্তর', 76: 'ছিয়াত্তর', 77: 'সাতাত্তর', 78: 'আটাত্তর', 79: 'উনাশি', 80: 'আশি',
  81: 'একাশি', 82: 'বিরাশি', 83: 'তিরাশি', 84: 'চুরাশি', 85: 'পঁচাশি', 86: 'ছিয়াশি', 87: 'সাতাশি', 88: 'অষ্টআশি', 89: 'উননব্বই', 90: 'নব্বই',
  91: 'একানব্বই', 92: 'বিরানব্বই', 93: 'তিরানব্বই', 94: 'চুরানব্বই', 95: 'পঁচানব্বই', 96: 'ছিয়ানব্বই', 97: 'সাতানব্বই', 98: 'আটানব্বই', 99: 'নিরানব্বই', 100: 'একশত'
};

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

  // 3. Ordinals (১ম, ২য়, ৩য়, ইত্যাদি)
  t = t.replace(/[১1]ম/g, 'প্রথম');
  t = t.replace(/[২2]য়/g, 'দ্বিতীয়');
  t = t.replace(/[৩3]য়/g, 'তৃতীয়');
  t = t.replace(/[৪4]র্থ/g, 'চতুর্থ');
  t = t.replace(/[৫5]ম/g, 'পঞ্চম');

  // 4. Large amounts & common prices
  t = t.replace(/[২2][,.]?[৮8][০0][০0]/g, 'দুই হাজার আটশত');
  t = t.replace(/[২2][,.]?[৩3][০0][০0]/g, 'দুই হাজার তিনশত');
  t = t.replace(/[২2][,.]?[৯9][০0][০0]/g, 'দুই হাজার নয়শত');
  t = t.replace(/[৩3][,.]?[৫5][০0][০0]/g, 'তিন হাজার পাঁচশত');
  t = t.replace(/[৩3][,.]?[০0][০0][০0]/g, 'তিন হাজার');
  t = t.replace(/[৪4][,.]?[৫5][০0][০0]/g, 'চার হাজার পাঁচশত');
  t = t.replace(/[১1][,.]?[৫5][০0][০0]/g, 'এক হাজার পাঁচশত');
  t = t.replace(/[১1][,.]?[০0][০0][০0]/g, 'এক হাজার');
  t = t.replace(/[৫5][০0][০0]/g, 'পাঁচশত');
  t = t.replace(/[২2][৫5][০0]/g, 'দুইশত পঞ্চাশ');
  t = t.replace(/[২2][০0][০0]/g, 'দুইশত');
  t = t.replace(/[১1][৫5][০0]/g, 'একশত পঞ্চাশ');
  t = t.replace(/[১1][২2][০0]/g, 'একশত বিশ');
  t = t.replace(/[১1][০0][০0]/g, 'একশত');

  // 5. Bullet lists (১), ২), ৩) or ১., ২., ৩. or 1), 2) etc.)
  t = t.replace(/(?:^|\n)\s*(?:[১1][\)\.\-:]|\([১1]\))\s*/g, '\nএক, ');
  t = t.replace(/(?:^|\n)\s*(?:[২2][\)\.\-:]|\([২2]\))\s*/g, '\nদুই, ');
  t = t.replace(/(?:^|\n)\s*(?:[৩3][\)\.\-:]|\([৩3]\))\s*/g, '\nতিন, ');
  t = t.replace(/(?:^|\n)\s*(?:[৪4][\)\.\-:]|\([৪4]\))\s*/g, '\nচার, ');
  t = t.replace(/(?:^|\n)\s*(?:[৫5][\)\.\-:]|\([৫5]\))\s*/g, '\nপাঁচ, ');
  t = t.replace(/(?:^|\n)\s*(?:[৬6][\)\.\-:]|\([৬6]\))\s*/g, '\nছয়, ');
  t = t.replace(/(?:^|\n)\s*(?:[৭7][\)\.\-:]|\([৭7]\))\s*/g, '\nসাত, ');
  t = t.replace(/(?:^|\n)\s*(?:[৮8][\)\.\-:]|\([৮8]\))\s*/g, '\nআট, ');
  t = t.replace(/(?:^|\n)\s*(?:[৯9][\)\.\-:]|\([৯9]\))\s*/g, '\nনয়, ');
  t = t.replace(/(?:^|\n)\s*(?:(?:১০|10)[\)\.\-:]|\((?:১০|10)\))\s*/g, '\nদশ, ');

  t = t.replace(/\b(?:[১1][\)\.]|\([১1]\))\s*/g, 'এক, ');
  t = t.replace(/\b(?:[২2][\)\.]|\([২2]\))\s*/g, 'দুই, ');
  t = t.replace(/\b(?:[৩3][\)\.]|\([৩3]\))\s*/g, 'তিন, ');
  t = t.replace(/\b(?:[৪4][\)\.]|\([৪4]\))\s*/g, 'চার, ');
  t = t.replace(/\b(?:[৫5][\)\.]|\([৫5]\))\s*/g, 'পাঁচ, ');
  t = t.replace(/\b(?:[৬6][\)\.]|\([৬6]\))\s*/g, 'ছয়, ');

  // 6. Common phrases with numbers
  t = t.replace(/[৩3]\s*(?:থেকে|-)\s*[৫5]\s*দিন/g, 'তিন থেকে পাঁচ দিন');
  t = t.replace(/[১1]\s*(?:থেকে|-)\s*[২2]\s*দিন/g, 'এক থেকে দুই দিন');
  t = t.replace(/[২2]\s*(?:থেকে|-)\s*[৪4]\s*দিন/g, 'দুই থেকে চার দিন');
  t = t.replace(/[১1]\s*মাস/g, 'এক মাস');
  t = t.replace(/[১1]\s*চামচ/g, 'এক চামচ');
  t = t.replace(/[৬6]\s*টি/g, 'ছয়টি');
  t = t.replace(/[১1]\s*টি/g, 'একটি');
  t = t.replace(/[২2]\s*টি/g, 'দুটি');
  t = t.replace(/[৩3]\s*টি/g, 'তিনটি');
  t = t.replace(/[৪4]\s*টি/g, 'চারটি');
  t = t.replace(/[৫5]\s*টি/g, 'পাঁচটি');
  t = t.replace(/[১1][০0]\s*টি/g, 'দশটি');

  // 7. Numbers 0-100 (both Bengali and English digits)
  t = t.replace(/[০-৯0-9]{1,3}/g, (match: string) => {
    const en = match.replace(/[০-৯]/g, (d: string) => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
    const num = parseInt(en, 10);
    if (!isNaN(num) && (BENGALI_WORDS_1_TO_100 as Record<number, string>)[num]) {
      return (BENGALI_WORDS_1_TO_100 as Record<number, string>)[num];
    }
    return match;
  });

  // 8. Any remaining single digits
  const singleDigits = ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
  t = t.replace(/[০-৯]/g, (d: string) => singleDigits['০১২৩৪৫৬৭৮৯'.indexOf(d)] || d);
  t = t.replace(/[0-9]/g, (d: string) => singleDigits[parseInt(d, 10)] || d);

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

async function sendSingleVoiceNote(recipientId: string, text: string, accessToken: string): Promise<string | null> {
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "sk_b704126ae6ecca01f041a6505e4e7a695f40df803a4f8bd3";
  const rawVoiceId = process.env.ELEVENLABS_VOICE_ID;
  const ELEVENLABS_VOICE_ID = (rawVoiceId && rawVoiceId !== "2RikWi4odb2uhZQb9waV" && rawVoiceId !== "UvaBYZVczBD1eq5jTquX" && rawVoiceId !== "FhOnCtjmaAIRIS1Dg2bk" && rawVoiceId !== "TX3LPaxmHKxFdv7VOQHJ") ? rawVoiceId : "nsJQzXf7dXyDnOFqO3uX";

  if (!ELEVENLABS_API_KEY) return null;

  try {
    const cleanText = prepareBangladeshiTTSAudioText(text);
    console.log(`[FB_VOICE_NOTE] Generating Bangladeshi voice note with Voice ID: ${ELEVENLABS_VOICE_ID} | Text: "${cleanText.slice(0, 60)}..."`);
    const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`;
    const BD_VOICE_SETTINGS = {
      stability: 0.50
    };

    let ttsRes = await fetch(ttsUrl, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: "eleven_v3",
        voice_settings: BD_VOICE_SETTINGS
      })
    });

    if (!ttsRes.ok) {
      console.warn("[VOICE_NOTE_ELEVEN_RETRY] Retrying with eleven_turbo_v2_5");
      ttsRes = await fetch(ttsUrl, {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.50,
            similarity_boost: 0.90,
            style: 0.0,
            use_speaker_boost: true
          }
        })
      });
    }

    if (!ttsRes.ok) {
      console.warn("[VOICE_NOTE_ELEVEN_FAIL]", await ttsRes.text());
      return null;
    }

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

    const upRes = await fetch(uploadUrl, { method: "POST", body: form });
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
        })
      });
      const sendData = await sendRes.json().catch(() => null);
      if (sendRes.ok) {
        console.log(`[FB_VOICE_NOTE_OK] Sent ElevenLabs voice note to ${recipientId}`);
        return upData.attachment_id;
      } else {
        console.warn(`[FB_VOICE_NOTE_SEND_WARN]`, sendData);
      }
    } else {
      console.warn(`[FB_VOICE_ATTACH_WARN]`, upData);
    }
  } catch (err: any) {
    console.error("[VOICE_NOTE_ERROR]", err.message);
  }
  return null;
}

async function sendMessengerVoiceNote(recipientId: string, text: string, accessToken: string): Promise<string | null> {
  const chunks = splitTextIntoVoiceChunks(text, 800);
  if (chunks.length > 1) {
    console.log(`[VOICE_CHUNK] Long voice response (${text.length} chars) split into ${chunks.length} parts for ${recipientId}`);
  }

  let lastId: string | null = null;
  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i];
    lastId = await sendSingleVoiceNote(recipientId, chunkText, accessToken);
    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 1200));
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
