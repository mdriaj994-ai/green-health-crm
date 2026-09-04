import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { findProductInDB, buildProductAIContext, loadMergedDB } from "./product-db";

// Runtime API key resolution (NOT cached at module load time)
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
  return "Galaxy Laboratories (Unani) - Bangladesh. Delivery: Cash on Delivery all over Bangladesh. Dhaka city 60 taka, outside Dhaka 120 taka. Dhaka 1-2 days, outside Dhaka 2-3 business days. Payment: No advance payment. Pay on delivery. Order: Provide full name, delivery address, active mobile number.";
}

function buildSystemInstruction(options: AIContextOptions, liveProductContext: string = ""): string {
  const kb = options.businessDetails?.trim() || getDefaultKnowledgeBase();

  return `You are Hakim Rejaul Karim - an experienced Unani physician and customer service representative of Galaxy Laboratories (Unani), Bangladesh.

Your identity:
- Name: Hakim Rejaul Karim (হাকিম রেজাউল করিম)
- Title: Unani Physician & Health Consultant, Galaxy Laboratories (Unani)
- Personality: Warm, respectful, trustworthy, deeply knowledgeable in Unani medicine. Speak with dignity like a genuine experienced physician.

Communication rules:
- Always reply in natural, polite Bengali (বাংলা). Only use Banglish if the customer strictly writes in Banglish.
- Start with an Islamic greeting (আসসালামু আলাইকুম) when starting a fresh conversation.
- Speak warmly and empathetically. Address the customer with respect.
- Complete your thoughts and sentences fully.
- Keep replies direct, concise, and focused on their exact query.
- Do NOT use markdown bolding (like ** or ##) in messenger messages, keep formatting clean and easy to read.

Important instructions:
1. Live Product Data:
   If live product data is provided below, ALWAYS use its exact price, discount offer, note, dosage, and pain point solutions. Never contradict the live dashboard data.
2. If customer asks for price: State the exact current price and special discount/offer clearly.
3. If customer asks for dosage/how to take: Explain the dosage form and instructions clearly.
4. If customer wants to order: Welcome the order and politely request: 1. তাদের নাম, 2. সম্পূর্ণ ঠিকানা (জেলা/থানা সহ), 3. সচল মোবাইল নম্বর।
5. Payment & Delivery: Remind them that Cash on Delivery (ক্যাশ অন ডেলিভারি) is available across all 64 districts in Bangladesh with 0 advance payment. Dhaka city 60 taka (1-2 days), outside Dhaka 120 taka (2-3 days).

${liveProductContext ? `\n--- LIVE DASHBOARD DATA FOR THIS INQUIRY ---\n${liveProductContext}\n-------------------------------------------\n` : ""}

Knowledge Base:
${kb}`.trim();
}

// Correct Gemini model names - try in priority order
const PRIMARY_MODELS = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.0-pro"];

