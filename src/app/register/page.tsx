"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("পাসওয়ার্ড দুটো মিলছে না");
      return;
    }
    if (form.password.length < 6) {
      setError("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
      return;
    }

    setLoading(true);
    try {
      await axios.post("/api/auth/register", {
        name: form.name,
        email: form.email,
        password: form.password,
      });
      router.push("/login?registered=true");
    } catch (err: any) {
      setError(err.response?.data?.error ?? "কিছু একটা সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-glow" />
      <div className="auth-card animate-fade-in">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="url(#grad2)" />
              <path d="M8 10h12M8 14h8M8 18h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <defs>
                <linearGradient id="grad2" x1="0" y1="0" x2="28" y2="28">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="auth-logo-text">SocialInbox</span>
        </div>

        <h1 className="auth-title">অ্যাকাউন্ট তৈরি করুন</h1>
        <p className="auth-subtitle">আপনার তথ্য দিয়ে শুরু করুন</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">পুরো নাম</label>
            <input name="name" type="text" className="form-input" placeholder="আপনার নাম"
              value={form.name} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label className="form-label">ইমেইল</label>
            <input name="email" type="email" className="form-input" placeholder="you@example.com"
              value={form.email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label className="form-label">পাসওয়ার্ড</label>
            <input name="password" type="password" className="form-input" placeholder="••••••••"
              value={form.password} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label className="form-label">পাসওয়ার্ড নিশ্চিত করুন</label>
            <input name="confirm" type="password" className="form-input" placeholder="••••••••"
              value={form.confirm} onChange={handleChange} required />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "তৈরি হচ্ছে..." : "অ্যাকাউন্ট তৈরি করুন"}
          </button>
        </form>

        <p className="auth-footer">
          ইতিমধ্যে অ্যাকাউন্ট আছে?{" "}
          <Link href="/login" className="auth-link">লগইন করুন</Link>
        </p>
      </div>

      <style jsx>{`
        .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-base); position: relative; overflow: hidden; }
        .auth-bg-glow { position: absolute; width: 600px; height: 600px; background: radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%); top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none; }
        .auth-card { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 20px; padding: 40px; width: 100%; max-width: 420px; position: relative; z-index: 1; box-shadow: 0 24px 64px rgba(0,0,0,0.4); }
        .auth-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
        .auth-logo-icon { display: flex; }
        .auth-logo-text { font-size: 20px; font-weight: 700; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .auth-title { font-size: 26px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
        .auth-subtitle { color: var(--text-secondary); font-size: 14px; margin-bottom: 28px; }
        .auth-error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; border-radius: 10px; padding: 10px 14px; font-size: 13px; margin-bottom: 20px; }
        .auth-form { display: flex; flex-direction: column; gap: 16px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-label { font-size: 13px; font-weight: 500; color: var(--text-secondary); }
        .form-input { background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: 10px; padding: 11px 14px; font-size: 15px; color: var(--text-primary); outline: none; transition: border-color 0.2s, box-shadow 0.2s; font-family: inherit; }
        .form-input:focus { border-color: var(--color-brand-primary); box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
        .form-input::placeholder { color: var(--text-muted); }
        .btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 10px; padding: 13px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 4px; transition: opacity 0.2s, transform 0.1s; font-family: inherit; }
        .btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .auth-footer { text-align: center; margin-top: 24px; font-size: 13px; color: var(--text-secondary); }
        .auth-link { color: var(--color-brand-primary); font-weight: 600; text-decoration: none; }
        .auth-link:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
