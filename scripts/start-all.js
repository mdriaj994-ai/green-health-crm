// scripts/start-all.js
// Runs both Next.js and the 24/7 Real-time Facebook Messenger Engine in parallel inside Docker
const { spawn } = require("child_process");
const path = require("path");

console.log("==========================================");
console.log("  STARTING SOCIAL INBOX & FB REALTIME BOT ");
console.log("==========================================");

// 1. Start Next.js Server on port 3000 binding to 0.0.0.0
function startNextServer() {
  console.log("[STARTUP] Launching Next.js Server on 0.0.0.0:3000...");
  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const nextProcess = spawn(process.execPath, [nextBin, "start", "-H", "0.0.0.0", "-p", "3000"], {
    stdio: "inherit",
    env: { ...process.env, HOSTNAME: "0.0.0.0", PORT: "3000" },
  });

  nextProcess.on("exit", (code) => {
    console.error(`[NEXTJS_STOPPED] Next.js process exited with code ${code}. Restarting in 3s...`);
    setTimeout(startNextServer, 3000);
  });
}

startNextServer();

// 2. Start 24/7 Facebook Realtime Bot Engine
function startBotProcess() {
  console.log("[STARTUP] Launching FB Realtime Bot Process...");
  const botScript = path.join(process.cwd(), "scripts", "fb_realtime_bot.js");
  const botProcess = spawn(process.execPath, [botScript], {
    stdio: "inherit",
    env: process.env,
  });

  botProcess.on("exit", (code) => {
    console.warn(`[FB_BOT_RESTART] Bot process exited with code ${code}. Restarting in 3s...`);
    setTimeout(startBotProcess, 3000);
  });
}

// Start bot 2 seconds after Next.js boots
setTimeout(startBotProcess, 2000);

// Keep master process alive under all circumstances
process.on("uncaughtException", (err) => {
  console.error("[FATAL_UNCAUGHT_EXCEPTION]", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED_REJECTION]", reason);
});

