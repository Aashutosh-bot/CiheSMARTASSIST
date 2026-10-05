# Phase 3: Secure design decisions (condensed)

| Principle | Decision | Where |
|---|---|---|
| Least privilege | Three roles (student, lecturer, admin). Lecturers are scoped to their own units. Students see only their own records. The Python service validates sessions as the user and forwards the user's own cookie, not a service super-account. | `requireRole`, `staffUnits`, `auth_guard.py` |
| Defence in depth | Layers: headers/CSP -> CORS allow-list -> rate limit -> body cap -> session -> CSRF -> RBAC -> input validation -> encrypted storage -> audit log. | `index.js` middleware order |
| Fail secure | Unknown role is treated as student; auth-service outage returns 503 not "allow"; errors are generic; encrypted data is never overwritten if the key is wrong. | `filter_by_role`, `current_user`, `loadPersistedData` |
| Minimise attack surface | Removed the duplicate FastAPI login with hardcoded credentials; `/docs` off in production; Node binds to localhost; unused CORS methods/headers dropped. | `main.py`, `index.js` |
| Separation of duties | Admin manages accounts and units; lecturers record attendance/assessments for their units only; only admins can issue activation codes or read the audit-relevant staff list. | RBAC matrix |
| Session design | Server-signed JWT in HttpOnly, SameSite=Strict cookie; 1-hour expiry; server-side revocation on logout; role re-checked against the live user record on each request. | `security.js` |
| Authentication design | Argon2id (m=19 MiB, t=2, p=1); 12+ char passwords checked against a common list (NIST 800-63B style); TOTP mandatory for staff, optional for students; activation codes for first use. | `security.js`, `index.js` |
| Data protection | `data.json` encrypted at rest (AES-256-GCM, key from environment); password/TOTP/activation fields stripped from every API response. | `encryptData`, `publicStudent` |
| LLM-specific | Untrusted text (user question, retrieved chunks) is sanitised and fenced as data; staff-only knowledge is filtered by role before it can reach the prompt. | `guard.py`, `generator.py`, `rag_engine.search` |

## Requirement traceability
C1 Argon2id/no hardcoded creds; C2 encrypted data file; C3 TLS (deployment) + headers; C4 role-aware retrieval; C5 secrets from environment;
I1 validation; I2 CSRF; I3 RBAC; I4 prompt-injection defences; A1 rate limiting and lockout; A2 fail-secure errors;
AU1 sessions; AU2 TOTP; AU3 ZKP login (NOT implemented, see SECURITY.md); AU4 audit logging.
