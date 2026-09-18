import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const execAsync = promisify(exec);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "sk_b704126ae6ecca01f041a6505e4e7a695f40df803a4f8bd3";
const rawVoiceId = process.env.ELEVENLABS_VOICE_ID;
const ELEVENLABS_VOICE_ID = (rawVoiceId && rawVoiceId !== "2RikWi4odb2uhZQb9waV" && rawVoiceId !== "UvaBYZVczBD1eq5jTquX" && rawVoiceId !== "FhOnCtjmaAIRIS1Dg2bk" && rawVoiceId !== "TX3LPaxmHKxFdv7VOQHJ") ? rawVoiceId : "nsJQzXf7dXyDnOFqO3uX";

// Gemini TTS voices: Aoede (female, warm), Charon (male, deep), Fenrir (male, strong), Kore (female, clear), Puck (male, upbeat)
const GEMINI_VOICE = process.env.GEMINI_TTS_VOICE || "Algieba"; // Smooth, lower pitch - perfect for customer support
const FALLBACK_VOICE = process.env.TTS_VOICE || "bn-BD-PradeepNeural"; // Edge-TTS fallback
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";


const BENGALI_WORDS_1_TO_100 = {
  0: 'শূন্য', 1: 'এক', 2: 'দুই', 3: 'তিন', 4: 'চার', 5: 'পাঁচ', 6: 'ছয়', 7: 'সাত', 8: 'আট', 9: 'নয়', 10: 'দশ',
  11: 'এগারো', 12: 'বারো', 13: 'তেরো', 14: 'চৌদ্দ', 15: 'পনেরো', 16: 'ষোলো', 17: 'সতেরো', 18: 'আঠারো', 19: 'উনিশ', 20: 'বিশ',
  21: 'একুশ', 22: 'বাইশ', 23: 'তেইশ', 24: 'চব্বিশ', 25: 'পঁচিশ', 26: 'ছাব্বিশ', 27: 'সাতাশ', 28: 'আঠাশ', 29: 'উনত্রিশ', 30: 'ত্রিশ',
  31: 'একত্রিশ', 32: 'বত্রিশ', 33: 'তেত্রিশ', 34: 'চৌত্রিশ', 35: 'পঁয়ত্রিশ', 36: 'ছত্রিশ', 37: 'সাঁইত্রিশ', 38: 'আটত্রিশ', 39: 'উনচল্লিশ', 40: 'চল্লিশ',
  41: 'একচল্লিশ', 42: 'বিয়াল্লিশ', 43: 'তেতাল্লিশ', 44: 'চুয়াল্লিশ', 45: 'পঁয়তাল্লিশ', 46: 'ছেচল্লিশ', 47: 'সাতচল্লিশ', 48: 'আটচল্লিশ', 49: 'উনপঞ্চাশ', 50: 'পঞ্চাশ',
  51: 'একান্ন', 52: 'বায়ান্ন', 53: 'তিপ্পান্ন', 54: 'চুয়ান্ন', 55: 'পঞ্চান্ন', 56: 'ছাপ্পান্ন', 57: 'সাতান্ন', 58: 'আটান্ন', 59: 'উনষাট', 60: 'ষাট',
  61: 'একষট্টি', 62: 'বাষট্টি', 63: 'তেষট্টি', 64: 'চৌষট্টি', 65: 'পঁয়ষট্টি', 66: 'ছেষট্টি', 67: 'সাতষট্টি', 68: 'আটষট্টি', 69: 'উনসত্তর', 70: 'সত্তর',
  71: 'একাত্তর', 72: 'বাহাত্তর', 73: 'তিয়াত্তর', 74: 'চুয়াত্তর', 75: 'পঁচাত্তর', 76: 'ছিয়াত্তর', 77: 'সাতাত্তর', 78: 'আটাত্তর', 79: 'উনাশি', 80: 'আশি',
  81: 'একাশি', 82: 'বিরাশি', 83: 'তিরাশি', 84: 'চুরাশি', 85: 'পঁচাশি', 86: 'ছিয়াশি', 87: 'সাতাশি', 88: 'অষ্টআশি', 89: 'উননব্বই', 90: 'নব্বই',
  91: 'একানব্বই', 92: 'বিরানব্বই', 93: 'তিরানব্বই', 94: 'চুরানব্বই', 95: 'পঁচানব্বই', 96: 'ছিয়ানব্বই', 97: 'সাতানব্বই', 98: 'আটানব্বই', 99: 'নিরানব্বই', 100: 'একশত'
};

