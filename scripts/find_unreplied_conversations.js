// scripts/find_unreplied_conversations.js
const fs = require('fs');
const path = require('path');

const PAGE_ID = process.env.FACEBOOK_PAGE_ID || "932259009980880";
const PAGE_TOKEN = "EAAjkLPT8UegBSsQVgxm1fBW6D7N7oon9ZAudS1UKVLVbBEar1BGEvZCLJ3ibSLO6FmILQDf6mq4rcsL98cpxuuRwAHSwUprKUBLv6ZBBCSjYAGUPTU1SQIRDvR74D5aIivRiDoUG3zobZB83AIwZA8mZAhoqcBDpjii2KsvQshwZCCIdUSJk5NaDb5JZCFGt4YWKBfEZC";

async function getAllConversations() {
  let allConvs = [];
  let url = `https://graph.facebook.com/v19.0/${PAGE_ID}/conversations?fields=id,updated_time,participants,messages.limit(10){id,message,from,created_time}&access_token=${PAGE_TOKEN}&limit=50`;

  while (url) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        allConvs = allConvs.concat(data.data);
      }
      url = data.paging?.next || null;
    } catch (e) {
      console.error("Error fetching convs:", e.message);
      break;
    }
  }

  return allConvs;
}

async function main() {
  console.log("Fetching all Facebook conversations for Page:", PAGE_ID);
  const convs = await getAllConversations();
  console.log(`Total conversations found: ${convs.length}`);

  const unreplied = [];

  for (const conv of convs) {
    const msgs = conv.messages?.data || [];
    if (msgs.length === 0) continue;

    // The messages in Graph API are returned newest first: msgs[0] is latest
    const latestMsg = msgs[0];
    const isFromCustomer = latestMsg.from?.id && String(latestMsg.from.id) !== String(PAGE_ID);

    if (isFromCustomer) {
      // Find customer participant
      const customerPart = conv.participants?.data?.find(p => String(p.id) !== String(PAGE_ID)) || latestMsg.from;
      
      // Collect consecutive customer messages at the top
      const customerMsgs = [];
      for (const m of msgs) {
        if (m.from?.id && String(m.from.id) !== String(PAGE_ID)) {
          customerMsgs.push(m);
        } else {
          break; // hit bot or agent reply
        }
      }

      unreplied.push({
        convId: conv.id,
        customerId: customerPart?.id || latestMsg.from?.id,
        customerName: customerPart?.name || latestMsg.from?.name || "Customer",
        lastMessage: latestMsg.message,
        lastMessageTime: latestMsg.created_time,
        batchCount: customerMsgs.length,
        batchTexts: customerMsgs.map(m => m.message).filter(Boolean)
      });
    }
  }

  console.log(`\n========================================`);
  console.log(`Found ${unreplied.length} UNREPLIED conversation(s):`);
  console.log(`========================================\n`);

  for (let i = 0; i < unreplied.length; i++) {
    const u = unreplied[i];
    console.log(`${i + 1}. [${u.customerName}] (ID: ${u.customerId})`);
    console.log(`   Time: ${u.lastMessageTime}`);
    console.log(`   Unreplied message(s): ${JSON.stringify(u.batchTexts)}`);
    console.log(`----------------------------------------`);
  }
}

main();
