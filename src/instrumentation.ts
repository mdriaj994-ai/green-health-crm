// src/instrumentation.ts
// Automatically registers background poller on Next.js server startup

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[INSTRUMENTATION] Bootstrapping 24/7 background messenger poller on Next.js runtime...");
    try {
      const { startMessengerPoller } = await import("@/lib/messenger-poller");
      startMessengerPoller();
    } catch (err: any) {
      console.warn("[INSTRUMENTATION_WARN] Failed to start poller:", err.message);
    }
  }
}
