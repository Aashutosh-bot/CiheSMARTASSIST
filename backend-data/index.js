const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const sec = require("./security");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : false);

// ---- Middleware stack (defence in depth: headers -> CORS -> rate limit -> parse -> auth -> RBAC -> validation)
app.use(helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  hsts: sec.IS_PROD ? { maxAge: 31536000, includeSubDomains: true } : false
}));
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(",").map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin)),
  credentials: true
}));
app.use(sec.apiLimiter);
app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));

// ---- Persistence (C2: AES-256-GCM encrypted at rest when DATA_KEY is set)
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data.json");
const DATA_KEY = sec.loadKey();
if (!DATA_KEY) {
  if (sec.IS_PROD) throw new Error("DATA_KEY must be set in production.");
  console.warn("[security] DATA_KEY not set - data file is stored unencrypted (development only).");
}

function loadPersistedData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const isEnvelope = raw.startsWith('{"v":1,"iv"');
    if (isEnvelope) {
      if (!DATA_KEY) throw new Error("Data file is encrypted but DATA_KEY is not set.");
      return JSON.parse(sec.decryptData(raw, DATA_KEY));
    }
    return JSON.parse(raw); // legacy plaintext file: migrated on next save
  } catch (err) {
    console.error("[persistence] Could not read data file:", err.message);
    if (DATA_KEY || sec.IS_PROD) throw err; // never silently overwrite protected data
    return null;
  }
}

