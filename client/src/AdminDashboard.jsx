import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function AdminDashboard() {
  const [units, setUnits] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [activeTab, setActiveTab] = useState("units");
  const [newUnit, setNewUnit] = useState({ code: "", name: "", semester: "Semester 2, 2026", totalSeats: "" });
  const [newStudent, setNewStudent] = useState({ name: "", email: "", unitCode: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", unitCode: "" });
  const [newAttendance, setNewAttendance] = useState({ studentId: "", date: "", status: "Present" });
  const [newAssessment, setNewAssessment] = useState({ unitCode: "", title: "", dueDate: "", weight: "", description: "" });
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
    setNewStudent({ name: "", email: "", unitCode: "" });
    loadData();
  }

  async function deleteStudent(id) {
    await fetch(`/api/students/${id}`, { method: "DELETE" });
    loadData();
  }

  function startEdit(student) {
    setEditingId(student.id);
    setEditForm({ name: student.name, email: student.email, unitCode: student.unitCode || "" });
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

  const inputStyle = { padding: 9, border: "1px solid #ccc", borderRadius: 6, fontSize: 13, marginRight: 8, marginBottom: 8 };
  const thStyle = { background: "#0f2a52", color: "white", padding: "10px 14px", textAlign: "left", fontSize: 12 };
  const tdStyle = { padding: "10px 14px", fontSize: 13, borderBottom: "1px solid #f0f0f0" };

  function studentName(id) {
    const s = students.find(s => s.id === id);
    return s ? s.name : "Unknown";
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
          { id: "assessments", label: "Assessments" }
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
                      <td style={tdStyle}>{u.name}</td>
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
              <select value={newStudent.unitCode} onChange={e => setNewStudent({ ...newStudent, unitCode: e.target.value })} style={inputStyle}>
                <option value="">No unit</option>
                {units.map(u => <option key={u.code} value={u.code}>{u.code}</option>)}
              </select>
              <button onClick={addStudent} style={{ padding: "9px 18px", background: "#0f2a52", color: "white", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                Add Student
              </button>
              <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
                Students set their own password the first time they log in.
              </div>
            </div>

            <div style={{ background: "white", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Unit</th>
                    <th style={thStyle}>Password Set?</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => (
                    editingId === s.id ? (
                      <tr key={s.id}>
                        <td style={tdStyle}>
                          <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ ...inputStyle, width: 120, margin: 0 }} />
                        </td>
                        <td style={tdStyle}>
                          <input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} style={{ ...inputStyle, width: 160, margin: 0 }} />
                        </td>
                        <td style={tdStyle}>
                          <select value={editForm.unitCode} onChange={e => setEditForm({ ...editForm, unitCode: e.target.value })} style={{ ...inputStyle, margin: 0 }}>
                            <option value="">No unit</option>
                            {units.map(u => <option key={u.code} value={u.code}>{u.code}</option>)}
                          </select>
                        </td>
                        <td style={tdStyle}>—</td>
                        <td style={tdStyle}>
                          <button onClick={() => saveEdit(s.id)} style={{ background: "#0f2a52", color: "white", border: "none", borderRadius: 4, padding: "4px 10px", fontSize: 11, cursor: "pointer", marginRight: 6 }}>Save</button>
                          <button onClick={() => setEditingId(null)} style={{ background: "none", border: "1px solid #ccc", borderRadius: 4, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={s.id}>
                        <td style={tdStyle}>{s.name}</td>
                        <td style={tdStyle}>{s.email}</td>
                        <td style={tdStyle}>{s.unitCode || "—"}</td>
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
              <select value={newAttendance.studentId} onChange={e => setNewAttendance({ ...newAttendance, studentId: e.target.value })} style={inputStyle}>
                <option value="">Select student</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.unitCode || "no unit"})</option>)}
              </select>
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
      </div>
    </div>
  );
}

export default AdminDashboard;