import { NextRequest, NextResponse } from "next/server";

// Global persistent memory across Next.js process lifetime
declare global {
  var _sharedSenderContext: Map<string, string> | undefined;
}

if (!global._sharedSenderContext) {
  global._sharedSenderContext = new Map<string, string>();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const senderId = searchParams.get("senderId");
  if (!senderId) {
    return NextResponse.json({ error: "Missing senderId" }, { status: 400 });
  }
  const productKey = global._sharedSenderContext?.get(senderId) || null;
  return NextResponse.json({ senderId, productKey });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { senderId, productKey } = body;
    if (senderId && productKey) {
      global._sharedSenderContext?.set(senderId, productKey);
      console.log(`[SHARED_CONTEXT] Stored sender: ${senderId} -> Product: ${productKey}`);
      return NextResponse.json({ success: true, senderId, productKey });
    }
    return NextResponse.json({ error: "Missing senderId or productKey" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
