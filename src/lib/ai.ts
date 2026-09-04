import { GoogleGenerativeAI } from "@google/generative-ai";
import { MergedProduct, findProductInDB, buildProductAIContext } from "./product-db";
import fs from "fs";
import path from "path";

let genAIInstance: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAIInstance) {
    genAIInstance = new GoogleGenerativeAI(apiKey);
  }
  return genAIInstance;
}

export interface AIContextOptions {
  chatHistory?: { sender: "CUSTOMER" | "AGENT"; text: string }[];
  businessDetails?: string;
  imageUrl?: string | null;
  platform?: string;
}

let cachedDefaultKB = "";

function getDefaultKnowledgeBase(): string {
  if (cachedDefaultKB) return cachedDefaultKB;
  try {
    const kbPath = path.join(process.cwd(), "data", "knowledge_base.txt");
    if (fs.existsSync(kbPath)) {
      cachedDefaultKB = fs.readFileSync(kbPath, "utf-8");
      return cachedDefaultKB;
    }
  } catch {}
  return "Galaxy Laboratories (Unani) - Bangladesh. Delivery: Cash on Delivery all over Bangladesh. Dhaka 1-2 days, outside Dhaka 2-3 business days. Payment: No advance payment. Pay on delivery. Order: Provide full name, delivery address, active mobile number.";
}

