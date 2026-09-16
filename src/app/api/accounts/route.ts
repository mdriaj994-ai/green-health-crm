import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── GET: List connected pages ────────────────────────────────────
export async function GET(req: Request) {
  try {
    let accounts = await prisma.connectedAccount.findMany();

    // Auto-seed default হেলথ কেয়ার page if no accounts exist
    if (!accounts || accounts.length === 0) {
      const pageId = process.env.FACEBOOK_PAGE_ID || "932259009980880";
      const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "EAAjkLPT8UegBSS7FFS7CknaL7eRbabMG9g7TJZCu4SQ20ea2sRDLSEZBX2RJlV0yYXneKCHX50m43kYnNUE6LKE6WizMRwsnoCw7fBzyeF88NEZCdb0nu68OmfDZC6rExH9LiWIjxJTPtZBw9m6cSUT98VoIzToz6ZAGV7BJylUTKo1WZC4wFEBk6aAs9KuhsSN17Jp";

      let user = await prisma.user.findFirst();
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

      await prisma.connectedAccount.create({
        data: {
          platform: "FACEBOOK",
          pageId,
          pageName: "হেলথ কেয়ার",
          accessToken,
          isActive: true,
          aiAutoReply: true,
          aiTone: "friendly",
          userId: user.id,
        },
      });

      accounts = await prisma.connectedAccount.findMany();
    }

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("[GET_ACCOUNTS_ERROR]", error);
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

    const account = await prisma.connectedAccount.create({
      data: {
        platform: platform || "FACEBOOK",
        pageId: String(pageId).trim(),
        pageName: (pageName || "Facebook Page").trim(),
        accessToken: String(accessToken).trim(),
        userId,
        avatar: avatar || null,
        isActive: true,
      },
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
    await prisma.connectedAccount.delete({
      where: { id: accountId },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
