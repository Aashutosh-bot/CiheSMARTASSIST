import re, subprocess, sys, json
from playwright.sync_api import sync_playwright
secret = re.search(r"secret=([A-Z0-9]+)", open("/tmp/e2e-node.log").read()).group(1)
def totp():
    return subprocess.check_output(["node","-e",f"console.log(require('/home/claude/ict306/cihesmartassist/backend-data/node_modules/otplib').generateSync({{secret:'{secret}'}}))"]).decode().strip()
dialogs=[]
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    errors=[]
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("dialog", lambda d: (dialogs.append(d.message), d.accept()))
    pg.goto("http://localhost:3000/")
    pg.click("text=Admin Login")
    pg.fill('input[type=email]', "admin@cihe.edu.au")
    pg.fill('input[type=password]', "Correct-Horse-Battery-9")
    pg.click("button:text-is('Sign In')")
    pg.wait_for_selector("text=Authentication Code", timeout=5000)
    print("2FA prompt shown after correct password: OK")
    pg.fill('input[placeholder*="6-digit"]', totp())
    pg.click("button:text-is('Sign In')")
    pg.wait_for_url("**/admin", timeout=8000)
    pg.wait_for_timeout(1500)
    print("Admin dashboard reached; cookies:", sorted(c["name"] for c in pg.context.cookies()), "httpOnly sid:", [c["httpOnly"] for c in pg.context.cookies() if c["name"]=="sid"])
    print("localStorage keys:", pg.evaluate("Object.keys(localStorage)"))
    pg.click("text=Students")
    pg.wait_for_timeout(500)
    pg.fill('input[placeholder="Full Name"], input[placeholder="Name"]', "Eve Student") if pg.query_selector('input[placeholder="Full Name"], input[placeholder="Name"]') else None
    print("student form inputs:", pg.eval_on_selector_all("input", "els => els.map(e => e.placeholder).filter(Boolean)")[:8])
    b.close()
print("page errors:", errors); print("dialogs:", dialogs)
