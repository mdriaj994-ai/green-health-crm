"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  MessageCircle,
  Users,
  Settings,
  LayoutDashboard,
  ChevronRight,
  ShoppingBag,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "ইনবক্স", icon: MessageSquare },
  { href: "/dashboard/comments", label: "কমেন্টস", icon: MessageCircle },
  { href: "/dashboard/agents", label: "এজেন্টস", icon: Users },
  { href: "/dashboard/products", label: "প্রোডাক্টস", icon: ShoppingBag },
  { href: "/dashboard/settings", label: "সেটিংস", icon: Settings },
];

const platforms = [
  { id: "all", label: "সব", color: "var(--color-brand-primary)" },
  { id: "MESSENGER", label: "Messenger", color: "var(--color-messenger)" },
  { id: "WHATSAPP", label: "WhatsApp", color: "var(--color-whatsapp)" },
  { id: "TELEGRAM", label: "Telegram", color: "var(--color-telegram)" },
];

export function Sidebar({ user }: { user: any }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="url(#sgrad)" />
            <path d="M8 10h12M8 14h8M8 18h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <defs>
              <linearGradient id="sgrad" x1="0" y1="0" x2="28" y2="28">
                <stop stopColor="#6366f1" />
                <stop offset="1" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span className="sidebar-logo-text">SocialInbox</span>
      </div>

      {/* Platform Filter */}
      <div className="sidebar-section">
        <p className="sidebar-section-label">প্ল্যাটফর্ম</p>
        <div className="platform-list">
          {platforms.map((p) => (
            <button key={p.id} className="platform-btn">
              <span className="platform-dot" style={{ background: p.color }} />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} className={`nav-item ${active ? "active" : ""}`}>
              <Icon size={18} />
              <span>{label}</span>
              {active && <ChevronRight size={14} className="nav-chevron" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="sidebar-user">
        <div className="sidebar-avatar">
          {user?.name?.[0]?.toUpperCase() ?? "U"}
        </div>
        <div className="sidebar-user-info">
          <p className="sidebar-user-name">{user?.name}</p>
          <p className="sidebar-user-role">
            {user?.role === "SUPER_ADMIN" ? "সুপার অ্যাডমিন" : user?.role === "ADMIN" ? "অ্যাডমিন" : "এজেন্ট"}
          </p>
        </div>
      </div>

      <style jsx>{`
        .sidebar {
          width: 220px;
          min-width: 220px;
          height: 100vh;
          background: var(--bg-surface);
          border-right: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          padding: 16px 12px;
          gap: 4px;
          overflow-y: auto;
        }
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px 6px 20px;
        }
        .sidebar-logo-text {
          font-size: 16px;
          font-weight: 700;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .sidebar-section { margin-bottom: 8px; }
        .sidebar-section-label {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 0 8px;
          margin-bottom: 6px;
        }
        .platform-list { display: flex; flex-direction: column; gap: 2px; }
        .platform-btn {
          display: flex;
          align-items: center;
          gap: 9px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 7px 8px;
          border-radius: 8px;
          color: var(--text-secondary);
          font-size: 13px;
          font-family: inherit;
          transition: background 0.15s, color 0.15s;
          width: 100%;
          text-align: left;
        }
        .platform-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .platform-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          margin-top: 8px;
          border-top: 1px solid var(--border-subtle);
          padding-top: 12px;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 10px;
          border-radius: 10px;
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 13.5px;
          font-weight: 500;
          transition: background 0.15s, color 0.15s;
          position: relative;
        }
        .nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
        .nav-item.active {
          background: rgba(99,102,241,0.15);
          color: var(--color-brand-primary);
        }
        .nav-chevron { margin-left: auto; }
        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 8px;
          border-top: 1px solid var(--border-subtle);
          margin-top: 8px;
        }
        .sidebar-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
        }
        .sidebar-user-info { min-width: 0; }
        .sidebar-user-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sidebar-user-role {
          font-size: 11px;
          color: var(--text-muted);
        }
      `}</style>
    </aside>
  );
}
