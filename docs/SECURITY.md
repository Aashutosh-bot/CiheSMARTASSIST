# ICT306 security hardening of CIHE SmartAssist

Branch `ict306-security`. Work for ICT306 Assessment 3 (SSDLC). The ICT308 capstone code on `main` is unchanged.

## Run it
```bash
cp .env.example backend-data/.env   # then fill in values; export them (or use your process manager)
cd backend-data && npm install && npm start      # API on :5000 (first start prints one-time admin 2FA secret)
cd backend-rag && python main.py   # or: uvicorn main:app --port 5001   (needs NODE_BACKEND_URL)
cd frontend && npm install && npm run dev        # :3000, proxies to both APIs
```
First start (development) prints: the admin 2FA enrolment URI (add to an authenticator app), a generated admin password if `ADMIN_PASSWORD` is unset, and an activation code for the seed student. Admins issue activation codes for new students in the Students tab.

## Tests
```bash
cd backend-data && npm test                 # 16 tests
cd backend-rag && python -m pytest test_security.py -q   # 30 tests (ML libraries faked)
```

## What changed (summary)
Argon2id passwords; no credentials in code; signed HttpOnly sessions with logout revocation; CSRF protection; RBAC on every route (lecturers limited to their units); TOTP 2FA (mandatory for staff, optional for students, replay-protected); activation-code onboarding; lockout and rate limiting; input validation and body limits; helmet/CSP and CORS allow-list; AES-256-GCM encrypted data file; audit log; Python API requires a valid session, role-filters retrieval, blocks prompt injection, rate-limits chat.

## Known limitations and residual risk (be honest in the report)
- **AU3 zero-knowledge-proof login is not implemented.** Advanced features delivered instead: rate limiting/lockout, API access control, secure session management, input validation, audit monitoring, role-aware retrieval and prompt-injection defence.
- **No TLS in development.** `Secure` cookies and HSTS switch on with `NODE_ENV=production`; TLS itself must be terminated by a reverse proxy (see Deployment below). Not tested here.
- Sessions, lockout counters and revocation list are in memory: they reset on restart and do not scale past one instance.
- Storage is a JSON file, not a database. There is no SQL, so SQL injection is not applicable, but concurrency and backup are weak.
- Legacy passwords found in an old `data.json` are hashed on first start but not forced to meet the new policy until changed.
- The admin TOTP secret is printed to the console once at bootstrap.
- Moodle: REST calls now use POST (token out of the URL), but this was **not tested against a live Moodle**; the file-download URL still carries the token. Revert `moodle_loader.py` if Moodle rejects POST.
- The Hugging Face model download is not pinned to a revision (Bandit B615).
- The Python tests use fake ML libraries; the real FAISS/flan-t5 path was not run here.
- A lecturer signs in via the admin login and sees the admin UI; the API enforces unit scope but the UI is not yet tailored.
- The CI workflow has not been run on GitHub yet.
- Prompt-injection detection is pattern-based and will not stop a determined, novel attack; it reduces risk, and the model has no tools or secrets to abuse.

## Deployment checklist (Phase 6, untested)
Set `NODE_ENV=production`, `SESSION_SECRET`, `DATA_KEY`, `ADMIN_PASSWORD`, `ALLOWED_ORIGINS`; run behind a TLS reverse proxy (for example Caddy: `smartassist.example { handle /api/chat* /api/dashboard* /api/moodle* /api/query* /api/chat-insights* { reverse_proxy localhost:5001 } handle /api/* { reverse_proxy localhost:5000 } handle { root * frontend/dist; file_server } }`) so the app is same-origin; keep ports 5000/5001 off the public interface; set `TRUST_PROXY=1`; set `APP_ENV=production` for FastAPI; back up `data.json` and keep `DATA_KEY` separate; rotate the Moodle token.
Incident response: lock or delete the account (admin), rotate `SESSION_SECRET` (logs everyone out), review `audit.log` for `login_failure`, `account_locked`, `authz_denied`, `csrf_rejected`.
Vulnerability disclosure: report privately to the team lead; fix, retest, record in the audit evidence.
Patch management: `npm audit` and Dependabot weekly; CI fails on high-severity advisories.

## Evidence
`docs/evidence/`: `baseline_attack_results.txt` vs `hardened_attack_results.txt` (same script, original vs hardened), `dependency_and_sast_results.txt`, `e2e_browser_results.txt`.
