import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import WeeklyAttendanceTable from "./WeeklyAttendanceTable";
import { WEEKDAYS, SEMESTER_OPTIONS, DEFAULT_SEMESTER, SEMESTERS, TEACHING_WEEKS, ALL_UNITS, buildWeeks, addDays, formatDMY, todayStr } from "./scheduleUtils";

const SESSION_MODES = ["Lecture", "Workshop", "Lab", "Tutorial", "Seminar"];

// Click-to-toggle unit picker — replaces the native multi-select (which needs an
// unintuitive ctrl/cmd-click to pick more than one option, the #1 cause of
// "I can't add a subject to a student" confusion).
function UnitTogglePicker({ units, selected, onChange, compact }) {
  function toggle(code) {
    if (selected.includes(code)) onChange(selected.filter(c => c !== code));
    else onChange([...selected, code]);
  }
  if (units.length === 0) {
    return <div style={{ fontSize: 12, color: "#999", fontStyle: "italic" }}>No units yet — add one in Manage Units first.</div>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxWidth: compact ? 220 : 420 }}>
      {units.map(u => {
        const active = selected.includes(u.code);
        return (
          <button
            type="button"
            key={u.code}
            onClick={() => toggle(u.code)}
            title={u.name}
            style={{
              padding: compact ? "4px 9px" : "6px 12px",
              borderRadius: 16,
              border: active ? "1px solid #1c2b3a" : "1px solid #d4d7de",
              background: active ? "#1c2b3a" : "white",
              color: active ? "white" : "#444",
              fontSize: compact ? 11 : 12.5,
              fontWeight: active ? "bold" : "normal",
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            {active ? "✓ " : "+ "}{u.code}
          </button>
        );
      })}
    </div>
  );
}

