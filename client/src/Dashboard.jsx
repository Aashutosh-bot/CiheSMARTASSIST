import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeUnit, setActiveUnit] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [myAttendance, setMyAttendance] = useState(null);
  const [unitAssessments, setUnitAssessments] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date(2026, 7, 1));
  const navigate = useNavigate();

  const studentName = localStorage.getItem("studentName") || "Student";
  const studentEmail = localStorage.getItem("studentEmail") || "";

  useEffect(() => {
    if (localStorage.getItem("loggedIn") !== "true") {
      navigate("/");
      return;
    }
    fetch("/api/dashboard").then(res => res.json()).then(setData).catch(() => setData(null));
    if (studentEmail) {
      fetch(`/api/notifications?email=${encodeURIComponent(studentEmail)}`).then(r => r.json()).then(setNotifications).catch(() => {});
      fetch(`/api/attendance/student/${encodeURIComponent(studentEmail)}`).then(r => r.json()).then(setMyAttendance).catch(() => {});
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

  function askTopic(question) {
    navigate("/chatbot", { state: { presetQuestion: question } });
  }

  function openUnit(c) {
    setActiveUnit(c);
    fetch(`/api/assessments?unitCode=${encodeURIComponent(c.code)}`).then(r => r.json()).then(setUnitAssessments).catch(() => setUnitAssessments([]));
  }

  const topics = [
    { icon: "📚", label: "Enrollment", question: "What are the BIT entry requirements?" },
    { icon: "💳", label: "Fees & Payment", question: "How do I pay my tuition fees?" },
    { icon: "📅", label: "Timetable", question: "What are the semester dates?" },
    { icon: "📝", label: "Assessments", question: "What assessments are due?" },
    { icon: "📖", label: "Library", question: "Where is the library?" }
  ];

  const navItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "calendar", label: "Academic Calendar" },
    { id: "course", label: "My Course" }
  ];

  const courses = [
    { code: "ICT307", name: "AI-Based Systems Development", color: "#0f2a52", semester: "Semester 2, 2026" },
    { code: "ICT301", name: "Information Technology Project Management", color: "#1c6fd6", semester: "Semester 2, 2026" },
    { code: "ICT305", name: "Topics in IT", color: "#e8a020", semester: "Semester 2, 2026" },
    { code: "ICT210", name: "Big Data for Software Development", color: "#6c757d", semester: "Semester 2, 2026" }
  ];

  const calendarEvents = {
    "2026-08-01": ["Quiz 5 - Week 7 | Data mining"],
    "2026-08-02": ["Quiz 1 - Week 2 | AI-ML closes"],
    "2026-08-03": ["Quiz 2 - Week 3 | DL opens"],
    "2026-08-09": ["Quiz 2 - Week 3 | DL closes"],
    "2026-08-10": ["Quiz 3 - Week 4 | RL opens"],
    "2026-08-16": ["Quiz 3 - Week 4 | RL closes"],
    "2026-08-17": ["Lab Exercise 1 | Week 5 opens"],
    "2026-08-23": ["Lab Exercise 1 | Week 5 closes", "Assessment 1: Project Initiation"],
    "2026-08-30": ["ICT308 Assessment 1 Submission", "ICT308 Assessment 1 Support"]
  };

  const cardStyle = { background: "white", borderRadius: 8, padding: "18px 22px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", borderLeft: "4px solid #0f2a52" };

  function renderCalendarGrid() {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = calendarMonth.toLocaleString("default", { month: "long", year: "numeric" });

    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const todayStr = new Date().toISOString().slice(0, 10);

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <button onClick={() => setCalendarMonth(new Date(year, month - 1, 1))} style={{ background: "none", border: "none", color: "#e8a020", fontWeight: "bold", cursor: "pointer", fontSize: 14 }}>◀ Prev</button>
          <div style={{ fontSize: 18, fontWeight: "bold", color: "#0f2a52" }}>{monthName}</div>
          <button onClick={() => setCalendarMonth(new Date(year, month + 1, 1))} style={{ background: "none", border: "none", color: "#e8a020", fontWeight: "bold", cursor: "pointer", fontSize: 14 }}>Next ▶</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: "#e0e0e0", border: "1px solid #e0e0e0" }}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
            <div key={d} style={{ background: "#f7f7f7", padding: "8px 6px", fontSize: 12, fontWeight: "bold", color: "#555" }}>{d}</div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={i} style={{ background: "white", minHeight: 80 }} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const events = calendarEvents[dateStr] || [];
            const isToday = dateStr === todayStr;
            return (
              <div key={i} style={{ background: "white", minHeight: 80, padding: 6 }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 22, height: 22, borderRadius: "50%",
                  background: isToday ? "#0f2a52" : "transparent",
                  color: isToday ? "white" : (events.length ? "#e8a020" : "#333"),
                  fontSize: 12, fontWeight: "bold", marginBottom: 4
                }}>
                  {d}
                </div>
                {events.map((e, j) => (
                  <div key={j} style={{ fontSize: 10, color: "#555", lineHeight: 1.3, marginBottom: 2 }}>{e}</div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#f0f2f5", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* TOP NAVBAR */}
      <div style={{ background: "white", borderBottom: "1px solid #e0e0e0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, background: "#0f2a52", color: "white", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold" }}>
              CIHE
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
            <div style={{ position: "relative", cursor: "pointer" }} onClick={toggleNotifications}>
              <span style={{ fontSize: 18 }}>🔔</span>
              {notifications.some(n => !n.read) && (
                <span style={{ position: "absolute", top: -4, right: -4, background: "#dc3545", color: "white", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
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

            <div
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
            >
              <span style={{ fontSize: 14, color: "#333" }}>{studentName}</span>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#e0e0e0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: "bold", color: "#333" }}>
                {studentName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
            </div>

            {profileMenuOpen && (
              <>
                <div onClick={() => setProfileMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
                <div style={{
                  position: "absolute", top: 44, right: 0, background: "white",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.15)", borderRadius: 8,
                  width: 180, zIndex: 40, overflow: "hidden"
                }}>
                  {["Profile", "Grades", "Private files", "Reports"].map((item, i) => (
                    <div
                      key={i}
                      onClick={() => setProfileMenuOpen(false)}
                      style={{ padding: "12px 16px", fontSize: 14, color: "#333", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}
                    >
                      {item}
                    </div>
                  ))}
                  <div
                    onClick={() => { setActiveTab("calendar"); setActiveUnit(null); setProfileMenuOpen(false); }}
                    style={{ padding: "12px 16px", fontSize: 14, color: "#333", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}
                  >
                    Calendar
                  </div>
                  <div
                    onClick={() => setProfileMenuOpen(false)}
                    style={{ padding: "12px 16px", fontSize: 14, color: "#333", cursor: "pointer", borderBottom: "1px solid #e0e0e0" }}
                  >
                    Preferences
                  </div>
                  <div
                    onClick={logout}
                    style={{ padding: "12px 16px", fontSize: 14, color: "#dc3545", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    ⏻ Log out
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ background: "#0f2a52", padding: "0 24px", display: "flex", justifyContent: "center", gap: 4 }}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setActiveUnit(null); }}
              style={{
                background: "transparent", border: "none", color: "white", padding: "12px 20px",
                fontSize: 13, cursor: "pointer",
                borderBottom: activeTab === item.id ? "3px solid #e8a020" : "3px solid transparent",
                fontWeight: activeTab === item.id ? "bold" : "normal"
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, padding: "30px 30px", maxWidth: 1000, margin: "0 auto", width: "100%" }}>

        {activeTab === "dashboard" && data && (
          <>
            <div style={{ fontSize: 22, fontWeight: "bold", color: "#0f2a52" }}>Good morning, {studentName} 👋</div>
            <div style={{ color: "#888", fontSize: 14, marginBottom: 30 }}>Here is your helpdesk overview for today.</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20, marginBottom: 30 }}>
              <div style={cardStyle}>
                <div style={{ fontSize: 32, fontWeight: "bold", color: "#0f2a52" }}>{data.totalQueries}</div>
                <div style={{ fontSize: 13, color: "#888" }}>Total Queries</div>
              </div>
              <div style={{ ...cardStyle, borderLeftColor: "#e8a020" }}>
                <div style={{ fontSize: 32, fontWeight: "bold", color: "#e8a020" }}>{data.avgResponseTime}</div>
                <div style={{ fontSize: 13, color: "#888" }}>Avg Response Time</div>
              </div>
              <div style={{ ...cardStyle, borderLeftColor: "#28a745" }}>
                <div style={{ fontSize: 32, fontWeight: "bold", color: "#28a745" }}>{myAttendance ? myAttendance.rate + "%" : "—"}</div>
                <div style={{ fontSize: 13, color: "#888" }}>My Attendance</div>
              </div>
              <div style={{ ...cardStyle, borderLeftColor: "#dc3545" }}>
                <div style={{ fontSize: 32, fontWeight: "bold", color: "#dc3545" }}>{data.documentsIndexed}</div>
                <div style={{ fontSize: 13, color: "#888" }}>Documents Indexed</div>
              </div>
            </div>

            <div style={{ fontSize: 17, fontWeight: "bold", color: "#0f2a52", marginBottom: 15 }}>Quick Ask Topics</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 20, marginBottom: 30 }}>
              {topics.map((t, i) => (
                <button key={i} onClick={() => askTopic(t.question)} style={{ background: "white", border: "1px solid #ddd", borderRadius: 8, padding: "20px 25px", fontSize: 14, cursor: "pointer", textAlign: "center", color: "#333", fontWeight: "bold", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{t.icon}</div>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 17, fontWeight: "bold", color: "#0f2a52", marginBottom: 15 }}>Recent Queries</div>
            <div style={{ background: "white", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ background: "#0f2a52", color: "white", padding: "12px 16px", textAlign: "left", fontSize: 13 }}>Question</th>
                    <th style={{ background: "#0f2a52", color: "white", padding: "12px 16px", textAlign: "left", fontSize: 13 }}>Time</th>
                    <th style={{ background: "#0f2a52", color: "white", padding: "12px 16px", textAlign: "left", fontSize: 13 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentQueries.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: 16, color: "#888", fontSize: 13 }}>No queries yet — try the chatbot!</td></tr>
                  )}
                  {data.recentQueries.map((q, i) => (
                    <tr key={i}>
                      <td style={{ padding: "12px 16px", fontSize: 13, borderBottom: "1px solid #f0f0f0" }}>{q.question}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, borderBottom: "1px solid #f0f0f0" }}>{new Date(q.time).toLocaleTimeString()}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, borderBottom: "1px solid #f0f0f0" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: "bold", background: q.status === "Answered" ? "#d4edda" : "#fff3cd", color: q.status === "Answered" ? "#155724" : "#856404" }}>
                          {q.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === "dashboard" && !data && <div>Loading dashboard...</div>}

        {activeTab === "course" && !activeUnit && (
          <div>
            <div style={{ fontSize: 22, fontWeight: "bold", color: "#0f2a52", marginBottom: 20 }}>My Course</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
              {courses.map((c, i) => (
                <div
                  key={i}
                  onClick={() => openUnit(c)}
                  style={{ background: "white", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", cursor: "pointer" }}
                >
                  <div style={{ height: 90, background: c.color }} />
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: "bold", fontSize: 14, color: "#0f2a52" }}>{c.code} — {c.name}</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{c.semester}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "course" && activeUnit && (
          <div>
            <button
              onClick={() => setActiveUnit(null)}
              style={{ marginBottom: 20, background: "none", border: "none", color: "#0f2a52", fontWeight: "bold", cursor: "pointer", fontSize: 14 }}
            >
              ← Back to My Course
            </button>
            <div style={{ background: "white", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: 20 }}>
              <div style={{ height: 120, background: activeUnit.color }} />
              <div style={{ padding: 24 }}>
                <div style={{ fontSize: 20, fontWeight: "bold", color: "#0f2a52" }}>{activeUnit.code} — {activeUnit.name}</div>
                <div style={{ fontSize: 13, color: "#888", marginTop: 6 }}>{activeUnit.semester}</div>
              </div>
            </div>

            <div style={{ fontSize: 16, fontWeight: "bold", color: "#0f2a52", marginBottom: 12 }}>Assessments</div>
            <div style={{ background: "white", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden", marginBottom: 24 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ background: "#0f2a52", color: "white", padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Title</th>
                    <th style={{ background: "#0f2a52", color: "white", padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Due Date</th>
                    <th style={{ background: "#0f2a52", color: "white", padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Weight</th>
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

            <div style={{ fontSize: 16, fontWeight: "bold", color: "#0f2a52", marginBottom: 12 }}>My Attendance</div>
            <div style={{ background: "white", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", padding: 20 }}>
              {myAttendance && myAttendance.total > 0 ? (
                <>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: myAttendance.rate >= 80 ? "#28a745" : "#dc3545", marginBottom: 6 }}>
                    {myAttendance.rate}% attendance
                  </div>
                  <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>
                    {myAttendance.presentCount} present out of {myAttendance.total} recorded sessions
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", fontSize: 12, color: "#888", padding: "6px 0" }}>Date</th>
                        <th style={{ textAlign: "left", fontSize: 12, color: "#888", padding: "6px 0" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myAttendance.records.map(r => (
                        <tr key={r.id}>
                          <td style={{ padding: "6px 0", fontSize: 13 }}>{r.date}</td>
                          <td style={{ padding: "6px 0", fontSize: 13 }}>
                            <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: "bold", background: r.status === "Present" ? "#d4edda" : "#f8d7da", color: r.status === "Present" ? "#155724" : "#721c24" }}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "#888" }}>No attendance records yet.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "calendar" && (
          <div>
            <div style={{ fontSize: 22, fontWeight: "bold", color: "#0f2a52", marginBottom: 20 }}>Calendar</div>
            <div style={{ background: "white", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", padding: 20 }}>
              {renderCalendarGrid()}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ background: "#e8a020", padding: "24px 30px", color: "#0f2a52", marginTop: 20 }}>
        <div style={{ display: "flex", gap: 24, fontSize: 13, fontWeight: "bold", marginBottom: 10, flexWrap: "wrap" }}>
          <span>🔖 https://www.cihe.edu.au</span>
          <span>✉️ info@cihe.edu.au</span>
          <span>📱 1300 171 094</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: "bold" }}>© 2018–2026 CIHE Australia</div>
      </div>

      {/* FLOATING CHATBOT BUTTON */}
      <button
        onClick={() => navigate("/chatbot")}
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 30,
          width: 58, height: 58, borderRadius: "50%", border: "none",
          background: "#e8a020", color: "white", fontSize: 26,
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