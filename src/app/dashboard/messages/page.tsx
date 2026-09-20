"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  User,
  Phone,
  MapPin,
  Package,
  Clock,
  ChevronRight,
  X,
  Mic,
  Bot,
  RefreshCw,
  Users,
  ArrowLeft,
} from "lucide-react";

interface Conversation {
  senderId: string;
  name: string;
  district: string;
  phone: string;
  symptoms: string[];
  productDiscussed: string;
  orderStatus: string;
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
  source?: string;
}

interface Profile {
  name: string;
  age: string;
  phone: string;
  district: string;
  symptoms: string[];
  productDiscussed: string;
  orderStatus: string;
  firstContact: number | null;
  lastContact: number | null;
  totalMessages: number;
}

function formatTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "এইমাত্র";
  if (diffMins < 60) return `${diffMins} মিনিট আগে`;
  if (diffHours < 24) return `${diffHours} ঘন্টা আগে`;
  if (diffDays < 7) return `${diffDays} দিন আগে`;
  return d.toLocaleDateString("bn-BD", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(ts: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("bn-BD", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getStatusColor(status: string) {
  switch (status) {
    case "ordered": return "#34d399";
    case "confirmed": return "#60a5fa";
    case "shipped": return "#a78bfa";
    case "delivered": return "#fbbf24";
    default: return "#94a3b8";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "ordered": return "অর্ডার";
    case "confirmed": return "কনফার্ম";
    case "shipped": return "শিপ";
    case "delivered": return "ডেলিভার";
    default: return "জিজ্ঞাসা";
  }
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filtered, setFiltered] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [filterReal, setFilterReal] = useState(false);
  const [error, setError] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);

  const loadConversations = async (q = "") => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/chat-history?search=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch {
      setError("ডেটা লোড করতে সমস্যা হচ্ছে");
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async (conv: Conversation) => {
    setSelected(conv);
    setMsgLoading(true);
    setMessages([]);
    setProfile(null);
    try {
      const res = await fetch(`/api/chat-history?senderId=${encodeURIComponent(conv.senderId)}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMessages(data.messages || []);
      setProfile(data.profile || null);
      setTimeout(() => {
        chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
    } catch {
      setMessages([]);
    } finally {
      setMsgLoading(false);
    }
  };

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    let list = conversations;
    if (filterReal) list = list.filter((c) => c.isRealUser);
    setFiltered(list);
  }, [conversations, filterReal]);

  useEffect(() => {
    const timer = setTimeout(() => { loadConversations(search); }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const realCount = conversations.filter((c) => c.isRealUser).length;
  const testCount = conversations.length - realCount;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: "var(--bg-base, #0b0a07)", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      {/* Left Panel */}
      <div style={{ width: selected ? 360 : "100%", maxWidth: selected ? 360 : "none", minWidth: selected ? 300 : "auto", display: "flex", flexDirection: "column", borderRight: selected ? "1px solid rgba(245, 158, 11, 0.15)" : "none", background: "rgba(0,0,0,0.3)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "20px 20px 16px", background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(180,83,9,0.04))", borderBottom: "1px solid rgba(245,158,11,0.12)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, background: "linear-gradient(135deg, #fffbeb, #fbbf24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0, lineHeight: 1.2 }}>
                📩 মেসেজ হিস্ট্রি
              </h1>
              <div style={{ fontSize: 12, color: "#a38c5b", marginTop: 2 }}>
                মোট {conversations.length} কথোপকথন · {realCount} আসল গ্রাহক · {testCount} টেস্ট
              </div>
            </div>
            <button onClick={() => loadConversations(search)} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.05)", color: "#fbbf24", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="রিফ্রেশ">
              <RefreshCw size={16} />
            </button>
          </div>

          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#a38c5b" }} />
            <input type="text" placeholder="নাম, জেলা, ফোন, পণ্য দিয়ে খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 12, border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.04)", color: "#fef9ed", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#a38c5b", cursor: "pointer", display: "flex" }}>
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => setFilterReal(false)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${!filterReal ? "rgba(245,158,11,0.5)" : "rgba(245,158,11,0.15)"}`, background: !filterReal ? "rgba(245,158,11,0.15)" : "transparent", color: !filterReal ? "#fbbf24" : "#a38c5b", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              সব ({conversations.length})
            </button>
            <button onClick={() => setFilterReal(true)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${filterReal ? "rgba(52,211,153,0.5)" : "rgba(52,211,153,0.15)"}`, background: filterReal ? "rgba(52,211,153,0.12)" : "transparent", color: filterReal ? "#34d399" : "#a38c5b", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
              <Users size={11} />আসল গ্রাহক ({realCount})
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#a38c5b" }}><div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div><div style={{ fontSize: 13 }}>লোড হচ্ছে...</div></div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: 40, color: "#f87171" }}><div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div><div style={{ fontSize: 13 }}>{error}</div></div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#a38c5b" }}><div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div><div style={{ fontSize: 13 }}>কোনো কথোপকথন পাওয়া যায়নি</div></div>
          ) : (
            filtered.map((conv) => {
              const isActive = selected?.senderId === conv.senderId;
              return (
                <button key={conv.senderId} onClick={() => loadConversation(conv)} style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", background: isActive ? "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(180,83,9,0.08))" : "transparent", borderLeft: isActive ? "3px solid #fbbf24" : "3px solid transparent", borderRight: "none", borderTop: "none", borderBottom: "1px solid rgba(245,158,11,0.06)", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: conv.isRealUser ? "linear-gradient(135deg, #f59e0b, #b45309)" : "linear-gradient(135deg, #334155, #1e293b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                    {conv.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: isActive ? "#fef9ed" : "#e2c97a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>
                        {conv.name}
                      </div>
                      <div style={{ fontSize: 10, color: "#6b5c3a", whiteSpace: "nowrap" }}>{formatTime(conv.lastTs)}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "#8c784e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 5 }}>
                      {conv.lastMessage || "কোনো বার্তা নেই"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {conv.district && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>📍 {conv.district}</span>}
                      {conv.productDiscussed && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>💊 {conv.productDiscussed}</span>}
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(148,163,184,0.08)", color: "#64748b" }}>{conv.totalMessages} মেসেজ</span>
                    </div>
                  </div>
                  <ChevronRight size={14} color="#4b3f26" style={{ flexShrink: 0, marginTop: 4 }} />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel */}
      {selected && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          {/* Chat Header */}
          <div style={{ padding: "16px 20px", background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(180,83,9,0.04))", borderBottom: "1px solid rgba(245,158,11,0.12)", display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => setSelected(null)} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.05)", color: "#fbbf24", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArrowLeft size={16} />
            </button>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: selected.isRealUser ? "linear-gradient(135deg, #f59e0b, #b45309)" : "linear-gradient(135deg, #334155, #1e293b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
              {selected.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fef9ed", display: "flex", alignItems: "center", gap: 8 }}>
                {profile?.name || selected.name}
                {selected.isRealUser && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>আসল গ্রাহক</span>}
              </div>
              <div style={{ fontSize: 11, color: "#a38c5b", display: "flex", gap: 12, marginTop: 2 }}>
                <span>ID: {selected.senderId.slice(0, 20)}</span>
                {profile?.lastContact && <span>সর্বশেষ: {formatTime(profile.lastContact)}</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {profile?.phone && <div style={{ padding: "5px 10px", borderRadius: 8, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><Phone size={11} />{profile.phone}</div>}
              {profile?.district && <div style={{ padding: "5px 10px", borderRadius: 8, background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", color: "#60a5fa", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><MapPin size={11} />{profile.district}</div>}
              {profile?.productDiscussed && <div style={{ padding: "5px 10px", borderRadius: 8, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", color: "#a78bfa", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><Package size={11} />{profile.productDiscussed}</div>}
            </div>
          </div>

          {/* Profile Bar */}
          {profile && (profile.age || profile.symptoms.length > 0) && (
            <div style={{ padding: "10px 20px", background: "rgba(245,158,11,0.03)", borderBottom: "1px solid rgba(245,158,11,0.08)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <User size={13} color="#fbbf24" />
              {profile.age && <span style={{ fontSize: 12, color: "#cfb989" }}>বয়স: {profile.age}</span>}
              {profile.symptoms.map((s, i) => (
                <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>{s}</span>
              ))}
              {profile.firstContact && <span style={{ fontSize: 11, color: "#6b5c3a", marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}><Clock size={11} />প্রথম: {formatDateTime(profile.firstContact)}</span>}
            </div>
          )}

          {/* Messages */}
          <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 12 }}>
            {msgLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#a38c5b" }}><div style={{ fontSize: 24, marginBottom: 8 }}>💬</div><div style={{ fontSize: 13 }}>মেসেজ লোড হচ্ছে...</div></div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#a38c5b" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📭</div><div style={{ fontSize: 13 }}>কোনো মেসেজ পাওয়া যায়নি</div></div>
            ) : (
              messages.map((msg, idx) => {
                const isBot = msg.role === "bot";
                return (
                  <div key={idx} style={{ display: "flex", flexDirection: isBot ? "row" : "row-reverse", alignItems: "flex-end", gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: isBot ? "linear-gradient(135deg, #f59e0b, #b45309)" : "linear-gradient(135deg, #3b82f6, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {isBot ? <Bot size={14} color="#000" /> : <User size={13} color="#fff" />}
                    </div>
                    <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ fontSize: 10, color: "#4b3f26", textAlign: isBot ? "left" : "right" }}>
                        {isBot ? "🤖 বট (রাফি)" : "👤 গ্রাহক"}
                        {msg.isVoice && <Mic size={9} style={{ marginLeft: 4, display: "inline" }} />}
                        {msg.ts && <span style={{ marginLeft: 6 }}>{formatDateTime(msg.ts)}</span>}
                      </div>
                      <div style={{ padding: "10px 14px", borderRadius: isBot ? "4px 14px 14px 14px" : "14px 4px 14px 14px", background: isBot ? "linear-gradient(135deg, rgba(245,158,11,0.14), rgba(180,83,9,0.08))" : "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(29,78,216,0.08))", border: isBot ? "1px solid rgba(245,158,11,0.2)" : "1px solid rgba(59,130,246,0.2)", color: "#fef9ed", fontSize: 13.5, lineHeight: 1.6, wordBreak: "break-word" }}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "10px 20px", borderTop: "1px solid rgba(245,158,11,0.1)", background: "rgba(0,0,0,0.2)", display: "flex", gap: 16, fontSize: 11, color: "#4b3f26" }}>
            <span>📩 মোট: {messages.length}</span>
            <span>🤖 বট: {messages.filter((m) => m.role === "bot").length}</span>
            <span>👤 গ্রাহক: {messages.filter((m) => m.role === "customer").length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