export async function generateAutoReply(
  incomingMessage: string,
  options: AIContextOptions = {}
): Promise<string> {
  const effectiveMessage = incomingMessage?.trim() || "Ei chobi-r product somporke bistarito o dam jante chai.";

  // Search live VPS database for matched product
  const matchedProduct = findProductInDB(effectiveMessage);
  let liveProductContext = "";
  if (matchedProduct) {
    liveProductContext = buildProductAIContext(matchedProduct);
    console.log(`[AI_LIVE_PRODUCT_MATCH] Found: ${matchedProduct.name} (SL: ${matchedProduct.sl}, Price: ${matchedProduct.discount_price || matchedProduct.custom_price})`);
  }

  const genAI = getGenAI();

  if (!genAI) {
    console.warn("[AI_AUTO_REPLY] GEMINI_API_KEY not set. Using smart Galaxy Laboratories fallback with live DB.");
    return generateFallbackReply(effectiveMessage, options.chatHistory, options.imageUrl, matchedProduct);
  }

  // Try available models in order
  for (const modelName of PRIMARY_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: buildSystemInstruction(options, liveProductContext),
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.15,
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

          const prompt = effectiveMessage.length > 5
            ? `Customer query: "${effectiveMessage}". Identify this Galaxy Laboratories product image and give warm reply as Hakim Rejaul Karim.`
            : "Identify this medicine image from Galaxy Laboratories and provide its brand name, key health benefits, price, and how to order in Bengali.";

          const result = await model.generateContent([prompt, imagePart]);
          const reply = result.response.text().trim();
          if (reply && reply.length > 10) {
            console.log(`[AI_VISION_SUCCESS] (${modelName}) -> ${reply.slice(0, 60)}...`);
            return reply;
          }
        } catch (visionErr: any) {
          console.warn(`[AI_VISION_ERROR] (${modelName})`, visionErr.message);
        }
      }

      // Format Chat History for context
      const chatHistory = options.chatHistory || [];
      const historySummary = chatHistory.length > 0
        ? chatHistory
            .slice(-6)
            .map((m) => `${m.sender === "CUSTOMER" ? "Customer" : "Hakim"}: ${m.text}`)
            .join("\n")
        : "";

      const userPrompt = historySummary
        ? `Previous conversation:\n${historySummary}\n\nCustomer's newest message:\n"${effectiveMessage}"\n\nReply as Hakim Rejaul Karim:`
        : `Customer says: "${effectiveMessage}". Reply as Hakim Rejaul Karim:`;

      const result = await model.generateContent(userPrompt);
      const reply = result.response.text().trim();

      if (reply && reply.length > 5) {
        console.log(`[AI_AUTO_REPLY_SUCCESS] (${modelName}) -> ${reply.slice(0, 60)}...`);
        return reply;
      }
    } catch (modelErr: any) {
      console.warn(`[AI_AUTO_REPLY_ERROR] (${modelName}):`, modelErr.message);
      // continue to next fallback model
    }
  }

  // Fallback if all Gemini models fail or rate limit
  return generateFallbackReply(effectiveMessage, options.chatHistory, options.imageUrl, matchedProduct);
}

