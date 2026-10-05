const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const db = new Database(path.join(process.cwd(), 'prisma', 'social_inbox.db'));
const accounts = db.prepare("SELECT pageId, pageName, accessToken FROM ConnectedAccount WHERE platform = 'FACEBOOK'").all();

async function checkUnreplied(page) {
  const tok = page.accessToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const url = `https://graph.facebook.com/v19.0/${page.pageId}/conversations?fields=messages.limit(5){message,from,created_time,id,attachments}&limit=5&access_token=${tok}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log(`\n=== Page: "${page.pageName}" ===`);
  for (const conv of (data.data || [])) {
    const msgs = conv.messages?.data || [];
    if (msgs.length === 0) continue;
    const latest = msgs[0];
    const isFromCustomer = latest.from?.id && String(latest.from.id) !== String(page.pageId);
    if (isFromCustomer) {
      console.log(`UNREPLIED THREAD: ${conv.id} | Customer: ${latest.from?.name} (${latest.from?.id}) | Time: ${latest.created_time} | Text: "${latest.message}"`);
    } else {
      console.log(`Replied thread: ${conv.id} | Page sent: "${latest.message || '[Media]'}" at ${latest.created_time}`);
    }
  }
}

async function main() {
  for (const acc of accounts) await checkUnreplied(acc);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
