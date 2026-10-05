// ICT306 security layer for the SmartAssist Node backend.
// Maps to requirement IDs in docs/security-requirements (C1-C5, I1-I3, A1-A2, AU1-AU4).
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const otplib = require("otplib");
const rateLimit = require("express-rate-limit");

const IS_PROD = process.env.NODE_ENV === "production";

// ---------------------------------------------------------------- secrets
// AU1/C5: the session signing key comes from the environment, never from code.
let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  if (IS_PROD) throw new Error("SESSION_SECRET must be set in production.");
  SESSION_SECRET = crypto.randomBytes(48).toString("hex");
  console.warn("[security] SESSION_SECRET not set - using a random one (sessions reset on restart).");
}
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS) || 60 * 60;

// ---------------------------------------------------------------- C1: passwords
const ARGON_OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }; // OWASP minimum profile

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "123456789012", "qwertyuiopas", "admin123", "admin1234567",
  "letmein12345", "welcome12345", "iloveyou1234", "changeme1234", "cihe2026cihe"
]);

function hashPassword(plain) {
  return argon2.hash(plain, ARGON_OPTS);
}
async function verifyPassword(hash, plain) {
  if (typeof hash !== "string" || !hash.startsWith("$argon2")) return false;
  try { return await argon2.verify(hash, plain); } catch { return false; }
}
// Dummy hash so unknown users cost the same time as known ones (no timing oracle).
let DUMMY_HASH;
async function dummyVerify(plain) {
  if (!DUMMY_HASH) DUMMY_HASH = await hashPassword("dummy-password-for-timing");
  await verifyPassword(DUMMY_HASH, plain);
}

// NIST SP 800-63B style: length over composition rules, block common passwords.
function passwordPolicyError(pw, email = "") {
  if (typeof pw !== "string") return "Password is required.";
  if (pw.length < 12) return "Password must be at least 12 characters.";
  if (pw.length > 128) return "Password must be at most 128 characters.";
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) return "That password is too common.";
  const local = String(email).split("@")[0].toLowerCase();
  if (local.length >= 4 && pw.toLowerCase().includes(local)) return "Password must not contain your email name.";
  return null;
}

// ---------------------------------------------------------------- I1: validation
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const UNIT_RE = /^[A-Z]{3}\d{3}$/;
const isEmail = v => typeof v === "string" && v.length <= 320 && EMAIL_RE.test(v);
const isUnitCode = v => typeof v === "string" && UNIT_RE.test(v);
const isStr = (v, max = 200) => typeof v === "string" && v.length > 0 && v.length <= max;
const optStr = (v, max = 200) => v === undefined || v === "" || (typeof v === "string" && v.length <= max);
const isDate = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const normEmail = v => String(v || "").trim().toLowerCase();

// ---------------------------------------------------------------- AU4: audit log
const AUDIT_FILE = process.env.AUDIT_LOG || path.join(__dirname, "audit.log");
function audit(event, details = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), event, ...details });
  try { fs.appendFileSync(AUDIT_FILE, line + "\n"); } catch (e) { console.error("[audit] write failed:", e.message); }
  if (event === "account_locked" || event === "authz_denied_burst") console.warn("[ALERT]", line);
}

// ---------------------------------------------------------------- A1: lockout + rate limiting
const MAX_FAILS = Number(process.env.MAX_LOGIN_FAILS) || 5;
const LOCK_MS = Number(process.env.LOCKOUT_MS) || 15 * 60 * 1000;
const fails = new Map(); // key -> { count, until }
function isLocked(key) {
  const f = fails.get(key);
  if (!f) return false;
  if (f.until && f.until > Date.now()) return true;
  if (f.until && f.until <= Date.now()) fails.delete(key);
  return false;
}
function recordFailure(key, ip) {
  const f = fails.get(key) || { count: 0, until: 0 };
  f.count += 1;
  if (f.count >= MAX_FAILS) {
    f.until = Date.now() + LOCK_MS;
    f.count = 0;
    audit("account_locked", { account: key, ip });
  }
  fails.set(key, f);
}
const clearFailures = key => fails.delete(key);
function resetLockouts() { fails.clear(); }

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Try again later." },
  handler: (req, res, _next, opts) => {
    audit("rate_limited", { ip: req.ip, path: req.path });
    res.status(429).json(opts.message);
  }
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.API_RATE_MAX) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests." }
});

