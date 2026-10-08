"use strict";
// Zero-knowledge password login (server side): verifies a Schnorr proof of knowledge (Fiat-Shamir).
// The server stores only a public key y = g^x mod p, where x = PBKDF2(password, salt) is computed in the
// browser. At login the browser proves it knows x (and so the password) without sending either.
// Verification equation: g^s == t * y^c (mod p). Group: RFC 3526 group 14 (2048-bit safe prime), g = 2.
const crypto = require("crypto");

const P = BigInt("0x" + crypto.getDiffieHellman("modp14").getPrime().toString("hex"));
const G = 2n;
const Q = (P - 1n) / 2n;

function modPow(base, exp, mod) {
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

const HEX = /^[0-9a-f]{1,520}$/;
const SALT = /^[0-9a-f]{32}$/;
const parse = h => (typeof h === "string" && HEX.test(h) ? BigInt("0x" + h) : null);
// Elements must lie in the order-q subgroup (blocks small-subgroup / out-of-range values).
const inGroup = v => v !== null && v > 1n && v < P - 1n && modPow(v, Q, P) === 1n;

// Single-use, short-lived challenges bound to one email (stops replay of a captured proof).
const CHALLENGE_TTL_MS = 60 * 1000;
const challenges = new Map(); // nonce -> { email, exp }
function newChallenge(email) {
  const now = Date.now();
  for (const [n, c] of challenges) if (c.exp < now) challenges.delete(n);
  if (challenges.size > 5000) challenges.clear();
  const nonce = crypto.randomBytes(24).toString("hex");
  challenges.set(nonce, { email, exp: now + CHALLENGE_TTL_MS });
  return nonce;
}
function takeChallenge(nonce, email) {
  const c = challenges.get(nonce);
  challenges.delete(nonce); // consumed whether or not the proof verifies
  return !!c && c.exp >= Date.now() && c.email === email;
}

function challengeHash(email, nonce, tHex, yHex) {
  const d = crypto.createHash("sha256").update(`CIHE-ZKP-v1|${email}|${nonce}|${tHex}|${yHex}`).digest("hex");
  return BigInt("0x" + d) % Q;
}

// Validates enrolment material sent by an authenticated user. Returns {salt, y} or null.
function parseEnrolment(body) {
  const { salt, y } = body || {};
  if (typeof salt !== "string" || !SALT.test(salt)) return null;
  const yv = parse(y);
  if (!inGroup(yv)) return null;
  return { salt, y: yv.toString(16) };
}

// Returns true only if the proof verifies for the stored public key.
function verifyProof({ email, nonce, t, s }, record) {
  if (!record || !takeChallenge(nonce, email)) return false;
  const tv = parse(t), sv = parse(s), yv = parse(record.y);
  if (!inGroup(tv) || !inGroup(yv) || sv === null || sv >= Q) return false;
  const c = challengeHash(email, nonce, tv.toString(16), yv.toString(16));
  const lhs = modPow(G, sv, P);
  const rhs = (tv * modPow(yv, c, P)) % P;
  return lhs === rhs;
}

// Same-shape salt for unknown/unenrolled accounts so the challenge endpoint does not reveal who is enrolled.
function fakeSalt(keyedHash, email) {
  return keyedHash("zkp-salt", email).slice(0, 32);
}

module.exports = { P, G, Q, modPow, newChallenge, verifyProof, parseEnrolment, fakeSalt };
