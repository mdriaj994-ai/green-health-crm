import fs from "fs";
import path from "path";

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
  if (voiceUsers.has(idStr)) return true;

  // Multi-process disk sync
  reloadFromDisk();
  if (voiceUsers.has(idStr)) return true;

  // Permanent customer profile check
  try {
    const { getCustomerProfile } = require("@/lib/customer-memory");
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
    const { updateCustomerProfile } = require("@/lib/customer-memory");
    updateCustomerProfile(idStr, { prefersVoice: enabled });
  } catch {}
}

export function isOnlyVoiceRequest(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase();
  return (
    /^(voice|boyes|boes|voyes|ভয়েস|ভয়েস|বয়েজ|বয়েজ|বয়েস|বয়েস|অডিও|audio)(\s*(dao|den|din|pathan|koro|koren|bolo|bolen|দাও|দেন|দিন|পাঠান|করুন|বলো|বলেন))?$/i.test(clean) ||
    /^(vai|bhai|vaiya|bhaiya)?\s*(voice|boyes|boes|voyes|ভয়েস|ভয়েস|বয়েজ|বয়েজ|বয়েস|বয়েস|মুখে)\s*(dao|den|din|pathan|bolo|bolen|দাও|দেন|দিন|পাঠান|বলুন|বলো|বলেন)?$/i.test(clean) ||
    /^(voice\s*dao|voice\s*den|voice\s*din|ভয়েস\s*দাও|ভয়েস\s*দাও|ভয়েস\s*দেন|ভয়েস\s*দেন|ভয়েস\s*দিন|বয়েজ\s*দাও|বয়েজ\s*দেন|বয়েজ\s*দিন|মুখে\s*বলুন|মুখে\s*বলো|কথা\s*বলুন)$/i.test(clean)
  );
}

export function isVoiceRequested(text: string): boolean {
  if (!text) return false;
  return /voice|boyes|boes|voyes|ভয়েস|ভয়েস|বয়েজ|বয়েজ|বয়েস|বয়েস|কথা বলুন|মুখে বলুন|মুখে বলেন|মুখে বলো|অডিও|audio/i.test(text);
}

export function isTextModeRequested(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase();
  return (
    /\b(text|txt)\b.*(dao|den|din|bolen|bolun|bolo|pathan|koro|koren|দাও|দেন|দিন|বলেন|বলুন|পাঠান)/i.test(clean) ||
    /(টেক্সট|টেক্সটে|মেসেজে?|লিখে|লেখা)\s*(দাও|দেন|দিন|বলেন|বলুন|বলো|পাঠান|করুন|লিখুন)/i.test(clean) ||
    /^(text|txt|লিখে|লিখুন|লেখা|মেসেজ|message)$/i.test(clean)
  );
}
