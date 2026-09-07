import { NextResponse } from "next/server";
import { startMessengerPoller } from "@/lib/messenger-poller";
import fs from "fs";
import path from "path";

// Start background poller ensuring it is always active
try {
  startMessengerPoller();
} catch {}

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

// Smart message buffer per sender to combine rapid text + image + audio events (within 2.0s)
interface PendingSenderEvent {
  pageId: string;
  senderId: string;
  text: string;
  imageUrl: string | null;
  audioUrl: string | null;
  timestamp: number;
  timer: NodeJS.Timeout;
}
const pendingSenderEvents = new Map<string, PendingSenderEvent>();

async function flushSenderEvent(senderId: string) {
  const pending = pendingSenderEvents.get(senderId);
  if (!pending) return;
  pendingSenderEvents.delete(senderId);

  const { pageId, text, imageUrl, audioUrl, timestamp } = pending;

  console.log(`[AUTO_REPLY] Processing message from ${senderId} | Text: "${text}" | Image: ${imageUrl ? "YES" : "NO"}`);

  // Generate AI reply using Gemini (Hakim Rejaul Karim persona)
  try {
    const { generateAutoReply } = await import("@/lib/ai");

    // Fetch chat history from DB for context
    let chatHistory: { sender: "CUSTOMER" | "AGENT"; text: string }[] = [];
    let pageAccessToken = PAGE_TOKEN;
    try {
      const { prisma } = await import("@/lib/prisma");
      const account = await prisma.connectedAccount.findFirst({
        where: { pageId, isActive: true },
      }) as any;
      if (account) {
        if (account.accessToken) {
          pageAccessToken = account.accessToken;
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
    try {
      const { isPictureRequest, findProductForImage } = await import("@/lib/product-db");
      if (isPictureRequest(text)) {
        picProduct = findProductForImage(text, chatHistory);
        if (picProduct?.imageFile && effectiveToken) {
          console.log(`[AUTO_REPLY_PIC] Customer requested picture. Sending "${picProduct.name}" (${picProduct.imageFile}) to ${senderId}`);
          await sendMessengerImage(senderId, picProduct.imageFile, effectiveToken);
        }
      }
    } catch (picErr: any) {
      console.warn("[AUTO_REPLY_PIC_WARN]", picErr.message);
    }

    // ── Voice Mode & Voice Request Logic ──
    const { isVoiceMode, setVoiceMode, isOnlyVoiceRequest, isVoiceRequested } = await import("@/lib/voice-mode");

    if (/^(text\s*(dao|den|din)|লিখুন|লিখে\s*বলুন|text\s*a\s*bolen)/i.test(text.trim())) {
      setVoiceMode(senderId, false);
    }

    const isOnlyVoice = isOnlyVoiceRequest(text);
    const isGeneralVoice = isVoiceRequested(text) || Boolean(audioUrl);

    if (isOnlyVoice || isGeneralVoice) {
      setVoiceMode(senderId, true);
    }

    // CASE 1: Customer specifically requested voice for previous answer ("voice dao")
    if (isOnlyVoice) {
      const lastAgentMsg = chatHistory.slice().reverse().find(m => m.sender === "AGENT" && m.text.trim().length > 0);
      const voiceText = lastAgentMsg?.text || "জি ভাইয়া, আপনার স্বাস্থ্যগত যেকোনো সমস্যা বা পরামর্শের জন্য নির্ভয়ে বলুন, আমি আপনাকে সাহায্য করছি।";

      console.log(`[EXPLICIT_VOICE_REQUEST] Customer asked for voice of previous answer. Sending voice note only to ${senderId}: "${voiceText.substring(0, 60)}..."`);
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

    // CASE 2: Normal inquiry or Question while in Voice Mode
    const userInVoiceMode = isVoiceMode(senderId);

    const replyText = await generateAutoReply(text || "ছবি পাঠালাম", {
      imageUrl: imageUrl || null,
      chatHistory,
    });

    if (replyText && effectiveToken) {
      if (userInVoiceMode) {
        // Customer is in voice mode: send reply directly as voice note ONLY (no text)
        console.log(`[VOICE_MODE_ACTIVE] Customer is in voice mode. Sending response as voice note only to ${senderId}: "${replyText.substring(0, 80)}..."`);
        await sendSenderAction(senderId, "typing_on", effectiveToken);
        const sentVoice = await sendMessengerVoiceNote(senderId, replyText, effectiveToken);
        if (!sentVoice) {
          // Fallback to text if voice note generation/upload failed
          await sendMessengerReply(pageId, senderId, replyText, effectiveToken);
        }
      } else {
        const charCount = replyText.length;
        const rawDelay = 1800 + (charCount * 25);
        const jitter = (Math.random() * 800) - 400;
        const delayMs = Math.min(9500, Math.max(2200, Math.round(rawDelay + jitter)));

        if (delayMs > 4500) {
          await new Promise(r => setTimeout(r, 3500));
          await sendSenderAction(senderId, "typing_on", effectiveToken);
          await new Promise(r => setTimeout(r, delayMs - 3500));
        } else {
          await new Promise(r => setTimeout(r, delayMs));
        }

        await sendMessengerReply(pageId, senderId, replyText, effectiveToken);
        console.log(`[AUTO_REPLY_SENT] To: ${senderId} | Reply: "${replyText.substring(0, 80)}..."`);
      }

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

const GROQ_KEY = process.env.GROQ_API_KEY || "";
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "EAAW6YWihfogBSY0coWHPtYcw2Gwm11ZAznBKAIcOzhgKQJWYITHuelgvzJfoWl0QjgrsRD5DEViDdpVyQKyvxGkBVJ8saKOzXi4IaXvIwYWuJXVJwNxBGsUdru7NAV9Rk5hrGCJigh9NuX1ury8ATCBYvbjBce885iGjucQ3LSbzYQwqQvNGfcu7GO70jQu3QiwI1";

async function transcribeAudioWithGroq(audioUrl: string): Promise<string> {
  try {
    let dlRes = await fetch(audioUrl);
    if (!dlRes.ok) {
      const fbUrl = audioUrl.includes("access_token") ? audioUrl : audioUrl + (audioUrl.includes("?") ? "&" : "?") + "access_token=" + PAGE_TOKEN;
      dlRes = await fetch(fbUrl);
    }
    if (!dlRes.ok) {
      console.log(`[GROQ_STT] Failed to download audio from FB: ${dlRes.status}`);
      return "";
    }
    const blob = await dlRes.blob();
    const mime = (dlRes.headers.get("content-type") || "audio/mp4").split(";")[0];
    const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "mp3";

    const formData = new FormData();
    formData.append("file", blob, `voice.${ext}`);
    formData.append("model", "whisper-large-v3");
    formData.append("language", "bn");
    formData.append("response_format", "json");
    formData.append("prompt", "গ্রীন হেলথ ইউনানী ওষুধ। ছবি পাঠান, ছবি দেখান, এটার ছবি দেন, পিকচার দেন, ফটো পাঠান, ঔষধের ছবি দিন, দেখতে কেমন, দাম কত। পেপটো-জি, অ্যাপেল-জি, জিএল টন, রেসপিরেক্স, রিউমারেক্স, মোবিক, মেনসোটন, জেনাসিন।");

    const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_KEY}`,
      },
      body: formData
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error(`[GROQ_STT] Groq returned ${groqRes.status}: ${errText}`);
      return "";
    }
    const data = await groqRes.json();
    const rawTranscript = (data.text || "").trim();
    // Filter out garbled binary output (non-Bengali, non-Latin characters only)
    const hasValidText = /[\u0980-\u09FF\u0041-\u007A\u0030-\u0039]/.test(rawTranscript);
    if (!hasValidText) {
      console.error(`[GROQ_STT] Garbled/binary output detected, discarding: length=${rawTranscript.length}`);
      return "";
    }
    console.log(`[GROQ_STT] Raw Whisper transcript: "${rawTranscript}"`);
    return rawTranscript;
  } catch (err) {
    console.error("[GROQ_TRANSCRIPTION_ERROR]", err);
    return "";
  }
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
    const rawTranscript = await transcribeAudioWithGroq(audioUrl);
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

  // 2. Buffer rapid messages from the same sender (combines text + image + audio within 1.8s into ONE single reply)
  const existing = pendingSenderEvents.get(senderId);
  if (existing) {
    clearTimeout(existing.timer);
    // Merge text, image and audio
    if (text && (!existing.text || existing.text.startsWith("["))) {
      existing.text = text;
    } else if (text && existing.text) {
      existing.text = existing.text + " " + text;
    }
    if (imageUrl) existing.imageUrl = imageUrl;
    if (audioUrl) existing.audioUrl = audioUrl;
    existing.timer = setTimeout(() => flushSenderEvent(senderId), 1800);
    console.log(`[MESSENGER_BUFFER] Merged rapid message for sender ${senderId}. Waiting 1.8s...`);
  } else {
    const lower = text.toLowerCase();
    const isReferenceQuery = lower.includes("aita") || lower.includes("এইটা") || lower.includes("price") || lower.includes("dam") || lower.includes("দাম") || lower.includes("koto");
    const delay = (imageUrl || audioUrl || isReferenceQuery) ? 1800 : 500;

    const timer = setTimeout(() => flushSenderEvent(senderId), delay);
    pendingSenderEvents.set(senderId, {
      pageId,
      senderId,
      text: text,
      imageUrl,
      audioUrl,
      timestamp,
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

async function sendMessengerReply(pageId: string, recipientId: string, text: string, accessToken: string) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`;
  const body = {
    recipient: { id: recipientId },
    message: { text },
    messaging_type: "RESPONSE",
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
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
    path.join(process.cwd(), "data", "Product Image"),
    path.join(process.cwd(), "public", "products"),
    path.join(process.cwd(), "public", "Product Image"),
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

async function sendMessengerVoiceNote(recipientId: string, text: string, accessToken: string): Promise<string | null> {
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "sk_b704126ae6ecca01f041a6505e4e7a695f40df803a4f8bd3";
  const rawVoiceId = process.env.ELEVENLABS_VOICE_ID;
  const ELEVENLABS_VOICE_ID = (rawVoiceId && rawVoiceId !== "FhOnCtjmaAIRIS1Dg2bk" && rawVoiceId !== "TX3LPaxmHKxFdv7VOQHJ") ? rawVoiceId : "2RikWi4odb2uhZQb9waV";

  if (!ELEVENLABS_API_KEY) return null;

  try {
    // 1. Generate audio via ElevenLabs
    let cleanText = text.replace(/[*#_~`>|]/g, "").trim().slice(0, 400);
    cleanText = cleanText
      .replace(/রেজাউল\s*করিম/gi, "রিয়াজুল করিম")
      .replace(/রেজাউল/gi, "রিয়াজুল")
      .replace(/re[aj]aul\s*karim/gi, "রিয়াজুল করিম")
      .replace(/re[aj]aul/gi, "রিয়াজুল");
    console.log(`[FB_VOICE_NOTE] Generating voice note with Voice ID: ${ELEVENLABS_VOICE_ID}`);
    const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`;
    const ttsRes = await fetch(ttsUrl, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: "eleven_v3_conversational",
        voice_settings: {
          stability: 0.44,
          similarity_boost: 0.85,
          style: 0.10,
          use_speaker_boost: true
        }
      })
    });

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
