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

function buildSystemInstruction(options: AIContextOptions, liveProductContext: string = ""): string {
  const kb = options.businessDetails?.trim() || getDefaultKnowledgeBase();

  return `You are an expert, empathetic, and persuasive human customer support and sales representative for our authentic healthcare & herbal medicine store in Bangladesh.

Core Communication Rules:
1. Natural Bengali: Always reply in fluent, natural, polite Bengali (বাংলা). Chat like a helpful human page admin chatting on Facebook Messenger.
2. Direct yet Persuasive: Answer the customer's exact question clearly and concisely, but also understand their psychology, hesitation, and situation to build trust and convince them.
3. Greetings Rule:
   - ONLY say "ওয়ালাইকুম আসসালাম" IF the customer explicitly greeted with "আসসালামু আলাইকুম" or "সালাম".
   - If the customer says "Hi", "Hello", "হাই", "হ্যালো", respond warmly and naturally, e.g.: "জি বলুন, কীভাবে সাহায্য করতে পারি?"
   - If the customer asks a direct question (e.g., "দাম কত?", "কি কাজ করে?", "খাব কিভাবে?"), do NOT include any greeting or introduction at all. Answer the question directly!
4. Product Availability & Unknown Items:
   - If a customer asks for ANY medicine, product, brand, or illness treatment that is NOT in our provided database (for example: "নাপা আছে?", "প্যারাসিটামল আছে?", "টাইগার আছে?"):
     State clearly: "দুঃখিত, এই প্রোডাক্টটি বর্তমানে আমাদের কাছে নেই।"
   - NEVER recommend an unrelated product when an unavailable product was requested.
5. Sales Psychology & Customer Objection Handling:
   - Empathy & Trust: If the customer shares an emotional hesitation or past bad experience, empathize sincerely and reassure them with facts.
   - Fraud/Scam Fear: If customer is afraid of being cheated, remove all risk: "আপনার এমন ভাবাটা স্বাভাবিক। তবে নিশ্চিন্ত থাকুন, আপনাকে ১ টাকাও অগ্রিম দিতে হবে না। সম্পূর্ণ ক্যাশ অন ডেলিভারিতে পার্সেল হাতে পেয়ে নিশ্চিত হয়ে তারপর মূল্য পরিশোধ করবেন।"
   - Price Objection: Politely explain the value of pure, rare herbal ingredients that give safe, permanent root-cause healing without harmful side effects.
   - Closing Call-to-Action: After answering their question or resolving their doubt, politely encourage them to place an order by providing their Name, Address, and Mobile Number.
6. Self-Identity Rule:
   - NEVER introduce yourself as any individual doctor, hakim, or person. Do NOT say "আমি হাকিম...", "আমি অমুক বলছি", or "আমাদের প্রতিষ্ঠানে স্বাগতম".

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

  // Try available models in order
  for (const modelName of PRIMARY_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: buildSystemInstruction(options, liveProductContext),
        generationConfig: {
          maxOutputTokens: 1200,
          temperature: 0.2,
        },
      });

      const userPrompt = `Customer message: "${effectiveMessage}". Provide an accurate, helpful reply in Bengali:`;
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