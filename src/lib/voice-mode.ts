import fs from "fs";
import path from "path";
import { getCustomerProfile, updateCustomerProfile } from "./customer-memory";

const VOICE_USERS_FILE = path.join(process.cwd(), "data", "voice_users.json");
const voiceUsers = new Set<string>();

// Preload from disk
function reloadFromDisk() {
  try {
    if (fs.existsSync(VOICE_USERS_FILE)) {
      const list = JSON.parse(fs.readFileSync(VOICE_USERS_FILE, "utf-8"));
      if (Array.isArray(list)) {
        for (const id of list) voiceUsers.add(String(id));
      }
    }
  } catch {}
}
reloadFromDisk();

function persistVoiceUsers() {
  try {
    const dir = path.dirname(VOICE_USERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(VOICE_USERS_FILE, JSON.stringify(Array.from(voiceUsers)), "utf-8");
  } catch {}
}

export function isVoiceMode(userId: string): boolean {
  if (!userId) return false;
  const idStr = String(userId);

  // 1. In-memory Set check
  if (voiceUsers.has(idStr)) return true;

  // 2. Multi-process disk sync
  reloadFromDisk();
  if (voiceUsers.has(idStr)) return true;

  // 3. Permanent customer profile check
  try {
    const prof = getCustomerProfile(idStr);
    if (prof && prof.prefersVoice) {
      voiceUsers.add(idStr);
      return true;
    }
  } catch {}

  return false;
}

export function setVoiceMode(userId: string, enabled: boolean = true) {
  if (!userId) return;
  const idStr = String(userId);
  if (enabled) {
    voiceUsers.add(idStr);
  } else {
    voiceUsers.delete(idStr);
  }
  persistVoiceUsers();

  // Save to customer memory profile as well
  try {
    updateCustomerProfile(idStr, { prefersVoice: enabled });
  } catch {}
}

export function isOnlyVoiceRequest(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase();
  return (
    /^(voice|boyes|boes|voyes|ভয়েস|ভয়েস|বয়েজ|বয়েজ|বয়েস|বয়েস|অডিও|audio)(\s*(dao|den|din|pathan|koro|koren|bolo|bolen|দাও|দেন|দিন|পাঠান|করুন|বলো|বলেন))?$/i.test(clean) ||
    /^(vai|bhai|vaiya|bhaiya)?\s*(voice|boyes|boes|voyes|ভয়েস|ভয়েস|বয়েজ|বয়েজ|বয়েস|বয়েস|মুখে)\s*(dao|den|din|pathan|bolo|bolen|দাও|দেন|দিন|পাঠান|বলুন|বলো|বলেন)?$/i.test(clean) ||
    /^(voice\s*dao|voice\s*den|voice\s*din|ভয়েস\s*দাও|ভয়েস\s*দাও|ভয়েস\s*দেন|ভয়েস\s*দেন|ভয়েস\s*দিন|বয়েজ\s*দাও|বয়েজ\s*দেন|বয়েজ\s*দিন|মুখে\s*বলুন|মুখে\s*বলো|কথা\s*বলুন)$/i.test(clean) ||
    /(porte\s*pari\s*na|পড়তে\s*পারি\s*না|পড়তে\s*পারিনা|পড়তে\s*পারি\s*না|ভয়েসে\s*বলুন|ভয়েসে\s*বলুন|voice\s*a\s*bolte|voice\s*e\s*bolen|ভয়েসে\s*কথা\s*বলুন)/i.test(clean)
  );
}

export function isVoiceRequested(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase();

  // Negative intent: customer wants to STOP voice or doesn't want voice
  if (
    /(?:voice|voyes|ভয়েস|ভয়েস|ভয়েজ|ভয়েজ).*(?:dio\s*na|diyo\s*na|lagbe\s*na|bondho|off|চাই\s*না|দিবেন\s*না|দিও\s*না|লাগবে\s*না|বন্ধ|off\s*koro)/i.test(clean) ||
    /(?:dio\s*na|lagbe\s*na|না\s*দিয়ে|না\s*দিয়ে).*(?:voice|voyes|ভয়েস|ভয়েস|ভয়েজ|ভয়েজ)/i.test(clean)
  ) {
    return false;
  }

  return (
    /voice|voyes|ভয়েস|ভয়েস|ভয়েজ|ভয়েজ|কথা বলুন|মুখে বলুন|মুখে বলেন|মুখে বলো|অডিও|audio/i.test(clean) ||
    /(?:shunte|sunte|shunbo|sunbo)\s*chai/i.test(clean) ||
    /(?:shunte|sunte)\s*parbo/i.test(clean) ||
    /মুখে\s*(?:শুনতে|শুনব|বলুন|বলেন)/i.test(clean)
  );
}

export function isTextModeRequested(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase();
  return (
    // Explicit text / txt / sms / message requests
    /\b(text|txt|sms|msg|message)\b.*(dao|den|din|bolen|bolun|bolo|pathan|pathao|koro|koren|দাও|দেন|দিন|বলেন|বলুন|পাঠান|পাঠাও)/i.test(clean) ||
    /(টেক্সট|টেক্সটে|মেসেজ|মেসেজে?|এসএমএস)\s*(দাও|দেন|দিন|বলেন|বলুন|বলো|পাঠান|পাঠাও|করুন|লিখুন|করো)/i.test(clean) ||
    /^(text|txt|sms|মেসেজ|message|text koro|text dao|text den)$/i.test(clean) ||
    // Negative voice expressions ("voice dio na", "voice lagbe na", "voice bondho koro", "ভয়েস বন্ধ", etc.)
    /(?:voice|voyes|boyes|বয়েস|ভয়েস|ভয়েস)\s*(?:dio\s*na|diyo\s*na|lagbe\s*na|bondho|off|চাই\s*না|দিবেন\s*না|দিও\s*না|লাগবে\s*না|বন্ধ|off\s*koro|শুনতে\s*পারব\s*না|sunte\s*parbo\s*na|shunte\s*parbo\s*na)/i.test(clean) ||
    // "lekhe dao" / "lekehe dao" / "likhe dao" / "lekhe pathao" Banglish variations
    /(?:lekehe|lekhe|lekh[ea]|likhe|likh[ea]|leke|like)\s*(?:dao|den|din|patho|pathao|pathan|de|daw|dile|koro|koren|bolo|bolen|bolun)/i.test(clean) ||
    /^(?:lekehe|lekhe|likhe|leke)\s*(?:dao|den|din|bolen|bolun)$/i.test(clean) ||
    // Bengali variations ("লিখে দাও", "লেখে দাও", "লিখে পাঠান", etc.)
    /(লিখে|লেখে|লিখিয়া|লিখিয়ে)\s*(দাও|দেন|দিন|পাঠাও|পাঠান|বলুন|বলেন|বলো|করুন)/i.test(clean) ||
    /^(লিখে|লেখে|লিখুন|লেখা|লিখে দাও|লিখে দিন|লেখে দিন|লেখে দাও)$/i.test(clean)
  );
}

// ── Detect when customer is asking HOW TO ORDER or WHAT IS NEEDED for order ────
// When this returns true, ALWAYS send text (even in voice mode) so customer can
// read and copy the order form format. Voice explanation goes first, text second.
export function isOrderInfoRequest(text: string, replyText?: string): boolean {
  if (!text && !replyText) return false;
  const clean = (text || "").trim().toLowerCase();

  // 1. Customer asking how to order, what is needed, or placing order
  const customerAsked =
    /(ki\s*ki|কি\s*কি|কী\s*কী)\s*(lagbe|dite|দিতে|দরকার|পাঠাতে)/i.test(clean) ||
    /(order|অর্ডার)\s*.*(kivabe|ki\s*vabe|kiভাবে|কিভাবে|কীভাবে|korbo|করব|করবো|debo|দেব|দিব|korte|করতে|chai|চাই)/i.test(clean) ||
    /(kivabe|ki\s*vabe|কিভাবে|কীভাবে)\s*.*(order|অর্ডার|kinbo|kini|কিনব|কিনবো|nibo|nebo|নেব|নেবো|pabo|পাব|পাবো|পাঠাব)/i.test(clean) ||
    /(order|অর্ডার)\s*(form|ফর্ম|format|ফরম্যাট|ki|কি|কী)/i.test(clean) ||
    /(nite|নিতে|pete|পেতে|kinte|কিনতে)\s*(chaile?|চাইলে|hole?|হলে)\s*(ki|কি|কী)/i.test(clean) ||
    /(nam|নাম|phone|ফোন|number|নম্বর|thikana|ঠিকানা).*(dite|দিতে|pathate|পাঠাতে)\s*(hobe|হবে)/i.test(clean) ||
    /order.*info|order.*detail|অর্ডার.*তথ্য|অর্ডার.*বিস্তারিত/i.test(clean);

  if (customerAsked) return true;

  // 2. The reply itself contains order instructions / asking for name, address, phone
  if (replyText) {
    const hasName = /নাম|name/i.test(replyText);
    const hasAddress = /ঠিকানা|address|জেলা|থানা/i.test(replyText);
    const hasPhone = /ফোন|নাম্বার|নম্বর|mobile|phone|number/i.test(replyText);
    const hasOrderWord = /অর্ডার|order|ডেলিভারি|কুরিয়ার|পার্সেল/i.test(replyText);
    if ((hasName && hasAddress && (hasPhone || hasOrderWord)) ||
        /অর্ডার\s*(করতে|কনফার্ম\s*করতে|দিতে)/i.test(replyText) ||
        /(?:নাম|ঠিকানা|নাম্বার|নম্বর)\s*[:=]/i.test(replyText)) {
      return true;
    }
  }

  return false;
}




export function isPhoneNumberRequest(text: string, replyText?: string): boolean {
  if (!text && !replyText) return false;
  const clean = (text || "").trim().toLowerCase();

  const askedForNumber =
    /(?:number|namber|numbor|nombor|নম্বর|নাম্বার|ফোন|মোবাইল|phone|mobile|হেল্পলাইন|helpline|হটলাইন|hotline)\s*(?:den|din|dite|দাও|দেন|দিন|পাঠান|দিতে|কত|koto|plz|please|lagbe|হবে|চাই|পাব|হবে\s*কি)?/i.test(clean) ||
    /(?:kotha\s*bolbo|কথা\s*বলব|কথা\s*বলতে|যোগাযোগ|jogajog|call\s*korbo|কল\s*করব|কল\s*দিতে).*(?:number|নাম্বার|নম্বর|phone|ফোন|দিন|দেন|চাই|কিসে)/i.test(clean) ||
    /(?:bkash|নগদ|nagad|বিকাশ).*(?:number|নাম্বার|নম্বর|টাকা|পাঠাব)/i.test(clean) ||
    /(?:নাম্বার|নম্বর|phone|number)\s*(?:টা|টি)?\s*(?:দেন|দিন|দাও|বলেন|বলুন)/i.test(clean);

  if (askedForNumber) return true;

  if (replyText && /(?:01870-023804|01870023804|শূন্য\s*এক\s*আট\s*সাত)/i.test(replyText)) {
    if (/(?:number|নাম্বার|নম্বর|phone|ফোন|call|কল|কথা|যোগাযোগ|বিকাশ|নগদ)/i.test(clean)) {
      return true;
    }
  }

  return false;
}
