// scripts/reply_all_unanswered.js
// Fetches all past unreplied Facebook conversations and answers every single one
// using the Hakim Md. Abdul Karim Gemini AI persona + ElevenLabs voice where requested.

const {
  generateReply,
  sendFacebookMessage,
  sendFacebookVoiceNote,
  isVoiceMode,
  recordOutgoingBotMessageInDb,
  saveProcessedId
} = require("./fb_realtime_bot.js");

const PAGE_ID = process.env.FACEBOOK_PAGE_ID || "932259009980880";
const PAGE_TOKEN = "EAAjkLPT8UegBSsQVgxm1fBW6D7N7oon9ZAudS1UKVLVbBEar1BGEvZCLJ3ibSLO6FmILQDf6mq4rcsL98cpxuuRwAHSwUprKUBLv6ZBBCSjYAGUPTU1SQIRDvR74D5aIivRiDoUG3zobZB83AIwZA8mZAhoqcBDpjii2KsvQshwZCCIdUSJk5NaDb5JZCFGt4YWKBfEZC";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function replyAllUnanswered() {
  console.log("=================================================");
  console.log("  REPLYING TO ALL UNANSWERED FACEBOOK CUSTOMERS  ");
  console.log("=================================================");

  const convs = await getAllConversations();
  console.log(`Total conversations fetched: ${convs.length}`);

  const unrepliedList = [];

  for (const conv of convs) {
    const msgs = conv.messages?.data || [];
    if (msgs.length === 0) continue;

    const latestMsg = msgs[0];
    const isFromCustomer = latestMsg.from?.id && String(latestMsg.from.id) !== String(PAGE_ID);

    if (isFromCustomer) {
      const customerPart = conv.participants?.data?.find(p => String(p.id) !== String(PAGE_ID)) || latestMsg.from;
      const customerId = customerPart?.id || latestMsg.from?.id;
      const customerName = customerPart?.name || latestMsg.from?.name || "ভাইয়া";

      // Collect consecutive customer messages
      const batchMsgs = [];
      for (const m of msgs) {
        if (m.from?.id && String(m.from.id) !== String(PAGE_ID)) {
          batchMsgs.push(m);
        } else {
          break;
        }
      }

      // Reverse so oldest unreplied is first
      const chronological = [...batchMsgs].reverse();
      const combinedText = chronological.map(m => m.message).filter(Boolean).join("\n");

      // History of previous interactions for context
      const history = msgs.slice(batchMsgs.length).reverse().map(m => {
        const isBot = String(m.from?.id) === String(PAGE_ID);
        return `${isBot ? 'Bot' : 'Customer'}: ${m.message || ''}`;
      });

      unrepliedList.push({
        convId: conv.id,
        customerId,
        customerName,
        latestMsgId: latestMsg.id,
        allMsgIds: batchMsgs.map(m => m.id),
        messageText: combinedText || "আসসালামু আলাইকুম ভাইয়া",
        createdTime: latestMsg.created_time,
        history
      });
    }
  }

  console.log(`Found ${unrepliedList.length} unreplied conversation(s) to process.\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < unrepliedList.length; i++) {
    const item = unrepliedList[i];
    const { customerId, customerName, latestMsgId, messageText, allMsgIds, history, createdTime } = item;

    console.log(`[${i + 1}/${unrepliedList.length}] Processing ${customerName} (${customerId})...`);
    console.log(`   Time: ${createdTime}`);
    console.log(`   Customer Query: "${messageText.replace(/\n/g, ' ')}"`);

    try {
      // Generate authentic Hakim AI response
      const inVoice = isVoiceMode(customerId);
      const replyText = await generateReply(
        messageText,
        customerName,
        customerId,
        history,
        "হেলথ কেয়ার",
        inVoice
      );

      console.log(`   Generated Reply: "${replyText.slice(0, 80)}..."`);

      // Send text reply to Messenger
      const sendRes = await sendFacebookMessage(customerId, replyText, PAGE_TOKEN, latestMsgId);
      
      if (sendRes.status === 200) {
        successCount++;
        console.log(`   ✅ TEXT DELIVERED [200] (MsgId: ${sendRes.data?.message_id || 'OK'})`);
        
        // Record in SQLite DB for dashboard
        recordOutgoingBotMessageInDb(customerId, replyText, false);

        // If customer is in voice mode, also send doctor voice note
        if (inVoice) {
          try {
            console.log(`   🎙️ Sending doctor voice note companion...`);
            await sendFacebookVoiceNote(customerId, replyText, PAGE_TOKEN);
            recordOutgoingBotMessageInDb(customerId, replyText, true);
            console.log(`   🎙️ Voice note delivered successfully`);
          } catch (vErr) {
            console.warn(`   ⚠️ Voice note delivery warning:`, vErr.message);
          }
        }

        // Mark all batch message IDs as processed
        for (const mid of allMsgIds) {
          saveProcessedId(mid);
        }
      } else {
        failCount++;
        console.warn(`   ❌ FAILED to send [${sendRes.status}]:`, sendRes.data);
      }
    } catch (err) {
      failCount++;
      console.error(`   ❌ Error answering ${customerName}:`, err.message);
    }

    // 1.5s delay between customers to respect Facebook Graph API limits
    console.log(`-------------------------------------------------`);
    await sleep(1500);
  }

  console.log(`\n=================================================`);
  console.log(`  COMPLETED: ${successCount} replied successfully, ${failCount} failed.`);
  console.log(`=================================================`);
}

replyAllUnanswered();
