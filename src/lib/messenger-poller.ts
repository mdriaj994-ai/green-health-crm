// src/lib/messenger-poller.ts
// DISABLED: Polling is handled exclusively by scripts/fb_realtime_bot.js to ensure single-instance reply.

export function getPollerStatus() {
  return {
    running: false,
    processedCount: 0,
    lastPolled: new Date().toISOString(),
    status: "Disabled in favor of standalone scripts/fb_realtime_bot.js",
  };
}

export async function startMessengerPoller() {
  console.log("[MESSENGER_POLLER] Disabled. Single bot runs via scripts/fb_realtime_bot.js");
  return;
}
