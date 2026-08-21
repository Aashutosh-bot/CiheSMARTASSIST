const express = require("express");
const cors = require("cors");
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

// --- Units ---
let units = [
  { code: "ICT307", name: "AI-Based Systems Development", semester: "Semester 2, 2026", totalSeats: 120, enrolled: 97 },
  { code: "ICT301", name: "Information Technology Project Management", semester: "Semester 2, 2026", totalSeats: 100, enrolled: 82 },
  { code: "ICT305", name: "Topics in IT", semester: "Semester 2, 2026", totalSeats: 90, enrolled: 60 },
  { code: "ICT210", name: "Big Data for Software Development", semester: "Semester 2, 2026", totalSeats: 80, enrolled: 45 }
];

// --- Students ---
let students = [
  { id: 1, name: "Roshan Ghimire", email: "student@cihe.edu.au", password: "password123", unitCode: "ICT307" }
];
let nextStudentId = 2;

// --- Notifications ---
let notifications = [];
let nextNotificationId = 1;

function notify(email, message) {
  notifications.push({ id: nextNotificationId++, email, message, time: new Date().toISOString(), read: false });
}

app.get("/api/notifications", (req, res) => {
  const email = req.query.email;
  const list = notifications.filter(n => n.email === email).sort((a, b) => new Date(b.time) - new Date(a.time));
  res.json(list);
});

app.post("/api/notifications/read", (req, res) => {
  const { email } = req.body;
  notifications.forEach(n => { if (n.email === email) n.read = true; });
  res.json({ success: true });
});

// --- Attendance ---
let attendance = [];
let nextAttendanceId = 1;

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
  const { studentId, date, status } = req.body;
  const student = students.find(s => s.id === Number(studentId));
  if (!student) return res.status(404).json({ success: false, message: "Student not found." });
  const record = { id: nextAttendanceId++, studentId: Number(studentId), unitCode: student.unitCode, date, status };
  attendance.push(record);
  res.json({ success: true, attendance });
});

app.delete("/api/attendance/:id", (req, res) => {
  attendance = attendance.filter(a => a.id !== Number(req.params.id));
  res.json({ success: true, attendance });
});

// --- Assessments ---
let assessments = [
  { id: 1, unitCode: "ICT307", title: "Assessment 1: Project Initiation", dueDate: "2026-08-23", weight: 20, description: "Initial project proposal and scope document." }
];
let nextAssessmentId = 2;

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

  students.filter(s => s.unitCode === unitCode).forEach(s => {
    notify(s.email, `New assessment posted for ${unitCode}: "${title}" — due ${dueDate}.`);
  });

  res.json({ success: true, assessments });
});

app.delete("/api/assessments/:id", (req, res) => {
  assessments = assessments.filter(a => a.id !== Number(req.params.id));
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
  res.json({ success: true, units });
});

app.delete("/api/units/:code", (req, res) => {
  units = units.filter(u => u.code !== req.params.code);
  res.json({ success: true, units });
});

// --- Students CRUD ---
app.get("/api/students", (req, res) => res.json(students));

app.post("/api/students", (req, res) => {
  const { name, email, unitCode } = req.body;
  if (!name || !email) return res.status(400).json({ success: false, message: "Name and email required." });
  if (students.find(s => s.email === email)) return res.status(400).json({ success: false, message: "A student with this email already exists." });
  const student = { id: nextStudentId++, name, email, password: "", unitCode: unitCode || "" };
  students.push(student);
  const unit = units.find(u => u.code === unitCode);
  if (unit) {
    unit.enrolled += 1;
    notify(email, `You have been enrolled in ${unit.code} — ${unit.name}.`);
  }
  res.json({ success: true, students });
});

app.put("/api/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find(s => s.id === id);
  if (!student) return res.status(404).json({ success: false, message: "Student not found." });

  const { name, email, unitCode } = req.body;

  if (unitCode !== undefined && unitCode !== student.unitCode) {
    const oldUnit = units.find(u => u.code === student.unitCode);
    if (oldUnit && oldUnit.enrolled > 0) oldUnit.enrolled -= 1;
    const newUnit = units.find(u => u.code === unitCode);
    if (newUnit) {
      newUnit.enrolled += 1;
      notify(student.email, `You have been enrolled in ${newUnit.code} — ${newUnit.name}.`);
    }
    student.unitCode = unitCode;
  }

  if (name) student.name = name;
  if (email) student.email = email;

  res.json({ success: true, students });
});

app.delete("/api/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find(s => s.id === id);
  if (student) {
    const unit = units.find(u => u.code === student.unitCode);
    if (unit && unit.enrolled > 0) unit.enrolled -= 1;
  }
  students = students.filter(s => s.id !== id);
  attendance = attendance.filter(a => a.studentId !== id);
  res.json({ success: true, students });
});

app.listen(5001, () => console.log("Server running on http://localhost:5001"));