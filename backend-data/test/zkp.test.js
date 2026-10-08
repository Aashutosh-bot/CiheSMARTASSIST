// Tests for the opt-in zero-knowledge (Schnorr) login. Uses the real browser module (frontend/src/zkp.js)
// so client and server are proven compatible. Run: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "smartassist-zkp-"));
Object.assign(process.env, {
  DATA_FILE: path.join(tmp, "data.json"), AUDIT_LOG: path.join(tmp, "audit.log"),
  SESSION_SECRET: crypto.randomBytes(32).toString("hex"),
  ADMIN_EMAIL: "admin@cihe.edu.au", ADMIN_PASSWORD: "Correct-Horse-Battery-9",
  LOGIN_RATE_MAX: "10000", API_RATE_MAX: "100000"
});
const otplib = require("otplib");
const sec = require("../security");
const zkp = require("../zkp");
const { app, ready } = require("../index");

let server, base, client;
test.before(async () => {
  await ready;
  client = await import("../../frontend/src/zkp.js");
  await new Promise(r => { server = app.listen(0, "127.0.0.1", r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

class Http {
  constructor() { this.cookies = {}; }
  async req(method, url, body) {
    const headers = { "Content-Type": "application/json" };
    const cookie = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
    if (cookie) headers.Cookie = cookie;
    if (this.cookies.csrf && method !== "GET") headers["X-CSRF-Token"] = this.cookies.csrf;
    const res = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";"); const [k, v] = kv.split("=");
      if (v === "" || /max-age=0/i.test(c)) delete this.cookies[k]; else this.cookies[k] = v;
    }
    let json = null; try { json = await res.json(); } catch {}
    return { status: res.status, json };
  }
  get(u) { return this.req("GET", u); }
  post(u, b) { return this.req("POST", u, b); }
}
const adminSecret = () => JSON.parse(fs.readFileSync(process.env.DATA_FILE, "utf8")).staff.find(s => s.role === "admin").totpSecret;
const PW = "Maple-River-Lantern-88";

let adminHttp; // one admin session for the whole file (a TOTP code can only be used once)
async function admin() {
  if (!adminHttp) {
    adminHttp = new Http();
    const code = otplib.generateSync({ secret: adminSecret() });
    const r = await adminHttp.post("/api/admin-login", { email: "admin@cihe.edu.au", password: "Correct-Horse-Battery-9", code });
    assert.equal(r.status, 200);
  }
  return adminHttp;
}
async function makeStudent(email) {
  const adm = await admin();
  let r = await adm.post("/api/students", { name: "Zk Student", email, joiningDate: "2026-01-01", unitCodes: [] });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const act = r.json.activationCode;
  const s = new Http();
  r = await s.post("/api/set-password", { email, password: PW, activationCode: act });
  assert.equal(r.status, 200);
  return s;
}
async function passwordLoginAndEnrol(s, email) {
  let r = await s.post("/api/login", { email, password: PW });
  assert.equal(r.status, 200);
  r = await s.post("/api/zkp/enroll", await client.makeEnrolment(PW));
  assert.equal(r.status, 200, JSON.stringify(r.json));
}
async function proofFor(http, email, password) {
  const ch = (await http.post("/api/zkp/challenge", { email })).json;
  const p = await client.makeProof(email, password, ch);
  return { email, nonce: ch.nonce, ...p };
}

test("ZKP: enrolled user signs in with a proof; the password and secret are never sent or stored", async () => {
  const email = "zk1@cihe.edu.au";
  const s = await makeStudent(email);
  await passwordLoginAndEnrol(s, email);
  const fresh = new Http();
  const body = await proofFor(fresh, email, PW);
  assert.ok(!JSON.stringify(body).includes(PW), "request must not contain the password");
  assert.deepEqual(Object.keys(body).sort(), ["email", "nonce", "s", "t"]);
  const r = await fresh.post("/api/zkp/login", body);
  assert.equal(r.status, 200); assert.equal(r.json.role, "student");
  assert.ok(fresh.cookies.sid, "session cookie issued");
  assert.equal((await fresh.get("/api/me")).status, 200);
  const stored = JSON.parse(fs.readFileSync(process.env.DATA_FILE, "utf8")).students.find(x => x.email === email);
  assert.deepEqual(Object.keys(stored.zkp).sort(), ["salt", "y"]);
  assert.ok(!JSON.stringify(stored.zkp).includes(PW));
});

test("ZKP: a wrong password produces a proof the server rejects", async () => {
  const email = "zk2@cihe.edu.au";
  await passwordLoginAndEnrol(await makeStudent(email), email);
  const h = new Http();
  const r = await h.post("/api/zkp/login", await proofFor(h, email, "Totally-Wrong-Password-1"));
  assert.equal(r.status, 401); assert.ok(!h.cookies.sid);
});

test("ZKP: a captured valid proof cannot be replayed (single-use challenge)", async () => {
  const email = "zk3@cihe.edu.au";
  await passwordLoginAndEnrol(await makeStudent(email), email);
  const h = new Http();
  const body = await proofFor(h, email, PW);
  assert.equal((await h.post("/api/zkp/login", body)).status, 200);
  const attacker = new Http();
  assert.equal((await attacker.post("/api/zkp/login", body)).status, 401, "replay must fail");
});

test("ZKP: a challenge is bound to one email and a tampered response fails", async () => {
  const a = "zk4@cihe.edu.au", b = "zk5@cihe.edu.au";
  await passwordLoginAndEnrol(await makeStudent(a), a);
  await passwordLoginAndEnrol(await makeStudent(b), b);
  const h = new Http();
  const body = await proofFor(h, a, PW);
  assert.equal((await h.post("/api/zkp/login", { ...body, email: b })).status, 401, "proof for A must not log in B");
  const body2 = await proofFor(h, a, PW);
  const tampered = { ...body2, s: (BigInt("0x" + body2.s) ^ 1n).toString(16) };
  assert.equal((await h.post("/api/zkp/login", tampered)).status, 401);
  assert.equal((await h.post("/api/zkp/login", { email: a, nonce: "f".repeat(48), t: body2.t, s: body2.s })).status, 401, "unknown nonce");
});

test("ZKP: repeated bad proofs lock the account (same lockout as passwords)", async () => {
  const email = "zk6@cihe.edu.au";
  await passwordLoginAndEnrol(await makeStudent(email), email);
  const h = new Http();
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await h.post("/api/zkp/login", await proofFor(h, email, "Wrong-Guess-Number-" + i))).status);
  assert.deepEqual(codes, [401, 401, 401, 401, 401, 429, 429]);
  assert.equal((await h.post("/api/zkp/login", await proofFor(h, email, PW))).status, 429, "even the right proof is refused while locked");
});

test("ZKP: malformed or weak enrolment keys are rejected", async () => {
  const email = "zk7@cihe.edu.au";
  const s = await makeStudent(email);
  assert.equal((await s.post("/api/login", { email, password: PW })).status, 200);
  const salt = "a".repeat(32);
  for (const y of ["0", "1", (zkp.P - 1n).toString(16), zkp.P.toString(16), "zz", ""]) {
    const r = await s.post("/api/zkp/enroll", { salt, y });
    assert.equal(r.status, 400, "y=" + y);
  }
  let nonMember = 3n; while (zkp.modPow(nonMember, zkp.Q, zkp.P) === 1n) nonMember++; // outside the order-q subgroup
  assert.equal((await s.post("/api/zkp/enroll", { salt, y: nonMember.toString(16) })).status, 400, "not in the prime-order subgroup");
  assert.equal((await s.post("/api/zkp/enroll", { salt: "short", y: "4" })).status, 400);
  assert.equal((await new Http().post("/api/zkp/enroll", { salt, y: "4" })).status, 401, "enrolment needs a session");
});

test("ZKP: changing the password invalidates the old ZKP key", async () => {
  const email = "zk8@cihe.edu.au";
  const s = await makeStudent(email);
  await passwordLoginAndEnrol(s, email);
  const NEW = "River-Lantern-Maple-99";
  assert.equal((await s.post("/api/change-password", { currentPassword: PW, newPassword: NEW })).status, 200);
  const h = new Http();
  assert.equal((await h.post("/api/zkp/login", await proofFor(h, email, PW))).status, 401);
  assert.equal((await h.post("/api/zkp/login", await proofFor(h, email, NEW))).status, 401, "must re-enrol after a change");
});

test("ZKP: accounts that require 2FA cannot bypass it with a proof", async () => {
  const adm = await admin();
  assert.equal((await adm.post("/api/zkp/enroll", await client.makeEnrolment("Correct-Horse-Battery-9"))).status, 200);
  const h = new Http();
  const r = await h.post("/api/zkp/login", await proofFor(h, "admin@cihe.edu.au", "Correct-Horse-Battery-9"));
  assert.equal(r.status, 403); assert.ok(!h.cookies.sid, "no session without the second factor");
});

test("ZKP: the challenge endpoint does not reveal which accounts are enrolled", async () => {
  const email = "zk9@cihe.edu.au";
  await passwordLoginAndEnrol(await makeStudent(email), email);
  const h = new Http();
  const known = (await h.post("/api/zkp/challenge", { email })).json;
  const unknown = (await h.post("/api/zkp/challenge", { email: "nobody@cihe.edu.au" })).json;
  assert.deepEqual(Object.keys(known).sort(), Object.keys(unknown).sort());
  assert.equal(known.salt.length, unknown.salt.length);
  const again = (await h.post("/api/zkp/challenge", { email: "nobody@cihe.edu.au" })).json;
  assert.equal(unknown.salt, again.salt, "decoy salt is stable");
});
