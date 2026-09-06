"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search,
  Sparkles,
  Package,
  TrendingUp,
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
  Filter,
  Check,
  RefreshCw,
  Eye,
  Info
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
    <div className="min-h-full bg-[#07070d] text-slate-100 font-sans pb-24 selection:bg-purple-600 selection:text-white relative overflow-x-hidden">
      {/* Dynamic Ambient Background Glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[160px] pointer-events-none -z-10" />
      <div className="fixed top-[40%] left-[50%] -translate-x-1/2 w-[800px] h-[350px] bg-indigo-600/5 rounded-full blur-[180px] pointer-events-none -z-10" />

      {/* Hero Header */}
      <header className="border-b border-white/[0.08] bg-[#0c0c17]/80 backdrop-blur-xl sticky top-0 z-30 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Title & Badge */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-emerald-400 p-0.5 shadow-lg shadow-purple-500/20 flex items-center justify-center">
                  <div className="w-full h-full bg-[#0c0c17] rounded-[10px] flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-purple-300 bg-clip-text text-transparent">
                    মেডিসিন মাস্টার কন্ট্রোল ড্যাশবোর্ড
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 flex items-center gap-2">
                    <span>ভিপিএস ক্লাউড স্টোরেজ লাইভ সংযুক্ত</span>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-emerald-400 font-medium">রিয়েল-টাইম অটো-সেভ সক্রিয়</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions & Live Indicator */}
            <div className="flex items-center gap-3 flex-wrap">
              <a
                href="/dashboard/encyclopedia"
                target="_blank"
                rel="noreferrer"
                className="group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 shadow-md shadow-purple-600/25 hover:shadow-lg hover:shadow-purple-600/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border border-white/20 overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <Award className="w-4 h-4 text-purple-200" />
                <span>মেগা এনসাইক্লোপিডিয়া ভিউ</span>
                <ExternalLink className="w-3.5 h-3.5 text-purple-200 opacity-70 group-hover:opacity-100 transition-opacity" />
              </a>

              <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shadow-inner">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span>ভিপিএস লাইভ (২৪/৭)</span>
              </div>
            </div>
          </div>

          {/* Metric KPI HUD Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6 pt-5 border-t border-white/[0.06]">
            {/* KPI 1 */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-purple-500/30 transition-all flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-400">মোট অনুমোদিত ওষুধ</div>
                <div className="text-lg sm:text-xl font-bold text-white tracking-tight">{totalCount} টি ফর্মুলা</div>
              </div>
            </div>

            {/* KPI 2 */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-emerald-500/30 transition-all flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-400">স্টক রেডি</div>
                <div className="text-lg sm:text-xl font-bold text-emerald-400 tracking-tight">{inStockCount} টি অ্যাক্টিভ</div>
              </div>
            </div>

            {/* KPI 3 */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-blue-500/30 transition-all flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-400">অফার ও ডিসকাউন্ট</div>
                <div className="text-lg sm:text-xl font-bold text-blue-400 tracking-tight">{offerCount} টি স্পেশাল ডিল</div>
              </div>
            </div>

            {/* KPI 4 */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-amber-500/30 transition-all flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-400">এআই ক্লোজিং রেডি</div>
                <div className="text-lg sm:text-xl font-bold text-amber-400 tracking-tight">৩,০০০৳ মাস্টার কোর্স</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Filter & Search Bar Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Modern Search Bar */}
          <form onSubmit={handleSearch} className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-purple-400 transition-colors">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ওষুধ খুঁজুন... (যেমন: Soul Mate, Dream Touch, Men's Burner, লিভার, বাত, দ্রুত বীর্যপাত)"
              className="w-full pl-11 pr-24 py-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.09] text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 shadow-inner transition-all"
            />
            <div className="absolute inset-y-1.5 right-1.5 flex items-center gap-1.5">
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setTimeout(fetchProducts, 50); }}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow-md shadow-purple-600/20"
              >
                সার্চ
              </button>
            </div>
          </form>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-slate-300">
              <ArrowUpDown className="w-3.5 h-3.5 text-purple-400" />
              <span>সাজান:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-white font-semibold outline-none cursor-pointer"
              >
                <option value="sl" className="bg-[#13131f] text-white">সিরিয়াল (১-৫৭)</option>
                <option value="price_low" className="bg-[#13131f] text-white">মূল্য: কম থেকে বেশি</option>
                <option value="price_high" className="bg-[#13131f] text-white">মূল্য: বেশি থেকে কম</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto py-4 scrollbar-none">
          {[
            { id: "all", label: "সবগুলো ওষুধ", icon: Layers, count: totalCount },
            { id: "in_stock", label: "ইন স্টক", icon: CheckCircle2, count: inStockCount },
            { id: "discounted", label: "স্পেশাল অফার", icon: Flame, count: offerCount },
            { id: "mens", label: "পুরুষ শক্তি ও স্থায়ী সক্ষমতা", icon: Sparkles },
            { id: "pain", label: "বাত ও জয়েন্ট ব্যথা", icon: HeartPulse },
            { id: "gastric", label: "গ্যাস ও লিভার কেয়ার", icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as FilterCategory)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 border ${
                  isActive
                    ? "bg-purple-600/20 text-purple-300 border-purple-500/50 shadow-lg shadow-purple-500/10 scale-[1.02]"
                    : "bg-white/[0.03] text-slate-400 border-white/[0.06] hover:bg-white/[0.06] hover:text-slate-200 hover:border-white/[0.12]"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-purple-400" : "text-slate-400"}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`ml-1 text-[11px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-purple-500/30 text-purple-200" : "bg-white/[0.06] text-slate-400"}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Grid View */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 animate-spin">
              <RefreshCw className="w-7 h-7" />
            </div>
            <p className="text-base font-semibold text-slate-300">ভিপিএস থেকে মেডিসিন ডেটা লোড হচ্ছে...</p>
            <p className="text-xs text-slate-500 max-w-sm">লাইভ ডাটাবেজ থেকে ওষুধের রিয়েল-টাইম প্রাইসিং ও স্টক তথ্য আনা হচ্ছে</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center rounded-3xl bg-white/[0.02] border border-white/[0.06] p-8">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center text-slate-400 mb-4">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">কোনো ওষুধ পাওয়া যায়নি</h3>
            <p className="text-sm text-slate-400 max-w-md mb-6">আপনার সার্চ ফিল্টারের সাথে মিলে এমন কোনো প্রোডাক্ট পাওয়া যায়নি। বানান চেক করুন অথবা ফিল্টার ক্লিয়ার করুন।</p>
            <button
              onClick={() => { setSearch(""); setActiveFilter("all"); fetchProducts(); }}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all"
            >
              সব ওষুধ দেখুন
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredProducts.map((product) => {
              const currentPrice = product.discount_price || product.custom_price;
              const hasDiscount = !!product.discount_price && !!product.custom_price;
              const isOutOfStock = product.stock_status === "out_of_stock";
              const isLimited = product.stock_status === "limited";

              return (
                <div
                  key={product.sl}
                  onClick={() => setSelected(product)}
                  className="group relative flex flex-col justify-between rounded-2xl bg-gradient-to-b from-[#121221] to-[#0c0c16] border border-white/[0.08] hover:border-purple-500/50 shadow-md hover:shadow-2xl hover:shadow-purple-600/15 hover:-translate-y-1.5 transition-all duration-300 cursor-pointer overflow-hidden backdrop-blur-md"
                >
                  {/* Card Header Media */}
                  <div className="relative aspect-[4/3] w-full bg-[#080811] overflow-hidden">
                    {product.imageUrl && !imageErrors.has(product.imageFile) ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                        onError={() => {
                          setImageErrors(prev => new Set(prev).add(product.imageFile));
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-slate-900 to-indigo-950/40 text-purple-400/60">
                        <Stethoscope className="w-16 h-16 stroke-[1.2]" />
                        <span className="text-[11px] text-slate-500 mt-2 font-mono">ল্যাব ফর্মুলা #{product.sl}</span>
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#121221] via-transparent to-black/40 pointer-events-none" />

                    {/* Top Badges */}
                    <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2 pointer-events-none">
                      {/* SL Pill */}
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold tracking-wider bg-purple-600/90 text-white backdrop-blur-md border border-white/20 shadow-md">
                        SL #{product.sl}
                      </span>

                      {/* Stock Status Badge */}
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold backdrop-blur-md border shadow-md ${
                        isOutOfStock
                          ? "bg-rose-500/85 text-white border-rose-400/30"
                          : isLimited
                          ? "bg-amber-500/85 text-white border-amber-400/30"
                          : "bg-emerald-500/85 text-white border-emerald-400/30"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOutOfStock ? "bg-white" : "bg-white animate-pulse"}`} />
                        {isOutOfStock ? "স্টক শেষ" : isLimited ? "সীমিত স্টক" : "ইন স্টক"}
                      </span>
                    </div>

                    {/* Live AI Controlled Indicator */}
                    <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-slate-300 pointer-events-none">
                      <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-slate-300 text-[10px]">
                        {product.dosageForm ? product.dosageForm.slice(0, 18) + "..." : "ইউনানী ফর্মুলেশন"}
                      </span>
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h3 className="font-bold text-base text-white group-hover:text-purple-300 transition-colors leading-snug line-clamp-1">
                        {product.name}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                        {product.generic || product.manufacturer || "গ্রীন হেলথ ল্যাবরেটরিজ"}
                      </p>

                      {/* Pricing Tag Display */}
                      <div className="mt-3.5 flex items-baseline gap-2">
                        {product.discount_price ? (
                          <>
                            <span className="text-xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                              ৳{product.discount_price}
                            </span>
                            {product.custom_price && (
                              <span className="text-xs text-slate-500 line-through">
                                ৳{product.custom_price}
                              </span>
                            )}
                            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              অফার মূল্য
                            </span>
                          </>
                        ) : product.custom_price ? (
                          <span className="text-xl font-black text-emerald-400">
                            ৳{product.custom_price}
                          </span>
                        ) : (
                          <span className="text-xs text-purple-400 italic font-medium flex items-center gap-1">
                            <Info className="w-3.5 h-3.5" />
                            মূল্য সেট করতে ক্লিক করুন
                          </span>
                        )}
                      </div>

                      {/* Special Offer / Custom Note Badge */}
                      {product.custom_note && (
                        <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-purple-950/40 border border-purple-500/20 text-[11px] text-purple-300 flex items-center gap-1.5 line-clamp-1">
                          <Flame className="w-3 h-3 text-purple-400 shrink-0" />
                          <span className="truncate">{product.custom_note}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="pt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelected(product); }}
                        className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600/90 to-indigo-600/90 hover:from-purple-500 hover:to-indigo-500 flex items-center justify-center gap-2 border border-white/10 shadow-md shadow-purple-600/10 group-hover:shadow-purple-600/25 transition-all"
                      >
                        <span>এডিট ও লাইভ কন্ট্রোল</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Ultra-Modern Medical Console Modal */}
      {selected && (
        <div
          onClick={closeModal}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[92vh] bg-[#0f0f1c] border border-white/[0.12] rounded-3xl shadow-2xl shadow-purple-950/60 flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-white/[0.08] bg-white/[0.02] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                {selected.imageUrl && !imageErrors.has(selected.imageFile) ? (
                  <img
                    src={selected.imageUrl}
                    alt={selected.name}
                    className="w-12 h-12 rounded-xl object-cover border border-white/15 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-black text-white truncate">
                      {selected.name}
                    </h2>
                    <span className="px-2 py-0.5 rounded-md bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold shrink-0">
                      SL #{selected.sl}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    যেকোনো বক্সে টাইপ করলে ২ সেকেন্ডের মধ্যে স্বয়ংক্রিয়ভাবে ভিপিএসে সংরক্ষিত হবে
                  </p>
                </div>
              </div>

              {/* Status Pill & Close */}
              <div className="flex items-center gap-3 shrink-0">
                {/* Auto-Save Live Badge */}
                <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                  saveStatus === "typing"
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm"
                    : saveStatus === "saving"
                    ? "bg-blue-500/15 text-blue-300 border-blue-500/40 animate-pulse"
                    : saveStatus === "saved"
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                    : saveStatus === "error"
                    ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
                    : "bg-white/[0.04] text-slate-300 border-white/[0.08]"
                }`}>
                  {saveStatus === "typing" && (
                    <>
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      <span>টাইপ করছেন...</span>
                    </>
                  )}
                  {saveStatus === "saving" && (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>ভিপিএসে সেভ হচ্ছে...</span>
                    </>
                  )}
                  {saveStatus === "saved" && (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>সংরক্ষিত ({lastSavedTime || "এখন"})</span>
                    </>
                  )}
                  {saveStatus === "idle" && (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>ভিপিএসে সক্রিয়</span>
                    </>
                  )}
                  {saveStatus === "error" && (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span>সেভ ব্যর্থ! পুনরায় চেষ্টা করুন</span>
                    </>
                  )}
                </div>

                <button
                  onClick={closeModal}
                  className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-slate-400 hover:text-white flex items-center justify-center transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-2 px-6 pt-3 border-b border-white/[0.06] bg-white/[0.01] overflow-x-auto scrollbar-none">
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
                    className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap ${
                      isActive
                        ? "border-purple-500 text-purple-400 bg-purple-500/10 rounded-t-xl"
                        : "border-transparent text-slate-400 hover:text-slate-200 hover:border-white/20"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Content Body */}
            <div className="p-6 overflow-y-auto space-y-6 max-h-[calc(92vh-180px)]">
              {/* TAB 1: Pricing & Stock */}
              {modalTab === "pricing" && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
                    {/* Regular Price */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-2">
                        💰 রেগুলার মূল্য (টাকা)
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold text-sm pointer-events-none">
                          ৳
                        </span>
                        <input
                          type="text"
                          value={selected.custom_price || ""}
                          onChange={(e) => handleFieldChange("custom_price", e.target.value)}
                          placeholder="যেমন: ৩,৫০০"
                          className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 font-semibold transition-all"
                        />
                      </div>
                      <span className="text-[11px] text-slate-500 mt-1 block">কাস্টমারকে পূর্বে প্রদর্শিত কাটা মূল্য</span>
                    </div>

                    {/* Offer Price */}
                    <div>
                      <label className="block text-xs font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-emerald-400" />
                        <span>🏷️ অফার/ডিসকাউন্ট মূল্য (টাকা)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-emerald-400 font-bold text-sm pointer-events-none">
                          ৳
                        </span>
                        <input
                          type="text"
                          value={selected.discount_price || ""}
                          onChange={(e) => handleFieldChange("discount_price", e.target.value)}
                          placeholder="যেমন: ৩,০০০"
                          className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-black/40 border border-emerald-500/50 text-emerald-400 font-bold text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        />
                      </div>
                      <span className="text-[11px] text-emerald-500/80 mt-1 block">এআই কাস্টমারকে এই অফার মূল্যে ক্লোজ করবে</span>
                    </div>

                    {/* Stock Status */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-2">
                        📦 স্টক স্ট্যাটাস
                      </label>
                      <select
                        value={selected.stock_status || "in_stock"}
                        onChange={(e) => handleFieldChange("stock_status", e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 font-medium cursor-pointer transition-all"
                      >
                        <option value="in_stock" className="bg-[#13131f] text-emerald-400">পর্যাপ্ত স্টক আছে (In Stock)</option>
                        <option value="limited" className="bg-[#13131f] text-amber-400">সীমিত স্টক (Limited Stock)</option>
                        <option value="out_of_stock" className="bg-[#13131f] text-rose-400">স্টক শেষ (Out of Stock)</option>
                      </select>
                      <span className="text-[11px] text-slate-500 mt-1 block">স্টক শেষ হলে এআই সরাসরি কাস্টমারকে জানাবে</span>
                    </div>
                  </div>

                  {/* Pricing Psychology Tip Box */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/20 to-indigo-900/20 border border-purple-500/20 flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-purple-200 leading-relaxed">
                      <strong className="text-white block mb-0.5">হাই-টিকেট ক্লোজিং স্ট্র্যাটেজি:</strong>
                      মূল সমস্যাগুলোর স্থায়ী সমাধানের জন্য আমাদের ৩,০০০ টাকার প্রিমিয়াম প্যাকেজটিকে মূল ফোকাস রাখুন। ডিসকাউন্ট প্রাইসে ৩,০০০ টাকা দিলে জেমিনি ফ্ল্যাশ কাস্টমারকে সর্বোচ্চ কনভিন্সিং উপায়ে অর্ডার ক্লোজ করতে পারে।
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Pitch & Offers */}
              {modalTab === "pitch" && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {/* Special Offer Banner */}
                  <div>
                    <label className="block text-xs font-bold text-purple-300 mb-2 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-purple-400" />
                      <span>🎁 বিশেষ অফার / শর্তাবলী (এআই কাস্টমারকে এই অফার বলবে)</span>
                    </label>
                    <input
                      type="text"
                      value={selected.custom_note || ""}
                      onChange={(e) => handleFieldChange("custom_note", e.target.value)}
                      placeholder="যেমন: ২ ফাইল নিলে ফ্রি হোম ডেলিভারি! ফ্রেশ ল্যাব ব্যাচ বুকিংয়ে বিশেষ সুবিধা।"
                      className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-medium"
                    />
                  </div>

                  {/* Master Hakim's Sales Pitch */}
                  <div>
                    <label className="block text-xs font-bold text-blue-300 mb-2 flex items-center gap-2">
                      <Award className="w-4 h-4 text-blue-400" />
                      <span>🦁 সিনিয়র হাকিমের আলটিমেট ফর্মুলেশন পিচ ও শ্রেষ্ঠত্ব</span>
                    </label>
                    <textarea
                      rows={4}
                      value={selected.custom_pitch || ""}
                      onChange={(e) => handleFieldChange("custom_pitch", e.target.value)}
                      placeholder="যেমন: আসল হিমালয়ান শিলাজিৎ, অশ্বগন্ধা ও প্রাকৃতিক ভেষজ উপাদানে প্রস্তুত যা পেনাইল নার্ভ সচল করে এবং স্থায়ী শক্তি ফিরিয়ে আনে।"
                      className="w-full p-4 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all leading-relaxed"
                    />
                  </div>

                  {/* Extra Instructions */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2">
                      📝 অতিরিক্ত তথ্য ও বিশেষ নির্দেশনা (Custom Details)
                    </label>
                    <textarea
                      rows={2}
                      value={selected.custom_details || ""}
                      onChange={(e) => handleFieldChange("custom_details", e.target.value)}
                      placeholder="ডেলিভারি বা প্যাকেজিং সংক্রান্ত কোনো বিশেষ নোট..."
                      className="w-full p-3.5 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: Clinical & Solutions */}
              {modalTab === "clinical" && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Dosage Instructions */}
                    <div>
                      <label className="block text-xs font-bold text-cyan-300 mb-2 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-cyan-400" />
                        <span>💊 সেবনবিধি ও ডোজ ফর্ম (Dosage / How to Take)</span>
                      </label>
                      <textarea
                        rows={4}
                        value={selected.dosageForm || ""}
                        onChange={(e) => handleFieldChange("dosageForm", e.target.value)}
                        placeholder="যেমন: প্রতিদিন রাতে খাবারের পর কুসুম গরম দুধ বা পানিসহ ১টি করে ক্যাপসুল সেব্য।"
                        className="w-full p-3.5 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all leading-relaxed"
                      />
                    </div>

                    {/* Patient Pain Points */}
                    <div>
                      <label className="block text-xs font-bold text-rose-300 mb-2 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                        <span>⚠️ রোগীর শারীরিক সমস্যা ও স্থায়ী সমাধান (Pain Points)</span>
                      </label>
                      <textarea
                        rows={4}
                        value={selected.painPoints || ""}
                        onChange={(e) => handleFieldChange("painPoints", e.target.value)}
                        placeholder="দ্রুত বীর্যপাত, লিঙ্গ শিথিলতা, শুক্রাণু পাতলা হওয়া বা স্নায়বিক দুর্বলতার লক্ষণ ও সমাধান..."
                        className="w-full p-3.5 rounded-xl bg-black/40 border border-white/[0.12] text-white text-sm focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Dietary Blueprint */}
                  {selected.dietary && (
                    <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20">
                      <div className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        <span>🥗 পুষ্টি ও দ্রুত কার্যকারিতা ডায়েট চার্ট</span>
                      </div>
                      <div className="text-xs text-emerald-200/90 whitespace-pre-line leading-relaxed font-mono">
                        {selected.dietary}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Specialists & Objections */}
              {modalTab === "specialists" && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* Named Doctors */}
                  {selected.specialists && selected.specialists.length > 0 ? (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-sky-400 flex items-center gap-2">
                        <Stethoscope className="w-4 h-4" />
                        <span>বিশ্বখ্যাত ৫ জন বিশেষজ্ঞ ডাক্তার ও গবেষকদের উক্তি</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selected.specialists.map((sp, idx) => (
                          <div key={idx} className="p-3.5 rounded-xl bg-black/40 border border-white/[0.08] hover:border-sky-500/30 transition-all">
                            <div className="font-bold text-sky-300 text-xs">{sp.name} {sp.flag || ""}</div>
                            <div className="text-[11px] text-slate-400 mb-2">{sp.title ? `${sp.title}, ` : ""}{sp.institute}</div>
                            <div className="text-xs text-slate-200 italic leading-relaxed">"{sp.quote}"</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">এই ফর্মুলার জন্য কোনো বিশেষজ্ঞ কোটেশন যুক্ত করা নেই।</p>
                  )}

                  {/* Objection Destroyers */}
                  {selected.objections && selected.objections.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-bold text-rose-400 flex items-center gap-2">
                        <Flame className="w-4 h-4" />
                        <span>কাস্টমারের ৪টি মূল আপত্তি খণ্ডন ও উত্তর (Objection Destroyers)</span>
                      </h4>
                      <div className="space-y-2.5">
                        {selected.objections.map((obj, idx) => (
                          <div key={idx} className="p-3.5 rounded-xl bg-black/40 border border-rose-500/20">
                            <div className="font-bold text-rose-300 text-xs mb-1">❓ {obj.objection}</div>
                            <div className="text-xs text-slate-300 leading-relaxed">💡 {obj.script}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-between text-xs text-slate-400">
              <span>💡 টাইপ শেষ করার সাথে সাথেই কোনো বাটন না চেপেই তথ্যগুলো ভিপিএসে সংরক্ষিত হবে।</span>
              <button
                onClick={closeModal}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-md shadow-purple-600/20"
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
