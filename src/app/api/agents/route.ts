import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── GET: List all agents/users ───────────────────────────────────
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true,
        role: true, isActive: true, createdAt: true, avatar: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ users });
  } catch (error) {
    console.error("[AGENTS_GET]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── PATCH: Update agent role or status ──────────────────────────
export async function PATCH(req: Request) {
  try {
    const { userId, role, isActive } = await req.json();
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(role !== undefined && { role }),
        ...(isActive !== undefined && { isActive }),
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("[AGENTS_PATCH]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── DELETE: Deactivate an agent ──────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const { userId } = await req.json();
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
