#!/usr/bin/env node
/**
 * Advanced security test: automated penetration + fuzzing run against the live API.
 * Zero dependencies (Node 18+). Usage:   node advanced_security_test.js [http://localhost:5000]
 *
 * Covers: unauthenticated endpoint sweep, forged/tampered tokens (JWT alg=none, bad signature),
 * input fuzzing (SQLi, NoSQL operators, XSS, prototype pollution, oversized, wrong types,
 * malformed JSON), information leakage (stack traces, X-Powered-By), security headers,
 * and brute-force lockout / rate limiting.
 *
 * IMPORTANT: run this against a SEPARATE test instance (own port + data file) started with
 * LOGIN_RATE_MAX=1000, otherwise the login rate limiter (30/15 min) answers 429 to most fuzz
 * requests and the fuzzing is inconclusive. The script detects this and says so.
 */
const BASE = (process.argv[2] || "http://localhost:5000").replace(/\/$/, "");
const results = [];
let currentStage = "";

function record(name, pass, detail) {
  results.push({ stage: currentStage, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
}
function stage(title) { currentStage = title; console.log(`\n=== ${title} ===`); }

async function call(method, path, { body, headers = {}, raw } = {}) {
  const opts = { method, headers: { ...headers }, redirect: "manual" };
  if (raw !== undefined) { opts.body = raw; opts.headers["content-type"] ??= "application/json"; }
  else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers["content-type"] = "application/json"; }
  try {
    const res = await fetch(BASE + path, opts);
    const text = await res.text();
    return { status: res.status, headers: res.headers, text };
  } catch (e) { return { status: 0, headers: new Headers(), text: String(e) }; }
}
const b64u = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");

(async () => {
  console.log(`Target: ${BASE}`);
  const probe = await call("GET", "/api/me");
  if (probe.status === 0) { console.error("Cannot reach the server. Start the backend first."); process.exit(2); }

  // ---------- 1. Unauthenticated sweep ----------
  stage("1. Unauthenticated endpoint sweep (no cookie, no token)");
  const protectedRoutes = [
    ["GET", "/api/me"], ["GET", "/api/students"], ["GET", "/api/students/me"], ["GET", "/api/staff"],
    ["GET", "/api/attendance"], ["GET", "/api/attendance/student/student@cihe.edu.au"],
    ["GET", "/api/assessments"], ["GET", "/api/units"], ["GET", "/api/timetable"], ["GET", "/api/notifications"],
    ["POST", "/api/students"], ["PUT", "/api/students/1"], ["DELETE", "/api/students/1"],
    ["POST", "/api/staff"], ["DELETE", "/api/staff/1"], ["POST", "/api/units"], ["DELETE", "/api/units/ICT306"],
    ["POST", "/api/timetable"], ["DELETE", "/api/timetable/1"], ["POST", "/api/attendance"],
    ["DELETE", "/api/attendance/1"], ["POST", "/api/assessments"], ["POST", "/api/change-password"],
    ["POST", "/api/2fa/setup"], ["POST", "/api/students/1/activation"], ["POST", "/api/zkp/enroll"],
  ];
  for (const [m, p] of protectedRoutes) {
    const r = await call(m, p, m === "GET" || m === "DELETE" ? {} : { body: {} });
    record(`${m} ${p} without login`, r.status === 401 || r.status === 403, `HTTP ${r.status}`);
  }

  // ---------- 2. Token forgery ----------
  stage("2. Forged and tampered session tokens");
  const claims = { email: "admin@cihe.edu.au", role: "admin", jti: "x", iss: "cihe-smartassist", exp: Math.floor(Date.now() / 1000) + 3600 };
  const forged = {
    "JWT alg=none, admin claims": `${b64u({ alg: "none", typ: "JWT" })}.${b64u(claims)}.`,
    "JWT signed with guessed secret 'secret'": (() => {
      const h = b64u({ alg: "HS256", typ: "JWT" }), p = b64u(claims);
      const sig = require("crypto").createHmac("sha256", "secret").update(`${h}.${p}`).digest("base64url");
      return `${h}.${p}.${sig}`;
    })(),
    "Garbage token": "not.a.token",
    "Empty token": "",
  };
  const cookieNames = ["token", "session", "sid", "jwt", "auth", "cihe_session", "__Host-session"];
  for (const [label, tok] of Object.entries(forged)) {
    let leaked = false, last = 0;
    for (const c of cookieNames) {
      const r = await call("GET", "/api/students", { headers: { cookie: `${c}=${tok}`, authorization: `Bearer ${tok}` } });
      last = r.status; if (r.status === 200) leaked = true;
    }
    record(`${label} cannot read /api/students`, !leaked, `last HTTP ${last}`);
  }

  // ---------- 3. Input fuzzing ----------
  stage("3. Input fuzzing on public endpoints (expect no 200, no 5xx, no stack traces)");
  const payloads = [
    ["SQL injection", `' OR '1'='1' --`], ["SQL union", `admin@cihe.edu.au' UNION SELECT * FROM users--`],
    ["NoSQL operator object", { $ne: null }], ["NoSQL $gt object", { $gt: "" }],
    ["XSS script", `<script>alert(1)</script>`], ["Path traversal", `../../../../etc/passwd`],
    ["Null byte", "admin@cihe.edu.au\u0000"], ["Unicode homoglyph admin", "аdmin@cihe.edu.au"],
    ["Very long string (9 KB)", "A".repeat(9000)], ["Number instead of string", 12345],
    ["Array instead of string", ["a", "b"]], ["null", null], ["Boolean true", true],
    ["Template injection", "${7*7}{{7*7}}"], ["Command injection", "; cat /etc/passwd"],
  ];
  const targets = ["/api/check-email", "/api/login", "/api/admin-login", "/api/zkp/challenge", "/api/zkp/login"];
  for (const t of targets) {
    let bad = [], limited = 0;
    for (const [label, v] of payloads) {
      const r = await call("POST", t, { body: { email: v, password: v, code: v, activationCode: v } });
      if (r.status === 429) limited++;
      const stackLeak = /at .*\.js:\d+|node_modules|SyntaxError|TypeError|ReferenceError|ECONN/i.test(r.text);
      if (r.status === 200 && t !== "/api/check-email" && t !== "/api/zkp/challenge") bad.push(`${label}: 200`);
      if (r.status >= 500) bad.push(`${label}: ${r.status}`);
      if (stackLeak) bad.push(`${label}: stack/internal detail leaked`);
    }
    if (limited > payloads.length / 2) bad.push(`INCONCLUSIVE: ${limited}/${payloads.length} answered 429 (rate limited). Restart the test instance with LOGIN_RATE_MAX=1000`);
    record(`${payloads.length} fuzz payloads to POST ${t}`, bad.length === 0, bad.join("; ") || "all rejected cleanly (no 200, no 5xx, no stack trace)");
  }

  const proto = await call("POST", "/api/login", { raw: `{"email":"a@b.co","password":"x","__proto__":{"admin":true},"constructor":{"prototype":{"admin":true}}}` });
  record("Prototype pollution attempt rejected", proto.status !== 200 && proto.status !== 429 && proto.status < 500, `HTTP ${proto.status}` + (proto.status === 429 ? " (rate limited: inconclusive)" : ""));

  const malformed = await call("POST", "/api/login", { raw: `{"email": "a@b.co", "password": ` });
  record("Malformed JSON gives 400 without stack trace", malformed.status === 400 && !/at .*\.js|node_modules/.test(malformed.text), `HTTP ${malformed.status}`);

  const big = await call("POST", "/api/login", { raw: JSON.stringify({ email: "a@b.co", password: "A".repeat(20000) }) });
  record("Oversized body (20 KB) refused", big.status === 413 || big.status === 400, `HTTP ${big.status}`);

  const wrongType = await call("POST", "/api/login", { raw: `"just a string"` });
  record("Non-object JSON body handled", wrongType.status >= 400 && wrongType.status < 500, `HTTP ${wrongType.status}`);

  // ---------- 4. Info leakage + headers ----------
  stage("4. Information leakage and security headers");
  const h = (await call("GET", "/api/me")).headers;
  record("X-Powered-By header removed", !h.get("x-powered-by"), h.get("x-powered-by") || "absent");
  record("Content-Security-Policy present", !!h.get("content-security-policy"));
  record("X-Content-Type-Options: nosniff", (h.get("x-content-type-options") || "").toLowerCase() === "nosniff", h.get("x-content-type-options") || "missing");
  record("Clickjacking protection (frame-ancestors or X-Frame-Options)", /frame-ancestors/i.test(h.get("content-security-policy") || "") || !!h.get("x-frame-options"));
  record("Referrer-Policy present", !!h.get("referrer-policy"), h.get("referrer-policy") || "missing");
  record("CORS does not allow arbitrary origin",
    (await call("GET", "/api/me", { headers: { origin: "https://evil.example" } })).headers.get("access-control-allow-origin") !== "https://evil.example");
  const nf = await call("GET", "/api/does-not-exist");
  record("404 is generic JSON, no framework page", nf.status === 404 && !/Cannot GET|<html/i.test(nf.text), `HTTP ${nf.status}`);
  record("Unknown method on login rejected", (await call("PUT", "/api/login", { body: {} })).status !== 200);

  // ---------- 5. Brute force ----------
  stage("5. Brute force against one account (account lockout)");
  const victim = `fuzz.victim.${Date.now()}@cihe.edu.au`;
  const codes = [];
  for (let i = 0; i < 20; i++) {
    const r = await call("POST", "/api/login", { body: { email: victim, password: `Wrong-guess-${i}-xyz` } });
    codes.push(r.status);
  }
  const firstBlock = codes.indexOf(429);
  record("No guess succeeded in 20 attempts", !codes.includes(200), `statuses: ${codes.join(" ")}`);
  record("Account locked after 5 failures (HTTP 429 from attempt 6)", firstBlock === 5, firstBlock === -1 ? "never blocked" : `first 429 at attempt ${firstBlock + 1}`);

  // ---------- summary ----------
  const failed = results.filter((r) => !r.pass);
  console.log(`\n==================================================`);
  console.log(`TOTAL: ${results.length} checks, ${results.length - failed.length} passed, ${failed.length} failed`);
  if (failed.length) { console.log("Failed checks:"); failed.forEach((f) => console.log(` - [${f.stage}] ${f.name} (${f.detail || ""})`)); }
  console.log("Stop the test instance when done (Ctrl+C in its window).");
  process.exit(failed.length ? 1 : 0);
})();
