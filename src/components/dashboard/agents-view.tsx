"use client";

import { useState } from "react";
import {
  Users, Plus, Mail, Shield, ShieldCheck, ShieldAlert,
  MoreVertical, Trash2, Edit2, CheckCircle, X, Eye, EyeOff,
} from "lucide-react";
import axios from "axios";

type Agent = {
  id: string; name: string; email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "AGENT";
  isActive: boolean; createdAt: string;
};

const ROLE_CONFIG = {
  SUPER_ADMIN: { label: "সুপার অ্যাডমিন", color: "#8b5cf6", icon: ShieldAlert, bg: "rgba(139,92,246,0.12)" },
  ADMIN:       { label: "অ্যাডমিন",       color: "#6366f1", icon: ShieldCheck, bg: "rgba(99,102,241,0.12)" },
  AGENT:       { label: "এজেন্ট",          color: "#06b6d4", icon: Shield,      bg: "rgba(6,182,212,0.12)"  },
};

const DEMO_AGENTS: Agent[] = [
  { id: "u1", name: "রিয়াজ খান",   email: "admin@example.com", role: "SUPER_ADMIN", isActive: true, createdAt: new Date(Date.now() - 10 * 86400000).toISOString() },
  { id: "u2", name: "করিম সাহেব",  email: "karim@example.com", role: "ADMIN",       isActive: true, createdAt: new Date(Date.now() - 5 * 86400000).toISOString()  },
  { id: "u3", name: "ফারুক হোসেন", email: "faruk@example.com", role: "AGENT",       isActive: true, createdAt: new Date(Date.now() - 2 * 86400000).toISOString()  },
  { id: "u4", name: "সানজিদা",    email: "sanjida@example.com", role: "AGENT",      isActive: false, createdAt: new Date(Date.now() - 1 * 86400000).toISOString() },
];

const ROLE_PERMS = [
  { perm: "সব চ্যাট দেখা",       SUPER_ADMIN: true,  ADMIN: true,  AGENT: false },
  { perm: "নিজের চ্যাট দেখা",   SUPER_ADMIN: true,  ADMIN: true,  AGENT: true  },
  { perm: "Agent যোগ করা",      SUPER_ADMIN: true,  ADMIN: true,  AGENT: false },
  { perm: "Page কানেক্ট করা",   SUPER_ADMIN: true,  ADMIN: false, AGENT: false },
  { perm: "চ্যাট অ্যাসাইন করা", SUPER_ADMIN: true,  ADMIN: true,  AGENT: false },
  { perm: "রিপ্লাই দেওয়া",      SUPER_ADMIN: true,  ADMIN: true,  AGENT: true  },
  { perm: "রিপোর্ট দেখা",       SUPER_ADMIN: true,  ADMIN: true,  AGENT: false },
  { perm: "কমেন্ট ডিলিট করা",   SUPER_ADMIN: true,  ADMIN: true,  AGENT: false },
];

