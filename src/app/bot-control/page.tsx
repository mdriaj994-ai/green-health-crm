"use client";

import { useState, useEffect } from "react";
import {
  Bot,
  Search,
  Phone,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Sliders,
  PlayCircle,
  PauseCircle,
  ArrowLeft,
  Sparkles
} from "lucide-react";

interface Conversation {
  senderId: string;
  name: string;
  district: string;
  phone: string;
  productDiscussed: string;
  lastMessage: string;
  lastTs: number;
  totalMessages: number;
  isRealUser: boolean;
}

interface Message {
  role: "customer" | "bot";
  text: string;
  ts: number;
  isVoice?: boolean;
}

export default function MobileBotControlPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pausedSet, setPausedSet] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "paused">("all");
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [convRes, pauseRes] = await Promise.all([
        fetch("/api/chat-history?search=" + encodeURIComponent(search)),
        fetch("/api/human-takeover")
      ]);

      if (convRes.ok) {
        const cData = await convRes.json();
        setConversations(cData.conversations || []);
      }

      if (pauseRes.ok) {
        const pData = await pauseRes.json();
        const pSet = new Set<string>();
        for (const p of pData.paused || []) {
          pSet.add(String(p.senderId));
        }
        setPausedSet(pSet);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 12000);
    return () => clearInterval(interval);
  }, [search]);

  const toggleBot = async (senderId: string, currentPaused: boolean, customerName: string) => {
    setTogglingId(senderId);
    try {
      if (currentPaused) {
        // Resume Bot
        await fetch("/api/human-takeover", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ senderId, pageId: "all" })
        });
        setPausedSet((prev) => {
          const next = new Set(prev);
          next.delete(senderId);
          return next;
        });
        showNotice(`✅ ${customerName || "কাস্টমার"}-এর জন্য বট আবার চালু করা হয়েছে!`);
      } else {
        // Pause Bot
        await fetch("/api/human-takeover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ senderId, pageId: "all", reason: "mobile_toggle" })
        });
        setPausedSet((prev) => {
          const next = new Set(prev);
          next.add(senderId);
          return next;
        });
        showNotice(`🛑 ${customerName || "কাস্টমার"}-এর জন্য বট বন্ধ! আপনি নিজে চ্যাট করতে পারবেন।`);
      }
    } catch {
      showNotice("⚠️ সার্ভারের সাথে যোগাযোগ ব্যর্থ হয়েছে");
    } finally {
      setTogglingId(null);
    }
  };

  const resumeAll = async () => {
    if (pausedSet.size === 0) return;
    if (!confirm("আপনি কি সব পজ থাকা কাস্টমারদের জন্য বট চালু করতে চান?")) return;
    setBulkLoading(true);
    try {
      for (const sid of Array.from(pausedSet)) {
        await fetch("/api/human-takeover", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ senderId: sid, pageId: "all" })
        });
      }
      setPausedSet(new Set());
      showNotice("✅ সব কাস্টমারের জন্য বট চালু করা হয়েছে!");
    } catch {
      showNotice("⚠️ সমস্যা হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন");
    } finally {
      setBulkLoading(false);
    }
  };

  const showNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 3500);
  };

  const toggleExpandChat = async (senderId: string) => {
    if (expandedId === senderId) {
      setExpandedId(null);
      setChatMessages([]);
      return;
    }
    setExpandedId(senderId);
    setChatLoading(true);
    try {
      const res = await fetch(`/api/chat-history?senderId=${encodeURIComponent(senderId)}`);
      if (res.ok) {
        const d = await res.json();
        setChatMessages(d.messages || []);
      }
    } catch {
      setChatMessages([]);
    } finally {
      setChatLoading(false);
    }
  };

  const formatTime = (ts: number) => {
    if (!ts) return "";
    const diff = Math.floor((Date.now() - ts) / 60000);
    if (diff < 1) return "এখনই";
    if (diff < 60) return `${diff} মি. আগে`;
    const h = Math.floor(diff / 60);
    if (h < 24) return `${h} ঘণ্টা আগে`;
    return `${Math.floor(h / 24)} দিন আগে`;
  };

  const filteredList = conversations.filter((c) => {
    if (filter === "paused") return pausedSet.has(c.senderId);
    return true;
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #090d16 0%, #030712 100%)",
        color: "#f8fafc",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        paddingBottom: "80px"
      }}
    >
      {/* Toast Notification */}
      {statusNotice && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: 16,
            right: 16,
            zIndex: 9999,
            padding: "12px 16px",
            background: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(245, 158, 11, 0.4)",
            borderRadius: 14,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.6)",
            fontSize: 13,
            fontWeight: 600,
            color: "#fef3c7",
            display: "flex",
            alignItems: "center",
            gap: 10,
            animation: "slideDown 0.3s ease"
          }}
        >
          <Sparkles size={16} color="#fbbf24" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(9, 13, 22, 0.85)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          padding: "14px 16px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 15px rgba(16, 185, 129, 0.35)"
              }}
            >
              <Bot size={22} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
                স্মার্ট বট কন্ট্রোলার
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
                <span style={{ fontSize: 11, color: "#94a3b8" }}>২৪/৭ লাইভ অটো-রিপ্লাই ইঞ্জিন</span>
              </div>
            </div>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer"
            }}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
          <input
            type="text"
            placeholder="কাস্টমারের নাম বা ফোন নাম্বার খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "11px 14px 11px 40px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: 12,
              color: "#ffffff",
              fontSize: 13,
              outline: "none"
            }}
          />
        </div>

        {/* Filters & Action Bar */}
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setFilter("all")}
              style={{
                padding: "6px 14px",
                borderRadius: 9,
                fontSize: 12,
                fontWeight: 700,
                border: "none",
                background: filter === "all" ? "#3b82f6" : "rgba(255, 255, 255, 0.06)",
                color: filter === "all" ? "#ffffff" : "#94a3b8",
                cursor: "pointer"
              }}
            >
              সব চ্যাট ({conversations.length})
            </button>
            <button
              onClick={() => setFilter("paused")}
              style={{
                padding: "6px 14px",
                borderRadius: 9,
                fontSize: 12,
                fontWeight: 700,
                border: "none",
                background: filter === "paused" ? "#ef4444" : "rgba(239, 68, 68, 0.12)",
                color: filter === "paused" ? "#ffffff" : "#f87171",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5
              }}
            >
              🛑 পজ করা ({pausedSet.size})
            </button>
          </div>

          {pausedSet.size > 0 && (
            <button
              onClick={resumeAll}
              disabled={bulkLoading}
              style={{
                padding: "6px 12px",
                borderRadius: 9,
                fontSize: 11,
                fontWeight: 700,
                border: "1px solid rgba(16, 185, 129, 0.4)",
                background: "rgba(16, 185, 129, 0.15)",
                color: "#34d399",
                cursor: "pointer"
              }}
            >
              {bulkLoading ? "..." : "সব চালু করুন"}
            </button>
          )}
        </div>
      </header>

      {/* Main List */}
      <main style={{ padding: "14px 16px" }}>
        {loading && conversations.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
            <RefreshCw size={26} style={{ animation: "spin 1s linear infinite", marginBottom: 12 }} />
            <div style={{ fontSize: 13 }}>কাস্টমার তালিকা লোড হচ্ছে...</div>
          </div>
        ) : filteredList.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "50px 20px",
              background: "rgba(255, 255, 255, 0.02)",
              borderRadius: 16,
              border: "1px dashed rgba(255, 255, 255, 0.1)"
            }}
          >
            <Bot size={34} color="#64748b" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: "#cbd5e1" }}>
              {filter === "paused" ? "বর্তমানে কোনো কাস্টমার পজ অবস্থায় নেই" : "কোনো ফলাফল পাওয়া যায়নি"}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              {filter === "paused" ? "বট সব কাস্টমারদের জন্য অটো রিপ্লাই সক্রিয় রেখেছে।" : "অন্য নাম বা ফোন নম্বর দিয়ে খুঁজুন।"}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredList.map((conv) => {
              const isPaused = pausedSet.has(conv.senderId);
              const isToggling = togglingId === conv.senderId;
              const isExpanded = expandedId === conv.senderId;

              return (
                <div
                  key={conv.senderId}
                  style={{
                    background: isPaused
                      ? "linear-gradient(145deg, rgba(239, 68, 68, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)"
                      : "linear-gradient(145deg, rgba(255, 255, 255, 0.04) 0%, rgba(15, 23, 42, 0.6) 100%)",
                    border: isPaused ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 18,
                    padding: "16px",
                    boxShadow: isPaused ? "0 4px 20px rgba(239, 68, 68, 0.08)" : "none",
                    transition: "all 0.2s ease"
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 14,
                          background: isPaused
                            ? "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
                            : "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: 18,
                          color: "#ffffff",
                          flexShrink: 0
                        }}
                      >
                        {conv.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc", lineHeight: 1.3 }}>
                          {conv.name || "অজ্ঞাত কাস্টমার"}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                          {conv.phone ? (
                            <span style={{ fontSize: 11, color: "#34d399", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                              <Phone size={10} /> {conv.phone}
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, color: "#64748b" }}>ID: {conv.senderId.slice(-8)}</span>
                          )}
                          <span style={{ fontSize: 10, color: "#64748b" }}>•</span>
                          <span style={{ fontSize: 10, color: "#94a3b8" }}>{formatTime(conv.lastTs)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div
                      style={{
                        padding: "4px 8px",
                        borderRadius: 8,
                        fontSize: 10,
                        fontWeight: 700,
                        background: isPaused ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)",
                        color: isPaused ? "#f87171" : "#34d399",
                        border: isPaused ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(16, 185, 129, 0.3)",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {isPaused ? "হাতে নেওয়া" : "অটো রিপ্লাই"}
                    </div>
                  </div>

                  {/* Last Message Snippet */}
                  <div
                    style={{
                      background: "rgba(0, 0, 0, 0.25)",
                      borderRadius: 10,
                      padding: "8px 12px",
                      fontSize: 12,
                      color: "#cbd5e1",
                      marginTop: 12,
                      border: "1px solid rgba(255, 255, 255, 0.04)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    💬 {conv.lastMessage || "বার্তা নেই"}
                  </div>

                  {/* Big Toggle Action Button */}
                  <div style={{ marginTop: 14 }}>
                    <button
                      onClick={() => toggleBot(conv.senderId, isPaused, conv.name)}
                      disabled={isToggling}
                      style={{
                        width: "100%",
                        padding: "13px 16px",
                        borderRadius: 12,
                        fontSize: 13,
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        background: isPaused
                          ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                          : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                        color: "#ffffff",
                        boxShadow: isPaused
                          ? "0 4px 14px rgba(16, 185, 129, 0.35)"
                          : "0 4px 14px rgba(239, 68, 68, 0.35)",
                        transition: "all 0.2s ease"
                      }}
                    >
                      {isToggling ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : isPaused ? (
                        <>
                          <PlayCircle size={17} />
                          <span>বট চালু করুন (Resume Bot)</span>
                        </>
                      ) : (
                        <>
                          <PauseCircle size={17} />
                          <span>বট বন্ধ করুন (আমি রিপ্লাই দেব)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Expand Chat Preview Button */}
                  <div style={{ marginTop: 8, textAlign: "center" }}>
                    <button
                      onClick={() => toggleExpandChat(conv.senderId)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 8px"
                      }}
                    >
                      <span>{isExpanded ? "চ্যাট লুকান" : "সাম্প্রতিক মেসেজ দেখুন"}</span>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>

                  {/* Expanded Chat Messages */}
                  {isExpanded && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "12px",
                        background: "rgba(0, 0, 0, 0.4)",
                        borderRadius: 12,
                        border: "1px solid rgba(255, 255, 255, 0.05)",
                        maxHeight: 260,
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8
                      }}
                    >
                      {chatLoading ? (
                        <div style={{ textAlign: "center", padding: "20px", color: "#64748b", fontSize: 12 }}>
                          লোড হচ্ছে...
                        </div>
                      ) : chatMessages.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "15px", color: "#64748b", fontSize: 12 }}>
                          কোনো মেসেজ নেই
                        </div>
                      ) : (
                        chatMessages.slice(-6).map((msg, i) => (
                          <div
                            key={i}
                            style={{
                              alignSelf: msg.role === "bot" ? "flex-end" : "flex-start",
                              maxWidth: "85%",
                              padding: "8px 12px",
                              borderRadius: 12,
                              fontSize: 12,
                              lineHeight: 1.4,
                              background: msg.role === "bot" ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.08)",
                              color: msg.role === "bot" ? "#a7f3d0" : "#f1f5f9",
                              border: msg.role === "bot" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(255, 255, 255, 0.05)"
                            }}
                          >
                            <div style={{ fontSize: 9, opacity: 0.6, marginBottom: 2 }}>
                              {msg.role === "bot" ? "🤖 বট / পেজ" : "👤 কাস্টমার"}
                            </div>
                            {msg.text}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Quick Nav */}
      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(9, 13, 22, 0.92)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          padding: "10px 16px",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          zIndex: 100
        }}
      >
        <a
          href="/bot-control"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            color: "#3b82f6",
            textDecoration: "none",
            fontSize: 10,
            fontWeight: 700
          }}
        >
          <Bot size={20} />
          <span>বট কন্ট্রোল</span>
        </a>

        <a
          href="/dashboard/messages"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            color: "#64748b",
            textDecoration: "none",
            fontSize: 10,
            fontWeight: 600
          }}
        >
          <Sliders size={20} />
          <span>ফুল ইনবক্স</span>
        </a>
      </nav>
    </div>
  );
}
