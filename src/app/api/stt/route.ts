import { NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { audioUrl, audioBase64, mimeType } = body;

    if (!audioUrl && !audioBase64) {
      return NextResponse.json({ error: "audioUrl or audioBase64 is required" }, { status: 400 });
    }

    let audioBuffer: Buffer;
    let fileName = "audio.mp4";

    if (audioBase64) {
      audioBuffer = Buffer.from(audioBase64, "base64");
    } else {
      const res = await fetch(audioUrl);
      if (!res.ok) {
        return NextResponse.json({ error: "Failed to download audio from url" }, { status: 400 });
      }
      const arrayBuf = await res.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuf);
      if (audioUrl.includes(".m4a")) fileName = "audio.m4a";
      else if (audioUrl.includes(".mp3")) fileName = "audio.mp3";
      else if (audioUrl.includes(".wav")) fileName = "audio.wav";
      else if (audioUrl.includes(".ogg")) fileName = "audio.ogg";
    }

    const type = mimeType || (fileName.endsWith(".mp3") ? "audio/mp3" : "audio/mp4");
    const fileBlob = new Blob([audioBuffer], { type });
    const form = new globalThis.FormData();
    form.append("file", fileBlob, fileName);
    form.append("model", "whisper-large-v3");
    form.append("language", "bn");
    form.append("prompt", "গ্রীন হেলথ ইউনানী ফার্মা বাংলাদেশ, ডাক্তার, ওষুধ, স্বাস্থ্য সমস্যা, দাম, ড্রিম টাচ, ব্ল্যাক জিনসেং");

    const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: form
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.warn("[STT_GROQ_ERROR]", groqRes.status, errText);
      return NextResponse.json({ error: "Transcription failed", details: errText }, { status: 500 });
    }

    const data = await groqRes.json();
    const transcribedText = (data.text || "").trim();

    console.log(`[STT_SUCCESS] Transcribed: "${transcribedText}"`);

    return NextResponse.json({
      success: true,
      text: transcribedText
    });
  } catch (err: any) {
    console.error("[STT_ERROR]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