function convertBengaliNumbersToWords(text) {
  if (!text) return '';
  let t = text;

  // 1. Phone numbers: 01XXXXXXXXX or ০১৮XXXXXXXX
  t = t.replace(/(?:\+?880|0)?1[3-9]\d{2}[-\s]?\d{6}/g, (match) => {
    const digits = match.replace(/\D/g, '');
    const digitWords = ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
    const clean = digits.length === 11 ? digits : ('0' + digits);
    const p1 = clean.slice(0, 5).split('').map(d => digitWords[parseInt(d, 10)]).join(' ');
    const p2 = clean.slice(5).split('').map(d => digitWords[parseInt(d, 10)]).join(' ');
    return p1 + ', ' + p2;
  });

  t = t.replace(/(?:০)?১[৩-৯][০-৯]{2}[-\s]?[০-৯]{6}/g, (match) => {
    const en = match.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)).replace(/\D/g, '');
    const digitWords = ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
    const clean = en.length === 11 ? en : ('0' + en);
    const p1 = clean.slice(0, 5).split('').map(d => digitWords[parseInt(d, 10)]).join(' ');
    const p2 = clean.slice(5).split('').map(d => digitWords[parseInt(d, 10)]).join(' ');
    return p1 + ', ' + p2;
  });

  // 2. Specific registration / license codes & years
  t = t.replace(/৫৮৪২\/২০১৮|5842\/2018/g, 'পাঁচ আট চার দুই, বাই, দুই হাজার আঠারো');
  t = t.replace(/৫৮৪২|5842/g, 'পাঁচ আট চার দুই');
  t = t.replace(/TRAD\/ALIKADAM\/0482\/2026/gi, 'ট্রেড লাইসেন্স শূন্য চার আট দুই, বাই, দুই হাজার ছাব্বিশ');
  t = t.replace(/০৪৮২|0482/g, 'শূন্য চার আট দুই');
  t = t.replace(/২০২৬|2026/g, 'দুই হাজার ছাব্বিশ');
  t = t.replace(/২০১৮|2018/g, 'দুই হাজার আঠারো');

  // 3. Ordinals (১ম, ২য়, ৩য়, ইত্যাদি)
  t = t.replace(/[১1]ম/g, 'প্রথম');
  t = t.replace(/[২2]য়/g, 'দ্বিতীয়');
  t = t.replace(/[৩3]য়/g, 'তৃতীয়');
  t = t.replace(/[৪4]র্থ/g, 'চতুর্থ');
  t = t.replace(/[৫5]ম/g, 'পঞ্চম');

  // 4. Large amounts & common prices
  t = t.replace(/[২2][,.]?[৮8][০0][০0]/g, 'দুই হাজার আটশত');
  t = t.replace(/[২2][,.]?[৩3][০0][০0]/g, 'দুই হাজার তিনশত');
  t = t.replace(/[২2][,.]?[৯9][০0][০0]/g, 'দুই হাজার নয়শত');
  t = t.replace(/[৩3][,.]?[৫5][০0][০0]/g, 'তিন হাজার পাঁচশত');
  t = t.replace(/[৩3][,.]?[০0][০0][০0]/g, 'তিন হাজার');
  t = t.replace(/[৪4][,.]?[৫5][০0][০0]/g, 'চার হাজার পাঁচশত');
  t = t.replace(/[১1][,.]?[৫5][০0][০0]/g, 'এক হাজার পাঁচশত');
  t = t.replace(/[১1][,.]?[০0][০0][০0]/g, 'এক হাজার');
  t = t.replace(/[৫5][০0][০0]/g, 'পাঁচশত');
  t = t.replace(/[২2][৫5][০0]/g, 'দুইশত পঞ্চাশ');
  t = t.replace(/[২2][০0][০0]/g, 'দুইশত');
  t = t.replace(/[১1][৫5][০0]/g, 'একশত পঞ্চাশ');
  t = t.replace(/[১1][২2][০0]/g, 'একশত বিশ');
  t = t.replace(/[১1][০0][০0]/g, 'একশত');

  // 5. Bullet lists (১), ২), ৩) or ১., ২., ৩. or 1), 2) etc.)
  t = t.replace(/(?:^|\n)\s*(?:[১1][\)\.\-:]|\([১1]\))\s*/g, '\nএক, ');
  t = t.replace(/(?:^|\n)\s*(?:[২2][\)\.\-:]|\([২2]\))\s*/g, '\nদুই, ');
  t = t.replace(/(?:^|\n)\s*(?:[৩3][\)\.\-:]|\([৩3]\))\s*/g, '\nতিন, ');
  t = t.replace(/(?:^|\n)\s*(?:[৪4][\)\.\-:]|\([৪4]\))\s*/g, '\nচার, ');
  t = t.replace(/(?:^|\n)\s*(?:[৫5][\)\.\-:]|\([৫5]\))\s*/g, '\nপাঁচ, ');
  t = t.replace(/(?:^|\n)\s*(?:[৬6][\)\.\-:]|\([৬6]\))\s*/g, '\nছয়, ');
  t = t.replace(/(?:^|\n)\s*(?:[৭7][\)\.\-:]|\([৭7]\))\s*/g, '\nসাত, ');
  t = t.replace(/(?:^|\n)\s*(?:[৮8][\)\.\-:]|\([৮8]\))\s*/g, '\nআট, ');
  t = t.replace(/(?:^|\n)\s*(?:[৯9][\)\.\-:]|\([৯9]\))\s*/g, '\nনয়, ');
  t = t.replace(/(?:^|\n)\s*(?:(?:১০|10)[\)\.\-:]|\((?:১০|10)\))\s*/g, '\nদশ, ');

  t = t.replace(/\b(?:[১1][\)\.]|\([১1]\))\s*/g, 'এক, ');
  t = t.replace(/\b(?:[২2][\)\.]|\([২2]\))\s*/g, 'দুই, ');
  t = t.replace(/\b(?:[৩3][\)\.]|\([৩3]\))\s*/g, 'তিন, ');
  t = t.replace(/\b(?:[৪4][\)\.]|\([৪4]\))\s*/g, 'চার, ');
  t = t.replace(/\b(?:[৫5][\)\.]|\([৫5]\))\s*/g, 'পাঁচ, ');
  t = t.replace(/\b(?:[৬6][\)\.]|\([৬6]\))\s*/g, 'ছয়, ');

  // 6. Common phrases with numbers
  t = t.replace(/[৩3]\s*(?:থেকে|-)\s*[৫5]\s*দিন/g, 'তিন থেকে পাঁচ দিন');
  t = t.replace(/[১1]\s*(?:থেকে|-)\s*[২2]\s*দিন/g, 'এক থেকে দুই দিন');
  t = t.replace(/[২2]\s*(?:থেকে|-)\s*[৪4]\s*দিন/g, 'দুই থেকে চার দিন');
  t = t.replace(/[১1]\s*মাস/g, 'এক মাস');
  t = t.replace(/[১1]\s*চামচ/g, 'এক চামচ');
  t = t.replace(/[৬6]\s*টি/g, 'ছয়টি');
  t = t.replace(/[১1]\s*টি/g, 'একটি');
  t = t.replace(/[২2]\s*টি/g, 'দুটি');
  t = t.replace(/[৩3]\s*টি/g, 'তিনটি');
  t = t.replace(/[৪4]\s*টি/g, 'চারটি');
  t = t.replace(/[৫5]\s*টি/g, 'পাঁচটি');
  t = t.replace(/[১1][০0]\s*টি/g, 'দশটি');

  // 7. Numbers 0-100 (both Bengali and English digits)
  t = t.replace(/[০-৯0-9]{1,3}/g, (match) => {
    const en = match.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
    const num = parseInt(en, 10);
    if (!isNaN(num) && BENGALI_WORDS_1_TO_100[num]) {
      return BENGALI_WORDS_1_TO_100[num];
    }
    return match;
  });

  // 8. Any remaining single digits
  const singleDigits = ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
  t = t.replace(/[০-৯]/g, d => singleDigits['০১২৩৪৫৬৭৮৯'.indexOf(d)] || d);
  t = t.replace(/[0-9]/g, d => singleDigits[parseInt(d, 10)] || d);

  return t;
}

