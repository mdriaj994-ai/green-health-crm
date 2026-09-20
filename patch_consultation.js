// patch_consultation.js — adds clinical consultation flow interceptor to fb_realtime_bot.js
const fs = require('fs');
const path = require('path');

const botFile = path.join(__dirname, 'scripts', 'fb_realtime_bot.js');
let code = fs.readFileSync(botFile, 'utf-8');

// Marker to find (start of the old BYPASSED comment block)
const MARKER = '  // ── KASTURI POWDER COMPREHENSIVE CLINICAL CONSULTATION';

if (!code.includes(MARKER)) {
  console.log('ERROR: Marker not found in file!');
  process.exit(1);
}

// Find the end of the BYPASSED comment block (the isPriceQuery comment line)
const startIdx = code.indexOf(MARKER);
const endMarker = '  // [BYPASSED FOR DYNAMIC AI DOCTOR REPLIES]: isPriceQuery';
const endIdx = code.indexOf(endMarker, startIdx);

if (endIdx === -1) {
  console.log('ERROR: End marker not found!');
  process.exit(1);
}

const endOfBlock = endIdx + endMarker.length;

const newBlock = `  // ── CLINICAL CONSULTATION FLOW INTERCEPTOR ────────────────────────────────
  // When customer asks about product/price/symptoms/ordering
  // FIRST gather clinical facts (age, problems, blood group) BEFORE offering product.
  // Bypass: pure greetings, nagad/phone/address-only queries, certificate, catalog listing.
  const isConsultationBypass =
    /(?:\\u09A8\\u0997\\u09A6|nagad)/i.test(trimmedClean) ||
    /(?:number|namber|\\u09A8\\u09AE\\u09CD\\u09AC\\u09B0|\\u09A8\\u09BE\\u09AE\\u09CD\\u09AC\\u09BE\\u09B0|helpline|\\u09B9\\u09C7\\u09B2\\u09CD\\u09AA\\u09B2\\u09BE\\u0987\\u09A8)\\s*(?:den|din|dao|\\u09A6\\u09C7\\u09A8|\\u09A6\\u09BF\\u09A8|\\u09A6\\u09BE\\u0993)/i.test(trimmedClean) ||
    /(?:\\u09AC\\u09BE\\u09B8\\u09BE|\\u09AC\\u09BE\\u09DC\\u09BF|\\u09A0\\u09BF\\u0995\\u09BE\\u09A8\\u09BE|\\u099A\\u09C7\\u09AE\\u09CD\\u09AC\\u09BE\\u09B0|chamber|address)/i.test(trimmedClean) ||
    /(?:certificate|\\u09B8\\u09A8\\u09A6|license|\\u09B2\\u09BE\\u0987\\u09B8\\u09C7\\u09A8\\u09CD\\u09B8)/i.test(trimmedClean) ||
    /(?:ki\\s*ki|\\u0995\\u09BF\\s*\\u0995\\u09BF|\\u0995\\u09C0\\s*\\u0995\\u09C0)\\s*(?:product|item|osudh|\\u0993\\u09B7\\u09C1\\u09A7|\\u0986\\u099B\\u09C7|paoya)/i.test(trimmedClean);

  const isConsultationTrigger =
    /(?:\\u09A6\\u09BE\\u09AE|dam|\\u0995\\u09A4|koto|price|\\u09AA\\u09CD\\u09B0\\u09BE\\u0987\\u09B8|\\u099F\\u09BE\\u0995\\u09BE|taka)/i.test(trimmedClean) ||
    /(?:\\u09A8\\u09BF\\u09A4\\u09C7\\s*\\u099A\\u09BE\\u0987|\\u09A8\\u09C7\\u09AC|\\u09A8\\u09BF\\u09AC|order|\\u0985\\u09B0\\u09CD\\u09A1\\u09BE\\u09B0|\\u0995\\u09BF\\u09A8\\u09A4\\u09C7|buy|\\u09AA\\u09BE\\u09A0\\u09BE\\u09A8|\\u09AA\\u09BE\\u09A0\\u09BF\\u09AF\\u09BC\\u09C7|\\u0995\\u09C1\\u09B0\\u09BF\\u09AF\\u09BC\\u09BE\\u09B0|delivery|parcel)/i.test(trimmedClean) ||
    /(?:\\u0995\\u09BE\\u099C\\s*\\u0995\\u09B0\\u09C7|\\u0995\\u09BE\\u099C\\s*\\u0995\\u09BF|\\u0989\\u09AA\\u0995\\u09BE\\u09B0|\\u0995\\u09C0\\u09AD\\u09BE\\u09AC\\u09C7\\s*\\u0995\\u09BE\\u099C)/i.test(trimmedClean) ||
    /(?:\\u09B8\\u09AE\\u09B8\\u09CD\\u09AF\\u09BE|problem|\\u09A6\\u09C1\\u09B0\\u09CD\\u09AC\\u09B2|\\u09B6\\u0995\\u09CD\\u09A4\\u09BF|stamina|\\u09AC\\u09C0\\u09B0\\u09CD\\u09AF|dhatu|\\u09A7\\u09BE\\u09A4\\u09C1)/i.test(trimmedClean) ||
    /(?:\\u09A6\\u09CD\\u09B0\\u09C1\\u09A4|\\u099A\\u09BF\\u0995\\u09BF\\u09CE\\u09B8\\u09BE|\\u0993\\u09B7\\u09C1\\u09A7|medicine|osudh|\\u0995\\u09B8\\u09CD\\u09A4\\u09C1\\u09B0\\u09C0|kosturi|kasturi)/i.test(trimmedClean) ||
    /(?:\\u09AC\\u09AF\\u09BC\\u09B8|boyos|age|\\d{2,3}\\s*(?:\\u09AC\\u099B\\u09B0|bochor|year))/i.test(trimmedClean) ||
    /(?:\\u09AC\\u09BF\\u09AC\\u09BE\\u09B9\\u09BF\\u09A4|bibahito|married|\\u0985\\u09AC\\u09BF\\u09AC\\u09BE\\u09B9\\u09BF\\u09A4|single|\\u09AC\\u09BF\\u09AF\\u09BC\\u09C7)/i.test(trimmedClean) ||
    /(?:\\u09B0\\u0995\\u09CD\\u09A4|blood|\\u09B0\\u0995\\u09CD\\u09A4\\u09C7\\u09B0\\s*\\u0997\\u09CD\\u09B0\\u09C1\\u09AA|blood\\s*group)/i.test(trimmedClean) ||
    /(?:\\u09A1\\u09BE\\u09AF\\u09BC\\u09BE\\u09AC\\u09C7\\u099F\\u09BF\\u09B8|diabetes|\\u09AA\\u09CD\\u09B0\\u09C7\\u09B6\\u09BE\\u09B0|pressure|\\u0997\\u09CD\\u09AF\\u09BE\\u09B8\\u09CD\\u099F\\u09CD\\u09B0\\u09BF\\u0995|gastric)/i.test(trimmedClean) ||
    /(?:\\u0995\\u09A4\\u09A6\\u09BF\\u09A8|\\u0995\\u09A4\\s*\\u09AE\\u09BE\\u09B8|how\\s*long|duration)/i.test(trimmedClean) ||
    /(?:\\u0996\\u09BE\\u0993\\u09AF\\u09BC\\u09BE\\u09B0\\s*\\u09A8\\u09BF\\u09AF\\u09BC\\u09AE|\\u09B8\\u09C7\\u09AC\\u09A8|dosage|\\u09A8\\u09BF\\u09AF\\u09BC\\u09AE)/i.test(trimmedClean) ||
    /(?:\\u0989\\u09AA\\u09BE\\u09A6\\u09BE\\u09A8|ingredients)/i.test(trimmedClean);

  if (!isConsultationBypass && isConsultationTrigger) {
    const consultReply = getClinicalConsultationReply(
      senderId || '',
      senderName || '',
      customerMessage,
      isVoiceMode
    );
    if (consultReply) {
      if (senderId) customerMemory.appendChatMessage(senderId, 'model', consultReply, isVoiceMode);
      console.log('[CONSULTATION_FLOW] Reply (' + consultReply.length + ' chars): "' + consultReply.slice(0, 60) + '..."');
      return consultReply;
    }
  }
  // ── END CLINICAL CONSULTATION FLOW ────────────────────────────────────────

  // 5. Why buy from us / Why trust / Certificate / Govt license
  // [BYPASSED FOR DYNAMIC AI DOCTOR REPLIES]: isWhyTrustUs

  // 6. Ingredients used
  // [BYPASSED FOR DYNAMIC AI DOCTOR REPLIES]: isIngredientsQuery

  // 7. How to consume / Dosage
  // [BYPASSED FOR DYNAMIC AI DOCTOR REPLIES]: isUsageRule

  // 8. Price and Order advance rule
  // [BYPASSED FOR DYNAMIC AI DOCTOR REPLIES]: isPriceQuery`;

const before = code.slice(0, startIdx);
const after = code.slice(endOfBlock);
const patched = before + newBlock + after;

fs.writeFileSync(botFile, patched, 'utf-8');
console.log('SUCCESS: Consultation flow interceptor added to fb_realtime_bot.js');
console.log('File size before:', code.length, '-> after:', patched.length);
