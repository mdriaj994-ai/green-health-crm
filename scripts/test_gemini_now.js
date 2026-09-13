// scripts/test_gemini_now.js
// Run on VPS: node scripts/test_gemini_now.js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const KEY = process.env.GEMINI_API_KEY || "";

async function testMethod1_SDKApiKey() {
  console.log("\n--- Method 1: SDK with API Key (query param) ---");
  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const res = await model.generateContent("hello");
    console.log("✅ Method 1 WORKS:", res.response.text().substring(0, 60));
    return true;
  } catch (err) {
    console.log("❌ Method 1 FAILED:", err.message.substring(0, 200));
    return false;
  }
}

async function testMethod2_BearerToken() {
  console.log("\n--- Method 2: Direct fetch with Bearer token ---");
  try {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "hello, reply in one sentence" }] }]
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.log("✅ Method 2 WORKS:", data.candidates[0].content.parts[0].text.substring(0, 60));
      return true;
    } else {
      console.log("❌ Method 2 response:", JSON.stringify(data).substring(0, 300));
      return false;
    }
  } catch (err) {
    console.log("❌ Method 2 FAILED:", err.message);
    return false;
  }
}

async function testMethod3_XGoogApiKey() {
  console.log("\n--- Method 3: Direct fetch with x-goog-api-key header ---");
  try {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "hello, reply in one sentence" }] }]
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.log("✅ Method 3 WORKS:", data.candidates[0].content.parts[0].text.substring(0, 60));
      return true;
    } else {
      console.log("❌ Method 3 response:", JSON.stringify(data).substring(0, 300));
      return false;
    }
  } catch (err) {
    console.log("❌ Method 3 FAILED:", err.message);
    return false;
  }
}

async function testNetworkOnly() {
  console.log("\n--- Network Test: Can we reach Google? ---");
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": KEY },
      signal: AbortSignal.timeout(8000),
    });
    console.log("✅ Network OK! HTTP Status:", res.status);
    const data = await res.json();
    if (data.error) {
      console.log("   API Error:", data.error.code, data.error.message);
    } else {
      console.log("   Models available:", data.models?.length || 0);
    }
  } catch (err) {
    console.log("❌ Network FAILED:", err.message);
  }
}

async function main() {
  console.log("=== Gemini Diagnostic Test ===");
  console.log("Key present:", !!KEY, "| Length:", KEY.length);
  console.log("Key starts with:", KEY.substring(0, 15) + "...");
  console.log("Key format:", KEY.startsWith("AIza") ? "✅ Standard API Key" : KEY.startsWith("AQ.") ? "⚠️ OAuth Token (Bearer)" : "❓ Unknown");

  await testNetworkOnly();
  await testMethod1_SDKApiKey();
  await testMethod2_BearerToken();
  await testMethod3_XGoogApiKey();
}

main().catch(console.error);
