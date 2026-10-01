import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const execAsync = promisify(exec);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY || "sk_car_srvrWhgCX45k3QNo4XagpS";
const rawVoiceId = process.env.CARTESIA_VOICE_ID;
const CARTESIA_VOICE_ID = rawVoiceId || "bc625010-1d9d-4b70-99eb-74c262c65237";

// Gemini TTS voices: Aoede (female, warm), Charon (male, deep), Fenrir (male, strong), Kore (female, clear), Puck (male, upbeat)
const GEMINI_VOICE = process.env.GEMINI_TTS_VOICE || "Algieba"; // Smooth, lower pitch - perfect for customer support
const FALLBACK_VOICE = process.env.TTS_VOICE || "bn-BD-PradeepNeural"; // Edge-TTS fallback
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";


const BENGALI_WORDS_0_TO_99: string[] = [
  'শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ',
  'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'উনিশ', 'বিশ',
  'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আঠাশ', 'উনত্রিশ', 'ত্রিশ',
  'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁইত্রিশ', 'আটত্রিশ', 'উনচল্লিশ', 'চল্লিশ',
  'একচল্লিশ', 'বিয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'উনপঞ্চাশ', 'পঞ্চাশ',
  'একান্ন', 'বায়ান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'উনষাট', 'ষাট',
  'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পঁয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'উনসত্তর', 'সত্তর',
  'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'উনাশি', 'আশি',
  'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'অষ্টআশি', 'উননব্বই', 'নব্বই',
  'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই'
];

function numberToBengaliWords(n: number): string {
  if (n === 0) return 'শূন্য';
  if (n < 0) return 'মাইনাস ' + numberToBengaliWords(-n);
  let parts: string[] = [];
  if (n >= 10000000) {
    const crore = Math.floor(n / 10000000);
    parts.push(numberToBengaliWords(crore) + ' কোটি');
    n %= 10000000;
  }
  if (n >= 100000) {
    const lakh = Math.floor(n / 100000);
    parts.push(numberToBengaliWords(lakh) + ' লাখ');
    n %= 100000;
  }
  if (n >= 1000) {
    const thousand = Math.floor(n / 1000);
    parts.push(numberToBengaliWords(thousand) + ' হাজার');
    n %= 1000;
  }
  if (n >= 100) {
    const hundred = Math.floor(n / 100);
    parts.push(BENGALI_WORDS_0_TO_99[hundred] + 'শত');
    n %= 100;
  }
  if (n > 0) {
    parts.push(BENGALI_WORDS_0_TO_99[n]);
  }
  return parts.join(' ');
}

