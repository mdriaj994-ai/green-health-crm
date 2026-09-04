"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Product {
  id: number;
  sl: string;
  name: string;
  imageFile: string;
  imageUrl: string | null;
  generic: string;
  manufacturer: string;
  dosageForm: string;
  painPoints: string;
  superiority?: string;
  ageSolutions?: string;
  authenticity?: string;
  objections?: Array<{ objection: string; script: string }>;
  dietary?: string;
  specialists?: Array<{ name: string; title?: string; institute: string; quote: string; flag?: string }>;
  custom_price: string;
  discount_price: string;
  custom_note: string;
  custom_pitch: string;
  custom_details: string;
  stock_status: "in_stock" | "limited" | "out_of_stock";
  stock_count: string;
  last_updated: string;
}

type SaveStatus = "idle" | "typing" | "saving" | "saved" | "error";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedTime, setLastSavedTime] = useState<string>("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingProductRef = useRef<Product | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/products${search ? `?search=${encodeURIComponent(search)}` : ""}`
      );
      const data = await res.json();
      setProducts(data.products || []);
    } catch {
      console.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchProducts();
  }

  // Auto-Save Function to send updates to VPS
  const executeAutoSave = useCallback(async (productToSave: Product) => {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sl: productToSave.sl,
          custom_price: productToSave.custom_price,
          discount_price: productToSave.discount_price,
          custom_note: productToSave.custom_note,
          custom_pitch: productToSave.custom_pitch,
          custom_details: productToSave.custom_details,
          stock_status: productToSave.stock_status,
          stock_count: productToSave.stock_count,
          dosageForm: productToSave.dosageForm,
          painPoints: productToSave.painPoints,
        }),
      });

      if (!res.ok) throw new Error("Save failed");

      const now = new Date().toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setLastSavedTime(now);
      setSaveStatus("saved");

      // Update in master list
      setProducts((prev) =>
        prev.map((p) => (p.sl === productToSave.sl ? { ...p, ...productToSave, last_updated: now } : p))
      );

      // Return to idle after 3s
      setTimeout(() => {
        setSaveStatus((curr) => (curr === "saved" ? "idle" : curr));
      }, 3000);
    } catch (err) {
      console.error("[AUTO_SAVE_ERROR]", err);
      setSaveStatus("error");
    }
  }, []);

  // Field change handler with 2-second debouncing
  function handleFieldChange(field: keyof Product, value: any) {
    if (!selected) return;

    const updated = { ...selected, [field]: value };
    setSelected(updated);
    pendingProductRef.current = updated;
    setSaveStatus("typing");

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Trigger auto-save exactly 2 seconds (2000ms) after typing stops
    debounceTimerRef.current = setTimeout(() => {
      if (pendingProductRef.current) {
        executeAutoSave(pendingProductRef.current);
      }
    }, 2000);
  }

  // Flush pending save immediately if modal closes
  function closeModal() {
    if (debounceTimerRef.current && pendingProductRef.current) {
      clearTimeout(debounceTimerRef.current);
      executeAutoSave(pendingProductRef.current);
    }
    setSelected(null);
    setSaveStatus("idle");
  }

  return (
    <div style={{ height: "100%", overflow: "auto", background: "#0a0a0f", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px 16px", background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)", borderBottom: "1px solid #1f1f33" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, background: "linear-gradient(90deg, #a855f7, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              🏥 মেডিসিন মাস্টার লাইভ ড্যাশবোর্ড
            </h1>
            <p style={{ color: "#9ca3af", marginTop: 6, fontSize: 13 }}>
              ভিপিএস ক্লাউড স্টোরেজ থেকে লাইভ সংযুক্ত — মোট {products.length} টি ওষুধ (অটো-সেভ সক্রিয়)
            </p>
          </div>

          {/* Mega Encyclopedia and VPS Live Sync Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <a
              href="/dashboard/encyclopedia"
              target="_blank"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #2563eb)",
                color: "#fff",
                padding: "8px 18px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.2)",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
              }}
            >
              📖 সম্পূর্ণ ৫৭টি ওষুধের ইন-ডিটেইলস মেগা এনসাইক্লোপিডিয়া ভিউ
            </a>

            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#13131f", padding: "8px 16px", borderRadius: 12, border: "1px solid #2a2a3e" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981", display: "inline-block", boxShadow: "0 0 8px #10b981" }} />
              <span style={{ fontSize: 13, color: "#10b981", fontWeight: 600 }}>ভিপিএস অলটাইম লাইভ (২৪/৭)</span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 12, marginTop: 18, marginBottom: 8 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ওষুধ খুঁজুন... (যেমন: Soul Mate, Rheumarex, লিভার, বাত, ব্যথা)"
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 12, border: "1px solid #2a2a3e",
              background: "#13131f", color: "#fff", fontSize: 14, outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "12px 24px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #a855f7, #3b82f6)", color: "#fff",
              fontWeight: 600, cursor: "pointer", fontSize: 14,
            }}
          >
            🔍 খুঁজুন
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(""); setTimeout(fetchProducts, 100); }}
              style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid #2a2a3e", background: "transparent", color: "#8b8b9e", cursor: "pointer" }}
            >
              ✕ Clear
            </button>
          )}
        </form>
      </div>

      {/* Grid */}
      <div style={{ padding: "24px 32px 32px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "#8b8b9e" }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>⏳</div>
            <p style={{ fontSize: 16 }}>লাইভ মেডিসিন ডেটা লোড হচ্ছে...</p>
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#8b8b9e" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <p>কোনো ওষুধ পাওয়া যায়নি। অন্য নাম লিখে সার্চ করুন।</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {products.map((product) => {
              const currentPrice = product.discount_price || product.custom_price;
              return (
                <div
                  key={product.sl}
                  onClick={() => setSelected(product)}
                  style={{
                    background: "linear-gradient(135deg, #13131f, #1a1a2e)",
                    borderRadius: 16, overflow: "hidden", cursor: "pointer",
                    border: "1px solid #232338", transition: "all 0.2s",
                    display: "flex", flexDirection: "column",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "#a855f7";
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 32px rgba(168,85,247,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "#232338";
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                  }}
                >
                  {/* Product Image */}
                  <div style={{ position: "relative", height: 180, background: "#0b0b14", overflow: "hidden" }}>
                    {product.imageUrl && !imageErrors.has(product.imageFile) ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={() => {
                          setImageErrors(prev => new Set(prev).add(product.imageFile));
                        }}
                      />
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 56 }}>
                        💊
                      </div>
                    )}
                    <div style={{
                      position: "absolute", top: 10, left: 10,
                      background: "rgba(168,85,247,0.9)", borderRadius: 8,
                      padding: "4px 10px", fontSize: 12, fontWeight: 700,
                    }}>
                      SL #{product.sl}
                    </div>

                    {/* Stock Status Badge */}
                    <div style={{
                      position: "absolute", top: 10, right: 10,
                      background: product.stock_status === "out_of_stock" ? "#ef4444" : product.stock_status === "limited" ? "#f59e0b" : "#10b981",
                      borderRadius: 8, padding: "4px 8px", fontSize: 11, fontWeight: 600, color: "#fff",
                    }}>
                      {product.stock_status === "out_of_stock" ? "স্টক শেষ" : product.stock_status === "limited" ? "সীমিত স্টক" : "ইন স্টক"}
                    </div>
                  </div>

                  {/* Product Info */}
                  <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>
                        {product.name}
                      </h3>
                      {product.manufacturer && (
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>
                          {product.manufacturer}
                        </p>
                      )}

                      {/* Pricing Tag */}
                      <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 8 }}>
                        {product.discount_price ? (
                          <>
                            <span style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>
                              ৳{product.discount_price}
                            </span>
                            {product.custom_price && (
                              <span style={{ fontSize: 13, textDecoration: "line-through", color: "#6b7280" }}>
                                ৳{product.custom_price}
                              </span>
                            )}
                          </>
                        ) : product.custom_price ? (
                          <span style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>
                            ৳{product.custom_price}
                          </span>
                        ) : (
                          <span style={{ fontSize: 13, color: "#8b5cf6" }}>
                            মূল্য নির্ধারণ করতে ক্লিক করুন
                          </span>
                        )}
                      </div>

                      {product.custom_note && (
                        <div style={{ marginTop: 8, padding: "4px 8px", background: "#2e1065", borderRadius: 6, fontSize: 11, color: "#d8b4fe" }}>
                          🎁 {product.custom_note}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); setSelected(product); }}
                      style={{
                        marginTop: 14, width: "100%", padding: "10px", borderRadius: 10, border: "none",
                        background: "linear-gradient(135deg, #a855f7, #3b82f6)",
                        color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      ✏️ লাইভ এডিট ও তথ্য (অটো-সেভ)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Product Edit & Detail Modal with 2-Second Debounced Auto-Save */}
      {selected && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 16, backdropFilter: "blur(6px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#13131f", borderRadius: 20, width: "100%", maxWidth: 840,
              maxHeight: "92vh", display: "flex", flexDirection: "column", border: "1px solid #2a2a3e",
              boxShadow: "0 25px 60px rgba(0,0,0,0.7)",
            }}
          >
            {/* Modal Header with Auto-Save Status */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #232338", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {selected.imageUrl && !imageErrors.has(selected.imageFile) ? (
                  <img
                    src={selected.imageUrl}
                    alt={selected.name}
                    style={{ width: 50, height: 50, borderRadius: 10, objectFit: "cover" }}
                  />
                ) : (
                  <div style={{ width: 50, height: 50, borderRadius: 10, background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>💊</div>
                )}
                <div>
                  <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#fff" }}>
                    {selected.name} <span style={{ fontSize: 13, color: "#a855f7" }}>#{selected.sl}</span>
                  </h2>
                  <p style={{ margin: "2px 0 0", color: "#9ca3af", fontSize: 12 }}>
                    যেকোনো বক্সে টাইপ করলে ২ সেকেন্ডের মধ্যে স্বয়ংক্রিয়ভাবে ভিপিএসে সেভ হবে
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Dynamic Auto-Save Pill */}
                <div style={{
                  padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 6,
                  background:
                    saveStatus === "typing" ? "rgba(245, 158, 11, 0.15)" :
                    saveStatus === "saving" ? "rgba(59, 130, 246, 0.15)" :
                    saveStatus === "saved" ? "rgba(16, 185, 129, 0.15)" :
                    saveStatus === "error" ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.1)",
                  color:
                    saveStatus === "typing" ? "#f59e0b" :
                    saveStatus === "saving" ? "#3b82f6" :
                    saveStatus === "saved" ? "#10b981" :
                    saveStatus === "error" ? "#ef4444" : "#10b981",
                  border: `1px solid ${
                    saveStatus === "typing" ? "#f59e0b" :
                    saveStatus === "saving" ? "#3b82f6" :
                    saveStatus === "saved" ? "#10b981" :
                    saveStatus === "error" ? "#ef4444" : "rgba(34, 197, 94, 0.3)"
                  }`,
                }}>
                  {saveStatus === "typing" && "⏳ টাইপ করছেন..."}
                  {saveStatus === "saving" && "🔄 ২ সেকেন্ডে সেভ হচ্ছে..."}
                  {saveStatus === "saved" && `✓ ভিপিএসে সংরক্ষিত (${lastSavedTime || "এখন"})`}
                  {saveStatus === "idle" && (lastSavedTime ? `✓ সেভ আছে (${lastSavedTime})` : "✓ ভিপিএসে সেভ আছে")}
                  {saveStatus === "error" && "✕ সেভ এরর (পুনরায় লিখুন)"}
                </div>

                <button
                  onClick={closeModal}
                  style={{ background: "#1a1a2e", border: "1px solid #2a2a3e", color: "#fff", borderRadius: 10, width: 34, height: 34, cursor: "pointer", fontSize: 16 }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body: Editable Fields */}
            <div style={{ padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
              
              {/* Row 1: Pricing & Stock */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, background: "#181829", padding: 18, borderRadius: 14, border: "1px solid #232338" }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                    💰 রেগুলার মূল্য (টাকা)
                  </label>
                  <input
                    type="text"
                    value={selected.custom_price || ""}
                    onChange={(e) => handleFieldChange("custom_price", e.target.value)}
                    placeholder="যেমন: ৩,৫০০ বা 3500"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "#0e0e18", border: "1px solid #2e2e48", color: "#fff", fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#34d399", marginBottom: 6 }}>
                    🏷️ অফার/ডিসকাউন্ট মূল্য (টাকা)
                  </label>
                  <input
                    type="text"
                    value={selected.discount_price || ""}
                    onChange={(e) => handleFieldChange("discount_price", e.target.value)}
                    placeholder="যেমন: ৩,০০০ বা 3000"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "#0e0e18", border: "1px solid #10b981", color: "#10b981", fontWeight: 700, fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                    📦 স্টক স্ট্যাটাস
                  </label>
                  <select
                    value={selected.stock_status || "in_stock"}
                    onChange={(e) => handleFieldChange("stock_status", e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "#0e0e18", border: "1px solid #2e2e48", color: "#fff", fontSize: 14 }}
                  >
                    <option value="in_stock">পর্যাপ্ত স্টক আছে (In Stock)</option>
                    <option value="limited">সীমিত স্টক (Limited Stock)</option>
                    <option value="out_of_stock">স্টক শেষ (Out of Stock)</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Special Offer & Pitch */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#a855f7", marginBottom: 6 }}>
                    🎁 বিশেষ অফার / শর্ত (এআই কাস্টমারকে এই অফার বলবে)
                  </label>
                  <input
                    type="text"
                    value={selected.custom_note || ""}
                    onChange={(e) => handleFieldChange("custom_note", e.target.value)}
                    placeholder="যেমন: ২ ফাইল নিলে ফ্রি হোম ডেলিভারি! ১০০% ক্যাশ অন ডেলিভারি।"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "#181829", border: "1px solid #2e2e48", color: "#fff", fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#60a5fa", marginBottom: 6 }}>
                    🦁 হাকিম সাহেবের আলটিমেট সেলস পিচ ও উপাদান
                  </label>
                  <textarea
                    rows={2}
                    value={selected.custom_pitch || ""}
                    onChange={(e) => handleFieldChange("custom_pitch", e.target.value)}
                    placeholder="যেমন: খাঁটি হরিণের কস্তুরি, শোধন করা পারদ, আসল হিমালয়ান শিলাজিৎ সমৃদ্ধ ২৫ বছরের অভিজ্ঞ রাজকীয় ফর্মুলা।"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "#181829", border: "1px solid #2e2e48", color: "#fff", fontSize: 13, resize: "vertical" }}
                  />
                </div>
              </div>

              {/* Row 3: Dosage & Solution */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#38bdf8", marginBottom: 6 }}>
                    💊 সেবনবিধি ও ডোজ ফর্ম (Dosage / How to Take)
                  </label>
                  <textarea
                    rows={3}
                    value={selected.dosageForm || ""}
                    onChange={(e) => handleFieldChange("dosageForm", e.target.value)}
                    placeholder="যেমন: ২ ক্যাপসুল করে দিনে ১-২ বার খাবারের পর কুসুম গরম দুধ বা পানিসহ সেব্য।"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "#181829", border: "1px solid #2e2e48", color: "#fff", fontSize: 13, resize: "vertical" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#f87171", marginBottom: 6 }}>
                    ⚠️ কাস্টমারের শারীরিক সমস্যা ও সমাধান (Pain Points)
                  </label>
                  <textarea
                    rows={3}
                    value={selected.painPoints || ""}
                    onChange={(e) => handleFieldChange("painPoints", e.target.value)}
                    placeholder="রোগের লক্ষণ ও এই ওষুধ কীভাবে উপশম করে তা লিখুন..."
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "#181829", border: "1px solid #2e2e48", color: "#fff", fontSize: 13, resize: "vertical" }}
                  />
                </div>
              </div>

              {/* Row 4: Custom Details / Extra notes */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#9ca3af", marginBottom: 6 }}>
                  📝 অতিরিক্ত তথ্য ও হাকিমের পরামর্শ (Custom Details)
                </label>
                <textarea
                  rows={2}
                  value={selected.custom_details || ""}
                  onChange={(e) => handleFieldChange("custom_details", e.target.value)}
                  placeholder="যেকোনো বিশেষ নির্দেশনা..."
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "#181829", border: "1px solid #2e2e48", color: "#fff", fontSize: 13, resize: "vertical" }}
                />
              </div>

              {/* SECTION: 5 Named Specialists & Doctors */}
              {selected.specialists && selected.specialists.length > 0 && (
                <div style={{ background: "#141424", borderRadius: 14, padding: 18, border: "1px solid #232338" }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "#38bdf8", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    🩺 বিশ্বখ্যাত ৫ ডাক্তার ও হাকিমদের উক্তি
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {selected.specialists.map((sp, idx) => (
                      <div key={idx} style={{ background: "#0c0c16", padding: 12, borderRadius: 10, borderLeft: "3px solid #38bdf8" }}>
                        <div style={{ fontWeight: 700, color: "#93c5fd", fontSize: 13 }}>{sp.name} {sp.flag || ""}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>{sp.title ? `${sp.title}, ` : ""}{sp.institute}</div>
                        <div style={{ fontSize: 12, color: "#e2e8f0", fontStyle: "italic", lineHeight: 1.5 }}>"{sp.quote}"</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION: 4 Customer Objections & Scripts */}
              {selected.objections && selected.objections.length > 0 && (
                <div style={{ background: "#141424", borderRadius: 14, padding: 18, border: "1px solid #232338" }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "#fb7185", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    🥊 কাস্টমারের ৪টি কঠিন আপত্তি ও উত্তর (Objection Destroyers)
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {selected.objections.map((obj, idx) => (
                      <div key={idx} style={{ background: "#0c0c16", padding: 12, borderRadius: 10, borderLeft: "3px solid #fb7185" }}>
                        <div style={{ fontWeight: 700, color: "#fda4af", fontSize: 13, marginBottom: 4 }}>❓ {obj.objection}</div>
                        <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>💡 {obj.script}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION: Dietary Blueprint */}
              {selected.dietary && (
                <div style={{ background: "#141424", borderRadius: 14, padding: 18, border: "1px solid #232338" }}>
                  <h4 style={{ margin: "0 0 8px", fontSize: 14, color: "#34d399", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    🥗 পুষ্টি ও দ্রুত ফলাফল পাওয়ার খাদ্যাভ্যাস (Dietary Blueprint)
                  </h4>
                  <div style={{ fontSize: 12, color: "#cbd5e1", whiteSpace: "pre-line", lineHeight: 1.6, background: "#0c0c16", padding: 12, borderRadius: 10 }}>
                    {selected.dietary}
                  </div>
                </div>
              )}

              {/* SECTION: Superiority Matrix */}
              {selected.superiority && (
                <div style={{ background: "#141424", borderRadius: 14, padding: 18, border: "1px solid #232338" }}>
                  <h4 style={{ margin: "0 0 8px", fontSize: 14, color: "#fbbf24", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    👑 বাজারের অন্যান্য ওষুধের সাথে শ্রেষ্ঠত্ব (Superiority Matrix)
                  </h4>
                  <div style={{ fontSize: 12, color: "#cbd5e1", whiteSpace: "pre-line", lineHeight: 1.6, background: "#0c0c16", padding: 12, borderRadius: 10 }}>
                    {selected.superiority}
                  </div>
                </div>
              )}

              {/* SECTION: Age-Specific Solutions */}
              {selected.ageSolutions && (
                <div style={{ background: "#141424", borderRadius: 14, padding: 18, border: "1px solid #232338" }}>
                  <h4 style={{ margin: "0 0 8px", fontSize: 14, color: "#c084fc", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    👥 বয়স ভিত্তিক সমাধান (Age-Specific Solutions)
                  </h4>
                  <div style={{ fontSize: 12, color: "#cbd5e1", whiteSpace: "pre-line", lineHeight: 1.6, background: "#0c0c16", padding: 12, borderRadius: 10 }}>
                    {selected.ageSolutions}
                  </div>
                </div>
              )}

              {/* Live Status Banner */}
              <div style={{
                padding: "12px 16px", borderRadius: 10, background: "#161626", border: "1px solid #232338",
                display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "#9ca3af"
              }}>
                <span>💡 কোনো "Save" বাটন চাপার দরকার নেই। টাইপ থামানোর ২ সেকেন্ডের মধ্যে স্বয়ংক্রিয়ভাবে ক্লাউডে সেভ হবে।</span>
                <span style={{ color: "#a855f7", fontWeight: 600 }}>{selected.last_updated ? `সর্বশেষ আপডেট: ${selected.last_updated}` : ""}</span>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
