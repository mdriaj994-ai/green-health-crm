"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Send, Paperclip, MoreVertical, Phone, Video,
  UserPlus, CheckCheck, RefreshCw, Wifi, WifiOff,
} from "lucide-react";
import { formatRelativeTime, getPlatformColor, getPlatformLabel } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────
type Contact = { name: string; avatar: string | null; platformUserId: string };
type Conversation = {
  id: string; platform: string; status: string; isRead: boolean;
  contact: Contact;
  account: { platform: string; pageName: string };
  assignedAgent: { name: string } | null;
  messages: { content: string; createdAt: string; senderType: string }[];
  lastMessageAt: string;
};
type Message = {
  id: string; content: string; senderType: string;
  createdAt: string; sentByUser?: { name: string } | null;
};

// ── Platform SVG Icons ───────────────────────────────────────
const PLATFORM_ICONS: Record<string, React.ReactElement> = {
  MESSENGER: <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--color-messenger)"><path d="M12 2C6.48 2 2 6.28 2 11.5c0 2.78 1.24 5.27 3.21 6.97V22l3.84-2.12c1.02.28 2.1.43 3.22.43 5.52 0 10-4.28 10-9.5S17.52 2 12 2z"/></svg>,
  FACEBOOK: <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--color-facebook)"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  WHATSAPP: <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--color-whatsapp)"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg>,
  TELEGRAM: <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--color-telegram)"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>,
};

const STATUS_FILTERS = [
  { key: "ALL", label: "সব" },
  { key: "OPEN", label: "খোলা" },
  { key: "PENDING", label: "পেন্ডিং" },
  { key: "RESOLVED", label: "সমাধান" },
];

const PLATFORM_FILTERS = [
  { key: "ALL", label: "সব প্ল্যাটফর্ম" },
  { key: "MESSENGER", label: "Messenger" },
  { key: "WHATSAPP", label: "WhatsApp" },
  { key: "TELEGRAM", label: "Telegram" },
];

// ── Demo fallback data ───────────────────────────────────────────
const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: "demo-1", platform: "MESSENGER", status: "OPEN", isRead: false,
    contact: { name: "রহিম আহমেদ", avatar: null, platformUserId: "fb_001" },
    account: { platform: "MESSENGER", pageName: "My Fashion Store" },
    assignedAgent: null,
    messages: [{ content: "ভাই, আমার অর্ডারটা কোথায়? কখন পাবো?", createdAt: new Date(Date.now() - 5 * 60000).toISOString(), senderType: "CUSTOMER" }],
    lastMessageAt: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: "demo-2", platform: "WHATSAPP", status: "OPEN", isRead: true,
    contact: { name: "করিম মোল্লা", avatar: null, platformUserId: "wa_002" },
    account: { platform: "WHATSAPP", pageName: "My Shop" },
    assignedAgent: { name: "Agent A" },
    messages: [{ content: "দাম কত? ডেলিভারি চার্জ আছে?", createdAt: new Date(Date.now() - 25 * 60000).toISOString(), senderType: "CUSTOMER" }],
    lastMessageAt: new Date(Date.now() - 25 * 60000).toISOString(),
  },
  {
    id: "demo-3", platform: "TELEGRAM", status: "PENDING", isRead: true,
    contact: { name: "ফাতেমা বেগম", avatar: null, platformUserId: "tg_003" },
    account: { platform: "TELEGRAM", pageName: "@MyShopBot" },
    assignedAgent: null,
    messages: [{ content: "ধন্যবাদ আপনার সেবার জন্য! 🙏", createdAt: new Date(Date.now() - 2 * 3600000).toISOString(), senderType: "CUSTOMER" }],
    lastMessageAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
];

