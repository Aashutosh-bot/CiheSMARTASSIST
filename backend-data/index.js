const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const app = express();

app.use(cors());
app.use(express.json());

// --- Admin account ---
const ADMIN_EMAIL = "admin@cihe.edu.au";
const ADMIN_PASSWORD = "admin123";

app.post("/api/admin-login", (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: "Invalid admin credentials." });
  }
});

// --- Persistence ---
// Everything below lived only in memory, so every restart of this server
// (which happens often during development/testing) wiped out anything the
// admin had added - units, students, assessments, timetable sessions, all
// reset back to the seed data below. We now load from data.json on startup
// and write back to it after every change, so real data survives restarts.
const DATA_FILE = path.join(__dirname, "data.json");

const seedUnits = [
  { code: "ICT307", name: "AI-Based Systems Development", semester: "Semester 2, 2026", totalSeats: 30, enrolled: 0 },
  { code: "ICT301", name: "Information Technology Project Management", semester: "Semester 2, 2026", totalSeats: 30, enrolled: 0 },
  { code: "ICT305", name: "Topics in IT", semester: "Semester 2, 2026", totalSeats: 30, enrolled: 0 },
  { code: "ICT210", name: "Big Data for Software Development", semester: "Semester 2, 2026", totalSeats: 30, enrolled: 0 }
];
const seedStudents = [
  { id: 1, name: "Roshan Ghimire", email: "student@cihe.edu.au", password: "password123", studentId: "CIHE-2026-00123", joiningDate: "2026-02-01", unitCodes: ["ICT307"] }
];
const seedAssessments = [
  { id: 1, unitCode: "ICT307", title: "Assessment 1: Project Initiation", dueDate: "2026-08-23", weight: 20, description: "Initial project proposal and scope document." }
];
const seedTimetableSessions = [
  { id: 1, unitCode: "ICT307", dayOfWeek: "Mon", startTime: "10:00", endTime: "12:00", teacher: "Dr. Sarah Chen", room: "B1.12", mode: "Lecture", location: "Building B, Level 1", semester: "Semester 2, 2026" },
  { id: 2, unitCode: "ICT301", dayOfWeek: "Tue", startTime: "13:00", endTime: "15:00", teacher: "Dr. James Cooper", room: "A2.05", mode: "Workshop", location: "Building A, Level 2", semester: "Semester 2, 2026" },
  { id: 3, unitCode: "ICT305", dayOfWeek: "Wed", startTime: "09:00", endTime: "11:00", teacher: "Dr. Priya Nair", room: "C3.08", mode: "Lecture", location: "Building C, Level 3", semester: "Semester 2, 2026" },
  { id: 4, unitCode: "ICT210", dayOfWeek: "Thu", startTime: "14:00", endTime: "16:00", teacher: "Dr. Marcus Lee", room: "B2.10", mode: "Lab", location: "Building B, Level 2", semester: "Semester 2, 2026" }
];

function loadPersistedData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    }
  } catch (err) {
    console.error("[persistence] Could not read data.json, starting from seed data:", err.message);
  }
  return null;
}

const persisted = loadPersistedData();

// --- Units ---
let units = (persisted && persisted.units) || seedUnits;

// --- Students ---
let students = (persisted && persisted.students) || seedStudents;
let nextStudentId = (persisted && persisted.nextStudentId) || 2;
let nextStudentSeq = (persisted && persisted.nextStudentSeq) || 124;

function generateStudentId(joiningDate) {
  const year = joiningDate ? new Date(joiningDate).getFullYear() : new Date().getFullYear();
  let candidate;
  do {
    candidate = `CIHE-${year}-${String(nextStudentSeq++).padStart(5, "0")}`;
  } while (students.some(s => s.studentId === candidate));
  return candidate;
}

function adjustEnrollment(unitCode, delta) {
  const unit = units.find(u => u.code === unitCode);
  if (unit) unit.enrolled = Math.max(0, unit.enrolled + delta);
}

// --- Notifications ---
let notifications = (persisted && persisted.notifications) || [];
let nextNotificationId = (persisted && persisted.nextNotificationId) || 1;

function notify(email, message) {
  notifications.push({ id: nextNotificationId++, email, message, time: new Date().toISOString(), read: false });
}

function saveData() {
  const snapshot = {
    units, students, assessments, timetableSessions, attendance, notifications,
    nextStudentId, nextStudentSeq, nextNotificationId, nextAttendanceId, nextAssessmentId, nextTimetableId
  };
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2));
  } catch (err) {
    console.error("[persistence] Could not write data.json:", err.message);
  }
}

app.get("/api/notifications", (req, res) => {
  const email = req.query.email;
  const list = notifications.filter(n => n.email === email).sort((a, b) => new Date(b.time) - new Date(a.time));
  res.json(list);
});