function prepareBangladeshiTTSAudioText(rawText: string): string {
  if (!rawText) return "";
  let t = rawText.replace(/[*#_~`>|]/g, "").replace(/\s+/g, " ").trim();
  t = t
    .replace(/রেজাউল\s*করিম/gi, "রিয়াজুল করিম")
    .replace(/রেজাউল/gi, "রিয়াজুল")
    .replace(/re[aj]aul\s*karim/gi, "রিয়াজুল করিম")
    .replace(/re[aj]aul/gi, "রিয়াজুল")
    .replace(/\bদেবেন\b/g, "দিবেন")
    .replace(/\bনেবেন\b/g, "নিবেন")
    .replace(/\bচাচ্ছেন\b/g, "চান")
    .replace(/\bকরেছেন\b/g, "করছেন")
    .replace(/\bবলেছেন\b/g, "বলছেন")
    .replace(/\bখাবেন\b/g, "খাইবেন")
    .replace(/\bজল\b/g, "পানি")
    .replace(/\bদাদা\b/g, "ভাইয়া")
    .replace(/\bআপনাকে\b/g, "আপনাকে")
    .replace(/\bতাহলে\b/g, "তাহলে")
    .replace(/\bএখানে\b/g, "এইখানে")
    .replace(/\bসেখানে\b/g, "সেইখানে")
    .replace(/নাম\s*=/gi, "নাম, ")
    .replace(/জেলা\s*=/gi, "জেলা, ")
    .replace(/থানা\s*=/gi, "থানা, ")
    .replace(/রিসিভ ঠিকানা\s*=/gi, "রিসিভ ঠিকানা, ")
    .replace(/নাম্বার\s*=/gi, "মোবাইল নাম্বার, ")
    .replace(/=/g, " ")
    .replace(/২[,.]?৯০০|2[,.]?900/g, "দুই হাজার নয়শত");
  t = convertBengaliNumbersToWords(t);

  if (!/^(জি|আসসালামু|ওয়ালাইকুম|হ্যালো)/i.test(t)) {
    t = "জি ভাইয়া, " + t;
  }
  t = t
    .replace(/জি\s*ভাইয়া(?![,\s]*[,])/gi, "জি ভাইয়া, ")
    .replace(/রিয়াজুল\s*করিম\s*বলছি(?![,\s]*[,।])/gi, "রিয়াজুল করিম বলছি। ")
    .replace(/ইনশাআল্লাহ(?![,\s]*[,।])/gi, "ইনশাআল্লাহ। ")
    .replace(/আলহামদুলিল্লাহ(?![,\s]*[,।])/gi, "আলহামদুলিল্লাহ, ")
    .replace(/মাশাআল্লাহ(?![,\s]*[,।])/gi, "মাশাআল্লাহ, ")
    .replace(/আল্লাহর\s*রহমতে(?![,\s]*[,])/gi, "আল্লাহর রহমতে, ")
    .replace(/কোনো\s*চিন্তা\s*করবেন\s*না(?![,\s]*[,])/gi, "কোনো চিন্তা করবেন না ভাইয়া, ")
    .replace(/দেখুন(?![,\s]*[,])/gi, "দেখুন, ")
    .replace(/বুঝলেন(?![,\s]*[?।])/gi, "বুঝলেন ভাইয়া? ")
    .replace(/ঠিক\s*আছে(?![,\s]*[,।?])/gi, "ঠিক আছে, ")
    .replace(/\s+তাইলে\s+/g, ", তাইলে ")
    .replace(/\s+কিন্তু\s+/g, ", কিন্তু ")
    .replace(/\s+তবে\s+/g, ", তবে ")
    .replace(/,\s*,+/g, ",")
    .replace(/\.\s*\./g, ".")
    .replace(/\s+/g, " ")
    .trim();

  return t;
}

async function generateWithElevenLabsTTS(text: string, filePath: string, voiceId: string = ELEVENLABS_VOICE_ID): Promise<boolean> {
  if (!ELEVENLABS_API_KEY) return false;
  try {
    const activeVoice = voiceId || ELEVENLABS_VOICE_ID;
    const cleanText = prepareBangladeshiTTSAudioText(text);
    console.log(`[ELEVENLABS_TTS] Generating audio with Voice ID: ${activeVoice} | Text: "${cleanText.slice(0, 60)}..."`);
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${activeVoice}`;
    // Generation 1: My Bangla Voice 1 + Eleven v3 with stability 0.5
    const BD_VOICE_SETTINGS = {
      stability: 0.50
    };

    let res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: "eleven_v3",
        voice_settings: BD_VOICE_SETTINGS
      })
    });

    if (!res.ok) {
      console.warn(`[ELEVENLABS_TTS_RETRY] Retrying with eleven_turbo_v2_5`);
      res = await fetch(url, {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.50,
            similarity_boost: 0.90,
            style: 0.0,
            use_speaker_boost: true
          }
        })
      });
    }

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[ELEVENLABS_TTS_WARN] Status ${res.status}:`, err);
      return false;
    }

    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    console.log(`[ELEVENLABS_TTS_SUCCESS] Generated audio: ${path.basename(filePath)}`);
    return true;
  } catch (err: any) {
    console.warn("[ELEVENLABS_TTS_ERROR]", err.message);
    return false;
  }
}


