"use client";

import { useState, useEffect } from "react";
import {
  Bot,
  Search,
  Phone,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  PlayCircle,
  PauseCircle,
  Sparkles,
  Sliders
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
}

export default function DashboardBotControlPage() {
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
        showNotice(`🛑 ${customerName || "কাস্টমার"}-এর জন্য বট বন্ধ! আপনি চ্যাট করতে পারেন।`);
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
      showNotice("⚠️ সমস্যা হয়েছে, আবার চেষ্টা করুন");
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
        minHeight: "100%",
        color: "#f8fafc",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "16px",
        maxWidth: "600px",
        margin: "0 auto"
      }}
    >
      {/* Toast Notice */}
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
            fontSize: 13,
            fontWeight: 600,
            color: "#fef3c7",
            display: "flex",
            alignItems: "center",
            gap: 10
          }}
        >
          <Sparkles size={16} color="#fbbf24" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
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
              <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>স্মার্ট বট কন্ট্রোলার</h1>
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
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
          <input
            type="text"
            placeholder="কাস্টমারের নাম বা ফোন খুঁজুন..."
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

        {/* Tabs */}
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
                cursor: "pointer"
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
      </div>

      {/* Cards List */}
      <div>
        {loading && conversations.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>লোড হচ্ছে...</div>
        ) : filteredList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>কোনো কাস্টমার পাওয়া যায়নি</div>
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
                    borderRadius: 16,
                    padding: "14px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{conv.name || "কাস্টমার"}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                        {conv.phone || `ID: ${conv.senderId.slice(-8)}`} • {formatTime(conv.lastTs)}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 700,
                        background: isPaused ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)",
                        color: isPaused ? "#f87171" : "#34d399"
                      }}
                    >
                      {isPaused ? "হাতে নেওয়া" : "অটো রিপ্লাই"}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "rgba(0, 0, 0, 0.25)",
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 12,
                      color: "#cbd5e1",
                      marginTop: 10,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    💬 {conv.lastMessage || "বার্তা নেই"}
                  </div>

                  <button
                    onClick={() => toggleBot(conv.senderId, isPaused, conv.name)}
                    disabled={isToggling}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      marginTop: 12,
                      background: isPaused
                        ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                        : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                      color: "#ffffff"
                    }}
                  >
                    {isToggling ? "অপেক্ষা..." : isPaused ? "🟢 বট চালু করুন (Resume)" : "🛑 বট বন্ধ করুন (আমি রিপ্লাই দেব)"}
                  </button>

                  <div style={{ textAlign: "center", marginTop: 6 }}>
                    <button
                      onClick={() => toggleExpandChat(conv.senderId)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        fontSize: 11,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <span>{isExpanded ? "লুকান" : "মেসেজ দেখুন"}</span>
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: "10px",
                        background: "rgba(0, 0, 0, 0.4)",
                        borderRadius: 10,
                        maxHeight: 220,
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6
                      }}
                    >
                      {chatLoading ? (
                        <div style={{ textAlign: "center", padding: "10px", color: "#64748b", fontSize: 11 }}>লোড হচ্ছে...</div>
                      ) : chatMessages.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "10px", color: "#64748b", fontSize: 11 }}>কোনো মেসেজ নেই</div>
                      ) : (
                        chatMessages.slice(-5).map((msg, i) => (
                          <div
                            key={i}
                            style={{
                              alignSelf: msg.role === "bot" ? "flex-end" : "flex-start",
                              maxWidth: "85%",
                              padding: "6px 10px",
                              borderRadius: 10,
                              fontSize: 11,
                              background: msg.role === "bot" ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.08)",
                              color: msg.role === "bot" ? "#a7f3d0" : "#f1f5f9"
                            }}
                          >
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
      </div>
    </div>
  );
}
