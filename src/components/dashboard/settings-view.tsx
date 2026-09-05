"use client";

import { useState, useEffect } from "react";
import {
  Settings, Globe, MessageSquare, Phone, Plus, Trash2,
  CheckCircle, AlertCircle, ExternalLink, Bot, ToggleLeft, ToggleRight,
  Save, Sparkles,
} from "lucide-react";

type Account = {
  id: string;
  platform: string;
  pageName: string;
  pageId: string;
  isActive: boolean;
  aiAutoReply: boolean;
  businessDetails: string | null;
  aiTone: string | null;
};

const DEMO_ACCOUNTS: Account[] = [
  {
    id: "a1", platform: "FACEBOOK", pageName: "My Fashion Store",
    pageId: "123456789", isActive: true,
    aiAutoReply: true, businessDetails: null, aiTone: "friendly",
  },
  {
    id: "a2", platform: "TELEGRAM", pageName: "@MyShopBot",
    pageId: "987654321", isActive: true,
    aiAutoReply: false, businessDetails: null, aiTone: "professional",
  },
];

// Platform icon components
const FbIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877f2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
const WaIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg>;
const TgIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="#229ed9"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>;

const PLATFORM_GUIDES: Record<string, { steps: string[]; docsUrl: string; color: string }> = {
  FACEBOOK: {
    color: "var(--color-facebook)",
    docsUrl: "https://developers.facebook.com/apps",
    steps: [
      "Meta Developer Account-এ যান এবং App তৈরি করুন",
      "Messenger ও Webhooks প্রোডাক্ট যোগ করুন",
      "Webhook URL দিন: https://yourdomain.com/api/webhooks/facebook",
      "Verify Token দিন: social_inbox_verify_token",
      "Page Token এবং Page ID নিচে পেস্ট করুন",
    ],
  },
  WHATSAPP: {
    color: "var(--color-whatsapp)",
    docsUrl: "https://developers.facebook.com/apps",
    steps: [
      "Meta Developer Account-এ WhatsApp Business API সেট করুন",
      "Phone Number ID এবং Access Token নিন",
      "Webhook URL দিন: https://yourdomain.com/api/webhooks/whatsapp",
      ".env ফাইলে WHATSAPP_PHONE_NUMBER_ID ও WHATSAPP_ACCESS_TOKEN দিন",
    ],
  },
  TELEGRAM: {
    color: "var(--color-telegram)",
    docsUrl: "https://t.me/BotFather",
    steps: [
      "Telegram-এ @BotFather এ যান",
      "/newbot কমান্ড দিয়ে নতুন বট তৈরি করুন",
      "Bot Token নিন",
      ".env ফাইলে TELEGRAM_BOT_TOKEN দিন",
      "বটের Webhook set করুন: POST https://api.telegram.org/bot{TOKEN}/setWebhook",
    ],
  },
};

const AI_TONES = [
  { value: "friendly",     label: "😊 বন্ধুত্বপূর্ণ",   desc: "উষ্ণ ও কথোপকথনমূলক" },
  { value: "professional", label: "👔 পেশাদার",          desc: "আনুষ্ঠানিক ও সম্মানজনক" },
  { value: "casual",       label: "✌️ আড্ডামূলক",        desc: "সহজ ও সংক্ষিপ্ত" },
];

