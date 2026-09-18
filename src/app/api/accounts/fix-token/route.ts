import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const permToken = "EAAjkLPT8UegBSsQVgxm1fBW6D7N7oon9ZAudS1UKVLVbBEar1BGEvZCLJ3ibSLO6FmILQDf6mq4rcsL98cpxuuRwAHSwUprKUBLv6ZBBCSjYAGUPTU1SQIRDvR74D5aIivRiDoUG3zobZB83AIwZA8mZAhoqcBDpjii2KsvQshwZCCIdUSJk5NaDb5JZCFGt4YWKBfEZC";

  try {
    await prisma.connectedAccount.updateMany({
      where: { platform: "FACEBOOK" },
      data: {
        accessToken: permToken,
        pageId: "932259009980880",
        pageName: "হেলথ কেয়ার",
        isActive: true,
        aiAutoReply: true,
      }
    });

    return NextResponse.json({
      success: true,
      message: "ConnectedAccount updated with permanent token for হেলথ কেয়ার (932259009980880)",
      tokenPrefix: permToken.slice(0, 25) + "..."
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
