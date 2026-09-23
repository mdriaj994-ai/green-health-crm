// scripts/send_hakim_direct_followup.js
// Sends a highly personalized follow-up message to customers who:
//   - Had 3+ message exchanges on Facebook Messenger
//   - Did NOT place an order yet
//   - Are within the 24-hour Facebook messaging policy window (2h to 23.8h ago)
//
// Usage:
//   node scripts/send_hakim_direct_followup.js            - Live send
//   node scripts/send_hakim_direct_followup.js --dry-run  - Preview only
//   node scripts/send_hakim_direct_followup.js --interval=90  - 90s delay

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const customerMemory = require("./customer_memory.js");

const PAGE_ID    = process.env.FACEBOOK_PAGE_ID || "932259009980880";
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN ||
  "EAAjkLPT8UegBSsQVgxm1fBW6D7N7oon9ZAudS1UKVLVbBEar1BGEvZCLJ3ibSLO6FmILQDf6mq4rcsL98cpxuuRwAHSwUprKUBLv6ZBBCSjYAGUPTU1SQIRDvR74D5aIivRiDoUG3zobZB83AIwZA8mZAhoqcBDpjii2KsvQshwZCCIdUSJk5NaDb5JZCFGt4YWKBfEZC";

const HAKIM_NUMBER  = "01870-023804";
const MIN_USER_MSGS = 3;
const isDryRun      = process.argv.includes("--dry-run");
const intervalArg   = process.argv.find(a => a.startsWith("--interval="));
const DELAY_MS      = (intervalArg ? parseInt(intervalArg.split("=")[1], 10) : 120) * 1000;

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const genAI      = GEMINI_KEY ? new GoogleGenerativeAI(GEMINI_KEY) : null;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fbGet(url) {
  const res = await fetch(url);
  return res.json();
}

async function sendFBMessage(recipientId, text) {
  const url = "https://graph.facebook.com/v19.0/me/messages?access_token=" + PAGE_TOKEN;

  // First try with RESPONSE type (valid if customer messaged within 24h)
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message:   { text },
      messaging_type: "RESPONSE",
    }),
  });
  const data = await res.json();

  // If RESPONSE failed due to window, retry with MESSAGE_TAG
  if (res.status === 400 && data?.error?.code === 10) {
    const res2 = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message:   { text },
        messaging_type: "MESSAGE_TAG",
        tag: "CONFIRMED_EVENT_UPDATE",
      }),
    });
    const data2 = await res2.json();
    return { status: res2.status, data: data2, usedTag: true };
  }

  return { status: res.status, data };
}

