// patch_inbox.js — patches inbox-view.tsx with stats bar + dossier panel
const fs = require('fs');
const path = require('path');

const FILEPATH = path.join(__dirname, 'src/components/dashboard/inbox-view.tsx');
let src = fs.readFileSync(FILEPATH, 'utf8');

// 1. Add new icon imports
src = src.replace(
  'import {\n  Send, Paperclip, MoreVertical, Phone, Video,\n  UserPlus, CheckCheck, RefreshCw, Wifi, WifiOff,\n} from "lucide-react";',
  'import {\n  Send, Paperclip, MoreVertical, Phone, Video,\n  UserPlus, CheckCheck, RefreshCw, Wifi, WifiOff,\n  Users, MessageSquare, Clock, ShoppingBag, User, Stethoscope, X,\n} from "lucide-react";'
);

// 2. Add types after utils import
src = src.replace(
  'import { formatRelativeTime, getPlatformColor, getPlatformLabel } from "@/lib/utils";',
  `import { formatRelativeTime, getPlatformColor, getPlatformLabel } from "@/lib/utils";

type DashboardStats = { todayCustomers: number; todayMessages: number; pendingFollowUps: number; ordersCount: number; };
type CustomerDossier = { name?:string; age?:string; maritalStatus?:string; profession?:string; symptoms?:string[]; duration?:string; productDiscussed?:string; orderStatus?:string; phone?:string; district?:string; thana?:string; address?:string; scheduledFollowUpAt?:number; followUpPromiseText?:string; followUpStatus?:string; lastContact?:number; allHealthKeywords?:string[]; extraFacts?:string[]; } | null;`
);

// 3. Add state after messagesEndRef line
src = src.replace(
  'const messagesEndRef = useRef<HTMLDivElement>(null);',
  `const [stats, setStats] = useState<DashboardStats>({ todayCustomers: 0, todayMessages: 0, pendingFollowUps: 0, ordersCount: 0 });
  const [dossier, setDossier] = useState<CustomerDossier>(null);
  const [showDossier, setShowDossier] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchStats = useCallback(async () => {
    try { const r = await fetch("/api/dashboard/stats"); if (r.ok) setStats(await r.json()); } catch {}
  }, []);

  const fetchDossier = useCallback(async (pid: string) => {
    try {
      const r = await fetch('/api/context?senderId=' + encodeURIComponent(pid));
      if (r.ok) { const d = await r.json(); setDossier(d?.profile ?? null); }
      else setDossier(null);
    } catch { setDossier(null); }
  }, []);`
);

// 4. Add stats useEffect after fetchConversations effect
src = src.replace(
  'useEffect(() => { fetchConversations(); }, [fetchConversations]);',
  'useEffect(() => { fetchConversations(); }, [fetchConversations]);\n  useEffect(() => { fetchStats(); }, [fetchStats]);'
);

// 5. Call fetchDossier when conv selected
src = src.replace(
  'if (selectedConv) fetchMessages(selectedConv.id);\n  }, [selectedConv, fetchMessages]);',
  'if (selectedConv) { fetchMessages(selectedConv.id); fetchDossier(selectedConv.contact.platformUserId); }\n  }, [selectedConv, fetchMessages, fetchDossier]);'
);

// 6. Add statsPoll to polling
src = src.replace(
  '// 1-second instant auto-refresh timer so every message appears immediately\n    const pollInterval = setInterval(() => {\n      fetchConversations();\n      if (selectedConv) fetchMessages(selectedConv.id);\n    }, 1000);\n\n    return () => {\n      if (es) es.close();\n      clearInterval(pollInterval);\n    };',
  `// polls
    const msgPoll = setInterval(() => { fetchConversations(); if (selectedConv) fetchMessages(selectedConv.id); }, 1000);
    const statsPoll = setInterval(() => { fetchStats(); }, 10000);
    return () => { if (es) es.close(); clearInterval(msgPoll); clearInterval(statsPoll); };`
);

// 7. Change outer div to flex column
src = src.replace(
  'return (\n    <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "100%" }}>',
  `return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "100%", flexDirection: "column" }}>`
);

// 8. Add stats bar + inner row wrapper before conv-panel
src = src.replace(
  '      {/* ── Left Panel: Conversation List ── */}\n      <div className="conv-panel">',
  `      {/* ── Top Stats Bar ── */}
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(99,102,241,0.15)", color: "#6366f1" }}><Users size={14}/></div>
          <div><div className="stat-value">{stats.todayCustomers}</div><div className="stat-label">আজকের কাস্টমার</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}><MessageSquare size={14}/></div>
          <div><div className="stat-value">{stats.todayMessages}</div><div className="stat-label">আজকের মেসেজ</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}><Clock size={14}/></div>
          <div><div className="stat-value">{stats.pendingFollowUps}</div><div className="stat-label">ফলো-আপ পেন্ডিং</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}><ShoppingBag size={14}/></div>
          <div><div className="stat-value">{stats.ordersCount}</div><div className="stat-label">অর্ডার কনফার্ম</div></div>
        </div>
      </div>

      {/* ── Main Row ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

      {/* ── Left Panel: Conversation List ── */}
      <div className="conv-panel">`
);

