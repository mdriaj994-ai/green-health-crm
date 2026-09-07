import fs from "fs";
import path from "path";

const VOICE_USERS_FILE = path.join(process.cwd(), "data", "voice_users.json");
const voiceUsers = new Set<string>();

// Preload from disk
try {
  if (fs.existsSync(VOICE_USERS_FILE)) {
    const list = JSON.parse(fs.readFileSync(VOICE_USERS_FILE, "utf-8"));
    if (Array.isArray(list)) {
      for (const id of list) voiceUsers.add(String(id));
    }
  }
} catch {}

function persistVoiceUsers() {
  try {
    const dir = path.dirname(VOICE_USERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(VOICE_USERS_FILE, JSON.stringify(Array.from(voiceUsers)), "utf-8");
  } catch {}
}

export function isVoiceMode(userId: string): boolean {
  if (!userId) return false;
  return voiceUsers.has(String(userId));
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
}

export function isOnlyVoiceRequest(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase();
  return (
    /^(voice|boyes|boes|voyes|ভয়েস|ভয়েস|অডিও|audio)(\s*(dao|den|din|pathan|koro|koren|bolo|bolen|দাও|দেন|দিন|পাঠান|করুন|বলো|বলেন))?$/i.test(clean) ||
    /^(vai|bhai|vaiya|bhaiya)?\s*(voice|boyes|boes|voyes|ভয়েস|ভয়েস|মুখে)\s*(dao|den|din|pathan|bolo|bolen|দাও|দেন|দিন|পাঠান|বলুন|বলো|বলেন)?$/i.test(clean) ||
    /^(voice\s*dao|voice\s*den|voice\s*din|ভয়েস\s*দাও|ভয়েস\s*দাও|ভয়েস\s*দেন|ভয়েস\s*দেন|ভয়েস\s*দিন|মুখে\s*বলুন|মুখে\s*বলো|কথা\s*বলুন)$/i.test(clean)
  );
}

export function isVoiceRequested(text: string): boolean {
  if (!text) return false;
  return /voice|boyes|boes|voyes|ভয়েস|ভয়েস|কথা বলুন|মুখে বলুন|মুখে বলেন|মুখে বলো|অডিও|audio/i.test(text);
}
