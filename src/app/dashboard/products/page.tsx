"use client";

import { useState, useEffect } from "react";

interface Product {
  id: number;
  sl: number;
  name: string;
  imageFile: string;
  imageUrl: string | null;
  generic: string;
  manufacturer: string;
  dosageForm: string;
  painPoints: string;
  superiority: string;
  ageSolutions: string;
  objections: Array<{ objection: string; script: string }>;
  dietary: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

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

  return (
    <div style={{ height: "100%", overflow: "auto", background: "#0a0a0f", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px 0", background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)" }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, background: "linear-gradient(90deg, #a855f7, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          🏥 প্রোডাক্ট ডেটা ড্যাশবোর্ড
        </h1>
        <p style={{ color: "#8b8b9e", marginTop: 6, fontSize: 14 }}>
          Data Deshbord থেকে সরাসরি লোড — {products.length} টি প্রোডাক্ট
        </p>

        {/* Search */}
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 12, marginTop: 20, marginBottom: 24 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="প্রোডাক্ট খুঁজুন... (যেমন: Dream Touch, Lion)"
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
      <div style={{ padding: "0 32px 32px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "#8b8b9e" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <p>প্রোডাক্ট লোড হচ্ছে...</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
            {products.map((product) => (
              <div
                key={product.id}
                onClick={() => setSelected(product)}
                style={{
                  background: "linear-gradient(135deg, #13131f, #1a1a2e)",
                  borderRadius: 16, overflow: "hidden", cursor: "pointer",
                  border: "1px solid #2a2a3e", transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#a855f7";
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 16px 40px rgba(168,85,247,0.2)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#2a2a3e";
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                }}
              >
                {/* Product Image */}
                <div style={{ position: "relative", height: 200, background: "#0f0f1a", overflow: "hidden" }}>
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
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 64 }}>
                      💊
                    </div>
                  )}
                  <div style={{
                    position: "absolute", top: 8, right: 8,
                    background: "rgba(168,85,247,0.9)", borderRadius: 8,
                    padding: "4px 10px", fontSize: 12, fontWeight: 600,
                  }}>
                    #{product.sl}
                  </div>
                </div>

                {/* Product Info */}
                <div style={{ padding: "16px" }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>
                    {product.name}
                  </h3>
                  {product.manufacturer && (
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6b6b7e" }}>
                      {product.manufacturer.slice(0, 60)}...
                    </p>
                  )}
                  {product.dosageForm && (
                    <div style={{ marginTop: 10, padding: "6px 10px", background: "#1f1f30", borderRadius: 8, fontSize: 12, color: "#a855f7" }}>
                      📦 {product.dosageForm}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelected(product); }}
                      style={{
                        flex: 1, padding: "8px", borderRadius: 10, border: "none",
                        background: "linear-gradient(135deg, #a855f7, #3b82f6)",
                        color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      বিস্তারিত দেখুন
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 20, backdropFilter: "blur(4px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#13131f", borderRadius: 20, width: "100%", maxWidth: 700,
              maxHeight: "90vh", overflow: "auto", border: "1px solid #2a2a3e",
            }}
          >
            {/* Modal Header */}
            <div style={{ position: "sticky", top: 0, background: "#13131f", padding: "20px 24px", borderBottom: "1px solid #2a2a3e", display: "flex", alignItems: "center", gap: 16, zIndex: 1 }}>
              {selected.imageUrl && !imageErrors.has(selected.imageFile) ? (
                <img
                  src={selected.imageUrl}
                  alt={selected.name}
                  style={{ width: 60, height: 60, borderRadius: 12, objectFit: "cover" }}
                  onError={() => setImageErrors(prev => new Set(prev).add(selected.imageFile))}
                />
              ) : (
                <div style={{ width: 60, height: 60, borderRadius: 12, background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>💊</div>
              )}
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, background: "linear-gradient(90deg, #a855f7, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {selected.name}
                </h2>
                <p style={{ margin: "4px 0 0", color: "#6b6b7e", fontSize: 13 }}>{selected.dosageForm}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: "#1a1a2e", border: "1px solid #2a2a3e", color: "#fff", borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 16 }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: 24 }}>
              {/* Manufacturer */}
              {selected.manufacturer && (
                <InfoSection title="🏭 প্রস্তুতকারক" content={selected.manufacturer} />
              )}

              {/* Generic */}
              {selected.generic && (
                <InfoSection title="🧪 জেনেরিক ক্লাস" content={selected.generic} />
              )}

              {/* Pain Points */}
              {selected.painPoints && (
                <InfoSection title="⚠️ কাস্টমারের সমস্যা (Pain Points)" content={selected.painPoints} highlight />
              )}

              {/* Superiority */}
              {selected.superiority && (
                <InfoSection title="🏆 শ্রেষ্ঠত্ব" content={selected.superiority} />
              )}

              {/* Age Solutions */}
              {selected.ageSolutions && (
                <InfoSection title="👥 বয়স অনুযায়ী সমাধান" content={selected.ageSolutions} />
              )}

              {/* Dietary */}
              {selected.dietary && (
                <InfoSection title="🥗 খাদ্যাভ্যাস পরামর্শ" content={selected.dietary} />
              )}

              {/* Objections */}
              {Array.isArray(selected.objections) && selected.objections.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ color: "#f59e0b", margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>💬 কঠিন প্রশ্নের উত্তর (Objections)</h4>
                  {selected.objections.map((obj: {objection: string; script: string}, i: number) => (
                    <div key={i} style={{ background: "#1a1a2e", borderRadius: 12, padding: 16, marginBottom: 10, border: "1px solid #2a2a3e" }}>
                      <p style={{ color: "#f59e0b", margin: "0 0 8px", fontSize: 13, fontWeight: 600 }}>❓ {obj.objection}</p>
                      <p style={{ color: "#d1d1e0", margin: 0, fontSize: 13, lineHeight: 1.6 }}>💡 {obj.script}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoSection({ title, content, highlight }: { title: string; content: string; highlight?: boolean }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h4 style={{ color: highlight ? "#f87171" : "#a855f7", margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>{title}</h4>
      <div style={{
        background: "#1a1a2e", borderRadius: 12, padding: 16,
        border: `1px solid ${highlight ? "#2a1a1a" : "#2a2a3e"}`,
        color: "#d1d1e0", fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-line",
      }}>
        {content}
      </div>
    </div>
  );
}