function AdminDashboard() {
  const [units, setUnits] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [timetableSessions, setTimetableSessions] = useState([]);
  const [activeTab, setActiveTab] = useState("insights");
  const [newUnit, setNewUnit] = useState({ code: "", name: "", semester: DEFAULT_SEMESTER, totalSeats: "" });
  const [newStudent, setNewStudent] = useState({ name: "", email: "", studentId: "", joiningDate: "", unitCodes: [] });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", studentId: "", joiningDate: "", unitCodes: [] });
  const [newAttendance, setNewAttendance] = useState({ studentId: "", unitCode: "", date: "", status: "Present" });
  const [newAssessment, setNewAssessment] = useState({ unitCode: "", title: "", dueDate: "", weight: "", description: "" });
  const [newSession, setNewSession] = useState({ unitCode: "", dayOfWeek: "Mon", startTime: "", endTime: "", teacher: "", room: "", mode: "Lecture", location: "", semester: DEFAULT_SEMESTER });
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editSessionForm, setEditSessionForm] = useState(null);
  const [weeklyStudentId, setWeeklyStudentId] = useState("");
  const [weeklyUnitCode, setWeeklyUnitCode] = useState("");
  const [moodleAssignments, setMoodleAssignments] = useState([]);
  const [moodleStudents, setMoodleStudents] = useState([]);
  const [moodleSubmissions, setMoodleSubmissions] = useState([]);
  const [moodleSubmissionsLoaded, setMoodleSubmissionsLoaded] = useState(false);
  const [moodleSubmissionsLoading, setMoodleSubmissionsLoading] = useState(false);
  const [moodleAttendanceRecords, setMoodleAttendanceRecords] = useState([]);
  const [moodleAttendanceRecordsLoaded, setMoodleAttendanceRecordsLoaded] = useState(false);
  const [moodleAttendanceRecordsLoading, setMoodleAttendanceRecordsLoading] = useState(false);
  const [chatInsights, setChatInsights] = useState(null);
  const [syncingMoodleStudents, setSyncingMoodleStudents] = useState(false);
  const [moodleSyncResult, setMoodleSyncResult] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem("loggedIn") !== "true" || localStorage.getItem("role") !== "admin") {
      navigate("/");
      return;
    }
    loadData();
  }, [navigate]);

  useEffect(() => {
    if (activeTab === "overview" && !moodleAttendanceRecordsLoaded && !moodleAttendanceRecordsLoading) {
      loadMoodleAttendanceRecords();
    }
  }, [activeTab]);

  function loadData() {
    fetch("/api/units").then(r => r.json()).then(setUnits);
    fetch("/api/students").then(r => r.json()).then(setStudents);
    fetch("/api/attendance").then(r => r.json()).then(setAttendance);
    fetch("/api/assessments").then(r => r.json()).then(setAssessments);
    fetch("/api/timetable").then(r => r.json()).then(setTimetableSessions);
    fetch("/api/moodle/assignments").then(r => r.json()).then(setMoodleAssignments);
    fetch("/api/moodle/students").then(r => r.json()).then(setMoodleStudents);
    fetch("/api/chat-insights").then(r => r.json()).then(setChatInsights).catch(() => setChatInsights(null));
  }

  function loadMoodleSubmissions() {
    setMoodleSubmissionsLoading(true);
    fetch("/api/moodle/submissions")
      .then(r => r.json())
      .then(data => { setMoodleSubmissions(data); setMoodleSubmissionsLoaded(true); })
      .finally(() => setMoodleSubmissionsLoading(false));
  }

  function loadMoodleAttendanceRecords() {
    setMoodleAttendanceRecordsLoading(true);
    fetch("/api/moodle/attendance-records")
      .then(r => r.json())
      .then(data => { setMoodleAttendanceRecords(data); setMoodleAttendanceRecordsLoaded(true); })
      .finally(() => setMoodleAttendanceRecordsLoading(false));
  }

  function moodleStudentName(studentId) {
    const s = moodleStudents.find(s => s.student_id === studentId);
    return s ? s.name : `User #${studentId}`;
  }

  function logout() {
    fetch("/api/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("loggedIn");
    localStorage.removeItem("role");
    navigate("/");
  }

  async function addUnit() {
    if (!newUnit.code || !newUnit.name) return;
    await fetch("/api/units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUnit)
    });
    setNewUnit({ code: "", name: "", semester: DEFAULT_SEMESTER, totalSeats: "" });
    loadData();
  }

  async function deleteUnit(code) {
    await fetch(`/api/units/${code}`, { method: "DELETE" });
    loadData();
  }

  async function addStudent() {
    if (!newStudent.name || !newStudent.email) return;
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newStudent)
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message);
      return;
    }
    setNewStudent({ name: "", email: "", studentId: "", joiningDate: "", unitCodes: [] });
    // Security: the student claims their account with this one-time code (shown once, valid 7 days).
    alert(`Activation code for ${data.studentEmail}:\n\n${data.activationCode}\n\nGive this to the student. It is shown only once.`);
    loadData();
  }

  async function issueActivation(id, email) {
    if (!window.confirm(`Issue a new activation code for ${email}? This resets their password and 2FA.`)) return;
    const res = await fetch(`/api/students/${id}/activation`, { method: "POST" });
    const data = await res.json();
    if (!data.success) { alert(data.message); return; }
    alert(`New activation code for ${data.studentEmail}:\n\n${data.activationCode}\n\nShown only once.`);
    loadData();
  }

  async function deleteStudent(id) {
    await fetch(`/api/students/${id}`, { method: "DELETE" });
    loadData();
  }

  async function syncStudentsFromMoodle() {
    setSyncingMoodleStudents(true);
    setMoodleSyncResult(null);
    try {
      const res = await fetch("/api/moodle/students");
      const moodleList = await res.json();
      // Dedupe by email — a student enrolled in several Moodle courses appears once per course.
      const byEmail = new Map();
      moodleList.forEach(m => { if (m.email && !byEmail.has(m.email)) byEmail.set(m.email, m); });

      const existingEmails = new Set(students.map(s => s.email));
      const toCreate = [...byEmail.values()].filter(m => !existingEmails.has(m.email));

      let created = 0;
      for (const m of toCreate) {
        const res = await fetch("/api/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: m.name, email: m.email, unitCodes: [] })
        });
        const data = await res.json();
        if (data.success) created++;
      }
      setMoodleSyncResult({ ok: true, message: `Synced ${created} new student${created === 1 ? "" : "s"} from Moodle (${byEmail.size} total enrolled, ${byEmail.size - created} already existed). Assign units to them below.` });
      loadData();
    } catch (err) {
      setMoodleSyncResult({ ok: false, message: `Couldn't reach Moodle: ${err.message}` });
    } finally {
      setSyncingMoodleStudents(false);
    }
  }

  function startEdit(student) {
    setEditingId(student.id);
    setEditForm({
      name: student.name,
      email: student.email,
      studentId: student.studentId || "",
      joiningDate: student.joiningDate || "",
      unitCodes: student.unitCodes || []
    });
  }

  async function saveEdit(id) {
    await fetch(`/api/students/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm)
    });
    setEditingId(null);
    loadData();
  }

  async function addAttendance() {
    if (!newAttendance.studentId || !newAttendance.date) return;
    await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAttendance)
    });
    setNewAttendance({ studentId: "", date: "", status: "Present" });
    loadData();
  }

  async function deleteAttendance(id) {
    await fetch(`/api/attendance/${id}`, { method: "DELETE" });
    loadData();
  }

  async function addAssessment() {
    if (!newAssessment.unitCode || !newAssessment.title || !newAssessment.dueDate) return;
    await fetch("/api/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAssessment)
    });
    setNewAssessment({ unitCode: "", title: "", dueDate: "", weight: "", description: "" });
    loadData();
  }

  async function deleteAssessment(id) {
    await fetch(`/api/assessments/${id}`, { method: "DELETE" });
    loadData();
  }

  async function addSession() {
    if (!newSession.unitCode || !newSession.dayOfWeek || !newSession.startTime || !newSession.endTime) return;
    await fetch("/api/timetable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSession)
    });
    setNewSession({ unitCode: "", dayOfWeek: "Mon", startTime: "", endTime: "", teacher: "", room: "", mode: "Lecture", location: "", semester: DEFAULT_SEMESTER });
    loadData();
  }

  async function deleteSession(id) {
    await fetch(`/api/timetable/${id}`, { method: "DELETE" });
    loadData();
  }

  function startEditSession(session) {
    setEditingSessionId(session.id);
    setEditSessionForm({ ...session });
  }

  async function saveEditSession(id) {
    await fetch(`/api/timetable/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editSessionForm)
    });
    setEditingSessionId(null);
    setEditSessionForm(null);
    loadData();
  }


  const inputStyle = { padding: 9, border: "1px solid #ccc", borderRadius: 6, fontSize: 13, marginRight: 8, marginBottom: 8 };
  const thStyle = { background: "#1c2b3a", color: "white", padding: "10px 14px", textAlign: "left", fontSize: 12 };
  const tdStyle = { padding: "10px 14px", fontSize: 13, borderBottom: "1px solid #ece2d0" };
  const actionsThStyle = { ...thStyle, position: "sticky", right: 0 };
  const actionsTdStyle = { ...tdStyle, position: "sticky", right: 0, background: "#fffaf3" };

  function studentName(id) {
    const s = students.find(s => s.id === id);
    return s ? s.name : "Unknown";
  }

  const ATTENDANCE_RISK_THRESHOLD = 75; // below this %, flag as at-risk

  // Prefers real Moodle attendance (matched by email) when it's been loaded;
  // falls back to locally-recorded attendance for that student otherwise.
  function studentStanding(student) {
    const moodleRecords = moodleAttendanceRecordsLoaded
      ? moodleAttendanceRecords.filter(r => r.student_email === student.email)
      : [];
    const localRecords = attendance.filter(a => a.studentId === student.id);

    const source = moodleRecords.length > 0 ? "moodle" : (localRecords.length > 0 ? "local" : "none");
    const records = source === "moodle" ? moodleRecords : localRecords;

    if (source === "none") {
      return { source, rate: null, total: 0, present: 0, label: "No attendance data yet", tone: "neutral" };
    }

    const total = records.length;
    const present = records.filter(r => r.status === "Present").length;
    const rate = Math.round((present / total) * 100);
    const atRisk = rate < ATTENDANCE_RISK_THRESHOLD;
    return {
      source,
      rate,
      total,
      present,
      label: atRisk ? "At risk — low attendance" : "Good standing",
      tone: atRisk ? "risk" : "good"
    };
  }

  const selectedAttendanceStudent = students.find(s => s.id === Number(newAttendance.studentId));
  const weeklyStudent = students.find(s => s.id === Number(weeklyStudentId));
  const unitsWithSessions = new Set(timetableSessions.map(t => t.unitCode));

  function classDatesForUnit(unitCode) {
    const unitSessions = timetableSessions.filter(t => t.unitCode === unitCode);
    if (unitSessions.length === 0) return [];
    const classWeekdays = new Set(unitSessions.map(t => t.dayOfWeek));
    const semester = unitSessions[0].semester || DEFAULT_SEMESTER;
    const range = SEMESTERS[semester] || SEMESTERS[DEFAULT_SEMESTER];
    const today = todayStr();
    const weeks = buildWeeks(range.start, range.end).slice(0, TEACHING_WEEKS);
    const dates = [];
    weeks.forEach(week => {
      WEEKDAYS.forEach((wd, idx) => {
        if (!classWeekdays.has(wd)) return;
        const dateStr = addDays(week.start, idx);
        if (dateStr > today) return;
        dates.push({ date: dateStr, weekday: wd });
      });
    });
    return dates;
  }

  const attendanceClassDates = classDatesForUnit(newAttendance.unitCode);
  const noTimetableBadgeStyle = { marginLeft: 8, fontSize: 10, fontWeight: "bold", color: "#a15c00", background: "#fff3cd", padding: "2px 8px", borderRadius: 10, border: "1px solid #ffe69c", whiteSpace: "nowrap" };

  function unitsWithoutTimetable(codes) {
    return (codes || []).filter(code => !unitsWithSessions.has(code));
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#f3ede1", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      <div style={{ background: "#fffaf3", borderBottom: "1px solid #e3d9c6", padding: "16px 30px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, background: "#1c2b3a", color: "white", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold" }}>
            CIHE
          </div>
          <span style={{ fontSize: 16, fontWeight: "bold", color: "#1c2b3a" }}>Admin Console</span>
        </div>
        <button onClick={logout} style={{ background: "transparent", border: "1px solid #1c2b3a", color: "#1c2b3a", padding: "8px 18px", borderRadius: 6, fontWeight: "bold", fontSize: 13, cursor: "pointer" }}>
          Logout
        </button>
      </div>

      <style>{`
        .sa-admin-tab { transition: background 0.15s ease, border-color 0.15s ease; }
        .sa-admin-tab:hover { background: rgba(255,255,255,0.08); border-bottom-color: rgba(194,134,42,0.5) !important; }
      `}</style>
      <div style={{ background: "#1c2b3a", padding: "0 30px", display: "flex", gap: 4, flexWrap: "wrap" }}>
        {[
          { id: "insights", label: "Chatbot Insights" },
          { id: "overview", label: "Student Overview" },
          { id: "moodle", label: "Moodle Live Data" },
          { id: "units", label: "Manage Units" },
          { id: "students", label: "Manage Students" },
          { id: "attendance", label: "Attendance" },
          { id: "assessments", label: "Assessments" },
          { id: "timetable", label: "Class Schedule" }
        ].map(t => (
          <button
            key={t.id}
            className="sa-admin-tab"
            onClick={() => setActiveTab(t.id)}
            style={{
              background: "transparent", border: "none", color: "white", padding: "12px 20px", fontSize: 13, cursor: "pointer",
              borderBottom: activeTab === t.id ? "3px solid #c2862a" : "3px solid transparent",
              fontWeight: activeTab === t.id ? "bold" : "normal"
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 1080, margin: "0 auto", flex: 1, width: "100%", boxSizing: "border-box" }}>

        {activeTab === "insights" && (
          <div>
            <div style={{ fontSize: 20, fontWeight: "bold", color: "#1c2b3a", marginBottom: 6 }}>Chatbot Insights</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 20 }}>
              What students are actually asking SmartAssist, and which questions it couldn't answer.
            </div>

            {!chatInsights && (
              <div style={{ background: "#fffaf3", borderRadius: 8, padding: 24, textAlign: "center", color: "#999", fontSize: 13, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                Loading chatbot insights...
              </div>
            )}

            {chatInsights && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 28 }}>
                  <div style={{ background: "#fffaf3", borderRadius: 8, padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontSize: 12, color: "#888" }}>Total Questions Asked</div>
                    <div style={{ fontSize: 28, fontWeight: "bold", color: "#1c2b3a", marginTop: 4 }}>{chatInsights.totalQueries}</div>
                  </div>
                  <div style={{ background: "#fffaf3", borderRadius: 8, padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontSize: 12, color: "#888" }}>Answered by AI</div>
                    <div style={{ fontSize: 28, fontWeight: "bold", color: "#155724", marginTop: 4 }}>{chatInsights.answered}</div>
                  </div>
                  <div style={{ background: "#fffaf3", borderRadius: 8, padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontSize: 12, color: "#888" }}>Escalated (unanswered)</div>
                    <div style={{ fontSize: 28, fontWeight: "bold", color: "#dc3545", marginTop: 4 }}>{chatInsights.escalated}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: "bold", color: "#1c2b3a", marginBottom: 10 }}>Most Asked Questions</div>
                    <div style={{ background: "#fffaf3", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                      {chatInsights.topQuestions.length === 0 && (
                        <div style={{ padding: 16, fontSize: 13, color: "#999" }}>No questions asked yet.</div>
                      )}
                      {chatInsights.topQuestions.map((q, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderBottom: i < chatInsights.topQuestions.length - 1 ? "1px solid #ece2d0" : "none" }}>
                          <div style={{ fontSize: 12.5, color: "#333" }}>{q.question}</div>
                          <div style={{ fontSize: 12, fontWeight: "bold", color: "#1c2b3a", whiteSpace: "nowrap" }}>×{q.count}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 15, fontWeight: "bold", color: "#1c2b3a", marginBottom: 10 }}>Most Asked Topics / Fields</div>
                    <div style={{ background: "#fffaf3", borderRadius: 8, padding: "14px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                      {chatInsights.topTopics.length === 0 && (
                        <div style={{ fontSize: 13, color: "#999" }}>No topics recorded yet.</div>
                      )}
                      {chatInsights.topTopics.map((t, i) => {
                        const max = chatInsights.topTopics[0].count || 1;
                        const pct = Math.round((t.count / max) * 100);
                        return (
                          <div key={i} style={{ marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#333", marginBottom: 4 }}>
                              <span>{t.topic}</span>
                              <span style={{ fontWeight: "bold" }}>{t.count}</span>
                            </div>
                            <div style={{ background: "#eef1f5", borderRadius: 6, height: 8 }}>
                              <div style={{ width: `${pct}%`, background: t.topic === "Unmatched" ? "#dc3545" : "#1c2b3a", height: 8, borderRadius: 6 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "units" && (
          <div>
            <div style={{ fontSize: 20, fontWeight: "bold", color: "#1c2b3a", marginBottom: 16 }}>Units</div>

            <div style={{ background: "#fffaf3", padding: 16, borderRadius: 8, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 10, color: "#555" }}>Add New Unit</div>
              <input placeholder="Code (e.g. ICT308)" value={newUnit.code} onChange={e => setNewUnit({ ...newUnit, code: e.target.value })} style={inputStyle} />
              <input placeholder="Unit Name" value={newUnit.name} onChange={e => setNewUnit({ ...newUnit, name: e.target.value })} style={{ ...inputStyle, width: 220 }} />
              <select value={newUnit.semester} onChange={e => setNewUnit({ ...newUnit, semester: e.target.value })} style={inputStyle}>
                {SEMESTER_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input placeholder="Total Seats" type="number" value={newUnit.totalSeats} onChange={e => setNewUnit({ ...newUnit, totalSeats: e.target.value })} style={{ ...inputStyle, width: 100 }} />
              <button onClick={addUnit} style={{ padding: "9px 18px", background: "#1c2b3a", color: "white", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                Add Unit
              </button>
            </div>

            <div style={{ background: "#fffaf3", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Code</th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Semester</th>
                    <th style={thStyle}>Enrolled / Seats</th>
                    <th style={actionsThStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {units.map(u => (
                    <tr key={u.code}>
                      <td style={tdStyle}>{u.code}</td>
                      <td style={tdStyle}>
                        {u.name}
                        {!unitsWithSessions.has(u.code) && <span style={noTimetableBadgeStyle}>⚠ No timetable</span>}
                      </td>
                      <td style={tdStyle}>{u.semester}</td>
                      <td style={tdStyle}>{u.enrolled} / {u.totalSeats}</td>
                      <td style={actionsTdStyle}>
                        <button onClick={() => deleteUnit(u.code)} style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer", fontSize: 12 }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "students" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 20, fontWeight: "bold", color: "#1c2b3a" }}>Students</div>
              <button
                onClick={syncStudentsFromMoodle}
                disabled={syncingMoodleStudents}
                style={{ padding: "9px 18px", background: "#c2862a", color: "white", border: "none", borderRadius: 20, fontSize: 12.5, fontWeight: "bold", cursor: syncingMoodleStudents ? "default" : "pointer", opacity: syncingMoodleStudents ? 0.6 : 1 }}
              >
                {syncingMoodleStudents ? "Syncing..." : `↻ Sync students from Moodle${moodleStudents.length ? ` (${new Set(moodleStudents.map(m => m.email)).size} enrolled)` : ""}`}
              </button>
            </div>

            {moodleSyncResult && (
              <div style={{
                background: moodleSyncResult.ok ? "#eafaf0" : "#fdeeee",
                border: `1px solid ${moodleSyncResult.ok ? "#bfe8cf" : "#f5c2c2"}`,
                color: moodleSyncResult.ok ? "#1b7f3a" : "#a12d2d",
                borderRadius: 8, padding: "10px 14px", fontSize: 12.5, marginBottom: 16
              }}>
                {moodleSyncResult.message}
              </div>
            )}

            <div style={{ background: "#fffaf3", padding: 16, borderRadius: 8, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 10, color: "#555" }}>Add New Student</div>
              <input placeholder="Full Name" value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} style={{ ...inputStyle, width: 180 }} />
              <input placeholder="Email" value={newStudent.email} onChange={e => setNewStudent({ ...newStudent, email: e.target.value })} style={{ ...inputStyle, width: 220 }} />
              <input placeholder="Student ID (auto-generated if blank)" value={newStudent.studentId} onChange={e => setNewStudent({ ...newStudent, studentId: e.target.value })} style={{ ...inputStyle, width: 220 }} />
              <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 2 }}>Joining Date</label>
              <input type="date" value={newStudent.joiningDate} onChange={e => setNewStudent({ ...newStudent, joiningDate: e.target.value })} style={inputStyle} />
              <div style={{ display: "inline-block", verticalAlign: "top", marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Units — click to add/remove</label>
                <UnitTogglePicker units={units} selected={newStudent.unitCodes} onChange={codes => setNewStudent({ ...newStudent, unitCodes: codes })} />
              </div>
              <button onClick={addStudent} style={{ padding: "9px 18px", background: "#1c2b3a", color: "white", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer", verticalAlign: "top" }}>
                Add Student
              </button>
              <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
                Students create their own password the first time they log in, using the one-time activation code shown after you add them.
              </div>
              {unitsWithoutTimetable(newStudent.unitCodes).length > 0 && (
                <div style={{ fontSize: 11.5, color: "#a15c00", background: "#fff3cd", border: "1px solid #ffe69c", borderRadius: 6, padding: "8px 10px", marginTop: 8 }}>
                  Note: {unitsWithoutTimetable(newStudent.unitCodes).join(", ")} {unitsWithoutTimetable(newStudent.unitCodes).length === 1 ? "has" : "have"} no timetable sessions yet — add sessions in the Timetable tab so students see their class schedule.
                </div>
              )}
            </div>

            <div style={{ background: "#fffaf3", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Student ID</th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Units</th>
                    <th style={thStyle}>Joined</th>
                    <th style={thStyle}>Password Set?</th>
                    <th style={actionsThStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => (
                    editingId === s.id ? (
                      <tr key={s.id}>
                        <td style={tdStyle}>
                          <input value={editForm.studentId} onChange={e => setEditForm({ ...editForm, studentId: e.target.value })} style={{ ...inputStyle, width: 120, margin: 0 }} />
                        </td>
                        <td style={tdStyle}>
                          <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ ...inputStyle, width: 120, margin: 0 }} />
                        </td>
                        <td style={tdStyle}>
                          <input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} style={{ ...inputStyle, width: 160, margin: 0 }} />
                        </td>
                        <td style={tdStyle}>
                          <UnitTogglePicker units={units} selected={editForm.unitCodes} onChange={codes => setEditForm({ ...editForm, unitCodes: codes })} compact />
                          {unitsWithoutTimetable(editForm.unitCodes).length > 0 && (
                            <div style={{ fontSize: 10.5, color: "#a15c00", background: "#fff3cd", border: "1px solid #ffe69c", borderRadius: 6, padding: "4px 6px", marginTop: 4, maxWidth: 140 }}>
                              Note: {unitsWithoutTimetable(editForm.unitCodes).join(", ")} {unitsWithoutTimetable(editForm.unitCodes).length === 1 ? "has" : "have"} no timetable sessions yet.
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <input type="date" value={editForm.joiningDate} onChange={e => setEditForm({ ...editForm, joiningDate: e.target.value })} style={{ ...inputStyle, margin: 0, width: 130 }} />
                        </td>
                        <td style={tdStyle}>—</td>
                        <td style={actionsTdStyle}>
                          <button onClick={() => saveEdit(s.id)} style={{ background: "#1c2b3a", color: "white", border: "none", borderRadius: 4, padding: "4px 10px", fontSize: 11, cursor: "pointer", marginRight: 6 }}>Save</button>
                          <button onClick={() => setEditingId(null)} style={{ background: "none", border: "1px solid #ccc", borderRadius: 4, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={s.id}>
                        <td style={tdStyle}>{s.studentId || "—"}</td>
                        <td style={tdStyle}>{s.name}</td>
                        <td style={tdStyle}>{s.email}</td>
                        <td style={tdStyle}>{(s.unitCodes && s.unitCodes.length) ? s.unitCodes.join(", ") : "—"}</td>
                        <td style={tdStyle}>{s.joiningDate || "—"}</td>
                        <td style={tdStyle}>{s.activationPending ? "⏳ Not yet" : "✅ Yes"}</td>
                        <td style={actionsTdStyle}>
                          <button onClick={() => startEdit(s)} style={{ background: "none", border: "none", color: "#1c2b3a", cursor: "pointer", fontSize: 12, marginRight: 12 }}>Edit</button>
                          <button onClick={() => issueActivation(s.id, s.email)} style={{ background: "none", border: "none", color: "#1c2b3a", cursor: "pointer", fontSize: 12, marginRight: 12 }}>Activation code</button>
                          <button onClick={() => deleteStudent(s.id)} style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer", fontSize: 12 }}>Delete</button>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "attendance" && (
          <div>
            <div style={{ fontSize: 20, fontWeight: "bold", color: "#1c2b3a", marginBottom: 16 }}>Attendance</div>

            <div style={{ background: "#fffaf3", padding: 16, borderRadius: 8, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 10, color: "#555" }}>Record Attendance</div>
              <select
                value={newAttendance.studentId}
                onChange={e => {
                  const s = students.find(st => st.id === Number(e.target.value));
                  setNewAttendance({ ...newAttendance, studentId: e.target.value, unitCode: (s && s.unitCodes && s.unitCodes[0]) || "", date: "" });
                }}
                style={inputStyle}
              >
                <option value="">Select student</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({(s.unitCodes && s.unitCodes.length) ? s.unitCodes.join(", ") : "no unit"})</option>)}
              </select>
              {selectedAttendanceStudent && selectedAttendanceStudent.unitCodes && selectedAttendanceStudent.unitCodes.length > 0 && (
                <select value={newAttendance.unitCode} onChange={e => setNewAttendance({ ...newAttendance, unitCode: e.target.value, date: "" })} style={inputStyle}>
                  {selectedAttendanceStudent.unitCodes.map(code => <option key={code} value={code}>{code}</option>)}
                </select>
              )}
              <select
                value={newAttendance.date}
                onChange={e => setNewAttendance({ ...newAttendance, date: e.target.value })}
                disabled={attendanceClassDates.length === 0}
                style={inputStyle}
              >
                <option value="">{attendanceClassDates.length === 0 ? "No class dates yet" : "Select class date"}</option>
                {attendanceClassDates.map(d => <option key={d.date} value={d.date}>{formatDMY(d.date)} ({d.weekday})</option>)}
              </select>
              <select value={newAttendance.status} onChange={e => setNewAttendance({ ...newAttendance, status: e.target.value })} style={inputStyle}>
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
              </select>
              <button onClick={addAttendance} style={{ padding: "9px 18px", background: "#1c2b3a", color: "white", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                Add Record
              </button>
            </div>

            <div style={{ background: "#fffaf3", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Student</th>
                    <th style={thStyle}>Unit</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Status</th>
                    <th style={actionsThStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.length === 0 && (
                    <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#999" }}>No attendance records yet.</td></tr>
                  )}
                  {attendance.sort((a, b) => new Date(b.date) - new Date(a.date)).map(a => (
                    <tr key={a.id}>
                      <td style={tdStyle}>{studentName(a.studentId)}</td>
                      <td style={tdStyle}>{a.unitCode || "—"}</td>
                      <td style={tdStyle}>{a.date}</td>
                      <td style={tdStyle}>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold", background: a.status === "Present" ? "#d4edda" : "#f8d7da", color: a.status === "Present" ? "#155724" : "#721c24" }}>
                          {a.status}
                        </span>
                      </td>
                      <td style={actionsTdStyle}>
                        <button onClick={() => deleteAttendance(a.id)} style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer", fontSize: 12 }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            <div style={{ fontSize: 16, fontWeight: "bold", color: "#1c2b3a", margin: "26px 0 12px" }}>Weekly Attendance Summary</div>
            <div style={{ background: "#fffaf3", padding: 16, borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <select
                value={weeklyStudentId}
                onChange={e => {
                  const s = students.find(st => st.id === Number(e.target.value));
                  setWeeklyStudentId(e.target.value);
                  setWeeklyUnitCode((s && s.unitCodes && s.unitCodes[0]) || "");
                }}
                style={inputStyle}
              >
                <option value="">Select student</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {weeklyStudent && weeklyStudent.unitCodes && weeklyStudent.unitCodes.length > 0 && (
                <select value={weeklyUnitCode} onChange={e => setWeeklyUnitCode(e.target.value)} style={inputStyle}>
                  <option value={ALL_UNITS}>All Units (Whole Semester)</option>
                  {weeklyStudent.unitCodes.map(code => <option key={code} value={code}>{code}</option>)}
                </select>
              )}
              {weeklyStudent && weeklyUnitCode ? (
                <div style={{ marginTop: 14 }}>
                  <WeeklyAttendanceTable
                    unitCodes={weeklyUnitCode === ALL_UNITS ? weeklyStudent.unitCodes : [weeklyUnitCode]}
                    sessions={timetableSessions}
                    records={attendance.filter(a => a.studentId === weeklyStudent.id)}
                  />
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#888", marginTop: 10 }}>Select a student and unit to view their weekly attendance.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "assessments" && (
          <div>
            <div style={{ fontSize: 20, fontWeight: "bold", color: "#1c2b3a", marginBottom: 16 }}>Assessments</div>

            <div style={{ background: "#fffaf3", padding: 16, borderRadius: 8, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 10, color: "#555" }}>Add New Assessment</div>
              <select value={newAssessment.unitCode} onChange={e => setNewAssessment({ ...newAssessment, unitCode: e.target.value })} style={inputStyle}>
                <option value="">Select unit</option>
                {units.map(u => <option key={u.code} value={u.code}>{u.code}</option>)}
              </select>
              <input placeholder="Title" value={newAssessment.title} onChange={e => setNewAssessment({ ...newAssessment, title: e.target.value })} style={{ ...inputStyle, width: 200 }} />
              <input type="date" value={newAssessment.dueDate} onChange={e => setNewAssessment({ ...newAssessment, dueDate: e.target.value })} style={inputStyle} />
              <input placeholder="Weight %" type="number" value={newAssessment.weight} onChange={e => setNewAssessment({ ...newAssessment, weight: e.target.value })} style={{ ...inputStyle, width: 90 }} />
              <br />
              <input placeholder="Description (optional)" value={newAssessment.description} onChange={e => setNewAssessment({ ...newAssessment, description: e.target.value })} style={{ ...inputStyle, width: 400 }} />
              <br />
              <button onClick={addAssessment} style={{ padding: "9px 18px", background: "#1c2b3a", color: "white", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                Add Assessment
              </button>
              <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
                Students enrolled in this unit will be notified automatically.
              </div>
            </div>

            <div style={{ background: "#fffaf3", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Unit</th>
                    <th style={thStyle}>Title</th>
                    <th style={thStyle}>Due Date</th>
                    <th style={thStyle}>Weight</th>
                    <th style={actionsThStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.length === 0 && (
                    <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#999" }}>No assessments yet.</td></tr>
                  )}
                  {assessments.map(a => (
                    <tr key={a.id}>
                      <td style={tdStyle}>{a.unitCode}</td>
                      <td style={tdStyle}>{a.title}</td>
                      <td style={tdStyle}>{a.dueDate}</td>
                      <td style={tdStyle}>{a.weight}%</td>
                      <td style={actionsTdStyle}>
                        <button onClick={() => deleteAssessment(a.id)} style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer", fontSize: 12 }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "timetable" && (
          <div>
            <div style={{ fontSize: 20, fontWeight: "bold", color: "#1c2b3a", marginBottom: 16 }}>Timetable</div>

            <div style={{ background: "#fffaf3", padding: 16, borderRadius: 8, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 10, color: "#555" }}>Add Class Session</div>
              <select value={newSession.unitCode} onChange={e => setNewSession({ ...newSession, unitCode: e.target.value })} style={inputStyle}>
                <option value="">Select unit</option>
                {units.map(u => <option key={u.code} value={u.code}>{u.code} — {u.name}</option>)}
              </select>
              <select value={newSession.dayOfWeek} onChange={e => setNewSession({ ...newSession, dayOfWeek: e.target.value })} style={inputStyle}>
                {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <input type="time" value={newSession.startTime} onChange={e => setNewSession({ ...newSession, startTime: e.target.value })} style={inputStyle} />
              <input type="time" value={newSession.endTime} onChange={e => setNewSession({ ...newSession, endTime: e.target.value })} style={inputStyle} />
              <select value={newSession.mode} onChange={e => setNewSession({ ...newSession, mode: e.target.value })} style={inputStyle}>
                {SESSION_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <br />
              <input placeholder="Teacher Name" value={newSession.teacher} onChange={e => setNewSession({ ...newSession, teacher: e.target.value })} style={{ ...inputStyle, width: 160 }} />
              <input placeholder="Room" value={newSession.room} onChange={e => setNewSession({ ...newSession, room: e.target.value })} style={{ ...inputStyle, width: 110 }} />
              <input placeholder="Location / Address" value={newSession.location} onChange={e => setNewSession({ ...newSession, location: e.target.value })} style={{ ...inputStyle, width: 220 }} />
              <select value={newSession.semester} onChange={e => setNewSession({ ...newSession, semester: e.target.value })} style={inputStyle}>
                {SEMESTER_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <br />
              <button onClick={addSession} style={{ padding: "9px 18px", background: "#1c2b3a", color: "white", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                Add Session
              </button>
            </div>

            <div style={{ background: "#fffaf3", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Unit</th>
                    <th style={thStyle}>Day</th>
                    <th style={thStyle}>Time</th>
                    <th style={thStyle}>Teacher</th>
                    <th style={thStyle}>Room</th>
                    <th style={thStyle}>Mode</th>
                    <th style={thStyle}>Location</th>
                    <th style={thStyle}>Semester</th>
                    <th style={actionsThStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {timetableSessions.length === 0 && (
                    <tr><td colSpan={9} style={{ ...tdStyle, textAlign: "center", color: "#999" }}>No class sessions yet.</td></tr>
                  )}
                  {timetableSessions.map(t => (
                    editingSessionId === t.id ? (
                      <tr key={t.id}>
                        <td style={tdStyle}>
                          <select value={editSessionForm.unitCode} onChange={e => setEditSessionForm({ ...editSessionForm, unitCode: e.target.value })} style={{ ...inputStyle, margin: 0 }}>
                            {units.map(u => <option key={u.code} value={u.code}>{u.code}</option>)}
                          </select>
                        </td>
                        <td style={tdStyle}>
                          <select value={editSessionForm.dayOfWeek} onChange={e => setEditSessionForm({ ...editSessionForm, dayOfWeek: e.target.value })} style={{ ...inputStyle, margin: 0 }}>
                            {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </td>
                        <td style={tdStyle}>
                          <input type="time" value={editSessionForm.startTime} onChange={e => setEditSessionForm({ ...editSessionForm, startTime: e.target.value })} style={{ ...inputStyle, margin: 0, width: 90 }} />
                          <input type="time" value={editSessionForm.endTime} onChange={e => setEditSessionForm({ ...editSessionForm, endTime: e.target.value })} style={{ ...inputStyle, margin: 0, width: 90 }} />
                        </td>
                        <td style={tdStyle}>
                          <input value={editSessionForm.teacher} onChange={e => setEditSessionForm({ ...editSessionForm, teacher: e.target.value })} style={{ ...inputStyle, margin: 0, width: 100 }} />
                        </td>
                        <td style={tdStyle}>
                          <input value={editSessionForm.room} onChange={e => setEditSessionForm({ ...editSessionForm, room: e.target.value })} style={{ ...inputStyle, margin: 0, width: 70 }} />
                        </td>
                        <td style={tdStyle}>
                          <select value={editSessionForm.mode} onChange={e => setEditSessionForm({ ...editSessionForm, mode: e.target.value })} style={{ ...inputStyle, margin: 0 }}>
                            {SESSION_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </td>
                        <td style={tdStyle}>
                          <input value={editSessionForm.location} onChange={e => setEditSessionForm({ ...editSessionForm, location: e.target.value })} style={{ ...inputStyle, margin: 0, width: 130 }} />
                        </td>
                        <td style={tdStyle}>
                          <select value={editSessionForm.semester} onChange={e => setEditSessionForm({ ...editSessionForm, semester: e.target.value })} style={{ ...inputStyle, margin: 0 }}>
                            {SEMESTER_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={actionsTdStyle}>
                          <button onClick={() => saveEditSession(t.id)} style={{ background: "#1c2b3a", color: "white", border: "none", borderRadius: 4, padding: "4px 10px", fontSize: 11, cursor: "pointer", marginRight: 6 }}>Save</button>
                          <button onClick={() => { setEditingSessionId(null); setEditSessionForm(null); }} style={{ background: "none", border: "1px solid #ccc", borderRadius: 4, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={t.id}>
                        <td style={tdStyle}>{t.unitCode}</td>
                        <td style={tdStyle}>{t.dayOfWeek}</td>
                        <td style={tdStyle}>{t.startTime} - {t.endTime}</td>
                        <td style={tdStyle}>{t.teacher || "—"}</td>
                        <td style={tdStyle}>{t.room || "—"}</td>
                        <td style={tdStyle}>{t.mode || "—"}</td>
                        <td style={tdStyle}>{t.location || "—"}</td>
                        <td style={tdStyle}>{t.semester}</td>
                        <td style={actionsTdStyle}>
                          <button onClick={() => startEditSession(t)} style={{ background: "none", border: "none", color: "#1c2b3a", cursor: "pointer", fontSize: 12, marginRight: 12 }}>Edit</button>
                          <button onClick={() => deleteSession(t.id)} style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer", fontSize: 12 }}>Delete</button>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "overview" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 20, fontWeight: "bold", color: "#1c2b3a" }}>Student Overview</div>
              <button
                onClick={loadMoodleAttendanceRecords}
                disabled={moodleAttendanceRecordsLoading}
                style={{ padding: "8px 16px", background: "#1c2b3a", color: "white", border: "none", borderRadius: 18, fontSize: 12, fontWeight: "bold", cursor: moodleAttendanceRecordsLoading ? "default" : "pointer", opacity: moodleAttendanceRecordsLoading ? 0.6 : 1 }}
              >
                {moodleAttendanceRecordsLoading ? "Loading Moodle attendance..." : "↻ Refresh from Moodle"}
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: "#888", marginBottom: 20 }}>
              Standing is based on real Moodle attendance when available (matched by email), falling back to locally-recorded attendance otherwise. Students below {ATTENDANCE_RISK_THRESHOLD}% attendance are flagged at-risk.
            </div>

            {students.length === 0 && (
              <div style={{ background: "#fffaf3", borderRadius: 8, padding: 24, fontSize: 13, color: "#888", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                No students yet — add one in Manage Students, or sync from Moodle there.
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {students.map(s => {
                const standing = studentStanding(s);
                const toneColors = {
                  good: { bg: "#eafaf0", border: "#bfe8cf", fg: "#1b7f3a", badge: "✓" },
                  risk: { bg: "#fdeeee", border: "#f5c2c2", fg: "#a12d2d", badge: "⚠" },
                  neutral: { bg: "#f4f5f8", border: "#e3e5ec", fg: "#888", badge: "–" }
                };
                const c = toneColors[standing.tone];
                return (
                  <div key={s.id} style={{ background: "#fffaf3", borderRadius: 10, padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderTop: `4px solid ${c.fg}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 14.5, fontWeight: "bold", color: "#222" }}>{s.name}</div>
                        <div style={{ fontSize: 11.5, color: "#999", marginTop: 2 }}>{s.studentId || "—"} · {s.email}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}`, borderRadius: 14, padding: "3px 10px", fontSize: 11.5, fontWeight: "bold" }}>
                        {c.badge} {standing.label}
                      </span>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                      {standing.rate !== null ? (
                        <>Attendance: <strong>{standing.rate}%</strong> ({standing.present}/{standing.total} sessions, {standing.source === "moodle" ? "live Moodle data" : "locally recorded"})</>
                      ) : (
                        "No attendance records marked yet."
                      )}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                      Units: {(s.unitCodes && s.unitCodes.length) ? s.unitCodes.join(", ") : "None assigned"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "moodle" && (
          <div>
            <div style={{ fontSize: 20, fontWeight: "bold", color: "#1c2b3a", marginBottom: 16 }}>Moodle Live Data</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 20 }}>
              This data is pulled live from Moodle via the RAG backend. It is read-only here — manage it in Moodle itself.
            </div>

            <div style={{ fontSize: 16, fontWeight: "bold", color: "#1c2b3a", marginBottom: 10 }}>Assignments</div>
            <div style={{ background: "#fffaf3", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 30 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Course ID</th>
                    <th style={thStyle}>Assignment Name</th>
                    <th style={thStyle}>Due Date</th>
                    <th style={thStyle}>Max Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {moodleAssignments.length === 0 && (
                    <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "#999" }}>No assignments found.</td></tr>
                  )}
                  {moodleAssignments.map((a, i) => (
                    <tr key={i}>
                      <td style={tdStyle}>{a.course_id}</td>
                      <td style={tdStyle}>{a.name}</td>
                      <td style={tdStyle}>{a.due_date}</td>
                      <td style={tdStyle}>{a.max_grade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ fontSize: 16, fontWeight: "bold", color: "#1c2b3a", marginBottom: 10 }}>Enrolled Students</div>
            <div style={{ background: "#fffaf3", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 30 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Course ID</th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {moodleStudents.length === 0 && (
                    <tr><td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#999" }}>No enrolled students found.</td></tr>
                  )}
                  {moodleStudents.map((s, i) => (
                    <tr key={i}>
                      <td style={tdStyle}>{s.course_id}</td>
                      <td style={tdStyle}>{s.name}</td>
                      <td style={tdStyle}>{s.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: "bold", color: "#1c2b3a" }}>Assignment Submissions (per-student)</div>
              <button
                onClick={loadMoodleSubmissions}
                disabled={moodleSubmissionsLoading}
                style={{ padding: "5px 14px", background: "#1c2b3a", color: "white", border: "none", borderRadius: 6, fontSize: 12, cursor: moodleSubmissionsLoading ? "default" : "pointer", opacity: moodleSubmissionsLoading ? 0.6 : 1 }}
              >
                {moodleSubmissionsLoading ? "Loading..." : moodleSubmissionsLoaded ? "Refresh" : "Load submissions"}
              </button>
            </div>
            <div style={{ background: "#fffaf3", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 30 }}>
              <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Assignment</th>
                    <th style={thStyle}>Due Date</th>
                    <th style={thStyle}>Student</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Grading</th>
                    <th style={thStyle}>Grade</th>
                    <th style={thStyle}>Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {!moodleSubmissionsLoaded && (
                    <tr><td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "#999" }}>Click "Load submissions" to pull live per-student submission status from Moodle.</td></tr>
                  )}
                  {moodleSubmissionsLoaded && moodleSubmissions.length === 0 && (
                    <tr><td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "#999" }}>No submission records found.</td></tr>
                  )}
                  {moodleSubmissions.map((s, i) => (
                    <tr key={i}>
                      <td style={tdStyle}>{s.assignment_name}</td>
                      <td style={tdStyle}>{s.due_date}</td>
                      <td style={tdStyle}>{moodleStudentName(s.student_id)}</td>
                      <td style={tdStyle}>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold", background: s.status === "submitted" ? "#d4edda" : "#fff3cd", color: s.status === "submitted" ? "#155724" : "#a15c00" }}>
                          {s.status}
                        </span>
                      </td>
                      <td style={tdStyle}>{s.grading_status}</td>
                      <td style={tdStyle}>{s.grade ?? "—"}</td>
                      <td style={tdStyle}>{s.submitted_at || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: "bold", color: "#1c2b3a" }}>Attendance Records (per-student)</div>
              <button
                onClick={loadMoodleAttendanceRecords}
                disabled={moodleAttendanceRecordsLoading}
                style={{ padding: "5px 14px", background: "#1c2b3a", color: "white", border: "none", borderRadius: 6, fontSize: 12, cursor: moodleAttendanceRecordsLoading ? "default" : "pointer", opacity: moodleAttendanceRecordsLoading ? 0.6 : 1 }}
              >
                {moodleAttendanceRecordsLoading ? "Loading..." : moodleAttendanceRecordsLoaded ? "Refresh" : "Load attendance records"}
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: "#999", marginBottom: 10 }}>
              This pulls the full real roster for every session (one Moodle call per session), so it takes a few seconds longer than the tables above.
            </div>
            <div style={{ background: "#fffaf3", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Course ID</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Student</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {!moodleAttendanceRecordsLoaded && (
                    <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "#999" }}>Click "Load attendance records" to pull the live per-student roster from Moodle.</td></tr>
                  )}
                  {moodleAttendanceRecordsLoaded && moodleAttendanceRecords.length === 0 && (
                    <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "#999" }}>No attendance records found.</td></tr>
                  )}
                  {moodleAttendanceRecords.map((r, i) => {
                    const statusColors = {
                      Present: { bg: "#d4edda", fg: "#155724" },
                      Late: { bg: "#fff3cd", fg: "#a15c00" },
                      Excused: { bg: "#d1ecf1", fg: "#0c5460" },
                      Absent: { bg: "#f8d7da", fg: "#721c24" },
                    };
                    const colors = statusColors[r.status] || { bg: "#eee", fg: "#555" };
                    return (
                      <tr key={i}>
                        <td style={tdStyle}>{r.course_id}</td>
                        <td style={tdStyle}>{r.date}</td>
                        <td style={tdStyle}>{r.student_name}</td>
                        <td style={tdStyle}>
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: "bold", background: colors.bg, color: colors.fg }}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid #e3d9c6", padding: "16px 30px", textAlign: "center", fontSize: 12, color: "#9aa0ae" }}>
        CIHE SmartAssist · Admin Console · Powered by a locally-run RAG chatbot over your Moodle content
      </div>
    </div>
  );
}

export default AdminDashboard;