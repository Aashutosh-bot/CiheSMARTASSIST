import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login() {
  const [showModal, setShowModal] = useState(false);
  const [loginType, setLoginType] = useState("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [studentStep, setStudentStep] = useState("email"); // "email" | "setPassword" | "login"
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function openModal(type) {
    setLoginType(type);
    setError("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
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
    if (!password || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      const res = await fetch("/api/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("loggedIn", "true");
        localStorage.setItem("role", "student");
        localStorage.setItem("studentName", data.name);
        localStorage.setItem("studentEmail", email);
        navigate("/dashboard");
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
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
          localStorage.setItem("loggedIn", "true");
          localStorage.setItem("role", "admin");
          navigate("/admin");
        } else {
          setError(data.message || "Login failed.");
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
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("loggedIn", "true");
        localStorage.setItem("role", "student");
        localStorage.setItem("studentName", data.name);
        localStorage.setItem("studentEmail", email);
        navigate("/dashboard");
      } else {
        setError(data.message || "Login failed.");
      }
    } catch {
      setError("Error connecting to server.");
    }
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#0f2a52", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* MINIMAL TOP BAR */}
      <div style={{ padding: "22px 36px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, background: "#e8a020", color: "#0f2a52", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
            🤖
          </div>
          <span style={{ color: "white", fontWeight: "bold", fontSize: 16, letterSpacing: 0.3 }}>CIHE SmartAssist</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => openModal("student")}
            style={{ background: "transparent", color: "white", padding: "9px 20px", border: "1.5px solid rgba(255,255,255,0.4)", borderRadius: 24, fontWeight: "bold", fontSize: 13, cursor: "pointer" }}
          >
            Student Login
          </button>
          <button
            onClick={() => openModal("admin")}
            style={{ background: "#e8a020", color: "white", padding: "9px 20px", border: "none", borderRadius: 24, fontWeight: "bold", fontSize: 13, cursor: "pointer" }}
          >
            Admin Login
          </button>
        </div>
      </div>

      {/* CENTERED CHAT-FIRST HERO */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 24px" }}>
        <div style={{ textAlign: "center", maxWidth: 640 }}>
          <div style={{ fontSize: 56, marginBottom: 18 }}>💬</div>
          <div style={{ fontSize: 34, fontWeight: "bold", color: "white", marginBottom: 14, lineHeight: 1.25 }}>
            Your AI campus assistant, on call 24/7
          </div>
          <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.7, marginBottom: 34 }}>
            Ask SmartAssist about fees, enrolment, attendance, assignments, and more — get instant,
            accurate answers pulled straight from CIHE's own records.
          </div>
          <button
            onClick={() => openModal("student")}
            style={{ background: "#e8a020", color: "white", padding: "15px 38px", border: "none", borderRadius: 28, fontWeight: "bold", fontSize: 15, cursor: "pointer" }}
          >
            Sign in to start chatting
          </button>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "16px", fontSize: 11.5, color: "#7e93b3" }}>
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
            style={{ background: "white", padding: 40, borderRadius: 10, boxShadow: "0 10px 40px rgba(0,0,0,0.25)", width: 380, textAlign: "center", position: "relative" }}
          >
            <button
              onClick={() => setShowModal(false)}
              style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#999" }}
            >
              ✕
            </button>

            <div style={{ background: "#0f2a52", color: "white", fontSize: 20, fontWeight: "bold", padding: 15, borderRadius: 8, marginBottom: 10, display: "inline-block", width: 70 }}>
              🤖
            </div>
            <h2 style={{ color: "#0f2a52", marginBottom: 5 }}>{loginType === "admin" ? "Admin Login" : "Student Login"}</h2>
            <p style={{ color: "#888", fontSize: 13, marginBottom: 25 }}>
              {loginType === "admin" ? "Sign in to manage SmartAssist" : "Sign in to chat with SmartAssist"}
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
              <button
                onClick={() => { setLoginType("student"); setStudentStep("email"); setError(""); setPassword(""); setConfirmPassword(""); }}
                style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #0f2a52", background: loginType === "student" ? "#0f2a52" : "white", color: loginType === "student" ? "white" : "#0f2a52", fontSize: 12, fontWeight: "bold", cursor: "pointer" }}
              >
                Student
              </button>
              <button
                onClick={() => { setLoginType("admin"); setError(""); setPassword(""); }}
                style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #0f2a52", background: loginType === "admin" ? "#0f2a52" : "white", color: loginType === "admin" ? "white" : "#0f2a52", fontSize: 12, fontWeight: "bold", cursor: "pointer" }}
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
                  placeholder={studentStep === "setPassword" ? "Choose a password (min 6 characters)" : "Enter your password"}
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
              <p style={{ fontSize: 12, color: "#e8a020", marginBottom: 12 }}>
                First time signing in — please create a password for your account.
              </p>
            )}

            {error && <p style={{ color: "#dc3545", fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <button onClick={handleLogin} style={{ width: "100%", padding: 12, background: "#0f2a52", color: "white", fontSize: 15, fontWeight: "bold", border: "none", borderRadius: 6, cursor: "pointer" }}>
              {loginType === "admin" ? "Sign In" : studentStep === "email" ? "Continue" : studentStep === "setPassword" ? "Create Password & Sign In" : "Sign In"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