// 9. Add profile button to header actions
src = src.replace(
  '              <button className="icon-btn-sm"><MoreVertical size={15}/></button>\n            </div>\n          </div>',
  `              <button
                className={"icon-btn-sm" + (showDossier ? " active-btn" : "")}
                title="কাস্টমার প্রোফাইল"
                onClick={() => setShowDossier(v => !v)}
              ><User size={15}/></button>
              <button className="icon-btn-sm"><MoreVertical size={15}/></button>
            </div>
          </div>`
);

// 10. Add dossier panel + close inner row wrapper before style tag
const dossierBlock = `
      {/* ── Customer Dossier ── */}
      {showDossier && selectedConv && (
        <div className="dossier-panel">
          <div className="dossier-header">
            <Stethoscope size={14} color="#6366f1"/>
            <span>কাস্টমার প্রোফাইল</span>
            <button className="dossier-close" onClick={() => setShowDossier(false)}><X size={13}/></button>
          </div>
          <div className="dossier-body">
            {!dossier ? (
              <div className="dossier-empty">কোনো প্রোফাইল তথ্য নেই।<br/>কথা বললে স্বয়ংক্রিয়ভাবে তৈরি হবে।</div>
            ) : (
              <>
                <div className="dossier-section">
                  <div className="dossier-section-title"><User size={11}/> পরিচয়</div>
                  <div className="dossier-row"><span className="d-label">নাম</span><span className="d-val">{dossier.name || selectedConv.contact.name || "—"}</span></div>
                  {dossier.age && <div className="dossier-row"><span className="d-label">বয়স</span><span className="d-val">{dossier.age}</span></div>}
                  {dossier.maritalStatus && <div className="dossier-row"><span className="d-label">বিবাহ</span><span className="d-val">{dossier.maritalStatus}</span></div>}
                  {dossier.profession && <div className="dossier-row"><span className="d-label">পেশা</span><span className="d-val">{dossier.profession}</span></div>}
                  {dossier.phone && <div className="dossier-row"><span className="d-label">ফোন</span><span className="d-val" style={{color:"#6366f1"}}>{dossier.phone}</span></div>}
                </div>
                {(dossier.district || dossier.address) && (
                  <div className="dossier-section">
                    <div className="dossier-section-title">📍 ঠিকানা</div>
                    {dossier.district && <div className="dossier-row"><span className="d-label">জেলা</span><span className="d-val">{dossier.district}</span></div>}
                    {dossier.thana && <div className="dossier-row"><span className="d-label">থানা</span><span className="d-val">{dossier.thana}</span></div>}
                    {dossier.address && <div className="dossier-row"><span className="d-label">ঠিকানা</span><span className="d-val">{dossier.address}</span></div>}
                  </div>
                )}
                {((dossier.symptoms && dossier.symptoms.length > 0) || dossier.duration) && (
                  <div className="dossier-section">
                    <div className="dossier-section-title">🩺 স্বাস্থ্য তথ্য</div>
                    {dossier.symptoms && dossier.symptoms.length > 0 && <div className="dossier-row"><span className="d-label">লক্ষণ</span><span className="d-val">{dossier.symptoms.join(", ")}</span></div>}
                    {dossier.duration && <div className="dossier-row"><span className="d-label">কতদিন</span><span className="d-val">{dossier.duration}</span></div>}
                    {dossier.allHealthKeywords && dossier.allHealthKeywords.length > 0 && (
                      <div className="dossier-tags">{dossier.allHealthKeywords.slice(0,6).map((k,i) => <span key={i} className="dossier-tag">{k}</span>)}</div>
                    )}
                  </div>
                )}
                {dossier.productDiscussed && (
                  <div className="dossier-section">
                    <div className="dossier-section-title">💊 প্রোডাক্ট</div>
                    <div className="dossier-row"><span className="d-label">আলোচিত</span><span className="d-val" style={{color:"#a78bfa"}}>{dossier.productDiscussed}</span></div>
                    {dossier.orderStatus && <div className="dossier-row"><span className="d-label">স্ট্যাটাস</span><span className="d-val" style={{color:"#22c55e"}}>{dossier.orderStatus}</span></div>}
                  </div>
                )}
                {dossier.scheduledFollowUpAt && dossier.followUpStatus === "pending" && (
                  <div className="dossier-section dossier-followup">
                    <div className="dossier-section-title"><Clock size={11}/> ফলো-আপ</div>
                    <div className="dossier-row"><span className="d-label">সময়</span><span className="d-val" style={{color:"#f59e0b"}}>{new Date(dossier.scheduledFollowUpAt).toLocaleString("bn-BD")}</span></div>
                    {dossier.followUpPromiseText && <div className="dossier-row"><span className="d-label">প্রতিশ্রুতি</span><span className="d-val">"{dossier.followUpPromiseText}"</span></div>}
                  </div>
                )}
                {dossier.extraFacts && dossier.extraFacts.length > 0 && (
                  <div className="dossier-section">
                    <div className="dossier-section-title">📝 অতিরিক্ত তথ্য</div>
                    {dossier.extraFacts.slice(0,4).map((f,i) => <div key={i} className="dossier-fact">• {f}</div>)}
                  </div>
                )}
                {dossier.lastContact && <div className="dossier-last">শেষ যোগাযোগ: {new Date(dossier.lastContact).toLocaleDateString("bn-BD")}</div>}
              </>
            )}
          </div>
        </div>
      )}

      </div>{/* end main-row */}
`;

