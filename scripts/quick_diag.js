// quick_diag.js
const { execSync } = require("child_process");
const fetch = (...a) => import("node-fetch").then(({default:f}) => f(...a)).catch(()=>globalThis.fetch(...a));

(async () => {
  // 1. DB token
  const db = require("better-sqlite3")("./prisma/social_inbox.db");
  const row = db.prepare("SELECT accessToken, aiAutoReply FROM ConnectedAccount WHERE platform = 'FACEBOOK'").get();
  const token = row?.accessToken || "";
  console.log("1. DB token starts:", token.substring(0, 25), "| len:", token.length, "| aiAutoReply:", row?.aiAutoReply);
  db.close();

  // 2. Token valid?
  const check = await fetch("https://graph.facebook.com/v19.0/me?access_token=" + token).then(r => r.json());
  console.log("2. Token:", check.id ? "✅ " + check.name : "❌ " + (check.error?.message || "").substring(0, 80));

  // 3. Can fetch conversations?
  if (check.id) {
    const msgs = await fetch("https://graph.facebook.com/v19.0/" + check.id + "/conversations?fields=messages{message,from,created_time}&limit=1&access_token=" + token).then(r => r.json());
    const last = msgs?.data?.[0]?.messages?.data?.[0];
    if (last) {
      console.log("3. Last msg:", last.from?.name, "->", (last.message || "").substring(0, 50), "@", last.created_time);
    } else {
      console.log("3. No conversations found or error:", JSON.stringify(msgs).substring(0, 100));
    }
  }

  // 4. Env var check
  const envTok = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";
  console.log("4. ENV token starts:", envTok.substring(0, 25), "| len:", envTok.length);
  console.log("   DB==ENV:", token === envTok ? "✅ Same" : "❌ Different!");
})().catch(e => console.log("ERR:", e.message));
