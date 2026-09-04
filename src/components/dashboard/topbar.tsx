"use client";

import { signOut } from "next-auth/react";
import { Bell, LogOut, Search } from "lucide-react";

export function TopBar({ user }: { user: any }) {
  return (
    <header className="topbar">
      <div className="topbar-search">
        <Search size={15} className="search-icon" />
        <input type="text" placeholder="কথোপকথন খুঁজুন..." className="search-input" />
      </div>

      <div className="topbar-actions">
        <button className="icon-btn" title="নোটিফিকেশন">
          <Bell size={18} />
          <span className="notif-badge">3</span>
        </button>
        <button
          className="icon-btn logout-btn"
          title="লগআউট"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut size={18} />
        </button>
      </div>

      <style jsx>{`
        .topbar {
          height: 56px;
          min-height: 56px;
          display: flex;
          align-items: center;
          padding: 0 20px;
          gap: 12px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-subtle);
        }
        .topbar-search {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          padding: 0 12px;
          max-width: 400px;
        }
        .search-icon { color: var(--text-muted); flex-shrink: 0; }
        .search-input {
          background: none;
          border: none;
          outline: none;
          font-size: 13.5px;
          color: var(--text-primary);
          width: 100%;
          padding: 9px 0;
          font-family: inherit;
        }
        .search-input::placeholder { color: var(--text-muted); }
        .topbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
        }
        .icon-btn {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
          position: relative;
        }
        .icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .notif-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: var(--color-brand-primary);
          color: white;
          font-size: 9px;
          font-weight: 700;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid var(--bg-surface);
        }
        .logout-btn:hover { background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.3); }
      `}</style>
    </header>
  );
}
