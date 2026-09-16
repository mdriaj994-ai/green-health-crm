// geo-social-proof.ts
// Hyper-local delivery social proof engine
// Imports all Bangladesh geo-data from bangladesh-geodata.ts (self-contained, no VPS/API needed)
// ─────────────────────────────────────────────────────────────────────────────

import {
  LOCATION_TO_DISTRICT,
  DISTRICT_NEIGHBORS,
  BANGLISH_LOCATION_ALIASES,
  detectDistrictFromText,
  getRandomNeighborDistrict,
} from "./bangladesh-geodata";

// ─────────────────────────────────────────────────────────────────────────────
// Social Proof Templates (random rotation for natural feel)
// ─────────────────────────────────────────────────────────────────────────────
const DELIVERY_PROOF_TEMPLATES = [
  (customerDistrict: string, nearbyDistrict: string) =>
    `জি ভাইয়া, আজকে আপনাদের পাশের এলাকা ${nearbyDistrict}-এ আমাদের পার্সেল যাচ্ছে। আপনি ${customerDistrict} থেকে অর্ডার করলে ওই পার্সেলের সাথে আপনারটাও একবারে পাঠিয়ে দিব, তাহলে খুব তাড়াতাড়ি আপনি পার্সেল পেয়ে যাবেন ইনশাআল্লাহ।`,

  (customerDistrict: string, nearbyDistrict: string) =>
    `ভাইয়া, আমরা আজকেই ${nearbyDistrict}-এ একটা পার্সেল পাঠাচ্ছি। আপনি ${customerDistrict} থেকে অর্ডার দিলে একই রুটে আপনারটাও দ্রুত পৌঁছে যাবে।`,

  (customerDistrict: string, nearbyDistrict: string) =>
    `একটু আগেই ${nearbyDistrict}-এর একজন ভাই অর্ডার কনফার্ম করলেন। ${customerDistrict} কাছেই — আপনারটাও একই পার্সেলের সাথে দিয়ে দিতে পারব ইনশাআল্লাহ।`,

  (customerDistrict: string, nearbyDistrict: string) =>
    `ভাইয়া, ${nearbyDistrict}-এ নিয়মিত পার্সেল যাচ্ছে, সবাই সময়মতো পেয়েছেন আলহামদুলিল্লাহ। ${customerDistrict}-এও আজই পাঠিয়ে দিতে পারব — চিন্তা করবেন না।`,

  (customerDistrict: string, nearbyDistrict: string) =>
    `আমাদের ${nearbyDistrict}-এর কাস্টমার ভাই মাত্র ২ দিনে পেয়ে গেছেন। ${customerDistrict} তো একদম কাছেই — আপনারটাও একই ব্যাচে পাঠিয়ে দিলে দ্রুত পেয়ে যাবেন।`,
];

// ─────────────────────────────────────────────────────────────────────────────
// Core: build social proof from a canonical district name
// ─────────────────────────────────────────────────────────────────────────────
export function buildGeoSocialProof(
  customerDistrictRaw: string | null | undefined
): string {
  if (!customerDistrictRaw) return "";

  // Normalize: try direct lookup first, then text detection
  const lower = customerDistrictRaw.toLowerCase().trim();
  const canonicalDistrict =
    BANGLISH_LOCATION_ALIASES[lower] ||
    LOCATION_TO_DISTRICT[customerDistrictRaw] ||
    (detectDistrictFromText(customerDistrictRaw) ?? customerDistrictRaw);

  const nearbyDistrict = getRandomNeighborDistrict(canonicalDistrict);
  if (!nearbyDistrict) return "";

  const template =
    DELIVERY_PROOF_TEMPLATES[
      Math.floor(Math.random() * DELIVERY_PROOF_TEMPLATES.length)
    ];
  return template(canonicalDistrict, nearbyDistrict);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point: extracts district from profile + message, returns proof line
// Priority: stored district > recent message text > stored thana
// ─────────────────────────────────────────────────────────────────────────────
export function getGeoSocialProofFromProfile(
  storedDistrict?: string,
  storedThana?: string,
  recentMessageText?: string
): string {
  // Priority 1: stored district
  if (storedDistrict && storedDistrict.trim() && storedDistrict !== "N/A") {
    const proof = buildGeoSocialProof(storedDistrict);
    if (proof) return proof;
  }

  // Priority 2: detect from latest customer message (upazila/union/village level)
  if (recentMessageText) {
    const detected = detectDistrictFromText(recentMessageText);
    if (detected) {
      const proof = buildGeoSocialProof(detected);
      if (proof) return proof;
    }
  }

  // Priority 3: detect from stored thana
  if (storedThana && storedThana.trim() && storedThana !== "N/A") {
    const detected = detectDistrictFromText(storedThana);
    if (detected) {
      const proof = buildGeoSocialProof(detected);
      if (proof) return proof;
    }
  }

  return "";
}

// Re-export detection function so ai.ts can use it directly if needed
export { detectDistrictFromText } from "./bangladesh-geodata";
