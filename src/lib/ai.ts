import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

// ── Runtime API key resolution (NOT cached at module load time) ──
function getGenAI(): GoogleGenerativeAI | null {
  const key = process.env.GEMINI_API_KEY || "";
  if (key && key !== "your-gemini-api-key-here") {
    return new GoogleGenerativeAI(key);
  }
  return null;
}

export interface AIContextOptions {
  businessName?: string;
  businessDetails?: string;
  language?: "bn" | "en" | "banglish";
  tone?: string;
  imageUrl?: string | null;
  chatHistory?: { sender: "CUSTOMER" | "AGENT"; text: string }[];
}

let cachedDefaultKB = "";
function getDefaultKnowledgeBase(): string {
  if (cachedDefaultKB) return cachedDefaultKB;
  try {
    const kbPath = path.join(process.cwd(), "scripts", "galaxy_knowledge_base.txt");
    if (fs.existsSync(kbPath)) {
      cachedDefaultKB = fs.readFileSync(kbPath, "utf-8");
      return cachedDefaultKB;
    }
  } catch {}
  return "আমরা Galaxy Laboratories (Unani)-এর পক্ষ থেকে প্রাকৃতিক ও নিরাপদ ইউনানি ঔষধ সরবরাহ করি। সারা বাংলাদেশে ক্যাশ অন ডেলিভারি সুবিধা আছে। ঢাকা সিটিতে ডেলিভারি চার্জ ৬০ টাকা, ঢাকার বাইরে ১২০ টাকা।";
}

function buildSystemInstruction(options: AIContextOptions): string {
  const tone = options.tone ?? "friendly";
  const toneGuide =
    tone === "professional"
      ? "Use formal, respectful language. Address as 'আপনি'."
      : tone === "casual"
      ? "Use casual, friendly language."
      : "Be warm, helpful, and natural in everyday Bengali.";

  const kb = options.businessDetails?.trim() || getDefaultKnowledgeBase();

  return `
You are a precise, friendly customer support assistant for "${options.businessName ?? "Galaxy Laboratories (Unani)"}" in Bangladesh.

${toneGuide}

CRITICAL INSTRUCTIONS — ANSWER ONLY WHAT THE CUSTOMER ASKS (STRICT ACCURACY):
1. If the customer sends an IMAGE or asks about a product in an image (e.g. image + "price koto", "kaj ki"):
   👉 Read the medicine name printed on the box/bottle (e.g. APPLE-G, ALKOGEN, PEPTO-G, GL TON, RHEUMAREX, etc.).
   👉 Answer the question directly in 1 complete sentence with that exact product's info.
   Example for Apple-G: "এটি অ্যাপেল-জি (Apple-G) সিরাপ, যা শারীরিক দুর্বলতা দূর করতে, রোগ প্রতিরোধ ক্ষমতা বৃদ্ধি এবং যকৃতের সুরক্ষায় অত্যন্ত কার্যকর। এর মূল্য ১০০ টাকা থেকে ৩৫০ টাকা।"

2. If the customer asks "aitar kaj ki", "aitar dam koto", "eita ki" WITHOUT an image and WITHOUT naming any medicine:
   👉 DO NOT guess an old medicine from past conversations! Politely ask: "অনুগ্রহ করে কাঙ্ক্ষিত ঔষধের নামটি বলুন অথবা ছবি পাঠান, আমি সঠিক তথ্য জানিয়ে দিচ্ছি।"

3. If the customer asks ONLY for price (e.g. "price koto", "dam koto", "কত দাম"):
   👉 Give ONLY the exact price of the named product in 1 short complete sentence.

4. If the customer asks ONLY how to take / dosage (e.g. "kivabe khabo", "খাওয়ার নিয়ম কি"):
   👉 Give ONLY the dosage / usage rule in 1 short complete sentence.

5. If the customer asks how to order / what is needed to order:
   👉 State: "অর্ডার করতে আপনার নাম, ডেলিভারি ঠিকানা ও মোবাইল নম্বর লিখে পাঠান। সারা বাংলাদেশে ক্যাশ অন ডেলিভারি সুবিধা আছে।"

RULES:
- Always finish your sentences completely. Never leave half-written sentences.
- Never dump unasked information.
- Do not use markdown asterisks (* or **). Use clean plain text.

Knowledge Base:
${kb}
`.trim();
}

