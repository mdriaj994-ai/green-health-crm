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
    .replace(/২[,.]?৯০০|2[,.]?900/g, "দুই হাজার নয়শত")
    .replace(/৩[,.]?৫০০|3[,.]?500/g, "তিন হাজার পাঁচশত")
    .replace(/৩[,.]?০০০|3[,.]?000/g, "তিন হাজার")
    .replace(/৪[,.]?৫০০|4[,.]?500/g, "চার হাজার পাঁচশত")
    .replace(/১[,.]?৫০০|1[,.]?500/g, "এক হাজার পাঁচশত")
    .replace(/১৫০|150/g, "একশত পঞ্চাশ")
    .replace(/১২০|120/g, "একশত বিশ")
    .replace(/১০০|100/g, "একশত");

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
