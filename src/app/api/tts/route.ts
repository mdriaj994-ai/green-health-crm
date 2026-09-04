import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const execAsync = promisify(exec);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
// Gemini TTS voices: Aoede (female, warm), Charon (male, deep), Fenrir (male, strong), Kore (female, clear), Puck (male, upbeat)
const GEMINI_VOICE = process.env.GEMINI_TTS_VOICE || "Algieba"; // Smooth, lower pitch - perfect for customer support
const FALLBACK_VOICE = process.env.TTS_VOICE || "bn-BD-PradeepNeural"; // Edge-TTS fallback
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";


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

    const cacheKey = cleanText + `_gemini_${GEMINI_VOICE}`;
    const hash = crypto.createHash("md5").update(cacheKey).digest("hex");
    const filename = `tts_${hash}.mp3`;
    const filePath = path.join(audioDir, filename);

    // Generate audio if not cached
    if (!fs.existsSync(filePath)) {
      // 1. Try Gemini TTS first (best quality, multilingual)
      let generated = await generateWithGeminiTTS(cleanText, filePath);

      // 2. Fallback to Microsoft Edge-TTS (Pradeep - native Bangladeshi)
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
