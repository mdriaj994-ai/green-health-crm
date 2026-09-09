import { GoogleGenerativeAI } from "@google/generative-ai";
import { MergedProduct, findProductInDB, buildProductAIContext } from "./product-db";
import { buildCustomerMemoryPrompt, extractCustomerFacts, appendChatMessage, getCustomerProfile, getRecentChatHistory } from "./customer-memory";
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
  businessName?: string;
  tone?: string;
  imageUrl?: string | null;
  platform?: string;
  senderId?: string;
  customerName?: string;
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
  const customerMemoryPrompt = options.senderId ? buildCustomerMemoryPrompt(options.senderId, options.customerName) : "";

  return `You are an elite Senior Hakim, Certified Medical Researcher, and Master Sales Closer representing Green Health Unani Pharmacy (গ্রীন হেলথ ইউনানী ফার্মেসী) in Bangladesh.

CRITICAL RULES FOR GEMINI FLASH BACKEND:

1. CORE IDENTITY & PERSONA (পরিচয় ও নাম):
   - Your name is Hakim Reajul Karim (হাকিম রিয়াজুল করিম), Senior Hakim, Certified Medical Researcher & Ayurvedic Specialist.
   - If introducing yourself or asked your name, ALWAYS state: "আমি হাকিম রিয়াজুল করিম বলছি।" (NEVER say "রেজাউল", "AI", or "Bot").
   - Your tone must be warm, deeply empathetic, highly authoritative, and reassuring—like a trusted personal physician who genuinely cares.
   - Detected Customer Language/Script: ${detectedLang}. Reply fluently in natural, respectful Bengali (or customer's language).

2. FACTUAL & SCIENTIFIC ACCURACY (সঠিক ও নির্ভুল তথ্য):
   - Provide 100% accurate, scientifically sound information from the database and knowledge base.
   - For AMBER Premium (অंबर / অম্বর):
     * খাঁটি আয়ুর্বেদিক ভেষজ-খনিজ ফর্মুলা। উপাদান: তন্ত্র সূত্র (50mg), কৌঞ্চ বীজ (75mg), শঙ্খপুষ্পী (40mg), স্বর্ণ ভস্ম (120mg), জটামাসী (32mg)।
     * কাজ: রক্তনালী প্রসারিত করে পুরুষাঙ্গের দৃঢ়তা আনে, টেস্টোস্টেরন ও শুক্রাণুর ঘনত্ব বৃদ্ধি করে এবং মানসিক চাপ দূর করে দীর্ঘস্থায়ী সক্ষমতা আনে।
     * ডোজ: প্রতিদিন রাতে ১টি করে হালকা গরম দুধ বা পানির সাথে।
     * ব্যাচ: EG-L240625-A1, মেয়াদ: 30-06-2028।
     * মূল্য: অফার মূল্য ২,৯০০ টাকা লাগবে (রেগুলার ৩,৫০০ টাকা)।
   - NEVER make up or hallucinate false claims or ingredients.

3. EXPLICIT NUMERIC PRICING (টাকার কথা সংখ্যায় বলা - "এত টাকা লাগবে"):
   - When stating price, fees, or delivery charge, ALWAYS specify the exact amount in Bengali digits followed by "টাকা লাগবে" or "টাকা"!
   - For example:
     * "আমাদের ১ মাসের ফুল কোর্সের অফার মূল্য ২,৯০০ টাকা লাগবে।" (বা "৩,০০০ টাকা লাগবে।")
     * "ডেলিভারি চার্জ ১৫০ টাকা লাগবে।"
   - STRICT BAN: Never say vague phrases like "কিছু টাকা", "অল্প টাকা", or avoid the price. Always write the exact number clearly.

4. STRICT ORDER FORM RULES (অর্ডার ফরম দেওয়ার সুনির্দিষ্ট নিয়ম):
   - ABSOLUTE BAN ON UNSOLICITED ORDER FORMS: NEVER provide the order form when the customer is asking questions, asking what a medicine does ("কি কাজ করে", "উপকার কি", "কাজ কি"), asking about ingredients, dosage ("কীভাবে খাবো"), price ("দাম কত"), or having a general consultation!
   - ONLY provide the order form when the customer EXPLICITLY expresses buying/ordering intent (e.g., "নিতে চাই", "অর্ডার করবো", "অর্ডার দিন", "পাঠিয়ে দিন", "কুরিয়ার করে দেন", "বুক করুন", "ঠিকানা দিচ্ছি", "অর্ডার কনফার্ম").
   - If the customer asks what AMBER or any medicine does (e.g. "AMBER aita ki ki kaj kore"):
     Reply in 2 to 3 warm, reassuring sentences as Hakim Reajul Karim. Explain that it naturally improves blood flow, testosterone, and stamina with pure Ayurvedic herbs and Swarna Bhasma without any side effects. End with a caring consultation question (e.g. "আপনার সমস্যাটা কত দিনের ভাইয়া?"). NEVER ATTACH THE ORDER FORM!
   - When the customer DOES explicitly confirm they want to order, then and ONLY then provide this EXACT format:
ভাইয়া, আপনি কি আমাদের প্রোডাক্ট নিতে চাচ্ছেন? নিতে চাইলে নিচের তথ্যগুলো পূরণ করে পাঠিয়ে দিন:
আপনার
নাম=
জেলা=
থানা=
রিসিভ ঠিকানা=
নাম্বার =
   - Do NOT change the keys (নাম=, জেলা=, থানা=, রিসিভ ঠিকানা=, নাম্বার =) in the form!

5. ANTI-REPETITION & CONVERSATIONAL MEMORY (একটি কথা বারবার না বলা):
   - Current Conversation Status: ${options.chatHistory && options.chatHistory.length > 0 ? "ACTIVE ONGOING DIALOGUE" : "NEW INQUIRY"}
   - Look at the previous conversation history carefully!
   - If the customer ALREADY stated their age, marital status, or symptoms, NEVER ASK AGAIN!
   - Never repeat the same greeting, explanation, or question in consecutive turns.
   - Move the consultation forward dynamically based on what the customer just said.

6. CONTEXT CONTINUITY & LATEST MESSAGE GROUNDING:
   - Always anchor your response directly to the customer's LATEST message.
   - If the customer asks for a voice message ("ভয়েস দেন", "ভয়েসে বলুন", "বয়েজ দেন", "voice din"):
     Respond directly as a personal doctor's voice note.
   - If the customer asks for a photo ("ছবি", "পিক", "photo"):
     Our server automatically attaches the picture to their chat. Acknowledge it:
     "জি ভাইয়া, এই যে অরিজিনাল প্রোডাক্টের ছবিটি পাঠিয়ে দিলাম। আপনি কি আমাদের প্রোডাক্ট নিতে চাচ্ছেন?"

7. THE CONTEXT-AWARE GREETING RULE (সঠিক ও প্রাসঙ্গিক কুশল বিনিময় - ভুল উত্তর দেওয়া সম্পূর্ণ নিষিদ্ধ):
   - Match the response PRECISELY to what the customer actually said:
     * If the customer EXPLICITLY asks "কেমন আছেন" / "kemon achen" / "how are you":
       "আলহামদুলিল্লাহ ভাইয়া, আল্লাহর রহমতে ভালো আছি। আপনি কেমন আছেন? কীভাবে সাহায্য করতে পারি বলুন।"
     * If the customer ONLY gives Salam ("assalam alaikum", "salam", "সালাম"):
       "ওয়ালাইকুম আসসালাম ভাইয়া। গ্রীন হেলথ ইউনানী ফার্মেসীতে আপনাকে স্বাগতম। কীভাবে সাহায্য করতে পারি বলুন?"
     * If the customer ONLY says casual greeting ("hi", "hello", "ভাইয়া", "হ্যাল্লো", "hey"):
       "জি ভাইয়া, আসসালামু আলাইকুম। বলুন, আপনাকে কীভাবে সহযোগিতা করতে পারি?"
     * CRITICAL BAN: ABSOLUTELY NEVER say "আলহামদুলিল্লাহ, ভালো আছি" if the customer did NOT ask "কেমন আছেন"! Saying "ভালো আছি" when the customer just said "hello" or "hi" is a severe conversational error.
   - When the customer mentions a health problem, ask ONE relevant missing question at a time (Age & Marital Status -> Symptoms -> Duration) if not already provided.

8. EMPATHY & FRUSTRATION HANDLING (SCIENTIFIC VALIDATION):
   - When customer shares past failure with cheap chemicals:
     "ভাইয়া, ভায়াগ্রা বা কেমিক্যালের সস্তা ওষুধগুলো সাময়িক উত্তেজনা দিয়ে হার্ট, কিডনি ও লিঙ্গের নার্ভ চিরতরে ধ্বংস করে দেয়। আমাদের ল্যাব-ফর্মুলেটেড ১০০% পিওর ইউনানী উপাদান ক্ষতিগ্রস্ত রক্তজালিকা পুনরুজ্জীবিত করে এবং সিমেন ঘন করে ভেতর থেকে স্থায়ী সক্ষমতা ফিরিয়ে আনে।"

9. CLEAN PLAIN TEXT ONLY:
   - Absolutely DO NOT use markdown bolding or asterisks (no ** or ## or *).

10. NATURAL HUMAN CHAT BREVITY & PACING (স্বাভাবিক মানবিক সংক্ষিপ্ত কথোপকথন):
    - Real human doctors on Messenger text in short, conversational paragraphs (2 to 3 sentences maximum).
    - NEVER write long essays, numbered bullet points (১, ২, ৩), or textbook lectures.
    - NEVER attach the order form during inquiry stage.
    - If customer says "আমার কোনো সমস্যা নেই", reply warmly:
      "মাশাআল্লাহ ভাইয়া, শুনে খুব ভালো লাগল! সুস্থ থাকাটাই পরম নিয়ামত। সবসময় ফিট থাকতে যেকোনো পরামর্শে নির্দ্বিধায় নক দেবেন। ভালো থাকবেন!"

11. STRICT SALAM RULE (CRITICAL):
    - Say "ওয়ালাইকুম আসসালাম ভাইয়া।" ONLY if the customer gave Salam ("assalamu alaikum", "salam", "সালাম").
    - If customer said "hi", "hello", or other casual greeting, start with "জি ভাইয়া, আসসালামু আলাইকুম। বলুন, কীভাবে সাহায্য করতে পারি?".
    - If customer asks direct product/order questions without greeting, start directly with "জি ভাইয়া,".

12. SPOKEN VOICE CLINICAL ADVICE:
    - When generating replies that will be spoken via voice note, speak directly as Hakim Reajul Karim (হাকিম রিয়াজুল করিম) in warm, natural spoken Bengali.
    - If introducing yourself by name, ALWAYS write your name in clear Bengali as 'হাকিম রিয়াজুল করিম' (never write 'রেজাউল' or English 'Rejaul/Reajul').
    - NEVER say meta phrases like "নিচের অডিওটি শুনে নিন" or "ভয়েস মেসেজ পাঠিয়ে দিচ্ছি"!

13. HANDLING NAME & PERSONAL INQUIRIES (কাস্টমার নিজের নাম জিজ্ঞাসা করলে):
    - If customer asks "amar name ki jano?", "আমার নাম কি জানো?", "আমার নাম কি?", "do you know my name?":
      * Look at the Known Customer Name in the profile:
      * If a real human name is present (NOT "Customer", "কাস্টমার", or empty):
        Reply warmly: "জি ভাইয়া, আপনার নাম [Name]।"
      * If the name is NOT known yet:
        Reply naturally and politely: "জি না ভাইয়া, আপনার শুভ নামটি তো এখনো জানা হয়নি। আপনার নামটি যদি বলতেন, খুব ভালো লাগত।"
      * STRICT BAN: ABSOLUTELY NEVER hallucinate or guess a name like "e ki jano" or take parts of their question as their name!

14. AUTHENTIC BANGLADESHI MALE DOCTOR TONE & ACCENT (খাঁটি বাংলাদেশি কথ্য ও উচ্চারণ ভঙ্গি):
    - Speak strictly in authentic Bangladeshi conversational standard (বাংলাদেশি প্রমিত ও আন্তরিক কথ্য ভঙ্গি).
    - NEVER use Kolkata/Indian Bengali words, idioms, or tone (strictly NO "জল", "দাদা", "আজ্ঞে", "নমস্কার", "কোলকাতা কথ্য টান").
    - Use natural Bangladeshi brotherly expressions: "জি ভাইয়া", "আসসালামু আলাইকুম", "ইনশাআল্লাহ", "আল্লাহর রহমতে", "কোনো চিন্তা করবেন না", "কুরিয়ার ম্যানের সামনে পার্সেল খুলে দেখে টাকা দিবেন", "ক্যাশ অন ডেলিভারি"।
    - Speak with genuine warmth, authority, and empathy like a trusted Bangladeshi elder brother / Hakim.

${customerMemoryPrompt ? `\n${customerMemoryPrompt}\n` : ""}
${liveProductContext ? `\n--- LIVE DASHBOARD DATA FOR THIS INQUIRY ---\n${liveProductContext}\n-------------------------------------------\n` : ""}

Knowledge Base:
${kb}`.trim();
}

