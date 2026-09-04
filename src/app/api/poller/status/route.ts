import { NextResponse } from "next/server";
import { getPollerStatus, startMessengerPoller } from "@/lib/messenger-poller";

export async function GET() {
  // Ensure poller is running if accessed
  startMessengerPoller();
  const status = getPollerStatus();
  return NextResponse.json(status);
}

export const dynamic = "force-dynamic";
