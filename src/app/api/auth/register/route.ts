import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "সব ফিল্ড পূরণ করুন" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 12);

    // First user is always SUPER_ADMIN
    const count = await prisma.user.count();
    const role = count === 0 ? "SUPER_ADMIN" : "AGENT";

    const user = await prisma.user.create({
      data: { name, email, password: hashed, role },
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("[REGISTER_ERROR]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
