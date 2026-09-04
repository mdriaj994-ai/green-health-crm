import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── GET: List all conversations ──────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");
  const status   = searchParams.get("status");
  const page     = parseInt(searchParams.get("page") ?? "1");
  const limit    = 30;

  try {
    const where: any = {};
    if (status && status !== "ALL") where.status = status;
    if (platform && platform !== "ALL") {
      where.account = { platform };
    }

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        contact: true,
        account: { select: { platform: true, pageName: true } },
        assignedAgent: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, createdAt: true, senderType: true },
        },
      },
      orderBy: { lastMessageAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("[CONVERSATIONS_GET]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