// ── Smart Fallback Engine using Live Product DB ─────────────────────────────
function generateFallbackReply(
  message: string,
  history?: { sender: "CUSTOMER" | "AGENT"; text: string }[],
  imageUrl?: string | null,
  matchedProduct?: any
): string {
  const lower = message.toLowerCase().trim();
  const historyText = (history || []).map((h) => h.text.toLowerCase()).join(" ");

  // If specific product matched from live database!
  if (matchedProduct) {
    const name = matchedProduct.name;
    const price = matchedProduct.discount_price || matchedProduct.custom_price;
    const note = matchedProduct.custom_note ? ` (${matchedProduct.custom_note})` : "";
    const dosage = matchedProduct.dosageForm ? ` সেবনবিধি: ${matchedProduct.dosageForm}।` : "";

    if (lower.includes("dam") || lower.includes("price") || lower.includes("কত") || lower.includes("টাকা") || lower.includes("koto")) {
      return `আসসালামু আলাইকুম। আমাদের ${name}-এর মূল্য: ${price ? price + " টাকা" : "অফার জানতে ইনবক্সে যোগাযোগ করুন"}${note}। সারা দেশে ক্যাশ অন ডেলিভারিতে হোম ডেলিভারি নিতে পারেন। অর্ডার করতে আপনার নাম, ঠিকানা ও মোবাইল নম্বর দিন।`;
    }

    if (lower.includes("khabo") || lower.includes("খাব") || lower.includes("সেবন") || lower.includes("নিয়ম") || lower.includes("dosage")) {
      return `আসসালামু আলাইকুম। ${name}${dosage} আরও কোনো শারীরিক পরামর্শ থাকলে জানান, আমি হাকিম রেজাউল করিম বিস্তারিত জানিয়ে দিচ্ছি।`;
    }

    return `আসসালামু আলাইকুম। আমি হাকিম রেজাউল করিম। আমাদের ${name} ${matchedProduct.custom_pitch || "ইউনানি প্রাকৃতিক ফর্মুলায় প্রস্তুত অত্যন্ত কার্যকরী ওষুধ"}।${price ? ` মূল্য: ${price} টাকা${note}।` : ""}${dosage} অর্ডার করতে চাইলে আপনার নাম, সম্পূর্ণ ঠিকানা ও মোবাইল নম্বর পাঠান।`;
  }

  // 1. Image query without text
  if (imageUrl && (!message || message.length < 5)) {
    return "আসসালামু আলাইকুম! ছবিটির জন্য ধন্যবাদ। এটি আমাদের গ্যালাক্সি ল্যাবরেটরিজের অন্যতম জনপ্রিয় ইউনানি ফর্মুলেশন। আপনি কি এর বর্তমান অফার মূল্য ও সেবনবিধি জানতে চান নাকি সরাসরি অর্ডার করতে চান?";
  }

  // 2. Order Information
  if (
    lower.includes("ki ki") ||
    lower.includes("dite hobe") ||
    lower.includes("lagbe") ||
    lower.includes("kivabe order") ||
    lower.includes("kivabe nibo") ||
    lower.includes("order") ||
    lower.includes("অর্ডার") ||
    lower.includes("নিতে চাই")
  ) {
    return "ধন্যবাদ! অর্ডার কনফার্ম করতে অনুগ্রহ করে আপনার: ১. নাম, ২. সম্পূর্ণ ডেলিভারি ঠিকানা (জেলা ও থানা সহ), ৩. সচল মোবাইল নম্বর লিখে পাঠান। পার্সেল হাতে পেয়ে মূল্য পরিশোধ করতে পারবেন।";
  }

  // 3. Side Effect & Safety
  if (lower.includes("side effect") || lower.includes("khoti") || lower.includes("safe") || lower.includes("ক্ষতি") || lower.includes("পার্শ্বপ্রতিক্রিয়া")) {
    return "আমাদের প্রতিটি ওষুধ শতভাগ প্রাকৃতিক ভেষজ উপাদান সমৃদ্ধ এবং বাংলাদেশ ইউনানি ফর্মুলারি দ্বারা অনুমোদিত। সঠিক নিয়মে সেবনে কোনো ক্ষতিকর পার্শ্বপ্রতিক্রিয়া নেই।";
  }

  // 4. Authenticity
  if (lower.includes("asol") || lower.includes("original") || lower.includes("authentic") || lower.includes("আসল")) {
    return "আমরা সরাসরি গ্যালাক্সি ল্যাবরেটরিজ (ইউনানি)-এর শতভাগ আসল ও পরীক্ষিত ওষুধ সরবরাহ করি। কোনো দ্বিধা ছাড়াই নিশ্চিন্তে অর্ডার করতে পারেন।";
  }

  // 5. Payment Methods
  if (lower.includes("payment") || lower.includes("advance") || lower.includes("অগ্রিম") || lower.includes("টাকা")) {
    return "আমাদের কোনো অগ্রিম টাকা দিতে হয় না! সারা বাংলাদেশে ক্যাশ অন ডেলিভারি সুবিধা রয়েছে—পার্সেল হাতে পেয়ে দেখে মূল্য পরিশোধ করবেন।";
  }

  // 6. Delivery Time
  if (lower.includes("kobe") || lower.includes("delivery") || lower.includes("কবে") || lower.includes("কত দিন")) {
    return "আমাদের ডেলিভারি চার্জ: ঢাকা সিটিতে ৬০ টাকা এবং ঢাকার বাইরে ১২০ টাকা। ঢাকায় ১-২ দিন এবং ঢাকার বাইরে ২-৩ কার্যদিবসের মধ্যে ইন শা আল্লাহ পৌঁছে যাবে।";
  }

  // 7. General Greetings
  if (lower.includes("salam") || lower.includes("assalamu") || lower.includes("সালাম") || lower.includes("hi") || lower.includes("hello")) {
    return "আসসালামু আলাইকুম! আমি হাকিম রেজাউল করিম, গ্যালাক্সি ল্যাবরেটরিজ (ইউনানি) থেকে বলছি। আমাদের প্রাকৃতিক ও ভেষজ ওষুধ সম্পর্কে কীভাবে সাহায্য করতে পারি?";
  }

  return "আসসালামু আলাইকুম, আমি হাকিম রেজাউল করিম। গ্যালাক্সি ল্যাবরেটরিজের যেকোনো ওষুধের দাম, সেবনবিধি জানতে বা অর্ডার করতে আপনার পছন্দের ওষুধের নাম অথবা শারীরিক সমস্যার কথা জানান, আমি বিস্তারিত জানিয়ে দিচ্ছি।";
}