// scripts/start-all.js
// Runs both Next.js and the 24/7 Real-time Facebook Messenger Engine in parallel inside Docker
const { spawn } = require("child_process");

console.log("==========================================");
console.log("  STARTING SOCIAL INBOX & FB REALTIME BOT ");
console.log("==========================================");

// 1. Start Next.js Server on port 3000 binding to 0.0.0.0
const nextServer = spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", "3000"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, HOSTNAME: "0.0.0.0", PORT: "3000" },
});

nextServer.on("exit", (code) => {
  console.error(`[NEXTJS_STOPPED] Exit code: ${code}`);
  process.exit(code || 1);
});

// 2. Start 24/7 Facebook Realtime Bot Engine
function startBotProcess() {
  console.log("[STARTUP] Launching FB Realtime Bot Process...");
  const botProcess = spawn("node", ["scripts/fb_realtime_bot.js"], {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  botProcess.on("exit", (code) => {
    console.warn(`[FB_BOT_RESTART] Bot process exited with code ${code}. Restarting in 3s...`);
    setTimeout(startBotProcess, 3000);
  });
}

// Start bot 2 seconds after Next.js boots
setTimeout(startBotProcess, 2000);
