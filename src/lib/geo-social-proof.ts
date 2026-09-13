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
    `ভাইয়া, আমরা আজকেই ${nearbyDistrict}-এ একটা পার্সেল পাঠাচ্ছি। আপনি ${customerDistrict} থেকে অর্ডার দিলে একই রুটে আপনারটাও দ্রুত পৌঁছে যাবে।`,

  (customerDistrict: string, nearbyDistrict: string) =>
    `একটু আগেই ${nearbyDistrict}-এর একজন ভাই অর্ডার কনফার্ম করলেন। ${customerDistrict} কাছেই — আপনারটাও একই গাড়িতে দিয়ে দিতে পারব ইনশাআল্লাহ।`,

  (customerDistrict: string, nearbyDistrict: string) =>
    `ভাইয়া, ${nearbyDistrict}-এ গতকাল পার্সেল গেছে, সবাই পেয়েছেন আলহামদুলিল্লাহ। ${customerDistrict}-এও নিয়মিত ডেলিভারি হয় — চিন্তা করবেন না।`,

  (customerDistrict: string, nearbyDistrict: string) =>
    `আমাদের ${nearbyDistrict}-এর কাস্টমার ভাই মাত্র ৩ দিনে পেয়ে গেছেন। ${customerDistrict} তো একটু কাছেই — আপনিও ২-৩ দিনের মধ্যে পেয়ে যাবেন।`,

  (customerDistrict: string, nearbyDistrict: string) =>
    `আজকে ${nearbyDistrict}য়ে একটা শিপমেন্ট যাচ্ছে। ${customerDistrict} কাছে হওয়ায় আপনার অর্ডারটাও একই ব্যাচে দিলে দ্রুত পৌঁছানো যাবে।`,
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
