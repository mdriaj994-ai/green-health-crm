import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

export async function GET() {
  const info: any = {};

  // 1. Process info
  info.pid = process.pid;
  info.cwd = process.cwd();
  info.nodeVersion = process.version;
  info.uptime = process.uptime();

  // 2. Check running processes inside container
  try {
    info.ps = execSync("ps aux || ps -ef || true").toString();
  } catch (e: any) {
    info.psError = e.message;
  }

  // 3. Check data directory and files
  try {
    const dataDir = path.join(process.cwd(), "data");
    info.dataExists = fs.existsSync(dataDir);
    if (info.dataExists) {
      info.dataFiles = fs.readdirSync(dataDir);
    }
  } catch (e: any) {
    info.dataError = e.message;
  }

  // 4. Check webhook log
  try {
    const logFile = path.join(process.cwd(), "data", "webhook_hits.log");
    if (fs.existsSync(logFile)) {
      const hits = fs.readFileSync(logFile, "utf-8");
      info.recentWebhookHits = hits.slice(-2000);
    } else {
      info.recentWebhookHits = "No webhook_hits.log found";
    }
  } catch (e: any) {
    info.webhookLogError = e.message;
  }

  // 5. Test better-sqlite3
  try {
    const Database = require("better-sqlite3");
    const dbPath = path.join(process.cwd(), "prisma", "social_inbox.db");
    info.dbExists = fs.existsSync(dbPath);
    if (info.dbExists) {
      const db = new Database(dbPath, { readonly: true });
      const accounts = db.prepare("SELECT id, platform, pageId, pageName, isActive, aiAutoReply, SUBSTR(accessToken, 1, 20) as tok FROM ConnectedAccount").all();
      info.accounts = accounts;
      db.close();
    }
  } catch (e: any) {
    info.sqliteError = e.message;
  }

  // 6. Test direct Facebook Graph API fetch from container
  try {
    const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    if (token) {
      const res = await fetch("https://graph.facebook.com/v21.0/me?access_token=" + token);
      info.facebookApiStatus = res.status;
      info.facebookPage = await res.json();
    }
  } catch (e: any) {
    info.facebookApiError = e.message;
  }

  // 7. Test Groq API from container
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      const gRes = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: "Bearer " + groqKey }
      });
      info.groqStatus = gRes.status;
    }
  } catch (e: any) {
    info.groqError = e.message;
  }

  return NextResponse.json(info);
}
