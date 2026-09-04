"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Clock, ThumbsUp, Eye, EyeOff, Trash2, Send, RefreshCw } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

type Comment = {
  id: string;
  userName: string;
  userAvatar: string | null;
  text: string;
  status: string;
  commentedAt: string;
  postText: string | null;
  repliedText: string | null;
  account: { pageName: string; platform: string };
};

const STATUS_TABS = [
  { key: "ALL", label: "সব" },
  { key: "PENDING", label: "পেন্ডিং" },
  { key: "REPLIED", label: "রিপ্লাই দেওয়া" },
  { key: "HIDDEN", label: "হিডেন" },
];

export function CommentView() {
  const [comments, setComments]     = useState<Comment[]>([]);
  const [activeTab, setActiveTab]   = useState("ALL");
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [sending, setSending]       = useState<Record<string, boolean>>({});
  const [loading, setLoading]       = useState(true);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/comments?status=${activeTab}`);
      const data = await res.json();
      setComments(data.comments ?? []);
    } catch {
      // Use demo data if API fails
      setComments(DEMO_COMMENTS);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  async function sendReply(comment: Comment) {
    const text = replyTexts[comment.id]?.trim();
    if (!text) return;
    setSending((s) => ({ ...s, [comment.id]: true }));
    try {
      await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId: comment.id, replyText: text }),
      });
      setReplyTexts((r) => ({ ...r, [comment.id]: "" }));
      fetchComments();
    } finally {
      setSending((s) => ({ ...s, [comment.id]: false }));
    }
  }

  async function updateStatus(commentId: string, action: "HIDDEN" | "DELETED") {
    await fetch("/api/comments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId, action }),
    });
    fetchComments();
  }

  const statusColor: Record<string, string> = {
    PENDING: "#f59e0b",
    REPLIED: "#22c55e",
    HIDDEN: "#6b7280",
    DELETED: "#ef4444",
  };
  const statusLabel: Record<string, string> = {
    PENDING: "পেন্ডিং",
    REPLIED: "রিপ্লাই দেওয়া হয়েছে",
    HIDDEN: "হিডেন",
    DELETED: "মুছে ফেলা হয়েছে",
  };

  return (
    <div className="comment-shell">
      {/* Header */}
      <div className="comment-header">
        <div>
          <h1 className="comment-title">
            <MessageCircle size={20} />
            কমেন্ট ইনবক্স
          </h1>
          <p className="comment-subtitle">ফেসবুক পোস্ট ও বিজ্ঞাপনের কমেন্ট ম্যানেজ করুন</p>
        </div>
        <button className="refresh-btn" onClick={fetchComments}>
          <RefreshCw size={15} />
          রিফ্রেশ
        </button>
      </div>

      {/* Tabs */}
      <div className="comment-tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Comment List */}
      <div className="comment-list">
        {loading && (
          <div className="comment-loading">
            <div className="loading-spinner" />
            <span>লোড হচ্ছে...</span>
          </div>
        )}

        {!loading && comments.length === 0 && (
          <div className="comment-empty">
            <MessageCircle size={40} strokeWidth={1} />
            <p>কোনো কমেন্ট নেই</p>
          </div>
        )}

        {!loading && comments.map((comment) => (
          <div key={comment.id} className="comment-card animate-fade-in">
            {/* Card Header */}
            <div className="cc-header">
              <div className="cc-avatar">
                {comment.userName[0]?.toUpperCase()}
              </div>
              <div className="cc-meta">
                <span className="cc-name">{comment.userName}</span>
                <span className="cc-page">📄 {comment.account?.pageName ?? "Unknown Page"}</span>
              </div>
              <div className="cc-right">
                <span className="cc-time">
                  <Clock size={11} />
                  {formatRelativeTime(comment.commentedAt)}
                </span>
                <span className="cc-status" style={{ color: statusColor[comment.status] }}>
                  ● {statusLabel[comment.status] ?? comment.status}
                </span>
              </div>
            </div>

            {/* Post context */}
            {comment.postText && (
              <div className="cc-post-context">
                📝 পোস্ট: "{comment.postText.slice(0, 80)}..."
              </div>
            )}

            {/* Comment text */}
            <div className="cc-text">"{comment.text}"</div>

            {/* Previous reply */}
            {comment.repliedText && (
              <div className="cc-replied">
                <ThumbsUp size={12} />
                আপনার রিপ্লাই: "{comment.repliedText}"
              </div>
            )}

            {/* Reply box */}
            {comment.status !== "DELETED" && (
              <div className="cc-reply-row">
                <input
                  className="cc-reply-input"
                  placeholder="রিপ্লাই লিখুন..."
                  value={replyTexts[comment.id] ?? ""}
                  onChange={(e) =>
                    setReplyTexts((r) => ({ ...r, [comment.id]: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && sendReply(comment)}
                />
                <button
                  className="cc-send-btn"
                  onClick={() => sendReply(comment)}
                  disabled={sending[comment.id] || !replyTexts[comment.id]?.trim()}
                >
                  <Send size={14} />
                  {sending[comment.id] ? "পাঠাচ্ছি..." : "রিপ্লাই"}
                </button>
                {comment.status !== "HIDDEN" && (
                  <button
                    className="cc-action-btn hide"
                    onClick={() => updateStatus(comment.id, "HIDDEN")}
                    title="হাইড করুন"
                  >
                    <EyeOff size={14} />
                  </button>
                )}
                <button
                  className="cc-action-btn delete"
                  onClick={() => updateStatus(comment.id, "DELETED")}
                  title="ডিলিট করুন"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .comment-shell {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          background: var(--bg-base);
        }
        .comment-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 20px 24px 0;
        }
        .comment-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 4px;
        }
        .comment-subtitle {
          font-size: 13px;
          color: var(--text-muted);
        }
        .refresh-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-default);
          border-radius: 8px;
          padding: 8px 14px;
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .refresh-btn:hover { color: var(--text-primary); background: var(--bg-hover); }

        .comment-tabs {
          display: flex;
          gap: 6px;
          padding: 14px 24px;
          border-bottom: 1px solid var(--border-subtle);
        }
        .tab-btn {
          padding: 6px 16px;
          border-radius: 20px;
          border: 1px solid var(--border-default);
          background: none;
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .tab-btn:hover { border-color: var(--color-brand-primary); color: var(--color-brand-primary); }
        .tab-btn.active {
          background: rgba(99,102,241,0.15);
          border-color: var(--color-brand-primary);
          color: var(--color-brand-primary);
        }
        .comment-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .comment-loading, .comment-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 60px 0;
          color: var(--text-muted);
          font-size: 14px;
        }
        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--border-default);
          border-top-color: var(--color-brand-primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .comment-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 14px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: border-color 0.15s;
        }
        .comment-card:hover { border-color: var(--border-default); }

        .cc-header {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .cc-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f59e0b, #ef4444);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: white;
          font-size: 15px;
          flex-shrink: 0;
        }
        .cc-meta { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .cc-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .cc-page { font-size: 11px; color: var(--text-muted); }
        .cc-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }
        .cc-time {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--text-muted);
        }
        .cc-status { font-size: 11px; font-weight: 600; }

        .cc-post-context {
          font-size: 12px;
          color: var(--text-muted);
          background: var(--bg-elevated);
          border-radius: 8px;
          padding: 8px 12px;
          border-left: 3px solid var(--color-facebook);
        }
        .cc-text {
          font-size: 14px;
          color: var(--text-primary);
          line-height: 1.5;
          background: var(--bg-elevated);
          border-radius: 10px;
          padding: 10px 14px;
        }
        .cc-replied {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--color-success);
          background: rgba(34,197,94,0.08);
          border-radius: 8px;
          padding: 7px 12px;
        }
        .cc-reply-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .cc-reply-input {
          flex: 1;
          background: var(--bg-elevated);
          border: 1px solid var(--border-default);
          border-radius: 9px;
          padding: 9px 13px;
          font-size: 13px;
          color: var(--text-primary);
          outline: none;
          font-family: inherit;
          transition: border-color 0.2s;
        }
        .cc-reply-input:focus { border-color: var(--color-brand-primary); }
        .cc-reply-input::placeholder { color: var(--text-muted); }
        .cc-send-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          border: none;
          border-radius: 9px;
          padding: 9px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity 0.15s;
          font-family: inherit;
        }
        .cc-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .cc-action-btn {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          border: 1px solid var(--border-default);
          background: var(--bg-elevated);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .cc-action-btn.hide { color: var(--text-secondary); }
        .cc-action-btn.hide:hover { background: rgba(107,114,128,0.15); color: #9ca3af; border-color: #6b7280; }
        .cc-action-btn.delete { color: var(--text-secondary); }
        .cc-action-btn.delete:hover { background: rgba(239,68,68,0.1); color: #ef4444; border-color: #ef4444; }
      `}</style>
    </div>
  );
}

