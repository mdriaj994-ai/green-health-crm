import { NextResponse } from "next/server";
import { Server as SocketIOServer } from "socket.io";

// Global socket server instance
const globalForSocket = globalThis as unknown as {
  io: SocketIOServer | undefined;
};

export async function GET(req: Request) {
  // Socket.io initialization info endpoint
  return NextResponse.json({
    status: "Socket.io runs via custom server",
    message: "Use /api/socket-info for connection details",
    wsUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  });
}