async function fetchEligibleCustomers() {
  console.log("\n  Fetching recent conversations from Facebook Graph API...");
  const candidates = [];
  const seenIds    = new Set();
  const now        = Date.now();

  try {
    const url = "https://graph.facebook.com/v19.0/" + PAGE_ID + "/conversations" +
      "?fields=id,updated_time,participants,messages.limit(15){id,message,from,created_time}" +
      "&access_token=" + PAGE_TOKEN + "&limit=100";
    const data = await fbGet(url);

    if (!data.data || !Array.isArray(data.data)) {
      console.warn("  No conversation data returned:", data.error?.message || JSON.stringify(data));
    } else {
      for (const conv of data.data) {
        const participant = conv.participants?.data?.find(p => String(p.id) !== String(PAGE_ID));
        if (!participant?.id) continue;
        const senderId = String(participant.id);
        if (seenIds.has(senderId)) continue;
        seenIds.add(senderId);

        const updatedTime = new Date(conv.updated_time).getTime();
        const hoursAgo    = (now - updatedTime) / 3600000;
        if (hoursAgo < 2 || hoursAgo > 23.8) continue;

        const msgs     = conv.messages?.data || [];
        const userMsgs = msgs.filter(m => String(m.from?.id) !== String(PAGE_ID) && m.message);
        const botMsgs  = msgs.filter(m => String(m.from?.id) === String(PAGE_ID) && m.message);

        if (userMsgs.length < MIN_USER_MSGS) continue;

        // CRITICAL FIX: Use CUSTOMER's last message time, NOT conversation updated_time
        // (conversation updated_time reflects the last bot reply which is not relevant for FB 24h window)
        const lastUserMsg     = userMsgs[0]; // messages are newest-first from API
        const lastUserMsgTime = lastUserMsg?.created_time
          ? new Date(lastUserMsg.created_time).getTime()
          : new Date(conv.updated_time).getTime();
        const userMsgHoursAgo = (now - lastUserMsgTime) / 3600000;

        if (userMsgHoursAgo < 2 || userMsgHoursAgo > 23.5) {
          // Outside Facebook 24h window based on customer's actual last message
          continue;
        }

        const allUserText = userMsgs.map(m => m.message).join(" ");
        if (/nam\s*=|thikana|address|confirmed|order.*confirm|bkash.*pathiye/i.test(allUserText)) continue;

        const profile = customerMemory.getCustomerProfile(senderId, participant.name || "");
        if (profile.orderStatus === "order_placed" || profile.orderStatus === "delivered") continue;

        if (profile.hakimDirectFollowupTime && (now - profile.hakimDirectFollowupTime) < 20 * 3600000) {
          console.log("   SKIP (already sent " + ((now - profile.hakimDirectFollowupTime) / 3600000).toFixed(1) + "h ago): " + (participant.name || senderId));
          continue;
        }

        if (botMsgs.length > 0) {
          const lastBotTime = new Date(botMsgs[0].created_time).getTime();
          if ((now - lastBotTime) < 2 * 3600000) {
            console.log("   SKIP (bot replied " + ((now - lastBotTime) / 60000).toFixed(0) + "min ago): " + (participant.name || senderId));
            continue;
          }
        }

        if (!profile.chatLog || profile.chatLog.length === 0) {
          for (const m of [...msgs].reverse()) {
            const role = String(m.from?.id) === String(PAGE_ID) ? "model" : "user";
            if (m.message) customerMemory.appendChatMessage(senderId, role, m.message, false);
          }
        }

        candidates.push({
          senderId,
          name:         participant.name || profile.name || "vaiya",
          profile,
          hoursAgo:     userMsgHoursAgo,  // use actual customer message age
          userMsgCount: userMsgs.length,
          allUserText,
          recentUserMsgs: userMsgs.slice(0, 5).map(m => m.message),
        });
      }
    }
  } catch (err) {
    console.error("  Graph API error:", err.message);
  }

  const localCandidates = customerMemory.getEligibleFollowUpCandidates(2, 23.8);
  for (const lc of localCandidates) {
    const sid = lc.profile.senderId;
    if (seenIds.has(sid)) continue;
    const p = lc.profile;
    if (p.orderStatus === "order_placed" || p.orderStatus === "delivered") continue;
    if (p.hakimDirectFollowupTime && (now - p.hakimDirectFollowupTime) < 20 * 3600000) continue;
    const userMsgCount = (p.chatLog || []).filter(m => m.role === "user").length;
    if (userMsgCount < MIN_USER_MSGS) continue;
    seenIds.add(sid);
    candidates.push({
      senderId: sid,
      name:     p.name || "vaiya",
      profile:  p,
      hoursAgo: lc.hoursSinceContact || 5,
      userMsgCount,
      allUserText: (p.chatLog || []).filter(m => m.role === "user").map(m => m.text).join(" "),
      recentUserMsgs: (p.chatLog || []).filter(m => m.role === "user").slice(-5).reverse().map(m => m.text),
    });
  }

  return candidates;
}