async function uploadToFacebookAttachment(filePath: string): Promise<string | null> {
  try {
    const fileBlob = new Blob([fs.readFileSync(filePath)], { type: "audio/mp3" });
    const form = new globalThis.FormData();
    form.append("message", JSON.stringify({ attachment: { type: "audio", payload: { is_reusable: true } } }));
    form.append("filedata", fileBlob, "voice_reply.mp3");

    const res = await fetch(`https://graph.facebook.com/v19.0/me/message_attachments?access_token=${PAGE_TOKEN}`, {
      method: "POST",
      body: form
    });
    const data = await res.json();
    if (data.attachment_id) {
      console.log(`[FB_ATTACHMENT_UPLOAD_SUCCESS] Attachment ID: ${data.attachment_id}`);
      return data.attachment_id;
    }
    console.warn(`[FB_ATTACHMENT_UPLOAD_FAILED]`, data);
    return null;
  } catch (err: any) {
    console.warn("[FB_ATTACHMENT_UPLOAD_WARN]", err.message);
    return null;
  }
}

async function generateWithGeminiTTS(text: string, filePath: string): Promise<boolean> {
  if (!GEMINI_API_KEY) return false;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: GEMINI_VOICE }
              }
            }
          }
        })
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[GEMINI_TTS_WARN] Status ${res.status}: ${err}`);
      return false;
    }

    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts?.[0];

    if (!part?.inlineData?.data) {
      console.warn("[GEMINI_TTS_WARN] No audio data in response");
      return false;
    }

    // Save raw PCM (L16, 24000Hz, mono)
    const rawBuffer = Buffer.from(part.inlineData.data, "base64");
    const rawPath = filePath.replace(".mp3", ".pcm");
    fs.writeFileSync(rawPath, rawBuffer);

    // Convert PCM -> MP3 using ffmpeg
    await execAsync(`ffmpeg -y -f s16le -ar 24000 -ac 1 -i "${rawPath}" "${filePath}"`);

    // Cleanup raw PCM
    fs.unlinkSync(rawPath);

    console.log(`[GEMINI_TTS_SUCCESS] Generated audio: ${path.basename(filePath)}`);
    return true;
  } catch (err: any) {
    console.warn("[GEMINI_TTS_ERROR]", err.message);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = body.text;
    const overrideVoice = body.voice; // optional override

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // Clean text: remove markdown, zero-width chars, extra whitespace
    const cleanText = text
      .replace(/[\r\n\t]+/g, " ")
      .replace(/[*#_~`>|]/g, "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim();

    if (!cleanText) {
      return NextResponse.json({ error: "Empty text" }, { status: 400 });
    }

    const audioDir = path.join(process.cwd(), "public", "audio");
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    const selectedVoiceId = overrideVoice || ELEVENLABS_VOICE_ID;
    const cacheKey = cleanText + `_eleven_${selectedVoiceId}`;
    const hash = crypto.createHash("md5").update(cacheKey).digest("hex");
    const filename = `tts_${hash}.mp3`;
    const filePath = path.join(audioDir, filename);

    // Generate audio if not cached
    if (!fs.existsSync(filePath)) {
      // 1. Try ElevenLabs TTS first (Creator Plan, highest quality, Bangladeshi voice)
      let generated = await generateWithElevenLabsTTS(cleanText, filePath, selectedVoiceId);

      // 2. Fallback to Gemini TTS
      if (!generated) {
        generated = await generateWithGeminiTTS(cleanText, filePath);
      }

      // 3. Fallback to Microsoft Edge-TTS (Pradeep - native Bangladeshi)
      if (!generated) {
        console.log("[TTS_FALLBACK] Using Edge-TTS Pradeep voice");
        const voice = overrideVoice || FALLBACK_VOICE;
        const safeText = cleanText.replace(/"/g, "'").replace(/\\/g, "");
        await execAsync(`edge-tts --voice ${voice} --rate="+4%" --text "${safeText}" --write-media "${filePath}"`);
        console.log(`[EDGE_TTS_SUCCESS] Generated: ${filename}`);
      }
    } else {
      console.log(`[TTS_CACHE] Using cached: ${filename}`);
    }

    // Resolve public URL
    let baseUrl = process.env.PUBLIC_BASE_URL;
    if (!baseUrl || !baseUrl.startsWith("http")) {
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
      const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
      baseUrl = `${proto}://${host}`;
    }

    if (baseUrl.includes("localhost")) {
      baseUrl = "https://against-dressed-rugby-facial.trycloudflare.com";
    }

    const audioUrl = `${baseUrl}/audio/${filename}`;

    // Upload directly to Facebook message_attachments for instant 100% reliable sending
    const attachmentId = await uploadToFacebookAttachment(filePath);

    return NextResponse.json({
      success: true,
      audioUrl,
      attachmentId,
      relativeUrl: `/audio/${filename}`,
      filename,
      engine: "gemini-3.1-flash-tts"
    });
  } catch (error: any) {
    console.error("[TTS_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
