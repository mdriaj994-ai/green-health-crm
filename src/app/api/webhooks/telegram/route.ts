import { NextResponse } from "next/server";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

// ── POST: Receive Telegram Updates ──────────────────────────────
export async function POST(req: Request) {
  try {
    const update = await req.json();

    // Regular message
    if (update.message) {
      await handleTelegramMessage(update.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[TG_WEBHOOK_ERROR]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

async function handleTelegramMessage(message: any) {
  const { prisma } = await import("@/lib/prisma");
  const { redis }  = await import("@/lib/redis");

  const chatId   = String(message.chat.id);
  const text     = message.text ?? "[media]";
  const msgId    = String(message.message_id);
  const userName = message.from?.first_name
    ? `${message.from.first_name} ${message.from.last_name ?? ""}`.trim()
    : "Telegram User";
  const timestamp = new Date(message.date * 1000);

  console.log(`[TELEGRAM] From:${userName} (${chatId}) | Msg: ${text}`);

  // Find the linked Telegram account (bot account)
  const account = await prisma.connectedAccount.findFirst({
    where: { platform: "TELEGRAM", isActive: true },
  }) as any;
  if (!account) return;

  // Upsert contact
  const contact = await prisma.contact.upsert({
    where: { platformUserId_platform: { platformUserId: chatId, platform: "TELEGRAM" } },
    create: { platformUserId: chatId, platform: "TELEGRAM", name: userName },
    update: { name: userName },
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

  // Real-time push
  await redis.publish("new_message", JSON.stringify({
    conversationId: conversation.id,
    contactName: userName,
    platform: "TELEGRAM",
    content: text,
    timestamp: timestamp.toISOString(),
  }));

  // AI Auto-Reply (only if enabled for this account)
  if (!account.aiAutoReply) {
    console.log(`[TG_AI_AUTO_REPLY] Skipped — aiAutoReply disabled for account ${account.id}`);
    return;
  }

  try {
    const { generateAutoReply } = await import("@/lib/ai");

    const recentMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { senderType: true, content: true },
    });

    const chatHistory = recentMessages.reverse().map((m: any) => ({
      sender: m.senderType as "CUSTOMER" | "AGENT",
      text: m.content,
    }));

    const aiReplyText = await generateAutoReply(text, {
      businessName: account.pageName,
      businessDetails: account.businessDetails ?? undefined,
      tone: account.aiTone ?? "friendly",
      chatHistory,
    });

    const botToken = account.accessToken || process.env.TELEGRAM_BOT_TOKEN;
    if (aiReplyText && botToken) {
      // Send message to Telegram chat
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: aiReplyText }),
      });

      // Save reply to DB
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content: aiReplyText,
          senderType: "AGENT",
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      await redis.publish("new_message", JSON.stringify({
        conversationId: conversation.id,
        contactName: userName,
        platform: "TELEGRAM",
        content: aiReplyText,
        senderType: "AGENT",
        timestamp: new Date().toISOString(),
      }));

      console.log(`[TG_AI_AUTO_REPLY] Sent to ${chatId}: "${aiReplyText}"`);
    }
  } catch (err) {
    console.error("[TG_AI_AUTO_REPLY_ERROR]", err);
  }
}