const PRIMARY_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];

export async function generateAutoReply(
  incomingMessage: string,
  options: AIContextOptions = {}
): Promise<string> {
  const effectiveMessage = incomingMessage?.trim() || "এই ছবির প্রোডাক্ট সম্পর্কে বিস্তারিত ও দাম জানতে চাই।";
  const genAI = getGenAI();

  if (!genAI) {
    console.warn("[AI_AUTO_REPLY] GEMINI_API_KEY not set. Using smart Galaxy Laboratories fallback.");
    return generateFallbackReply(effectiveMessage, options.chatHistory, options.imageUrl);
  }

  // Try available models in order
  for (const modelName of PRIMARY_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: buildSystemInstruction(options),
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.1,
        },
      });

      // Handle Image Vision
      if (options.imageUrl) {
        try {
          console.log(`[AI_VISION] (${modelName}) Fetching image: ${options.imageUrl}`);
          const imgRes = await fetch(options.imageUrl, { signal: AbortSignal.timeout(4000) });
          const arrayBuffer = await imgRes.arrayBuffer();
          const base64Data = Buffer.from(arrayBuffer).toString("base64");
          const mimeType = imgRes.headers.get("content-type") || "image/jpeg";

          const imagePart = {
            inlineData: {
              data: base64Data,
              mimeType,
            },
          };

          const visionPrompt = `Read the medicine name printed on the box/bottle in the image (for example: APPLE-G, ALKOGEN, PEPTO-G, GL TON, RHEUMAREX, MOBIC, etc.). Match it with the exact product in Galaxy Laboratories knowledge base, and answer the customer's question: "${effectiveMessage}" in 1 complete, accurate Bengali sentence.`;
          const result = await model.generateContent([visionPrompt, imagePart]);
          const text = result.response.text();
          if (text && text.trim().length > 3) {
            return text.trim();
          }
        } catch (visErr: any) {
          console.error(`[AI_VISION_ERROR] with ${modelName}:`, visErr.message || visErr);
          continue;
        }
      }

      // Text Chat with History
      const historyParts: { role: "user" | "model"; parts: { text: string }[] }[] = [];

      if (options.chatHistory && options.chatHistory.length > 0) {
        const contextHistory = options.chatHistory.slice(-9, -1);
        const validHistory: typeof contextHistory = [];
        for (const h of contextHistory) {
          const lastRole = validHistory.length > 0 ? validHistory[validHistory.length - 1].sender : null;
          if (lastRole === null || lastRole !== h.sender) {
            validHistory.push(h);
          }
        }

        const startIdx = validHistory.findIndex((h) => h.sender === "CUSTOMER");
        const trimmedHistory = startIdx >= 0 ? validHistory.slice(startIdx) : [];

        for (const h of trimmedHistory) {
          historyParts.push({
            role: h.sender === "CUSTOMER" ? "user" : "model",
            parts: [{ text: h.text || "..." }],
          });
        }
      }

      const chat = model.startChat({ history: historyParts });
      const result = await chat.sendMessage(effectiveMessage);
      const reply = result.response.text();
      if (reply && reply.trim().length > 5) {
        return reply.trim();
      }
    } catch (error: any) {
      console.error(`[AI_GENERATE_ERROR] with ${modelName}:`, error.message || error);
    }
  }

  // Fallback if all models fail
  return generateFallbackReply(effectiveMessage, options.chatHistory, options.imageUrl);
}

// ── Smart Multi-Intent & Conversational Fallback ──

