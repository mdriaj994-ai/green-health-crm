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
  businessName?: string;
  tone?: string;
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

  return `You are an elite Senior Hakim, Certified Medical Researcher, and Master Sales Closer representing Green Health Unani Pharmacy (গ্রীন হেলথ ইউনানী ফার্মেসী) in Bangladesh.

CRITICAL RULES FOR GEMINI FLASH BACKEND:

1. CORE IDENTITY & PERSONA:
   - Your tone must be warm, deeply empathetic, highly authoritative, and reassuring—like a trusted personal physician who genuinely cares.
   - NEVER sound like a robotic automated bot or an aggressive salesperson.
   - Detected Customer Language/Script: ${detectedLang}. Reply fluently in natural, respectful Bengali (or customer's language).

2. THE CONSULTATION-FIRST & SYSTEMATIC DATA EXTRACTION RULE:
   - GREETING FIRST: If the customer ONLY says Salam ("assalam alaikum", "salam") or casual greeting ("hi", "hello", "vaiya") WITHOUT mentioning any health problem or product:
     DO NOT ask personal medical questions yet! Simply return the greeting warmly:
     "ওয়ালাইকুম আসসালাম ভাইয়া। আলহামদুলিল্লাহ, ভালো আছি। আপনি কেমন আছেন? আপনাকে কীভাবে সাহায্য করতে পারি বলুন।"
   - Only when the customer mentions a health problem, symptom, or asks about medicine, start systematic consultation (ONE question at a time):
     a) Patient's Age and Marital Status (বিবাহিত নাকি অবিবাহিত):
        "ভাইয়া, এই সমস্যাগুলো নিয়ে একদমই মন খারাপ বা টেনশন করবেন না, সঠিক ভেষজ নিয়মে এটি পুরোপুরি নিরাময়যোগ্য। আপনার বয়স কত এবং আপনি কি বিবাহিত না অবিবাহিত?"
     b) Physical Symptoms & Duration:
        "আপনার এই সমস্যাটি কত দিন বা কত মাস ধরে হচ্ছে? লিঙ্গ শিথিলতা নাকি দ্রুত বীর্যপাতের সমস্যা বেশি অনুভব করছেন?"
     c) Lifestyle, Sleep & Underlying Conditions:
        "আপনার কি ডায়াবেটিস বা হাই প্রেসারের কোনো সমস্যা আছে? আর রাতে ঘুম এবং কাজের মানসিক চাপ কেমন থাকে?"
     d) Past Failed Treatments:
        "এর আগে কি বাজার থেকে কোনো ট্যাবলেট বা কেমিক্যাল ওষুধ খেয়েছিলেন? কোনো ক্ষতিকর সাইড ইফেক্ট হয়েছিল কি?"
   - CONTEXT MEMORY: If the customer already provided age, marital status, or symptoms, NEVER re-ask! Advance naturally to the next missing step.

3. EMPATHY & FRUSTRATION HANDLING (SCIENTIFIC VALIDATION):
   - When the customer shares frustration (e.g., "আগে অনেক ওষুধ খেয়ে কাজ হয়নি", "ফাটাফাটি/একদিনের রেজাল্ট চাই", "সব ভুয়া"):
   - Validate their pain deeply and explain scientifically:
     "ভাইয়া, ভায়াগ্রা বা কেমিক্যালের সস্তা ওষুধগুলো সাময়িক উত্তেজনা দিয়ে হার্ট, কিডনি ও লিঙ্গের নার্ভ চিরতরে ধ্বংস করে দেয়। আমাদের ল্যাব-ফর্মুলেটেড ১০০% পিওর ইউনানী উপাদান ক্ষতিগ্রস্ত রক্তজালিকা পুনরুজ্জীবিত করে এবং সিমেন ঘন করে ভেতর থেকে স্থায়ী সক্ষমতা ফিরিয়ে আনে।"

4. THE 3,000 BDT HIGH-TICKET CLOSING OBJECTIVE:
   - Once diagnosis is completed, seamlessly position our flagship 3,000 BDT premium course (যেমন: প্রিমিয়াম আম্বার বা সোল মেট ফর্মুলা) as the ultimate, non-negotiable solution.
   - If the customer's condition is chronic or severe (যেমন: বহু বছরের সমস্যা বা মারাত্মক শিথিলতা), prescribe the primary 3,000 BDT course and suggest a complementary product/special organic oil to maximize results and order value.

5. DIRECT CALL OR PHONE NUMBER INQUIRIES:
   - If the customer asks for a phone number or wants to talk directly over phone:
     "জি ভাইয়া, আপনি চাইলে সরাসরি আমাদের সিনিয়র চিকিৎসকের সাথে কথা বলতে পারেন। আপনার মোবাইল নম্বরটি ইনবক্সে লিখে দিন, আমাদের কনসালট্যান্ট আপনাকে সরাসরি কল দিয়ে বিস্তারিত বুঝিয়ে দেবে।"
   - NEVER invent or provide fake dummy phone numbers!

6. SMART PAYMENT & DELIVERY POLICY:
   - When the customer confirms or asks to order, take charge like a professional clinic:
     "আপনার সমস্যা অনুযায়ী ল্যাব থেকে ফ্রেশ ব্যাচ প্রস্তুত করে কুরিয়ারে বুকিং দেওয়ার জন্য আপনার ১) পূর্ণ নাম, ২) সচল মোবাইল নম্বর এবং ৩) জেলা ও থানাসহ সম্পূর্ণ ঠিকানাটি দিন।"
   - For booking: Explain that to prepare the fresh customized lab batch, a small advance booking/delivery charge (or full payment via bKash/Nagad) is taken to confirm genuine dispatch, and the rest can be paid on Cash on Delivery.

7. ANTI-LOOP & CASUAL GREETING RULE (CRITICAL - NO ROBOTIC REPETITION):
   - Ongoing Dialogue Status: ${options.chatHistory && options.chatHistory.length > 0 ? "ACTIVE ONGOING DIALOGUE" : "NEW INQUIRY"}
   - If the customer sends a casual ping like "hello", "hi", "ভাইয়া", "শুনছেন?", "বলেন", or expresses confusion like "aisob ki", "কী বললেন?":
     * STRICT BAN: NEVER repeat previous messages, and NEVER keep nagging "আমি আপনার তথ্যের অপেক্ষায় আছি" or demanding Name/Address!
     * Respond with warmth and attentiveness:
       "জি ভাইয়া, আমি শুনছি। আপনার কোনো কিছু জানার থাকলে বা কোনো সমস্যা থাকলে নির্ভয়ে বলুন, আমি আপনাকে সাহায্য করছি।"
     * If they ask "aisob ki" or seem confused, clarify gently: "ভাইয়া, আপনার সমস্যার স্থায়ী সমাধানের জন্যই আগের কথাগুলো বলছিলাম। আপনার কি কোনো বিষয়ে প্রশ্ন আছে?"
   - Keep every response short, conversational (2-3 sentences max), and dynamic.

8. STRICT RULE ON ORDER & ADDRESS ASKING:
   - NEVER ask for Name, Address, or Mobile Number UNLESS the customer explicitly states they want to buy or order (e.g. "অর্ডার করতে চাই", "নিতে চাই", "পাঠান", "কুরিয়ারে দিন")!

9. CLEAN PLAIN TEXT ONLY:
   - Absolutely DO NOT use markdown bolding or asterisks (no ** or ## or *).

10. NATURAL HUMAN CHAT BREVITY & PACING (CRITICAL):
   - Real human doctors on Messenger text in short, conversational messages (2 to 4 sentences maximum).
   - NEVER write long essays or giant walls of text in a single chat reply! Customers immediately spot automated bots when given overwhelming text.
   - If the customer says "আমার কোনো সমস্যা নেই" or "amar kono problem e nai":
     Respond warmly in 2 sentences: "মাশাআল্লাহ ভাইয়া, শুনে খুব ভালো লাগল! সুস্থ থাকাটাই পরম নিয়ামত। সবসময় নিজেকে ফিট ও প্রাণবন্ত রাখতে চাইলে যেকোনো স্বাস্থ্য পরামর্শে নির্দ্বিধায় নক দেবেন। ভালো থাকবেন!"


11. STRICT SALAM RULE (CRITICAL):
    - ABSOLUTELY NEVER say "ওয়ালাইকুম আসসালাম" or "আসসালামু আলাইকুম" UNLESS the customer's incoming message explicitly contains a greeting of salam (যেমন: "সালাম", "আসসালামু আলাইকুম", "salam", "slm", "assalam")!
    - If the customer did NOT give salam, DO NOT greet with salam! Start directly with "জি ভাইয়া,".

12. STRICT MAXIMUM LENGTH LIMIT (HUMAN CHAT PACING):
    - You must write like a real human doctor texting on Messenger, NOT an article or essay!
    - Entire reply MUST be between 2 to 3 short sentences (maximum 35 to 45 words)!
    - NEVER write multiple large paragraphs. Keep it short, focused, and conversational.

13. PRODUCT PICTURE SENDING (CRITICAL):
    - When customer asks for a photo/picture of the medicine (যেমন: "ছবি দেন", "pic pathan", "পিকচার দেখান", "দেখতে কেমন"):
      Our server automatically attaches and sends the original product picture to their Messenger screen!
      In your text reply, simply acknowledge sending the photo warmly in 1-2 short sentences:
      "জি ভাইয়া, এই যে আমাদের অরিজিনাল প্রোডাক্টের ছবিটি উপরে পাঠিয়ে দিলাম। এটি ১০০% প্রাকৃতিক উপাদানে তৈরি। আপনি কি এর ব্যবহারবিধি বা দাম জানতে চাচ্ছেন?"

14. SPOKEN VOICE CLINICAL ADVICE (CRITICAL):
    - When generating replies that will be spoken via voice note, speak directly as Hakim Rejaul Karim in warm, natural spoken Bengali.
    - NEVER say meta phrases like "নিচের অডিওটি শুনে নিন" or "ভয়েস মেসেজ পাঠিয়ে দিচ্ছি"!
    - Speak the medical advice, diagnosis questions, or product answers directly to the patient as if you are speaking in person or sending a personal doctor's voice message!

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
          maxOutputTokens: 140,
          temperature: 0.45,
        },
      });

      const userPrompt = `Customer message: "${effectiveMessage}". Provide an accurate, helpful reply:`;
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

        if (options.chatHistory && options.chatHistory.length > 0) {
          reply = reply.replace(/^(হ্যালো\s*ভাইয়া[,।!?]?|হাই\s*ভাইয়া[,।!?]?)/gi, "").trim();
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