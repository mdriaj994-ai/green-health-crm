import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── GET: List comments ───────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "ALL";

  try {
    const where: any = {};
    if (status !== "ALL") where.status = status;

    const comments = await prisma.comment.findMany({
      where,
      orderBy: { commentedAt: "desc" },
      take: 50,
      include: {
        account: { select: { pageName: true, platform: true } },
      },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("[COMMENTS_GET]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── POST: Reply to a comment ─────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { commentId, replyText } = await req.json();
    if (!commentId || !replyText?.trim()) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { account: true },
    });
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    // Send reply to Facebook
    const { accessToken } = comment.account;
    const url = `https://graph.facebook.com/v19.0/${comment.platformCommentId}/comments`;
    const fbRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: replyText, access_token: accessToken }),
    });

    if (!fbRes.ok) {
      const err = await fbRes.json();
      console.error("[COMMENT_REPLY_ERROR]", err);
    }

    // Update comment status in DB
    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { status: "REPLIED", repliedText: replyText, repliedAt: new Date() },
    });

    return NextResponse.json({ comment: updated });
  } catch (error) {
    console.error("[COMMENT_REPLY]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── PATCH: Hide or Delete a comment ─────────────────────────────
export async function PATCH(req: Request) {
  try {
    const { commentId, action } = await req.json(); // action: "HIDDEN" | "DELETED"

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { account: true },
    });
    if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { accessToken } = comment.account;
    const fbCommentId = comment.platformCommentId;

    if (action === "HIDDEN") {
      await fetch(`https://graph.facebook.com/v19.0/${fbCommentId}?is_hidden=true&access_token=${accessToken}`, {
        method: "POST",
      });
    } else if (action === "DELETED") {
      await fetch(`https://graph.facebook.com/v19.0/${fbCommentId}?access_token=${accessToken}`, {
        method: "DELETE",
      });
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { status: action },
    });

    return NextResponse.json({ comment: updated });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
