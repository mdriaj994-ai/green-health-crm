import { NextResponse } from "next/server";

const WA_VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN ?? "social_inbox_verify_token";

// ── GET: WhatsApp Webhook Verification ──────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === WA_VERIFY_TOKEN) {
    console.log("[WA_WEBHOOK] Verification successful");
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// ── POST: Receive WhatsApp Messages ─────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          if (change.field === "messages") {
            for (const message of change.value?.messages ?? []) {
              await handleWhatsAppMessage(change.value, message);
            }
          }
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[WA_WEBHOOK_ERROR]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

async function handleWhatsAppMessage(value: any, message: any) {
  const { prisma } = await import("@/lib/prisma");
  const { redis }  = await import("@/lib/redis");

  const phoneNumberId = value.metadata?.phone_number_id;
  const from          = message.from; // customer's WA number
  const text          = message.text?.body ?? "[media]";
  const msgId         = message.id;
  const timestamp     = new Date(parseInt(message.timestamp) * 1000);
  const contactName   = value.contacts?.[0]?.profile?.name ?? from;

  console.log(`[WHATSAPP] From:${contactName} (${from}) | ${text}`);

  // Find account by phone number ID
  const account = await prisma.connectedAccount.findFirst({
    where: { pageId: phoneNumberId, platform: "WHATSAPP", isActive: true },
  });
  if (!account) return;

  // Upsert contact
  const contact = await prisma.contact.upsert({
    where: { platformUserId_platform: { platformUserId: from, platform: "WHATSAPP" } },
    create: { platformUserId: from, platform: "WHATSAPP", name: contactName, phone: from },
    update: { name: contactName },
  });

  // Upsert conversation
  const conversationId = `conv_${account.id}_${contact.id}`;
  const conversation = await prisma.conversation.upsert({
    where: { id: conversationId },
    create: {
      id: conversationId,
      contactId: contact.id,
      accountId: account.id,
      status: "OPEN",
      isRead: false,
      lastMessageAt: timestamp,
    },
    update: { lastMessageAt: timestamp, isRead: false, status: "OPEN" },
  });

  // Save message
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      content: text,
      senderType: "CUSTOMER",
      platformMsgId: msgId,
    },
  });

  // Real-time push via Redis
  await redis.publish("new_message", JSON.stringify({
    conversationId: conversation.id,
    contactName,
    platform: "WHATSAPP",
    content: text,
    timestamp: timestamp.toISOString(),
  }));
}