app.post("/api/notifications/read", (req, res) => {
  const { email } = req.body;
  notifications.forEach(n => { if (n.email === email) n.read = true; });
  saveData();
  res.json({ success: true });
});

// --- Attendance ---
let attendance = (persisted && persisted.attendance) || [];
let nextAttendanceId = (persisted && persisted.nextAttendanceId) || 1;

app.get("/api/attendance", (req, res) => {
  res.json(attendance);
});

app.get("/api/attendance/student/:email", (req, res) => {
  const student = students.find(s => s.email === req.params.email);
  if (!student) return res.status(404).json({ success: false, message: "Student not found." });
  const records = attendance.filter(a => a.studentId === student.id).sort((a, b) => new Date(b.date) - new Date(a.date));
  const total = records.length;
  const presentCount = records.filter(r => r.status === "Present").length;
  const rate = total > 0 ? Math.round((presentCount / total) * 100) : 100;
  res.json({ records, rate, total, presentCount });
});

app.post("/api/attendance", (req, res) => {
  const { studentId, unitCode, date, status } = req.body;
  const student = students.find(s => s.id === Number(studentId));
  if (!student) return res.status(404).json({ success: false, message: "Student not found." });
  const finalUnitCode = unitCode || (student.unitCodes && student.unitCodes[0]) || "";
  const record = { id: nextAttendanceId++, studentId: Number(studentId), unitCode: finalUnitCode, date, status };
  attendance.push(record);
  saveData();
  res.json({ success: true, attendance });
});

app.delete("/api/attendance/:id", (req, res) => {
  attendance = attendance.filter(a => a.id !== Number(req.params.id));
  saveData();
  res.json({ success: true, attendance });
});

// --- Assessments ---
let assessments = (persisted && persisted.assessments) || seedAssessments;
let nextAssessmentId = (persisted && persisted.nextAssessmentId) || 2;

app.get("/api/assessments", (req, res) => {
  const { unitCode } = req.query;
  const list = unitCode ? assessments.filter(a => a.unitCode === unitCode) : assessments;
  res.json(list.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)));
});

app.post("/api/assessments", (req, res) => {
  const { unitCode, title, dueDate, weight, description } = req.body;
  if (!unitCode || !title || !dueDate) return res.status(400).json({ success: false, message: "Unit, title, and due date required." });
  const assessment = { id: nextAssessmentId++, unitCode, title, dueDate, weight: Number(weight) || 0, description: description || "" };
  assessments.push(assessment);

  students.filter(s => (s.unitCodes || []).includes(unitCode)).forEach(s => {
    notify(s.email, `New assessment posted for ${unitCode}: "${title}" — due ${dueDate}.`);
  });

  saveData();
  res.json({ success: true, assessments });
});

app.delete("/api/assessments/:id", (req, res) => {
  assessments = assessments.filter(a => a.id !== Number(req.params.id));
  saveData();
  res.json({ success: true, assessments });
});

// --- Student auth ---
app.post("/api/check-email", (req, res) => {
  const { email } = req.body;
  const student = students.find(s => s.email === email);
  if (!student) {
    return res.status(404).json({ success: false, message: "No student found with this email. Contact admin." });
  }
  res.json({ success: true, hasPassword: !!student.password });
});

app.post("/api/set-password", (req, res) => {
  const { email, password } = req.body;
  const student = students.find(s => s.email === email);
  if (!student) return res.status(404).json({ success: false, message: "Student not found." });
  if (student.password) return res.status(400).json({ success: false, message: "Password already set. Please log in." });
  if (!password || password.length < 6) return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
  student.password = password;
  saveData();
  res.json({ success: true, name: student.name });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const student = students.find(s => s.email === email && s.password === password);
  if (student) {
    res.json({ success: true, name: student.name });
  } else {
    res.status(401).json({ success: false, message: "Invalid email or password." });
  }
});

// --- Units CRUD ---
app.get("/api/units", (req, res) => res.json(units));

app.post("/api/units", (req, res) => {
  const { code, name, semester, totalSeats } = req.body;
  if (!code || !name) return res.status(400).json({ success: false, message: "Code and name required." });
  if (units.find(u => u.code === code)) return res.status(400).json({ success: false, message: "Unit code already exists." });
  units.push({ code, name, semester: semester || "Semester 2, 2026", totalSeats: Number(totalSeats) || 50, enrolled: 0 });
  saveData();
  res.json({ success: true, units });
});

app.delete("/api/units/:code", (req, res) => {
  units = units.filter(u => u.code !== req.params.code);
  saveData();
  res.json({ success: true, units });
});

// --- Timetable ---
let timetableSessions = (persisted && persisted.timetableSessions) || seedTimetableSessions;
let nextTimetableId = (persisted && persisted.nextTimetableId) || 5;