function detectLanguage(text: string): string {
  if (!text) return "Bengali";
  if (/[\u0600-\u06FF]/.test(text)) return "Arabic";
  if (/[\u0900-\u097F]/.test(text)) return "Hindi";
  if (/[\u0980-\u09FF]/.test(text)) return "Bengali";
  if (/^[a-zA-Z0-9\s.,!?'"()\-+%$&@#/*]+$/.test(text.trim())) {
    const isBanglish = /\b(koto|dam|aita|eta|apnader|kibhabe|khabo|ase|ki|bhai|bhaiya|vai|vaiya|valo|osudh|medicine|kaj|kore|kirokom|order|korbo|kori|lingo|choto|chikon|durbol|bhirjo)\b/i.test(text);
    if (isBanglish) {
      return "Bengali (Banglish inquiry - reply in natural, conversational Bengali)";
    }
    return "English";
  }
  return "Bengali";
}

function buildSystemInstruction(options: AIContextOptions, liveProductContext: string = "", detectedLang: string = "Bengali"): string {
  const kb = options.businessDetails?.trim() || getDefaultKnowledgeBase();

  return `You are an expert, compassionate human Unani Doctor and senior consultant representing Green Health Unani Pharmacy (গ্রীন হেলথ ইউনানী ফার্মেসী) in Bangladesh.

CRITICAL RULES FOR GEMINI FLASH BACKEND:

1. LANGUAGE & GEO-ROUTING RULE:
   - Detected Customer Language/Script: ${detectedLang}
   - You MUST reply fluently in the EXACT matched language/script used by the customer (Bengali, English, Arabic, Hindi, etc.).

2. STRICT ANTI-REPETITION & SHORT HUMAN STEPS (CRITICAL):
   - Maximum 2-3 sentences per reply! Chat live like a real human doctor on Facebook Messenger.
   - NEVER dump long pre-written promotional paragraphs, product sheets, or walls of text.
   - NEVER repeat the exact same text or pitch that was already sent previously.
   - If the customer asks a follow-up question, answer ONLY that specific question dynamically in 2-3 natural sentences.

3. SENIOR HAKIM CLINICAL INTAKE & CONSULTATION PROTOCOL (ধাপে ধাপে প্রেসক্রিপশন ও পরামর্শ):
   When a customer consults about intimate health problems (যেমন: লিঙ্গ ছোট, নরম, শিথিল, দুর্বল, বীর্য পাতলা, দ্রুত বীর্যপাত, টাইমিং কম) or asks for a solution/custom course:
   Act as an experienced, caring senior Unani Hakim conducting a clinical diagnosis to recommend the perfect herbal course.

   CRITICAL CLINICAL RULES:
   - Ask ONLY ONE QUESTION AT A TIME across consecutive messages to build deep trust!
   - NEVER ask 2 or 3 questions together, and NEVER dump a long form or wall of text.
   - Keep each reply short (2-3 sentences max), empathetic, respectful, and professional.
   - CHECK RECENT CONTEXT: If the customer already provided any info (e.g. age, marital status, duration, or symptoms), NEVER ask it again! Advance naturally to the next missing step.

   STEP-BY-STEP CLINICAL CHECKLIST:
   * Step 1 (Empathy & Basic Biometrics):
     Directly address their symptoms with genuine empathy first, then ask ONLY:
     "ভাইয়া, আপনার এই সমস্যাগুলো নিয়ে একদম মন খারাপ বা টেনশন করবেন না, সঠিক ভেষজ নিয়মে এটি পুরোপুরি নিরাময়যোগ্য। আপনার বয়স কত এবং আপনি কি বিবাহিত না অবিবাহিত?"
   * Step 2 (Problem Duration & Past Treatments):
     Once age and marital status are known, ask about duration and past medicines:
     "আপনার এই সমস্যাটি কত দিন বা কত মাস ধরে হচ্ছে? এর আগে কি কোনো ওষুধ বা চিকিৎসা নিয়েছিলেন?"
   * Step 3 (Lifestyle, Sleep & Medical History):
     Ask about diabetes, blood pressure, sleep, and work pressure:
     "আপনার কি ডায়াবেটিস বা হাই প্রেসারের কোনো সমস্যা আছে? আর রাতে ঘুম এবং কাজের চাপ কেমন থাকে?"
   * Step 4 (Hakim's Evaluation & Customized Course Recommendation):
     Based on their answers, prescribe the root-cause customized Unani formula (যেমন: প্রিমিয়াম আম্বার বা সোল মেট ফর্মুলা). Explain in 2 sentences how it restores penile blood circulation, repairs nerve tissues, thickens semen, and provides permanent stamina safely. Clearly state the offer price and delivery advantage.
   * Step 5 (Final Order & Shipping Information - ONLY when customer agrees to order / confirms):
     Politely collect the final delivery info:
     1. পূর্ণ নাম (Full Name)
     2. মোবাইল নম্বর (Active Phone Number)
     3. সম্পূর্ণ ঠিকানা (Full Delivery Address: জেলা, থানা, গ্রাম/রোড)
     4. পেমেন্ট তথ্য (ক্যাশ অন ডেলিভারি অথবা বিকাশ/নগদ TrxID)

4. STOP UNNECESSARY APOLOGIES & DEFENSIVE EXCUSES:
   - NEVER say "দুঃখিত আপনাকে ভুল বোঝানোর কোনো উদ্দেশ্য আমাদের ছিল না...", "আমি গ্রীন হেলথ ইউনানী ফার্মেসীর কাস্টমার সাপোর্ট টিম", or any defensive apology.

5. STRICT RULE ON ORDER & ADDRESS ASKING:
   - NEVER ask for Name, Address, or Mobile Number UNLESS the customer explicitly states they want to buy or order!

6. Clean Plain Text:
   - Plain text only. Absolutely DO NOT use markdown bolding or asterisks (no ** or ## or *).

${liveProductContext ? `\n--- LIVE DASHBOARD DATA FOR THIS INQUIRY ---\n${liveProductContext}\n-------------------------------------------\n` : ""}

Knowledge Base:
${kb}`.trim();
}

// Active Gemini model names
const PRIMARY_MODELS = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.7-flash", "gemini-3.5-flash"];

export async function generateAutoReply(
  incomingMessage: string,
  options: AIContextOptions = {}
): Promise<string> {
  const effectiveMessage = incomingMessage?.trim() || "";

  // Search live VPS database for matched product
  const matchedProduct = findProductInDB(effectiveMessage);
  let liveProductContext = "";
  if (matchedProduct) {
    liveProductContext = buildProductAIContext(matchedProduct);
  }

  const genAI = getGenAI();

  if (!genAI) {
    return generateFallbackReply(effectiveMessage, options.chatHistory, options.imageUrl, matchedProduct);
  }

  const detectedLang = detectLanguage(effectiveMessage);

  // Try available models in order
  for (const modelName of PRIMARY_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: buildSystemInstruction(options, liveProductContext, detectedLang),
        generationConfig: {
          maxOutputTokens: 350,
          temperature: 0.45,
        },
      });

      const userPrompt = `Customer message: "${effectiveMessage}". Provide an accurate, helpful reply:`;
      const result = await model.generateContent(userPrompt);
      const reply = result.response.text().trim();

      if (reply && reply.length > 5) {
        return reply;
      }
    } catch (modelErr: any) {
      console.warn(`[AI_AUTO_REPLY_ERROR] (${modelName}):`, modelErr.message);
    }
  }

  return generateFallbackReply(effectiveMessage, options.chatHistory, options.imageUrl, matchedProduct);
}

