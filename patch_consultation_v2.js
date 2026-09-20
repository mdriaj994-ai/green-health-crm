// patch_consultation_v2.js — replaces the unicode-escaped consultation block with clean Bengali regex
const fs = require('fs');
const path = require('path');

const botFile = path.join(__dirname, 'scripts', 'fb_realtime_bot.js');
let code = fs.readFileSync(botFile, 'utf-8');

// Check if old UNICODE block is there
const OLD_MARKER = '  // ── CLINICAL CONSULTATION FLOW INTERCEPTOR ────────────────────────────────';
const OLD_END_MARKER = '  // 8. Price and Order advance rule';

if (!code.includes(OLD_MARKER)) {
  console.log('ERROR: Marker not found!');
  process.exit(1);
}

const startIdx = code.indexOf(OLD_MARKER);
const endIdx = code.indexOf(OLD_END_MARKER, startIdx);
if (endIdx === -1) {
  console.log('ERROR: End marker not found!');
  process.exit(1);
}
const endOfBlock = endIdx + OLD_END_MARKER.length;

// Write the new clean block with actual Bengali characters
const newBlock = `  // ── CLINICAL CONSULTATION FLOW INTERCEPTOR ────────────────────────────────
  // When customer asks about product/price/symptoms/ordering
  // FIRST gather clinical facts (age, problems, blood group) BEFORE offering product.
  // Bypass: pure greetings, nagad/phone/address-only queries, certificate, catalog listing.
  const isConsultationBypass =
    /(?:নগদ|nagad)/i.test(trimmedClean) ||
    /(?:number|namber|নম্বর|নাম্বার|helpline|হেল্পলাইন)\s*(?:den|din|dao|দেন|দিন|দাও)/i.test(trimmedClean) ||
    /(?:বাসা|বাড়ি|ঠিকানা|চেম্বার|chamber|address)/i.test(trimmedClean) ||
    /(?:certificate|সনদ|license|লাইসেন্স)/i.test(trimmedClean) ||
    /(?:ki\s*ki|কি\s*কি|কী\s*কী)\s*(?:product|item|osudh|ওষুধ|আছে|paoya)/i.test(trimmedClean);

  const isConsultationTrigger =
    /(?:দাম|dam|কত|koto|price|প্রাইস|টাকা|taka)/i.test(trimmedClean) ||
    /(?:নিতে\s*চাই|নেব|নিব|order|অর্ডার|কিনতে|buy|পাঠান|পাঠিয়ে|কুরিয়ার|delivery|parcel)/i.test(trimmedClean) ||
    /(?:কাজ\s*করে|কাজ\s*কি|উপকার|কীভাবে\s*কাজ)/i.test(trimmedClean) ||
    /(?:সমস্যা|problem|দুর্বল|শক্তি|stamina|বীর্য|dhatu|ধাতু)/i.test(trimmedClean) ||
    /(?:দ্রুত|চিকিৎসা|ওষুধ|medicine|osudh|কস্তুরী|kosturi|kasturi)/i.test(trimmedClean) ||
    /(?:বয়স|boyos|age|\d{2,3}\s*(?:বছর|bochor|year))/i.test(trimmedClean) ||
    /(?:বিবাহিত|bibahito|married|অবিবাহিত|single|বিয়ে)/i.test(trimmedClean) ||
    /(?:রক্ত|blood|রক্তের\s*গ্রুপ|blood\s*group)/i.test(trimmedClean) ||
    /(?:ডায়াবেটিস|diabetes|প্রেশার|pressure|গ্যাস্ট্রিক|gastric)/i.test(trimmedClean) ||
    /(?:কতদিন|কত\s*মাস|how\s*long|duration)/i.test(trimmedClean) ||
    /(?:খাওয়ার\s*নিয়ম|সেবন|dosage|নিয়ম)/i.test(trimmedClean) ||
    /(?:উপাদান|ingredients)/i.test(trimmedClean);

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

  // 8. Price and Order advance rule`;

const before = code.slice(0, startIdx);
const after = code.slice(endOfBlock);
const patched = before + newBlock + after;

fs.writeFileSync(botFile, patched, 'utf-8');
console.log('SUCCESS: Clean Bengali regex consultation flow written!');
console.log('File size:', patched.length);

// Verify
const verify = fs.readFileSync(botFile, 'utf-8');
console.log('Verify isConsultationBypass:', verify.includes('isConsultationBypass'));
console.log('Verify Bengali দাম in regex:', verify.includes('দাম|dam'));
console.log('Verify getClinicalConsultationReply call:', verify.includes('getClinicalConsultationReply('));
