// src/instrumentation.ts
// Background bot is managed exclusively by scripts/fb_realtime_bot.js to avoid duplicate bot processes.

export async function register() {
  // Next.js instrumentation intentionally does not launch background pollers
  // Single-source-of-truth bot is scripts/fb_realtime_bot.js
}
