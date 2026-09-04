import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

// Server-Sent Events endpoint — streams real-time events from Redis pub/sub
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Subscribe to Redis channels
      const subscriber = redis.duplicate();

      try {
        await subscriber.subscribe("new_message", "new_comment");

        subscriber.on("message", (channel: string, message: string) => {
          const data = `event: ${channel}\ndata: ${message}\n\n`;
          try {
            controller.enqueue(encoder.encode(data));
          } catch {
            subscriber.disconnect();
          }
        });

        // Send a heartbeat every 20s to keep connection alive
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            clearInterval(heartbeat);
          }
        }, 20000);

      } catch (error) {
        console.error("[SSE_ERROR]", error);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