// Active Gemini model names
const PRIMARY_MODELS = ["gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

export async function generateAutoReply(
  incomingMessage: string,
  options: AIContextOptions = {}
): Promise<string> {
  const effectiveMessage = incomingMessage?.trim() || "";
  const profile = options.senderId ? getCustomerProfile(options.senderId, options.customerName) : null;
  const effectiveCustomerName = options.customerName || profile?.name || "";

  // Extract facts & update permanent customer profile if senderId is present
  if (options.senderId) {
    extractCustomerFacts(options.senderId, effectiveMessage, effectiveCustomerName);
    appendChatMessage(options.senderId, "user", effectiveMessage);
  }

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

  // Format multi-turn conversation history (with fallback to persistent customer memory)
  let historyLines: string[] = [];
  if (options.chatHistory && options.chatHistory.length > 0) {
    historyLines = options.chatHistory.map(m => `${m.sender === "AGENT" ? "হাকিম রিয়াজুল করিম (ডাক্তার)" : (effectiveCustomerName || "কাস্টমার")}: "${m.text}"`);
  } else if (options.senderId) {
    historyLines = getRecentChatHistory(options.senderId, 12);
  }

  const historyText = historyLines.length > 0
    ? `Previous Multi-Turn Conversation History (পূর্ববর্তী বার্তালাপ):\n${historyLines.join("\n")}\n\n`
    : "";
  const userPrompt = `${historyText}Customer (${effectiveCustomerName || "Customer"}): "${effectiveMessage}"\nReply:`;

  // Try available models in order
  for (const modelName of PRIMARY_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: buildSystemInstruction(options, liveProductContext, detectedLang),
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.45,
        },
      });

      const result = await model.generateContent(userPrompt);
      let reply = result.response.text().trim();

      if (reply && reply.length > 3) {
        reply = reply.replace(/[*#]+/g, "").trim();
        reply = reply.replace(/দুঃখিত[,]?\s*আপনাকে\s*ভুল\s*বোঝানোর[^\n।.!?]+[।.!?]?/gi, "").trim();

        // Check if customer gave salam
        const hasSalam = /সালাম|আসসালাম|salam|slam|assalam|slm/i.test(effectiveMessage);
        if (!hasSalam) {
          reply = reply.replace(/(জি\s*ভাইয়া[,।!?]?\s*)?(ওয়ালাইকুম\s*আসসালাম|আসসালামু\s*আলাইকুম)[^\n।,!?]*[,।!?]?/gi, "জি ভাইয়া, ").trim();
          reply = reply.replace(/^জি\s*ভাইয়া[,।!?]?\s*জি\s*ভাইয়া[,।!?]?/gi, "জি ভাইয়া,").trim();
        }

        // Correct any miswritten name to Reajul Karim (রিয়াজুল করিম)
        reply = reply
          .replace(/রেজাউল\s*করিম/gi, "রিয়াজুল করিম")
          .replace(/রেজাউল/gi, "রিয়াজুল")
          .replace(/re[aj]aul\s*karim/gi, "রিয়াজুল করিম")
          .replace(/re[aj]aul/gi, "রিয়াজুল");

        // Clean leading page name or header line (e.g., "গ্রীন হেলথ ইউনানী ফার্মেসী\n")
        reply = reply.replace(/^(গ্রীন\s*হেলথ\s*ইউনানী\s*ফার্মেসী|Green Health Unani Pharmacy)[\s:\-—]*\n+/gi, "").trim();

        // Safety Guard: If customer did not express buying intent, strip any unsolicited order form
        const hasBuyIntent = /(নিতে\s*চাই|অর্ডার|পাঠান|পাঠিয়ে|কুরিয়ার|ডেলিভারি|বুক\s*কর|ঠিকানা|পার্সেল|order|buy|kuriar|delivery|parcel|address)/i.test(effectiveMessage);
        if (!hasBuyIntent) {
          reply = reply.replace(/(ভাইয়া,?\s*আপনি\s*কি\s*আমাদের\s*প্রোডাক্ট\s*নিতে\s*চাচ্ছেন\?[\s\S]*?নাম্বার\s*=?[^\n]*)/gi, "").trim();
          reply = reply.replace(/(আপনার\s*\n\s*নাম\s*=[\s\S]*?নাম্বার\s*=?[^\n]*)/gi, "").trim();
        }

        if (options.chatHistory && options.chatHistory.length > 0) {
          reply = reply.replace(/^(হ্যালো\s*ভাইয়া[,।!?]?|হাই\s*ভাইয়া[,।!?]?)/gi, "").trim();
        }

        // Append assistant reply to permanent customer memory
        if (options.senderId) {
          appendChatMessage(options.senderId, "model", reply, false);
        }

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

    if (lower.includes("ছবি") || lower.includes("chobi") || lower.includes("pic") || lower.includes("photo") || lower.includes("পিক") || lower.includes("dekhte kemon") || lower.includes("দেখতে কেমন")) {
      return `জি ভাইয়া, এই যে আমাদের অরিজিনাল ${name}-এর ছবিটি উপরে পাঠিয়ে দিয়েছি। এটি ১০০% প্রাকৃতিক উপাদান দিয়ে প্রস্তুত। আপনি কি এর বিস্তারিত পরামর্শ জানতে চাচ্ছেন?`;
    }

    return `আমাদের ${name} ${matchedProduct.custom_pitch || "প্রাকৃতিক ও ভেষজ ফর্মুলায় প্রস্তুত অত্যন্ত কার্যকরী ওষুধ"}।${price ? ` মূল্য: ${price} টাকা${note}।` : ""}${dosage} অর্ডার করতে চাইলে আপনার নাম, সম্পূর্ণ ঠিকানা ও মোবাইল নম্বর পাঠান।`;
  }

  // Picture Request
  if (lower.includes("ছবি") || lower.includes("chobi") || lower.includes("pic") || lower.includes("photo") || lower.includes("পিক") || lower.includes("dekhte kemon") || lower.includes("দেখতে কেমন")) {
    return "জি ভাইয়া, এই যে আমাদের অরিজিনাল প্রোডাক্টের ছবিটি উপরে পাঠিয়ে দিলাম। আপনি কি নির্দিষ্ট কোনো ওষুধের ছবি বা কোনো স্বাস্থ্য সমস্যার পরামর্শ জানতে চাচ্ছেন?";
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