// ── Demo Data ────────────────────────────────────────────────────
const DEMO_COMMENTS: Comment[] = [
  {
    id: "c1", userName: "রহিম আহমেদ", userAvatar: null,
    text: "দাম কত ভাই? ডেলিভারি কোথায় কোথায় দেন?",
    status: "PENDING", commentedAt: new Date(Date.now() - 5 * 60000).toISOString(),
    postText: "নতুন কালেকশন এসে গেছে! সীমিত স্টক...",
    repliedText: null,
    account: { pageName: "My Fashion Store", platform: "FACEBOOK" },
  },
  {
    id: "c2", userName: "ফাতেমা বেগম", userAvatar: null,
    text: "আমি কি কাস্টম অর্ডার দিতে পারব?",
    status: "PENDING", commentedAt: new Date(Date.now() - 18 * 60000).toISOString(),
    postText: "আমাদের বিশেষ অফার চলছে...",
    repliedText: null,
    account: { pageName: "My Fashion Store", platform: "FACEBOOK" },
  },
  {
    id: "c3", userName: "করিম মোল্লা", userAvatar: null,
    text: "পণ্যটা পেয়েছি, অনেক সুন্দর। ধন্যবাদ! ⭐⭐⭐⭐⭐",
    status: "REPLIED", commentedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    postText: null,
    repliedText: "আপনার ভালো লাগায় আমরা খুশি! আবার আসবেন 😊",
    account: { pageName: "My Fashion Store", platform: "FACEBOOK" },
  },
  {
    id: "c4", userName: "জামাল উদ্দিন", userAvatar: null,
    text: "এই অফার কি এখনো চলছে? কতদিন পাওয়া যাবে?",
    status: "PENDING", commentedAt: new Date(Date.now() - 35 * 60000).toISOString(),
    postText: "৫০% ডিসকাউন্ট সেল চলছে!",
    repliedText: null,
    account: { pageName: "Tech Shop BD", platform: "FACEBOOK" },
  },
];
