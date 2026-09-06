"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search,
  Sparkles,
  Package,
  ShieldCheck,
  Zap,
  Tag,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  ChevronRight,
  Flame,
  Award,
  Stethoscope,
  HeartPulse,
  DollarSign,
  Layers,
  ArrowUpDown,
  Check,
  RefreshCw,
  Info,
  Edit3
} from "lucide-react";

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
type FilterCategory = "all" | "in_stock" | "discounted" | "mens" | "pain" | "gastric";
type ModalTab = "pricing" | "pitch" | "clinical" | "specialists";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");
  const [modalTab, setModalTab] = useState<ModalTab>("pricing");
  const [sortBy, setSortBy] = useState<"sl" | "price_low" | "price_high">("sl");

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

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (pendingProductRef.current) {
        executeAutoSave(pendingProductRef.current);
      }
    }, 1800);
  }

  function closeModal() {
    if (debounceTimerRef.current && pendingProductRef.current) {
      clearTimeout(debounceTimerRef.current);
      executeAutoSave(pendingProductRef.current);
    }
    setSelected(null);
    setSaveStatus("idle");
    setModalTab("pricing");
  }

  // Filter & Sort Products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Filter by category
    if (activeFilter === "in_stock") {
      result = result.filter(p => p.stock_status !== "out_of_stock");
    } else if (activeFilter === "discounted") {
      result = result.filter(p => !!p.discount_price);
    } else if (activeFilter === "mens") {
      result = result.filter(p => {
        const text = `${p.name} ${p.generic} ${p.painPoints}`.toLowerCase();
        return text.includes("strong") || text.includes("burner") || text.includes("touch") || text.includes("velvet") || text.includes("শক্তি") || text.includes("বীর্য") || text.includes("যৌন");
      });
    } else if (activeFilter === "pain") {
      result = result.filter(p => {
        const text = `${p.name} ${p.generic} ${p.painPoints}`.toLowerCase();
        return text.includes("বাত") || text.includes("ব্যথা") || text.includes("rheum") || text.includes("mobic");
      });
    } else if (activeFilter === "gastric") {
      result = result.filter(p => {
        const text = `${p.name} ${p.generic} ${p.painPoints}`.toLowerCase();
        return text.includes("গ্যাস") || text.includes("লিভার") || text.includes("পেট") || text.includes("pepto") || text.includes("zymo");
      });
    }

    // Sort
    if (sortBy === "price_low") {
      result.sort((a, b) => {
        const pA = parseFloat((a.discount_price || a.custom_price || "0").replace(/[^0-9.]/g, "")) || 0;
        const pB = parseFloat((b.discount_price || b.custom_price || "0").replace(/[^0-9.]/g, "")) || 0;
        return pA - pB;
      });
    } else if (sortBy === "price_high") {
      result.sort((a, b) => {
        const pA = parseFloat((a.discount_price || a.custom_price || "0").replace(/[^0-9.]/g, "")) || 0;
        const pB = parseFloat((b.discount_price || b.custom_price || "0").replace(/[^0-9.]/g, "")) || 0;
        return pB - pA;
      });
    } else {
      result.sort((a, b) => parseInt(a.sl || "0") - parseInt(b.sl || "0"));
    }

    return result;
  }, [products, activeFilter, sortBy]);

  // Statistics
  const totalCount = products.length;
  const inStockCount = products.filter(p => p.stock_status !== "out_of_stock").length;
  const offerCount = products.filter(p => !!p.discount_price).length;

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#0a0b12", color: "#f1f5f9", fontFamily: "var(--font-inter, Inter, system-ui, sans-serif)", position: "relative" }}>
      
      {/* ── TOP HEADER BANNER ── */}
      <div style={{ background: "linear-gradient(180deg, #111422 0%, #0d0f1a 100%)", borderBottom: "1px solid #1e2238", padding: "26px 32px 20px" }}>
        
        {/* Title Row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, #7c3aed, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(124,58,237,0.3)" }}>
              <Sparkles style={{ width: 22, height: 22, color: "#fff" }} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px", background: "linear-gradient(90deg, #ffffff 0%, #cbd5e1 50%, #c084fc 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                মেডিসিন মাস্টার লাইভ ড্যাশবোর্ড
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <span style={{ fontSize: 13, color: "#94a3b8" }}>
                  ভিপিএস ক্লাউড স্টোরেজ থেকে লাইভ সংযুক্ত — মোট {totalCount} টি ওষুধ
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 20, background: "rgba(16, 185, 129, 0.12)", color: "#10b981", fontSize: 11, fontWeight: 700 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                  অটো-সেভ সক্রিয়
                </span>
              </div>
            </div>
          </div>

          {/* Action Badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <a
              href="/dashboard/encyclopedia"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "9px 18px", borderRadius: 12,
                background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700,
                border: "1px solid rgba(255,255,255,0.2)",
                boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
                cursor: "pointer"
              }}
            >
              <Award style={{ width: 16, height: 16 }} />
              <span>মেগা এনসাইক্লোপিডিয়া ভিউ</span>
              <ExternalLink style={{ width: 14, height: 14, opacity: 0.8 }} />
            </a>

            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 12, background: "#131624", border: "1px solid #23283e", color: "#10b981", fontSize: 13, fontWeight: 700 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block", boxShadow: "0 0 10px #10b981" }} />
              <span>ভিপিএস লাইভ (২৪/৭)</span>
            </div>
          </div>
        </div>

        {/* ── 4 KPI METRIC CARDS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 22, paddingTop: 18, borderTop: "1px solid #1a1e30" }}>
          
          {/* Card 1 */}
          <div style={{ background: "#131624", border: "1px solid #20253a", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(124, 58, 237, 0.15)", border: "1px solid rgba(124, 58, 237, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#a855f7" }}>
              <Package style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>মোট ওষুধ তালিকা</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginTop: 2 }}>{totalCount} টি ফর্মুলা</div>
            </div>
          </div>

          {/* Card 2 */}
          <div style={{ background: "#131624", border: "1px solid #20253a", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
              <ShieldCheck style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>স্টক সক্রিয়</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#10b981", marginTop: 2 }}>{inStockCount} টি প্রস্তুত</div>
            </div>
          </div>

          {/* Card 3 */}
          <div style={{ background: "#131624", border: "1px solid #20253a", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(59, 130, 246, 0.15)", border: "1px solid rgba(59, 130, 246, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#60a5fa" }}>
              <Tag style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>অফার ও ডিসকাউন্ট</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#60a5fa", marginTop: 2 }}>{offerCount} টি স্পেশাল ডিল</div>
            </div>
          </div>

          {/* Card 4 */}
          <div style={{ background: "#131624", border: "1px solid #20253a", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fbbf24" }}>
              <Zap style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>এআই ক্লোজিং রেডি</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fbbf24", marginTop: 2 }}>৩,০০০৳ মাস্টার কোর্স</div>
            </div>
          </div>

        </div>

        {/* ── SEARCH BAR & SORTING ── */}
        <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          
          {/* Search Form */}
          <form onSubmit={handleSearch} style={{ flex: 1, minWidth: 280, display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search style={{ position: "absolute", left: 14, top: 14, width: 18, height: 18, color: "#64748b" }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ওষুধের নাম বা সমস্যা খুঁজুন... (যেমন: Soul Mate, Dream Touch, Men's Burner, লিভার, বাত, ব্যথা)"
                style={{
                  width: "100%", height: 46, borderRadius: 12,
                  background: "#141724", border: "1px solid #252b42",
                  padding: "0 40px 0 42px", color: "#fff", fontSize: 14,
                  outline: "none", boxSizing: "border-box"
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setTimeout(fetchProducts, 50); }}
                  style={{ position: "absolute", right: 12, top: 13, background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
                >
                  <X style={{ width: 18, height: 18 }} />
                </button>
              )}
            </div>

            <button
              type="submit"
              style={{
                height: 46, padding: "0 22px", borderRadius: 12,
                background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                color: "#fff", border: "none", fontWeight: 700, fontSize: 14,
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                boxShadow: "0 4px 12px rgba(124,58,237,0.25)"
              }}
            >
              <span>খুঁজুন</span>
            </button>
          </form>

          {/* Sort Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 46, padding: "0 14px", borderRadius: 12, background: "#141724", border: "1px solid #252b42", color: "#cbd5e1", fontSize: 13, fontWeight: 600 }}>
            <ArrowUpDown style={{ width: 16, height: 16, color: "#a855f7" }} />
            <span>সাজান:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{ background: "transparent", color: "#fff", fontWeight: 700, border: "none", outline: "none", cursor: "pointer", fontSize: 13 }}
            >
              <option value="sl" style={{ background: "#141724" }}>সিরিয়াল (১-৫৭)</option>
              <option value="price_low" style={{ background: "#141724" }}>মূল্য: কম থেকে বেশি</option>
              <option value="price_high" style={{ background: "#141724" }}>মূল্য: বেশি থেকে কম</option>
            </select>
          </div>

        </div>

        {/* ── FILTER PILLS ROW ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, overflowX: "auto", paddingBottom: 4 }}>
          {[
            { id: "all", label: "সবগুলো ওষুধ", icon: Layers, count: totalCount },
            { id: "in_stock", label: "ইন স্টক", icon: CheckCircle2, count: inStockCount },
            { id: "discounted", label: "স্পেশাল অফার", icon: Flame, count: offerCount },
            { id: "mens", label: "পুরুষ স্বাস্থ্য ও শক্তি", icon: Sparkles },
            { id: "pain", label: "বাত ও জয়েন্ট ব্যথা", icon: HeartPulse },
            { id: "gastric", label: "গ্যাস ও লিভার কেয়ার", icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as FilterCategory)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "8px 16px", borderRadius: 10,
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                  whiteSpace: "nowrap", transition: "all 0.2s",
                  background: isActive ? "#7c3aed" : "#141724",
                  color: isActive ? "#fff" : "#94a3b8",
                  border: isActive ? "1px solid #8b5cf6" : "1px solid #252b42",
                  boxShadow: isActive ? "0 4px 14px rgba(124,58,237,0.3)" : "none"
                }}
              >
                <Icon style={{ width: 14, height: 14 }} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 10, background: isActive ? "rgba(255,255,255,0.25)" : "#202538", color: isActive ? "#fff" : "#cbd5e1" }}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

      </div>

      {/* ── PRODUCT CARDS GRID ── */}
      <div style={{ padding: "28px 32px 60px", maxWidth: 1600, margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ width: 50, height: 50, borderRadius: 16, background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#a855f7" }}>
              <RefreshCw style={{ width: 24, height: 24 }} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>মেডিসিন ডেটা লোড হচ্ছে...</p>
            <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>ভিপিএস ক্লাউড স্টোরেজ থেকে রিয়েল-টাইম তথ্য আনা হচ্ছে</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", background: "#111422", borderRadius: 16, border: "1px solid #1e2235", maxWidth: 500, margin: "40px auto" }}>
            <Search style={{ width: 36, height: 36, color: "#64748b", margin: "0 auto 12px" }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>কোনো ওষুধ পাওয়া যায়নি</h3>
            <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>অন্য কোনো নাম লিখে সার্চ করুন অথবা ফিল্টার পরিবর্তন করুন।</p>
            <button
              onClick={() => { setSearch(""); setActiveFilter("all"); fetchProducts(); }}
              style={{ marginTop: 16, padding: "8px 18px", borderRadius: 10, background: "#7c3aed", color: "#fff", border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
            >
              সব ওষুধ দেখুন
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {filteredProducts.map((product) => {
              const currentPrice = product.discount_price || product.custom_price;
              const isOutOfStock = product.stock_status === "out_of_stock";
              const isLimited = product.stock_status === "limited";

              return (
                <div
                  key={product.sl}
                  onClick={() => setSelected(product)}
                  style={{
                    background: "#131624",
                    borderRadius: 16,
                    border: "1px solid #20253a",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    transition: "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.borderColor = "#7c3aed";
                    el.style.transform = "translateY(-4px)";
                    el.style.boxShadow = "0 14px 30px rgba(124, 58, 237, 0.2)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.borderColor = "#20253a";
                    el.style.transform = "translateY(0)";
                    el.style.boxShadow = "none";
                  }}
                >
                  {/* Product Media */}
                  <div style={{ height: 180, width: "100%", position: "relative", background: "#0a0c14", overflow: "hidden" }}>
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
                      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                        <Stethoscope style={{ width: 44, height: 44, opacity: 0.5 }} />
                        <span style={{ fontSize: 11, marginTop: 6, color: "#64748b" }}>ফর্মুলা #{product.sl}</span>
                      </div>
                    )}

                    {/* Top SL Badge */}
                    <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(124, 58, 237, 0.95)", color: "#fff", fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 7, zIndex: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
                      SL #{product.sl}
                    </div>

                    {/* Top Stock Badge */}
                    <div style={{
                      position: "absolute", top: 10, right: 10,
                      background: isOutOfStock ? "rgba(239, 68, 68, 0.9)" : isLimited ? "rgba(245, 158, 11, 0.9)" : "rgba(16, 185, 129, 0.9)",
                      color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 7, zIndex: 2,
                      display: "flex", alignItems: "center", gap: 5, boxShadow: "0 2px 8px rgba(0,0,0,0.5)"
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
                      <span>{isOutOfStock ? "স্টক শেষ" : isLimited ? "সীমিত স্টক" : "ইন স্টক"}</span>
                    </div>
                  </div>

                  {/* Product Info Body */}
                  <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff", lineHeight: 1.35 }}>
                        {product.name}
                      </h3>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
                        {product.generic || product.manufacturer || "গ্রীন হেলথ ল্যাবরেটরিজ"}
                      </p>

                      {/* Pricing Tag Display */}
                      <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 8 }}>
                        {product.discount_price ? (
                          <>
                            <span style={{ fontSize: 20, fontWeight: 800, color: "#10b981" }}>
                              ৳{product.discount_price}
                            </span>
                            {product.custom_price && (
                              <span style={{ fontSize: 13, textDecoration: "line-through", color: "#64748b" }}>
                                ৳{product.custom_price}
                              </span>
                            )}
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#10b981", background: "rgba(16,185,129,0.12)", padding: "2px 7px", borderRadius: 6, marginLeft: "auto" }}>
                              অফার
                            </span>
                          </>
                        ) : product.custom_price ? (
                          <span style={{ fontSize: 20, fontWeight: 800, color: "#10b981" }}>
                            ৳{product.custom_price}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: "#a855f7", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                            <Info style={{ width: 14, height: 14 }} /> মূল্য নির্ধারণ করুন
                          </span>
                        )}
                      </div>

                      {/* Custom Offer Note Tag */}
                      {product.custom_note && (
                        <div style={{ marginTop: 8, padding: "5px 9px", borderRadius: 8, background: "rgba(124, 58, 237, 0.1)", border: "1px solid rgba(124, 58, 237, 0.25)", color: "#c084fc", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                          <Flame style={{ width: 13, height: 13, color: "#c084fc", flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.custom_note}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelected(product); }}
                      style={{
                        width: "100%", padding: "10px", borderRadius: 10,
                        border: "none", background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                        color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        boxShadow: "0 4px 12px rgba(124,58,237,0.2)"
                      }}
                    >
                      <Edit3 style={{ width: 14, height: 14 }} />
                      <span>লাইভ এডিট ও তথ্য</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL CONSOLE ── */}
      {selected && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 16
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 840, maxHeight: "90vh",
              background: "#121522", borderRadius: 20, border: "1px solid #282d45",
              boxShadow: "0 25px 60px rgba(0,0,0,0.8)", display: "flex", flexDirection: "column",
              overflow: "hidden"
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #20253a", background: "#151828", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {selected.imageUrl && !imageErrors.has(selected.imageFile) ? (
                  <img
                    src={selected.imageUrl}
                    alt={selected.name}
                    style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", border: "1px solid #2b324d" }}
                  />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 10, background: "#1c2035", display: "flex", alignItems: "center", justifyContent: "center", color: "#a855f7" }}>
                    <Stethoscope style={{ width: 24, height: 24 }} />
                  </div>
                )}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff" }}>{selected.name}</h2>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "#7c3aed", color: "#fff" }}>
                      #{selected.sl}
                    </span>
                  </div>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>
                    বক্সে যা লিখবেন তা ২ সেকেন্ডের মধ্যে স্বয়ংক্রিয়ভাবে ভিপিএসে সংরক্ষিত হবে
                  </p>
                </div>
              </div>

              {/* Status Pill & Close */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Auto-Save Live Badge */}
                <div style={{
                  padding: "6px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                  display: "flex", alignItems: "center", gap: 6,
                  background:
                    saveStatus === "typing" ? "rgba(245, 158, 11, 0.15)" :
                    saveStatus === "saving" ? "rgba(59, 130, 246, 0.15)" :
                    saveStatus === "saved" ? "rgba(16, 185, 129, 0.15)" :
                    saveStatus === "error" ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.1)",
                  color:
                    saveStatus === "typing" ? "#fbbf24" :
                    saveStatus === "saving" ? "#60a5fa" :
                    saveStatus === "saved" ? "#10b981" :
                    saveStatus === "error" ? "#f87171" : "#10b981",
                  border: `1px solid ${
                    saveStatus === "typing" ? "#f59e0b" :
                    saveStatus === "saving" ? "#3b82f6" :
                    saveStatus === "saved" ? "#10b981" :
                    saveStatus === "error" ? "#ef4444" : "rgba(34, 197, 94, 0.3)"
                  }`
                }}>
                  {saveStatus === "typing" && <span>⏳ টাইপ করছেন...</span>}
                  {saveStatus === "saving" && <span>🔄 সেভ হচ্ছে...</span>}
                  {saveStatus === "saved" && <span>✓ সংরক্ষিত ({lastSavedTime || "এখন"})</span>}
                  {saveStatus === "idle" && <span>✓ ভিপিএসে সক্রিয়</span>}
                  {saveStatus === "error" && <span>✕ সেভ এরর</span>}
                </div>

                <button
                  onClick={closeModal}
                  style={{ width: 34, height: 34, borderRadius: 10, background: "#1e2235", border: "1px solid #282d45", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <X style={{ width: 18, height: 18 }} />
                </button>
              </div>
            </div>

            {/* Modal Tabs Bar */}
            <div style={{ display: "flex", gap: 8, padding: "10px 24px", background: "#0e101a", borderBottom: "1px solid #1e2235", overflowX: "auto" }}>
              {[
                { id: "pricing", label: "মূল্য ও স্টক পলিসি", icon: DollarSign },
                { id: "pitch", label: "হাকিমি সেলস পিচ ও অফার", icon: Flame },
                { id: "clinical", label: "সেবনবিধি ও সমাধান", icon: HeartPulse },
                { id: "specialists", label: "ডাক্তারদের উক্তি ও আপত্তি খণ্ডন", icon: Stethoscope },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = modalTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setModalTab(tab.id as ModalTab)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 7,
                      padding: "8px 14px", borderRadius: 8, border: "none",
                      fontSize: 12, fontWeight: 700, cursor: "pointer",
                      whiteSpace: "nowrap",
                      background: isActive ? "rgba(124, 58, 237, 0.2)" : "transparent",
                      color: isActive ? "#c084fc" : "#94a3b8",
                      borderBottom: isActive ? "2px solid #a855f7" : "2px solid transparent"
                    }}
                  >
                    <Icon style={{ width: 14, height: 14 }} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
              
              {/* TAB 1: Pricing & Stock */}
              {modalTab === "pricing" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, background: "#151828", padding: 18, borderRadius: 14, border: "1px solid #23283e" }}>
                    
                    {/* Regular Price */}
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                        💰 রেগুলার মূল্য (টাকা)
                      </label>
                      <input
                        type="text"
                        value={selected.custom_price || ""}
                        onChange={(e) => handleFieldChange("custom_price", e.target.value)}
                        placeholder="যেমন: ৩,৫০০"
                        style={{ width: "100%", height: 42, padding: "0 12px", borderRadius: 8, background: "#0c0e17", border: "1px solid #282d45", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                      />
                      <span style={{ fontSize: 11, color: "#64748b", marginTop: 4, display: "block" }}>কাস্টমারকে পূর্বে প্রদর্শিত কাটা মূল্য</span>
                    </div>

                    {/* Offer Price */}
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#10b981", marginBottom: 6 }}>
                        🏷️ অফার/ডিসকাউন্ট মূল্য (টাকা)
                      </label>
                      <input
                        type="text"
                        value={selected.discount_price || ""}
                        onChange={(e) => handleFieldChange("discount_price", e.target.value)}
                        placeholder="যেমন: ৩,০০০"
                        style={{ width: "100%", height: 42, padding: "0 12px", borderRadius: 8, background: "#0c0e17", border: "1px solid #10b981", color: "#10b981", fontWeight: 800, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                      />
                      <span style={{ fontSize: 11, color: "#10b981", marginTop: 4, display: "block" }}>এআই কাস্টমারকে এই অফার মূল্যে ক্লোজ করবে</span>
                    </div>

                    {/* Stock Status */}
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                        📦 স্টক স্ট্যাটাস
                      </label>
                      <select
                        value={selected.stock_status || "in_stock"}
                        onChange={(e) => handleFieldChange("stock_status", e.target.value)}
                        style={{ width: "100%", height: 42, padding: "0 12px", borderRadius: 8, background: "#0c0e17", border: "1px solid #282d45", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", cursor: "pointer" }}
                      >
                        <option value="in_stock" style={{ background: "#141724", color: "#10b981" }}>পর্যাপ্ত স্টক আছে (In Stock)</option>
                        <option value="limited" style={{ background: "#141724", color: "#fbbf24" }}>সীমিত স্টক (Limited Stock)</option>
                        <option value="out_of_stock" style={{ background: "#141724", color: "#f87171" }}>স্টক শেষ (Out of Stock)</option>
                      </select>
                      <span style={{ fontSize: 11, color: "#64748b", marginTop: 4, display: "block" }}>স্টক শেষ হলে এআই সরাসরি কাস্টমারকে জানাবে</span>
                    </div>

                  </div>

                  {/* Strategy Box */}
                  <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(124, 58, 237, 0.1)", border: "1px solid rgba(124, 58, 237, 0.25)", display: "flex", gap: 12 }}>
                    <Sparkles style={{ width: 20, height: 20, color: "#a855f7", flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: 12, color: "#d8b4fe", lineHeight: 1.6 }}>
                      <strong style={{ color: "#fff", display: "block", marginBottom: 2 }}>হাই-টিকেট ক্লোজিং স্ট্র্যাটেজি:</strong>
                      মূল সমস্যাগুলোর স্থায়ী সমাধানের জন্য আমাদের ৩,০০০ টাকার প্রিমিয়াম প্যাকেজটিকে মূল ফোকাস রাখুন। ডিসকাউন্ট প্রাইসে ৩,০০০ টাকা দিলে জেমিনি ফ্ল্যাশ কাস্টমারকে সর্বোচ্চ কনভিন্সিং উপায়ে অর্ডার ক্লোজ করতে পারে।
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Pitch & Offers */}
              {modalTab === "pitch" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#c084fc", marginBottom: 6 }}>
                      🎁 বিশেষ অফার / শর্তাবলী (এআই কাস্টমারকে এই অফার বলবে)
                    </label>
                    <input
                      type="text"
                      value={selected.custom_note || ""}
                      onChange={(e) => handleFieldChange("custom_note", e.target.value)}
                      placeholder="যেমন: ২ ফাইল নিলে ফ্রি হোম ডেলিভারি! ফ্রেশ ল্যাব ব্যাচ বুকিংয়ে বিশেষ সুবিধা।"
                      style={{ width: "100%", height: 44, padding: "0 14px", borderRadius: 10, background: "#151828", border: "1px solid #282d45", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#60a5fa", marginBottom: 6 }}>
                      🦁 সিনিয়র হাকিমের আলটিমেট ফর্মুলেশন পিচ ও শ্রেষ্ঠত্ব
                    </label>
                    <textarea
                      rows={4}
                      value={selected.custom_pitch || ""}
                      onChange={(e) => handleFieldChange("custom_pitch", e.target.value)}
                      placeholder="যেমন: খাঁটি হিমালয়ান শিলাজিৎ, অশ্বগন্ধা ও প্রাকৃতিক ভেষজ উপাদানে প্রস্তুত যা পেনাইল নার্ভ সচল করে এবং স্থায়ী শক্তি ফিরিয়ে আনে।"
                      style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "#151828", border: "1px solid #282d45", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>
                      📝 অতিরিক্ত তথ্য ও বিশেষ নির্দেশনা (Custom Details)
                    </label>
                    <textarea
                      rows={2}
                      value={selected.custom_details || ""}
                      onChange={(e) => handleFieldChange("custom_details", e.target.value)}
                      placeholder="ডেলিভারি বা প্যাকেজিং সংক্রান্ত কোনো বিশেষ নোট..."
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "#151828", border: "1px solid #282d45", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical" }}
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: Clinical & Solutions */}
              {modalTab === "clinical" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#38bdf8", marginBottom: 6 }}>
                        💊 সেবনবিধি ও ডোজ ফর্ম (Dosage / How to Take)
                      </label>
                      <textarea
                        rows={4}
                        value={selected.dosageForm || ""}
                        onChange={(e) => handleFieldChange("dosageForm", e.target.value)}
                        placeholder="যেমন: প্রতিদিন রাতে খাবারের পর কুসুম গরম দুধ বা পানিসহ ১টি করে ক্যাপসুল সেব্য।"
                        style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "#151828", border: "1px solid #282d45", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#f87171", marginBottom: 6 }}>
                        ⚠️ রোগীর শারীরিক সমস্যা ও স্থায়ী সমাধান (Pain Points)
                      </label>
                      <textarea
                        rows={4}
                        value={selected.painPoints || ""}
                        onChange={(e) => handleFieldChange("painPoints", e.target.value)}
                        placeholder="দ্রুত বীর্যপাত, লিঙ্গ শিথিলতা, শুক্রাণু পাতলা হওয়া বা স্নায়বিক দুর্বলতার লক্ষণ ও সমাধান..."
                        style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "#151828", border: "1px solid #282d45", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical" }}
                      />
                    </div>
                  </div>

                  {selected.dietary && (
                    <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                        <ShieldCheck style={{ width: 16, height: 16 }} />
                        <span>🥗 পুষ্টি ও দ্রুত কার্যকারিতা ডায়েট চার্ট</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#a7f3d0", whiteSpace: "pre-line", lineHeight: 1.6 }}>
                        {selected.dietary}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Specialists & Objections */}
              {modalTab === "specialists" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {selected.specialists && selected.specialists.length > 0 ? (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                        <Stethoscope style={{ width: 16, height: 16 }} />
                        <span>বিশ্বখ্যাত ৫ জন বিশেষজ্ঞ ডাক্তার ও গবেষকদের উক্তি</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
                        {selected.specialists.map((sp, idx) => (
                          <div key={idx} style={{ padding: "12px 14px", borderRadius: 10, background: "#151828", border: "1px solid #282d45" }}>
                            <div style={{ fontWeight: 700, color: "#93c5fd", fontSize: 13 }}>{sp.name} {sp.flag || ""}</div>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>{sp.title ? `${sp.title}, ` : ""}{sp.institute}</div>
                            <div style={{ fontSize: 12, color: "#e2e8f0", fontStyle: "italic", lineHeight: 1.5 }}>"{sp.quote}"</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: "#64748b" }}>এই ওষুধের জন্য কোনো বিশেষজ্ঞ কোটেশন নেই।</p>
                  )}

                  {selected.objections && selected.objections.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fb7185", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                        <Flame style={{ width: 16, height: 16 }} />
                        <span>কাস্টমারের ৪টি মূল আপত্তি খণ্ডন ও উত্তর (Objection Destroyers)</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {selected.objections.map((obj, idx) => (
                          <div key={idx} style={{ padding: "12px 14px", borderRadius: 10, background: "#151828", border: "1px solid rgba(251, 113, 133, 0.25)" }}>
                            <div style={{ fontWeight: 700, color: "#fda4af", fontSize: 13, marginBottom: 4 }}>❓ {obj.objection}</div>
                            <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.5 }}>💡 {obj.script}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid #20253a", background: "#151828", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "#94a3b8" }}>
              <span>💡 টাইপ শেষ করার সাথে সাথেই কোনো বাটন না চেপেই তথ্যগুলো ভিপিএসে সংরক্ষিত হবে।</span>
              <button
                onClick={closeModal}
                style={{ padding: "8px 20px", borderRadius: 10, background: "#7c3aed", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                সম্পন্ন করুন
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
