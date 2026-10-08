// Zero-knowledge password proof (client side): Schnorr identification, made non-interactive with Fiat-Shamir.
// The password never leaves the browser. The server only ever sees:
//   enrolment: salt and the public key  y = g^x mod p   (x is derived from the password)
//   login:     commitment t = g^r mod p and response s = r + c*x mod q   (c is a hash challenge)
// and checks  g^s == t * y^c (mod p)  without learning x or the password.
// Group: RFC 3526 2048-bit MODP (group 14), g = 2, q = (p-1)/2 (p is a safe prime).
// Uses only BigInt and WebCrypto, so it also runs in Node for tests.
export const P = BigInt("0xffffffffffffffffc90fdaa22168c234c4c6628b80dc1cd129024e088a67cc74020bbea63b139b22514a08798e3404ddef9519b3cd3a431b302b0a6df25f14374fe1356d6d51c245e485b576625e7ec6f44c42e9a637ed6b0bff5cb6f406b7edee386bfb5a899fa5ae9f24117c4b1fe649286651ece45b3dc2007cb8a163bf0598da48361c55d39a69163fa8fd24cf5f83655d23dca3ad961c62f356208552bb9ed529077096966d670c354e4abc9804f1746c08ca18217c32905e462e36ce3be39e772c180e86039b2783a2ec07a28fb5c55df06f4c52c9de2bcbf6955817183995497cea956ae515d2261898fa051015728e5a8aacaa68ffffffffffffffff");
export const G = 2n;
export const Q = (P - 1n) / 2n;
export const PBKDF2_ITERATIONS = 310000;
const enc = new TextEncoder();
const subtle = globalThis.crypto.subtle;

export function modPow(base, exp, mod) {
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}
const toHex = (n) => n.toString(16);
const bytesToHex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, "0")).join("");
const hexToBigInt = (h) => BigInt("0x" + h);

export function randomHex(bytes) {
  return bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(bytes)));
}
function randomScalar() {
  // 2048 + 64 random bits reduced mod q: statistically uniform in [1, q-1].
  const n = hexToBigInt(randomHex(264)) % (Q - 1n);
  return n + 1n;
}

// x = PBKDF2-SHA256(password, salt) as a 256-bit secret exponent.
export async function deriveSecret(password, saltHex) {
  const key = await subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(saltHex), iterations: PBKDF2_ITERATIONS }, key, 256);
  const x = hexToBigInt(bytesToHex(new Uint8Array(bits))) % Q;
  return x === 0n ? 1n : x;
}

export async function challengeHash(email, nonce, tHex, yHex) {
  const data = enc.encode(`CIHE-ZKP-v1|${email}|${nonce}|${tHex}|${yHex}`);
  const digest = new Uint8Array(await subtle.digest("SHA-256", data));
  return hexToBigInt(bytesToHex(digest)) % Q;
}

// Enrolment: returns what the server stores. The password and x stay in the browser.
export async function makeEnrolment(password) {
  const salt = randomHex(16);
  const x = await deriveSecret(password, salt);
  return { salt, y: toHex(modPow(G, x, P)) };
}

// Login proof for a server challenge { nonce, salt }.
export async function makeProof(email, password, challenge) {
  const x = await deriveSecret(password, challenge.salt);
  const y = modPow(G, x, P);
  const r = randomScalar();
  const t = modPow(G, r, P);
  const tHex = toHex(t);
  const c = await challengeHash(email, challenge.nonce, tHex, toHex(y));
  const s = (r + c * x) % Q;
  return { t: tHex, s: toHex(s) };
}
