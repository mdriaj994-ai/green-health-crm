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
        background: "#090806",
        borderBottom: "1px solid rgba(245, 158, 11, 0.14)",
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
          background: "rgba(245, 158, 11, 0.03)",
          border: "1px solid rgba(245, 158, 11, 0.16)",
          borderRadius: 12,
          padding: "0 14px",
          maxWidth: 420,
          transition: "all 0.2s"
        }}
      >
        <Search size={15} color="#a38c5b" style={{ flexShrink: 0 }} />
        <input
          type="text"
          placeholder="কথোপকথন বা কাস্টমার খুঁজুন..."
          className="topbar-search-input"
          style={{
            background: "none",
            border: "none",
            outline: "none",
            fontSize: 13.5,
            color: "#fef9ed",
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
            background: "linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(180, 83, 9, 0.08))",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            color: "#fbbf24",
            fontSize: 12,
            fontWeight: 700
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fbbf24", boxShadow: "0 0 8px #fbbf24" }} />
          <span>এআই ক্লোজার গোল্ডেন লাইভ</span>
        </div>

        <button
          className="topbar-btn"
          title="নোটিফিকেশন"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: "1px solid rgba(245, 158, 11, 0.16)",
            background: "rgba(245, 158, 11, 0.04)",
            color: "#cfb989",
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
              background: "linear-gradient(135deg, #f59e0b, #b45309)",
              color: "#000000",
              fontSize: 9,
              fontWeight: 900,
              width: 16,
              height: 16,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #090806"
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
            border: "1px solid rgba(245, 158, 11, 0.16)",
            background: "rgba(245, 158, 11, 0.04)",
            color: "#cfb989",
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
