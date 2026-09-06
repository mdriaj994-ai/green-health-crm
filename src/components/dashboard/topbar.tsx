"use client";

import { signOut } from "next-auth/react";
import { Bell, LogOut, Search, Sparkles } from "lucide-react";

export function TopBar({ user }: { user: any }) {
  return (
    <header
      className="topbar-container"
      style={{
        height: 58,
        minHeight: 58,
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 14,
        background: "#080911",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        boxSizing: "border-box"
      }}
    >
      <div
        className="topbar-search-box"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 12,
          padding: "0 14px",
          maxWidth: 420,
          transition: "all 0.2s"
        }}
      >
        <Search size={15} color="#64748b" style={{ flexShrink: 0 }} />
        <input
          type="text"
          placeholder="কথোপকথন বা কাস্টমার খুঁজুন..."
          className="topbar-search-input"
          style={{
            background: "none",
            border: "none",
            outline: "none",
            fontSize: 13.5,
            color: "#f1f5f9",
            width: "100%",
            padding: "9px 0",
            fontFamily: "inherit"
          }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "6px 14px",
            borderRadius: 20,
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            color: "#10b981",
            fontSize: 12,
            fontWeight: 700
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
          <span>এআই ক্লোজার লাইভ</span>
        </div>

        <button
          className="topbar-btn"
          title="নোটিফিকেশন"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(255, 255, 255, 0.03)",
            color: "#94a3b8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            position: "relative"
          }}
        >
          <Bell size={17} />
          <span
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              background: "#7c3aed",
              color: "#ffffff",
              fontSize: 9,
              fontWeight: 800,
              width: 16,
              height: 16,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #080911"
            }}
          >
            ৩
          </span>
        </button>

        <button
          className="topbar-btn logout"
          title="লগআউট"
          onClick={() => signOut({ callbackUrl: "/login" })}
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(255, 255, 255, 0.03)",
            color: "#94a3b8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer"
          }}
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
