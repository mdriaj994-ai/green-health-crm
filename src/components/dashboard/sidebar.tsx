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
  Crown
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
  { id: "all", label: "সব চ্যানেল", color: "#fbbf24", count: "সক্রিয়" },
  { id: "MESSENGER", label: "Messenger", color: "#38bdf8", count: "২৪/৭" },
  { id: "WHATSAPP", label: "WhatsApp", color: "#34d399", count: "অনলাইন" },
  { id: "TELEGRAM", label: "Telegram", color: "#60a5fa", count: "বট" },
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
        background: "linear-gradient(180deg, #0b0a07 0%, #050505 100%)",
        borderRight: "1px solid rgba(245, 158, 11, 0.16)",
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
          borderBottom: "1px solid rgba(245, 158, 11, 0.12)"
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, #f59e0b, #b45309)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(217, 119, 6, 0.45)",
            flexShrink: 0
          }}
        >
          <Crown size={20} color="#000000" strokeWidth={2.4} />
        </div>
        <div>
          <div
            className="sidebar-logo-text"
            style={{
              fontSize: 16,
              fontWeight: 800,
              background: "linear-gradient(135deg, #fffbeb 0%, #fde68a 35%, #fbbf24 70%, #d97706 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              lineHeight: 1.2
            }}
          >
            SocialInbox
          </div>
          <div style={{ fontSize: 11, color: "#a38c5b", fontWeight: 600 }}>গোল্ডেন এডিশন</div>
        </div>
        <span
          className="sidebar-badge"
          style={{
            fontSize: 10,
            fontWeight: 800,
            padding: "2px 7px",
            borderRadius: 6,
            background: "rgba(245, 158, 11, 0.15)",
            color: "#fbbf24",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            marginLeft: "auto"
          }}
        >
          ROYAL
        </span>
      </div>

      {/* Platform Filter Buttons */}
      <div style={{ marginBottom: 4 }}>
        <div
          className="sidebar-section-title"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#bfa15f",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            padding: "6px 10px 4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <span>প্ল্যাটফর্ম ফিল্টার</span>
          <Radio size={12} color="#bfa15f" />
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
                  border: isSelected ? "1px solid rgba(245, 158, 11, 0.45)" : "1px solid transparent",
                  background: isSelected ? "linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(180, 83, 9, 0.12))" : "rgba(245, 158, 11, 0.03)",
                  color: isSelected ? "#fbbf24" : "#cfb989",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
                  fontFamily: "inherit",
                  boxShadow: isSelected ? "0 4px 14px rgba(217, 119, 6, 0.2)" : "none"
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
                    background: isSelected ? "rgba(245, 158, 11, 0.3)" : "rgba(245, 158, 11, 0.06)",
                    color: isSelected ? "#fef08a" : "#8c784e"
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
          borderTop: "1px solid rgba(245, 158, 11, 0.12)"
        }}
      >
        <div
          className="sidebar-section-title"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#bfa15f",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            padding: "6px 10px 4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <span>প্রধান মেনু</span>
          <Sparkles size={12} color="#bfa15f" />
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
                border: active ? "1px solid rgba(245, 158, 11, 0.5)" : "1px solid transparent",
                background: active
                  ? "linear-gradient(135deg, rgba(245, 158, 11, 0.22), rgba(180, 83, 9, 0.12))"
                  : "transparent",
                color: active ? "#ffffff" : "#cfb989",
                textDecoration: "none",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
                position: "relative",
                fontFamily: "inherit",
                boxShadow: active ? "0 4px 18px rgba(217, 119, 6, 0.22)" : "none"
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
                    ? "linear-gradient(135deg, #f59e0b, #b45309)"
                    : "rgba(245, 158, 11, 0.06)",
                  color: active ? "#000000" : "#d4af37",
                  boxShadow: active ? "0 2px 10px rgba(245, 158, 11, 0.5)" : "none",
                  flexShrink: 0
                }}
              >
                <Icon size={17} strokeWidth={active ? 2.3 : 2} />
              </div>
              <span style={{ whiteSpace: "nowrap", flex: 1 }}>{label}</span>
              {badge && (
                <span
                  className="nav-badge"
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "2px 7px",
                    borderRadius: 6,
                    background: active ? "rgba(245, 158, 11, 0.28)" : "rgba(245, 158, 11, 0.08)",
                    color: active ? "#fef08a" : "#cfb989",
                    border: active ? "1px solid rgba(245, 158, 11, 0.45)" : "1px solid rgba(245, 158, 11, 0.15)"
                  }}
                >
                  {badge}
                </span>
              )}
              {active && <ChevronRight size={14} style={{ color: "#fbbf24", flexShrink: 0 }} />}
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
          background: "rgba(245, 158, 11, 0.04)",
          border: "1px solid rgba(245, 158, 11, 0.14)",
          marginTop: "auto"
        }}
      >
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #f59e0b, #b45309)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 800,
              color: "#000000"
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
              background: "#fbbf24",
              border: "2px solid #0b0a07",
              boxShadow: "0 0 6px #fbbf24"
            }}
          />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#fef9ed",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {user?.name || "রিয়াজ খান"}
          </div>
          <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
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
            border: "1px solid rgba(245, 158, 11, 0.14)",
            background: "rgba(245, 158, 11, 0.04)",
            color: "#cfb989",
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
            e.currentTarget.style.background = "rgba(245, 158, 11, 0.04)";
            e.currentTarget.style.color = "#cfb989";
            e.currentTarget.style.borderColor = "rgba(245, 158, 11, 0.14)";
          }}
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