export function AgentsView() {
  const [agents, setAgents]         = useState<Agent[]>(DEMO_AGENTS);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm]             = useState({ name: "", email: "", password: "", role: "AGENT" });
  const [adding, setAdding]         = useState(false);
  const [error, setError]           = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [activeTab, setActiveTab]   = useState<"agents" | "roles">("agents");

  async function addAgent() {
    if (!form.name || !form.email || !form.password) {
      setError("সব ফিল্ড পূরণ করুন");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const res = await axios.post("/api/auth/register", {
        name: form.name, email: form.email, password: form.password,
      });
      const newAgent: Agent = {
        ...res.data.user, isActive: true,
        role: form.role as any,
        createdAt: new Date().toISOString(),
      };
      setAgents((a) => [newAgent, ...a]);
      setForm({ name: "", email: "", password: "", role: "AGENT" });
      setShowAddForm(false);
    } catch (e: any) {
      setError(e.response?.data?.error ?? "কিছু একটা সমস্যা হয়েছে");
    } finally {
      setAdding(false);
    }
  }

  function toggleActive(id: string) {
    setAgents((a) => a.map((ag) => ag.id === id ? { ...ag, isActive: !ag.isActive } : ag));
  }
  function removeAgent(id: string) {
    setAgents((a) => a.filter((ag) => ag.id !== id));
  }

  return (
    <div className="agents-shell">
      {/* Header */}
      <div className="agents-header">
        <div>
          <h1 className="agents-title"><Users size={20}/> এজেন্ট ম্যানেজমেন্ট</h1>
          <p className="agents-sub">আপনার টিম মেম্বার এবং তাদের অনুমতি পরিচালনা করুন</p>
        </div>
        <button className="add-btn" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? <X size={15}/> : <Plus size={15}/>}
          {showAddForm ? "বাতিল" : "নতুন এজেন্ট"}
        </button>
      </div>

      {/* Tabs */}
      <div className="agents-tabs">
        <button className={`tab-btn ${activeTab === "agents" ? "active" : ""}`} onClick={() => setActiveTab("agents")}>
          দলের সদস্য ({agents.length})
        </button>
        <button className={`tab-btn ${activeTab === "roles" ? "active" : ""}`} onClick={() => setActiveTab("roles")}>
          রোল ও অনুমতি
        </button>
      </div>

      <div className="agents-content">
        {/* ── Add Agent Form ── */}
        {showAddForm && (
          <div className="add-form animate-fade-in">
            <h3 className="form-title">নতুন এজেন্ট যোগ করুন</h3>
            {error && <div className="form-error"><X size={13}/> {error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">পুরো নাম</label>
                <input className="form-input" placeholder="এজেন্টের নাম"
                  value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">ইমেইল</label>
                <input className="form-input" type="email" placeholder="email@example.com"
                  value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">পাসওয়ার্ড</label>
                <div className="pw-wrap">
                  <input className="form-input" type={showPw ? "text" : "password"} placeholder="••••••••"
                    value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} />
                  <button className="pw-toggle" onClick={() => setShowPw(!showPw)}>
                    {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">রোল</label>
                <select className="form-input form-select"
                  value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}>
                  <option value="AGENT">এজেন্ট</option>
                  <option value="ADMIN">অ্যাডমিন</option>
                  <option value="SUPER_ADMIN">সুপার অ্যাডমিন</option>
                </select>
              </div>
            </div>
            <button className="save-btn" onClick={addAgent} disabled={adding}>
              {adding ? "যোগ হচ্ছে..." : "✓ এজেন্ট যোগ করুন"}
            </button>
          </div>
        )}

        {/* ── Agents Table ── */}
        {activeTab === "agents" && (
          <div className="table-wrap animate-fade-in">
            {/* Stats row */}
            <div className="stats-row">
              {(["SUPER_ADMIN", "ADMIN", "AGENT"] as const).map((role) => {
                const cfg = ROLE_CONFIG[role];
                const count = agents.filter(a => a.role === role).length;
                const Icon = cfg.icon;
                return (
                  <div key={role} className="stat-card" style={{ borderColor: cfg.color + "40", background: cfg.bg }}>
                    <Icon size={20} color={cfg.color}/>
                    <div>
                      <p className="stat-num" style={{ color: cfg.color }}>{count}</p>
                      <p className="stat-label">{cfg.label}</p>
                    </div>
                  </div>
                );
              })}
              <div className="stat-card" style={{ borderColor: "#22c55e40", background: "rgba(34,197,94,0.08)" }}>
                <CheckCircle size={20} color="#22c55e"/>
                <div>
                  <p className="stat-num" style={{ color: "#22c55e" }}>{agents.filter(a => a.isActive).length}</p>
                  <p className="stat-label">সক্রিয়</p>
                </div>
              </div>
            </div>

            {/* Table */}
            <table className="agents-table">
              <thead>
                <tr>
                  <th>নাম</th>
                  <th>ইমেইল</th>
                  <th>রোল</th>
                  <th>অবস্থা</th>
                  <th>যোগদান</th>
                  <th>অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => {
                  const cfg = ROLE_CONFIG[agent.role];
                  const Icon = cfg.icon;
                  return (
                    <tr key={agent.id}>
                      <td>
                        <div className="agent-name-cell">
                          <div className="agent-avatar">{agent.name[0]?.toUpperCase()}</div>
                          <span className="agent-name">{agent.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="agent-email"><Mail size={12}/> {agent.email}</span>
                      </td>
                      <td>
                        <span className="role-badge" style={{ color: cfg.color, background: cfg.bg }}>
                          <Icon size={12}/> {cfg.label}
                        </span>
                      </td>
                      <td>
                        <button className={`status-toggle ${agent.isActive ? "active" : "inactive"}`}
                          onClick={() => toggleActive(agent.id)}>
                          {agent.isActive ? "● সক্রিয়" : "○ নিষ্ক্রিয়"}
                        </button>
                      </td>
                      <td>
                        <span className="join-date">
                          {new Date(agent.createdAt).toLocaleDateString("bn-BD")}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns">
                          <button className="action-btn edit" title="সম্পাদনা"><Edit2 size={13}/></button>
                          <button className="action-btn delete" title="মুছুন"
                            onClick={() => removeAgent(agent.id)}><Trash2 size={13}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Roles & Permissions ── */}
        {activeTab === "roles" && (
          <div className="roles-section animate-fade-in">
            <h3 className="roles-title">রোল অনুযায়ী অনুমতি</h3>
            <table className="perm-table">
              <thead>
                <tr>
                  <th>অনুমতি</th>
                  <th><ShieldAlert size={14} color="#8b5cf6"/> সুপার অ্যাডমিন</th>
                  <th><ShieldCheck size={14} color="#6366f1"/> অ্যাডমিন</th>
                  <th><Shield size={14} color="#06b6d4"/> এজেন্ট</th>
                </tr>
              </thead>
              <tbody>
                {ROLE_PERMS.map((row) => (
                  <tr key={row.perm}>
                    <td className="perm-name">{row.perm}</td>
                    {(["SUPER_ADMIN", "ADMIN", "AGENT"] as const).map((role) => (
                      <td key={role} className="perm-cell">
                        {row[role]
                          ? <span className="perm-yes">✓</span>
                          : <span className="perm-no">✗</span>
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .agents-shell { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--bg-base); }
        .agents-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 20px 24px 0; }
        .agents-title { display: flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .agents-sub { font-size: 13px; color: var(--text-muted); }
        .add-btn {
          display: flex; align-items: center; gap: 6px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white; border: none; border-radius: 10px;
          padding: 9px 16px; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: opacity 0.15s; font-family: inherit;
        }
        .add-btn:hover { opacity: 0.88; }
        .agents-tabs { display: flex; gap: 6px; padding: 14px 24px; border-bottom: 1px solid var(--border-subtle); }
        .tab-btn {
          padding: 7px 18px; border-radius: 20px;
          border: 1px solid var(--border-default); background: none;
          color: var(--text-secondary); font-size: 13px; cursor: pointer;
          transition: all 0.15s; font-family: inherit;
        }
        .tab-btn.active { background: rgba(99,102,241,0.15); border-color: var(--color-brand-primary); color: var(--color-brand-primary); }
        .agents-content { flex: 1; overflow-y: auto; padding: 16px 24px; display: flex; flex-direction: column; gap: 16px; }

        /* Add form */
        .add-form {
          background: var(--bg-surface); border: 1px solid var(--border-default);
          border-radius: 16px; padding: 20px;
          display: flex; flex-direction: column; gap: 14px;
        }
        .form-title { font-size: 15px; font-weight: 700; color: var(--text-primary); }
        .form-error {
          display: flex; align-items: center; gap: 7px;
          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
          border-radius: 8px; padding: 8px 12px;
          color: #ef4444; font-size: 13px;
        }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .form-group { display: flex; flex-direction: column; gap: 5px; }
        .form-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
        .form-input {
          background: var(--bg-elevated); border: 1px solid var(--border-default);
          border-radius: 9px; padding: 9px 12px; font-size: 13px;
          color: var(--text-primary); outline: none; font-family: inherit;
          transition: border-color 0.2s; width: 100%;
        }
        .form-input:focus { border-color: var(--color-brand-primary); }
        .form-input::placeholder { color: var(--text-muted); }
        .form-select { cursor: pointer; }
        .pw-wrap { position: relative; }
        .pw-toggle {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: var(--text-muted); cursor: pointer;
          display: flex; align-items: center;
        }
        .save-btn {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white; border: none; border-radius: 9px;
          padding: 10px 22px; font-size: 13px; font-weight: 600;
          cursor: pointer; align-self: flex-start; font-family: inherit;
          transition: opacity 0.15s;
        }
        .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Stats */
        .stats-row { display: flex; gap: 12px; flex-wrap: wrap; }
        .stat-card {
          display: flex; align-items: center; gap: 12px;
          background: var(--bg-surface); border: 1px solid;
          border-radius: 12px; padding: 14px 18px; flex: 1; min-width: 120px;
        }
        .stat-num { font-size: 22px; font-weight: 800; line-height: 1; }
        .stat-label { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

        /* Table */
        .table-wrap { display: flex; flex-direction: column; gap: 14px; }
        .agents-table { width: 100%; border-collapse: collapse; }
        .agents-table th {
          text-align: left; padding: 10px 14px;
          font-size: 11.5px; font-weight: 600; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.05em;
          border-bottom: 1px solid var(--border-subtle);
        }
        .agents-table td {
          padding: 12px 14px;
          border-bottom: 1px solid var(--border-subtle);
          vertical-align: middle;
        }
        .agents-table tr:hover td { background: rgba(255,255,255,0.02); }
        .agents-table tr:last-child td { border-bottom: none; }

        .agent-name-cell { display: flex; align-items: center; gap: 9px; }
        .agent-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; color: white; flex-shrink: 0;
        }
        .agent-name { font-size: 13.5px; font-weight: 600; color: var(--text-primary); }
        .agent-email { display: flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--text-secondary); }
        .role-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 20px;
          font-size: 12px; font-weight: 600;
        }
        .status-toggle {
          background: none; border: none; cursor: pointer;
          font-size: 12px; font-family: inherit; font-weight: 600;
          transition: all 0.15s;
        }
        .status-toggle.active { color: #22c55e; }
        .status-toggle.inactive { color: var(--text-muted); }
        .join-date { font-size: 12px; color: var(--text-muted); }
        .action-btns { display: flex; gap: 6px; }
        .action-btn {
          width: 28px; height: 28px; border-radius: 7px;
          border: 1px solid var(--border-subtle); background: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.15s;
        }
        .action-btn.edit { color: var(--text-secondary); }
        .action-btn.edit:hover { color: var(--color-brand-primary); border-color: var(--color-brand-primary); background: rgba(99,102,241,0.08); }
        .action-btn.delete { color: var(--text-secondary); }
        .action-btn.delete:hover { color: #ef4444; border-color: #ef4444; background: rgba(239,68,68,0.08); }

        /* Roles table */
        .roles-section { display: flex; flex-direction: column; gap: 14px; }
        .roles-title { font-size: 16px; font-weight: 700; color: var(--text-primary); }
        .perm-table { width: 100%; border-collapse: collapse; }
        .perm-table th {
          padding: 12px 16px; font-size: 13px; font-weight: 700;
          color: var(--text-primary); text-align: center;
          border-bottom: 2px solid var(--border-default);
          background: var(--bg-surface);
        }
        .perm-table th:first-child { text-align: left; }
        .perm-table td { padding: 12px 16px; border-bottom: 1px solid var(--border-subtle); }
        .perm-table tr:hover td { background: rgba(255,255,255,0.015); }
        .perm-name { font-size: 13px; color: var(--text-secondary); }
        .perm-cell { text-align: center; }
        .perm-yes { color: #22c55e; font-size: 16px; font-weight: 700; }
        .perm-no  { color: var(--text-muted); font-size: 14px; }
      `}</style>
    </div>
  );
}