const seedUnits = [
  { code: "ICT307", name: "AI-Based Systems Development", semester: "Semester 2, 2026", totalSeats: 30, enrolled: 0 },
  { code: "ICT301", name: "Information Technology Project Management", semester: "Semester 2, 2026", totalSeats: 30, enrolled: 0 },
  { code: "ICT305", name: "Topics in IT", semester: "Semester 2, 2026", totalSeats: 30, enrolled: 0 },
  { code: "ICT210", name: "Big Data for Software Development", semester: "Semester 2, 2026", totalSeats: 30, enrolled: 0 }
];
// No passwords in source (C1). Seed accounts are created without a password and claimed with an activation code.
const seedStudents = [
  { id: 1, name: "Roshan Ghimire", email: "student@cihe.edu.au", password: "", studentId: "CIHE-2026-00123", joiningDate: "2026-02-01", unitCodes: ["ICT307"] }
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

const persisted = loadPersistedData();
let units = (persisted && persisted.units) || seedUnits;
let students = (persisted && persisted.students) || seedStudents;
let staff = (persisted && persisted.staff) || [];
let nextStudentId = (persisted && persisted.nextStudentId) || 2;
let nextStudentSeq = (persisted && persisted.nextStudentSeq) || 124;
let nextStaffId = (persisted && persisted.nextStaffId) || 1;
let notifications = (persisted && persisted.notifications) || [];
let nextNotificationId = (persisted && persisted.nextNotificationId) || 1;
let attendance = (persisted && persisted.attendance) || [];
let nextAttendanceId = (persisted && persisted.nextAttendanceId) || 1;
let assessments = (persisted && persisted.assessments) || seedAssessments;
let nextAssessmentId = (persisted && persisted.nextAssessmentId) || 2;
let timetableSessions = (persisted && persisted.timetableSessions) || seedTimetableSessions;
let nextTimetableId = (persisted && persisted.nextTimetableId) || 5;

function saveData() {
  const snapshot = {
    units, students, staff, assessments, timetableSessions, attendance, notifications,
    nextStudentId, nextStudentSeq, nextStaffId, nextNotificationId, nextAttendanceId, nextAssessmentId, nextTimetableId
  };
  try {
    const json = JSON.stringify(snapshot, null, 2);
    const out = DATA_KEY ? sec.encryptData(json, DATA_KEY) : json;
    const tmp = DATA_FILE + ".tmp";
    fs.writeFileSync(tmp, out, { mode: 0o600 });
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.error("[persistence] Could not write data file:", err.message);
  }
}

// ---- Activation codes (replace the old "anyone can claim an account by knowing the email" flow)
const ACTIVATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sha256 = v => crypto.createHash("sha256").update(v).digest("hex");
function newActivation(user) {
  const code = crypto.randomBytes(9).toString("base64url"); // 72 bits
  user.activation = { hash: sha256(code), expires: Date.now() + ACTIVATION_TTL_MS };
  return code;
}
function activationValid(user, code) {
  if (!user.activation || typeof code !== "string") return false;
  if (user.activation.expires < Date.now()) return false;
  const a = Buffer.from(user.activation.hash);
  const b = Buffer.from(sha256(code));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---- Startup: bootstrap admin from environment, migrate legacy plaintext passwords
async function init() {
  // Migrate any legacy plaintext passwords to Argon2id (C1).
  let migrated = 0;
  for (const s of students) {
    if (s.password && !s.password.startsWith("$argon2")) {
      s.password = await sec.hashPassword(s.password);
      migrated++;
    }
  }
  // Bootstrap the first admin. Credentials come from the environment, never from source code.
  if (!staff.some(u => u.role === "admin")) {
    const email = sec.normEmail(process.env.ADMIN_EMAIL || "admin@cihe.edu.au");
    const generated = !process.env.ADMIN_PASSWORD;
    if (generated && sec.IS_PROD) throw new Error("ADMIN_PASSWORD must be set in production.");
    const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString("base64url");
    const err = sec.passwordPolicyError(pw, email);
    if (err) throw new Error("ADMIN_PASSWORD rejected: " + err);
    const totpSecret = sec.newTotpSecret();
    staff.push({
      id: nextStaffId++, name: "Administrator", email, role: "admin", unitCodes: [],
      password: await sec.hashPassword(pw), totpSecret, totpEnabled: true, lastTotpStep: 0
    });
    console.warn(`[bootstrap] Admin account created: ${email}`);
    if (generated) console.warn(`[bootstrap] One-time generated admin password (change it): ${pw}`);
    console.warn(`[bootstrap] Add this to your authenticator app now (shown once): ${sec.totpUri(email, totpSecret)}`);
    migrated++;
  }
  // Seed students that have no password get an activation code, printed once in development.
  for (const s of students) {
    if (!s.password && !s.activation) {
      const code = newActivation(s);
      if (!sec.IS_PROD) console.warn(`[bootstrap] Activation code for ${s.email}: ${code}`);
      migrated++;
    }
  }
  if (migrated) saveData();
}
const ready = init();

// ---- Helpers
const norm = sec.normEmail;
function findStudentByEmail(email) { return students.find(s => s.email.toLowerCase() === norm(email)); }
function findStaffByEmail(email) { return staff.find(s => s.email.toLowerCase() === norm(email)); }
sec.setUserLookup((email, role) => {
  const u = role === "student" ? findStudentByEmail(email) : findStaffByEmail(email);
  if (!u || (role !== "student" && u.role !== role)) return null; // stale role claim after a role change
  return { ...u, role };
});

function publicStudent(s) {
  const { password, totpSecret, totpPending, lastTotpStep, activation, ...safe } = s;
  return { ...safe, totpEnabled: !!s.totpEnabled, activationPending: !!activation };
}
function publicStaff(s) {
  const { password, totpSecret, totpPending, lastTotpStep, activation, ...safe } = s;
  return { ...safe, activationPending: !!activation };
}
// Lecturers only see/act on their own units; admins see everything.
const staffUnits = req => (req.user.role === "admin" ? null : req.user.unitCodes || []);
const canTouchUnit = (req, unitCode) => req.user.role === "admin" || (req.user.unitCodes || []).includes(unitCode);
const bad = (res, message, status = 400) => res.status(status).json({ success: false, message });

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
function notify(email, message) {
  notifications.push({ id: nextNotificationId++, email, message, time: new Date().toISOString(), read: false });
}
const validUnitCodes = arr => Array.isArray(arr) && arr.length <= 20 && arr.every(sec.isUnitCode);

// ================================================================ Authentication
// Shared login logic for students and staff (AU1, AU2, A1).
async function login(req, res, pool) {
  await ready;
  const { email, password, code } = req.body || {};
  if (!sec.isEmail(email) || typeof password !== "string" || password.length > 128) return bad(res, "Invalid email or password.", 401);
  const key = norm(email);
  if (sec.isLocked(key)) {
    sec.audit("login_blocked_locked", { account: key, ip: req.ip });
    return bad(res, "Account temporarily locked. Try again later.", 429);
  }
  const user = pool === "student" ? findStudentByEmail(key) : findStaffByEmail(key);
  const okPassword = user ? await sec.verifyPassword(user.password, password) : (await sec.dummyVerify(password), false);
  if (!okPassword) {
    sec.recordFailure(key, req.ip);
    sec.audit("login_failure", { account: key, ip: req.ip, reason: "credentials" });
    return bad(res, "Invalid email or password.", 401);
  }
  const needs2fa = user.role === "admin" || user.role === "lecturer" || user.totpEnabled;
  if (needs2fa) {
    if (!code) return res.status(401).json({ success: false, requires2fa: true, message: "Authentication code required." });
    const step = sec.verifyTotp(user.totpSecret, code);
    if (!step || step <= (user.lastTotpStep || 0)) {
      sec.recordFailure(key, req.ip);
      sec.audit("login_failure", { account: key, ip: req.ip, reason: "2fa" });
      return res.status(401).json({ success: false, requires2fa: true, message: "Invalid authentication code." });
    }
    user.lastTotpStep = step; // one-time use: blocks replay of a captured code
    saveData();
  }
  sec.clearFailures(key);
  const role = pool === "student" ? "student" : user.role;
  sec.issueSession(res, { email: user.email, role });
  sec.audit("login_success", { account: key, role, ip: req.ip });
  res.json({ success: true, name: user.name, role });
}

app.post("/api/login", sec.loginLimiter, (req, res, next) => login(req, res, "student").catch(next));
app.post("/api/admin-login", sec.loginLimiter, (req, res, next) => login(req, res, "staff").catch(next));

app.post("/api/logout", (req, res) => {
  const claims = sec.decodeSession(req);
  sec.clearSession(req, res);
  if (claims) sec.audit("logout", { account: claims.email });
  res.json({ success: true });
});

app.get("/api/me", sec.requireAuth, (req, res) => {
  const u = req.user.role === "student" ? findStudentByEmail(req.user.email) : findStaffByEmail(req.user.email);
  res.json({ success: true, email: u.email, name: u.name, role: req.user.role, totpEnabled: !!u.totpEnabled });
});

// Generic response for unknown emails so the endpoint does not confirm which accounts exist.
app.post("/api/check-email", sec.loginLimiter, (req, res) => {
  const { email } = req.body || {};
  if (!sec.isEmail(email)) return bad(res, "Please enter a valid email.");
  const s = findStudentByEmail(email);
  res.json({ success: true, hasPassword: s ? !!s.password : true });
});

// First-time password creation now requires the one-time activation code issued by an admin.
app.post("/api/set-password", sec.loginLimiter, async (req, res, next) => {
  try {
    await ready;
    const { email, password, activationCode } = req.body || {};
    if (!sec.isEmail(email) || typeof activationCode !== "string") return bad(res, "Invalid activation details.");
    const key = "activate:" + norm(email);
    if (sec.isLocked(key)) return bad(res, "Too many attempts. Try again later.", 429);
    const student = findStudentByEmail(email);
    const member = student ? null : findStaffByEmail(email);
    const user = student || member;
    if (!user || user.password || !activationValid(user, activationCode)) {
      sec.recordFailure(key, req.ip);
      sec.audit("activation_failure", { account: norm(email), ip: req.ip });
      return bad(res, "Invalid activation details.", 400);
    }
    const policy = sec.passwordPolicyError(password, email);
    if (policy) return bad(res, policy);
    user.password = await sec.hashPassword(password);
    delete user.activation;
    let totpUri;
    if (member) { // staff must use 2FA
      user.totpSecret = sec.newTotpSecret();
      user.totpEnabled = true;
      totpUri = sec.totpUri(user.email, user.totpSecret);
    }
    saveData();
    sec.clearFailures(key);
    sec.audit("account_activated", { account: norm(email), ip: req.ip });
    // No session is issued here: the user logs in normally (and with 2FA, if required).
    res.json({ success: true, name: user.name, ...(totpUri ? { totpUri } : {}) });
  } catch (e) { next(e); }
});

app.post("/api/change-password", sec.requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const user = req.user.role === "student" ? findStudentByEmail(req.user.email) : findStaffByEmail(req.user.email);
    if (typeof currentPassword !== "string" || !(await sec.verifyPassword(user.password, currentPassword))) {
      sec.audit("password_change_failure", { account: user.email, ip: req.ip });
      return bad(res, "Current password is incorrect.", 401);
    }
    const policy = sec.passwordPolicyError(newPassword, user.email);
    if (policy) return bad(res, policy);
    user.password = await sec.hashPassword(newPassword);
    saveData();
    sec.audit("password_changed", { account: user.email });
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ---- 2FA enrolment for students (staff are enrolled at activation)
app.post("/api/2fa/setup", sec.requireAuth, (req, res) => {
  const user = req.user.role === "student" ? findStudentByEmail(req.user.email) : findStaffByEmail(req.user.email);
  if (user.totpEnabled) return bad(res, "2FA is already enabled.");
  user.totpPending = sec.newTotpSecret();
  saveData();
  res.json({ success: true, secret: user.totpPending, uri: sec.totpUri(user.email, user.totpPending) });
});
app.post("/api/2fa/enable", sec.requireAuth, (req, res) => {
  const user = req.user.role === "student" ? findStudentByEmail(req.user.email) : findStaffByEmail(req.user.email);
  const step = user.totpPending && sec.verifyTotp(user.totpPending, (req.body || {}).code);
  if (!step) return bad(res, "Invalid authentication code.");
  user.totpSecret = user.totpPending;
  user.lastTotpStep = step;
  user.totpEnabled = true;
  delete user.totpPending;
  saveData();
  sec.audit("2fa_enabled", { account: user.email });
  res.json({ success: true });
});

// ================================================================ Everything below requires a session
const staffOnly = sec.requireRole("admin", "lecturer");
const adminOnly = sec.requireRole("admin");

// ---- Notifications (self only; the old ?email= parameter is ignored: IDOR fix)
app.get("/api/notifications", sec.requireAuth, (req, res) => {
  const list = notifications.filter(n => n.email === req.user.email).sort((a, b) => new Date(b.time) - new Date(a.time));
  res.json(list);
});
app.post("/api/notifications/read", sec.requireAuth, (req, res) => {
  notifications.forEach(n => { if (n.email === req.user.email) n.read = true; });
  saveData();
  res.json({ success: true });
});

// ---- Attendance
const ATTENDANCE_STATUSES = ["Present", "Absent"];
app.get("/api/attendance", sec.requireAuth, staffOnly, (req, res) => {
  const scope = staffUnits(req);
  res.json(scope ? attendance.filter(a => scope.includes(a.unitCode)) : attendance);
});

app.get("/api/attendance/student/:email", sec.requireAuth, (req, res) => {
  const email = norm(req.params.email);
  const student = findStudentByEmail(email);
  const isSelf = req.user.role === "student" && req.user.email.toLowerCase() === email;
  const isStaff = req.user.role === "admin" || req.user.role === "lecturer";
  if (!student || !(isSelf || isStaff)) {
    if (student && !isSelf) sec.audit("authz_denied", { actor: req.user.email, role: req.user.role, ip: req.ip, path: req.path });
    return bad(res, "Student not found.", isSelf || !student ? 404 : 403);
  }
  let records = attendance.filter(a => a.studentId === student.id);
  const scope = isStaff ? staffUnits(req) : null;
  if (scope) records = records.filter(r => scope.includes(r.unitCode));
  records.sort((a, b) => new Date(b.date) - new Date(a.date));
  const total = records.length;
  const presentCount = records.filter(r => r.status === "Present").length;
  const rate = total > 0 ? Math.round((presentCount / total) * 100) : 100;
  res.json({ records, rate, total, presentCount });
});

app.post("/api/attendance", sec.requireAuth, staffOnly, (req, res) => {
  const { studentId, unitCode, date, status } = req.body || {};
  const student = students.find(s => s.id === Number(studentId));
  if (!student) return bad(res, "Student not found.", 404);
  if (!sec.isDate(date) || !ATTENDANCE_STATUSES.includes(status)) return bad(res, "Valid date and status are required.");
  const finalUnitCode = unitCode || (student.unitCodes && student.unitCodes[0]) || "";
  if (!sec.isUnitCode(finalUnitCode)) return bad(res, "Valid unit code required.");
  if (!canTouchUnit(req, finalUnitCode)) {
    sec.audit("authz_denied", { actor: req.user.email, role: req.user.role, ip: req.ip, path: req.path, unitCode: finalUnitCode });
    return bad(res, "You do not have permission to do that.", 403);
  }
  const record = { id: nextAttendanceId++, studentId: student.id, unitCode: finalUnitCode, date, status };
  attendance.push(record);
  sec.audit("attendance_added", { actor: req.user.email, recordId: record.id });
  saveData();
  res.json({ success: true, attendance: staffUnits(req) ? attendance.filter(a => staffUnits(req).includes(a.unitCode)) : attendance });
});

app.delete("/api/attendance/:id", sec.requireAuth, staffOnly, (req, res) => {
  const rec = attendance.find(a => a.id === Number(req.params.id));
  if (rec && !canTouchUnit(req, rec.unitCode)) return bad(res, "You do not have permission to do that.", 403);
  attendance = attendance.filter(a => a.id !== Number(req.params.id));
  sec.audit("attendance_deleted", { actor: req.user.email, recordId: Number(req.params.id) });
  saveData();
  res.json({ success: true, attendance: staffUnits(req) ? attendance.filter(a => staffUnits(req).includes(a.unitCode)) : attendance });
});

// ---- Assessments
app.get("/api/assessments", sec.requireAuth, (req, res) => {
  const { unitCode } = req.query;
  const list = typeof unitCode === "string" ? assessments.filter(a => a.unitCode === unitCode) : assessments;
  res.json([...list].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)));
});

app.post("/api/assessments", sec.requireAuth, staffOnly, (req, res) => {
  const { unitCode, title, dueDate, weight, description } = req.body || {};
  if (!sec.isUnitCode(unitCode) || !sec.isStr(title, 200) || !sec.isDate(dueDate) || !sec.optStr(description, 2000)) {
    return bad(res, "Unit, title, and due date required.");
  }
  if (!canTouchUnit(req, unitCode)) return bad(res, "You do not have permission to do that.", 403);
  const w = Number(weight) || 0;
  if (w < 0 || w > 100) return bad(res, "Weight must be between 0 and 100.");
  const assessment = { id: nextAssessmentId++, unitCode, title, dueDate, weight: w, description: description || "" };
  assessments.push(assessment);
  students.filter(s => (s.unitCodes || []).includes(unitCode)).forEach(s => {
    notify(s.email, `New assessment posted for ${unitCode}: "${title}" — due ${dueDate}.`);
  });
  sec.audit("assessment_added", { actor: req.user.email, id: assessment.id });
  saveData();
  res.json({ success: true, assessments });
});

app.delete("/api/assessments/:id", sec.requireAuth, staffOnly, (req, res) => {
  const a = assessments.find(x => x.id === Number(req.params.id));
  if (a && !canTouchUnit(req, a.unitCode)) return bad(res, "You do not have permission to do that.", 403);
  assessments = assessments.filter(x => x.id !== Number(req.params.id));
  sec.audit("assessment_deleted", { actor: req.user.email, id: Number(req.params.id) });
  saveData();
  res.json({ success: true, assessments });
});

// ---- Units
app.get("/api/units", sec.requireAuth, (req, res) => res.json(units));

app.post("/api/units", sec.requireAuth, adminOnly, (req, res) => {
  const { code, name, semester, totalSeats } = req.body || {};
  if (!sec.isUnitCode(code) || !sec.isStr(name, 200) || !sec.optStr(semester, 100)) return bad(res, "Code and name required.");
  if (units.find(u => u.code === code)) return bad(res, "Unit code already exists.");
  const seats = Number(totalSeats) || 50;
  if (seats < 1 || seats > 1000) return bad(res, "Seats must be between 1 and 1000.");
  units.push({ code, name, semester: semester || "Semester 2, 2026", totalSeats: seats, enrolled: 0 });
  sec.audit("unit_added", { actor: req.user.email, code });
  saveData();
  res.json({ success: true, units });
});

app.delete("/api/units/:code", sec.requireAuth, adminOnly, (req, res) => {
  units = units.filter(u => u.code !== req.params.code);
  sec.audit("unit_deleted", { actor: req.user.email, code: req.params.code });
  saveData();
  res.json({ success: true, units });
});

// ---- Timetable
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const isTime = v => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
app.get("/api/timetable", sec.requireAuth, (req, res) => {
  const { unitCode } = req.query;
  res.json(typeof unitCode === "string" ? timetableSessions.filter(t => t.unitCode === unitCode) : timetableSessions);
});

function validTimetableBody(b, partial) {
  const present = k => b[k] !== undefined;
  if ((!partial || present("unitCode")) && !sec.isUnitCode(b.unitCode)) return false;
  if ((!partial || present("dayOfWeek")) && !DAYS.includes(b.dayOfWeek)) return false;
  if ((!partial || present("startTime")) && !isTime(b.startTime)) return false;
  if ((!partial || present("endTime")) && !isTime(b.endTime)) return false;
  return ["teacher", "room", "mode", "location", "semester"].every(k => sec.optStr(b[k], 200));
}

app.post("/api/timetable", sec.requireAuth, adminOnly, (req, res) => {
  const b = req.body || {};
  if (!validTimetableBody(b, false)) return bad(res, "Unit, day, start time, and end time are required.");
  const session = {
    id: nextTimetableId++, unitCode: b.unitCode, dayOfWeek: b.dayOfWeek, startTime: b.startTime, endTime: b.endTime,
    teacher: b.teacher || "", room: b.room || "", mode: b.mode || "", location: b.location || "", semester: b.semester || "Semester 2, 2026"
  };
  timetableSessions.push(session);
  sec.audit("timetable_added", { actor: req.user.email, id: session.id });
  saveData();
  res.json({ success: true, timetableSessions });
});

app.put("/api/timetable/:id", sec.requireAuth, adminOnly, (req, res) => {
  const session = timetableSessions.find(t => t.id === Number(req.params.id));
  if (!session) return bad(res, "Session not found.", 404);
  const b = req.body || {};
  if (!validTimetableBody(b, true)) return bad(res, "Invalid timetable data.");
  for (const k of ["unitCode", "dayOfWeek", "startTime", "endTime", "teacher", "room", "mode", "location", "semester"]) {
    if (b[k] !== undefined && (b[k] !== "" || !["unitCode", "dayOfWeek", "startTime", "endTime"].includes(k))) session[k] = b[k];
  }
  sec.audit("timetable_updated", { actor: req.user.email, id: session.id });
  saveData();
  res.json({ success: true, timetableSessions });
});

app.delete("/api/timetable/:id", sec.requireAuth, adminOnly, (req, res) => {
  timetableSessions = timetableSessions.filter(t => t.id !== Number(req.params.id));
  sec.audit("timetable_deleted", { actor: req.user.email, id: Number(req.params.id) });
  saveData();
  res.json({ success: true, timetableSessions });
});

// ---- Students
// Responses never include password hashes, TOTP secrets or activation hashes (C1/C2).
app.get("/api/students", sec.requireAuth, staffOnly, (req, res) => {
  const scope = staffUnits(req);
  const list = scope ? students.filter(s => (s.unitCodes || []).some(c => scope.includes(c))) : students;
  res.json(list.map(publicStudent));
});

app.get("/api/students/me", sec.requireAuth, (req, res) => {
  if (req.user.role !== "student") return bad(res, "Student not found.", 404);
  res.json({ success: true, student: publicStudent(findStudentByEmail(req.user.email)) });
});

app.post("/api/students", sec.requireAuth, adminOnly, (req, res) => {
  const { name, email, unitCodes, studentId, joiningDate } = req.body || {};
  if (!sec.isStr(name, 120) || !sec.isEmail(email)) return bad(res, "Name and email required.");
  if (unitCodes !== undefined && !validUnitCodes(unitCodes)) return bad(res, "Invalid unit codes.");
  if (!sec.optStr(studentId, 40) || (joiningDate && !sec.isDate(joiningDate))) return bad(res, "Invalid student ID or date.");
  if (findStudentByEmail(email) || findStaffByEmail(email)) return bad(res, "A user with this email already exists.");
  if (studentId && students.find(s => s.studentId === studentId)) return bad(res, "A student with this Student ID already exists.");
  const codes = (unitCodes || []).filter(Boolean);
  const student = {
    id: nextStudentId++, name, email: norm(email), password: "",
    studentId: studentId && studentId.trim() ? studentId.trim() : generateStudentId(joiningDate),
    joiningDate: joiningDate || "", unitCodes: codes
  };
  const activationCode = newActivation(student);
  students.push(student);
  codes.forEach(code => {
    adjustEnrollment(code, 1);
    const unit = units.find(u => u.code === code);
    if (unit) notify(student.email, `You have been enrolled in ${unit.code} — ${unit.name}.`);
  });
  sec.audit("student_created", { actor: req.user.email, id: student.id });
  saveData();
  res.json({ success: true, students: students.map(publicStudent), activationCode, studentEmail: student.email });
});

// Admin re-issues an activation code (e.g. for students bulk-imported from Moodle).
app.post("/api/students/:id/activation", sec.requireAuth, adminOnly, (req, res) => {
  const student = students.find(s => s.id === Number(req.params.id));
  if (!student) return bad(res, "Student not found.", 404);
  const activationCode = newActivation(student);
  student.password = ""; // re-issuing resets credentials: this doubles as the admin password-reset path
  student.totpEnabled = false; delete student.totpSecret; delete student.totpPending;
  sec.audit("activation_reissued", { actor: req.user.email, id: student.id });
  saveData();
  res.json({ success: true, activationCode, studentEmail: student.email });
});

app.put("/api/students/:id", sec.requireAuth, adminOnly, (req, res) => {
  const student = students.find(s => s.id === Number(req.params.id));
  if (!student) return bad(res, "Student not found.", 404);
  const { name, email, unitCodes, studentId, joiningDate } = req.body || {};
  if ((name !== undefined && !sec.isStr(name, 120)) || (email !== undefined && !sec.isEmail(email)) ||
      (unitCodes !== undefined && !validUnitCodes(unitCodes)) || !sec.optStr(studentId, 40) ||
      (joiningDate && !sec.isDate(joiningDate))) return bad(res, "Invalid student data.");
  if (email && norm(email) !== student.email.toLowerCase() && (findStudentByEmail(email) || findStaffByEmail(email))) {
    return bad(res, "A user with this email already exists.");
  }
  if (unitCodes !== undefined) {
    const newCodes = unitCodes.filter(Boolean);
    const oldCodes = student.unitCodes || [];
    newCodes.filter(c => !oldCodes.includes(c)).forEach(code => {
      adjustEnrollment(code, 1);
      const unit = units.find(u => u.code === code);
      if (unit) notify(student.email, `You have been enrolled in ${unit.code} — ${unit.name}.`);
    });
    oldCodes.filter(c => !newCodes.includes(c)).forEach(code => adjustEnrollment(code, -1));
    student.unitCodes = newCodes;
  }
  // Whitelisted fields only: password, role and 2FA state can never be set through this route (mass-assignment).
  if (name) student.name = name;
  if (email) student.email = norm(email);
  if (studentId && studentId.trim()) student.studentId = studentId.trim();
  if (joiningDate !== undefined) student.joiningDate = joiningDate;
  sec.audit("student_updated", { actor: req.user.email, id: student.id });
  saveData();
  res.json({ success: true, students: students.map(publicStudent) });
});

app.delete("/api/students/:id", sec.requireAuth, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const student = students.find(s => s.id === id);
  if (student) (student.unitCodes || []).forEach(code => adjustEnrollment(code, -1));
  students = students.filter(s => s.id !== id);
  attendance = attendance.filter(a => a.studentId !== id);
  sec.audit("student_deleted", { actor: req.user.email, id });
  saveData();
  res.json({ success: true, students: students.map(publicStudent) });
});

