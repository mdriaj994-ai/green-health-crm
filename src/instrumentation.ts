// src/instrumentation.ts
// Automatically starts the 24/7 real-time Messenger background service on Next.js boot

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startMessengerPoller } = await import("@/lib/messenger-poller");
      startMessengerPoller();
    } catch (err: any) {
      console.error("[INSTRUMENTATION_ERROR]", err.message || err);
    }
  }
}
