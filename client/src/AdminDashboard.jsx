import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import WeeklyAttendanceTable from "./WeeklyAttendanceTable";
import { WEEKDAYS } from "./scheduleUtils";

const SESSION_MODES = ["Lecture", "Workshop", "Lab", "Tutorial", "Seminar"];

function AdminDashboard() {
  const [units, setUnits] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [timetableSessions, setTimetableSessions] = useState([]);
  const [activeTab, setActiveTab] = useState("units");
  const [newUnit, setNewUnit] = useState({ code: "", name: "", semester: "Semester 2, 2026", totalSeats: "" });
  const [newStudent, setNewStudent] = useState({ name: "", email: "", studentId: "", joiningDate: "", unitCodes: [] });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", studentId: "", joiningDate: "", unitCodes: [] });
  const [newAttendance, setNewAttendance] = useState({ studentId: "", unitCode: "", date: "", status: "Present" });
  const [newAssessment, setNewAssessment] = useState({ unitCode: "", title: "", dueDate: "", weight: "", description: "" });
  const [newSession, setNewSession] = useState({ unitCode: "", dayOfWeek: "Mon", startTime: "", endTime: "", teacher: "", room: "", mode: "Lecture", location: "", semester: "Semester 2, 2026" });
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editSessionForm, setEditSessionForm] = useState(null);
  const [weeklyStudentId, setWeeklyStudentId] = useState("");
  const [weeklyUnitCode, setWeeklyUnitCode] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem("loggedIn") !== "true" || localStorage.getItem("role") !== "admin") {
      navigate("/");
      return;
    }
    loadData();
  }, [navigate]);

  function loadData() {
    fetch("/api/units").then(r => r.json()).then(setUnits);
    fetch("/api/students").then(r => r.json()).then(setStudents);
    fetch("/api/attendance").then(r => r.json()).then(setAttendance);
    fetch("/api/assessments").then(r => r.json()).then(setAssessments);
    fetch("/api/timetable").then(r => r.json()).then(setTimetableSessions);
  }

  function logout() {
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
    setNewUnit({ code: "", name: "", semester: "Semester 2, 2026", totalSeats: "" });
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
    loadData();
  }

  async function deleteStudent(id) {
    await fetch(`/api/students/${id}`, { method: "DELETE" });
    loadData();
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
    setNewSession({ unitCode: "", dayOfWeek: "Mon", startTime: "", endTime: "", teacher: "", room: "", mode: "Lecture", location: "", semester: "Semester 2, 2026" });
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
  const thStyle = { background: "#0f2a52", color: "white", padding: "10px 14px", textAlign: "left", fontSize: 12 };
  const tdStyle = { padding: "10px 14px", fontSize: 13, borderBottom: "1px solid #f0f0f0" };

  function studentName(id) {
    const s = students.find(s => s.id === id);
    return s ? s.name : "Unknown";
  }

  const selectedAttendanceStudent = students.find(s => s.id === Number(newAttendance.studentId));
  const weeklyStudent = students.find(s => s.id === Number(weeklyStudentId));
  const unitsWithSessions = new Set(timetableSessions.map(t => t.unitCode));
  const noTimetableBadgeStyle = { marginLeft: 8, fontSize: 10, fontWeight: "bold", color: "#a15c00", background: "#fff3cd", padding: "2px 8px", borderRadius: 10, border: "1px solid #ffe69c", whiteSpace: "nowrap" };

  function unitsWithoutTimetable(codes) {
    return (codes || []).filter(code => !unitsWithSessions.has(code));
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#f0f2f5", minHeight: "100vh" }}>

      <div style={{ background: "white", borderBottom: "1px solid #e0e0e0", padding: "16px 30px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, background: "#0f2a52", color: "white", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold" }}>
            CIHE
          </div>
          <span style={{ fontSize: 16, fontWeight: "bold", color: "#0f2a52" }}>Admin Console</span>
        </div>
        <button onClick={logout} style={{ background: "transparent", border: "1px solid #0f2a52", color: "#0f2a52", padding: "8px 18px", borderRadius: 6, fontWeight: "bold", fontSize: 13, cursor: "pointer" }}>
          Logout
        </button>
      </div>

      <div style={{ background: "#0f2a52", padding: "0 30px", display: "flex", gap: 4, flexWrap: "wrap" }}>
        {[
          { id: "units", label: "Manage Units" },
          { id: "students", label: "Manage Students" },
          { id: "attendance", label: "Attendance" },
          { id: "assessments", label: "Assessments" },
          { id: "timetable", label: "Timetable" }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              background: "transparent", border: "none", color: "white", padding: "12px 20px", fontSize: 13, cursor: "pointer",
              borderBottom: activeTab === t.id ? "3px solid #e8a020" : "3px solid transparent",
              fontWeight: activeTab === t.id ? "bold" : "normal"
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 30, maxWidth: 950, margin: "0 auto" }}>

        {activeTab === "units" && (
          <div>
            <div style={{ fontSize: 20, fontWeight: "bold", color: "#0f2a52", marginBottom: 16 }}>Units</div>

            <div style={{ background: "white", padding: 16, borderRadius: 8, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 10, color: "#555" }}>Add New Unit</div>
              <input placeholder="Code (e.g. ICT308)" value={newUnit.code} onChange={e => setNewUnit({ ...newUnit, code: e.target.value })} style={inputStyle} />
              <input placeholder="Unit Name" value={newUnit.name} onChange={e => setNewUnit({ ...newUnit, name: e.target.value })} style={{ ...inputStyle, width: 220 }} />
              <input placeholder="Total Seats" type="number" value={newUnit.totalSeats} onChange={e => setNewUnit({ ...newUnit, totalSeats: e.target.value })} style={{ ...inputStyle, width: 100 }} />
              <button onClick={addUnit} style={{ padding: "9px 18px", background: "#0f2a52", color: "white", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                Add Unit
              </button>
            </div>

            <div style={{ background: "white", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Code</th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Semester</th>
                    <th style={thStyle}>Enrolled / Seats</th>
                    <th style={thStyle}></th>
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
                      <td style={tdStyle}>
                        <button onClick={() => deleteUnit(u.code)} style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer", fontSize: 12 }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "students" && (
          <div>
            <div style={{ fontSize: 20, fontWeight: "bold", color: "#0f2a52", marginBottom: 16 }}>Students</div>

            <div style={{ background: "white", padding: 16, borderRadius: 8, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 10, color: "#555" }}>Add New Student</div>
              <input placeholder="Full Name" value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} style={{ ...inputStyle, width: 180 }} />
              <input placeholder="Email" value={newStudent.email} onChange={e => setNewStudent({ ...newStudent, email: e.target.value })} style={{ ...inputStyle, width: 220 }} />
              <input placeholder="Student ID (auto-generated if blank)" value={newStudent.studentId} onChange={e => setNewStudent({ ...newStudent, studentId: e.target.value })} style={{ ...inputStyle, width: 220 }} />
              <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 2 }}>Joining Date</label>
              <input type="date" value={newStudent.joiningDate} onChange={e => setNewStudent({ ...newStudent, joiningDate: e.target.value })} style={inputStyle} />
              <div style={{ display: "inline-block", verticalAlign: "top" }}>
                <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 2 }}>Units (ctrl/cmd-click for multiple)</label>
                <select
                  multiple
                  value={newStudent.unitCodes}
                  onChange={e => setNewStudent({ ...newStudent, unitCodes: Array.from(e.target.selectedOptions, o => o.value) })}
                  style={{ ...inputStyle, height: 90, width: 160 }}
                >
                  {units.map(u => <option key={u.code} value={u.code}>{u.code} — {u.name}</option>)}
                </select>
              </div>
              <button onClick={addStudent} style={{ padding: "9px 18px", background: "#0f2a52", color: "white", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer", verticalAlign: "top" }}>
                Add Student
              </button>
              <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
                Students set their own password the first time they log in.
              </div>
              {unitsWithoutTimetable(newStudent.unitCodes).length > 0 && (
                <div style={{ fontSize: 11.5, color: "#a15c00", background: "#fff3cd", border: "1px solid #ffe69c", borderRadius: 6, padding: "8px 10px", marginTop: 8 }}>
                  Note: {unitsWithoutTimetable(newStudent.unitCodes).join(", ")} {unitsWithoutTimetable(newStudent.unitCodes).length === 1 ? "has" : "have"} no timetable sessions yet — add sessions in the Timetable tab so students see their class schedule.
                </div>
              )}
            </div>

            <div style={{ background: "white", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Student ID</th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Units</th>
                    <th style={thStyle}>Joined</th>
                    <th style={thStyle}>Password Set?</th>
                    <th style={thStyle}></th>
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
                          <select
                            multiple
                            value={editForm.unitCodes}
                            onChange={e => setEditForm({ ...editForm, unitCodes: Array.from(e.target.selectedOptions, o => o.value) })}
                            style={{ ...inputStyle, margin: 0, height: 70, width: 140 }}
                          >
                            {units.map(u => <option key={u.code} value={u.code}>{u.code}</option>)}
                          </select>
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
                        <td style={tdStyle}>
                          <button onClick={() => saveEdit(s.id)} style={{ background: "#0f2a52", color: "white", border: "none", borderRadius: 4, padding: "4px 10px", fontSize: 11, cursor: "pointer", marginRight: 6 }}>Save</button>
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
                        <td style={tdStyle}>{s.password ? "✅ Yes" : "⏳ Not yet"}</td>
                        <td style={tdStyle}>
                          <button onClick={() => startEdit(s)} style={{ background: "none", border: "none", color: "#0f2a52", cursor: "pointer", fontSize: 12, marginRight: 12 }}>Edit</button>
                          <button onClick={() => deleteStudent(s.id)} style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer", fontSize: 12 }}>Delete</button>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "attendance" && (
          <div>
            <div style={{ fontSize: 20, fontWeight: "bold", color: "#0f2a52", marginBottom: 16 }}>Attendance</div>

            <div style={{ background: "white", padding: 16, borderRadius: 8, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 10, color: "#555" }}>Record Attendance</div>
              <select
                value={newAttendance.studentId}
                onChange={e => {
                  const s = students.find(st => st.id === Number(e.target.value));
                  setNewAttendance({ ...newAttendance, studentId: e.target.value, unitCode: (s && s.unitCodes && s.unitCodes[0]) || "" });
                }}
                style={inputStyle}
              >
                <option value="">Select student</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({(s.unitCodes && s.unitCodes.length) ? s.unitCodes.join(", ") : "no unit"})</option>)}
              </select>
              {selectedAttendanceStudent && selectedAttendanceStudent.unitCodes && selectedAttendanceStudent.unitCodes.length > 0 && (
                <select value={newAttendance.unitCode} onChange={e => setNewAttendance({ ...newAttendance, unitCode: e.target.value })} style={inputStyle}>
                  {selectedAttendanceStudent.unitCodes.map(code => <option key={code} value={code}>{code}</option>)}
                </select>
              )}
              <input type="date" value={newAttendance.date} onChange={e => setNewAttendance({ ...newAttendance, date: e.target.value })} style={inputStyle} />
              <select value={newAttendance.status} onChange={e => setNewAttendance({ ...newAttendance, status: e.target.value })} style={inputStyle}>
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
              </select>
              <button onClick={addAttendance} style={{ padding: "9px 18px", background: "#0f2a52", color: "white", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                Add Record
              </button>
            </div>

            <div style={{ background: "white", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Student</th>
                    <th style={thStyle}>Unit</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}></th>
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
                      <td style={tdStyle}>
                        <button onClick={() => deleteAttendance(a.id)} style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer", fontSize: 12 }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ fontSize: 16, fontWeight: "bold", color: "#0f2a52", margin: "26px 0 12px" }}>Weekly Attendance Summary</div>
            <div style={{ background: "white", padding: 16, borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
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
                  {weeklyStudent.unitCodes.map(code => <option key={code} value={code}>{code}</option>)}
                </select>
              )}
              {weeklyStudent && weeklyUnitCode ? (
                <div style={{ marginTop: 14 }}>
                  <WeeklyAttendanceTable unitCode={weeklyUnitCode} sessions={timetableSessions} records={attendance.filter(a => a.studentId === weeklyStudent.id)} />
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#888", marginTop: 10 }}>Select a student and unit to view their weekly attendance.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "assessments" && (
          <div>
            <div style={{ fontSize: 20, fontWeight: "bold", color: "#0f2a52", marginBottom: 16 }}>Assessments</div>

            <div style={{ background: "white", padding: 16, borderRadius: 8, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
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
              <button onClick={addAssessment} style={{ padding: "9px 18px", background: "#0f2a52", color: "white", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                Add Assessment
              </button>
              <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
                Students enrolled in this unit will be notified automatically.
              </div>
            </div>

            <div style={{ background: "white", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Unit</th>
                    <th style={thStyle}>Title</th>
                    <th style={thStyle}>Due Date</th>
                    <th style={thStyle}>Weight</th>
                    <th style={thStyle}></th>
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
                      <td style={tdStyle}>
                        <button onClick={() => deleteAssessment(a.id)} style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer", fontSize: 12 }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "timetable" && (
          <div>
            <div style={{ fontSize: 20, fontWeight: "bold", color: "#0f2a52", marginBottom: 16 }}>Timetable</div>

            <div style={{ background: "white", padding: 16, borderRadius: 8, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
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
              <input placeholder="Semester" value={newSession.semester} onChange={e => setNewSession({ ...newSession, semester: e.target.value })} style={{ ...inputStyle, width: 150 }} />
              <br />
              <button onClick={addSession} style={{ padding: "9px 18px", background: "#0f2a52", color: "white", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                Add Session
              </button>
            </div>

            <div style={{ background: "white", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
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
                    <th style={thStyle}></th>
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
                          <input value={editSessionForm.semester} onChange={e => setEditSessionForm({ ...editSessionForm, semester: e.target.value })} style={{ ...inputStyle, margin: 0, width: 110 }} />
                        </td>
                        <td style={tdStyle}>
                          <button onClick={() => saveEditSession(t.id)} style={{ background: "#0f2a52", color: "white", border: "none", borderRadius: 4, padding: "4px 10px", fontSize: 11, cursor: "pointer", marginRight: 6 }}>Save</button>
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
                        <td style={tdStyle}>
                          <button onClick={() => startEditSession(t)} style={{ background: "none", border: "none", color: "#0f2a52", cursor: "pointer", fontSize: 12, marginRight: 12 }}>Edit</button>
                          <button onClick={() => deleteSession(t.id)} style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer", fontSize: 12 }}>Delete</button>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;