src = src.replace(
  '      <style jsx>{`',
  dossierBlock + '      <style jsx>{`'
);

// 11. Add stats bar CSS + dossier CSS before Left Panel CSS comment
const statsCss = `
        /* ── Stats Bar ── */
        .stats-bar {
          display: flex; gap: 10px; padding: 10px 16px;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--bg-surface); flex-shrink: 0;
        }
        .stat-card {
          display: flex; align-items: center; gap: 9px;
          padding: 8px 14px; border-radius: 12px;
          background: var(--bg-elevated); border: 1px solid var(--border-subtle);
          flex: 1; min-width: 0; transition: transform 0.15s, box-shadow 0.15s;
        }
        .stat-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .stat-icon { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .stat-value { font-size: 18px; font-weight: 800; color: var(--text-primary); line-height: 1.1; }
        .stat-label { font-size: 10px; color: var(--text-muted); white-space: nowrap; margin-top: 1px; }
`;

const dossierCss = `
        /* ── Dossier Panel ── */
        .dossier-panel {
          width: 270px; min-width: 240px;
          border-left: 1px solid var(--border-subtle);
          background: var(--bg-surface); display: flex; flex-direction: column;
          overflow: hidden; animation: slideInRight 0.2s ease;
        }
        @keyframes slideInRight { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        .dossier-header {
          display: flex; align-items: center; gap: 7px; padding: 12px 14px;
          border-bottom: 1px solid var(--border-subtle);
          font-size: 13px; font-weight: 700; color: var(--text-primary);
          background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.05));
        }
        .dossier-header span { flex: 1; }
        .dossier-close { background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; padding: 2px; border-radius: 4px; transition: color 0.15s; }
        .dossier-close:hover { color: var(--text-primary); }
        .dossier-body { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
        .dossier-empty { text-align: center; color: var(--text-muted); font-size: 12px; padding: 20px 10px; line-height: 1.7; }
        .dossier-section { background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 5px; }
        .dossier-followup { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.05); }
        .dossier-section-title { display: flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 5px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 2px; }
        .dossier-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; }
        .d-label { font-size: 11px; color: var(--text-muted); flex-shrink: 0; padding-top: 1px; }
        .d-val { font-size: 11.5px; color: var(--text-primary); text-align: right; word-break: break-word; max-width: 65%; }
        .dossier-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
        .dossier-tag { padding: 2px 8px; border-radius: 10px; font-size: 10px; background: rgba(99,102,241,0.12); color: var(--color-brand-primary); border: 1px solid rgba(99,102,241,0.2); }
        .dossier-fact { font-size: 11px; color: var(--text-secondary); line-height: 1.6; }
        .dossier-last { font-size: 10px; color: var(--text-muted); text-align: center; padding: 4px 0 2px; }
        .active-btn { background: rgba(99,102,241,0.2) !important; color: var(--color-brand-primary) !important; border-color: var(--color-brand-primary) !important; }
`;

src = src.replace(
  '        /* ── Left Panel ── */',
  statsCss + '\n        /* ── Left Panel ── */'
);

src = src.replace(
  "        .chat-empty span { color: var(--text-muted); font-size: 13px; }\n      `}</style>",
  "        .chat-empty span { color: var(--text-muted); font-size: 13px; }" + dossierCss + "\n      `}</style>"
);

fs.writeFileSync(FILEPATH, src, 'utf8');
console.log('Done! Lines:', src.split('\n').length);
