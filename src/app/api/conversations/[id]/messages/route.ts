import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── GET: Messages for a conversation ────────────────────────────
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
      include: { sentByUser: { select: { name: true } } },
    });
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[MESSAGES_GET]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── POST: Send a reply ───────────────────────────────────────────
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { content, agentId } = await req.json();
    if (!content?.trim()) {
      return NextResponse.json({ error: "Message is empty" }, { status: 400 });
    }

    // Get conversation + account info
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { contact: true, account: true },
    });
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Save the reply to DB
    const message = await prisma.message.create({
      data: {
        conversationId: id,
        content,
        senderType: "AGENT",
        sentByUserId: agentId ?? null,
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    });

    // Send reply via the correct platform API
    const { platform, accessToken, pageId } = conversation.account;
    const recipientId = conversation.contact.platformUserId;

    if (platform === "MESSENGER" || platform === "FACEBOOK") {
      await sendMessengerReply(pageId, recipientId, content, accessToken);
    } else if (platform === "TELEGRAM") {
      await sendTelegramReply(recipientId, content);
    } else if (platform === "WHATSAPP") {
      await sendWhatsAppReply(recipientId, content, accessToken);
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("[REPLY_ERROR]", error);
    return NextResponse.json({ error: "Failed to send reply" }, { status: 500 });
  }
}

// ── Platform Senders ─────────────────────────────────────────────

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
    console.error("[MESSENGER_SEND_ERROR]", err);
  }
}

async function sendTelegramReply(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function sendWhatsAppReply(to: string, text: string, accessToken: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) return;
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
}
