import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { makeEnrolment, makeProof } from "./zkp.js";

function Login() {
  const [showModal, setShowModal] = useState(false);
  const [loginType, setLoginType] = useState("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [studentStep, setStudentStep] = useState("email"); // "email" | "setPassword" | "login"
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [code, setCode] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [totpUri, setTotpUri] = useState("");
  const [zkpEnrol, setZkpEnrol] = useState(false); // opt in to zero-knowledge sign-in after a password login
  const [zkpLog, setZkpLog] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  function openModal(type) {
    setLoginType(type);
    setError("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setActivationCode("");
    setCode("");
    setNeeds2fa(false);
    setTotpUri("");
    setInfo("");
    setZkpEnrol(false);
    setZkpLog("");
    setStudentStep("email");
    setShowModal(true);
  }

  async function checkEmail() {
    setError("");
    if (!email) {
      setError("Please enter your email.");
      return;
    }
    try {
      const res = await fetch("/api/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setStudentStep(data.hasPassword ? "login" : "setPassword");
    } catch {
      setError("Error connecting to server.");
    }
  }

  async function handleSetPassword() {
    setError("");
    if (!password || !confirmPassword || !activationCode) {
      setError("Please fill in the activation code and both password fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    try {
      const res = await fetch("/api/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, activationCode: activationCode.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setPassword("");
        setConfirmPassword("");
        setActivationCode("");
        setStudentStep("login");
        setInfo("Password created. Please sign in.");
      } else {
        setError(data.message);
      }
    } catch {
      setError("Error connecting to server.");
    }
  }

  async function handleLogin() {
    setError("");

    if (loginType === "admin") {
      if (!email || !password) {
        setError("Please enter your email and password.");
        return;
      }
      try {
        const res = await fetch("/api/admin-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, code: code || undefined })
        });
        const data = await res.json();
        if (data.success) {
          localStorage.setItem("loggedIn", "true");
          localStorage.setItem("role", data.role);
          navigate("/admin");
        } else {
          if (data.requires2fa) setNeeds2fa(true);
          setError(data.requires2fa && !code ? "" : (data.message || "Login failed."));
        }
      } catch {
        setError("Error connecting to server.");
      }
      return;
    }

    // student flow
    if (studentStep === "email") {
      checkEmail();
      return;
    }
    if (studentStep === "setPassword") {
      handleSetPassword();
      return;
    }
    // studentStep === "login"
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, code: code || undefined })
      });
      const data = await res.json();
      if (data.success) {
        if (zkpEnrol) {
          try { // opt-in: store only a public key derived from the password in this browser
            await fetch("/api/zkp/enroll", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(await makeEnrolment(password))
            });
          } catch { /* enrolment is optional; normal sign-in already succeeded */ }
        }
        localStorage.setItem("loggedIn", "true");
        localStorage.setItem("role", "student");
        localStorage.setItem("studentName", data.name);
        localStorage.setItem("studentEmail", email);
        navigate("/dashboard");
      } else {
        if (data.requires2fa) setNeeds2fa(true);
        setError(data.requires2fa && !code ? "" : (data.message || "Login failed."));
      }
    } catch {
      setError("Error connecting to server.");
    }
  }

  // Zero-knowledge sign-in: the browser proves it knows the password without sending it (Schnorr proof).
  async function handleZkpLogin() {
    setError("");
    setInfo("");
    setZkpLog("");
    if (!email || !password) {
      setError("Enter your email and password. The password stays in this browser.");
      return;
    }
    setBusy(true);
    try {
      const chRes = await fetch("/api/zkp/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const challenge = await chRes.json();
      if (!challenge.success) {
        setError(challenge.message || "Could not start zero-knowledge sign-in.");
        return;
      }
      const proof = await makeProof(email, password, challenge);
      const short = h => h.slice(0, 18) + "..." + h.slice(-8);
      const res = await fetch("/api/zkp/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, nonce: challenge.nonce, t: proof.t, s: proof.s })
      });
      const data = await res.json();
      if (data.success) {
        setZkpLog(`Sent to server: commitment t = ${short(proof.t)}, response s = ${short(proof.s)}. Password sent: NO. Server verified g^s = t * y^c.`);
        localStorage.setItem("loggedIn", "true");
        localStorage.setItem("role", data.role);
        localStorage.setItem("studentName", data.name);
        localStorage.setItem("studentEmail", email);
        setTimeout(() => navigate(data.role === "student" ? "/dashboard" : "/admin"), 2500);
      } else {
        setError(data.message === "Invalid email or proof." ? "Zero-knowledge sign-in failed. Check your password, or sign in normally and enable it first." : (data.message || "Sign-in failed."));
      }
    } catch {
      setError("Error connecting to server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", background: "#f3ede1", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <style>{`
        @keyframes sa-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .sa-hero-icon { animation: sa-float 3.5s ease-in-out infinite; }
        .sa-btn-primary { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .sa-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(187,85,51,0.35); }
        .sa-btn-outline { transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease; }
        .sa-btn-outline:hover { background: #f1f1f8; border-color: #bb5533; color: #bb5533; transform: translateY(-1px); }
        .sa-chip { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .sa-chip:hover { transform: translateY(-3px); box-shadow: 0 8px 18px rgba(28,43,58,0.08); }
      `}</style>

      {/* SOFT BACKGROUND BLOBS */}
      <div style={{ position: "absolute", top: -120, right: -100, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(187,85,51,0.14), transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -140, left: -120, width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(194,134,42,0.12), transparent 70%)", pointerEvents: "none" }} />

      {/* MINIMAL TOP BAR */}
      <div style={{ padding: "22px 36px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, background: "#1c2b3a", color: "#fffaf3", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: "bold", letterSpacing: 0.5 }}>
            SA
          </div>
          <span style={{ color: "#1c2b3a", fontWeight: "bold", fontSize: 16, letterSpacing: 0.3 }}>CIHE SmartAssist</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="sa-btn-outline"
            onClick={() => openModal("student")}
            style={{ background: "#fffaf3", color: "#1c2b3a", padding: "9px 20px", border: "1.5px solid #e3d9c6", borderRadius: 24, fontWeight: "bold", fontSize: 13, cursor: "pointer" }}
          >
            Student Login
          </button>
          <button
            className="sa-btn-primary"
            onClick={() => openModal("admin")}
            style={{ background: "#bb5533", color: "white", padding: "9px 20px", border: "none", borderRadius: 24, fontWeight: "bold", fontSize: 13, cursor: "pointer" }}
          >
            Admin Login
          </button>
        </div>
      </div>

      {/* CENTERED CHAT-FIRST HERO */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 24px", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", maxWidth: 620 }}>
          <div className="sa-hero-icon" style={{ marginBottom: 20, display: "flex", justifyContent: "center" }}>
            <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#1c2b3a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
            </svg>
          </div>
          <div style={{ fontSize: 36, fontWeight: "bold", color: "#1c2b3a", marginBottom: 14, lineHeight: 1.25 }}>
            Your AI campus assistant, on call 24/7
          </div>
          <div style={{ fontSize: 15, color: "#636b7a", lineHeight: 1.7, marginBottom: 30 }}>
            Ask SmartAssist about fees, enrolment, attendance, assignments, and more — get instant,
            accurate answers pulled straight from CIHE's own records.
          </div>
          <button
            className="sa-btn-primary"
            onClick={() => openModal("student")}
            style={{ background: "#bb5533", color: "white", padding: "15px 38px", border: "none", borderRadius: 28, fontWeight: "bold", fontSize: 15, cursor: "pointer", marginBottom: 34 }}
          >
            Sign in to start chatting
          </button>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            {["Instant answers", "Your data, secured", "Always up to date"].map((label, i) => (
              <div key={i} className="sa-chip" style={{ background: "#fffaf3", border: "1px solid #e3d9c6", borderRadius: 20, padding: "9px 18px", fontSize: 12.5, color: "#44485a", fontWeight: 600 }}>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "16px", fontSize: 11.5, color: "#9aa0ac", position: "relative", zIndex: 1 }}>
        © 2026 Crown Institute of Higher Education
      </div>

      {/* LOGIN MODAL */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#fffaf3", padding: 40, borderRadius: 10, boxShadow: "0 10px 40px rgba(0,0,0,0.25)", width: 380, textAlign: "center", position: "relative" }}
          >
            <button
              onClick={() => setShowModal(false)}
              style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#999" }}
            >
              ✕
            </button>

            <div style={{ background: "#1c2b3a", color: "#fffaf3", fontSize: 18, fontWeight: "bold", letterSpacing: 0.5, padding: 15, borderRadius: 8, marginBottom: 10, display: "inline-block", width: 70 }}>
              SA
            </div>
            <h2 style={{ color: "#1c2b3a", marginBottom: 5 }}>{loginType === "admin" ? "Admin Login" : "Student Login"}</h2>
            <p style={{ color: "#888", fontSize: 13, marginBottom: 25 }}>
              {loginType === "admin" ? "Sign in to manage SmartAssist" : "Sign in to chat with SmartAssist"}
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
              <button
                onClick={() => { setLoginType("student"); setStudentStep("email"); setNeeds2fa(false); setCode(""); setInfo(""); setError(""); setPassword(""); setConfirmPassword(""); }}
                style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #1c2b3a", background: loginType === "student" ? "#1c2b3a" : "white", color: loginType === "student" ? "white" : "#1c2b3a", fontSize: 12, fontWeight: "bold", cursor: "pointer" }}
              >
                Student
              </button>
              <button
                onClick={() => { setLoginType("admin"); setNeeds2fa(false); setCode(""); setInfo(""); setError(""); setPassword(""); }}
                style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #1c2b3a", background: loginType === "admin" ? "#1c2b3a" : "white", color: loginType === "admin" ? "white" : "#1c2b3a", fontSize: 12, fontWeight: "bold", cursor: "pointer" }}
              >
                Admin
              </button>
            </div>

            <label style={{ display: "block", textAlign: "left", fontSize: 13, fontWeight: "bold", marginBottom: 5 }}>Email</label>
            <input
              type="email"
              placeholder={loginType === "admin" ? "admin@cihe.edu.au" : "student@cihe.edu.au"}
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loginType === "student" && studentStep !== "email"}
              onKeyDown={e => e.key === "Enter" && loginType === "student" && studentStep === "email" && handleLogin()}
              style={{ width: "100%", padding: 11, marginBottom: 18, border: "1px solid #ccc", borderRadius: 6, fontSize: 14, boxSizing: "border-box", background: (loginType === "student" && studentStep !== "email") ? "#f5f5f5" : "white" }}
            />

            {(loginType === "admin" || studentStep !== "email") && (
              <>
                <label style={{ display: "block", textAlign: "left", fontSize: 13, fontWeight: "bold", marginBottom: 5 }}>
                  {studentStep === "setPassword" ? "Create Password" : "Password"}
                </label>
                <input
                  type="password"
                  placeholder={studentStep === "setPassword" ? "Choose a password (min 12 characters)" : "Enter your password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && studentStep !== "setPassword" && handleLogin()}
                  style={{ width: "100%", padding: 11, marginBottom: 18, border: "1px solid #ccc", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }}
                />
              </>
            )}

            {studentStep === "setPassword" && (
              <>
                <label style={{ display: "block", textAlign: "left", fontSize: 13, fontWeight: "bold", marginBottom: 5 }}>Confirm Password</label>
                <input
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  style={{ width: "100%", padding: 11, marginBottom: 18, border: "1px solid #ccc", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }}
                />
              </>
            )}

            {studentStep === "setPassword" && (
              <>
                <label style={{ display: "block", textAlign: "left", fontSize: 13, fontWeight: "bold", marginBottom: 5 }}>Activation Code</label>
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="Code given to you by the administrator"
                  value={activationCode}
                  onChange={e => setActivationCode(e.target.value)}
                  style={{ width: "100%", padding: 11, marginBottom: 18, border: "1px solid #ccc", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }}
                />
                <p style={{ fontSize: 12, color: "#c2862a", marginBottom: 12 }}>
                  First time signing in — enter your activation code and create a password (12+ characters).
                </p>
              </>
            )}

            {needs2fa && (
              <>
                <label style={{ display: "block", textAlign: "left", fontSize: 13, fontWeight: "bold", marginBottom: 5 }}>Authentication Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="6-digit code from your authenticator app"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  style={{ width: "100%", padding: 11, marginBottom: 18, border: "1px solid #ccc", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }}
                />
              </>
            )}

            {loginType === "student" && studentStep === "login" && (
              <div style={{ textAlign: "left", marginBottom: 14, padding: 12, border: "1px dashed #bb5533", borderRadius: 8, background: "#fff8f3" }}>
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "#1c2b3a", cursor: "pointer" }}>
                  <input type="checkbox" checked={zkpEnrol} onChange={e => setZkpEnrol(e.target.checked)} style={{ marginTop: 2 }} />
                  <span>Enable zero-knowledge sign-in for this account when I sign in with my password (stores only a public key).</span>
                </label>
                <button
                  onClick={handleZkpLogin}
                  disabled={busy}
                  style={{ width: "100%", marginTop: 10, padding: 10, background: "white", color: "#bb5533", fontSize: 13, fontWeight: "bold", border: "1px solid #bb5533", borderRadius: 6, cursor: busy ? "wait" : "pointer" }}
                >
                  {busy ? "Proving..." : "Sign in with zero-knowledge proof"}
                </button>
                <p style={{ fontSize: 11, color: "#888", margin: "8px 0 0" }}>The password never leaves your browser. Only a mathematical proof is sent.</p>
              </div>
            )}

            {zkpLog && <p style={{ color: "#1b7f3a", fontSize: 12, marginBottom: 12, wordBreak: "break-all", textAlign: "left" }}>{zkpLog}</p>}

            {info && <p style={{ color: "#1b7f3a", fontSize: 13, marginBottom: 12 }}>{info}</p>}

            {error && <p style={{ color: "#dc3545", fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <button onClick={handleLogin} style={{ width: "100%", padding: 12, background: "#1c2b3a", color: "white", fontSize: 15, fontWeight: "bold", border: "none", borderRadius: 6, cursor: "pointer" }}>
              {loginType === "admin" ? "Sign In" : studentStep === "email" ? "Continue" : studentStep === "setPassword" ? "Create Password & Sign In" : "Sign In"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