app.get("/api/timetable", (req, res) => {
  const { unitCode } = req.query;
  const list = unitCode ? timetableSessions.filter(t => t.unitCode === unitCode) : timetableSessions;
  res.json(list);
});

app.post("/api/timetable", (req, res) => {
  const { unitCode, dayOfWeek, startTime, endTime, teacher, room, mode, location, semester } = req.body;
  if (!unitCode || !dayOfWeek || !startTime || !endTime) {
    return res.status(400).json({ success: false, message: "Unit, day, start time, and end time are required." });
  }
  const session = {
    id: nextTimetableId++,
    unitCode,
    dayOfWeek,
    startTime,
    endTime,
    teacher: teacher || "",
    room: room || "",
    mode: mode || "",
    location: location || "",
    semester: semester || "Semester 2, 2026"
  };
  timetableSessions.push(session);
  saveData();
  res.json({ success: true, timetableSessions });
});

app.put("/api/timetable/:id", (req, res) => {
  const id = Number(req.params.id);
  const session = timetableSessions.find(t => t.id === id);
  if (!session) return res.status(404).json({ success: false, message: "Session not found." });
  const { unitCode, dayOfWeek, startTime, endTime, teacher, room, mode, location, semester } = req.body;
  if (unitCode) session.unitCode = unitCode;
  if (dayOfWeek) session.dayOfWeek = dayOfWeek;
  if (startTime) session.startTime = startTime;
  if (endTime) session.endTime = endTime;
  if (teacher !== undefined) session.teacher = teacher;
  if (room !== undefined) session.room = room;
  if (mode !== undefined) session.mode = mode;
  if (location !== undefined) session.location = location;
  if (semester !== undefined) session.semester = semester;
  saveData();
  res.json({ success: true, timetableSessions });
});

app.delete("/api/timetable/:id", (req, res) => {
  timetableSessions = timetableSessions.filter(t => t.id !== Number(req.params.id));
  saveData();
  res.json({ success: true, timetableSessions });
});

// --- Students CRUD ---
app.get("/api/students", (req, res) => res.json(students));

app.get("/api/students/me", (req, res) => {
  const email = req.query.email;
  const student = students.find(s => s.email === email);
  if (!student) return res.status(404).json({ success: false, message: "Student not found." });
  const { password, ...safe } = student;
  res.json({ success: true, student: safe });
});

app.post("/api/students", (req, res) => {
  const { name, email, unitCodes, studentId, joiningDate } = req.body;
  if (!name || !email) return res.status(400).json({ success: false, message: "Name and email required." });
  if (students.find(s => s.email === email)) return res.status(400).json({ success: false, message: "A student with this email already exists." });
  if (studentId && students.find(s => s.studentId === studentId)) return res.status(400).json({ success: false, message: "A student with this Student ID already exists." });
  const codes = Array.isArray(unitCodes) ? unitCodes.filter(Boolean) : [];
  const student = {
    id: nextStudentId++,
    name,
    email,
    password: "",
    studentId: studentId && studentId.trim() ? studentId.trim() : generateStudentId(joiningDate),
    joiningDate: joiningDate || "",
    unitCodes: codes
  };
  students.push(student);
  codes.forEach(code => {
    adjustEnrollment(code, 1);
    const unit = units.find(u => u.code === code);
    if (unit) notify(email, `You have been enrolled in ${unit.code} — ${unit.name}.`);
  });
  saveData();
  res.json({ success: true, students });
});

app.put("/api/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find(s => s.id === id);
  if (!student) return res.status(404).json({ success: false, message: "Student not found." });

  const { name, email, unitCodes, studentId, joiningDate } = req.body;

  if (unitCodes !== undefined) {
    const newCodes = Array.isArray(unitCodes) ? unitCodes.filter(Boolean) : [];
    const oldCodes = student.unitCodes || [];
    const added = newCodes.filter(c => !oldCodes.includes(c));
    const removed = oldCodes.filter(c => !newCodes.includes(c));
    removed.forEach(code => adjustEnrollment(code, -1));
    added.forEach(code => {
      adjustEnrollment(code, 1);
      const unit = units.find(u => u.code === code);
      if (unit) notify(student.email, `You have been enrolled in ${unit.code} — ${unit.name}.`);
    });
    student.unitCodes = newCodes;
  }

  if (name) student.name = name;
  if (email) student.email = email;
  if (studentId && studentId.trim()) student.studentId = studentId.trim();
  if (joiningDate !== undefined) student.joiningDate = joiningDate;

  saveData();
  res.json({ success: true, students });
});

app.delete("/api/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find(s => s.id === id);
  if (student) {
    (student.unitCodes || []).forEach(code => adjustEnrollment(code, -1));
  }
  students = students.filter(s => s.id !== id);
  attendance = attendance.filter(a => a.studentId !== id);
  saveData();
  res.json({ success: true, students });
});

app.listen(5000, () => console.log("Server running on http://localhost:5000"));