function buildHakimFollowUpPrompt(customer) {
  const { name, profile, hoursAgo, userMsgCount, recentUserMsgs, allUserText } = customer;

  let firstName = "vaiya";
  if (name && !["Customer", "vaiya"].includes(name.trim())) {
    const parts = name.trim().split(/\s+/);
    firstName = /^(?:md\.?|mohammad|muhammad)$/i.test(parts[0]) && parts.length > 1 ? parts[1] : parts[0];
  }

  let symptomSummary = "";
  if (profile.symptoms && profile.symptoms.length > 0) {
    symptomSummary = profile.symptoms.map(s => s.split(" (")[0]).join(", ");
  } else if (profile.productDiscussed) {
    symptomSummary = profile.productDiscussed + " somporke jante cheyechhilen";
  } else if (allUserText) {
    const keywords = [];
    if (/druto|birjopat|jaldi|দ্রুত|বীর্যপাত|শীঘ্রপতন|তাড়াতাড়ি/i.test(allUserText)) keywords.push("দ্রুত বীর্যপাত");
    if (/shokto|erection|ইরেকশন|শক্ত|উত্থান|নরম|দুর্বল হয়ে/i.test(allUserText)) keywords.push("ইরেকশনের সমস্যা");
    if (/durbol|দুর্বল|stamina|শক্তি|এনার্জি/i.test(allUserText)) keywords.push("শারীরিক দুর্বলতা");
    if (/birjo|বীর্য|পাতলা|ঘন/i.test(allUserText)) keywords.push("বীর্যের সমস্যা");
    if (keywords.length === 0) keywords.push("শারীরিক সমস্যা");
    symptomSummary = keywords.join(" ও ");
  } else {
    symptomSummary = "শারীরিক সমস্যা নিয়ে কথা বলেছিলেন";
  }

  const patientAge    = profile.age ? profile.age + " bochor" : "বলেননি";
  const chatSummary   = recentUserMsgs.slice(0, 3).join(" | ");
  const greetingLine  = firstName !== "vaiya"
    ? firstName + " ভাই, আসসালামু আলাইকুম, কেমন আছেন?"
    : "আসসালামু আলাইকুম ভাইয়া, কেমন আছেন?";

  return `তুমি হাকীম মো: আব্দুল করিম, জনতা ইউনানী চিকিৎসালয়, আলীকদম, বান্দরবান। তুমি নিজে ল্যাবে হাতে তৈরি করা ভেষজ ওষুধ দিয়ে রোগীদের সুস্থ করো।

রোগীর নাম: ${firstName}
রোগীর সমস্যা: ${symptomSummary}
রোগীর বয়স: ${patientAge}
রোগী ${userMsgCount}টি বার্তায় কথা বলেছে কিন্তু এখনো ওষুধ নেয়নি।
রোগীর সাম্প্রতিক কথা: "${chatSummary}"

নিচের বিষয়গুলো অন্তর্ভুক্ত করে একটি আন্তরিক বাংলা ফলো-আপ বার্তা লেখো:
১. শুরু করো: "${greetingLine}"
২. রোগীর সমস্যার কথা স্বাভাবিকভাবে উল্লেখ করো
৩. ছোট ভাইকে বলার মতো সতর্ক করো যে এই সমস্যা একা একা ভালো হয় না, দিন দিন আরও জটিল হয়
৪. বলো তুমি নিজে ল্যাবে প্রতিটি রোগীর জন্য আলাদাভাবে ওষুধ তৈরি করো
৫. শেষ বাক্যে অবশ্যই এই নম্বরে সরাসরি কল করতে এবং WhatsApp-এ মেসেজ দিতে বলো: ${HAKIM_NUMBER}

বাধ্যতামূলক: বার্তার শেষ বাক্যে "কল" এবং "WhatsApp" দুটো কথাই উল্লেখ করতে হবে। শুধু বাংলায় লিখবে। দাম, অ্যাডভান্স বা অর্ডার ফর্মের কথা বলবে না। ৪-৫টি বাক্যে শেষ করবে।`;
}

// Prompt-leak detection patterns — these phrases appear in AI instructions,
// never in a real Bengali customer message.
const PROMPT_LEAK_PATTERNS = [
  /4[-–]5\s*short\s*sentences/i,
  /NO\s*price/i,
  /NO\s*advance/i,
  /NO\s*bkash/i,
  /NO\s*markdown/i,
  /STRICT\s*RULES/i,
  /Write\s*ONLY/i,
  /Output\s*ONLY/i,
  /Warning\s*like\s*a\s*brother/i,
  /dynamic\s*custom\s*medicine/i,
  /inshaAllah\)\.\s*Length/i,
  /Sentence\b.*\n/i,
  /^\s*\.\s*$/m,            // lone period on a line
  /^\s*Length\b/im,
  /^\s*Drafting/im,
  /^\s*\(\s*Warning/im,
  /^\s*\(\s*in Bengali\)/im,
];

function isCleanBengaliMessage(text) {
  if (!text || text.length < 50) return false;
  for (const re of PROMPT_LEAK_PATTERNS) {
    if (re.test(text)) return false;
  }
  // Must contain at least some Bengali Unicode characters
  const bengaliChars = (text.match(/[\u0980-\u09FF]/g) || []).length;
  if (bengaliChars < 20) return false;
  // MUST mention WhatsApp (both call AND WhatsApp required)
  if (!text.includes("WhatsApp")) return false;
  // MUST contain the hakim's number
  if (!text.includes("01870")) return false;
  return true;
}