function generateFallbackReply(
  incomingMessage: string,
  history?: { sender: "CUSTOMER" | "AGENT"; text: string }[],
  hasImage?: string | null
): string {
  const lower = incomingMessage.toLowerCase().trim();
  const historyText = (history || []).map((h) => h.text.toLowerCase()).join(" ");

  // 1. Image recognition inquiry (ONLY if an image is actually attached)
  if (hasImage) {
    if (historyText.includes("apple") || historyText.includes("অ্যাপেল") || lower.includes("apple")) {
      return "এটি আমাদের 'Apple-G (অ্যাপেল জি)' সিরাপ। এটি সাধারণ দুর্বলতা দূর করতে, রোগ প্রতিরোধ ক্ষমতা বৃদ্ধি ও যকৃতের সুরক্ষায় অত্যন্ত কার্যকর। মূল্য: ১০০৳ থেকে ৩৫০৳।";
    }
    if (historyText.includes("alkogen") || historyText.includes("অ্যালকোজেন") || lower.includes("alkogen")) {
      return "এটি আমাদের 'Alkogen (অ্যালকোজেন)' সিরাপ। এটি প্রস্রাবের সমস্যা দূর করতে, জন্ডিস নিরাময়ে এবং কিডনির সুরক্ষায় কার্যকর। মূল্য: ৭০৳ থেকে ২০০৳।";
    }
    if (historyText.includes("pepto") || historyText.includes("পেপটো") || lower.includes("pepto")) {
      return "এটি আমাদের 'Pepto-G (পেপটো-জি)' সিরাপ। এটি পেটফাঁপা, বদহজম ও গ্যাসের সমস্যায় অত্যন্ত কার্যকর। মূল্য: ৭০৳ থেকে ২০০৳।";
    }
    if (historyText.includes("zymoliv") || historyText.includes("জাইমোলিভ") || lower.includes("zymoliv")) {
      return "এটি আমাদের 'Zymoliv (জাইমোলিভ)' সিরাপ। এটি লিভারের সুরক্ষা ও জন্ডিস নিরাময়ে অত্যন্ত কার্যকর। মূল্য: ৭০৳ থেকে ২০০৳।";
    }
    if (historyText.includes("rheumarex") || historyText.includes("রিউমারেক্স") || lower.includes("rheumarex")) {
      return "এটি আমাদের 'Rheumarex (রিউমারেক্স)' ক্যাপসুল। এটি বাত-বেদনা ও জয়েন্ট পেইনের জন্য অত্যন্ত ফলপ্রসূ। মূল্য: ৩০০৳ থেকে ৪৯০৳।";
    }
    return "ছবিতে থাকা ঔষধের সঠিক তথ্য ও দাম জানতে অনুগ্রহ করে মেসেজে পণ্যের নাম লিখুন, আমরা সাথে সাথে বিস্তারিত জানিয়ে দিচ্ছি।";
  }

  // 1.1 Pronoun question without image
  if (lower.includes("aitar") || lower.includes("eita") || lower.includes("এইটার") || lower.includes("এটার")) {
    return "অনুগ্রহ করে কাঙ্ক্ষিত ঔষধটির নাম বলুন অথবা ছবি পাঠান, আমি সঠিক তথ্য জানিয়ে দিচ্ছি।";
  }

  // 2. Order Details Inquiry
  if (
    lower.includes("ki ki") ||
    lower.includes("কী কী") ||
    lower.includes("কী দিতে হবে") ||
    lower.includes("কি দিতে হবে") ||
    lower.includes("dite hobe") ||
    lower.includes("lagbe") ||
    lower.includes("লাগবে") ||
    lower.includes("kivabe order") ||
    lower.includes("কিভাবে অর্ডার") ||
    lower.includes("kivabe nibo") ||
    lower.includes("কিভাবে নিব") ||
    lower.includes("kivabe pabo") ||
    lower.includes("কিভাবে পাব") ||
    lower.includes("nিয়ম") ||
    lower.includes("process")
  ) {
    return "অর্ডার করতে অনুগ্রহ করে আপনার:\n১. সম্পূর্ণ নাম\n২. সম্পূর্ণ ডেলিভারি ঠিকানা (জেলা, থানা/এলাকা সহ)\n৩. সচল মোবাইল নম্বর\nএখানে মেসেজে লিখে পাঠান। পণ্য হাতে পেয়ে মূল্য পরিশোধ করতে পারবেন।";
  }

  // 3. Side Effect & Safety Questions
  if (
    lower.includes("side effect") ||
    lower.includes("পার্শ্বপ্রতিক্রিয়া") ||
    lower.includes("ক্ষতি") ||
    lower.includes("khoti") ||
    lower.includes("safe") ||
    lower.includes("নিরাপদ") ||
    lower.includes("parsho")
  ) {
    return "আমাদের সকল ঔষধ ১০০% প্রাকৃতিক ভেষজ উপাদানে প্রস্তুতকৃত এবং বাংলাদেশ ইউনানি ফর্মুলারি অনুমোদিত। সঠিক নিয়মে সেবনে কোনো ক্ষতিকর পার্শ্বপ্রতিক্রিয়া নেই এবং এটি সম্পূর্ণ নিরাপদ।";
  }

  // 4. Authenticity
  if (
    lower.includes("asol") ||
    lower.includes("আসল") ||
    lower.includes("original") ||
    lower.includes("নকল") ||
    lower.includes("authentic")
  ) {
    return "আমরা সরাসরি Galaxy Laboratories (Unani)-এর প্রস্তুতকৃত ১০০% আসল ও গুণগত মানসম্পন্ন ঔষধ সরবরাহ করি। নিশ্চিত হয়ে অর্ডার করতে পারেন।";
  }

  // 5. Payment Methods
  if (
    lower.includes("payment") ||
    lower.includes("পেমেন্ট") ||
    lower.includes("টাকা") ||
    lower.includes("taka") ||
    lower.includes("bikash") ||
    lower.includes("বিকাশ") ||
    lower.includes("nagad") ||
    lower.includes("নগদ") ||
    lower.includes("advance") ||
    lower.includes("অগ্রিম")
  ) {
    return "আমাদের কোনো অগ্রিম টাকা দিতে হয় না! সারা বাংলাদেশে 'ক্যাশ অন ডেলিভারি' সুবিধা আছে — পার্সেল হাতে পেয়ে দেখে মূল্য পরিশোধ করবেন।";
  }

  // 6. Delivery Time
  if (
    lower.includes("kobe") ||
    lower.includes("কবে") ||
    lower.includes("kotodin") ||
    lower.includes("কতদিন") ||
    lower.includes("koto din") ||
    lower.includes("সময় লাগবে") ||
    lower.includes("delivery") ||
    lower.includes("ডেলিভারি") ||
    lower.includes("পৌঁছাবে") ||
    lower.includes("পাঠাবেন") ||
    lower.includes("চার্জ")
  ) {
    return "আমাদের ডেলিভারি চার্জ: ঢাকা সিটিতে ৬০ টাকা এবং ঢাকার বাইরে ১২০ টাকা। ঢাকায় ১-২ দিন এবং ঢাকার বাইরে ২-৩ কার্যদিবসের মধ্যে হোম ডেলিভারি পৌঁছে যাবে ইন শা আল্লাহ।";
  }

  // 7. Dosage / How to take
  if (
    lower.includes("kivabe khabo") ||
    lower.includes("কিভাবে খাব") ||
    lower.includes("খাওয়ার নিয়ম") ||
    lower.includes("সেবনবিধি") ||
    lower.includes("dosage") ||
    lower.includes("koybar") ||
    lower.includes("খাব")
  ) {
    if (historyText.includes("rheumarex") || historyText.includes("রিউমারেক্স") || lower.includes("rheumarex") || lower.includes("রিউমারেক্স")) {
      return "রিউমারেক্স (Rheumarex) ক্যাপসুল: ২ ক্যাপসুল করে দিনে ১-২ বার খাবারের পর সেব্য।";
    }
    if (historyText.includes("zymoliv") || historyText.includes("জাইমোলিভ") || lower.includes("zymoliv") || lower.includes("জাইমোলিভ")) {
      return "জাইমোলিভ (Zymoliv) সিরাপ: ২-৪ চা চামচ দৈনিক ২-৩ বার খাবারের পর সেব্য।";
    }
    if (historyText.includes("gl ton") || historyText.includes("জিএল") || lower.includes("gl ton") || lower.includes("জিএল")) {
      return "জিএল টন (GL Ton) সিরাপ: ২-৪ চা-চামচ (১০-২০ মিলি) দিনে ১-২ বার খাবারের পর সেব্য।";
    }
    return "সাধারণত সিরাপ জাতীয় ঔষধ ২-৪ চা চামচ দিনে ১-২ বার এবং ট্যাবলেট/ক্যাপসুল ১-২ টি করে দিনে ২ বার সেবন করতে হয়। আপনি কোন ঔষধের সেবনবিধি জানতে চান নাম বলুন।";
  }

  // 8. Order Intent
  if (
    lower.includes("order") ||
    lower.includes("অর্ডার") ||
    lower.includes("কিনতে") ||
    lower.includes("নিতে চাই") ||
    lower.includes("পাঠিয়ে দিন") ||
    lower.includes("পাঠান")
  ) {
    return "ধন্যবাদ! অর্ডার কনফার্ম করতে অনুগ্রহ করে আপনার:\n১. নাম\n২. সম্পূর্ণ ঠিকানা\n৩. মোবাইল নম্বর\nলিখে পাঠান। আমরা দ্রুত পার্সেল পাঠিয়ে দেব ইন শা আল্লাহ!";
  }

  // 9. Specific Products
  if (lower.includes("রিউমারেক্স") || lower.includes("rheumarex") || lower.includes("বাত") || lower.includes("জয়েন্ট")) {
    return "আমাদের 'Rheumarex (রিউমারেক্স)' ক্যাপসুল বাত-বেদনা, গেঁটেবাত ও জয়েন্টের ব্যথায় দ্রুত আরাম দেয়। মূল্য: ৩০০৳ থেকে ৪৯০৳। সেবনবিধি: ২ ক্যাপসুল করে দিনে ১-২ বার। অর্ডার করতে নাম ও ঠিকানা দিন।";
  }

  if (lower.includes("জাইমোলিভ") || lower.includes("zymoliv") || lower.includes("জন্ডিস") || lower.includes("রুচি")) {
    return "লিভারের সুরক্ষা, জন্ডিস ও ক্ষুধামন্দায় 'Zymoliv (জাইমোলিভ)' সিরাপ অত্যন্ত কার্যকর। মূল্য: ৭০৳ থেকে ২০০৳। সেবনবিধি: ২-৪ চা চামচ দৈনিক ২-৩ বার।";
  }

  if (lower.includes("জিএল টন") || lower.includes("gl ton") || lower.includes("হার্ট")) {
    return "আমাদের 'GL Ton (জিএল টন)' সিরাপ হার্টের সুরক্ষা ও রক্ত সঞ্চালন স্বাভাবিক রাখতে অত্যন্ত কার্যকর। মূল্য: ১০০৳ থেকে ৮৫০৳। সেবনবিধি: ২-৪ চামচ দিনে ১-২ বার।";
  }

  // 10. General Greetings / Default
  if (lower.includes("salam") || lower.includes("সালাম") || lower.includes("assalamu") || lower.includes("hi") || lower.includes("hello") || lower.includes("হ্যালো")) {
    return "আসসালামু আলাইকুম! Galaxy Laboratories (Unani)-এ আপনাকে স্বাগতম 🙂 আমাদের প্রাকৃতিক ও ইউনানি ঔষুধ সম্পর্কে কীভাবে সাহায্য করতে পারি?";
  }

  return "Galaxy Laboratories-এর যেকোনো ঔষধের দাম, সেবনবিধি জানতে বা অর্ডার করতে আপনার পছন্দের ঔষধের নাম অথবা শারীরিক সমস্যার কথা জানান, আমরা সাথে সাথে বিস্তারিত জানিয়ে দেব।";
}
