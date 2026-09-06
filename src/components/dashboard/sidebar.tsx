"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  MessageCircle,
  Users,
  Settings,
  ShoppingBag,
  BookOpen,
  ChevronRight,
  LogOut,
  Radio,
  Sparkles,
  Bot
} from "lucide-react";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/dashboard", label: "ইনবক্স", icon: MessageSquare, badge: "লাইভ" },
  { href: "/dashboard/comments", label: "কমেন্টস", icon: MessageCircle },
  { href: "/dashboard/agents", label: "এজেন্টস", icon: Users },
  { href: "/dashboard/products", label: "মেডিসিন ড্যাশবোর্ড", icon: ShoppingBag, badge: "৫৭ টি" },
  { href: "/dashboard/encyclopedia", label: "মেগা এনসাইক্লোপিডিয়া", icon: BookOpen, badge: "এআই" },
  { href: "/dashboard/settings", label: "সেটিংস", icon: Settings },
];

const platforms = [
  { id: "all", label: "সব চ্যানেল", color: "#8b5cf6", count: "সক্রিয়" },
  { id: "MESSENGER", label: "Messenger", color: "#0084ff", count: "২৪/৭" },
  { id: "WHATSAPP", label: "WhatsApp", color: "#25d366", count: "অনলাইন" },
  { id: "TELEGRAM", label: "Telegram", color: "#2aabee", count: "বট" },
];

export function Sidebar({ user }: { user: any }) {
  const pathname = usePathname();
  const [selectedPlatform, setSelectedPlatform] = useState("all");

  return (
    <aside
      className="sidebar-container"
      style={{
        width: 250,
        minWidth: 250,
        height: "100vh",
        background: "#080911",
        borderRight: "1px solid rgba(255, 255, 255, 0.06)",
        display: "flex",
        flexDirection: "column",
        padding: "16px 12px",
        gap: 10,
        overflowY: "auto",
        position: "relative",
        zIndex: 40,
        boxSizing: "border-box"
      }}
    >
      {/* Brand Header */}
      <div
        className="sidebar-logo"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 10px 14px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)"
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 14px rgba(124, 58, 237, 0.4)",
            flexShrink: 0
          }}
        >
          <Bot size={20} color="#ffffff" />
        </div>
        <div>
          <div
            className="sidebar-logo-text"
            style={{
              fontSize: 16,
              fontWeight: 800,
              background: "linear-gradient(135deg, #a855f7, #6366f1)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              lineHeight: 1.2
            }}
          >
            SocialInbox
          </div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>এআই অটোমেশন হাব</div>
        </div>
        <span
          className="sidebar-badge"
          style={{
            fontSize: 10,
            fontWeight: 800,
            padding: "2px 7px",
            borderRadius: 6,
            background: "rgba(124, 58, 237, 0.2)",
            color: "#c084fc",
            border: "1px solid rgba(124, 58, 237, 0.3)",
            marginLeft: "auto"
          }}
        >
          PRO
        </span>
      </div>

      {/* Platform Filter Buttons */}
      <div style={{ marginBottom: 4 }}>
        <div
          className="sidebar-section-title"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            padding: "6px 10px 4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <span>প্ল্যাটফর্ম ফিল্টার</span>
          <Radio size={12} color="#64748b" />
        </div>
        <div className="platform-group" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {platforms.map((p) => {
            const isSelected = selectedPlatform === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPlatform(p.id)}
                className={`platform-btn ${isSelected ? "active" : ""}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: isSelected ? "1px solid rgba(124, 58, 237, 0.35)" : "1px solid transparent",
                  background: isSelected ? "rgba(124, 58, 237, 0.15)" : "rgba(255, 255, 255, 0.02)",
                  color: isSelected ? "#c084fc" : "#94a3b8",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
                  fontFamily: "inherit",
                  boxShadow: isSelected ? "0 4px 12px rgba(124, 58, 237, 0.15)" : "none"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span
                    className="platform-dot"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: p.color,
                      flexShrink: 0,
                      boxShadow: `0 0 8px ${p.color}`
                    }}
                  />
                  <span>{p.label}</span>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: isSelected ? "rgba(124, 58, 237, 0.3)" : "rgba(255, 255, 255, 0.04)",
                    color: isSelected ? "#e9d5ff" : "#64748b"
                  }}
                >
                  {p.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Navigation Menu */}
      <nav
        className="nav-group"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          flex: 1,
          paddingTop: 6,
          borderTop: "1px solid rgba(255, 255, 255, 0.05)"
        }}
      >
        <div
          className="sidebar-section-title"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            padding: "6px 10px 4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <span>প্রধান মেনু</span>
          <Sparkles size={12} color="#64748b" />
        </div>
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`nav-link-btn ${active ? "active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: active ? "1px solid rgba(124, 58, 237, 0.45)" : "1px solid transparent",
                background: active
                  ? "linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(99, 102, 241, 0.12))"
                  : "transparent",
                color: active ? "#ffffff" : "#94a3b8",
                textDecoration: "none",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
                position: "relative",
                fontFamily: "inherit",
                boxShadow: active ? "0 4px 16px rgba(124, 58, 237, 0.2)" : "none"
              }}
            >
              <div
                className="nav-icon-container"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: active
                    ? "linear-gradient(135deg, #7c3aed, #6366f1)"
                    : "rgba(255, 255, 255, 0.04)",
                  color: active ? "#ffffff" : "#94a3b8",
                  boxShadow: active ? "0 2px 10px rgba(124, 58, 237, 0.4)" : "none",
                  flexShrink: 0
                }}
              >
                <Icon size={17} />
              </div>
              <span style={{ whiteSpace: "nowrap", flex: 1 }}>{label}</span>
              {badge && (
                <span
                  className="nav-badge"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 6,
                    background: active ? "rgba(124, 58, 237, 0.3)" : "rgba(255, 255, 255, 0.06)",
                    color: active ? "#c084fc" : "#cbd5e1"
                  }}
                >
                  {badge}
                </span>
              )}
              {active && <ChevronRight size={14} style={{ color: "#a855f7", flexShrink: 0 }} />}
            </Link>
          );
        })}
      </nav>

      {/* User Card with Quick Logout */}
      <div
        className="sidebar-user-card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: "12px 12px",
          borderRadius: 14,
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          marginTop: "auto"
        }}
      >
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 800,
              color: "#ffffff"
            }}
          >
            {user?.name?.[0] ?? "র"}
          </div>
          <span
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "#10b981",
              border: "2px solid #080911"
            }}
          />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#f1f5f9",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {user?.name || "রিয়াজ খান"}
          </div>
          <div style={{ fontSize: 11, color: "#10b981", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <span>●</span>
            <span>{user?.role === "SUPER_ADMIN" ? "সুপার অ্যাডমিন" : user?.role === "ADMIN" ? "অ্যাডমিন" : "এজেন্ট"}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="লগআউট"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "1px solid rgba(255, 255, 255, 0.06)",
            background: "rgba(255, 255, 255, 0.03)",
            color: "#94a3b8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
            e.currentTarget.style.color = "#f87171";
            e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
            e.currentTarget.style.color = "#94a3b8";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)";
          }}
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