function convertBengaliNumbersToWords(text: string): string {
  if (!text) return '';
  let t = text;

  // 1. Phone numbers: 01XXXXXXXXX or ০১৮XXXXXXXX
  t = t.replace(/(?:\+?880|0)?1[3-9]\d{2}[-\s]?\d{6}/g, (match: string) => {
    const digits = match.replace(/\D/g, '');
    const digitWords = ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
    const clean = digits.length === 11 ? digits : ('0' + digits);
    const p1 = clean.slice(0, 5).split('').map((d: string) => digitWords[parseInt(d, 10)]).join(' ');
    const p2 = clean.slice(5).split('').map((d: string) => digitWords[parseInt(d, 10)]).join(' ');
    return p1 + ', ' + p2;
  });

  t = t.replace(/(?:০)?১[৩-৯][০-৯]{2}[-\s]?[০-৯]{6}/g, (match: string) => {
    const en = match.replace(/[০-৯]/g, (d: string) => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString()).replace(/\D/g, '');
    const digitWords = ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
    const clean = en.length === 11 ? en : ('0' + en);
    const p1 = clean.slice(0, 5).split('').map((d: string) => digitWords[parseInt(d, 10)]).join(' ');
    const p2 = clean.slice(5).split('').map((d: string) => digitWords[parseInt(d, 10)]).join(' ');
    return p1 + ', ' + p2;
  });

  // 2. Specific registration / license codes & years
  t = t.replace(/৫৮৪২\/২০১৮|5842\/2018/g, 'পাঁচ আট চার দুই, বাই, দুই হাজার আঠারো');
  t = t.replace(/৫৮৪২|5842/g, 'পাঁচ আট চার দুই');
  t = t.replace(/TRAD\/ALIKADAM\/0482\/2026/gi, 'ট্রেড লাইসেন্স শূন্য চার আট দুই, বাই, দুই হাজার ছাব্বিশ');
  t = t.replace(/০৪৮২|0482/g, 'শূন্য চার আট দুই');
  t = t.replace(/২০২৬|2026/g, 'দুই হাজার ছাব্বিশ');
  t = t.replace(/২০১৮|2018/g, 'দুই হাজার আঠারো');

  // 3. Ordinals (১ম, ২য়, ইত্যাদি)
  t = t.replace(/[১1]ম/g, 'প্রথম');
  t = t.replace(/[২2]য়/g, 'দ্বিতীয়');
  t = t.replace(/[৩3]য়/g, 'তৃতীয়');
  t = t.replace(/[৪4]র্থ/g, 'চতুর্থ');
  t = t.replace(/[৫5]ম/g, 'পঞ্চম');

  // 4. Remove commas in numbers like 2,000 or ২,০০০
  t = t.replace(/([০-৯0-9]),([০-৯0-9])/g, (match: string, p1: string, p2: string) => p1 + p2);

  // 5. Convert any number (Bengali or English digits) up to 8 digits to natural words
  t = t.replace(/[০-৯0-9]+/g, (match: string) => {
    const en = match.replace(/[০-৯]/g, (d: string) => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
    const num = parseInt(en, 10);
    if (!isNaN(num) && num >= 0 && num <= 99999999) {
      return numberToBengaliWords(num);
    }
    return match;
  });

  return t;
}

function prepareBangladeshiTTSAudioText(rawText: string): string {
  if (!rawText) return "";
  let t = rawText.replace(/[*#_~`>|]/g, "").replace(/\s+/g, " ").trim();
  t = t
    .replace(/\(\s*(?:বিকাশ\s*\/?\s*নগদ\s*)?হেল্পলাইন\s*[:=]?\s*([0-9০-৯\-]+)\s*\)/gi, "আমাদের হেল্পলাইন নম্বর $1, ")
    .replace(/\(\s*([0-9০-৯\-]{10,15})\s*\)/gi, "আমাদের হেল্পলাইন নম্বর $1, ")
    .replace(/হেল্পলাইন\s*[:=]/gi, "হেল্পলাইন নম্বর ")
    .replace(/[()]/g, ", ")
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

async function generateWithCartesiaTTS(text: string, filePath: string, voiceId: string = CARTESIA_VOICE_ID): Promise<boolean> {
  if (!CARTESIA_API_KEY) return false;
  try {
    const activeVoice = voiceId || CARTESIA_VOICE_ID;
    const cleanText = prepareBangladeshiTTSAudioText(text);
    console.log(`[CARTESIA_TTS] Generating audio with Voice ID: ${activeVoice} | Text: "${cleanText.slice(0, 60)}..."`);
    const url = "https://api.cartesia.ai/tts/bytes";

    let res = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-Key": CARTESIA_API_KEY,
        "Cartesia-Version": "2024-06-10",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model_id: "sonic-3.6",
        transcript: cleanText,
        voice: {
          mode: "id",
          id: activeVoice
        },
        output_format: {
          container: "mp3",
          bit_rate: 128000,
          sample_rate: 44100
        },
        language: "bn"
      })
    });

    if (!res.ok) {
      console.warn(`[CARTESIA_TTS_RETRY] Retrying with sonic-3.5`);
      res = await fetch(url, {
        method: "POST",
        headers: {
          "X-API-Key": CARTESIA_API_KEY,
          "Cartesia-Version": "2024-06-10",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model_id: "sonic-3.5",
          transcript: cleanText,
          voice: {
            mode: "id",
            id: activeVoice
          },
          output_format: {
            container: "mp3",
            bit_rate: 128000,
            sample_rate: 44100
          },
          language: "bn"
        })
      });
    }

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[CARTESIA_TTS_WARN] Status ${res.status}:`, err);
      return false;
    }

    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    console.log(`[CARTESIA_TTS_SUCCESS] Generated audio: ${path.basename(filePath)}`);
    return true;
  } catch (err: any) {
    console.warn("[CARTESIA_TTS_ERROR]", err.message);
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

    const selectedVoiceId = overrideVoice || CARTESIA_VOICE_ID;
    const cacheKey = cleanText + `_cartesia_${selectedVoiceId}`;
    const hash = crypto.createHash("md5").update(cacheKey).digest("hex");
    const filename = `tts_${hash}.mp3`;
    const filePath = path.join(audioDir, filename);

    // Generate audio if not cached
    if (!fs.existsSync(filePath)) {
      // 1. Try Cartesia TTS first (Sonic 3.6, ultra fast, natural Bengali)
      let generated = await generateWithCartesiaTTS(cleanText, filePath, selectedVoiceId);

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
