import { NextResponse } from "next/server";

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


// In-memory dedup set for 60 seconds fallback
const processedMsgIds = new Set<string>();

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

function flushSenderEvent(senderId: string) {
  const pending = pendingSenderEvents.get(senderId);
  if (!pending) return;
  pendingSenderEvents.delete(senderId);

  const { pageId, text, imageUrl, audioUrl, timestamp } = pending;
  const contextProduct = (global as any)._sharedSenderContext?.get(senderId) || null;

  // Build attachments array (image + audio)
  const attachments: any[] = [];
  if (imageUrl) attachments.push({ type: "image", payload: { url: imageUrl } });
  if (audioUrl) attachments.push({ type: "audio", payload: { url: audioUrl } });

  // Forward merged single event to N8N Gemini AI Workflow
  fetch("http://localhost:5678/webhook/galaxy-messenger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      object: "page",
      entry: [{
        id: pageId,
        time: timestamp,
        messaging: [{
          sender: { id: senderId },
          recipient: { id: pageId },
          timestamp,
          contextProduct,
          message: {
            mid: "mid.merged." + Date.now(),
            text: text,
            contextProduct,
            attachments
          }
        }],
      }],
    }),
  }).catch((e) => console.warn("[N8N_FORWARD_ERROR]", e.message));

  console.log(`[NEXTJS_WEBHOOK] Flushed message to N8N. Sender: ${senderId} | Text: "${text}" | Context: ${contextProduct}`);
}

const GROQ_KEY = process.env.GROQ_API_KEY || "";
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";

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

async function handleMessengerMessage(pageId: string, event: any) {
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

  // 1. In-memory Deduplication (ensures uniqueness even if Redis is offline)
  if (msgId) {
    if (processedMsgIds.has(msgId)) {
      console.log(`[MESSENGER] In-memory DUPLICATE message ${msgId} dropped.`);
      return;
    }
    processedMsgIds.add(msgId);
    setTimeout(() => processedMsgIds.delete(msgId), 60000);
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

async function sendMessengerReply(pageId: string, recipientId: string, text: string, accessToken: string) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`;
  const body = {
    recipient: { id: recipientId },
    message: { text },
    messaging_type: "RESPONSE",
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    console.error("[MESSENGER_AUTO_REPLY_SEND_ERROR]", err);
  }
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
