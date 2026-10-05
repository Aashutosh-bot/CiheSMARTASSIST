import re, subprocess
from playwright.sync_api import sync_playwright
secret = re.search(r"secret=([A-Z0-9]+)", open("/tmp/e2e-node.log").read()).group(1)
import time
def totp():
    return subprocess.check_output(["node","-e",f"console.log(require('/home/claude/ict306/cihesmartassist/backend-data/node_modules/otplib').generateSync({{secret:'{secret}'}}))"]).decode().strip()
dialogs=[]
with sync_playwright() as p:
    b = p.chromium.launch()
    # ---- admin creates a student through the UI (CSRF header is added by the fetch wrapper)
    ctx = b.new_context(); pg = ctx.new_page()
    pg.on("dialog", lambda d: (dialogs.append(d.message), d.accept()))
    pg.goto("http://localhost:3000/")
    pg.click("text=Admin Login")
    pg.fill('input[type=email]', "admin@cihe.edu.au"); pg.fill('input[type=password]', "Correct-Horse-Battery-9")
    pg.click("button:text-is('Sign In')"); pg.wait_for_selector("text=Authentication Code")
    pg.fill('input[placeholder*="6-digit"]', totp()); pg.click("button:text-is('Sign In')")
    pg.wait_for_url("**/admin"); pg.wait_for_timeout(1000)
    pg.click("text=Students"); pg.wait_for_timeout(300)
    pg.fill('input[placeholder="Full Name"]', "Eve Student"); pg.fill('input[placeholder="Email"]', "eve2@cihe.edu.au")
    pg.click("button:text-is('Add Student')"); pg.wait_for_timeout(1000)
    print("Admin add-student dialog:", dialogs[-1].replace("\n"," ") if dialogs else "NONE")
    code = re.search(r"\n\n(\S+)\n\n", dialogs[-1]).group(1)
    pg.wait_for_selector("text=eve2@cihe.edu.au"); print("Student row visible in admin table: OK")
    ctx.close()
    # ---- student claims the account and logs in
    ctx = b.new_context(); pg = ctx.new_page()
    pg.goto("http://localhost:3000/")
    pg.click("text=Student Login", strict=False) if pg.query_selector("text=Student Login") else None
    pg.fill('input[type=email]', "eve2@cihe.edu.au"); pg.click("button:text-is('Continue')")
    pg.wait_for_selector("text=Activation Code")
    # weak password rejected client-side/server-side
    pg.fill('input[placeholder*="Code given"]', code)
    pg.fill('input[placeholder*="Choose a password"]', "short"); pg.fill('input[placeholder="Re-enter your password"]', "short")
    pg.click("button:has-text('Create Password')"); pg.wait_for_timeout(500)
    print("Weak password message:", pg.locator("p", has_text="at least 12").first.inner_text())
    pg.fill('input[placeholder*="Choose a password"]', "Tr0ub4dor-and-3-horses"); pg.fill('input[placeholder="Re-enter your password"]', "Tr0ub4dor-and-3-horses")
    pg.click("button:has-text('Create Password')"); pg.wait_for_selector("text=Password created")
    pg.fill('input[placeholder="Enter your password"]', "wrong-password-xx"); pg.click("button:text-is('Sign In')"); pg.wait_for_timeout(500)
    print("Wrong password message:", pg.locator("p", has_text="Invalid").first.inner_text())
    pg.fill('input[placeholder="Enter your password"]', "Tr0ub4dor-and-3-horses"); pg.click("button:text-is('Sign In')")
    pg.wait_for_url("**/dashboard", timeout=8000); pg.wait_for_timeout(1500)
    print("Student dashboard reached:", pg.url)
    # student tries admin API from the page itself: must be denied by the server regardless of localStorage
    pg.evaluate("localStorage.setItem('role','admin')")
    r = pg.evaluate("fetch('/api/students').then(r=>r.status)"); print("Student calling GET /api/students after faking role=admin in localStorage ->", r)
    r = pg.evaluate("fetch('/api/units',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'ICT555',name:'x'})}).then(r=>r.status)"); print("Student POST /api/units ->", r)
    # logout then session is dead
    pg.evaluate("fetch('/api/logout',{method:'POST'})"); pg.wait_for_timeout(300)
    print("After logout GET /api/me ->", pg.evaluate("fetch('/api/me').then(r=>r.status)"))
    b.close()