// ── Smart Fallback Engine ───────────────────────────────────────────────────
function generateFallbackReply(
  message: string,
  history?: { sender: "CUSTOMER" | "AGENT"; text: string }[],
  imageUrl?: string | null,
  matchedProduct?: any
): string {
  const lower = message.toLowerCase().trim();

  if (matchedProduct) {
    const name = matchedProduct.name;
    const price = matchedProduct.discount_price || matchedProduct.custom_price;
    const note = matchedProduct.custom_note ? ` (${matchedProduct.custom_note})` : "";
    const dosage = matchedProduct.dosageForm ? ` সেবনবিধি: ${matchedProduct.dosageForm}।` : "";

    if (lower.includes("dam") || lower.includes("price") || lower.includes("কত") || lower.includes("টাকা") || lower.includes("koto")) {
      return `আমাদের ${name}-এর মূল্য: ${price ? price + " টাকা" : "অফার জানতে ইনবক্সে যোগাযোগ করুন"}${note}। সারা দেশে ক্যাশ অন ডেলিভারিতে হোম ডেলিভারি দেওয়া হয়। অর্ডার করতে আপনার নাম, ঠিকানা ও মোবাইল নম্বর দিন।`;
    }

    if (lower.includes("khabo") || lower.includes("খাব") || lower.includes("সেবন") || lower.includes("নিয়ম") || lower.includes("dosage")) {
      return `${name}${dosage} নিয়ম মেনে সেবন করলে সবচেয়ে ভালো ফলাফল পাবেন। অর্ডার করতে নাম ও ঠিকানা পাঠাতে পারেন।`;
    }

    return `আমাদের ${name} ${matchedProduct.custom_pitch || "প্রাকৃতিক ও ভেষজ ফর্মুলায় প্রস্তুত অত্যন্ত কার্যকরী ওষুধ"}।${price ? ` মূল্য: ${price} টাকা${note}।` : ""}${dosage} অর্ডার করতে চাইলে আপনার নাম, সম্পূর্ণ ঠিকানা ও মোবাইল নম্বর পাঠান।`;
  }

  // Greetings
  if (lower.includes("salam") || lower.includes("assalamu") || lower.includes("সালাম")) {
    return "ওয়ালাইকুম আসসালাম। জি বলুন, কীভাবে সহযোগিতা করতে পারি?";
  }
  if (lower.includes("hi") || lower.includes("hello") || lower.includes("হাই") || lower.includes("হ্যালো")) {
    return "জি বলুন, কীভাবে সহযোগিতা করতে পারি?";
  }

  // Order
  if (lower.includes("order") || lower.includes("অর্ডার") || lower.includes("নিতে চাই")) {
    return "ধন্যবাদ! অর্ডার কনফার্ম করতে অনুগ্রহ করে আপনার: ১. নাম, ২. সম্পূর্ণ ডেলিভারি ঠিকানা (জেলা ও থানা সহ), ৩. সচল মোবাইল নম্বর লিখে পাঠান। পার্সেল হাতে পেয়ে মূল্য পরিশোধ করতে পারবেন।";
  }

  return "আমাদের কাছে মূলত পুরুষ ও নারীদের শারীরিক দুর্বলতা দূর করা, এনার্জি ও স্থায়ী স্ট্যামিনা বৃদ্ধির সম্পূর্ণ প্রাকৃতিক ও নিরাপদ ভেষজ ওষুধ রয়েছে। আপনার কাঙ্ক্ষিত প্রোডাক্টের নাম বা শারীরিক সমস্যার কথা জানালে বিস্তারিত পরামর্শ দিতে পারব।";
}