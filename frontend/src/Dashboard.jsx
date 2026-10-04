import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AttendanceReport from "./AttendanceReport";
import ChatPanel from "./ChatPanel";
import { SEMESTER_OPTIONS, ALL_UNITS } from "./scheduleUtils";

const NAVY = "#0f2a52";
const ACCENT = "#4f46e5";
const GOLD = "#e8a020";

const sidebarNavItems = [
  { id: "chat", label: "AI Chat" },
  { id: "dashboard", label: "Overview" },
  { id: "profile", label: "My Profile" },
  { id: "courses", label: "My Courses" },
  { id: "assessments", label: "Assessments" },
  { id: "attendance", label: "Attendance" },
  { id: "moodle", label: "My Moodle" }
];

function NavIcon({ id }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (id) {
    case "chat":
      return <svg {...common}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" /></svg>;
    case "dashboard":
      return <svg {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-6h6v6" /></svg>;
    case "profile":
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>;
    case "courses":
      return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5Z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" /></svg>;
    case "assessments":
      return <svg {...common}><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" /><path d="m9 12 2 2 4-4" /></svg>;
    case "attendance":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.3 2.3L16 10" /></svg>;
    case "moodle":
      return <svg {...common}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></svg>;
    case "logout":
      return <svg {...common}><path d="M12 3v8" /><path d="M18.4 6.6a8 8 0 1 1-12.8 0" /></svg>;
    case "menu":
      return <svg {...common}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
    case "bell":
      return <svg {...common}><path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>;
    case "chevron-down":
      return <svg {...common} width="12" height="12"><path d="m6 9 6 6 6-6" /></svg>;
    default:
      return null;
  }
}

function IconBox({ bg, size = 48, fontSize = 22, children }) {
  return (
    <div className="sa-iconbox" style={{ width: size, height: size, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize, flexShrink: 0, transition: "transform 0.2s ease" }}>
      {children}
    </div>
  );
}

function ChangePasswordCard({ studentEmail }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState(null); // { ok: bool, message: string }
  const [saving, setSaving] = useState(false);

  function submit(e) {
    e.preventDefault();
    setStatus(null);
    if (next.length < 6) {
      setStatus({ ok: false, message: "New password must be at least 6 characters." });
      return;
    }
    if (next !== confirm) {
      setStatus({ ok: false, message: "New passwords don't match." });
      return;
    }
    setSaving(true);
    fetch("/api/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: studentEmail, currentPassword: current, newPassword: next }),
    })
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (ok && data.success) {
          setStatus({ ok: true, message: "Password updated." });
          setCurrent(""); setNext(""); setConfirm("");
        } else {
          setStatus({ ok: false, message: data.message || "Couldn't update password." });
        }
      })
      .catch(() => setStatus({ ok: false, message: "Couldn't reach the server." }))
      .finally(() => setSaving(false));
  }

  const inputStyle = { width: "100%", padding: "9px 11px", border: "1px solid #dcdfe6", borderRadius: 8, fontSize: 13, boxSizing: "border-box" };

  return (
    <div style={{ background: "white", borderRadius: 14, boxShadow: "0 2px 10px rgba(16,24,64,0.06)", border: "1px solid #eef0f5", padding: 24 }}>
      <div style={{ fontSize: 15, fontWeight: "bold", color: NAVY, marginBottom: 14 }}>Change Password</div>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input type="password" placeholder="Current password" value={current} onChange={e => setCurrent(e.target.value)} style={inputStyle} required />
        <input type="password" placeholder="New password" value={next} onChange={e => setNext(e.target.value)} style={inputStyle} required />
        <input type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} style={inputStyle} required />
        {status && (
          <div style={{ fontSize: 12.5, color: status.ok ? "#1b7f3a" : "#a12d2d" }}>{status.message}</div>
        )}
        <button
          type="submit"
          disabled={saving}
          className="sa-btn-primary"
          style={{ background: ACCENT, color: "white", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13.5, fontWeight: "bold", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1, marginTop: 4 }}
        >
          {saving ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}

