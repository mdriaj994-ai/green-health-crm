// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const where = status && status !== "ALL" ? { status: status as any } : {};

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({ orders, total, page, limit });
  } catch (error) {
    console.error("[API/ORDERS GET]", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const order = await prisma.order.create({
      data: {
        customerName: body.customerName || "অজ্ঞাত",
        phone: body.phone || "",
        district: body.district || "",
        thana: body.thana || "",
        address: body.address || "",
        product: body.product || "",
        quantity: body.quantity || 1,
        senderId: body.senderId || "",
        facebookName: body.facebookName || "",
        pageId: body.pageId || "",
        notes: body.notes || "",
        status: "PENDING",
      },
    });
    return NextResponse.json({ order });
  } catch (error) {
    console.error("[API/ORDERS POST]", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;
    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
