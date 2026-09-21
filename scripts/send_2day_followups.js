// scripts/send_2day_followups.js
// Sends caring follow-up messages (2 minutes apart) based on past customer conversations.
// Complies 100% with Facebook 24-Hour Messaging Policy.
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

const intervalArg = process.argv.find(arg => arg.startsWith("--interval="));
const DELAY_SEC = intervalArg ? parseInt(intervalArg.split("=")[1], 10) : 120; // Default 2 minutes (120s)

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch live eligible conversations directly from Facebook Graph API
async function getLiveEligibleCandidates() {
  console.log("🔍 Fetching live customer conversations from Facebook Graph API...");
  const candidates = [];
  const seenIds = new Set();
  const now = Date.now();

  try {
    const url = `https://graph.facebook.com/v19.0/${PAGE_ID}/conversations?fields=id,updated_time,participants,messages.limit(8){id,message,from,created_time}&access_token=${PAGE_TOKEN}&limit=50`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.data && Array.isArray(data.data)) {
      for (const conv of data.data) {
        const participant = conv.participants?.data?.find(p => String(p.id) !== String(PAGE_ID));
        if (!participant || !participant.id) continue;

        const senderId = String(participant.id);
        if (seenIds.has(senderId)) continue;
        seenIds.add(senderId);

        const updatedTime = new Date(conv.updated_time).getTime();
        const hoursAgo = (now - updatedTime) / (1000 * 3600);

        // Target window: between 2 hours and 23.8 hours ago (inside Meta allowed 24h window)
        if (hoursAgo < 2 || hoursAgo > 23.8) continue;

        const msgs = conv.messages?.data || [];
        const userMsgs = msgs.filter(m => String(m.from?.id) !== String(PAGE_ID) && m.message);
        const lastUserMsg = userMsgs.length > 0 ? userMsgs[0].message : "";
        const allUserText = userMsgs.map(m => m.message).join(" ");

        // Check customer profile from memory
        const profile = customerMemory.getCustomerProfile(senderId, participant.name);

        // Skip if order placed
        if (profile.orderStatus === "order_placed" || profile.orderStatus === "delivered") continue;
        if (/nam\s*=|ঠিকানা|কুরিয়ার|অর্ডার\s*কনফার্ম/i.test(allUserText)) continue;

        // Skip if already followed up in last 24h
        if (profile.lastFollowUpTime && (now - profile.lastFollowUpTime) < 24 * 3600 * 1000) continue;

        // Sync messages into profile chatLog if missing
        if (!profile.chatLog || profile.chatLog.length === 0) {
          for (const m of msgs.slice().reverse()) {
            const role = String(m.from?.id) === String(PAGE_ID) ? "model" : "user";
            if (m.message) {
              customerMemory.appendChatMessage(senderId, role, m.message, false);
            }
          }
        }

        candidates.push({
          profile,
          stage: (profile.followUpCount || 0) + 1,
          daysSinceLastContact: 1,
          hoursSinceContact: hoursAgo,
          lastUserMsg
        });
      }
    }
  } catch (err) {
    console.warn("⚠️ Graph API fetch error, falling back to local memory:", err.message);
  }

  // Also include any local memory candidates in the 2h-23.8h window
  const localCandidates = customerMemory.getEligibleFollowUpCandidates(2, 23.8);
  for (const lc of localCandidates) {
    if (!seenIds.has(lc.profile.senderId)) {
      candidates.push(lc);
      seenIds.add(lc.profile.senderId);
    }
  }

  return candidates;
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
  console.log(` ⏱️ Interval: ${DELAY_SEC} seconds (2 minutes between messages)`);
  console.log("==================================================================");

  const candidates = await getLiveEligibleCandidates();
  console.log(`\n📬 Found ${candidates.length} active customer(s) eligible for personalized follow-up.\n`);

  if (candidates.length === 0) {
    console.log("No candidates found in the active 2-24h window.");
    return;
  }

  let sentCount = 0;
  let failCount = 0;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const { profile, stage, hoursSinceContact } = candidate;
    const senderId = profile.senderId;
    const name = profile.name || "Customer";

    console.log(`------------------------------------------------------------------`);
    console.log(`[${i + 1}/${candidates.length}] 👤 ${name} (ID: ${senderId}, ${hoursSinceContact.toFixed(1)}h ago)`);
    console.log(`    Symptoms/Inquiry: ${profile.symptoms?.join(", ") || profile.productDiscussed || candidate.lastUserMsg || "General Health"}`);

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
        console.log(`    ✅ Successfully delivered to ${name} on Facebook Messenger.`);
        sentCount++;
      } else {
        const errMsg = result?.data?.error?.message || "Unknown error";
        console.warn(`    ❌ Delivery failed (Status: ${result?.status}, Error: ${errMsg}).`);
        failCount++;
      }
    } catch (sendErr) {
      console.error(`    ❌ Send error:`, sendErr.message);
      failCount++;
    }

    // 2-minute delay between sends (120 seconds) as instructed by user
    if (i < candidates.length - 1 && !isDryRun) {
      console.log(`    ⏳ Waiting ${DELAY_SEC} seconds (2 minutes) before sending next follow-up...`);
      await sleep(DELAY_SEC * 1000);
    }
  }

  console.log("==================================================================");
  console.log(` Done! Total processed: ${candidates.length} | Sent: ${sentCount} | Failed: ${failCount}`);
  console.log("==================================================================");
}

main().catch(console.error);