const DEMO_MESSAGES: Record<string, Message[]> = {
  "demo-1": [
    { id: "m1", senderType: "CUSTOMER", content: "আস্সালামু আলাইকুম", createdAt: new Date(Date.now() - 35 * 60000).toISOString() },
    { id: "m2", senderType: "AGENT", content: "ওয়ালাইকুম আস্সালাম! কীভাবে সাহায্য করতে পারি?", createdAt: new Date(Date.now() - 30 * 60000).toISOString() },
    { id: "m3", senderType: "CUSTOMER", content: "ভাই, আমার অর্ডারটা কোথায়? কখন পাবো?", createdAt: new Date(Date.now() - 5 * 60000).toISOString() },
  ],
  "demo-2": [
    { id: "m4", senderType: "CUSTOMER", content: "দাম কত? ডেলিভারি চার্জ আছে?", createdAt: new Date(Date.now() - 25 * 60000).toISOString() },
  ],
  "demo-3": [
    { id: "m5", senderType: "CUSTOMER", content: "আমার পার্সেল পেয়ে গেছি", createdAt: new Date(Date.now() - 3 * 3600000).toISOString() },
    { id: "m6", senderType: "AGENT", content: "আলহামদুলিল্লাহ! ভালো লেগেছে তো?", createdAt: new Date(Date.now() - 2.5 * 3600000).toISOString() },
    { id: "m7", senderType: "CUSTOMER", content: "ধন্যবাদ আপনার সেবার জন্য! 🙏", createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
  ],
};

export function InboxView() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [selectedConv, setSelectedConv]   = useState<Conversation | null>(null);
  const [statusFilter, setStatusFilter]   = useState("ALL");
  const [platformFilter, setPlatformFilter] = useState("ALL");
  const [replyText, setReplyText]         = useState("");
  const [sending, setSending]             = useState(false);
  const [loading, setLoading]             = useState(true);
  const [isOnline, setIsOnline]           = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Fetch Conversations ──────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (platformFilter !== "ALL") params.set("platform", platformFilter);
      const res = await fetch(`/api/conversations?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setConversations(data.conversations ?? []);
      setIsOnline(true);
    } catch {
      setConversations([]);
      setIsOnline(false);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, platformFilter]);

  // ── Fetch Messages ───────────────────────────────────────────
  const fetchMessages = useCallback(async (convId: string) => {
    if (convId.startsWith("demo-")) {
      setMessages(DEMO_MESSAGES[convId] ?? []);
      return;
    }
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (selectedConv) fetchMessages(selectedConv.id);
  }, [selectedConv, fetchMessages]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Select first conversation automatically ──────────────────
  useEffect(() => {
    if (conversations.length > 0 && !selectedConv) {
      setSelectedConv(conversations[0]);
    }
  }, [conversations]);

  // ── Real-time SSE + 1-Second Instant Polling (No reload needed) ───────
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/realtime");
      es.addEventListener("new_message", () => {
        fetchConversations();
        if (selectedConv) fetchMessages(selectedConv.id);
      });
      es.onerror = () => setIsOnline(true);
    } catch {}

    // 1-second instant auto-refresh timer so every message appears immediately
    const pollInterval = setInterval(() => {
      fetchConversations();
      if (selectedConv) fetchMessages(selectedConv.id);
    }, 1000);

    return () => {
      if (es) es.close();
      clearInterval(pollInterval);
    };
  }, [selectedConv, fetchConversations, fetchMessages]);

  // ── Send Reply ───────────────────────────────────────────────
  async function handleSend() {
    if (!replyText.trim() || !selectedConv || sending) return;

    if (selectedConv.id.startsWith("demo-")) {
      // Demo mode — just show in UI
      const newMsg: Message = {
        id: `local-${Date.now()}`,
        content: replyText,
        senderType: "AGENT",
        createdAt: new Date().toISOString(),
      };
      setMessages((m) => [...m, newMsg]);
      setReplyText("");
      return;
    }

    setSending(true);
    try {
      await fetch(`/api/conversations/${selectedConv.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText }),
      });
      setReplyText("");
      fetchMessages(selectedConv.id);
      fetchConversations();
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "100%" }}>

      {/* ── Left Panel: Conversation List ── */}
      <div className="conv-panel">
        {/* Status filter */}
        <div className="conv-filters">
          {STATUS_FILTERS.map((f) => (
            <button key={f.key} className={`filter-chip ${statusFilter === f.key ? "active" : ""}`}
              onClick={() => setStatusFilter(f.key)}>{f.label}</button>
          ))}
        </div>

        {/* Platform filter */}
        <div className="platform-filter-row">
          {PLATFORM_FILTERS.map((f) => (
            <button key={f.key}
              className={`platform-chip ${platformFilter === f.key ? "active" : ""}`}
              style={platformFilter === f.key ? { borderColor: "transparent", background: "rgba(99,102,241,0.15)" } : {}}
              onClick={() => setPlatformFilter(f.key)}>
              {f.key !== "ALL" && PLATFORM_ICONS[f.key]}
              {f.label}
            </button>
          ))}
        </div>

        {/* Online indicator */}
        <div className="online-bar">
          {isOnline
            ? <><Wifi size={11} color="#22c55e"/> <span style={{color:"#22c55e"}}>Live</span></>
            : <><WifiOff size={11} color="#f59e0b"/> <span style={{color:"#f59e0b"}}>Demo Mode</span></>
          }
          <button className="mini-refresh" onClick={fetchConversations}><RefreshCw size={11}/></button>
        </div>

        {/* List */}
        <div className="conv-list">
          {loading && <div className="conv-loading"><div className="loading-dots"><span/><span/><span/></div></div>}
          {!loading && conversations.length === 0 && (
            <p className="conv-empty">কোনো কথোপকথন নেই</p>
          )}
          {!loading && conversations.map((conv) => {
            const lastMsg = conv.messages?.[0];
            return (
              <div key={conv.id}
                className={`conv-item ${selectedConv?.id === conv.id ? "selected" : ""} ${!conv.isRead ? "unread" : ""}`}
                onClick={() => setSelectedConv(conv)}>
                <div className="conv-avatar">
                  {conv.contact.avatar ? (
                    <img src={conv.contact.avatar} alt={conv.contact.name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <span>{conv.contact.name[0]?.toUpperCase()}</span>
                  )}
                  <span className="conv-platform-badge">{PLATFORM_ICONS[conv.platform] ?? PLATFORM_ICONS["MESSENGER"]}</span>
                </div>
                <div className="conv-info">
                  <div className="conv-row">
                    <span className="conv-name">{conv.contact.name}</span>
                    <span className="conv-time">{formatRelativeTime(conv.lastMessageAt)}</span>
                  </div>
                  <div className="conv-row">
                    <span className="conv-last-msg">{lastMsg?.content ?? "—"}</span>
                    {!conv.isRead && <span className="unread-dot"/>}
                  </div>
                  {conv.assignedAgent && (
                    <span className="conv-agent-tag">→ {conv.assignedAgent.name}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right Panel: Chat Window ── */}
      {selectedConv ? (
        <div className="chat-panel">
          {/* Chat Header */}
          <div className="chat-header">
            <div className="chat-avatar">
              {selectedConv.contact.avatar ? (
                <img src={selectedConv.contact.avatar} alt={selectedConv.contact.name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                selectedConv.contact.name[0]?.toUpperCase()
              )}
              <span className="online-dot"/>
            </div>
            <div className="chat-header-info">
              <h2 className="chat-contact-name">{selectedConv.contact.name}</h2>
              <p className="chat-platform-name" style={{ color: getPlatformColor(selectedConv.platform) }}>
                {PLATFORM_ICONS[selectedConv.platform]}
                &nbsp;{getPlatformLabel(selectedConv.platform)}
                {selectedConv.account?.pageName && <span style={{color:"var(--text-muted)", marginLeft:6}}>• {selectedConv.account.pageName}</span>}
              </p>
            </div>
            <div className="chat-header-actions">
              <button className="icon-btn-sm" title="কল"><Phone size={15}/></button>
              <button className="icon-btn-sm" title="ভিডিও"><Video size={15}/></button>
              <button className="icon-btn-sm" title="অ্যাসাইন"><UserPlus size={15}/></button>
              <button className="icon-btn-sm"><MoreVertical size={15}/></button>
            </div>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="no-messages">কোনো বার্তা নেই</div>
            )}
            {messages.map((msg) => {
              const isOutgoing = msg.senderType === "AGENT" || msg.senderType === "BOT";
              return (
                <div key={msg.id} className={`msg-wrap ${isOutgoing ? "agent" : "customer"}`}>
                  <div className="msg-bubble">
                    <p>{msg.content}</p>
                    <span className="msg-time">
                      {formatRelativeTime(msg.createdAt)}
                      {isOutgoing && <CheckCheck size={11} style={{marginLeft:3}}/>}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef}/>
          </div>

          {/* Reply Box */}
          <div className="reply-box">
            <button className="reply-attach"><Paperclip size={17}/></button>
            <textarea
              className="reply-input"
              placeholder="রিপ্লাই লিখুন... (Enter = পাঠান)"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              rows={1}
            />
            <button className="reply-send" onClick={handleSend} disabled={!replyText.trim() || sending}>
              {sending ? <div className="send-spinner"/> : <Send size={16}/>}
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-empty">
          <div className="chat-empty-icon">💬</div>
          <p>একটি কথোপকথন সিলেক্ট করুন</p>
          <span>বামদিক থেকে যেকোনো চ্যাট সিলেক্ট করুন</span>
        </div>
      )}

      <style jsx>{`
        /* ── Left Panel ── */
        .conv-panel {
          width: 300px; min-width: 260px;
          border-right: 1px solid var(--border-subtle);
          display: flex; flex-direction: column;
          background: var(--bg-surface); overflow: hidden;
        }
        .conv-filters {
          display: flex; gap: 5px; padding: 10px 12px;
          border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap;
        }
        .filter-chip {
          padding: 4px 11px; border-radius: 20px;
          border: 1px solid var(--border-default);
          background: none; color: var(--text-secondary);
          font-size: 11.5px; font-weight: 500; cursor: pointer;
          transition: all 0.15s; font-family: inherit;
        }
        .filter-chip:hover { border-color: var(--color-brand-primary); color: var(--color-brand-primary); }
        .filter-chip.active { background: rgba(99,102,241,0.15); border-color: var(--color-brand-primary); color: var(--color-brand-primary); }

        .platform-filter-row {
          display: flex; gap: 4px; padding: 6px 12px;
          border-bottom: 1px solid var(--border-subtle); overflow-x: auto;
        }
        .platform-chip {
          display: flex; align-items: center; gap: 4px;
          padding: 3px 9px; border-radius: 16px;
          border: 1px solid var(--border-subtle);
          background: none; color: var(--text-muted);
          font-size: 11px; cursor: pointer; white-space: nowrap;
          transition: all 0.15s; font-family: inherit;
        }
        .platform-chip:hover { color: var(--text-primary); border-color: var(--border-default); }
        .platform-chip.active { color: var(--color-brand-primary); }

        .online-bar {
          display: flex; align-items: center; gap: 5px;
          padding: 5px 14px;
          font-size: 11px; color: var(--text-muted);
          border-bottom: 1px solid var(--border-subtle);
        }
        .mini-refresh {
          margin-left: auto; background: none; border: none;
          color: var(--text-muted); cursor: pointer; padding: 2px;
          display: flex; align-items: center;
        }
        .mini-refresh:hover { color: var(--text-primary); }

        .conv-list { flex: 1; overflow-y: auto; padding: 5px; }
        .conv-loading { display: flex; justify-content: center; padding: 30px 0; }
        .loading-dots { display: flex; gap: 5px; align-items: center; }
        .loading-dots span {
          width: 7px; height: 7px; background: var(--color-brand-primary);
          border-radius: 50%; animation: pulse-dot 1.2s ease-in-out infinite;
        }
        .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        .conv-empty { text-align: center; padding: 40px 20px; color: var(--text-muted); font-size: 13px; }

        .conv-item {
          display: flex; gap: 10px; padding: 11px 9px;
          border-radius: 11px; cursor: pointer;
          transition: background 0.15s; margin-bottom: 2px;
        }
        .conv-item:hover { background: var(--bg-hover); }
        .conv-item.selected { background: rgba(99,102,241,0.1); }
        .conv-item.unread .conv-name { font-weight: 700; }

        .conv-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; font-weight: 700; color: white;
          flex-shrink: 0; position: relative;
        }
        .conv-platform-badge {
          position: absolute; bottom: -2px; right: -2px;
          width: 17px; height: 17px; border-radius: 50%;
          background: var(--bg-surface);
          display: flex; align-items: center; justify-content: center;
          border: 1.5px solid var(--bg-surface);
        }
        .conv-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .conv-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
        .conv-name { font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .conv-time { font-size: 10px; color: var(--text-muted); flex-shrink: 0; }
        .conv-last-msg { font-size: 11.5px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
        .unread-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--color-brand-primary); flex-shrink: 0; }
        .conv-agent-tag { font-size: 10px; color: var(--text-muted); }

        /* ── Chat Panel ── */
        .chat-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-base); }
        .chat-header {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 18px; min-height: 62px;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--bg-surface);
        }
        .chat-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          background: linear-gradient(135deg, #06b6d4, #6366f1);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 700; color: white;
          flex-shrink: 0; position: relative;
        }
        .online-dot {
          position: absolute; bottom: 0; right: 0;
          width: 10px; height: 10px; border-radius: 50%;
          background: var(--color-success); border: 2px solid var(--bg-surface);
        }
        .chat-header-info { flex: 1; }
        .chat-contact-name { font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 2px; }
        .chat-platform-name { font-size: 12px; display: flex; align-items: center; gap: 4px; }
        .chat-header-actions { display: flex; gap: 6px; }
        .icon-btn-sm {
          width: 32px; height: 32px; border-radius: 8px;
          border: 1px solid var(--border-subtle); background: var(--bg-elevated);
          color: var(--text-secondary); display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.15s;
        }
        .icon-btn-sm:hover { background: var(--bg-hover); color: var(--text-primary); }

        .chat-messages {
          flex: 1; overflow-y: auto; padding: 18px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .no-messages { text-align: center; color: var(--text-muted); font-size: 13px; padding: 40px 0; }
        .msg-wrap { display: flex; }
        .msg-wrap.agent { justify-content: flex-end; }
        .msg-bubble {
          max-width: 65%; padding: 10px 14px;
          border-radius: 16px; font-size: 14px; line-height: 1.5;
        }
        .msg-wrap.customer .msg-bubble {
          background: var(--bg-elevated); border: 1px solid var(--border-subtle);
          color: var(--text-primary); border-bottom-left-radius: 4px;
        }
        .msg-wrap.agent .msg-bubble {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white; border-bottom-right-radius: 4px;
        }
        .msg-time { display: flex; align-items: center; font-size: 10px; margin-top: 4px; opacity: 0.6; }

        .reply-box {
          display: flex; align-items: flex-end; gap: 9px;
          padding: 11px 14px;
          border-top: 1px solid var(--border-subtle);
          background: var(--bg-surface);
        }
        .reply-attach {
          width: 34px; height: 34px; border-radius: 9px;
          border: 1px solid var(--border-subtle); background: var(--bg-elevated);
          color: var(--text-secondary); display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0; transition: all 0.15s;
        }
        .reply-attach:hover { color: var(--text-primary); }
        .reply-input {
          flex: 1; background: var(--bg-elevated);
          border: 1px solid var(--border-default); border-radius: 12px;
          padding: 9px 13px; font-size: 14px; color: var(--text-primary);
          outline: none; resize: none; font-family: inherit;
          line-height: 1.5; max-height: 120px; transition: border-color 0.2s;
        }
        .reply-input:focus { border-color: var(--color-brand-primary); }
        .reply-input::placeholder { color: var(--text-muted); }
        .reply-send {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none; color: white;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0; transition: opacity 0.15s, transform 0.1s;
        }
        .reply-send:hover:not(:disabled) { opacity: 0.9; transform: scale(1.05); }
        .reply-send:disabled { opacity: 0.4; cursor: not-allowed; }
        .send-spinner {
          width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white; border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .chat-empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 8px;
        }
        .chat-empty-icon { font-size: 48px; opacity: 0.3; }
        .chat-empty p { color: var(--text-secondary); font-size: 15px; font-weight: 600; }
        .chat-empty span { color: var(--text-muted); font-size: 13px; }
      `}</style>
    </div>
  );
}
