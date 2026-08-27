import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Footer from "./Footer";
import AttendanceReport from "./AttendanceReport";
import { WEEKDAYS, SEMESTER_START, SEMESTER_END, buildWeeks, addDays, formatWeekRange, formatDMY, todayStr, termLabel, weekdayIndex } from "./scheduleUtils";

const NAVY = "#0f2a52";
const NAVY_LIGHT = "#1c3f6e";
const GOLD = "#e8a020";

const sidebarNavItems = [
  { id: "dashboard", label: "Dashboard", icon: "🏠" },
  { id: "profile", label: "My Profile", icon: "👤" },
  { id: "courses", label: "My Courses", icon: "📚" },
  { id: "assessments", label: "Assessments", icon: "📝" },
  { id: "timetable", label: "Timetable", icon: "📅" },
  { id: "attendance", label: "Attendance", icon: "✅" }
];

function IconBox({ bg, size = 48, fontSize = 22, children }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize, flexShrink: 0 }}>
      {children}
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
  const [activeTab, setActiveTab] = useState("dashboard");
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
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedWeekStart, setSelectedWeekStart] = useState("");
  const [attendanceUnitCode, setAttendanceUnitCode] = useState("");
  const [attendanceSemester, setAttendanceSemester] = useState("");
  const [attendanceTerm, setAttendanceTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
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
    "ICT301": { color: "#1c6fd6", schedule: "Tue 1 PM - 3 PM" },
    "ICT305": { color: GOLD, schedule: "Wed 9 AM - 11 AM" },
    "ICT210": { color: "#6c757d", schedule: "Thu 2 PM - 4 PM" }
  };
  const decorationPalette = [NAVY, "#1c6fd6", GOLD, "#6c757d"];
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

  const semesters = Array.from(new Set(allUnits.map(u => u.semester).filter(Boolean)));
  const activeSemester = selectedSemester || semesters[0] || "Semester 2, 2026";
  const weekOptions = buildWeeks(SEMESTER_START, SEMESTER_END);
  const activeWeek = weekOptions.find(w => w.start === selectedWeekStart) || weekOptions[0];

  const activeAttendanceUnit = attendanceUnitCode || myUnitCodes[0] || "";
  const activeAttendanceSemester = attendanceSemester || semesters[0] || "Semester 2, 2026";
  const attendanceTerms = weekOptions.map((w, i) => termLabel(i));
  const uniqueAttendanceTerms = Array.from(new Set(attendanceTerms));
  const today = todayStr();
  const currentWeekIdx = weekOptions.findIndex(w => today >= w.start && today <= w.end);
  const defaultAttendanceTerm = termLabel(currentWeekIdx >= 0 ? currentWeekIdx : 0);
  const activeAttendanceTerm = attendanceTerm || defaultAttendanceTerm;

  function unitLabel(code) {
    const u = allUnits.find(x => x.code === code);
    return u ? `${u.code} — ${u.name}` : code;
  }

  function renderWeeklyTimetable() {
    if (!activeWeek) return <div style={{ fontSize: 13, color: "#888" }}>No weeks available.</div>;
    return (
      <div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Semester</label>
            <select value={activeSemester} onChange={e => setSelectedSemester(e.target.value)} style={{ padding: 9, border: "1px solid #ccc", borderRadius: 6, fontSize: 13 }}>
              {(semesters.length ? semesters : [activeSemester]).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Week</label>
            <select value={activeWeek.start} onChange={e => setSelectedWeekStart(e.target.value)} style={{ padding: 9, border: "1px solid #ccc", borderRadius: 6, fontSize: 13 }}>
              {weekOptions.map(w => <option key={w.start} value={w.start}>{formatWeekRange(w)}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12 }}>
          {WEEKDAYS.map((wd, idx) => {
            const dateStr = addDays(activeWeek.start, idx);
            const daySessions = timetableSessions.filter(t =>
              t.dayOfWeek === wd && myUnitCodes.includes(t.unitCode) && t.semester === activeSemester
            );
            return (
              <div key={wd} style={{ minWidth: 0 }}>
                <div style={{ background: NAVY, color: "white", fontWeight: "bold", fontSize: 12, textAlign: "center", padding: "8px 4px", borderRadius: "6px 6px 0 0" }}>
                  {wd}
                  <div style={{ fontWeight: "normal", fontSize: 10, color: "#cbd5e1" }}>{formatDMY(dateStr)}</div>
                </div>
                <div style={{ background: "white", border: "1px solid #e0e0e0", borderTop: "none", borderRadius: "0 0 6px 6px", minHeight: 120, padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  {daySessions.length === 0 && (
                    <div style={{ fontSize: 12, color: "#aaa", textAlign: "center", marginTop: 20 }}>NC</div>
                  )}
                  {daySessions.map(s => (
                    <div key={s.id} style={{ background: "#f5f7fa", borderRadius: 6, padding: 8, fontSize: 11, lineHeight: 1.5 }}>
                      <div style={{ fontWeight: "bold", color: NAVY }}>{unitLabel(s.unitCode)}</div>
                      <div>👤 {s.teacher || "TBA"}</div>
                      <div>🏷️ {s.mode || "—"}</div>
                      <div>🏫 {s.room || "—"}{s.location ? `, ${s.location}` : ""}</div>
                      <div>🕐 {s.startTime} - {s.endTime}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const cardStyle = { background: "white", borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.07)" };

  let upcomingClassesCount = 0;
  for (let i = 0; i < 7; i++) {
    const dateStr = addDays(today, i);
    if (dateStr > SEMESTER_END) break;
    const wd = WEEKDAYS[weekdayIndex(dateStr)];
    upcomingClassesCount += timetableSessions.filter(t => myUnitCodes.includes(t.unitCode) && t.dayOfWeek === wd).length;
  }

  const statCards = [
    { label: "Enrolled Courses", value: courses.length, icon: "📚", bg: NAVY, onView: () => goTo("courses") },
    { label: "Assessments Due", value: allAssessments.length, icon: "📝", bg: GOLD, onView: () => goTo("assessments") },
    { label: "Upcoming Classes", value: upcomingClassesCount, icon: "🗓️", bg: "#1c6fd6", onView: () => goTo("timetable") }
  ];

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#f0f2f5", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flex: 1, alignItems: "stretch" }}>

        {/* LEFT SIDEBAR */}
        <div style={{
          width: sidebarOpen ? 250 : 0, flexShrink: 0, overflow: "hidden",
          position: "sticky", top: 0, alignSelf: "flex-start", height: "100vh",
          transition: "width 0.25s ease"
        }}>
          <div style={{
            width: 250, height: "100%", background: NAVY, color: "white",
            display: "flex", flexDirection: "column", overflowY: "auto"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "22px 20px", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
              <div style={{
                width: 42, height: 42, borderRadius: "50%", border: `2px solid ${GOLD}`,
                display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, fontSize: 18, flexShrink: 0
              }}>
                👑
              </div>
              <div style={{ fontSize: 12, fontWeight: "bold", letterSpacing: 0.5, lineHeight: 1.35 }}>
                CROWN INSTITUTE OF HIGHER EDUCATION
              </div>
            </div>

            <div style={{ flex: 1, padding: "12px 0" }}>
              {sidebarNavItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => goTo(item.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 20px",
                    cursor: "pointer", fontSize: 13.5,
                    background: activeTab === item.id ? NAVY_LIGHT : "transparent",
                    borderLeft: activeTab === item.id ? `3px solid ${GOLD}` : "3px solid transparent",
                    color: activeTab === item.id ? "white" : "#cbd5e1",
                    fontWeight: activeTab === item.id ? "bold" : "normal"
                  }}
                >
                  <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{item.icon}</span>
                  {item.label}
                </div>
              ))}
            </div>

            <div
              onClick={logout}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "16px 20px",
                cursor: "pointer", fontSize: 13.5, color: "#f5b3b3",
                borderTop: "1px solid rgba(255,255,255,0.12)"
              }}
            >
              <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>⏻</span>
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
                ☰
              </button>
              <div style={{ position: "relative", maxWidth: 360, width: "100%" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#999" }}>🔍</span>
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
              <div style={{ position: "relative", cursor: "pointer" }} onClick={toggleNotifications}>
                <span style={{ fontSize: 19 }}>🔔</span>
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
                  <span style={{ fontSize: 10, color: "#999", marginLeft: 2 }}>▾</span>
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
                      <div onClick={logout} style={{ padding: "12px 16px", fontSize: 14, color: "#dc3545", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                        ⏻ Log out
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div style={{ flex: 1, padding: "28px 32px" }}>

            {activeTab === "dashboard" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 26, flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: "bold", color: NAVY }}>Welcome back, {studentName}! 👋</div>
                    <div style={{ color: "#888", fontSize: 14, marginTop: 4 }}>Here's what's happening with your course.</div>
                  </div>
                  <div style={{ fontSize: 13, color: "#888", whiteSpace: "nowrap", marginTop: 4 }}>{todayFormatted}</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 28 }}>
                  {statCards.map((s, i) => (
                    <div key={i} style={{ ...cardStyle, padding: "20px 22px" }}>
                      <IconBox bg={s.bg}>{s.icon}</IconBox>
                      <div style={{ fontSize: 13, color: "#888", marginTop: 14 }}>{s.label}</div>
                      <div style={{ fontSize: 30, fontWeight: "bold", color: NAVY, marginTop: 2 }}>{s.value}</div>
                      <div onClick={s.onView} style={{ fontSize: 12, color: "#1c6fd6", fontWeight: "bold", marginTop: 10, cursor: "pointer" }}>View all →</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24 }}>
                  <div>
                    <div style={{ ...cardStyle, padding: "22px 24px", marginBottom: 24 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                        <div style={{ fontSize: 16, fontWeight: "bold", color: NAVY }}>My Courses</div>
                        <div onClick={() => goTo("courses")} style={{ fontSize: 12.5, color: "#1c6fd6", fontWeight: "bold", cursor: "pointer" }}>View all</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {courses.map((c, i) => (
                          <div
                            key={i}
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
                        <div onClick={() => goTo("assessments")} style={{ fontSize: 12.5, color: "#1c6fd6", fontWeight: "bold", cursor: "pointer" }}>View all</div>
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

            {activeTab === "timetable" && (
              <div>
                <div style={{ fontSize: 22, fontWeight: "bold", color: NAVY, marginBottom: 20 }}>Timetable</div>
                <div style={{ background: "white", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", padding: 20 }}>
                  {renderWeeklyTimetable()}
                </div>
              </div>
            )}

            {activeTab === "attendance" && (
              <div>
                <div style={{ fontSize: 22, fontWeight: "bold", color: NAVY, marginBottom: 20 }}>Attendance</div>
                <div style={{ background: "white", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", padding: 20 }}>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
                    <div>
                      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Course/Unit</label>
                      <select value={activeAttendanceUnit} onChange={e => setAttendanceUnitCode(e.target.value)} style={{ padding: 9, border: "1px solid #ccc", borderRadius: 6, fontSize: 13 }}>
                        {myUnitCodes.length === 0 && <option value="">No enrolled units</option>}
                        {myUnitCodes.map(code => <option key={code} value={code}>{unitLabel(code)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Semester</label>
                      <select value={activeAttendanceSemester} onChange={e => setAttendanceSemester(e.target.value)} style={{ padding: 9, border: "1px solid #ccc", borderRadius: 6, fontSize: 13 }}>
                        {(semesters.length ? semesters : [activeAttendanceSemester]).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Term</label>
                      <select value={activeAttendanceTerm} onChange={e => setAttendanceTerm(e.target.value)} style={{ padding: 9, border: "1px solid #ccc", borderRadius: 6, fontSize: 13 }}>
                        {uniqueAttendanceTerms.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <AttendanceReport
                    unitCode={activeAttendanceUnit}
                    semester={activeAttendanceSemester}
                    term={activeAttendanceTerm}
                    sessions={timetableSessions}
                    records={(myAttendance && myAttendance.records) || []}
                  />
                </div>
              </div>
            )}

            {activeTab === "profile" && (
              <div>
                <div style={{ fontSize: 22, fontWeight: "bold", color: NAVY, marginBottom: 20 }}>My Profile</div>
                {!myProfile ? (
                  <div style={{ ...cardStyle, padding: 24, fontSize: 13, color: "#888" }}>Loading profile...</div>
                ) : (
                  <div style={{ ...cardStyle, padding: 28, maxWidth: 560 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e0e0e0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: "bold", color: "#333", flexShrink: 0 }}>
                        {myProfile.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: "bold", color: NAVY }}>{myProfile.name}</div>
                        <div style={{ fontSize: 12.5, color: "#888" }}>{myProfile.studentId || "—"}</div>
                      </div>
                    </div>
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
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      <Footer />

      {/* FLOATING CHATBOT BUTTON */}
      <button
        onClick={() => navigate("/chatbot")}
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 30,
          width: 58, height: 58, borderRadius: "50%", border: "none",
          background: GOLD, color: "white", fontSize: 26,
          boxShadow: "0 4px 12px rgba(0,0,0,0.25)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}
        title="Open chatbot"
      >
        💬
      </button>
    </div>
  );
}

export default Dashboard;