async function generateHakimFollowUpMessage(customer) {
  const prompt = buildHakimFollowUpPrompt(customer);

  if (genAI) {
    const models = ["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: [
            "তুমি হাকীম মো: আব্দুল করিম। তুমি শুধুমাত্র বাংলায় একটি আন্তরিক বার্তা লিখবে।",
            "কোনো ইংরেজি নির্দেশনা, মার্কডাউন, বুলেট পয়েন্ট, বা ব্যাখ্যা লিখবে না।",
            "শুধু রোগীকে পাঠানোর মতো বাংলা বার্তাটি লিখবে।",
          ].join(" "),
          generationConfig: { maxOutputTokens: 350, temperature: 0.7 },
        });
        const res = await model.generateContent(prompt);
        let raw = res.response.text().trim();
        // Strip any markdown, code fences, quotes
        raw = raw.replace(/^```[\s\S]*?```$/gm, "").trim();
        raw = raw.replace(/^["'`]+|["'`]+$/g, "").trim();
        raw = raw.replace(/[*#_~]+/g, "").trim();
        // Remove lines that look like prompt instructions leaking through
        const lines = raw.split("\n").filter(line => {
          const l = line.trim();
          if (!l) return false;
          for (const re of PROMPT_LEAK_PATTERNS) {
            if (re.test(l)) return false;
          }
          return true;
        });
        raw = lines.join("\n").trim();

        if (isCleanBengaliMessage(raw)) {
          console.log("    Generated via Gemini (" + modelName + ")");
          return raw;
        } else {
          console.log("    [WARN] Gemini (" + modelName + ") output failed clean-check, using fallback.");
        }
      } catch (err) {
        // try next model
      }
    }
  }

  return generateFallbackHakimMessage(customer);
}

function generateFallbackHakimMessage(customer) {
  const { name, profile, hoursAgo } = customer;
  let firstName = "vaiya";
  if (name && !["Customer", "vaiya"].includes(name.trim())) {
    const parts = name.trim().split(/\s+/);
    firstName = /^(?:md\.?|mohammad|muhammad)$/i.test(parts[0]) && parts.length > 1 ? parts[1] : parts[0];
  }
  const nameLabel = firstName !== "vaiya" ? firstName + " " : "";
  let symptoms = "শারীরিক সমস্যা";
  if (profile.symptoms && profile.symptoms.length > 0) {
    symptoms = profile.symptoms.join(", ");
  } else if (customer.allUserText) {
    const kw = [];
    if (/druto|birjopat|jaldi|দ্রুত|বীর্যপাত|শীঘ্রপতন|তাড়াতাড়ি/i.test(customer.allUserText)) kw.push("দ্রুত বীর্যপাত ও পাতলা বীর্যের সমস্যা");
    if (/shokto|erection|ইরেকশন|শক্ত|উত্থান|নরম|দুর্বল হয়ে/i.test(customer.allUserText)) kw.push("ইরেকশন বা সঠিক দৃঢ়তা না পাওয়ার সমস্যা");
    if (/durbol|দুর্বল|stamina|শক্তি|এনার্জি/i.test(customer.allUserText)) kw.push("শারীরিক ক্লান্তি ও দুর্বলতা");
    if (kw.length > 0) symptoms = kw.join(" এবং ");
  }

  const variants = [
    nameLabel + "ভাই, আসসালামু আলাইকুম, কেমন আছেন? আপনি আমাদের পেজে " + symptoms + " নিয়ে কথা বলেছিলেন — আমি আপনার কথাটা মনে রেখেছি। ভাইয়া, এই ধরনের সমস্যা একা একা ভালো হয় না, বরং দিন দিন আরও বেশি জটিল হয়ে যায় — তাই দেরি না করাই ভালো। আমি হাকীম মো: আব্দুল করিম, আমি নিজে আমার ল্যাবে প্রতিটি রোগীর জন্য আলাদাভাবে বিশেষ ওষুধ তৈরি করি। একটু সরাসরি কল করুন বা WhatsApp-এ মেসেজ দিন এই নম্বরে: " + HAKIM_NUMBER + " — আপনার পুরো সমস্যা শুনে বিশেষভাবে আপনার জন্য ওষুধ তৈরি করে দেব ইনশাআল্লাহ।",

    "আসসালামু আলাইকুম " + nameLabel + "ভাইয়া, কেমন আছেন? আপনি " + symptoms + " নিয়ে আমাদের পেজে কথা বলেছিলেন — সেই বিষয়টা আমার মাথায় ছিল। সত্যি কথা হলো ভাই, এই ধরনের শারীরিক সমস্যা যত দেরি করবেন তত ক্ষতি বাড়তে থাকে, সময়মতো সঠিক চিকিৎসা না নিলে পরে অনেক বেশি কঠিন হয়ে যায়। আমি নিজে ল্যাবে প্রতিটি রোগীর অবস্থা বিবেচনা করে তার জন্য বিশেষ ওষুধ তৈরি করি। এই নম্বরে সরাসরি কল করুন বা WhatsApp-এ নক দিন: " + HAKIM_NUMBER + " — আপনার সব সমস্যা শুনে বিশেষভাবে আপনার জন্য ওষুধ বানিয়ে দেব, ইনশাআল্লাহ ১০০% কাজ করবে।",

    nameLabel + "ভাইয়া, আসসালামু আলাইকুম! আপনি একটু আগে " + symptoms + " নিয়ে কথা বলেছিলেন, বিষয়টা এখনো আমার মনে আছে। ভাই, এই সমস্যা নিজে নিজে সারে না — যত দিন যাবে তত বেশি জটিল হয়, তাই এখনই পদক্ষেপ নেওয়া জরুরি। আমি হাকীম মো: আব্দুল করিম, আমি নিজে হাতে ল্যাবে তৈরি বিশেষ ওষুধ দিয়ে রোগীদের সুস্থ করি। আপনাকে এই নম্বরটা দিচ্ছি: " + HAKIM_NUMBER + " — সরাসরি কল করুন বা WhatsApp-এ মেসেজ দিন, আপনার জন্য আলাদাভাবে ওষুধ তৈরি করে দেব ইনশাআল্লাহ।",
  ];

  return variants[Math.floor(Math.random() * variants.length)];
}

