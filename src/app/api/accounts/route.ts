import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── GET: List connected pages ────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  try {
    const accounts = await prisma.connectedAccount.findMany({
      where: userId ? { userId } : {},
      select: {
        id: true, platform: true, pageId: true,
        pageName: true, avatar: true, isActive: true, createdAt: true,
      },
    });
    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── POST: Connect a new Facebook Page ───────────────────────────
export async function POST(req: Request) {
  try {
    const { platform, pageId, pageName, accessToken, userId: passedUserId, avatar } = await req.json();

    if (!platform || !pageId || !accessToken) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let user = passedUserId ? await prisma.user.findUnique({ where: { id: passedUserId } }) : null;
    if (!user) {
      user = await prisma.user.findFirst();
      if (!user) {
        user = await prisma.user.create({
          data: {
            name: "Admin User",
            email: "admin@socialinbox.com",
            password: "demo",
            role: "SUPER_ADMIN",
          },
        });
      }
    }

    const userId = user.id;

    const account = await prisma.connectedAccount.upsert({
      where: { platform_pageId_userId: { platform, pageId, userId } },
      create: { platform, pageId, pageName, accessToken, userId, avatar, isActive: true },
      update: { accessToken, isActive: true, pageName, avatar },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    console.error("[CONNECT_PAGE_ERROR]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── PATCH: Update AI settings for an account ─────────────────────
export async function PATCH(req: Request) {
  try {
    const { accountId, aiAutoReply, businessDetails, aiTone } = await req.json();
    if (!accountId) {
      return NextResponse.json({ error: "accountId required" }, { status: 400 });
    }

    const updated = await prisma.connectedAccount.update({
      where: { id: accountId },
      data: {
        ...(aiAutoReply !== undefined && { aiAutoReply }),
        ...(businessDetails !== undefined && { businessDetails }),
        ...(aiTone !== undefined && { aiTone }),
      },
      select: { id: true },
    });

    return NextResponse.json({ account: updated });
  } catch (error) {
    console.error("[ACCOUNTS_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── DELETE: Disconnect a page ────────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const { accountId } = await req.json();
    await prisma.connectedAccount.update({
      where: { id: accountId },
      data: { isActive: false },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
