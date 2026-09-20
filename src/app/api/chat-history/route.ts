import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

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
  const search = searchParams.get("search")?.toLowerCase() || "";

  try {
    const chatHistory: Record<string, any[]> = readJsonFile(CHAT_HISTORY_FILE) || {};
    const customerMemory: Record<string, any> = readJsonFile(CUSTOMER_MEMORY_FILE) || {};

    const allSenderIds = new Set([
      ...Object.keys(chatHistory),
      ...Object.keys(customerMemory),
    ]);

    if (senderId) {
      const chatMessages = chatHistory[senderId] || [];
      const memory = customerMemory[senderId] || {};
      const chatLog = memory.chatLog || [];

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

      merged.sort((a, b) => (a.ts || 0) - (b.ts || 0));

      return NextResponse.json({
        senderId,
        messages: merged,
        profile: {
          name: memory.name || senderId,
          age: memory.age || "",
          phone: memory.phone || "",
          district: memory.district || "",
          symptoms: memory.symptoms || [],
          productDiscussed: memory.productDiscussed || "",
          orderStatus: memory.orderStatus || "",
          firstContact: memory.firstContact || null,
          lastContact: memory.lastContact || null,
          totalMessages: memory.totalMessages || merged.length,
        },
      });
    }

    const conversations: any[] = [];

    for (const sid of allSenderIds) {
      const memory = customerMemory[sid] || {};
      const chatMessages = chatHistory[sid] || [];
      const chatLog = memory.chatLog || [];
      const totalMsgs = chatMessages.length + chatLog.length;

      let lastMsg = "";
      let lastTs = 0;

      if (chatMessages.length > 0) {
        const last = chatMessages[chatMessages.length - 1];
        lastMsg = last.text || "";
        lastTs = last.ts || 0;
      }
      if (memory.lastContact && memory.lastContact > lastTs) {
        lastTs = memory.lastContact;
      }

      const name = memory.name || sid;
      const district = memory.district || "";
      const phone = memory.phone || "";
      const symptoms = memory.symptoms || [];
      const productDiscussed = memory.productDiscussed || "";
      const orderStatus = memory.orderStatus || "inquiry";

      if (search) {
        const searchable = `${name} ${sid} ${district} ${phone} ${symptoms.join(" ")} ${productDiscussed} ${lastMsg}`.toLowerCase();
        if (!searchable.includes(search)) continue;
      }

      conversations.push({
        senderId: sid,
        name,
        district,
        phone,
        symptoms,
        productDiscussed,
        orderStatus,
        lastMessage: lastMsg.slice(0, 100),
        lastTs,
        totalMessages: totalMsgs,
        isRealUser: !sid.startsWith("TEST") && !sid.startsWith("test") && !sid.startsWith("BOT"),
      });
    }

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