export function SettingsView() {
  const [accounts, setAccounts]           = useState<Account[]>(DEMO_ACCOUNTS);
  const [activeSection, setActiveSection] = useState<string>("platforms");
  const [showConnectForm, setShowConnectForm] = useState<string | null>(null);
  const [form, setForm]                   = useState({ pageName: "", pageId: "", accessToken: "" });
  const [connecting, setConnecting]       = useState(false);
  const [connected, setConnected]         = useState(false);

  // AI settings per account
  const [aiSettings, setAiSettings] = useState<Record<string, {
    aiAutoReply: boolean;
    businessDetails: string;
    aiTone: string;
  }>>({});
  const [aiSaving, setAiSaving]   = useState<string | null>(null);
  function reloadAccounts() {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        if (data.accounts) {
          setAccounts(data.accounts);
          const init: typeof aiSettings = {};
          for (const acc of data.accounts) {
            init[acc.id] = {
              aiAutoReply: acc.aiAutoReply ?? true,
              businessDetails: acc.businessDetails ?? "",
              aiTone: acc.aiTone ?? "friendly",
            };
          }
          setAiSettings(init);
        }
      })
      .catch((err) => console.error("Error reloading accounts:", err));
  }

  // Load real accounts from DB
  useEffect(() => {
    reloadAccounts();
  }, []);

  function updateAiSetting(accountId: string, field: string, value: any) {
    setAiSettings((prev) => ({
      ...prev,
      [accountId]: { ...prev[accountId], [field]: value },
    }));
  }

  async function saveAiSettings(accountId: string) {
    const settings = aiSettings[accountId];
    if (!settings) return;

    setAiSaving(accountId);
    try {
      const res = await fetch("/api/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          aiAutoReply: settings.aiAutoReply,
          businessDetails: settings.businessDetails,
          aiTone: settings.aiTone,
        }),
      });
      if (res.ok) {
        setAiSaved(accountId);
        setTimeout(() => setAiSaved(null), 2500);
      }
    } finally {
      setAiSaving(null);
    }
  }

  async function connectAccount(platform: string) {
    setConnecting(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, ...form, userId: "demo-user-id" }),
      });
      if (res.ok) {
        setConnected(true);
        setShowConnectForm(null);
        setForm({ pageName: "", pageId: "", accessToken: "" });
        reloadAccounts();
        setTimeout(() => setConnected(false), 3000);
      }
    } finally {
      setConnecting(false);
    }
  }

  async function deleteAccount(accountId: string) {
    if (!confirm("আপনি কি নিশ্চিত যে এই পেজটি রিমুভ করতে চান? রিমুভ করলে বট এই পেজে আর কাজ করবে না।")) return;
    try {
      const res = await fetch("/api/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (res.ok) {
        reloadAccounts();
      }
    } catch (err) {
      console.error("Delete account error:", err);
    }
  }

  const NAV_ITEMS = [
    { key: "platforms", label: "প্ল্যাটফর্ম কানেক্ট" },
    { key: "ai",        label: "🤖 AI সেটিংস" },
    { key: "webhook",   label: "Webhook গাইড" },
    { key: "env",       label: "Environment Keys" },
  ];

  return (
    <div className="settings-shell">
      {/* Left nav */}
      <div className="settings-nav">
        <h2 className="settings-nav-title">
          <Settings size={16} /> সেটিংস
        </h2>
        {NAV_ITEMS.map((s) => (
          <button
            key={s.key}
            className={`settings-nav-item ${activeSection === s.key ? "active" : ""}`}
            onClick={() => setActiveSection(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="settings-content">

        {/* ── Platforms ── */}
        {activeSection === "platforms" && (
          <div className="settings-section animate-fade-in">
            <h3 className="section-title">কানেক্টেড প্ল্যাটফর্ম</h3>
            <p className="section-sub">আপনার ফেসবুক পেজ, WhatsApp এবং Telegram বট কানেক্ট করুন</p>

            {connected && (
              <div className="success-banner">
                <CheckCircle size={16} />
                সফলভাবে কানেক্ট হয়েছে!
              </div>
            )}

            {/* Connected accounts */}
            <div className="accounts-list">
              {accounts.map((acc) => (
                <div key={acc.id} className="account-card">
                  <div className="acc-icon" style={{ background: PLATFORM_GUIDES[acc.platform]?.color ?? "#888" }}>
                    {acc.platform === "FACEBOOK" && <FbIcon />}
                    {acc.platform === "TELEGRAM" && <TgIcon />}
                    {acc.platform === "WHATSAPP" && <WaIcon />}
                  </div>
                  <div className="acc-info">
                    <span className="acc-name">{acc.pageName}</span>
                    <span className="acc-id">ID: {acc.pageId}</span>
                  </div>
                  <span className="acc-status">
                    <CheckCircle size={13} color="#22c55e" /> সক্রিয়
                  </span>
                  <button className="acc-remove" title="পেজটি রিমুভ করুন" onClick={() => deleteAccount(acc.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Connect buttons */}
            <div className="connect-platforms">
              {(["FACEBOOK", "WHATSAPP", "TELEGRAM"] as const).map((p) => (
                <div key={p} className="connect-block">
                  <div className="connect-header">
                    <div className="connect-icon" style={{ background: PLATFORM_GUIDES[p].color }}>
                      {p === "FACEBOOK" && <Globe size={18} />}
                      {p === "WHATSAPP" && <Phone size={18} />}
                      {p === "TELEGRAM" && <MessageSquare size={18} />}
                    </div>
                    <div>
                      <p className="connect-platform-name">{p.charAt(0) + p.slice(1).toLowerCase()}</p>
                      <p className="connect-platform-sub">
                        {p === "FACEBOOK" ? "Facebook Pages + Messenger" :
                         p === "WHATSAPP" ? "WhatsApp Business API" :
                         "Telegram Bot API"}
                      </p>
                    </div>
                    <button
                      className="connect-btn"
                      onClick={() => setShowConnectForm(showConnectForm === p ? null : p)}
                    >
                      <Plus size={14} /> কানেক্ট করুন
                    </button>
                  </div>

                  {showConnectForm === p && (
                    <div className="connect-form animate-fade-in">
                      <div className="form-row">
                        <div className="form-col">
                          <label className="form-label">পেজ/বট নাম</label>
                          <input className="form-input" placeholder="আমার পেজ" value={form.pageName}
                            onChange={e => setForm(f => ({ ...f, pageName: e.target.value }))} />
                        </div>
                        <div className="form-col">
                          <label className="form-label">Page ID / Chat ID</label>
                          <input className="form-input" placeholder="123456789" value={form.pageId}
                            onChange={e => setForm(f => ({ ...f, pageId: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <label className="form-label">Access Token / Bot Token</label>
                        <input className="form-input" placeholder="পেস্ট করুন..." value={form.accessToken}
                          onChange={e => setForm(f => ({ ...f, accessToken: e.target.value }))} />
                      </div>
                      <button className="save-btn" onClick={() => connectAccount(p)} disabled={connecting || !form.pageId || !form.accessToken}>
                        {connecting ? "কানেক্ট হচ্ছে..." : "✓ সেভ করুন"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AI Settings ── */}
        {activeSection === "ai" && (
          <div className="settings-section animate-fade-in">
            <h3 className="section-title">
              <Sparkles size={20} style={{ display: "inline", verticalAlign: "middle", marginRight: 8, color: "var(--color-brand-primary)" }} />
              AI Auto-Reply সেটিংস
            </h3>
            <p className="section-sub">
              Gemini AI দিয়ে কাস্টমার মেসেজে স্বয়ংক্রিয় রিপ্লাই কনফিগার করুন।
              প্রতিটি পেজ/বটের জন্য আলাদা সেটিং করা যাবে।
            </p>

            {/* Gemini API key notice */}
            <div className="ai-api-notice">
              <Bot size={15} />
              <div>
                <strong>Gemini API Key</strong> — <code>.env</code> ফাইলে{" "}
                <code>GEMINI_API_KEY</code> সেট করুন।{" "}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="api-key-link">
                  এখানে পান →
                </a>
              </div>
            </div>

            {accounts.length === 0 && (
              <div className="ai-empty">
                <Bot size={36} opacity={0.3} />
                <p>কোনো কানেক্টেড অ্যাকাউন্ট নেই।</p>
                <span>প্রথমে "প্ল্যাটফর্ম কানেক্ট" থেকে একটি পেজ/বট যোগ করুন।</span>
              </div>
            )}

            {accounts.map((acc) => {
              const s = aiSettings[acc.id] ?? { aiAutoReply: true, businessDetails: "", aiTone: "friendly" };
              const isSaving = aiSaving === acc.id;
              const isSaved  = aiSaved === acc.id;

              return (
                <div key={acc.id} className={`ai-account-card ${s.aiAutoReply ? "ai-enabled" : "ai-disabled"}`}>
                  {/* Header */}
                  <div className="ai-card-header">
                    <div className="ai-card-platform-icon" style={{ background: PLATFORM_GUIDES[acc.platform]?.color ?? "#888" }}>
                      {acc.platform === "FACEBOOK" && <FbIcon />}
                      {acc.platform === "TELEGRAM" && <TgIcon />}
                      {acc.platform === "WHATSAPP" && <WaIcon />}
                    </div>
                    <div className="ai-card-title">
                      <span className="ai-card-name">{acc.pageName}</span>
                      <span className="ai-card-platform">{acc.platform}</span>
                    </div>

                    {/* AI Toggle */}
                    <div className="ai-toggle-wrap">
                      <span className="ai-toggle-label">
                        {s.aiAutoReply ? "AI সক্রিয়" : "AI বন্ধ"}
                      </span>
                      <button
                        className={`ai-toggle-btn ${s.aiAutoReply ? "on" : "off"}`}
                        onClick={() => updateAiSetting(acc.id, "aiAutoReply", !s.aiAutoReply)}
                        title={s.aiAutoReply ? "AI বন্ধ করুন" : "AI চালু করুন"}
                      >
                        {s.aiAutoReply
                          ? <ToggleRight size={28} />
                          : <ToggleLeft size={28} />}
                      </button>
                    </div>
                  </div>

                  {/* AI Config Fields */}
                  <div className={`ai-config-body ${!s.aiAutoReply ? "dimmed" : ""}`}>
                    {/* Tone selector */}
                    <div className="ai-field">
                      <label className="ai-field-label">AI টোন</label>
                      <div className="ai-tone-grid">
                        {AI_TONES.map((tone) => (
                          <button
                            key={tone.value}
                            className={`ai-tone-btn ${s.aiTone === tone.value ? "active" : ""}`}
                            onClick={() => updateAiSetting(acc.id, "aiTone", tone.value)}
                            disabled={!s.aiAutoReply}
                          >
                            <span className="ai-tone-label">{tone.label}</span>
                            <span className="ai-tone-desc">{tone.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Business details */}
                    <div className="ai-field">
                      <label className="ai-field-label">
                        ব্যবসার তথ্য (Knowledge Base)
                        <span className="ai-field-hint"> — AI এই তথ্যের উপর ভিত্তি করে উত্তর দেবে</span>
                      </label>
                      <textarea
                        className="ai-textarea"
                        rows={6}
                        disabled={!s.aiAutoReply}
                        placeholder={`উদাহরণ:\nপণ্যের নাম: হ্যান্ডব্যাগ (লাল, নীল, কালো)\nদাম: ৳৮৫০ - ৳১৫০০\nডেলিভারি: ঢাকায় ৬০ টাকা, বাইরে ১২০ টাকা\nঅর্ডার: নাম, ঠিকানা ও ফোন নম্বর দিলেই হবে\nপেমেন্ট: ক্যাশ অন ডেলিভারি`}
                        value={s.businessDetails}
                        onChange={(e) => updateAiSetting(acc.id, "businessDetails", e.target.value)}
                      />
                    </div>

                    {/* Save button */}
                    <div className="ai-save-row">
                      {isSaved && (
                        <span className="ai-saved-msg">
                          <CheckCircle size={13} /> সেভ হয়েছে!
                        </span>
                      )}
                      <button
                        className="ai-save-btn"
                        onClick={() => saveAiSettings(acc.id)}
                        disabled={isSaving}
                      >
                        {isSaving
                          ? <><span className="btn-spinner" /> সেভ হচ্ছে...</>
                          : <><Save size={14} /> সেটিং সেভ করুন</>}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Webhook Guide ── */}
        {activeSection === "webhook" && (
          <div className="settings-section animate-fade-in">
            <h3 className="section-title">Webhook সেটআপ গাইড</h3>
            <p className="section-sub">প্রতিটি প্ল্যাটফর্মের জন্য Webhook কনফিগার করুন</p>

            {(["FACEBOOK", "WHATSAPP", "TELEGRAM"] as const).map((p) => (
              <div key={p} className="webhook-block">
                <div className="webhook-header">
                  <div className="connect-icon" style={{ background: PLATFORM_GUIDES[p].color }}>
                    {p === "FACEBOOK" && <FbIcon />}
                    {p === "WHATSAPP" && <WaIcon />}
                    {p === "TELEGRAM" && <TgIcon />}
                  </div>
                  <span className="webhook-name">{p}</span>
                  <a href={PLATFORM_GUIDES[p].docsUrl} target="_blank" rel="noreferrer" className="docs-link">
                    <ExternalLink size={13} /> ডকস
                  </a>
                </div>
                <ol className="webhook-steps">
                  {PLATFORM_GUIDES[p].steps.map((step, i) => (
                    <li key={i} className="webhook-step">
                      <span className="step-num">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <div className="webhook-url-box">
                  <Globe size={13} />
                  <code>https://yourdomain.com/api/webhooks/{p.toLowerCase()}</code>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Env Keys ── */}
        {activeSection === "env" && (
          <div className="settings-section animate-fade-in">
            <h3 className="section-title">Environment Variables</h3>
            <p className="section-sub">
              <code>.env</code> ফাইলে নিচের keys যোগ করুন
            </p>
            <div className="env-block">
              <div className="env-warning">
                <AlertCircle size={14} />
                এই keys গুলো কখনো publicly শেয়ার করবেন না
              </div>
              <pre className="env-code">{`# ── Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/social_inbox_db"

# ── Auth
NEXTAUTH_SECRET="your-random-secret-min-32-chars"
NEXTAUTH_URL="http://localhost:3000"

# ── Facebook / Meta
FACEBOOK_APP_ID="your-app-id"
FACEBOOK_APP_SECRET="your-app-secret"
FACEBOOK_WEBHOOK_VERIFY_TOKEN="social_inbox_verify_token"

# ── WhatsApp Business API
WHATSAPP_PHONE_NUMBER_ID="your-phone-number-id"
WHATSAPP_ACCESS_TOKEN="your-whatsapp-token"

# ── Telegram
TELEGRAM_BOT_TOKEN="your-bot-token"

# ── Redis
REDIS_URL="redis://localhost:6379"

# ── Gemini AI (https://aistudio.google.com/app/apikey)
GEMINI_API_KEY="your-gemini-api-key"

# ── App
NEXT_PUBLIC_APP_URL="https://yourdomain.com"`}</pre>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .settings-shell {
          display: flex;
          height: 100%;
          overflow: hidden;
          background: var(--bg-base);
        }
        .settings-nav {
          width: 200px;
          min-width: 200px;
          background: var(--bg-surface);
          border-right: 1px solid var(--border-subtle);
          padding: 20px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .settings-nav-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 0 8px;
          margin-bottom: 12px;
        }
        .settings-nav-item {
          padding: 9px 10px;
          border-radius: 8px;
          border: none;
          background: none;
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s;
          font-family: inherit;
        }
        .settings-nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
        .settings-nav-item.active { background: rgba(99,102,241,0.15); color: var(--color-brand-primary); font-weight: 600; }

        .settings-content { flex: 1; overflow-y: auto; padding: 24px; }
        .settings-section { display: flex; flex-direction: column; gap: 20px; max-width: 720px; }
        .section-title { font-size: 18px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; }
        .section-sub { font-size: 13px; color: var(--text-muted); margin-top: -12px; }

        .success-banner {
          display: flex; align-items: center; gap: 8px;
          background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3);
          border-radius: 10px; padding: 10px 14px;
          color: #22c55e; font-size: 13px; font-weight: 600;
        }

        /* ── AI Settings ── */
        .ai-api-notice {
          display: flex; align-items: flex-start; gap: 10px;
          background: rgba(99,102,241,0.07);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 10px; padding: 12px 14px;
          font-size: 13px; color: var(--text-secondary);
        }
        .api-key-link { color: var(--color-brand-primary); font-weight: 600; text-decoration: none; }
        .api-key-link:hover { text-decoration: underline; }

        .ai-empty {
          display: flex; flex-direction: column; align-items: center;
          gap: 8px; padding: 48px 0;
          color: var(--text-muted); text-align: center;
        }
        .ai-empty p { font-size: 15px; font-weight: 600; color: var(--text-secondary); }
        .ai-empty span { font-size: 13px; }

        .ai-account-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          overflow: hidden;
          transition: border-color 0.2s;
        }
        .ai-account-card.ai-enabled { border-color: rgba(99,102,241,0.3); }

        .ai-card-header {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--bg-elevated);
        }
        .ai-card-platform-icon {
          width: 34px; height: 34px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          color: white; flex-shrink: 0;
        }
        .ai-card-title { flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .ai-card-name { font-size: 14px; font-weight: 700; color: var(--text-primary); }
        .ai-card-platform { font-size: 11px; color: var(--text-muted); letter-spacing: 0.04em; }

        .ai-toggle-wrap { display: flex; align-items: center; gap: 8px; }
        .ai-toggle-label { font-size: 12px; font-weight: 600; }
        .ai-toggle-btn {
          background: none; border: none; cursor: pointer;
          display: flex; align-items: center; padding: 0;
          transition: transform 0.1s;
        }
        .ai-toggle-btn:hover { transform: scale(1.05); }
        .ai-toggle-btn.on { color: var(--color-brand-primary); }
        .ai-toggle-btn.off { color: var(--text-muted); }
        .ai-toggle-wrap .ai-toggle-label { color: var(--text-muted); }
        .ai-toggle-btn.on + span,
        .ai-toggle-wrap:has(.ai-toggle-btn.on) .ai-toggle-label { color: var(--color-brand-primary); }

        .ai-config-body { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
        .ai-config-body.dimmed { opacity: 0.45; pointer-events: none; }

        .ai-field { display: flex; flex-direction: column; gap: 8px; }
        .ai-field-label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
        .ai-field-hint { font-size: 11px; font-weight: 400; color: var(--text-muted); }

        .ai-tone-grid { display: flex; gap: 8px; flex-wrap: wrap; }
        .ai-tone-btn {
          flex: 1; min-width: 120px;
          display: flex; flex-direction: column; gap: 3px;
          padding: 10px 13px; border-radius: 10px;
          border: 1.5px solid var(--border-subtle);
          background: var(--bg-elevated);
          cursor: pointer; text-align: left; transition: all 0.15s;
          font-family: inherit;
        }
        .ai-tone-btn:hover:not(:disabled) { border-color: var(--color-brand-primary); background: rgba(99,102,241,0.06); }
        .ai-tone-btn.active { border-color: var(--color-brand-primary); background: rgba(99,102,241,0.1); }
        .ai-tone-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ai-tone-label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
        .ai-tone-desc { font-size: 11px; color: var(--text-muted); }

        .ai-textarea {
          background: var(--bg-elevated);
          border: 1px solid var(--border-default);
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 13px;
          color: var(--text-primary);
          outline: none;
          resize: vertical;
          font-family: inherit;
          line-height: 1.6;
          transition: border-color 0.2s;
          width: 100%;
          box-sizing: border-box;
        }
        .ai-textarea:focus { border-color: var(--color-brand-primary); }
        .ai-textarea::placeholder { color: var(--text-muted); }

        .ai-save-row {
          display: flex; align-items: center; justify-content: flex-end; gap: 12px;
        }
        .ai-saved-msg {
          display: flex; align-items: center; gap: 5px;
          font-size: 12px; color: #22c55e; font-weight: 600;
        }
        .ai-save-btn {
          display: flex; align-items: center; gap: 6px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white; border: none; border-radius: 9px;
          padding: 9px 18px; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: opacity 0.15s; font-family: inherit;
        }
        .ai-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-spinner {
          width: 12px; height: 12px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white; border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Platforms ── */
        .accounts-list { display: flex; flex-direction: column; gap: 8px; }
        .account-card {
          display: flex; align-items: center; gap: 12px;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 12px; padding: 12px 16px;
        }
        .acc-icon { width: 36px; height: 36px; border-radius: 9px; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
        .acc-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .acc-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .acc-id { font-size: 11px; color: var(--text-muted); }
        .acc-status { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #22c55e; white-space: nowrap; }
        .acc-remove { width: 30px; height: 30px; border-radius: 7px; border: 1px solid var(--border-default); background: none; color: var(--text-muted); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; }
        .acc-remove:hover { color: #ef4444; border-color: #ef4444; background: rgba(239,68,68,0.08); }

        .connect-platforms { display: flex; flex-direction: column; gap: 12px; }
        .connect-block { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .connect-header { display: flex; align-items: center; gap: 12px; }
        .connect-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
        .connect-platform-name { font-size: 14px; font-weight: 700; color: var(--text-primary); }
        .connect-platform-sub { font-size: 12px; color: var(--text-muted); }
        .connect-btn { display: flex; align-items: center; gap: 5px; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 8px; padding: 8px 14px; color: var(--color-brand-primary); font-size: 13px; font-weight: 600; cursor: pointer; margin-left: auto; transition: all 0.15s; font-family: inherit; }
        .connect-btn:hover { background: rgba(99,102,241,0.2); }
        .connect-form { display: flex; flex-direction: column; gap: 12px; padding-top: 4px; border-top: 1px solid var(--border-subtle); }
        .form-row { display: flex; gap: 12px; }
        .form-col { flex: 1; display: flex; flex-direction: column; gap: 5px; }
        .form-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
        .form-input { background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: 8px; padding: 9px 12px; font-size: 13px; color: var(--text-primary); outline: none; font-family: inherit; transition: border-color 0.2s; }
        .form-input:focus { border-color: var(--color-brand-primary); }
        .form-input::placeholder { color: var(--text-muted); }
        .save-btn { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 9px; padding: 10px 20px; font-size: 13px; font-weight: 600; cursor: pointer; align-self: flex-start; transition: opacity 0.15s; font-family: inherit; }
        .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Webhook ── */
        .webhook-block { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .webhook-header { display: flex; align-items: center; gap: 10px; }
        .webhook-name { font-size: 14px; font-weight: 700; color: var(--text-primary); flex: 1; }
        .docs-link { display: flex; align-items: center; gap: 5px; color: var(--color-brand-primary); font-size: 12px; text-decoration: none; }
        .docs-link:hover { text-decoration: underline; }
        .webhook-steps { padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
        .webhook-step { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: var(--text-secondary); }
        .step-num { min-width: 22px; height: 22px; border-radius: 50%; background: rgba(99,102,241,0.15); color: var(--color-brand-primary); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
        .webhook-url-box { display: flex; align-items: center; gap: 8px; background: var(--bg-elevated); border-radius: 8px; padding: 9px 13px; font-size: 12px; color: var(--color-brand-accent); }
        .webhook-url-box code { font-family: monospace; }

        /* ── Env ── */
        .env-block { display: flex; flex-direction: column; gap: 12px; }
        .env-warning { display: flex; align-items: center; gap: 8px; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); border-radius: 9px; padding: 10px 14px; color: #f59e0b; font-size: 13px; }
        .env-code { background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: 12px; padding: 20px; font-size: 12px; color: var(--color-brand-accent); font-family: "Consolas", "Courier New", monospace; overflow-x: auto; line-height: 1.7; white-space: pre; }

        @keyframes animate-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .animate-fade-in { animation: animate-fade-in 0.2s ease; }
      `}</style>
    </div>
  );
}
