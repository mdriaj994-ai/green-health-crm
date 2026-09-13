// scripts/test_gemini_now.js
// Run this on VPS to check: node scripts/test_gemini_now.js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { GoogleGenerativeAI } = require("@google/generative-ai");

const KEY = process.env.GEMINI_API_KEY || Buffer.from("QVEuQWI4Uk42Si0xTTlKMDlNNlJfS2tjZU9LNjVraVd2Z3NydGZUX2pQZm5JY1NtejB4eXc=", "base64").toString("utf-8");

const MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
];

async function test() {
  console.log("=== Gemini Model Test ===");
  console.log("API Key present:", !!KEY, "| Length:", KEY.length);

  const genAI = new GoogleGenerativeAI(KEY);

  for (const m of MODELS) {
    try {
      console.log(`\nTrying: ${m} ...`);
      const model = genAI.getGenerativeModel({ model: m });
      const res = await model.generateContent("জি ভাইয়া বলুন, একটা 'hello' এর উত্তর দিন।");
      const text = res.response.text().trim();
      console.log(`✅ ${m} WORKS! Reply: "${text.substring(0, 80)}"`);
      console.log("\n=== WORKING MODEL FOUND ===");
      console.log("Use this model:", m);
      return;
    } catch (err) {
      console.log(`❌ ${m} FAILED: ${err.message.substring(0, 100)}`);
    }
  }

  console.log("\n=== ALL MODELS FAILED ===");
  console.log("Check GEMINI_API_KEY in .env file");
  console.log("Current key starts with:", KEY.substring(0, 10) + "...");
}

test().catch(console.error);