// ---- Staff management (admin only): lecturers are scoped to specific units
app.get("/api/staff", sec.requireAuth, adminOnly, (req, res) => res.json(staff.map(publicStaff)));

app.post("/api/staff", sec.requireAuth, adminOnly, (req, res) => {
  const { name, email, unitCodes } = req.body || {};
  if (!sec.isStr(name, 120) || !sec.isEmail(email) || !validUnitCodes(unitCodes || [])) return bad(res, "Name, email and valid unit codes required.");
  if (findStudentByEmail(email) || findStaffByEmail(email)) return bad(res, "A user with this email already exists.");
  const member = { id: nextStaffId++, name, email: norm(email), role: "lecturer", unitCodes: unitCodes || [], password: "" };
  const activationCode = newActivation(member);
  staff.push(member);
  sec.audit("staff_created", { actor: req.user.email, id: member.id, role: member.role });
  saveData();
  res.json({ success: true, staff: staff.map(publicStaff), activationCode, staffEmail: member.email });
});

app.delete("/api/staff/:id", sec.requireAuth, adminOnly, (req, res) => {
  const target = staff.find(s => s.id === Number(req.params.id));
  if (!target) return bad(res, "Staff member not found.", 404);
  if (target.role === "admin" && staff.filter(s => s.role === "admin").length <= 1) return bad(res, "Cannot delete the last admin.");
  staff = staff.filter(s => s.id !== target.id);
  sec.audit("staff_deleted", { actor: req.user.email, id: target.id });
  saveData();
  res.json({ success: true, staff: staff.map(publicStaff) });
});

// ---- Fail-secure error handling (A2): detail goes to the log, never to the client
app.use("/api", (req, res) => res.status(404).json({ success: false, message: "Not found." }));
app.use((err, req, res, _next) => {
  const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error("[error]", err);
  res.status(status).json({ success: false, message: status === 500 ? "Internal server error." : status === 413 ? "Request too large." : "Bad request." });
});

if (require.main === module) {
  ready.then(() => {
    const port = Number(process.env.PORT) || 5000;
    app.listen(port, process.env.HOST || "localhost", () => console.log(`Server running on http://localhost:${port}`));
  });
}

module.exports = { app, ready };
