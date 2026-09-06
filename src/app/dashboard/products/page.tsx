"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search, Sparkles, Package, ShieldCheck, Zap, Tag,
  CheckCircle2, X, ExternalLink,
  Flame, Award, Stethoscope, HeartPulse, DollarSign, Layers,
  ArrowUpDown, Check, Info, Edit3
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

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
.pharm{font-family:'Hind Siliguri','Inter',system-ui,sans-serif;background:#04050d;color:#e2e8f0;min-height:100%;overflow-x:hidden;position:relative}
.pharm::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(124,58,237,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,.04) 1px,transparent 1px);background-size:48px 48px;pointer-events:none;z-index:0}
.orb{position:fixed;border-radius:50%;filter:blur(90px);pointer-events:none;z-index:0;animation:orbF 14s ease-in-out infinite}
.o1{width:600px;height:600px;background:rgba(124,58,237,.12);top:-200px;left:-200px}
.o2{width:500px;height:500px;background:rgba(16,185,129,.08);bottom:-150px;right:-150px;animation-delay:-7s}
.o3{width:400px;height:400px;background:rgba(59,130,246,.08);top:40%;left:40%;animation-delay:-3.5s}
@keyframes orbF{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-30px) scale(1.05)}66%{transform:translate(-20px,40px) scale(.95)}}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:#0a0b15}
::-webkit-scrollbar-thumb{background:#2d3160;border-radius:99px}
::-webkit-scrollbar-thumb:hover{background:#7c3aed}
.pcard{background:linear-gradient(145deg,#131624,#0e1020);border:1px solid #1e2240;border-radius:20px;overflow:hidden;cursor:pointer;transition:transform .35s cubic-bezier(.22,1,.36,1),box-shadow .35s ease,border-color .3s;position:relative;will-change:transform}
.pcard::after{content:'';position:absolute;inset:0;border-radius:20px;background:linear-gradient(135deg,rgba(124,58,237,.07),transparent 60%);opacity:0;transition:opacity .4s;pointer-events:none}
.pcard:hover{transform:translateY(-8px) scale(1.015);box-shadow:0 24px 60px rgba(124,58,237,.28),0 0 0 1px rgba(124,58,237,.4);border-color:rgba(124,58,237,.7)}
.pcard:hover::after{opacity:1}
.pcard:active{transform:translateY(-4px) scale(1.01)}
.pcard:hover .cmedia img{transform:scale(1.08)}
.kpi{background:linear-gradient(145deg,#131825,#0d1018);border:1px solid #1e2438;border-radius:18px;padding:18px 22px;display:flex;align-items:center;gap:16px;position:relative;overflow:hidden;transition:transform .3s;cursor:default}
.kpi::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.03),transparent);pointer-events:none}
.kpi:hover{transform:translateY(-4px)}
.fpill{display:inline-flex;align-items:center;gap:7px;padding:9px 18px;border-radius:50px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .25s cubic-bezier(.22,1,.36,1);border:1px solid #1e2438;background:rgba(255,255,255,.03);color:#94a3b8;font-family:inherit}
.fpill:hover{background:rgba(124,58,237,.15);color:#c084fc;border-color:rgba(124,58,237,.4);transform:translateY(-2px)}
.fpill.on{background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;border-color:#8b5cf6;box-shadow:0 6px 20px rgba(124,58,237,.4);transform:translateY(-2px)}
.fpill:active{transform:scale(.96)}
.btnp{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 24px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;border:none;font-weight:700;font-size:13px;cursor:pointer;transition:all .25s;white-space:nowrap;box-shadow:0 4px 16px rgba(124,58,237,.3);font-family:inherit}
.btnp:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(124,58,237,.45)}
.btnp:active{transform:scale(.97)}
.sinput{width:100%;height:50px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid #1e2438;padding:0 44px 0 48px;color:#fff;font-size:14px;outline:none;transition:all .3s;font-family:inherit;backdrop-filter:blur(10px)}
.sinput::placeholder{color:#475569}
.sinput:focus{border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.15),0 0 30px rgba(124,58,237,.1);background:rgba(124,58,237,.06)}
.finput,.fsel,.ftxt{width:100%;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid #1e2440;color:#f1f5f9;font-size:13px;font-family:inherit;outline:none;transition:all .3s}
.finput,.fsel{height:46px;padding:0 14px}
.ftxt{padding:12px 14px;resize:vertical}
.finput:focus,.fsel:focus,.ftxt:focus{border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.12);background:rgba(124,58,237,.05)}
.finput::placeholder,.ftxt::placeholder{color:#475569}
.fsel{cursor:pointer}
option{background:#131624}
.mtab{display:inline-flex;align-items:center;gap:7px;padding:10px 16px;border-radius:10px;border:none;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .25s;font-family:inherit;background:transparent;color:#64748b}
.mtab:hover{background:rgba(255,255,255,.05);color:#cbd5e1}
.mtab.on{background:rgba(124,58,237,.2);color:#c084fc;box-shadow:inset 0 -2px 0 #a855f7}
@keyframes pDot{0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.6)}50%{box-shadow:0 0 0 6px rgba(16,185,129,0)}}
.pdot{animation:pDot 2s infinite}
@keyframes shim{0%{background-position:-500px 0}100%{background-position:500px 0}}
.shim{background:linear-gradient(90deg,#131624 25%,#1e2238 50%,#131624 75%);background-size:1000px 100%;animation:shim 1.6s infinite;border-radius:12px}
@keyframes sUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
.sup{animation:sUp .5s cubic-bezier(.22,1,.36,1) both}
@keyframes fScale{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
.fsc{animation:fScale .35s cubic-bezier(.22,1,.36,1) both}
.pcard:nth-child(1){animation-delay:.05s}.pcard:nth-child(2){animation-delay:.10s}.pcard:nth-child(3){animation-delay:.15s}.pcard:nth-child(4){animation-delay:.20s}.pcard:nth-child(5){animation-delay:.25s}.pcard:nth-child(6){animation-delay:.30s}.pcard:nth-child(7){animation-delay:.35s}.pcard:nth-child(8){animation-delay:.40s}
.cmedia{position:relative;height:190px;overflow:hidden;background:#080910}
.cmedia img{width:100%;height:100%;object-fit:cover;transition:transform .5s cubic-bezier(.22,1,.36,1)}
.cmov{position:absolute;inset:0;background:linear-gradient(to top,rgba(10,12,24,.85) 0%,transparent 50%);pointer-events:none}
.pneon{color:#10b981;text-shadow:0 0 20px rgba(16,185,129,.5)}
.ssel{background:transparent;color:#fff;border:none;outline:none;cursor:pointer;font-size:13px;font-weight:700;font-family:inherit}
.spcard{background:rgba(255,255,255,.02);border:1px solid #1a2040;border-radius:14px;padding:16px;transition:all .25s}
.spcard:hover{background:rgba(124,58,237,.07);border-color:rgba(124,58,237,.3);transform:translateY(-2px)}
.obcard{background:rgba(251,113,133,.04);border:1px solid rgba(251,113,133,.18);border-radius:12px;padding:14px;transition:all .25s}
.obcard:hover{background:rgba(251,113,133,.08)}
.lp{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#a855f7}
.lg{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#10b981}
.lb{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#60a5fa}
.lr{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#f87171}
.hdr{position:sticky;top:0;z-index:100;background:rgba(4,5,13,.92);backdrop-filter:blur(24px);border-bottom:1px solid rgba(255,255,255,.05)}
.svt{background:rgba(245,158,11,.12);color:#fbbf24;border:1px solid rgba(245,158,11,.3)}
.svs{background:rgba(59,130,246,.12);color:#60a5fa;border:1px solid rgba(59,130,246,.3)}
.svd{background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.3)}
.svi{background:rgba(16,185,129,.08);color:#10b981;border:1px solid rgba(16,185,129,.2)}
.sve{background:rgba(239,68,68,.12);color:#f87171;border:1px solid rgba(239,68,68,.3)}
.sg{background:rgba(16,185,129,.18);color:#10b981;border:1px solid rgba(16,185,129,.4)}
.sa{background:rgba(245,158,11,.18);color:#fbbf24;border:1px solid rgba(245,158,11,.4)}
.sr{background:rgba(239,68,68,.18);color:#f87171;border:1px solid rgba(239,68,68,.4)}
.divd{border:none;border-top:1px solid rgba(255,255,255,.05);margin:0}
.ibox{background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.2);border-radius:12px;padding:14px 16px}
.cbtn{width:100%;padding:11px;border-radius:12px;border:none;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .25s;font-family:inherit;box-shadow:0 4px 14px rgba(124,58,237,.25)}
.cbtn:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(124,58,237,.45);filter:brightness(1.1)}
.cbtn:active{transform:scale(.97)}
.mbk{position:fixed;inset:0;background:rgba(0,0,0,.88);backdrop-filter:blur(10px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px}
.msh{width:100%;max-width:900px;max-height:92vh;background:#0d0f1c;border:1px solid rgba(124,58,237,.25);border-radius:24px;box-shadow:0 40px 100px rgba(0,0,0,.9),0 0 0 1px rgba(124,58,237,.1);display:flex;flex-direction:column;overflow:hidden}
`;

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");
  const [modalTab, setModalTab] = useState<ModalTab>("pricing");
  const [sortBy, setSortBy] = useState<"sl" | "price_low" | "price_high">("sl");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedTime, setLastSavedTime] = useState<string>("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingProductRef = useRef<Product | null>(null);
  const stylesInjected = useRef(false);

  useEffect(() => {
    if (!stylesInjected.current) {
      // Add font link directly to head for bulletproof Bengali typography rendering
      const fontLink = document.createElement("link");
      fontLink.rel = "stylesheet";
      fontLink.href = "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800;900&display=swap";
      document.head.appendChild(fontLink);

      const tag = document.createElement("style");
      tag.innerHTML = CSS;
      document.head.appendChild(tag);
      stylesInjected.current = true;
    }
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await fetch(`/api/products${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch {
      console.error("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchProducts();
  }

  const executeAutoSave = useCallback(async (p: Product) => {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sl: p.sl,
          custom_price: p.custom_price,
          discount_price: p.discount_price,
          custom_note: p.custom_note,
          custom_pitch: p.custom_pitch,
          custom_details: p.custom_details,
          stock_status: p.stock_status,
          stock_count: p.stock_count,
          dosageForm: p.dosageForm,
          painPoints: p.painPoints
        }),
      });
      if (!res.ok) throw new Error("Auto-save failed");
      const now = new Date().toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setLastSavedTime(now);
      setSaveStatus("saved");
      setProducts(prev => prev.map(x => x.sl === p.sl ? { ...x, ...p, last_updated: now } : x));
      setTimeout(() => setSaveStatus(c => c === "saved" ? "idle" : c), 3000);
    } catch {
      setSaveStatus("error");
    }
  }, []);

  function handleFieldChange(field: keyof Product, value: any) {
    if (!selected) return;
    const updated = { ...selected, [field]: value };
    setSelected(updated);
    pendingProductRef.current = updated;
    setSaveStatus("typing");
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (pendingProductRef.current) executeAutoSave(pendingProductRef.current);
    }, 2000);
  }

  function closeModal() {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (pendingProductRef.current && saveStatus === "typing") executeAutoSave(pendingProductRef.current);
    setSelected(null);
    setSaveStatus("idle");
    pendingProductRef.current = null;
  }

  const filtered = useMemo(() => {
    let r = [...products];
    if (activeFilter === "in_stock") {
      r = r.filter(p => p.stock_status !== "out_of_stock");
    } else if (activeFilter === "discounted") {
      r = r.filter(p => !!p.discount_price);
    } else if (activeFilter === "mens") {
      r = r.filter(p => /পুরুষ|শক্তি|যৌন|বীর্য|লিঙ্গ|হরমোন|men|male|sexual|sperm|burner|touch|gawa|hunter|soul|mate/i.test(p.name + " " + p.generic + " " + p.painPoints));
    } else if (activeFilter === "pain") {
      r = r.filter(p => /বাত|ব্যথা|জয়েন্ট|কোমর|হাঁটু|ঘাড়|মেরুদণ্ড|arthritis|pain|joint|muscle/i.test(p.name + " " + p.generic + " " + p.painPoints));
    } else if (activeFilter === "gastric") {
      r = r.filter(p => /গ্যাস|লিভার|হজম|বুকজ্বালা|আলসার|পেট|gastric|liver|digest/i.test(p.name + " " + p.generic + " " + p.painPoints));
    }

    if (sortBy === "price_low") {
      r.sort((a, b) => (parseFloat((a.discount_price || a.custom_price || "0").replace(/[^0-9.]/g, "")) || 0) - (parseFloat((b.discount_price || b.custom_price || "0").replace(/[^0-9.]/g, "")) || 0));
    } else if (sortBy === "price_high") {
      r.sort((a, b) => (parseFloat((b.discount_price || b.custom_price || "0").replace(/[^0-9.]/g, "")) || 0) - (parseFloat((a.discount_price || a.custom_price || "0").replace(/[^0-9.]/g, "")) || 0));
    } else {
      r.sort((a, b) => (parseInt(a.sl, 10) || 0) - (parseInt(b.sl, 10) || 0));
    }
    return r;
  }, [products, activeFilter, sortBy]);

  const total = products.length;
  const inStock = products.filter(p => p.stock_status !== "out_of_stock").length;
  const offers = products.filter(p => !!p.discount_price).length;

  const svLbl = saveStatus === "typing" ? "✏️ টাইপ করছেন..."
    : saveStatus === "saving" ? "⏳ সেভ হচ্ছে..."
    : saveStatus === "saved" ? `✓ সংরক্ষিত (${lastSavedTime})`
    : saveStatus === "error" ? "❌ সেভ ব্যর্থ"
    : "⚡ ভিপিএস লাইভ সিঙ্কড";

  const svCls = saveStatus === "typing" ? "svt"
    : saveStatus === "saving" ? "svs"
    : saveStatus === "saved" ? "svd"
    : saveStatus === "error" ? "sve"
    : "svi";

  return (
    <div className="pharm">
      <div className="orb o1" />
      <div className="orb o2" />
      <div className="orb o3" />

      <div className="hdr" style={{ padding: "0 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 0", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(124,58,237,.4)", flexShrink: 0 }}>
              <Sparkles style={{ width: 22, height: 22, color: "#fff" }} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px", background: "linear-gradient(90deg,#fff 0%,#c4b5fd 50%,#818cf8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.2 }}>
                মেডিসিন মাস্টার কন্ট্রোল ড্যাশবোর্ড
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3 }}>
                <span style={{ fontSize: 13, color: "#94a3b8" }}>রিয়েল-টাইম অটো-সেভ</span>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#475569", display: "inline-block" }} />
                <span style={{ fontSize: 13, color: "#94a3b8" }}>মোট <strong style={{ color: "#a855f7" }}>{total}</strong> টি ফর্মুলা</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <a href="/dashboard/encyclopedia" target="_blank" rel="noreferrer" className="btnp" style={{ textDecoration: "none", fontSize: 13 }}>
              <Award style={{ width: 16, height: 16 }} />
              <span>মেগা এনসাইক্লোপিডিয়া</span>
              <ExternalLink style={{ width: 13, height: 13, opacity: .7 }} />
            </a>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 12, background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.2)", color: "#10b981", fontSize: 13, fontWeight: 700 }}>
              <span className="pdot" style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
              <span>ভিপিএস লাইভ (২৪/৭)</span>
            </div>
          </div>
        </div>

        <hr className="divd" />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, padding: "16px 0" }}>
          {[
            { icon: Package, color: "#a855f7", glow: "rgba(168,85,247,.25)", bg: "rgba(168,85,247,.1)", bd: "rgba(168,85,247,.2)", lbl: "মোট ওষুধ তালিকা", val: `${total} টি ফর্মুলা`, vc: "#c084fc" },
            { icon: ShieldCheck, color: "#10b981", glow: "rgba(16,185,129,.25)", bg: "rgba(16,185,129,.1)", bd: "rgba(16,185,129,.2)", lbl: "স্টক সক্রিয়", val: `${inStock} টি অ্যাক্টিভ`, vc: "#34d399" },
            { icon: Tag, color: "#60a5fa", glow: "rgba(96,165,250,.25)", bg: "rgba(96,165,250,.1)", bd: "rgba(96,165,250,.2)", lbl: "অফার ও ডিসকাউন্ট", val: `${offers} টি স্পেশাল ডিল`, vc: "#93c5fd" },
            { icon: Zap, color: "#fbbf24", glow: "rgba(251,191,36,.25)", bg: "rgba(251,191,36,.1)", bd: "rgba(251,191,36,.2)", lbl: "এআই ক্লোজিং রেডি", val: "৩,০০০৳ মাস্টার কোর্স", vc: "#fcd34d" },
          ].map((k, i) => {
            const I = k.icon;
            return (
              <div key={i} className="kpi" style={{ borderColor: k.bd }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: k.bg, border: `1px solid ${k.bd}`, display: "flex", alignItems: "center", justifyContent: "center", color: k.color, boxShadow: `0 4px 16px ${k.glow}`, flexShrink: 0 }}>
                  <I style={{ width: 20, height: 20 }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>{k.lbl}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: k.vc, lineHeight: 1 }}>{k.val}</div>
                </div>
                <div style={{ position: "absolute", top: 12, right: 12, color: k.color, opacity: .12 }}><I style={{ width: 32, height: 32 }} /></div>
              </div>
            );
          })}
        </div>

        <hr className="divd" />

        <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 0", flexWrap: "wrap" }}>
          <form onSubmit={handleSearch} style={{ flex: 1, minWidth: 280, display: "flex", gap: 10 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search style={{ position: "absolute", left: 16, top: 16, width: 18, height: 18, color: "#64748b", pointerEvents: "none" }} />
              <input className="sinput" type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="ওষুধের নাম বা সমস্যা খুঁজুন... (যেমন: Soul Mate, Dream Touch, Men's Burner)" />
              {search && (
                <button type="button" onClick={() => { setSearch(""); setTimeout(fetchProducts, 50); }} style={{ position: "absolute", right: 14, top: 15, background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex" }}>
                  <X style={{ width: 18, height: 18 }} />
                </button>
              )}
            </div>
            <button type="submit" className="btnp" style={{ height: 50, padding: "0 24px" }}>
              <Search style={{ width: 16, height: 16 }} />
              <span>খুঁজুন</span>
            </button>
          </form>
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 50, padding: "0 16px", borderRadius: 14, background: "rgba(255,255,255,.03)", border: "1px solid #1e2438", color: "#cbd5e1", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
            <ArrowUpDown style={{ width: 15, height: 15, color: "#a855f7" }} />
            <span style={{ color: "#94a3b8" }}>সাজান:</span>
            <select className="ssel" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
              <option value="sl">সিরিয়াল (১-৫৭)</option>
              <option value="price_low">মূল্য: কম → বেশি</option>
              <option value="price_high">মূল্য: বেশি → কম</option>
            </select>
          </div>
        </div>

        <hr className="divd" />

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0", overflowX: "auto", flexWrap: "nowrap" }}>
          {[
            { id: "all", lbl: "সবগুলো ওষুধ", icon: Layers, cnt: total },
            { id: "in_stock", lbl: "ইন স্টক", icon: CheckCircle2, cnt: inStock },
            { id: "discounted", lbl: "স্পেশাল অফার", icon: Flame, cnt: offers },
            { id: "mens", lbl: "পুরুষ স্বাস্থ্য ও শক্তি", icon: Sparkles },
            { id: "pain", lbl: "বাত ও জয়েন্ট ব্যথা", icon: HeartPulse },
            { id: "gastric", lbl: "গ্যাস ও লিভার কেয়ার", icon: ShieldCheck },
          ].map(t => {
            const I = t.icon;
            const on = activeFilter === t.id;
            return (
              <button key={t.id} className={`fpill${on ? " on" : ""}`} onClick={() => setActiveFilter(t.id as FilterCategory)}>
                <I style={{ width: 14, height: 14 }} />
                <span>{t.lbl}</span>
                {(t as any).cnt !== undefined && <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 20, background: on ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.06)", fontWeight: 800 }}>{(t as any).cnt}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "28px 32px 80px", maxWidth: 1700, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 20 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ borderRadius: 20, overflow: "hidden", border: "1px solid #1a1f32" }}>
                <div className="shim" style={{ height: 190 }} />
                <div style={{ padding: 16, background: "#131624" }}>
                  <div className="shim" style={{ height: 16, width: "70%", marginBottom: 10 }} />
                  <div className="shim" style={{ height: 12, width: "50%", marginBottom: 18 }} />
                  <div className="shim" style={{ height: 36 }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px", background: "rgba(19,22,36,.6)", borderRadius: 24, border: "1px dashed #1e2438", maxWidth: 480, margin: "40px auto" }}>
            <Search style={{ width: 44, height: 44, color: "#334155", margin: "0 auto 16px" }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>কোনো ওষুধ পাওয়া যায়নি</h3>
            <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>অন্য কোনো নাম লিখে সার্চ করুন অথবা ফিল্টার পরিবর্তন করুন।</p>
            <button className="btnp" onClick={() => { setSearch(""); setActiveFilter("all"); fetchProducts(); }}>সব ওষুধ দেখুন</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 22 }}>
            {filtered.map(p => {
              const isOut = p.stock_status === "out_of_stock";
              const isLim = p.stock_status === "limited";
              const sCls = isOut ? "sr" : isLim ? "sa" : "sg";
              const sLbl = isOut ? "স্টক শেষ" : isLim ? "সীমিত স্টক" : "ইন স্টক";
              return (
                <div key={p.sl} className="pcard sup" onClick={() => setSelected(p)}>
                  <div className="cmedia">
                    {p.imageUrl && !imageErrors.has(p.imageFile) ? (
                      <img src={p.imageUrl} alt={p.name} onError={() => setImageErrors(prev => new Set(prev).add(p.imageFile))} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <Stethoscope style={{ width: 48, height: 48, color: "#1e2438", opacity: .4 }} />
                        <span style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>SL #{p.sl}</span>
                      </div>
                    )}
                    <div className="cmov" />
                    <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 6 }}>
                      <span style={{ background: "rgba(124,58,237,.9)", color: "#fff", fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6, backdropFilter: "blur(8px)" }}>SL #{p.sl}</span>
                      {p.discount_price && <span style={{ background: "rgba(16,185,129,.9)", color: "#fff", fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6, backdropFilter: "blur(8px)" }}>অফার</span>}
                    </div>
                    <div style={{ position: "absolute", top: 10, right: 10 }}>
                      <span className={sCls} style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 5, backdropFilter: "blur(8px)" }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                        {sLbl}
                      </span>
                    </div>
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 14px 8px" }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1.3, textShadow: "0 2px 8px rgba(0,0,0,.8)" }}>{p.name}</div>
                    </div>
                  </div>
                  <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, margin: 0 }}>{(p.generic || p.manufacturer || "গ্রীন হেলথ ল্যাবরেটরিজ").slice(0, 80)}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {p.discount_price ? (
                        <>
                          <span className="pneon" style={{ fontSize: 22, fontWeight: 900 }}>৳{p.discount_price}</span>
                          {p.custom_price && <span style={{ fontSize: 13, textDecoration: "line-through", color: "#64748b" }}>৳{p.custom_price}</span>}
                        </>
                      ) : p.custom_price ? (
                        <span className="pneon" style={{ fontSize: 22, fontWeight: 900 }}>৳{p.custom_price}</span>
                      ) : (
                        <span style={{ fontSize: 12, color: "#c084fc", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                          <Info style={{ width: 13, height: 13 }} />
                          মূল্য নির্ধারণ করুন
                        </span>
                      )}
                    </div>
                    {p.custom_note && (
                      <div style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(124,58,237,.08)", border: "1px solid rgba(124,58,237,.2)", color: "#c084fc", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                        <Flame style={{ width: 12, height: 12, flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.custom_note}</span>
                      </div>
                    )}
                    <button className="cbtn" onClick={e => { e.stopPropagation(); setSelected(p); }}>
                      <Edit3 style={{ width: 14, height: 14 }} />
                      <span>এডিট ও লাইভ কন্ট্রোল</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div className="mbk" onClick={closeModal}>
          <div className="msh fsc" onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 26px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                {selected.imageUrl && !imageErrors.has(selected.imageFile) ? (
                  <img src={selected.imageUrl} alt={selected.name} style={{ width: 52, height: 52, borderRadius: 12, objectFit: "cover", border: "2px solid rgba(124,58,237,.4)", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: "rgba(124,58,237,.1)", border: "1px solid rgba(124,58,237,.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Stethoscope style={{ width: 24, height: 24, color: "#a855f7" }} />
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9", margin: 0 }}>{selected.name}</h2>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: "rgba(124,58,237,.25)", color: "#c084fc", border: "1px solid rgba(124,58,237,.3)" }}>#{selected.sl}</span>
                  </div>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#94a3b8" }}>টাইপ করার ২ সেকেন্ডের মধ্যে ভিপিএসে স্বয়ংক্রিয় সেভ হবে</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <div className={svCls} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{svLbl}</div>
                <button onClick={closeModal}
                  style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,.15)"; (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.05)"; (e.currentTarget as HTMLElement).style.color = "#94a3b8"; }}
                >
                  <X style={{ width: 18, height: 18 }} />
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 4, padding: "10px 20px", background: "rgba(0,0,0,.3)", borderBottom: "1px solid rgba(255,255,255,.04)", overflowX: "auto", flexShrink: 0 }}>
              {[
                { id: "pricing", lbl: "মূল্য ও স্টক", icon: DollarSign },
                { id: "pitch", lbl: "হাকিমি সেলস পিচ", icon: Flame },
                { id: "clinical", lbl: "সেবনবিধি ও সমাধান", icon: HeartPulse },
                { id: "specialists", lbl: "ডাক্তার ও আপত্তি খণ্ডন", icon: Stethoscope },
              ].map(t => {
                const I = t.icon;
                const on = modalTab === t.id;
                return (
                  <button key={t.id} className={`mtab${on ? " on" : ""}`} onClick={() => setModalTab(t.id as ModalTab)}>
                    <I style={{ width: 14, height: 14 }} />
                    <span>{t.lbl}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ padding: "22px 26px", overflowY: "auto", flex: 1 }}>
              {modalTab === "pricing" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>
                    <div>
                      <label className="lp" style={{ display: "block", marginBottom: 8 }}>💰 রেগুলার মূল্য</label>
                      <input className="finput" type="text" value={selected.custom_price || ""} onChange={e => handleFieldChange("custom_price", e.target.value)} placeholder="যেমন: ৩,৫০০" />
                      <span style={{ fontSize: 11, color: "#64748b", marginTop: 5, display: "block" }}>কাটা মূল্য হিসেবে দেখাবে</span>
                    </div>
                    <div>
                      <label className="lg" style={{ display: "block", marginBottom: 8 }}>🏷️ অফার মূল্য</label>
                      <input className="finput" type="text" value={selected.discount_price || ""} onChange={e => handleFieldChange("discount_price", e.target.value)} placeholder="যেমন: ৩,০০০" style={{ borderColor: "rgba(16,185,129,.3)", color: "#34d399" }} />
                      <span style={{ fontSize: 11, color: "#10b981", marginTop: 5, display: "block" }}>এআই এই মূল্যে ক্লোজ করবে</span>
                    </div>
                    <div>
                      <label className="lb" style={{ display: "block", marginBottom: 8 }}>📦 স্টক স্ট্যাটাস</label>
                      <select className="fsel" value={selected.stock_status || "in_stock"} onChange={e => handleFieldChange("stock_status", e.target.value)}>
                        <option value="in_stock">✅ পর্যাপ্ত স্টক আছে</option>
                        <option value="limited">⚠️ সীমিত স্টক</option>
                        <option value="out_of_stock">❌ স্টক শেষ</option>
                      </select>
                      <span style={{ fontSize: 11, color: "#64748b", marginTop: 5, display: "block" }}>এআই স্বয়ংক্রিয়ভাবে জানাবে</span>
                    </div>
                  </div>
                  <div className="ibox" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <Sparkles style={{ width: 18, height: 18, color: "#a855f7", flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>🎯 হাই-টিকেট ক্লোজিং কৌশল</div>
                      <div style={{ fontSize: 12, color: "#c4b5fd", lineHeight: 1.7 }}>৩,০০০ টাকার প্রিমিয়াম প্যাকেজকে ফোকাস রাখুন। এআই কাস্টমারের সমস্যা শুনে স্থায়ী সমাধানের উপর জোর দিয়ে ক্লোজ করবে।</div>
                    </div>
                  </div>
                </div>
              )}
              {modalTab === "pitch" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <label className="lp" style={{ display: "block", marginBottom: 8 }}>🎁 বিশেষ অফার / শর্তাবলী</label>
                    <input className="finput" type="text" value={selected.custom_note || ""} onChange={e => handleFieldChange("custom_note", e.target.value)} placeholder="যেমন: ২ ফাইল নিলে ফ্রি হোম ডেলিভারি!" />
                  </div>
                  <div>
                    <label className="lb" style={{ display: "block", marginBottom: 8 }}>🦅 হাকিমের আল্টিমেট পিচ</label>
                    <textarea className="ftxt" rows={5} value={selected.custom_pitch || ""} onChange={e => handleFieldChange("custom_pitch", e.target.value)} placeholder="খাঁটি হিমালয়ান শিলাজিৎ, অশ্বগন্ধা ও প্রাকৃতিক ভেষজে প্রস্তুত..." />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>📌 অতিরিক্ত নির্দেশনা</label>
                    <textarea className="ftxt" rows={3} value={selected.custom_details || ""} onChange={e => handleFieldChange("custom_details", e.target.value)} placeholder="ডেলিভারি বা প্যাকেজিং সংক্রান্ত বিশেষ নোট..." />
                  </div>
                </div>
              )}
              {modalTab === "clinical" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
                    <div>
                      <label className="lb" style={{ display: "block", marginBottom: 8 }}>💊 সেবনবিধি ও ডোজ</label>
                      <textarea className="ftxt" rows={5} value={selected.dosageForm || ""} onChange={e => handleFieldChange("dosageForm", e.target.value)} placeholder="যেমন: প্রতিদিন রাতে খাবারের পর কুসুম গরম দুধসহ ১টি ক্যাপসুল।" />
                    </div>
                    <div>
                      <label className="lr" style={{ display: "block", marginBottom: 8 }}>⚠️ সমস্যা ও সমাধান</label>
                      <textarea className="ftxt" rows={5} value={selected.painPoints || ""} onChange={e => handleFieldChange("painPoints", e.target.value)} placeholder="দ্রুত বীর্যপাত, লিঙ্গ শিথিলতার লক্ষণ ও সমাধান..." />
                    </div>
                  </div>
                  {selected.dietary && (
                    <div style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(16,185,129,.06)", border: "1px solid rgba(16,185,129,.2)" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        <ShieldCheck style={{ width: 16, height: 16 }} />
                        🥗 পুষ্টি ও ডায়েট চার্ট
                      </div>
                      <div style={{ fontSize: 12, color: "#a7f3d0", whiteSpace: "pre-line", lineHeight: 1.7 }}>{selected.dietary}</div>
                    </div>
                  )}
                </div>
              )}
              {modalTab === "specialists" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {selected.specialists && selected.specialists.length > 0 ? (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#60a5fa", marginBottom: 12, display: "flex", alignItems: "center", gap: 6, letterSpacing: ".06em", textTransform: "uppercase" }}>
                        <Stethoscope style={{ width: 14, height: 14 }} />
                        <span>বিশ্বখ্যাত বিশেষজ্ঞদের উক্তি</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
                        {selected.specialists.map((sp, i) => (
                          <div key={i} className="spcard">
                            <div style={{ fontWeight: 700, color: "#93c5fd", fontSize: 13, marginBottom: 2 }}>{sp.name} {sp.flag || ""}</div>
                            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{sp.title ? `${sp.title}, ` : ""}{sp.institute}</div>
                            <div style={{ fontSize: 12, color: "#e2e8f0", fontStyle: "italic", lineHeight: 1.6 }}>"{sp.quote}"</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: "#64748b" }}>এই ওষুধের জন্য কোনো বিশেষজ্ঞ মন্তব্য ডাটাবেসে নেই।</p>
                  )}
                  {selected.objections && selected.objections.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#fb7185", marginBottom: 12, display: "flex", alignItems: "center", gap: 6, letterSpacing: ".06em", textTransform: "uppercase" }}>
                        <Flame style={{ width: 14, height: 14 }} />
                        <span>কাস্টমারের আপত্তি খণ্ডন কৌশল</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {selected.objections.map((ob, i) => (
                          <div key={i} className="obcard">
                            <div style={{ fontWeight: 700, color: "#fda4af", fontSize: 13, marginBottom: 6 }}>❓ {ob.objection}</div>
                            <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.6 }}>💡 {ob.script}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: "14px 26px", borderTop: "1px solid rgba(255,255,255,.05)", background: "rgba(0,0,0,.3)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, flexWrap: "wrap", gap: 10 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>💡 টাইপ শেষের ২ সেকেন্ডের মধ্যে স্বয়ংক্রিয় সেভ হবে</span>
              <button className="btnp" onClick={closeModal}>
                <Check style={{ width: 15, height: 15 }} />
                <span>সম্পন্ন করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
