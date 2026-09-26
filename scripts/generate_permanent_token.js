// scripts/generate_permanent_token.js
// Takes a User Token or Page Token, exchanges it for a 60-day Long-Lived Token via App Secret,
// then queries /me/accounts to get the NEVER-EXPIRING (Permanent) Page Token for Natural Herbal.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const APP_ID = process.env.FACEBOOK_APP_ID || "2502681553555944";
const APP_SECRET = process.env.FACEBOOK_APP_SECRET || "73a48e7182eb8e77a28e82ef74549419";
const PAGE2_ID = "133420039845881";

async function makePermanent(inputToken) {
  if (!inputToken) {
    console.error("❌ Please provide a token: node scripts/generate_permanent_token.js <YOUR_TOKEN>");
    process.exit(1);
  }

  console.log("🔍 1. Inspecting provided token...");
  const debugRes = await fetch(`https://graph.facebook.com/debug_token?input_token=${inputToken}&access_token=${APP_ID}|${APP_SECRET}`);
  const debugData = await debugRes.json();
  console.log("   Token Info:", JSON.stringify(debugData.data || debugData, null, 2));

  // Step 2: Exchange for Long-Lived User Token (if it's a user token or short-lived token)
  console.log("\n🔄 2. Exchanging for Long-Lived Token via App Secret...");
  const exchangeRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${inputToken}`);
  const exchangeData = await exchangeRes.json();
  const longLivedToken = exchangeData.access_token || inputToken;
  console.log("   Long-lived token obtained:", longLivedToken ? "✅ YES" : "Using original");

  // Step 3: Fetch all connected accounts with page access tokens
  console.log("\n📄 3. Fetching Permanent Page Tokens for all Pages...");
  const accountsRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,tasks&access_token=${longLivedToken}`);
  const accountsData = await accountsRes.json();

  if (accountsData.error) {
    console.error("❌ Accounts Error:", accountsData.error.message);
    // If it was already a page token, check if we can exchange it directly
    return;
  }

  const pages = accountsData.data || [];
  console.log(`   Found ${pages.length} page(s):`, pages.map(p => `${p.name} (${p.id})`));

  const page2 = pages.find(p => String(p.id) === PAGE2_ID);
  if (!page2 || !page2.access_token) {
    console.error(`❌ Natural Herbal page (${PAGE2_ID}) not found in this user's accounts, or missing access_token!`);
    console.log("Available pages:", pages);
    return;
  }

  const permToken = page2.access_token;
  console.log(`\n🎉 Found Permanent Token for "${page2.name}"!`);
  console.log("Token prefix:", permToken.slice(0, 30));
  console.log("Token suffix:", permToken.slice(-20));

  // Verify it never expires
  const verifyRes = await fetch(`https://graph.facebook.com/debug_token?input_token=${permToken}&access_token=${APP_ID}|${APP_SECRET}`);
  const verifyData = await verifyRes.json();
  const expiresAt = verifyData.data?.expires_at;
  console.log("Expires At:", expiresAt === 0 ? "✅ 0 (NEVER EXPIRES / PERMANENT)" : expiresAt);

  // Apply to .env
  const envPath = path.join(process.cwd(), '.env');
  let env = fs.readFileSync(envPath, 'utf8');
  env = env.replace(/FACEBOOK_PAGE_ACCESS_TOKEN_2=.*/g, 'FACEBOOK_PAGE_ACCESS_TOKEN_2=' + permToken);
  fs.writeFileSync(envPath, env, 'utf8');
  console.log("✅ Updated .env");

  // Apply to SQLite DB
  const dbPath = path.join(process.cwd(), 'prisma', 'social_inbox.db');
  if (fs.existsSync(dbPath)) {
    const db = new Database(dbPath);
    db.prepare("UPDATE ConnectedAccount SET accessToken = ?, updatedAt = ? WHERE pageId = ?").run(permToken, new Date().toISOString(), PAGE2_ID);
    db.close();
    console.log("✅ Updated SQLite DB ConnectedAccount");
  }

  // Apply to Dockerfile
  const dockerPath = path.join(process.cwd(), 'Dockerfile');
  let docker = fs.readFileSync(dockerPath, 'utf8');
  docker = docker.replace(/ENV FACEBOOK_PAGE_ACCESS_TOKEN_2=".*"/g, `ENV FACEBOOK_PAGE_ACCESS_TOKEN_2="${permToken}"`);
  fs.writeFileSync(dockerPath, docker, 'utf8');
  console.log("✅ Updated Dockerfile");

  // Apply to start-all.js
  const startPath = path.join(process.cwd(), 'scripts', 'start-all.js');
  let startCode = fs.readFileSync(startPath, 'utf8');
  startCode = startCode.replace(/const p2Token = process\.env\.FACEBOOK_PAGE_ACCESS_TOKEN_2 \|\| ".*";/, `const p2Token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN_2 || "${permToken}";`);
  fs.writeFileSync(startPath, startCode, 'utf8');
  console.log("✅ Updated scripts/start-all.js");

  console.log("\n🚀 All files updated! Run 'git push' to deploy to Coolify.");
}

const inputToken = process.argv[2];
makePermanent(inputToken);
