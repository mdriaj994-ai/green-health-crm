// scripts/send_2day_followups.js
// Sends 1-2 day caring follow-up messages based on past customer conversations.
// Strictly zero sales pressure — empathetic doctor/brother check-in.

require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const customerMemory = require("./customer_memory.js");
const { sendFacebookMessage, callGroqLLM } = require("./fb_realtime_bot.js");

const PAGE_ID = process.env.FACEBOOK_PAGE_ID || "932259009980880";
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "EAAjkLPT8UegBSsQVgxm1fBW6D7N7oon9ZAudS1UKVLVbBEar1BGEvZCLJ3ibSLO6FmILQDf6mq4rcsL98cpxuuRwAHSwUprKUBLv6ZBBCSjYAGUPTU1SQIRDvR74D5aIivRiDoUG3zobZB83AIwZA8mZAhoqcBDpjii2KsvQshwZCCIdUSJk5NaDb5JZCFGt4YWKBfEZC";

const isDryRun = process.argv.includes("--dry-run");

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateFollowUpMessage(candidate) {
  const followUpPrompt = customerMemory.buildPersonalizedFollowUpPrompt(
    candidate,
    "হাকীম মো: আব্দুল করিম",
    "গ্রীন হেলথ ইউনানী ফার্মেসী"
  );

  let message = null;

  // 1. Try Gemini
  if (genAI) {
    const models = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.6-flash", "gemini-flash-latest"];
    for (const m of models) {
      try {
        const model = genAI.getGenerativeModel({
          model: m,
          systemInstruction: "You are হাকীম মো: আব্দুল করিম, Category-A Registered Unani Physician. Output ONLY the clean Bengali message. Absolutely no explanations, no checklists, no internal thoughts, no markdown, no quotes.",
          generationConfig: { maxOutputTokens: 600, temperature: 0.6 }
        });
        const res = await model.generateContent(followUpPrompt);
        let raw = res.response.text().trim();
        // If model output had checklist or thoughts, extract the Bengali message
        if (raw.includes("ভাই, আসসালামু") || raw.includes("আসসালামু আলাইকুম")) {
          const match = raw.match(/(?:[A-Za-z\u0980-\u09FF\s]+ভাই[,\s]+)?আসসালামু\s*আলাইকুম[\s\S]+/i) || raw.match(/আসসালামু\s*আলাইকুম[\s\S]+/i);
          if (match) raw = match[0];
        }
        if (raw && raw.length > 15) {
          message = raw.replace(/[*#"`]+/g, "").trim()
            .replace(/রেজাউল\s*করিম/gi, "মো: আব্দুল করিম")
            .replace(/রেজাউল/gi, "রিয়াজুল");
          break;
        }
      } catch (err) {
        // try next model
      }
    }
  }

  // 2. Try Groq if Gemini fails
  if (!message && typeof callGroqLLM === "function") {
    try {
      const groqRes = await callGroqLLM(followUpPrompt, "You are Hakim Md. Abdul Karim, caring Bangladeshi physician.");
      if (groqRes && groqRes.length > 15) {
        message = groqRes.replace(/[*#]+/g, "").trim();
      }
    } catch (gErr) {
      console.warn("[GROQ_WARN]:", gErr.message);
    }
  }

  // 3. Fallback to empathetic template
  if (!message && typeof customerMemory.generateFallbackCaringFollowUp === "function") {
    message = customerMemory.generateFallbackCaringFollowUp(candidate.profile);
  }

  return message;
}

async function main() {
  console.log("==================================================================");
  console.log(` 🏥 1-2 DAY CLINICAL FOLLOW-UP RUNNER ${isDryRun ? "[DRY RUN]" : "[LIVE SEND]"}`);
  console.log("==================================================================");

  // Get candidates who interacted between 20 and 65 hours ago (1 to 2.5 days)
  const candidates = customerMemory.getEligibleFollowUpCandidates(20, 65);
  console.log(`Found ${candidates.length} eligible candidate(s) for 1-2 day follow-up.\n`);

  if (candidates.length === 0) {
    console.log("No candidates found in the 1-2 day window.");
    return;
  }

  let sentCount = 0;
  let failCount = 0;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const { profile, stage, hoursSinceContact } = candidate;
    const senderId = profile.senderId;
    const name = profile.name || "Customer";

    console.log(`[${i + 1}/${candidates.length}] 👤 ${name} (ID: ${senderId}, ${hoursSinceContact.toFixed(1)}h ago)`);
    console.log(`    Symptoms: ${profile.symptoms?.join(", ") || "None recorded"}`);
    console.log(`    Product: ${profile.productDiscussed || "None recorded"}`);

    const message = await generateFollowUpMessage(candidate);
    if (!message) {
      console.log(`    ⚠️ Could not generate message. Skipping.`);
      continue;
    }

    console.log(`    💬 Message:\n    "${message}"\n`);

    if (isDryRun) {
      sentCount++;
      continue;
    }

    try {
      const result = await sendFacebookMessage(senderId, message, PAGE_TOKEN);
      if (result && result.status === 200) {
        customerMemory.recordFollowUpSent(senderId, message, stage);
        console.log(`    ✅ Successfully delivered to ${name}.`);
        sentCount++;
      } else {
        console.warn(`    ❌ Delivery failed (Status: ${result?.status}, Error: ${result?.data?.error?.message || "Unknown"}).`);
        failCount++;
      }
    } catch (sendErr) {
      console.error(`    ❌ Send error:`, sendErr.message);
      failCount++;
    }

    // Polite delay of 3 seconds between sends to comply with Facebook rate limits
    await sleep(3000);
  }

  console.log("==================================================================");
  console.log(` Done! Total processed: ${candidates.length} | Sent: ${sentCount} | Failed: ${failCount}`);
  console.log("==================================================================");
}

main().catch(console.error);
