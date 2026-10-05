// Security regression tests: one or more checks per requirement ID (C1-C5, I1-I3, A1-A2, AU1-AU4).
// Run: npm test   (uses node:test, no extra dependencies; isolated temp data/audit files)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "smartassist-"));
const DATA_KEY = crypto.randomBytes(32).toString("hex");
Object.assign(process.env, {
  DATA_FILE: path.join(tmp, "data.json"), AUDIT_LOG: path.join(tmp, "audit.log"), DATA_KEY,
  SESSION_SECRET: crypto.randomBytes(32).toString("hex"),
  ADMIN_EMAIL: "admin@cihe.edu.au", ADMIN_PASSWORD: "Correct-Horse-Battery-9",
  LOGIN_RATE_MAX: "10000", API_RATE_MAX: "100000"
});
const otplib = require("otplib");
const jwt = require("jsonwebtoken");
const sec = require("../security");
const { app, ready } = require("../index");

let server, base;
test.before(async () => {
  await ready;
  await new Promise(r => { server = app.listen(0, "127.0.0.1", r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

// Minimal cookie-jar client
class Client {
  constructor() { this.cookies = {}; }
  async req(method, url, body, opts = {}) {
    const headers = { "Content-Type": "application/json" };
    const cookie = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
    if (cookie) headers.Cookie = cookie;
    if (this.cookies.csrf && opts.csrf !== false && method !== "GET") headers["X-CSRF-Token"] = this.cookies.csrf;
    const res = await fetch(base + url, { method, headers, body: body === undefined ? undefined : (opts.raw ? body : JSON.stringify(body)) });
    for (const c of res.headers.getSetCookie()) {
      const [kv, ...attrs] = c.split(";"); const [k, v] = kv.split("=");
      if (/max-age=0|expires=thu, 01 jan 1970/i.test(attrs.join(";")) || v === "") delete this.cookies[k]; else this.cookies[k] = v;
    }
    let json = null; try { json = await res.clone().json(); } catch {}
    return { status: res.status, json, headers: res.headers };
  }
  get(u) { return this.req("GET", u); }
  post(u, b, o) { return this.req("POST", u, b, o); }
  put(u, b) { return this.req("PUT", u, b); }
  del(u) { return this.req("DELETE", u); }
}

const adminSecret = () => {
  const d = JSON.parse(sec.decryptData(fs.readFileSync(process.env.DATA_FILE, "utf8"), Buffer.from(DATA_KEY, "hex")));
  return d.staff.find(s => s.role === "admin").totpSecret;
};
const STRONG = "Tr0ub4dor-and-3-horses";
const admin = new Client();

test("AU2: admin login requires a valid TOTP code and a code cannot be replayed", async () => {
  const a = new Client();
  let r = await a.post("/api/admin-login", { email: "admin@cihe.edu.au", password: "Correct-Horse-Battery-9" });
  assert.equal(r.status, 401); assert.equal(r.json.requires2fa, true);
  r = await a.post("/api/admin-login", { email: "admin@cihe.edu.au", password: "Correct-Horse-Battery-9", code: "000000" });
  assert.equal(r.status, 401);
  const code = otplib.generateSync({ secret: adminSecret() });
  r = await admin.post("/api/admin-login", { email: "admin@cihe.edu.au", password: "Correct-Horse-Battery-9", code });
  assert.equal(r.status, 200); assert.equal(r.json.role, "admin");
  r = await a.post("/api/admin-login", { email: "admin@cihe.edu.au", password: "Correct-Horse-Battery-9", code });
  assert.equal(r.status, 401, "same code must be rejected the second time");
});

test("AU1/I3: every protected route rejects unauthenticated requests", async () => {
  const anon = new Client();
  const routes = ["GET /api/units", "GET /api/students", "GET /api/attendance", "GET /api/assessments", "GET /api/timetable",
    "GET /api/notifications", "GET /api/students/me", "GET /api/me", "GET /api/staff", "POST /api/units", "POST /api/students",
    "DELETE /api/students/1", "PUT /api/students/1", "POST /api/attendance", "DELETE /api/attendance/1", "POST /api/assessments",
    "POST /api/timetable", "POST /api/change-password", "POST /api/2fa/setup", "POST /api/staff"];
  for (const r of routes) {
    const [m, u] = r.split(" ");
    const res = await anon.req(m, u, m === "GET" ? undefined : {});
    assert.equal(res.status, 401, `${r} should be 401, got ${res.status}`);
  }
});

test("I2: state-changing requests without a CSRF token are rejected", async () => {
  const r = await admin.post("/api/units", { code: "ICT999", name: "X" }, { csrf: false });
  assert.equal(r.status, 403);
});

let studentA, studentB, aCode, bCode;
test("C1/AU: activation code required to set a password; weak passwords rejected; code is single-use", async () => {
  let r = await admin.post("/api/students", { name: "Alice A", email: "alice@cihe.edu.au", unitCodes: ["ICT307"] });
  assert.equal(r.status, 200); aCode = r.json.activationCode;
  r = await admin.post("/api/students", { name: "Bob B", email: "bob@cihe.edu.au", unitCodes: ["ICT301"] });
  bCode = r.json.activationCode;
  assert.ok(r.json.students.every(s => !("password" in s) && !("activation" in s)));
  const anon = new Client();
  r = await anon.post("/api/set-password", { email: "alice@cihe.edu.au", password: STRONG });
  assert.equal(r.status, 400, "no activation code");
  r = await anon.post("/api/set-password", { email: "alice@cihe.edu.au", password: STRONG, activationCode: "wrong-code-123" });
  assert.equal(r.status, 400);
  r = await anon.post("/api/set-password", { email: "alice@cihe.edu.au", password: "short", activationCode: aCode });
  assert.equal(r.status, 400); assert.match(r.json.message, /12 characters/);
  r = await anon.post("/api/set-password", { email: "alice@cihe.edu.au", password: "password123", activationCode: aCode });
  assert.equal(r.status, 400);
  r = await anon.post("/api/set-password", { email: "alice@cihe.edu.au", password: STRONG, activationCode: aCode });
  assert.equal(r.status, 200);
  r = await anon.post("/api/set-password", { email: "alice@cihe.edu.au", password: STRONG + "x", activationCode: aCode });
  assert.equal(r.status, 400, "code is single use");
  await anon.post("/api/set-password", { email: "bob@cihe.edu.au", password: STRONG, activationCode: bCode });
  studentA = new Client(); studentB = new Client();
  assert.equal((await studentA.post("/api/login", { email: "alice@cihe.edu.au", password: STRONG })).status, 200);
  assert.equal((await studentB.post("/api/login", { email: "bob@cihe.edu.au", password: STRONG })).status, 200);
});

test("C1/C2: no plaintext secrets at rest; data file encrypted; hashes are Argon2id", async () => {
  const raw = fs.readFileSync(process.env.DATA_FILE, "utf8");
  assert.ok(!raw.includes("alice@cihe.edu.au"), "data file must be encrypted");
  const d = JSON.parse(sec.decryptData(raw, Buffer.from(DATA_KEY, "hex")));
  assert.ok(!JSON.stringify(d).includes(STRONG));
  assert.ok(d.students.filter(s => s.password).every(s => s.password.startsWith("$argon2id$")));
  assert.ok(d.staff.every(s => s.password.startsWith("$argon2id$")));
  const src = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");
  assert.ok(!/admin123|password123/.test(src), "no hardcoded credentials in source");
});

test("A1: generic login errors, no user enumeration, lockout after repeated failures", async () => {
  const c = new Client();
  const bad1 = await c.post("/api/login", { email: "alice@cihe.edu.au", password: "wrong-password-1" });
  const bad2 = await c.post("/api/login", { email: "nobody@cihe.edu.au", password: "wrong-password-1" });
  assert.equal(bad1.status, 401); assert.equal(bad2.status, 401);
  assert.equal(bad1.json.message, bad2.json.message);
  const e1 = await c.post("/api/check-email", { email: "nobody@cihe.edu.au" });
  assert.equal(e1.json.hasPassword, true, "unknown email looks like an existing account");
  let last;
  for (let i = 0; i < 6; i++) last = await c.post("/api/login", { email: "bob@cihe.edu.au", password: "wrong-password-" + i });
  assert.equal(last.status, 429, "locked");
  const ok = await c.post("/api/login", { email: "bob@cihe.edu.au", password: STRONG });
  assert.equal(ok.status, 429, "even the right password is refused while locked");
  sec.resetLockouts();
});

test("I3/IDOR: students cannot read others' data or use admin routes", async () => {
  assert.equal((await studentA.get("/api/students")).status, 403);
  assert.equal((await studentA.get("/api/attendance")).status, 403);
  assert.equal((await studentA.get("/api/staff")).status, 403);
  assert.equal((await studentA.post("/api/units", { code: "ICT998", name: "Hack" })).status, 403);
  assert.equal((await studentA.del("/api/students/1")).status, 403);
  assert.equal((await studentA.put("/api/students/1", { name: "pwned" })).status, 403);
  assert.equal((await studentA.get("/api/attendance/student/bob@cihe.edu.au")).status, 403);
  assert.equal((await studentA.get("/api/attendance/student/alice@cihe.edu.au")).status, 200);
  const me = await studentA.get("/api/students/me?email=bob@cihe.edu.au");
  assert.equal(me.json.student.email, "alice@cihe.edu.au", "?email= is ignored; session decides");
  assert.ok(!("password" in me.json.student));
  await admin.post("/api/attendance", { studentId: 2, unitCode: "ICT301", date: "2026-10-01", status: "Present" }).catch(() => {});
});

test("I3: lecturers are limited to their own units", async () => {
  let r = await admin.post("/api/staff", { name: "Lee Lecturer", email: "lee@cihe.edu.au", unitCodes: ["ICT307"] });
  assert.equal(r.status, 200);
  const anon = new Client();
  r = await anon.post("/api/set-password", { email: "lee@cihe.edu.au", password: STRONG, activationCode: r.json.activationCode });
  assert.equal(r.status, 200); assert.ok(r.json.totpUri, "lecturer gets 2FA enrolment");
  const secret = new URL(r.json.totpUri).searchParams.get("secret");
  const lee = new Client();
  r = await lee.post("/api/admin-login", { email: "lee@cihe.edu.au", password: STRONG, code: otplib.generateSync({ secret }) });
  assert.equal(r.status, 200); assert.equal(r.json.role, "lecturer");
  const sid = (await admin.get("/api/students")).json.find(s => s.email === "alice@cihe.edu.au").id;
  assert.equal((await lee.post("/api/attendance", { studentId: sid, unitCode: "ICT307", date: "2026-10-01", status: "Present" })).status, 200);
  assert.equal((await lee.post("/api/attendance", { studentId: sid, unitCode: "ICT301", date: "2026-10-01", status: "Present" })).status, 403);
  assert.equal((await lee.post("/api/units", { code: "ICT997", name: "Nope" })).status, 403);
  assert.equal((await lee.post("/api/assessments", { unitCode: "ICT301", title: "t", dueDate: "2026-11-01" })).status, 403);
  const list = (await lee.get("/api/students")).json;
  assert.ok(list.every(s => s.unitCodes.includes("ICT307")), "only own-unit students visible");
});

test("AU1: forged, tampered and 'alg:none' session tokens are rejected", async () => {
  const forge = (token) => fetch(base + "/api/students", { headers: { Cookie: `sid=${token}` } }).then(r => r.status);
  assert.equal(await forge(jwt.sign({ email: "admin@cihe.edu.au", role: "admin", jti: "x" }, "wrong-secret", { issuer: "cihe-smartassist" })), 401);
  const none = Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url") + "." + Buffer.from(JSON.stringify({ email: "admin@cihe.edu.au", role: "admin", jti: "y", iss: "cihe-smartassist" })).toString("base64url") + ".";
  assert.equal(await forge(none), 401);
  assert.equal(await forge("garbage"), 401);
  const c = new Client(); // localStorage-style role tampering is meaningless: only the signed cookie counts
  c.cookies.sid = studentA.cookies.sid; c.cookies.csrf = studentA.cookies.csrf;
  assert.equal((await c.get("/api/staff")).status, 403);
});

test("AU1: logout revokes the session", async () => {
  const c = new Client();
  await c.post("/api/login", { email: "alice@cihe.edu.au", password: STRONG });
  const old = { ...c.cookies };
  assert.equal((await c.get("/api/me")).status, 200);
  await c.post("/api/logout", {});
  const replay = await fetch(base + "/api/me", { headers: { Cookie: `sid=${old.sid}` } });
  assert.equal(replay.status, 401);
});

test("AU1: session cookie is HttpOnly + SameSite=Strict", async () => {
  const res = await fetch(base + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "alice@cihe.edu.au", password: STRONG }) });
  const sid = res.headers.getSetCookie().find(c => c.startsWith("sid="));
  assert.match(sid, /HttpOnly/i); assert.match(sid, /SameSite=Strict/i);
});

test("I1: input validation rejects injection payloads and oversized bodies", async () => {
  assert.equal((await admin.post("/api/units", { code: "ICT1'; DROP TABLE users;--", name: "x" })).status, 400);
  assert.equal((await admin.post("/api/students", { name: "ok", email: "not-an-email" })).status, 400);
  assert.equal((await admin.post("/api/students", { name: "ok", email: "x@cihe.edu.au", unitCodes: ["<script>"] })).status, 400);
  assert.equal((await admin.post("/api/timetable", { unitCode: "ICT307", dayOfWeek: "Funday", startTime: "10:00", endTime: "11:00" })).status, 400);
  const big = await admin.post("/api/units", { code: "ICT996", name: "x".repeat(20000) });
  assert.equal(big.status, 413);
  const login = await new Client().post("/api/login", { email: { $ne: null }, password: { $ne: null } });
  assert.equal(login.status, 401, "NoSQL-style object payloads are rejected as invalid types");
});

test("I1: mass assignment cannot set password, role or 2FA fields", async () => {
  const sid = (await admin.get("/api/students")).json.find(s => s.email === "bob@cihe.edu.au").id;
  await admin.put(`/api/students/${sid}`, { name: "Bob B", password: "x", role: "admin", totpEnabled: true });
  const bob = (await admin.get("/api/students")).json.find(s => s.id === sid);
  assert.ok(!bob.role);
  const r = await new Client().post("/api/login", { email: "bob@cihe.edu.au", password: STRONG });
  assert.equal(r.status, 200, "password unchanged and 2FA not forced by mass assignment");
});

test("A2: errors are generic and do not leak internals", async () => {
  const r = await fetch(base + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{bad json" });
  const t = await r.text();
  assert.equal(r.status, 400); assert.ok(!/at |node_modules|SyntaxError|\/home|\\/.test(t), t);
  const nf = await fetch(base + "/api/does-not-exist");
  assert.equal(nf.status, 404);
});

test("C3/A2: security headers present, X-Powered-By removed", async () => {
  const r = await fetch(base + "/api/units");
  assert.equal(r.headers.get("x-powered-by"), null);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.match(r.headers.get("content-security-policy"), /default-src 'none'/);
  assert.ok(r.headers.get("x-frame-options") || /frame-ancestors/.test(r.headers.get("content-security-policy")));
});

test("AU4: audit log records security events and never contains secrets", async () => {
  const log = fs.readFileSync(process.env.AUDIT_LOG, "utf8");
  for (const ev of ["login_success", "login_failure", "account_locked", "authz_denied", "csrf_rejected", "account_activated"]) {
    assert.ok(log.includes(`"event":"${ev}"`), `missing ${ev}`);
  }
  assert.ok(!log.includes(STRONG) && !log.includes("wrong-password") && !log.includes(aCode));
});
