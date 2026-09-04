import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "সব ফিল্ড পূরণ করুন" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      // If user already exists, update their password and name so they can log in
      const hashed = await bcrypt.hash(password, 12);
      // Determine if super admin
      const isSuper = cleanEmail.includes("mdriaj") || cleanEmail.includes("rakib") || existing.role === "SUPER_ADMIN";
      
      try {
        const Database = (await import("better-sqlite3")).default;
        const path = (await import("path")).default;
        const dbFile = path.resolve(process.cwd(), "prisma/social_inbox.db");
        const db = new Database(dbFile);
        db.prepare(`UPDATE "User" SET password = ?, name = ?, role = ? WHERE email = ?`).run(
          hashed, cleanName, isSuper ? "SUPER_ADMIN" : existing.role, cleanEmail
        );
        db.close();
        return NextResponse.json({ 
          message: "অ্যাকাউন্ট পাসওয়ার্ড আপডেট হয়েছে! এখন লগইন করুন।",
          user: { email: cleanEmail, name: cleanName, role: isSuper ? "SUPER_ADMIN" : existing.role }
        }, { status: 200 });
      } catch (updateErr: any) {
        return NextResponse.json({ error: "এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে, লগইন করুন।" }, { status: 400 });
      }
    }

    const hashed = await bcrypt.hash(password, 12);

    // Give SUPER_ADMIN to owner
    const isSuper = cleanEmail.includes("mdriaj") || cleanEmail.includes("rakib") || (await prisma.user.count()) === 0;
    const role = isSuper ? "SUPER_ADMIN" : "AGENT";

    const user = await prisma.user.create({
      data: { name: cleanName, email: cleanEmail, password: hashed, role },
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json({ user, message: "অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!" }, { status: 201 });
  } catch (error: any) {
    console.error("[REGISTER_ERROR]", error);
    const msg = error?.message || "রেজিস্ট্রেশন করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
