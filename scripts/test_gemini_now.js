// scripts/test_gemini_now.js
// Run on VPS: node scripts/test_gemini_now.js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const KEY = process.env.GEMINI_API_KEY || "";

async function listAvailableModels() {
  console.log("\n--- Listing ALL Available Models ---");
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": KEY },
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    if (data.models) {
      const generateModels = data.models.filter(m =>
        m.supportedGenerationMethods?.includes("generateContent")
      );
      console.log(`✅ Found ${generateModels.length} generateContent-capable models:`);
      for (const m of generateModels) {
        console.log(`  - ${m.name} (display: ${m.displayName || "n/a"})`);
      }
      return generateModels.map(m => m.name.replace("models/", ""));
    } else {
      console.log("❌ Error:", JSON.stringify(data).substring(0, 300));
      return [];
    }
  } catch (err) {
    console.log("❌ FAILED:", err.message);
    return [];
  }
}

async function testModel(modelName) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "hello" }] }]
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text.substring(0, 60);
    }
    return null;
  } catch (err) {
    return null;
  }
}

async function main() {
  console.log("=== Gemini Full Diagnostic ===");
  console.log("Key present:", !!KEY, "| Length:", KEY.length);
  console.log("Key starts with:", KEY.substring(0, 15) + "...");

  const models = await listAvailableModels();

  if (models.length === 0) {
    console.log("\n❌ No models found. Check API key.");
    return;
  }

  console.log("\n--- Testing each model ---");
  const workingModels = [];
  for (const m of models.slice(0, 10)) { // test first 10
    process.stdout.write(`Testing ${m}... `);
    const reply = await testModel(m);
    if (reply) {
      console.log(`✅ WORKS! Reply: "${reply}"`);
      workingModels.push(m);
      if (workingModels.length >= 3) break; // found enough
    } else {
      console.log("❌");
    }
  }

  if (workingModels.length > 0) {
    console.log("\n=== ✅ WORKING MODELS FOUND ===");
    for (const m of workingModels) console.log(" -", m);
    console.log("\nPaste these model names when asked.");
  } else {
    console.log("\n=== ❌ ALL MODELS FAILED ===");
    console.log("KEY may be invalid or expired.");
  }
}

main().catch(console.error);
