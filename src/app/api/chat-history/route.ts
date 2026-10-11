import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

const DATA_DIR = path.join(process.cwd(), "data");
const CHAT_HISTORY_FILE = path.join(process.cwd(), ".chat_history.json");
const CUSTOMER_MEMORY_FILE = path.join(DATA_DIR, "customer_memory.json");

function readJsonFile(filePath: string): any {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const senderId = searchParams.get("senderId");
  const search = searchParams.get("search")?.toLowerCase().trim() || "";

  try {
    const chatHistory: Record<string, any[]> = readJsonFile(CHAT_HISTORY_FILE) || {};
    const customerMemory: Record<string, any> = readJsonFile(CUSTOMER_MEMORY_FILE) || {};

    // ── Single Conversation Detail ──────────────────────────────────────────
    if (senderId) {
      const chatMessages = chatHistory[senderId] || [];
      const memory = customerMemory[senderId] || {};
      const chatLog = memory.chatLog || [];

      // Also fetch SQLite messages if any
      let dbMessages: any[] = [];
      let dbContact: any = null;
      try {
        const conv = await prisma.conversation.findMany({
          where: { contact: { platformUserId: senderId } },
          take: 1
        });
        if (conv.length > 0) {
          dbContact = conv[0].contact;
          dbMessages = await prisma.message.findMany({
            where: { conversationId: conv[0].id },
            orderBy: { createdAt: "asc" }
          });
        }
      } catch {}

      const merged: any[] = [];

      for (const msg of chatMessages) {
        merged.push({
          role: msg.role === "bot" ? "bot" : "customer",
          text: msg.text,
          ts: msg.ts,
          source: "chat_history",
        });
      }

      for (const msg of chatLog) {
        merged.push({
          role: msg.role === "model" ? "bot" : "customer",
          text: msg.text,
          ts: msg.time,
          isVoice: msg.isVoice || false,
          source: "memory",
        });
      }

      for (const msg of dbMessages) {
        merged.push({
          role: msg.senderType === "BOT" || msg.senderType === "PAGE" ? "bot" : "customer",
          text: msg.content,
          ts: new Date(msg.createdAt).getTime(),
          source: "database",
        });
      }

      // Deduplicate messages by text and approximate timestamp (within 2s)
      const deduped: any[] = [];
      const seen = new Set<string>();
      for (const m of merged.sort((a, b) => (a.ts || 0) - (b.ts || 0))) {
        const key = `${m.role}:${(m.text || "").trim()}:${Math.floor((m.ts || 0) / 3000)}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(m);
        }
      }

      const realName =
        (dbContact?.name && !dbContact.name.toLowerCase().startsWith("test")) ? dbContact.name :
        (memory.name && !["Customer", "ভাইয়া", "NOT PROVIDED YET", ""].includes(memory.name.trim())) ? memory.name :
        memory.facebookName ||
        (memory.phone ? `গ্রাহক (${memory.phone})` : `গ্রাহক (${senderId.slice(-6)})`);

      return NextResponse.json({
        senderId,
        messages: deduped,
        profile: {
          name: realName,
          age: memory.age || "",
          phone: memory.phone || dbContact?.phone || "",
          district: memory.district || "",
          symptoms: memory.symptoms || [],
          productDiscussed: memory.productDiscussed || "",
          orderStatus: memory.orderStatus || "",
          firstContact: memory.firstContact || null,
          lastContact: memory.lastContact || null,
          totalMessages: deduped.length,
        },
      });
    }

    // ── All Conversations List ──────────────────────────────────────────────
    // 1. Fetch real Facebook contacts & conversations from SQLite database
    const dbConversations = await prisma.conversation.findMany({ take: 300 });

    const conversationMap = new Map<string, any>();

    for (const c of dbConversations) {
      const puid = c.contact?.platformUserId;
      if (!puid) continue;
      const sid = String(puid);

      const isTest =
        sid.startsWith("test") ||
        sid.startsWith("TEST") ||
        sid.startsWith("BOT") ||
        sid.startsWith("sender_test") ||
        sid.startsWith("dev_");

      if (isTest && !search.includes("test")) continue;

      const memory = customerMemory[sid] || {};
      const chatMessages = chatHistory[sid] || [];
      const chatLog = memory.chatLog || [];

      let lastMsg = c.messages?.[0]?.content || "";
      let lastTs = c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : (c.updatedAt ? new Date(c.updatedAt).getTime() : 0);

      if (chatMessages.length > 0) {
        const last = chatMessages[chatMessages.length - 1];
        if ((last.ts || 0) > lastTs) {
          lastMsg = last.text || lastMsg;
          lastTs = last.ts;
        }
      }

      if (memory.lastContact && memory.lastContact > lastTs) {
        lastTs = memory.lastContact;
      }

      // Priority: DB Contact Name (real FB Profile Name) -> memory.name -> memory.facebookName -> phone -> default
      let name = "";
      const rawDbName = (c.contact?.name || "").trim();
      if (rawDbName && !rawDbName.toLowerCase().startsWith("test") && !rawDbName.startsWith("User ")) {
        name = rawDbName;
      } else if (
        memory.name &&
        !memory.name.toLowerCase().startsWith("test") &&
        !["customer", "vaiya", "ভাইয়া", "not provided yet", ""].includes(memory.name.trim().toLowerCase())
      ) {
        name = memory.name;
      } else if (memory.facebookName) {
        name = memory.facebookName;
      } else if (memory.phone || c.contact?.phone) {
        name = `গ্রাহক (${memory.phone || c.contact?.phone})`;
      } else {
        name = `গ্রাহক (${sid.slice(-6)})`;
      }

      const district = memory.district || "";
      const phone = memory.phone || c.contact?.phone || "";
      const symptoms = memory.symptoms || [];
      const productDiscussed = memory.productDiscussed || "";
      const orderStatus = memory.orderStatus || "inquiry";

      conversationMap.set(sid, {
        senderId: sid,
        name,
        district,
        phone,
        symptoms,
        productDiscussed,
        orderStatus,
        lastMessage: lastMsg.slice(0, 100),
        lastTs,
        totalMessages: chatMessages.length + chatLog.length + 1,
        isRealUser: !isTest,
      });
    }

    // 2. Also incorporate any users from customerMemory that weren't in SQLite
    for (const [sid, memory] of Object.entries(customerMemory)) {
      if (conversationMap.has(sid)) continue;

      const isTest =
        sid.startsWith("test") ||
        sid.startsWith("TEST") ||
        sid.startsWith("BOT") ||
        sid.startsWith("sender_test") ||
        sid.startsWith("dev_");

      if (isTest && !search.includes("test")) continue;

      const mem: any = memory || {};
      const chatMessages = chatHistory[sid] || [];
      const chatLog = mem.chatLog || [];

      let lastMsg = "";
      let lastTs = mem.lastContact || mem.firstContact || 0;

      if (chatMessages.length > 0) {
        const last = chatMessages[chatMessages.length - 1];
        lastMsg = last.text || "";
        lastTs = Math.max(lastTs, last.ts || 0);
      }

      let name = "";
      if (
        mem.name &&
        !mem.name.toLowerCase().startsWith("test") &&
        !["customer", "vaiya", "ভাইয়া", "not provided yet", ""].includes(mem.name.trim().toLowerCase())
      ) {
        name = mem.name;
      } else if (mem.facebookName) {
        name = mem.facebookName;
      } else if (mem.phone) {
        name = `গ্রাহক (${mem.phone})`;
      } else {
        name = `গ্রাহক (${sid.slice(-6)})`;
      }

      conversationMap.set(sid, {
        senderId: sid,
        name,
        district: mem.district || "",
        phone: mem.phone || "",
        symptoms: mem.symptoms || [],
        productDiscussed: mem.productDiscussed || "",
        orderStatus: mem.orderStatus || "inquiry",
        lastMessage: lastMsg.slice(0, 100),
        lastTs,
        totalMessages: chatMessages.length + chatLog.length,
        isRealUser: !isTest,
      });
    }

    let conversations = Array.from(conversationMap.values());

    if (search) {
      conversations = conversations.filter((c) => {
        const searchable = `${c.name} ${c.senderId} ${c.district} ${c.phone} ${c.symptoms.join(" ")} ${c.productDiscussed} ${c.lastMessage}`.toLowerCase();
        return searchable.includes(search);
      });
    }

    // Sort by latest message descending
    conversations.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));

    return NextResponse.json({
      conversations,
      total: conversations.length,
    });
  } catch (error) {
    console.error("[CHAT_HISTORY_GET]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