function daysUntil(dateStr) {
  const due = new Date(dateStr);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState("chat");
  const [activeUnit, setActiveUnit] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [myAttendance, setMyAttendance] = useState(null);
  const [unitAssessments, setUnitAssessments] = useState([]);
  const [allAssessments, setAllAssessments] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [allUnits, setAllUnits] = useState([]);
  const [timetableSessions, setTimetableSessions] = useState([]);
  const [attendanceUnitCode, setAttendanceUnitCode] = useState("");
  const [attendanceSemester, setAttendanceSemester] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [myMoodleSubmissions, setMyMoodleSubmissions] = useState([]);
  const [myMoodleAttendance, setMyMoodleAttendance] = useState([]);
  const [moodleLoaded, setMoodleLoaded] = useState(false);
  const [moodleLoading, setMoodleLoading] = useState(false);
  const [moodleError, setMoodleError] = useState("");
  const navigate = useNavigate();

  const studentName = localStorage.getItem("studentName") || "Student";
  const studentEmail = localStorage.getItem("studentEmail") || "";

  useEffect(() => {
    if (localStorage.getItem("loggedIn") !== "true") {
      navigate("/");
      return;
    }
    fetch("/api/assessments").then(r => r.json()).then(setAllAssessments).catch(() => setAllAssessments([]));
    fetch("/api/units").then(r => r.json()).then(setAllUnits).catch(() => setAllUnits([]));
    fetch("/api/timetable").then(r => r.json()).then(setTimetableSessions).catch(() => setTimetableSessions([]));
    if (studentEmail) {
      fetch(`/api/notifications?email=${encodeURIComponent(studentEmail)}`).then(r => r.json()).then(setNotifications).catch(() => {});
      fetch(`/api/attendance/student/${encodeURIComponent(studentEmail)}`).then(r => r.json()).then(setMyAttendance).catch(() => {});
      fetch(`/api/students/me?email=${encodeURIComponent(studentEmail)}`).then(r => r.json()).then(d => setMyProfile(d.success ? d.student : null)).catch(() => {});
    }
  }, [navigate]);

  function loadMyMoodleData() {
    setMoodleError("");
    if (!studentEmail) {
      setMoodleError("No student email found for this session. Please log out and log back in, then try again.");
      return;
    }
    setMoodleLoading(true);
    Promise.all([
      fetch(`/api/moodle/submissions/student?email=${encodeURIComponent(studentEmail)}`).then(r => {
        if (!r.ok) throw new Error(`Submissions request failed (${r.status})`);
        return r.json();
      }),
      fetch(`/api/moodle/attendance-records/student?email=${encodeURIComponent(studentEmail)}`).then(r => {
        if (!r.ok) throw new Error(`Attendance request failed (${r.status})`);
        return r.json();
      }),
    ]).then(([submissions, attendanceRecords]) => {
      setMyMoodleSubmissions(submissions);
      setMyMoodleAttendance(attendanceRecords);
      setMoodleLoaded(true);
    }).catch(err => {
      setMoodleError(`Couldn't reach the Moodle backend: ${err.message}. Make sure the FastAPI server (backend-rag, port 5001) is running.`);
    }).finally(() => setMoodleLoading(false));
  }

  function toggleNotifications() {
    setNotifOpen(!notifOpen);
    if (!notifOpen && studentEmail) {
      fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: studentEmail })
      }).then(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      });
    }
  }

  function logout() {
    localStorage.removeItem("loggedIn");
    localStorage.removeItem("role");
    localStorage.removeItem("studentName");
    localStorage.removeItem("studentEmail");
    navigate("/");
  }

  function goTo(tabId) {
    setActiveTab(tabId);
    setActiveUnit(null);
    setProfileMenuOpen(false);
  }

  function openUnit(c) {
    setActiveTab("courses");
    setActiveUnit(c);
    fetch(`/api/assessments?unitCode=${encodeURIComponent(c.code)}`).then(r => r.json()).then(setUnitAssessments).catch(() => setUnitAssessments([]));
  }

  const unitDecoration = {
    "ICT307": { color: NAVY, schedule: "Mon 10 AM - 12 PM" },
    "ICT301": { color: ACCENT, schedule: "Tue 1 PM - 3 PM" },
    "ICT305": { color: GOLD, schedule: "Wed 9 AM - 11 AM" },
    "ICT210": { color: "#6c757d", schedule: "Thu 2 PM - 4 PM" }
  };
  const decorationPalette = [NAVY, ACCENT, GOLD, "#6c757d"];
  const myUnitCodes = (myProfile && myProfile.unitCodes) || [];
  const courses = allUnits
    .filter(u => myUnitCodes.includes(u.code))
    .map((u, i) => ({
      code: u.code,
      name: u.name,
      semester: u.semester,
      color: (unitDecoration[u.code] && unitDecoration[u.code].color) || decorationPalette[i % decorationPalette.length],
      schedule: (unitDecoration[u.code] && unitDecoration[u.code].schedule) || "Schedule TBA"
    }));

  const searchResults = searchQuery.trim()
    ? courses.filter(c =>
        c.code.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        c.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : [];

  const todayFormatted = new Date().toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const activeAttendanceUnit = attendanceUnitCode || myUnitCodes[0] || "";
  const activeAttendanceSemester = attendanceSemester || SEMESTER_OPTIONS[1];

  function unitLabel(code) {
    const u = allUnits.find(x => x.code === code);
    return u ? `${u.code} — ${u.name}` : code;
  }

  const cardStyle = { background: "white", borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.07)" };

  const statCards = [
    { label: "Enrolled Courses", value: courses.length, icon: "📚", bg: NAVY, onView: () => goTo("courses") },
    { label: "Assessments Due", value: allAssessments.length, icon: "📝", bg: GOLD, onView: () => goTo("assessments") },
    { label: "Unread Notifications", value: notifications.filter(n => !n.read).length, icon: "🔔", bg: ACCENT, onView: toggleNotifications }
  ];

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", background: "#f5f6fa", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{`
        .sa-navitem { transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease; }
        .sa-navitem:hover { background: #eef0fe; color: ${ACCENT}; transform: translateX(2px); }
        .sa-navitem:hover .sa-navicon { color: ${ACCENT}; transform: scale(1.14); }
        .sa-navitem.active { background: #eef0fe; color: ${ACCENT}; font-weight: bold; }
        .sa-navitem.active .sa-navicon { color: ${ACCENT}; }
        .sa-navicon { transition: transform 0.15s ease, color 0.15s ease; display: flex; }
        .sa-logout:hover { background: #fdeeee; color: #dc3545 !important; }
        .sa-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .sa-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(15,42,82,0.1); }
        .sa-card:hover .sa-iconbox { transform: scale(1.1) rotate(-4deg); }
        .sa-btn-primary { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .sa-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(79,70,229,0.3); }
      `}</style>
      <div style={{ display: "flex", flex: 1, alignItems: "stretch" }}>

        {/* LEFT SIDEBAR */}
        <div style={{
          width: sidebarOpen ? 240 : 0, flexShrink: 0, overflow: "hidden",
          position: "sticky", top: 0, alignSelf: "flex-start", height: "100vh",
          transition: "width 0.25s ease"
        }}>
          <div style={{
            width: 240, height: "100%", background: "white", color: "#44485a",
            display: "flex", flexDirection: "column", overflowY: "auto", borderRight: "1px solid #ebedf1"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px" }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, background: NAVY,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0
              }}>
                🤖
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: 14, fontWeight: "bold", color: NAVY }}>SmartAssist</div>
                <div style={{ fontSize: 10.5, color: "#9aa0ac", letterSpacing: 0.3 }}>CIHE STUDENT PORTAL</div>
              </div>
            </div>

            <div style={{ flex: 1, padding: "8px 12px" }}>
              {sidebarNavItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => goTo(item.id)}
                  className={`sa-navitem${activeTab === item.id ? " active" : ""}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                    cursor: "pointer", fontSize: 13.5, borderRadius: 8, marginBottom: 2,
                  }}
                >
                  <span className="sa-navicon">
                    <NavIcon id={item.id} />
                  </span>
                  {item.label}
                </div>
              ))}
            </div>

            <div
              onClick={logout}
              className="sa-logout"
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "16px 20px",
                cursor: "pointer", fontSize: 13.5, color: "#8a8f9c",
                borderTop: "1px solid #ebedf1", transition: "background 0.15s ease, color 0.15s ease"
              }}
            >
              <NavIcon id="logout" />
              Logout
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: TOPBAR + MAIN CONTENT */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {/* TOP BAR */}
          <div style={{
            background: "white", borderBottom: "1px solid #e0e0e0", position: "sticky", top: 0, zIndex: 20,
            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", gap: 20
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, flex: 1, minWidth: 0 }}>
              <button
                title={sidebarOpen ? "Hide menu" : "Show menu"}
                onClick={() => setSidebarOpen(open => !open)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: NAVY, padding: 4 }}
              >
                <NavIcon id="menu" />
              </button>
              <div style={{ position: "relative", maxWidth: 360, width: "100%" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#999", display: "flex" }}><NavIcon id="search" /></span>
                <input
                  type="text"
                  placeholder="Search your units..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  style={{
                    width: "100%", boxSizing: "border-box", padding: "9px 14px 9px 34px",
                    borderRadius: 20, border: "1px solid #e0e0e0", background: "#f5f6f8", fontSize: 13, outline: "none"
                  }}
                />
                {searchOpen && searchQuery.trim() && (
                  <>
                    <div onClick={() => setSearchOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
                    <div style={{ position: "absolute", top: 40, left: 0, right: 0, background: "white", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", borderRadius: 8, zIndex: 40, maxHeight: 260, overflowY: "auto" }}>
                      {searchResults.length === 0 && (
                        <div style={{ padding: 14, fontSize: 13, color: "#999", textAlign: "center" }}>No matching units.</div>
                      )}
                      {searchResults.map(c => (
                        <div
                          key={c.code}
                          onClick={() => { openUnit(c); setSearchQuery(""); setSearchOpen(false); }}
                          style={{ padding: "10px 14px", fontSize: 13, color: "#333", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}
                        >
                          <strong>{c.code}</strong> — {c.name}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <div style={{ position: "relative", cursor: "pointer", color: "#44485a" }} onClick={toggleNotifications}>
                <NavIcon id="bell" />
                {notifications.some(n => !n.read) && (
                  <span style={{ position: "absolute", top: -5, right: -7, background: "#dc3545", color: "white", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
                {notifOpen && (
                  <>
                    <div onClick={(e) => { e.stopPropagation(); setNotifOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
                    <div style={{ position: "absolute", top: 30, right: 0, background: "white", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", borderRadius: 8, width: 270, zIndex: 40, maxHeight: 320, overflowY: "auto" }}>
                      {notifications.length === 0 && (
                        <div style={{ padding: 16, fontSize: 13, color: "#999", textAlign: "center" }}>No notifications yet.</div>
                      )}
                      {notifications.map(n => (
                        <div key={n.id} style={{ padding: "12px 14px", fontSize: 12, color: "#333", borderBottom: "1px solid #f0f0f0", textAlign: "left" }}>
                          {n.message}
                          <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>{new Date(n.time).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div style={{ position: "relative" }}>
                <div
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#e0e0e0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: "bold", color: "#333", flexShrink: 0 }}>
                    {studentName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ lineHeight: 1.25 }}>
                    <div style={{ fontSize: 13.5, color: "#222", fontWeight: "bold" }}>{studentName}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>Student</div>
                  </div>
                  <span style={{ color: "#999", marginLeft: 2, display: "flex" }}><NavIcon id="chevron-down" /></span>
                </div>

                {profileMenuOpen && (
                  <>
                    <div onClick={() => setProfileMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
                    <div style={{
                      position: "absolute", top: 46, right: 0, background: "white",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.15)", borderRadius: 8,
                      width: 180, zIndex: 40, overflow: "hidden"
                    }}>
                      <div onClick={() => goTo("profile")} style={{ padding: "12px 16px", fontSize: 14, color: "#333", cursor: "pointer", borderBottom: "1px solid #e0e0e0" }}>
                        My Profile
                      </div>
                      <div onClick={logout} style={{ padding: "12px 16px", fontSize: 14, color: "#dc3545", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                        <NavIcon id="logout" /> Log out
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div style={{ flex: 1, minHeight: 0, padding: activeTab === "chat" ? 0 : "28px 32px" }}>

            {activeTab === "chat" && (
              <div style={{ height: "calc(100vh - 70px)", display: "flex", flexDirection: "column" }}>
                <ChatPanel greetingName={studentName.split(" ")[0]} />
              </div>
            )}

            {activeTab === "dashboard" && (
              <>
                <div style={{
                  position: "relative", overflow: "hidden", borderRadius: 18, marginBottom: 28,
                  background: `linear-gradient(135deg, ${NAVY} 0%, ${ACCENT} 100%)`,
                  padding: "32px 34px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 18
                }}>
                  <div style={{ position: "absolute", top: -60, right: -40, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                  <div style={{ position: "absolute", bottom: -70, right: 120, width: 160, height: 160, borderRadius: "50%", background: "rgba(232,160,32,0.15)" }} />
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <div style={{ fontSize: 24, fontWeight: "bold", color: "white" }}>Welcome back, {studentName}! 👋</div>
                    <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 6 }}>{todayFormatted}</div>
                  </div>
                  <button
                    onClick={() => goTo("chat")}
                    className="sa-btn-primary"
                    style={{ position: "relative", zIndex: 1, background: "white", color: NAVY, border: "none", borderRadius: 24, padding: "13px 26px", fontSize: 14, fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}
                  >
                    💬 Ask SmartAssist
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 28 }}>
                  {statCards.map((s, i) => (
                    <div key={i} className="sa-card" style={{ ...cardStyle, padding: "20px 22px", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: s.bg }} />
                      <div style={{ position: "absolute", top: -18, right: -18, width: 76, height: 76, borderRadius: "50%", background: s.bg, opacity: 0.08 }} />
                      <IconBox bg={s.bg}>{s.icon}</IconBox>
                      <div style={{ fontSize: 13, color: "#888", marginTop: 14 }}>{s.label}</div>
                      <div style={{ fontSize: 30, fontWeight: "bold", color: NAVY, marginTop: 2 }}>{s.value}</div>
                      <div onClick={s.onView} style={{ fontSize: 12, color: ACCENT, fontWeight: "bold", marginTop: 10, cursor: "pointer" }}>View all →</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24 }}>
                  <div>
                    <div style={{ ...cardStyle, padding: "22px 24px", marginBottom: 24 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                        <div style={{ fontSize: 16, fontWeight: "bold", color: NAVY }}>My Courses</div>
                        <div onClick={() => goTo("courses")} style={{ fontSize: 12.5, color: ACCENT, fontWeight: "bold", cursor: "pointer" }}>View all</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {courses.map((c, i) => (
                          <div
                            key={i}
                            className="sa-card"
                            onClick={() => openUnit(c)}
                            style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 8px", borderRadius: 8, cursor: "pointer", borderBottom: i < courses.length - 1 ? "1px solid #f0f0f0" : "none" }}
                          >
                            <IconBox bg={c.color} size={42} fontSize={16}>{c.code.slice(0, 2)}</IconBox>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, fontWeight: "bold", color: "#222" }}>{c.code} — {c.name}</div>
                              <div style={{ fontSize: 11.5, color: "#999", marginTop: 2 }}>{c.schedule}</div>
                            </div>
                            <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold", background: "#d4edda", color: "#155724", whiteSpace: "nowrap" }}>
                              In Progress
                            </span>
                            <span style={{ color: "#bbb", fontSize: 16 }}>›</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ ...cardStyle, padding: "22px 24px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                        <div style={{ fontSize: 16, fontWeight: "bold", color: NAVY }}>Upcoming Assessments</div>
                        <div onClick={() => goTo("assessments")} style={{ fontSize: 12.5, color: ACCENT, fontWeight: "bold", cursor: "pointer" }}>View all</div>
                      </div>
                      {allAssessments.length === 0 && (
                        <div style={{ fontSize: 13, color: "#888" }}>No assessments posted yet.</div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {allAssessments.map(a => {
                          const diff = daysUntil(a.dueDate);
                          return (
                            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, paddingBottom: 12, borderBottom: "1px solid #f0f0f0" }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: "bold", color: "#222" }}>{a.title}</div>
                                <div style={{ fontSize: 11.5, color: "#999", marginTop: 2 }}>{a.unitCode}{a.description ? ` — ${a.description}` : ""}</div>
                              </div>
                              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                <div style={{ fontSize: 11.5, fontWeight: "bold", color: diff < 0 ? "#dc3545" : GOLD }}>
                                  {diff >= 0 ? `Due in ${diff} day${diff === 1 ? "" : "s"}` : `Overdue by ${-diff} day${-diff === 1 ? "" : "s"}`}
                                </div>
                                <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{a.dueDate}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === "courses" && !activeUnit && (
              <div>
                <div style={{ fontSize: 22, fontWeight: "bold", color: NAVY, marginBottom: 20 }}>My Courses</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
                  {courses.map((c, i) => (
                    <div
                      key={i}
                      className="sa-card"
                      onClick={() => openUnit(c)}
                      style={{ background: "white", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", cursor: "pointer" }}
                    >
                      <div style={{ height: 90, background: c.color }} />
                      <div style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: "bold", fontSize: 14, color: NAVY }}>{c.code} — {c.name}</div>
                        <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{c.semester}</div>
                        <div style={{ fontSize: 11.5, color: "#999", marginTop: 4 }}>{c.schedule}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "courses" && activeUnit && (
              <div>
                <button
                  onClick={() => setActiveUnit(null)}
                  style={{ marginBottom: 20, background: "none", border: "none", color: NAVY, fontWeight: "bold", cursor: "pointer", fontSize: 14 }}
                >
                  ← Back to My Courses
                </button>
                <div style={{ background: "white", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: 20 }}>
                  <div style={{ height: 120, background: activeUnit.color }} />
                  <div style={{ padding: 24 }}>
                    <div style={{ fontSize: 20, fontWeight: "bold", color: NAVY }}>{activeUnit.code} — {activeUnit.name}</div>
                    <div style={{ fontSize: 13, color: "#888", marginTop: 6 }}>{activeUnit.semester}</div>
                  </div>
                </div>

                <div style={{ fontSize: 16, fontWeight: "bold", color: NAVY, marginBottom: 12 }}>Assessments</div>
                <div style={{ background: "white", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden", marginBottom: 24 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ background: NAVY, color: "white", padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Title</th>
                        <th style={{ background: NAVY, color: "white", padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Due Date</th>
                        <th style={{ background: NAVY, color: "white", padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unitAssessments.length === 0 && (
                        <tr><td colSpan={3} style={{ padding: 14, color: "#888", fontSize: 13 }}>No assessments posted for this unit yet.</td></tr>
                      )}
                      {unitAssessments.map(a => (
                        <tr key={a.id}>
                          <td style={{ padding: "10px 14px", fontSize: 13, borderBottom: "1px solid #f0f0f0" }}>
                            {a.title}
                            {a.description && <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{a.description}</div>}
                          </td>
                          <td style={{ padding: "10px 14px", fontSize: 13, borderBottom: "1px solid #f0f0f0" }}>{a.dueDate}</td>
                          <td style={{ padding: "10px 14px", fontSize: 13, borderBottom: "1px solid #f0f0f0" }}>{a.weight}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "assessments" && (
              <div>
                <div style={{ fontSize: 22, fontWeight: "bold", color: NAVY, marginBottom: 20 }}>Assessments</div>
                <div style={{ background: "white", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ background: NAVY, color: "white", padding: "12px 16px", textAlign: "left", fontSize: 13 }}>Title</th>
                        <th style={{ background: NAVY, color: "white", padding: "12px 16px", textAlign: "left", fontSize: 13 }}>Unit</th>
                        <th style={{ background: NAVY, color: "white", padding: "12px 16px", textAlign: "left", fontSize: 13 }}>Due Date</th>
                        <th style={{ background: NAVY, color: "white", padding: "12px 16px", textAlign: "left", fontSize: 13 }}>Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allAssessments.length === 0 && (
                        <tr><td colSpan={4} style={{ padding: 16, color: "#888", fontSize: 13 }}>No assessments posted yet.</td></tr>
                      )}
                      {allAssessments.map(a => (
                        <tr key={a.id}>
                          <td style={{ padding: "12px 16px", fontSize: 13, borderBottom: "1px solid #f0f0f0" }}>
                            {a.title}
                            {a.description && <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{a.description}</div>}
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 13, borderBottom: "1px solid #f0f0f0" }}>{a.unitCode}</td>
                          <td style={{ padding: "12px 16px", fontSize: 13, borderBottom: "1px solid #f0f0f0" }}>{a.dueDate}</td>
                          <td style={{ padding: "12px 16px", fontSize: 13, borderBottom: "1px solid #f0f0f0" }}>{a.weight}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "attendance" && (
              <div>
                <div style={{ fontSize: 22, fontWeight: "bold", color: NAVY, marginBottom: 8 }}>Attendance</div>
                <div style={{ background: "#eef1fb", border: "1px solid #dbe1f7", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#3b3f5c", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 16 }}>ℹ️</span>
                  <span>This is attendance recorded manually here in SmartAssist, separate from Moodle. For your real, live roll-marked attendance from Moodle, check the{" "}
                    <span onClick={() => goTo("moodle")} style={{ color: ACCENT, fontWeight: "bold", cursor: "pointer" }}>My Moodle</span> tab.
                  </span>
                </div>
                <div style={{ background: "white", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", padding: 20 }}>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
                    <div>
                      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Course/Unit</label>
                      <select value={activeAttendanceUnit} onChange={e => setAttendanceUnitCode(e.target.value)} style={{ padding: 9, border: "1px solid #ccc", borderRadius: 6, fontSize: 13 }}>
                        {myUnitCodes.length === 0 && <option value="">No enrolled units</option>}
                        {myUnitCodes.length > 0 && <option value={ALL_UNITS}>All Units (Whole Semester)</option>}
                        {myUnitCodes.map(code => <option key={code} value={code}>{unitLabel(code)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Semester</label>
                      <select value={activeAttendanceSemester} onChange={e => setAttendanceSemester(e.target.value)} style={{ padding: 9, border: "1px solid #ccc", borderRadius: 6, fontSize: 13 }}>
                        {SEMESTER_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <AttendanceReport
                    unitCode={activeAttendanceUnit}
                    enrolledUnitCodes={myUnitCodes}
                    semester={activeAttendanceSemester}
                    sessions={timetableSessions}
                    records={(myAttendance && myAttendance.records) || []}
                  />
                </div>
              </div>
            )}

            {activeTab === "moodle" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 26, fontWeight: "bold", color: NAVY }}>My Moodle</div>
                    <div style={{ color: "#888", fontSize: 14, marginTop: 5 }}>Your real submission and attendance records, pulled live from Moodle.</div>
                  </div>
                  <button
                    onClick={loadMyMoodleData}
                    disabled={moodleLoading}
                    className="sa-btn-primary"
                    style={{ padding: "12px 24px", background: ACCENT, color: "white", border: "none", borderRadius: 24, fontSize: 14, fontWeight: "bold", cursor: moodleLoading ? "default" : "pointer", opacity: moodleLoading ? 0.6 : 1, whiteSpace: "nowrap" }}
                  >
                    {moodleLoading ? "Loading..." : moodleLoaded ? "↻ Refresh" : "Load my Moodle data"}
                  </button>
                </div>

                {moodleError && (
                  <div style={{ background: "#fdeeee", border: "1px solid #f5c2c2", color: "#a12d2d", borderRadius: 10, padding: "14px 18px", fontSize: 13.5, marginBottom: 24 }}>
                    ⚠ {moodleError}
                  </div>
                )}

                {moodleLoaded && !moodleError && myMoodleSubmissions.length === 0 && myMoodleAttendance.length === 0 && (
                  <div style={{ background: "#fff8e8", border: "1px solid #f3dfa3", color: "#8a6314", borderRadius: 10, padding: "14px 18px", fontSize: 13.5, marginBottom: 24 }}>
                    ⚠ No Moodle records matched <strong>{studentEmail}</strong>. This tab only shows data for the email actually enrolled as a student in Moodle — if your SmartAssist login email is different from your Moodle email, log in with the matching one (or ask your admin to align them) and refresh.
                  </div>
                )}

                {moodleLoaded && !moodleError && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 18, marginBottom: 30 }}>
                    <div className="sa-card" style={{ ...cardStyle, padding: "20px 22px" }}>
                      <div style={{ fontSize: 13, color: "#888" }}>Submissions Tracked</div>
                      <div style={{ fontSize: 32, fontWeight: "bold", color: NAVY, marginTop: 6 }}>{myMoodleSubmissions.length}</div>
                    </div>
                    <div className="sa-card" style={{ ...cardStyle, padding: "20px 22px" }}>
                      <div style={{ fontSize: 13, color: "#888" }}>Submitted</div>
                      <div style={{ fontSize: 32, fontWeight: "bold", color: "#155724", marginTop: 6 }}>
                        {myMoodleSubmissions.filter(s => s.status === "submitted").length}
                      </div>
                    </div>
                    <div className="sa-card" style={{ ...cardStyle, padding: "20px 22px" }}>
                      <div style={{ fontSize: 13, color: "#888" }}>Attendance Records</div>
                      <div style={{ fontSize: 32, fontWeight: "bold", color: NAVY, marginTop: 6 }}>{myMoodleAttendance.length}</div>
                    </div>
                    <div className="sa-card" style={{ ...cardStyle, padding: "20px 22px" }}>
                      <div style={{ fontSize: 13, color: "#888" }}>Present Rate</div>
                      <div style={{ fontSize: 32, fontWeight: "bold", color: ACCENT, marginTop: 6 }}>
                        {myMoodleAttendance.length > 0
                          ? `${Math.round((myMoodleAttendance.filter(r => r.status === "Present").length / myMoodleAttendance.length) * 100)}%`
                          : "—"}
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 18, fontWeight: "bold", color: NAVY, marginBottom: 14 }}>My Assignment Submissions</div>
                {!moodleLoaded && (
                  <div style={{ ...cardStyle, padding: 28, textAlign: "center", color: "#999", fontSize: 14, marginBottom: 32 }}>
                    Click "Load my Moodle data" above to fetch your live submission status.
                  </div>
                )}
                {moodleLoaded && myMoodleSubmissions.length === 0 && !moodleError && (
                  <div style={{ ...cardStyle, padding: 28, textAlign: "center", color: "#999", fontSize: 14, marginBottom: 32 }}>
                    No submission records found for your account.
                  </div>
                )}
                {moodleLoaded && myMoodleSubmissions.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18, marginBottom: 32 }}>
                    {myMoodleSubmissions.map((s, i) => (
                      <div key={i} className="sa-card" style={{ ...cardStyle, padding: "20px 22px" }}>
                        <div style={{ fontSize: 15.5, fontWeight: "bold", color: NAVY, marginBottom: 8 }}>{s.assignment_name}</div>
                        <div style={{ fontSize: 13, color: "#888", marginBottom: 14 }}>Due {s.due_date}</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                          <span style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12.5, fontWeight: "bold", background: s.status === "submitted" ? "#d4edda" : "#fff3cd", color: s.status === "submitted" ? "#155724" : "#a15c00" }}>
                            {s.status}
                          </span>
                          <span style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12.5, fontWeight: "bold", background: "#eef0fe", color: ACCENT }}>
                            {s.grading_status}
                          </span>
                        </div>
                        <div style={{ fontSize: 14, color: "#222" }}>
                          Grade: <strong>{s.grade ?? "Not graded yet"}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: 18, fontWeight: "bold", color: NAVY, marginBottom: 14 }}>My Attendance Records</div>
                {!moodleLoaded && (
                  <div style={{ ...cardStyle, padding: 28, textAlign: "center", color: "#999", fontSize: 14 }}>
                    Click "Load my Moodle data" above to fetch your live attendance marks.
                  </div>
                )}
                {moodleLoaded && myMoodleAttendance.length === 0 && !moodleError && (
                  <div style={{ ...cardStyle, padding: 28, textAlign: "center", color: "#999", fontSize: 14 }}>
                    No attendance records found for your account.
                  </div>
                )}
                {moodleLoaded && myMoodleAttendance.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                    {myMoodleAttendance.map((r, i) => {
                      const statusColors = {
                        Present: { bg: "#d4edda", fg: "#155724" },
                        Late: { bg: "#fff3cd", fg: "#a15c00" },
                        Excused: { bg: "#d1ecf1", fg: "#0c5460" },
                        Absent: { bg: "#f8d7da", fg: "#721c24" },
                      };
                      const colors = statusColors[r.status] || { bg: "#eee", fg: "#555" };
                      return (
                        <div key={i} className="sa-card" style={{ ...cardStyle, padding: "18px 20px" }}>
                          <div style={{ fontSize: 13, color: "#888", marginBottom: 6 }}>Course {r.course_id} · {r.date}</div>
                          <span style={{ padding: "6px 16px", borderRadius: 20, fontSize: 13.5, fontWeight: "bold", background: colors.bg, color: colors.fg }}>
                            {r.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === "profile" && (
              <div>
                <div style={{ fontSize: 22, fontWeight: "bold", color: NAVY, marginBottom: 20 }}>My Profile</div>
                {!myProfile ? (
                  <div style={{ ...cardStyle, padding: 24, fontSize: 13, color: "#888" }}>Loading profile...</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, alignItems: "start" }}>
                    <div>
                      <div style={{
                        position: "relative", overflow: "hidden", borderRadius: 16,
                        background: `linear-gradient(135deg, ${NAVY} 0%, ${ACCENT} 100%)`,
                        padding: "28px 26px", marginBottom: 20, display: "flex", alignItems: "center", gap: 18
                      }}>
                        <div style={{ position: "absolute", top: -50, right: -30, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                        <div style={{ position: "relative", zIndex: 1, width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.18)", border: "2px solid rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: "bold", color: "white", flexShrink: 0 }}>
                          {myProfile.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ position: "relative", zIndex: 1 }}>
                          <div style={{ fontSize: 19, fontWeight: "bold", color: "white" }}>{myProfile.name}</div>
                          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.8)", marginTop: 3 }}>{myProfile.studentId || "—"} · {myProfile.email}</div>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
                        <div className="sa-card" style={{ ...cardStyle, padding: "16px 14px", textAlign: "center" }}>
                          <div style={{ fontSize: 22, fontWeight: "bold", color: NAVY }}>{courses.length}</div>
                          <div style={{ fontSize: 11.5, color: "#888", marginTop: 3 }}>Enrolled Units</div>
                        </div>
                        <div className="sa-card" style={{ ...cardStyle, padding: "16px 14px", textAlign: "center" }}>
                          <div style={{ fontSize: 22, fontWeight: "bold", color: GOLD }}>{allAssessments.length}</div>
                          <div style={{ fontSize: 11.5, color: "#888", marginTop: 3 }}>Assessments Due</div>
                        </div>
                        <div className="sa-card" style={{ ...cardStyle, padding: "16px 14px", textAlign: "center" }}>
                          <div style={{ fontSize: 22, fontWeight: "bold", color: ACCENT }}>{notifications.filter(n => !n.read).length}</div>
                          <div style={{ fontSize: 11.5, color: "#888", marginTop: 3 }}>Unread Alerts</div>
                        </div>
                      </div>

                      <div style={{ ...cardStyle, padding: 26 }}>
                        <div style={{ fontSize: 15, fontWeight: "bold", color: NAVY, marginBottom: 16 }}>Account Details</div>
                        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", rowGap: 14, fontSize: 13.5 }}>
                          <div style={{ color: "#888" }}>Student ID</div>
                          <div style={{ color: "#222" }}>{myProfile.studentId || "—"}</div>
                          <div style={{ color: "#888" }}>Full Name</div>
                          <div style={{ color: "#222" }}>{myProfile.name}</div>
                          <div style={{ color: "#888" }}>Email</div>
                          <div style={{ color: "#222" }}>{myProfile.email}</div>
                          <div style={{ color: "#888" }}>Course/Program</div>
                          <div style={{ color: "#222" }}>Bachelor of Information Technology</div>
                          <div style={{ color: "#888" }}>Enrolled Units</div>
                          <div style={{ color: "#222" }}>
                            {courses.length > 0 ? courses.map(c => `${c.code} — ${c.name}`).join(", ") : "No units enrolled"}
                          </div>
                          <div style={{ color: "#888" }}>Joining Date</div>
                          <div style={{ color: "#222" }}>{myProfile.joiningDate || "—"}</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div style={{ ...cardStyle, padding: 24, marginBottom: 20 }}>
                        <div style={{ fontSize: 15, fontWeight: "bold", color: NAVY, marginBottom: 14 }}>Quick Links</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {[
                            { id: "chat", label: "Ask SmartAssist", icon: "💬" },
                            { id: "moodle", label: "My Moodle (live data)", icon: "🎓" },
                            { id: "attendance", label: "Attendance record", icon: "📅" },
                            { id: "courses", label: "My Courses", icon: "📚" },
                          ].map(link => (
                            <div
                              key={link.id}
                              className="sa-card"
                              onClick={() => goTo(link.id)}
                              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13.5, color: "#333", fontWeight: 600 }}
                            >
                              <span style={{ fontSize: 16 }}>{link.icon}</span>
                              <span style={{ flex: 1 }}>{link.label}</span>
                              <span style={{ color: "#bbb" }}>›</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <ChangePasswordCard studentEmail={studentEmail} />
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {activeTab !== "chat" && (
            <div style={{ borderTop: "1px solid #ebedf1", padding: "16px 32px", textAlign: "center", fontSize: 12, color: "#aaa" }}>
              CIHE SmartAssist · Your AI campus assistant · Data synced live from Moodle
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