async function main() {
  console.log("================================================================");
  console.log(" HAKIM DIRECT FOLLOW-UP CAMPAIGN " + (isDryRun ? "[DRY RUN]" : "[LIVE SEND]"));
  console.log(" Target: Customers with " + MIN_USER_MSGS + "+ msgs but NO order");
  console.log(" Delay between sends: " + (DELAY_MS / 1000) + "s");
  console.log("================================================================\n");

  const customers = await fetchEligibleCustomers();

  if (customers.length === 0) {
    console.log("No eligible customers found in 2-24h window with " + MIN_USER_MSGS + "+ messages.\n");
    return;
  }

  console.log("\n Found " + customers.length + " customer(s) eligible for Hakim direct follow-up:\n");
  customers.forEach((c, i) => {
    console.log("  " + (i + 1) + ". " + c.name + " (" + c.senderId + ") - " + c.userMsgCount + " msgs, " + c.hoursAgo.toFixed(1) + "h ago");
  });
  console.log("");

  let sentCount = 0, failCount = 0, skipCount = 0;

  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    const { senderId, name, profile, userMsgCount, hoursAgo } = customer;

    console.log("----------------------------------------------------------");
    console.log("[" + (i + 1) + "/" + customers.length + "] " + name + " (ID: " + senderId + ", " + hoursAgo.toFixed(1) + "h ago)");
    console.log("  Msgs: " + userMsgCount + " | Topic: " + (profile.symptoms?.join(", ") || profile.productDiscussed || customer.allUserText.slice(0, 60) || "N/A"));
    console.log("  Recent: \"" + customer.recentUserMsgs.slice(0, 2).join(" | ").slice(0, 100) + "\"");

    process.stdout.write("  Generating personalized Hakim message...");
    const message = await generateHakimFollowUpMessage(customer);
    console.log(" Done.\n");

    if (!message || message.length < 30) {
      console.log("  Could not generate message. Skipping.\n");
      skipCount++;
      continue;
    }

    console.log("  Message:\n");
    message.split("\n").forEach(line => console.log("    " + line));
    console.log("");

    if (isDryRun) {
      console.log("  [DRY RUN] Would send this message.\n");
      sentCount++;
      continue;
    }

    try {
      const result = await sendFBMessage(senderId, message);
      if (result.status === 200 && result.data?.message_id) {
        customerMemory.updateCustomerProfile(senderId, {
          hakimDirectFollowupTime: Date.now(),
          hakimDirectFollowupMsg: message.slice(0, 200),
        });
        customerMemory.appendChatMessage(senderId, "model", message, false);
        console.log("  Delivered to " + name);
        sentCount++;
      } else {
        const err = result.data?.error?.message || JSON.stringify(result.data);
        console.warn("  Delivery failed (" + result.status + "): " + err);
        failCount++;
      }
    } catch (sendErr) {
      console.error("  Send error: " + sendErr.message);
      failCount++;
    }

    if (i < customers.length - 1 && !isDryRun) {
      console.log("  Waiting " + (DELAY_MS / 1000) + "s before next send...");
      await sleep(DELAY_MS);
    }
  }

  console.log("\n================================================================");
  console.log(" Campaign Complete!");
  console.log("   Total: " + customers.length + " | Sent: " + sentCount + " | Failed: " + failCount + " | Skipped: " + skipCount);
  console.log("================================================================\n");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});