// ---------------------------------------------------------------- AU1: sessions + I2: CSRF
const revoked = new Map(); // jti -> exp (seconds)
function pruneRevoked() {
  const now = Math.floor(Date.now() / 1000);
  for (const [k, exp] of revoked) if (exp < now) revoked.delete(k);
}

const cookieBase = { sameSite: "strict", secure: IS_PROD, path: "/" };

function issueSession(res, user) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ email: user.email, role: user.role, jti }, SESSION_SECRET, {
    algorithm: "HS256", expiresIn: SESSION_TTL_SECONDS, issuer: "cihe-smartassist"
  });
  const csrf = crypto.randomBytes(24).toString("hex");
  res.cookie("sid", token, { ...cookieBase, httpOnly: true, maxAge: SESSION_TTL_SECONDS * 1000 });
  res.cookie("csrf", csrf, { ...cookieBase, httpOnly: false, maxAge: SESSION_TTL_SECONDS * 1000 });
  return csrf;
}
function clearSession(req, res) {
  const claims = decodeSession(req);
  if (claims) { revoked.set(claims.jti, claims.exp); pruneRevoked(); }
  res.clearCookie("sid", cookieBase);
  res.clearCookie("csrf", cookieBase);
}
function decodeSession(req) {
  const token = req.cookies && req.cookies.sid;
  if (!token) return null;
  try {
    const claims = jwt.verify(token, SESSION_SECRET, { algorithms: ["HS256"], issuer: "cihe-smartassist" });
    if (revoked.has(claims.jti)) return null;
    return claims;
  } catch { return null; }
}

let lookupUser = () => null; // injected by index.js: (email, role) -> user record
function setUserLookup(fn) { lookupUser = fn; }

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

// Authentication + CSRF check for state-changing methods.
function requireAuth(req, res, next) {
  const claims = decodeSession(req);
  if (!claims) return res.status(401).json({ success: false, message: "Authentication required." });
  const user = lookupUser(claims.email, claims.role);
  if (!user) return res.status(401).json({ success: false, message: "Authentication required." });
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (!safeEqual(req.get("x-csrf-token"), req.cookies.csrf)) {
      audit("csrf_rejected", { actor: claims.email, ip: req.ip, path: req.path });
      return res.status(403).json({ success: false, message: "Invalid CSRF token." });
    }
  }
  req.user = { email: user.email, role: claims.role, unitCodes: user.unitCodes || [], id: user.id };
  next();
}

// ---------------------------------------------------------------- I3: RBAC
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      audit("authz_denied", { actor: req.user && req.user.email, role: req.user && req.user.role, ip: req.ip, method: req.method, path: req.path });
      return res.status(403).json({ success: false, message: "You do not have permission to do that." });
    }
    next();
  };
}

// ---------------------------------------------------------------- AU2: TOTP
function newTotpSecret() { return otplib.generateSecret(); }
function totpUri(email, secret) { return otplib.generateURI({ issuer: "CIHE SmartAssist", label: email, secret }); }
// Returns the matched time step, or null. Callers must reject steps <= the last accepted one (replay).
function verifyTotp(secret, token) {
  if (!secret || !/^\d{6}$/.test(String(token || ""))) return null;
  try {
    const r = otplib.verifySync({ secret, token: String(token), epochTolerance: 30 });
    return r.valid ? r.timeStep : null;
  } catch { return null; }
}

// ---------------------------------------------------------------- C2: encryption at rest
function loadKey() {
  const k = process.env.DATA_KEY;
  if (!k) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(k)) throw new Error("DATA_KEY must be 64 hex characters (32 bytes).");
  return Buffer.from(k, "hex");
}
function encryptData(plaintext, key) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return JSON.stringify({ v: 1, iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: enc.toString("base64") });
}
function decryptData(envelope, key) {
  const { iv, tag, data } = JSON.parse(envelope);
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

module.exports = {
  IS_PROD, hashPassword, verifyPassword, dummyVerify, passwordPolicyError,
  isEmail, isUnitCode, isStr, optStr, isDate, normEmail,
  audit, isLocked, recordFailure, clearFailures, resetLockouts, loginLimiter, apiLimiter,
  issueSession, clearSession, decodeSession, setUserLookup, requireAuth, requireRole,
  newTotpSecret, totpUri, verifyTotp, loadKey, encryptData, decryptData
};
